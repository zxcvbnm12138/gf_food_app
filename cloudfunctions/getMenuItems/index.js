// 云函数：按房间获取菜品，避免客户端集合权限影响点餐端读取
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command

const DEFAULT_MENU_CATEGORIES = [
  { id: 'hot', name: '热销', emoji: '🔥', color: '#FFF1F0', sortOrder: 1 },
  { id: 'dessert', name: '甜点', emoji: '🍰', color: '#FFF7E6', sortOrder: 2 },
  { id: 'drink', name: '饮品', emoji: '🥤', color: '#E6FFFB', sortOrder: 3 },
  { id: 'carb', name: '面食', emoji: '🍜', color: '#F0F5FF', sortOrder: 4 },
  { id: 'light', name: '轻食', emoji: '🥗', color: '#F6FFED', sortOrder: 5 },
  { id: 'warm', name: '暖饮', emoji: '🍵', color: '#E8F3FF', sortOrder: 6 },
]

function normalizeRoomId(roomId) {
  return roomId ? String(roomId).trim().toUpperCase() : ''
}

function getRoomIdQuery(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId)
  const rawRoomId = roomId ? String(roomId).trim() : ''
  const roomIds = Array.from(new Set([rawRoomId, normalizedRoomId].filter(Boolean)))
  return roomIds.length > 1 ? { roomId: _.in(roomIds) } : { roomId: normalizedRoomId }
}

function isRoomMember(room, openid) {
  if (!room || !openid) return false
  const members = Array.isArray(room.members) ? room.members : []
  return room.creatorOpenid === openid || members.includes(openid)
}

async function authorizeRoomMember(roomId, openid) {
  const normalizedRoomId = normalizeRoomId(roomId)
  if (!openid) {
    return { success: false, message: '无法获取用户身份' }
  }
  if (!normalizedRoomId) {
    return { success: false, message: '缺少 roomId' }
  }

  const roomRes = await db.collection('rooms')
    .where(getRoomIdQuery(normalizedRoomId))
    .limit(1)
    .get()
  const room = roomRes.data && roomRes.data[0]
  if (!room) {
    return { success: false, message: '房间不存在' }
  }
  if (!isRoomMember(room, openid)) {
    return { success: false, message: '没有当前房间的访问权限' }
  }

  return { success: true, room }
}

function isCollectionMissing(error) {
  const errCode = error && (error.errCode || error.code)
  const message = String((error && error.message) || error || '').toLowerCase()
  return errCode === -502005 ||
    message.includes('collection not exists') ||
    message.includes('collection not exist') ||
    message.includes('collection does not exist') ||
    message.includes('not exist')
}

function isCollectionAlreadyExists(error) {
  const message = String((error && error.message) || error || '').toLowerCase()
  return message.includes('already exists') ||
    message.includes('already exist') ||
    message.includes('collection exists') ||
    message.includes('collection existed')
}

async function ensureCollection(collectionName) {
  if (typeof db.createCollection !== 'function') return
  try {
    await db.createCollection(collectionName)
  } catch (e) {
    if (!isCollectionAlreadyExists(e)) throw e
  }
}

async function addCollectionDoc(collectionName, data) {
  try {
    return await db.collection(collectionName).add({ data })
  } catch (e) {
    if (!isCollectionMissing(e)) throw e
    await ensureCollection(collectionName)
    return db.collection(collectionName).add({ data })
  }
}

async function touchRoomMenu(roomId) {
  roomId = normalizeRoomId(roomId)
  if (!roomId) return

  try {
    const roomRes = await db.collection('rooms').where({ roomId }).limit(1).get()
    if (!roomRes.data || roomRes.data.length === 0) return

    const room = roomRes.data[0]
    const nextVersion = (Number(room.menuVersion) || 0) + 1
    await db.collection('rooms').doc(room._id).update({
      data: {
        menuUpdatedAt: new Date(),
        menuVersion: nextVersion,
      },
    })
  } catch (e) {
    console.warn('更新房间菜单版本失败:', e)
  }
}

async function seedCategories(roomId) {
  const now = new Date()
  await Promise.all(DEFAULT_MENU_CATEGORIES.map(category => addCollectionDoc('menu_categories', {
    ...category,
    roomId,
    createdAt: now,
    updatedAt: now,
  })))
  await touchRoomMenu(roomId)
  return DEFAULT_MENU_CATEGORIES.map(category => ({ ...category, roomId }))
}

async function getCategories(roomId) {
  let countRes
  try {
    countRes = await db.collection('menu_categories').where({ roomId }).count()
  } catch (e) {
    if (isCollectionMissing(e)) {
      return seedCategories(roomId)
    }
    throw e
  }
  if (countRes.total === 0) {
    return seedCategories(roomId)
  }

  const batchTimes = Math.ceil(countRes.total / 100)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(
      db.collection('menu_categories')
        .where({ roomId })
        .skip(i * 100)
        .limit(100)
        .get()
    )
  }

  const results = await Promise.all(tasks)
  return results
    .reduce((all, result) => all.concat(result.data || []), [])
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
}

async function getCustomCoupons(roomId) {
  let countRes
  try {
    countRes = await db.collection('custom_coupons').where({ roomId }).count()
  } catch (e) {
    if (isCollectionMissing(e)) {
      return []
    }
    throw e
  }

  if (countRes.total === 0) return []

  const batchTimes = Math.ceil(countRes.total / 100)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(
      db.collection('custom_coupons')
        .where({ roomId })
        .skip(i * 100)
        .limit(100)
        .get()
    )
  }

  const results = await Promise.all(tasks)
  return results
    .reduce((all, result) => all.concat(result.data || []), [])
    .sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime() || 0
      const bTime = new Date(b.createdAt || 0).getTime() || 0
      return aTime - bTime
    })
}

async function getMenuItems(roomId, rawRoomId = roomId) {
  const roomIds = Array.from(new Set([rawRoomId, roomId].filter(Boolean)))
  const query = roomIds.length > 1 ? { roomId: _.in(roomIds) } : { roomId }
  const countRes = await db.collection('menu_items').where(query).count()
  const total = countRes.total
  if (total === 0) return []

  const batchTimes = Math.ceil(total / 100)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(
      db.collection('menu_items')
        .where(query)
        .skip(i * 100)
        .limit(100)
        .get()
    )
  }

  const results = await Promise.all(tasks)
  return results
    .reduce((all, result) => all.concat(result.data || []), [])
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const rawRoomId = event.roomId ? String(event.roomId).trim() : ''
  const roomId = normalizeRoomId(rawRoomId)

  if (!roomId) {
    return { success: false, message: '缺少 roomId', items: [] }
  }

  try {
    const auth = await authorizeRoomMember(roomId, wxContext.OPENID)
    if (!auth.success) {
      return { ...auth, items: [], categories: [], coupons: [] }
    }

    if (event.action === 'getCategories') {
      const categories = await getCategories(roomId)
      return { success: true, categories }
    }

    if (event.action === 'getCoupons') {
      const coupons = await getCustomCoupons(roomId)
      return { success: true, coupons }
    }

    if (event.action === 'getSnapshot') {
      const [items, categories] = await Promise.all([
        getMenuItems(roomId, rawRoomId),
        getCategories(roomId),
      ])
      return { success: true, items, categories }
    }

    const items = await getMenuItems(roomId, rawRoomId)
    return { success: true, items }
  } catch (e) {
    console.error('获取菜品失败:', e)
    return { success: false, message: e.message || '获取失败', items: [] }
  }
}
