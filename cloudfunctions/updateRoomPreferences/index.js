// 云函数：管理房间维度的用户偏好（room + openid）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()

function normalizeRoomId(roomId) {
  return roomId ? String(roomId).trim().toUpperCase() : ''
}

function normalizePreferenceList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.flatMap(item => normalizePreferenceList(item))))
  }
  if (value === null || value === undefined) return []
  return Array.from(new Set(String(value)
    .split(/[,，、;；\n]/)
    .map(item => item.trim())
    .filter(Boolean)))
}

function normalizePreferences(preferences) {
  return {
    dislikes: normalizePreferenceList(preferences && preferences.dislikes),
    allergies: normalizePreferenceList(preferences && preferences.allergies),
  }
}

function normalizePreferenceDoc(doc) {
  if (!doc) return null
  return {
    _id: doc._id || '',
    roomId: normalizeRoomId(doc.roomId || ''),
    openid: String(doc.openid || '').trim(),
    ...normalizePreferences(doc),
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
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
    .where({ roomId: normalizedRoomId })
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

async function findPreferenceDoc(roomId, openid) {
  try {
    const res = await db.collection('room_user_preferences')
      .where({ roomId, openid })
      .limit(1)
      .get()
    return Array.isArray(res.data) ? res.data[0] || null : null
  } catch (e) {
    if (isCollectionMissing(e)) return null
    throw e
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const roomId = normalizeRoomId(event.roomId)
  const action = String(event.action || 'get').trim()

  try {
    const auth = await authorizeRoomMember(roomId, openid)
    if (!auth.success) return auth

    const defaults = {
      dislikes: [],
      allergies: [],
    }

    if (action === 'get') {
      const doc = await findPreferenceDoc(roomId, openid)
      if (!doc) {
        return {
          success: true,
          found: false,
          roomId,
          openid,
          preferences: defaults,
        }
      }

      return {
        success: true,
        found: true,
        roomId,
        openid,
        preferences: normalizePreferenceDoc(doc),
      }
    }

    if (action === 'clear') {
      const doc = await findPreferenceDoc(roomId, openid)
      if (doc && doc._id) {
        await db.collection('room_user_preferences').doc(doc._id).remove()
      }
      return {
        success: true,
        roomId,
        openid,
        preferences: defaults,
      }
    }

    if (action !== 'save') {
      return { success: false, message: '不支持的操作' }
    }

    const preferences = normalizePreferences(event.preferences || {})
    const now = new Date()
    const doc = await findPreferenceDoc(roomId, openid)
    let savedDoc = null

    if (doc && doc._id) {
      await db.collection('room_user_preferences').doc(doc._id).update({
        data: {
          ...preferences,
          roomId,
          openid,
          updatedAt: now,
        },
      })
      savedDoc = {
        _id: doc._id,
        roomId,
        openid,
        ...preferences,
        createdAt: doc.createdAt || now,
        updatedAt: now,
      }
    } else {
      const res = await addCollectionDoc('room_user_preferences', {
        roomId,
        openid,
        ...preferences,
        createdAt: now,
        updatedAt: now,
      })
      savedDoc = {
        _id: res._id,
        roomId,
        openid,
        ...preferences,
        createdAt: now,
        updatedAt: now,
      }
    }

    return {
      success: true,
      roomId,
      openid,
      preferences: savedDoc,
    }
  } catch (e) {
    console.error('更新房间偏好失败:', e)
    return { success: false, message: e.message || '更新失败' }
  }
}
