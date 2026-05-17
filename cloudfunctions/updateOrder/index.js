// 云函数：更新订单状态（服务端校验房间成员后更新订单）
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

function normalizeTimestamp(value) {
  if (value === null) return null
  const text = String(value || '').trim()
  if (!text) return ''
  const time = new Date(text).getTime()
  return Number.isNaN(time) ? '' : text.slice(0, 40)
}

function sanitizeOrderUpdateFields(fields) {
  if (!fields || typeof fields !== 'object') return {}
  const data = {}
  const allowedStatuses = new Set(['pending', 'accepted', 'cooking', 'done'])

  if ('status' in fields && allowedStatuses.has(fields.status)) {
    data.status = fields.status
  }
  ;['acceptedAt', 'cookingAt', 'completedAt', 'rushLastTime'].forEach(key => {
    if (!(key in fields)) return
    const value = normalizeTimestamp(fields[key])
    if (value !== '') data[key] = value
  })

  return data
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { action = 'update', cloudId, updateFields, incrementRushCount } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (action === 'deleteByRoom') {
    const roomId = normalizeRoomId(event.roomId)
    if (!roomId) {
      return { success: false, message: '缺少 roomId' }
    }

    try {
      const auth = await authorizeRoomMember(roomId, openid)
      if (!auth.success) return auth

      let removed = 0
      while (true) {
        const res = await db.collection('orders')
          .where(getRoomIdQuery(event.roomId))
          .limit(100)
          .get()

        const docs = Array.isArray(res.data) ? res.data : []
        if (docs.length === 0) break

        await Promise.all(docs.map((doc) => db.collection('orders').doc(doc._id).remove()))
        removed += docs.length

        if (docs.length < 100) break
      }

      return { success: true, removed }
    } catch (e) {
      console.error('清空房间订单失败:', e)
      return { success: false, message: e.message || '清空失败' }
    }
  }

  if (!cloudId || !updateFields) {
    return { success: false, message: '缺少参数' }
  }

  try {
    const current = await db.collection('orders').doc(cloudId).get()
    const order = current.data || {}
    const roomId = normalizeRoomId(order.roomId || event.roomId)
    if (!roomId) {
      return { success: false, message: '订单缺少房间归属' }
    }

    const auth = await authorizeRoomMember(roomId, openid)
    if (!auth.success) return auth

    const safeUpdateFields = sanitizeOrderUpdateFields(updateFields)
    if (Object.keys(safeUpdateFields).length === 0 && !incrementRushCount) {
      return { success: false, message: '没有可更新字段' }
    }

    const data = {
      ...safeUpdateFields,
      updatedAt: new Date(),
    }

    // 催单时需要 rushCount 自增
    if (incrementRushCount) {
      data.rushCount = _.inc(1)
    }

    const res = await db.collection('orders').doc(cloudId).update({
      data,
    })
    return { success: true, updated: res.stats.updated }
  } catch (e) {
    console.error('更新订单失败:', e)
    return { success: false, message: e.message || '更新失败' }
  }
}
