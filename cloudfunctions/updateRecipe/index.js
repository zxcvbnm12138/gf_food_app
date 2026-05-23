// 云函数：管理菜谱（服务端校验房间成员和菜谱作者）
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

function normalizeText(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeRecipeList(value, maxItems = 80, maxLength = 300) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,，、;；]/)

  return source
    .map(item => normalizeText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function normalizePhotos(value) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => normalizeText(item, 500))
    .filter(Boolean)
    .slice(0, 9)
}

function normalizeVideoUrl(value) {
  const url = normalizeText(value, 500)
  return /^https?:\/\//i.test(url) ? url : ''
}

function sanitizeRecipeFields(fields) {
  if (!fields || typeof fields !== 'object') return {}
  const data = {}

  if ('title' in fields) data.title = normalizeText(fields.title, 80)
  if ('materials' in fields) data.materials = normalizeRecipeList(fields.materials, 80, 160)
  if ('process' in fields) data.process = normalizeRecipeList(fields.process, 120, 300)
  if ('videoUrl' in fields) data.videoUrl = normalizeVideoUrl(fields.videoUrl)
  if ('photos' in fields) data.photos = normalizePhotos(fields.photos)

  return data
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
    return { success: false, message: '没有当前房间的操作权限' }
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

async function removeRecipesByRoom(roomId) {
  let removed = 0
  while (true) {
    const res = await db.collection('recipes')
      .where(getRoomIdQuery(roomId))
      .limit(100)
      .get()

    const docs = Array.isArray(res.data) ? res.data : []
    if (docs.length === 0) break

    await Promise.all(docs.map((doc) => db.collection('recipes').doc(doc._id).remove()))
    removed += docs.length

    if (docs.length < 100) break
  }
  return removed
}

async function getRecipeDoc(cloudId) {
  const docId = String(cloudId || '').trim()
  if (!docId) return null
  const res = await db.collection('recipes').doc(docId).get()
  return res && res.data ? { ...res.data, _id: res.data._id || docId } : null
}

function ensureRecipeOwner(recipe, openid) {
  return recipe && String(recipe.creatorOpenid || '').trim() === String(openid || '').trim()
}

exports.main = async (event, context) => {
  const { action = 'update', cloudId, updateFields } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const roomId = normalizeRoomId(event.roomId)
  let cachedAuth = null

  async function ensureRoomAuth(targetRoomId = roomId) {
    const normalizedTargetRoomId = normalizeRoomId(targetRoomId)
    if (cachedAuth && normalizeRoomId(cachedAuth.room && cachedAuth.room.roomId) === normalizedTargetRoomId) {
      return cachedAuth
    }
    cachedAuth = await authorizeRoomMember(normalizedTargetRoomId, openid)
    return cachedAuth
  }

  if (action === 'add') {
    const recipeFields = sanitizeRecipeFields(updateFields)
    if (!roomId || !recipeFields.title) {
      return { success: false, message: '缺少参数' }
    }

    try {
      const auth = await ensureRoomAuth()
      if (!auth.success) return auth

      const now = new Date()
      const res = await addCollectionDoc('recipes', {
        ...recipeFields,
        roomId,
        creatorOpenid: openid,
        createdAt: now,
        updatedAt: now,
      })

      return { success: true, _id: res._id }
    } catch (e) {
      console.error('新增菜谱失败:', e)
      return { success: false, message: e.message || '新增失败' }
    }
  }

  if (action === 'deleteByRoom') {
    if (!roomId) {
      return { success: false, message: '缺少 roomId' }
    }

    try {
      const auth = await ensureRoomAuth()
      if (!auth.success) return auth

      const removed = await removeRecipesByRoom(event.roomId || roomId)
      return { success: true, removed }
    } catch (e) {
      if (isCollectionMissing(e)) return { success: true, removed: 0 }
      console.error('清空房间菜谱失败:', e)
      return { success: false, message: e.message || '清空失败' }
    }
  }

  if (!cloudId) {
    return { success: false, message: '缺少参数' }
  }

  try {
    const current = await getRecipeDoc(cloudId)
    if (!current) {
      return { success: false, message: '菜谱不存在' }
    }

    const currentRoomId = normalizeRoomId(current.roomId || roomId)
    if (!currentRoomId) {
      return { success: false, message: '菜谱缺少房间归属' }
    }
    if (roomId && currentRoomId !== roomId) {
      return { success: false, message: '菜谱不属于当前房间' }
    }

    const auth = await ensureRoomAuth(currentRoomId)
    if (!auth.success) return auth
    if (!ensureRecipeOwner(current, openid)) {
      return { success: false, message: '只能管理自己的菜谱' }
    }

    if (action === 'delete') {
      const res = await db.collection('recipes').doc(cloudId).remove()
      return { success: true, removed: res.stats.removed }
    }

    const recipeFields = sanitizeRecipeFields(updateFields)
    if (Object.keys(recipeFields).length === 0) {
      return { success: false, message: '缺少参数' }
    }
    if ('title' in recipeFields && !recipeFields.title) {
      return { success: false, message: '缺少菜谱名称' }
    }

    const res = await db.collection('recipes').doc(cloudId).update({
      data: {
        ...recipeFields,
        roomId: currentRoomId,
        creatorOpenid: openid,
        updatedAt: new Date(),
      },
    })

    return { success: true, updated: res.stats.updated }
  } catch (e) {
    if (isCollectionMissing(e)) return { success: false, message: '菜谱不存在' }
    console.error('管理菜谱失败:', e)
    return { success: false, message: e.message || '操作失败' }
  }
}
