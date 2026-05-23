// 云函数：按房间获取当前用户自己的菜谱
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command

function normalizeRoomId(roomId) {
  return roomId ? String(roomId).trim().toUpperCase() : ''
}

function getRoomIdQuery(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId)
  const rawRoomId = roomId ? String(roomId).trim() : ''
  const roomIds = Array.from(new Set([rawRoomId, normalizedRoomId].filter(Boolean)))
  return roomIds.length > 1 ? { roomId: _.in(roomIds) } : { roomId: normalizedRoomId }
}

function buildRecipeRoomQuery(roomId, rawRoomId, openid) {
  const roomIds = Array.from(new Set([rawRoomId, roomId].filter(Boolean)))
  return {
    roomId: roomIds.length > 1 ? _.in(roomIds) : roomId,
    creatorOpenid: openid,
  }
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

async function getRecipes(roomId, rawRoomId, openid) {
  const query = buildRecipeRoomQuery(roomId, rawRoomId, openid)
  let countRes
  try {
    countRes = await db.collection('recipes').where(query).count()
  } catch (e) {
    if (isCollectionMissing(e)) return []
    throw e
  }

  const total = countRes.total
  if (total === 0) return []

  const batchTimes = Math.ceil(total / 100)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(
      db.collection('recipes')
        .where(query)
        .skip(i * 100)
        .limit(100)
        .get()
    )
  }

  const results = await Promise.all(tasks)
  return results
    .reduce((all, result) => all.concat(result.data || []), [])
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0
      return bTime - aTime
    })
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const rawRoomId = event.roomId ? String(event.roomId).trim() : ''
  const roomId = normalizeRoomId(rawRoomId)

  if (!roomId) {
    return { success: false, message: '缺少 roomId', recipes: [] }
  }

  try {
    const auth = await authorizeRoomMember(roomId, wxContext.OPENID)
    if (!auth.success) {
      return { ...auth, recipes: [] }
    }

    const recipes = await getRecipes(roomId, rawRoomId, wxContext.OPENID)
    return { success: true, recipes }
  } catch (e) {
    console.error('获取菜谱失败:', e)
    return { success: false, message: e.message || '获取失败', recipes: [] }
  }
}
