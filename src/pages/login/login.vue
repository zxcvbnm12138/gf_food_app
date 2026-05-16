<template>
  <view class="page">
    <view class="status-bar"></view>

    <scroll-view class="scroll-wrapper" scroll-y :enhanced="true" :show-scrollbar="false">
      <view class="wrapper">
        <!-- Logo 区域 -->
        <view class="logo-area anim-item" :style="{ animationDelay: '0.05s' }">
          <view class="logo-ring">
            <text class="logo-emoji">🍳</text>
          </view>
          <text class="logo-title">投喂小厨房</text>
          <text class="logo-subtitle">专属于你们的美食小世界 ❤️</text>
        </view>

        <!-- 角色选择 -->
        <view class="role-section anim-item" :style="{ animationDelay: '0.15s' }">
          <text class="section-title">选择你的身份</text>

          <!-- 客户端（点餐） -->
          <view
            class="role-card customer-card"
            :class="{ pressed: pressedRole === 'customer', disabled: isLogging }"
            @click="selectRole('customer')"
            @touchstart="pressedRole = 'customer'"
            @touchend="pressedRole = ''"
            @touchcancel="pressedRole = ''"
          >
            <view class="role-card-bg customer-bg">
              <view class="role-icon-ring">
                <text class="role-emoji">🍽️</text>
              </view>
            </view>
            <view class="role-card-info">
              <text class="role-name">我要点餐</text>
              <text class="role-desc">浏览美食菜单，随机抽菜，下单投喂</text>
              <view class="role-tag customer-tag">
                <text class="role-tag-text">👑 宝贝专属</text>
              </view>
            </view>
            <view class="role-arrow">
              <text v-if="loggingRole !== 'customer'" class="role-arrow-text">›</text>
              <view v-else class="login-spinner"></view>
            </view>
          </view>

          <!-- 服务端（接单） -->
          <view
            class="role-card chef-card"
            :class="{ pressed: pressedRole === 'chef', disabled: isLogging }"
            @click="selectRole('chef')"
            @touchstart="pressedRole = 'chef'"
            @touchend="pressedRole = ''"
            @touchcancel="pressedRole = ''"
          >
            <view class="role-card-bg chef-bg">
              <view class="role-icon-ring">
                <text class="role-emoji">👨‍🍳</text>
              </view>
            </view>
            <view class="role-card-info">
              <text class="role-name">我要接单</text>
              <text class="role-desc">管理订单，制作美食，宠爱她每一天</text>
              <view class="role-tag chef-tag">
                <text class="role-tag-text">🔥 专属大厨</text>
              </view>
            </view>
            <view class="role-arrow">
              <text v-if="loggingRole !== 'chef'" class="role-arrow-text">›</text>
              <view v-else class="login-spinner"></view>
            </view>
          </view>
        </view>

        <!-- 登录提示 -->
        <view v-if="isLogging" class="login-hint anim-item">
          <text class="login-hint-text">🔐 正在微信登录中...</text>
        </view>

        <!-- 底部标语 -->
        <view class="footer anim-item" :style="{ animationDelay: '0.3s' }">
          <text class="footer-text">用心做的每一道菜，都是爱你的方式 💕</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { setRole, setLoginState } from '@/store/index.js'
import { wxLogin, checkLogin } from '@/services/cloud.js'

const pressedRole = ref('')
const isLogging = ref(false)
const loggingRole = ref('')

const selectRole = async (role) => {
  if (isLogging.value) return

  // 检查是否已登录
  const existingLogin = checkLogin()
  if (existingLogin && existingLogin.openid) {
    // 已登录，直接选择角色并跳转
    setLoginState(existingLogin.openid)
    setRole(role)
    navigateToRole(role)
    return
  }

  // 未登录，先进行微信登录
  isLogging.value = true
  loggingRole.value = role

  try {
    const loginResult = await wxLogin()
    if (loginResult && loginResult.openid) {
      setLoginState(loginResult.openid)
      setRole(role)

      uni.showToast({
        title: '登录成功 ✨',
        icon: 'none',
        duration: 1000,
      })

      setTimeout(() => {
        navigateToRole(role)
      }, 500)
    } else {
      uni.showToast({
        title: '登录失败，请重试',
        icon: 'none',
      })
    }
  } catch (e) {
    console.error('登录异常:', e)
    uni.showToast({
      title: '登录异常，请重试',
      icon: 'none',
    })
  } finally {
    isLogging.value = false
    loggingRole.value = ''
  }
}

const navigateToRole = (role) => {
  if (role === 'customer') {
    uni.switchTab({ url: '/pages/index/index' })
  } else {
    uni.switchTab({ url: '/pages/chef/dashboard' })
  }
}
</script>

<style scoped>
.page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(180deg, #FF4D4F 0%, #FF8C9A 280rpx, #F7F8FA 280rpx, #F7F8FA 100%);
  overflow: hidden;
}

.status-bar {
  height: var(--status-bar-height, 44px);
  width: 100%;
}

.scroll-wrapper {
  height: calc(100vh - var(--status-bar-height, 44px));
  width: 100%;
}

.wrapper {
  padding: 0 40rpx 80rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 56rpx;
}

.anim-item {
  animation: fadeInUp 0.5s ease both;
}

/* Logo 区域 */
.logo-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  padding-top: 48rpx;
}

.logo-ring {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  border: 6rpx solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: bounceIn 0.8s ease;
  box-shadow: 0 16rpx 40rpx rgba(255, 77, 79, 0.3);
}

.logo-emoji {
  font-size: 80rpx;
}

.logo-title {
  font-size: 48rpx;
  font-weight: bold;
  color: #FFFFFF;
  text-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.logo-subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
}

/* 角色选择区域 */
.role-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 28rpx;
  margin-top: 24rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #1D2129;
  text-align: center;
}

.role-card {
  display: flex;
  align-items: center;
  gap: 28rpx;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 36rpx 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.role-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 32rpx;
  border: 3rpx solid transparent;
  transition: border-color 0.3s ease;
}

.role-card.pressed {
  transform: scale(0.97);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
}

.role-card.disabled {
  opacity: 0.7;
  pointer-events: none;
}

.customer-card.pressed::before {
  border-color: #FF4D4F;
}

.chef-card.pressed::before {
  border-color: #4080FF;
}

.role-card-bg {
  width: 108rpx;
  height: 108rpx;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.customer-bg {
  background: linear-gradient(135deg, #FFF1F0 0%, #FFD6D9 100%);
}

.chef-bg {
  background: linear-gradient(135deg, #E8F3FF 0%, #BEDAFF 100%);
}

.role-icon-ring {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.role-emoji {
  font-size: 44rpx;
}

.role-card-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.role-name {
  font-size: 34rpx;
  font-weight: bold;
  color: #1D2129;
}

.role-desc {
  font-size: 24rpx;
  color: #86909C;
  line-height: 1.5;
}

.role-tag {
  align-self: flex-start;
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
  margin-top: 4rpx;
}

.customer-tag {
  background: #FFF1F0;
}

.chef-tag {
  background: #E8F3FF;
}

.role-tag-text {
  font-size: 20rpx;
  font-weight: bold;
  color: #4E5969;
}

.role-arrow {
  width: 56rpx;
  height: 56rpx;
  border-radius: 28rpx;
  background: #F7F8FA;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.role-arrow-text {
  font-size: 36rpx;
  color: #86909C;
  font-weight: bold;
}

/* 登录中旋转 spinner */
.login-spinner {
  width: 32rpx;
  height: 32rpx;
  border: 4rpx solid #E5E6EB;
  border-top-color: #4080FF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* 登录提示 */
.login-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx 32rpx;
  background: rgba(64, 128, 255, 0.1);
  border-radius: 20rpx;
}

.login-hint-text {
  font-size: 24rpx;
  color: #4080FF;
  font-weight: bold;
}

/* 底部 */
.footer {
  padding-top: 20rpx;
}

.footer-text {
  font-size: 24rpx;
  color: #C9CDD4;
  text-align: center;
}
</style>
