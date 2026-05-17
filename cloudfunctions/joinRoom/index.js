// 云函数：加入房间（确保 rooms.members 写入加入者 openid）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()

function normalizeRoomId(roomId) {
  return roomId ? String(roomId).trim().toUpperCase() : ''
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const roomId = normalizeRoomId(event.roomId)
  const openid = wxContext.OPENID || event.openid

  if (!roomId || roomId.length !== 6) {
    return { success: false, message: '请输入正确的6位房间号' }
  }
  if (!openid) {
    return { success: false, message: '无法获取用户 openid' }
  }

  try {
    const roomRes = await db.collection('rooms').where({ roomId }).limit(1).get()
    if (!roomRes.data || roomRes.data.length === 0) {
      return { success: false, message: '房间不存在，请检查房间号' }
    }

    const room = roomRes.data[0]
    const members = Array.isArray(room.members) ? room.members : []
    const existingMembers = Array.from(new Set([room.creatorOpenid, ...members].filter(Boolean)))

    if (existingMembers.includes(openid)) {
      const roomInfo = { ...room, members: existingMembers }
      if (existingMembers.length !== members.length) {
        await db.collection('rooms').doc(room._id).update({
          data: {
            members: existingMembers,
            updatedAt: new Date(),
          },
        })
      }
      return { success: true, message: '已在房间中', roomInfo }
    }

    if (existingMembers.length >= (room.maxMembers || 2)) {
      return { success: false, message: '房间已满，无法加入' }
    }

    const nextMembers = Array.from(new Set([...existingMembers, openid]))
    await db.collection('rooms').doc(room._id).update({
      data: {
        members: nextMembers,
        updatedAt: new Date(),
      },
    })

    return {
      success: true,
      message: '加入成功',
      roomInfo: {
        ...room,
        members: nextMembers,
      },
    }
  } catch (e) {
    console.error('加入房间失败:', e)
    return { success: false, message: e.message || '加入失败，请重试' }
  }
}
