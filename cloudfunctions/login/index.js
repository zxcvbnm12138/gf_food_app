// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { success: false, message: '无法获取 openid' }
  }

  try {
    let user = null

    const byOpenid = await db.collection('users')
      .where({ openid })
      .limit(1)
      .get()
    if (byOpenid.data && byOpenid.data.length > 0) {
      user = byOpenid.data[0]
    }

    if (!user) {
      const bySystemOpenid = await db.collection('users')
        .where({ _openid: openid })
        .limit(1)
        .get()
      if (bySystemOpenid.data && bySystemOpenid.data.length > 0) {
        user = bySystemOpenid.data[0]
      }
    }

    if (user) {
      await db.collection('users').doc(user._id).update({
        data: {
          openid,
          platform: 'mp-weixin',
          appid: wxContext.APPID || '',
          unionid: wxContext.UNIONID || '',
          loginTime: _.remove(),
          timestamp: _.remove(),
        },
      })

      return {
        success: true,
        openid,
        appid: wxContext.APPID,
        unionid: wxContext.UNIONID || '',
        userId: user._id,
        isNewUser: false,
      }
    }

    const addRes = await db.collection('users').add({
      data: {
        openid,
        platform: 'mp-weixin',
        appid: wxContext.APPID || '',
        unionid: wxContext.UNIONID || '',
      },
    })

    return {
      success: true,
      openid,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID || '',
      userId: addRes._id,
      isNewUser: true,
    }
  } catch (e) {
    console.error('登录失败:', e)
    return { success: false, message: e.message || '登录失败' }
  }
}
