// 云函数：按房间获取菜品，避免客户端集合权限影响点餐端读取
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const rawRoomId = event.roomId ? String(event.roomId).trim() : ''
  const roomId = rawRoomId.toUpperCase()

  if (!roomId) {
    return { success: false, message: '缺少 roomId', items: [] }
  }

  try {
    const roomIds = Array.from(new Set([rawRoomId, roomId].filter(Boolean)))
    const query = roomIds.length > 1 ? { roomId: _.in(roomIds) } : { roomId }
    const countRes = await db.collection('menu_items').where(query).count()
    const total = countRes.total
    if (total === 0) {
      return { success: true, items: [] }
    }

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
    const items = results
      .reduce((all, result) => all.concat(result.data || []), [])
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))

    return { success: true, items }
  } catch (e) {
    console.error('获取菜品失败:', e)
    return { success: false, message: e.message || '获取失败', items: [] }
  }
}
