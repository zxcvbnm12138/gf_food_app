<script>
import { getRole } from '@/store/index.js'
import { initCloud, checkLogin } from '@/services/cloud.js'

export default {
  onLaunch: function () {
    console.log('App Launch')

    // 初始化微信云开发
    // #ifdef MP-WEIXIN
    initCloud()
    // #endif

    // 检查登录态和角色
    const loginData = checkLogin()
    const role = getRole()

    if (loginData && loginData.openid && role) {
      // 已登录且有角色，跳转到对应端
      if (role === 'customer') {
        uni.switchTab({ url: '/pages/index/index' })
      } else if (role === 'chef') {
        uni.switchTab({ url: '/pages/chef/dashboard' })
      }
    }
    // 如果没有登录或没有角色，留在 login 页
  },
  onShow: function () {
    console.log('App Show')
  },
  onHide: function () {
    console.log('App Hide')
  },
}
</script>

<style>
/* 全局公共样式 */
page {
  background-color: #F7F8FA;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1D2129;
  font-size: 28rpx;
  --primary: #FF4D4F;
  --primary-light: #FF8C9A;
  --primary-bg: #FFF1F0;
  --accent: #4080FF;
  --accent-light: #6AA1FF;
  --accent-bg: #E8F3FF;
  --bg: #F7F8FA;
  --white: #FFFFFF;
  --text-primary: #1D2129;
  --text-secondary: #4E5969;
  --text-muted: #86909C;
  --border: #E5E6EB;
  --card-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  --bar-bg: #1D2129;
}

view, text, image, button {
  box-sizing: border-box;
}

/* 动画关键帧 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes bounceIn {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4rpx); }
  20%, 40%, 60%, 80% { transform: translateX(4rpx); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
