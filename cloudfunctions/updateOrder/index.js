// 云函数：更新订单状态（绕过安全规则，允许主厨更新客户创建的订单）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const { cloudId, updateFields, incrementRushCount } = event

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
