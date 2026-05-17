// 云函数：更新订单状态（绕过安全规则，允许主厨更新客户创建的订单）
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

// 云函数入口函数
exports.main = async (event, context) => {
  const { action = 'update', cloudId, updateFields, incrementRushCount } = event

  if (action === 'deleteByRoom') {
    const roomId = normalizeRoomId(event.roomId)
    if (!roomId) {
      return { success: false, message: '缺少 roomId' }
    }

    try {
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
    const data = {
      ...updateFields,
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
