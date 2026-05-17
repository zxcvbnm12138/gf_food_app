// 云函数：获取当前 openid 的历史房间
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()

function normalizeRoomId(roomId) {
  return roomId ? String(roomId).trim().toUpperCase() : ''
}

function getRoomTimestamp(room) {
  const value = room && (room.updatedAt || room.createdAt)
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function mergeRooms(groups, openid) {
  const map = new Map()
  groups.flat().forEach(room => {
    const roomId = normalizeRoomId(room && room.roomId)
    if (!roomId) return
    const members = Array.isArray(room.members) ? room.members : []
    const canUseRoom = room.creatorOpenid === openid || members.includes(openid)
    if (!canUseRoom) return
    const existing = map.get(roomId)
    if (!existing || getRoomTimestamp(room) > getRoomTimestamp(existing)) {
      map.set(roomId, {
        _id: room._id,
        roomId,
        creatorOpenid: room.creatorOpenid || '',
        members,
        maxMembers: room.maxMembers || 2,
        menuVersion: room.menuVersion || 0,
        createdAt: room.createdAt || null,
        updatedAt: room.updatedAt || null,
        isCreator: room.creatorOpenid === openid,
      })
    }
  })
  return Array.from(map.values())
    .sort((a, b) => getRoomTimestamp(b) - getRoomTimestamp(a))
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || event.openid

  if (!openid) {
    return { success: false, message: '无法获取用户 openid', rooms: [] }
  }

  try {
    const createdTask = db.collection('rooms')
      .where({ creatorOpenid: openid })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    const joinedTask = db.collection('rooms')
      .where({ members: openid })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    const [createdRes, joinedRes] = await Promise.all([createdTask, joinedTask])
    const rooms = mergeRooms([createdRes.data || [], joinedRes.data || []], openid)
    return { success: true, rooms }
  } catch (e) {
    console.error('获取历史房间失败:', e)
    return { success: false, message: e.message || '获取历史房间失败', rooms: [] }
  }
}
