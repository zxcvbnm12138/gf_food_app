// 云函数：管理菜品（绕过客户端安全规则，允许主厨更新房间菜单）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()

function normalizeRoomId(roomId) {
  return roomId ? String(roomId).trim().toUpperCase() : ''
}

async function touchRoomMenu(roomId) {
  roomId = normalizeRoomId(roomId)
  if (!roomId) return

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
}

exports.main = async (event, context) => {
  const { action = 'update', cloudId, updateFields } = event
  const roomId = normalizeRoomId(event.roomId)

  if (action === 'add') {
    if (!roomId || !updateFields) {
      return { success: false, message: '缺少参数' }
    }

    try {
      const now = new Date()
      const res = await db.collection('menu_items').add({
        data: {
          ...updateFields,
          roomId,
          available: updateFields.available !== false,
          createdAt: now,
          updatedAt: now,
        },
      })

      await touchRoomMenu(roomId)
      return { success: true, _id: res._id }
    } catch (e) {
      console.error('新增菜品失败:', e)
      return { success: false, message: e.message || '新增失败' }
    }
  }

  if (!cloudId) {
    return { success: false, message: '缺少参数' }
  }

  try {
    if (action === 'delete') {
      let targetRoomId = roomId
      if (!targetRoomId) {
        const current = await db.collection('menu_items').doc(cloudId).get()
        targetRoomId = current.data && current.data.roomId
      }
      const res = await db.collection('menu_items').doc(cloudId).remove()
      await touchRoomMenu(targetRoomId)
      return { success: true, removed: res.stats.removed }
    }

    if (!updateFields) {
      return { success: false, message: '缺少参数' }
    }

    if (roomId) {
      const current = await db.collection('menu_items').doc(cloudId).get()
      const currentRoomId = normalizeRoomId(current.data && current.data.roomId)
      if (currentRoomId && currentRoomId !== roomId) {
        return { success: false, message: '菜品不属于当前房间' }
      }
    }

    const nextFields = {
      ...updateFields,
      updatedAt: new Date(),
    }
    if (roomId) {
      nextFields.roomId = roomId
    }

    const res = await db.collection('menu_items').doc(cloudId).update({
      data: nextFields,
    })

    await touchRoomMenu(roomId)
    return { success: true, updated: res.stats.updated }
  } catch (e) {
    console.error('管理菜品失败:', e)
    return { success: false, message: e.message || '操作失败' }
  }
}
