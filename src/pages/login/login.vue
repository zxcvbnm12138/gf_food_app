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

        <!-- 步骤指示器 -->
        <view class="steps-indicator anim-item" :style="{ animationDelay: '0.1s' }">
          <view v-for="(s, i) in stepLabels" :key="i" class="step-dot-wrap">
            <view class="step-dot" :class="{ active: step >= i, current: step === i }">
              <text class="step-dot-num">{{ i + 1 }}</text>
            </view>
            <text class="step-dot-label" :class="{ active: step >= i }">{{ s }}</text>
          </view>
          <view class="step-line">
            <view class="step-line-fill" :style="{ width: (step / 2 * 100) + '%' }"></view>
          </view>
        </view>

        <!-- Step 0: 微信登录 -->
        <view v-if="step === 0" class="step-section anim-item" :style="{ animationDelay: '0.15s' }">
          <text class="step-title">欢迎来到投喂小厨房 🏠</text>
          <text class="step-desc">首先，使用微信登录开始你的美食之旅</text>
          <view class="login-btn" :class="{ disabled: isLogging }" @click="handleLogin">
            <text v-if="!isLogging" class="login-btn-text">微信一键登录</text>
            <view v-else class="login-spinner-wrap">
              <view class="login-spinner"></view>
              <text class="login-btn-text">登录中...</text>
            </view>
          </view>
        </view>

        <!-- Step 1: 创建/加入房间 -->
        <view v-if="step === 1" class="step-section anim-item" :style="{ animationDelay: '0.05s' }">
          <text class="step-title">创建或加入房间 🔑</text>
          <text class="step-desc">每个房间都是你们的专属空间，菜单和订单独立隔离</text>

          <!-- 已有房间快速进入 -->
          <view v-if="existingRoomId" class="existing-room-card">
            <view class="existing-room-info">
              <text class="existing-room-label">上次的房间</text>
              <text class="existing-room-id">{{ existingRoomId }}</text>
            </view>
            <view class="existing-room-btn" @click="quickJoinExisting">
              <text class="existing-room-btn-text">快速进入 ›</text>
            </view>
          </view>

          <!-- 创建新房间 -->
          <view class="room-action-card" @click="handleCreateRoom">
            <view class="room-action-icon" style="background: linear-gradient(135deg, #FF4D4F 0%, #FF8C9A 100%)">
              <text class="room-action-emoji">✨</text>
            </view>
            <view class="room-action-info">
              <text class="room-action-title">创建新房间</text>
              <text class="room-action-desc">自动生成6位房间号，分享给你的TA</text>
            </view>
            <view class="room-action-arrow">
              <text v-if="!isCreating" class="room-action-arrow-text">›</text>
              <view v-else class="login-spinner"></view>
            </view>
          </view>

          <!-- 加入房间 -->
          <view class="room-action-card join-card">
            <view class="room-action-icon" style="background: linear-gradient(135deg, #4080FF 0%, #6AA1FF 100%)">
              <text class="room-action-emoji">🏠</text>
            </view>
            <view class="room-action-info">
              <text class="room-action-title">加入房间</text>
              <text class="room-action-desc">输入TA分享的6位房间号</text>
            </view>
          </view>
          <view class="join-input-row">
            <input
              class="join-input"
              v-model="joinCode"
              placeholder="输入6位房间号"
              maxlength="6"
              @input="onJoinInput"
            />
            <view class="join-btn" :class="{ disabled: joinCode.length < 6 || isJoining }" @click="handleJoinRoom">
              <text class="join-btn-text">{{ isJoining ? '加入中...' : '加入' }}</text>
            </view>
          </view>
        </view>

        <!-- 创建成功弹窗 -->
        <view v-if="showCreatedRoom" class="created-room-section anim-item">
          <view class="created-room-card">
            <text class="created-room-emoji">🎉</text>
            <text class="created-room-title">房间创建成功！</text>
            <text class="created-room-label">你的房间号</text>
            <view class="room-code-display">
              <text class="room-code-text">{{ createdRoomId }}</text>
            </view>
            <text class="created-room-hint">将此房间号分享给你的TA，即可共享菜单和订单</text>
            <view class="created-room-actions">
              <view class="copy-btn" @click="copyRoomCode">
                <text class="copy-btn-text">📋 复制房间号</text>
              </view>
              <view class="continue-btn" @click="proceedToRole">
                <text class="continue-btn-text">继续 ›</text>
              </view>
            </view>
          </view>
        </view>

        <!-- Step 2: 选择角色 -->
        <view v-if="step === 2" class="step-section anim-item" :style="{ animationDelay: '0.05s' }">
          <text class="step-title">选择你的身份</text>
          <view class="room-badge">
            <text class="room-badge-text">🏠 房间: {{ currentRoomId }}</text>
          </view>

          <!-- 客户端（点餐） -->
          <view
            class="role-card customer-card"
            :class="{ pressed: pressedRole === 'customer' }"
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
              <text class="role-arrow-text">›</text>
            </view>
          </view>

          <!-- 服务端（接单） -->
          <view
            class="role-card chef-card"
            :class="{ pressed: pressedRole === 'chef' }"
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
              <text class="role-arrow-text">›</text>
            </view>
          </view>
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
import { ref, onMounted } from 'vue'
import { setRole, setLoginState, setRoomId } from '@/store/index.js'
import {
  wxLogin, checkLogin,
  createRoom, joinRoom,
  getStoredRoomId,
} from '@/services/cloud.js'

const stepLabels = ['登录', '房间', '角色']
const step = ref(0)
const isLogging = ref(false)
const isCreating = ref(false)
const isJoining = ref(false)
const pressedRole = ref('')
const joinCode = ref('')
const showCreatedRoom = ref(false)
const createdRoomId = ref('')
const currentRoomId = ref('')
const existingRoomId = ref('')

onMounted(() => {
  // 检查是否已登录
  const loginData = checkLogin()
  if (loginData && loginData.openid) {
    setLoginState(loginData.openid)
    // 检查是否有已存储的房间号
    const storedRoom = getStoredRoomId()
    if (storedRoom) {
      existingRoomId.value = storedRoom
    }
    step.value = 1
  }
})

// Step 0: 微信登录
const handleLogin = async () => {
  if (isLogging.value) return
  isLogging.value = true
  try {
    const result = await wxLogin()
    if (result && result.openid) {
      setLoginState(result.openid)
      uni.showToast({ title: '登录成功 ✨', icon: 'none', duration: 1000 })
      const storedRoom = getStoredRoomId()
      if (storedRoom) {
        existingRoomId.value = storedRoom
      }
      setTimeout(() => { step.value = 1 }, 500)
    } else {
      uni.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  } catch (e) {
    console.error('登录异常:', e)
    uni.showToast({ title: '登录异常，请重试', icon: 'none' })
  } finally {
    isLogging.value = false
  }
}

// Step 1: 创建房间
const handleCreateRoom = async () => {
  if (isCreating.value) return
  isCreating.value = true
  try {
    const loginData = checkLogin()
    const openid = loginData?.openid || ''
    const result = await createRoom(openid)
    if (result && result.roomId) {
      createdRoomId.value = result.roomId
      currentRoomId.value = result.roomId
      setRoomId(result.roomId)
      showCreatedRoom.value = true
      step.value = -1 // 隐藏 step 1 内容
    } else {
      uni.showToast({ title: '创建失败，请重试', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '创建异常', icon: 'none' })
  } finally {
    isCreating.value = false
  }
}

// Step 1: 加入房间
const handleJoinRoom = async () => {
  if (isJoining.value || joinCode.value.length < 6) return
  isJoining.value = true
  try {
    const loginData = checkLogin()
    const openid = loginData?.openid || ''
    const result = await joinRoom(joinCode.value, openid)
    if (result.success) {
      currentRoomId.value = joinCode.value.toUpperCase()
      setRoomId(currentRoomId.value)
      uni.showToast({ title: '加入成功 🎉', icon: 'none', duration: 1000 })
      setTimeout(() => { step.value = 2 }, 500)
    } else {
      uni.showToast({ title: result.message, icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '加入失败', icon: 'none' })
  } finally {
    isJoining.value = false
  }
}

// 快速进入已有房间
const quickJoinExisting = async () => {
  const loginData = checkLogin()
  const openid = loginData?.openid || ''
  const result = await joinRoom(existingRoomId.value, openid)
  if (result.success) {
    currentRoomId.value = (result.roomInfo?.roomId || existingRoomId.value || '').trim().toUpperCase()
    setRoomId(currentRoomId.value)
    step.value = 2
  } else {
    uni.showToast({ title: result.message || '房间已失效', icon: 'none' })
    existingRoomId.value = ''
  }
}

const onJoinInput = (e) => {
  joinCode.value = (e.detail?.value || '').toUpperCase()
}

const copyRoomCode = () => {
  uni.setClipboardData({
    data: createdRoomId.value,
    success: () => {
      uni.showToast({ title: '已复制房间号 📋', icon: 'none' })
    },
  })
}

const proceedToRole = () => {
  showCreatedRoom.value = false
  step.value = 2
}

// Step 2: 选择角色
const selectRole = (role) => {
  setRole(role)
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
  background: linear-gradient(180deg, #FF6B6B 0%, #FFB4A2 180rpx, #FFDDD2 320rpx, #FFF5F0 480rpx, #F9F5F2 100%);
  overflow: hidden;
}
.status-bar { height: var(--status-bar-height, 44px); width: 100%; }
.scroll-wrapper { height: calc(100vh - var(--status-bar-height, 44px)); width: 100%; }
.wrapper {
  padding: 0 40rpx 80rpx;
  display: flex; flex-direction: column; align-items: center; gap: 40rpx;
}
.anim-item { animation: fadeInUp 0.5s ease both; }

/* Logo */
.logo-area { display: flex; flex-direction: column; align-items: center; gap: 20rpx; padding-top: 48rpx; }
.logo-ring { width: 160rpx; height: 160rpx; border-radius: 50%; background: rgba(255,255,255,0.3); border: 6rpx solid rgba(255,255,255,0.55); display: flex; align-items: center; justify-content: center; animation: bounceIn 0.8s ease; box-shadow: 0 16rpx 40rpx rgba(255,107,107,0.35); }
.logo-emoji { font-size: 80rpx; }
.logo-title { font-size: 48rpx; font-weight: bold; color: #FFFFFF; text-shadow: 0 4rpx 16rpx rgba(255,107,107,0.4); letter-spacing: 4rpx; }
.logo-subtitle { font-size: 26rpx; color: rgba(255,255,255,0.85); }

/* Steps indicator */
.steps-indicator { display: flex; align-items: flex-start; justify-content: space-between; width: 100%; padding: 0 20rpx; position: relative; margin-top: 16rpx; }
.step-dot-wrap { display: flex; flex-direction: column; align-items: center; gap: 8rpx; z-index: 1; }
.step-dot { width: 52rpx; height: 52rpx; border-radius: 50%; background: #E5E6EB; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
.step-dot.active { background: #FF6B6B; }
.step-dot.current { box-shadow: 0 0 0 8rpx rgba(255,107,107,0.2); }
.step-dot-num { font-size: 24rpx; color: #FFFFFF; font-weight: bold; }
.step-dot-label { font-size: 22rpx; color: #86909C; }
.step-dot-label.active { color: #FF6B6B; font-weight: bold; }
.step-line { position: absolute; top: 26rpx; left: 66rpx; right: 66rpx; height: 4rpx; background: #E5E6EB; z-index: 0; }
.step-line-fill { height: 100%; background: #FF6B6B; transition: width 0.5s ease; border-radius: 2rpx; }

/* Step sections */
.step-section { width: 100%; display: flex; flex-direction: column; gap: 28rpx; }
.step-title { font-size: 36rpx; font-weight: bold; color: #1D2129; text-align: center; }
.step-desc { font-size: 26rpx; color: #86909C; text-align: center; line-height: 1.6; }

/* Login button */
.login-btn { width: 100%; height: 100rpx; border-radius: 50rpx; background: linear-gradient(135deg, #FF6B6B 0%, #FFB4A2 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 16rpx 40rpx rgba(255,107,107,0.3); transition: all 0.3s ease; margin-top: 16rpx; }
.login-btn:active { transform: scale(0.97); }
.login-btn.disabled { opacity: 0.7; }
.login-btn-text { font-size: 32rpx; font-weight: bold; color: #FFFFFF; }
.login-spinner-wrap { display: flex; align-items: center; gap: 16rpx; }
.login-spinner { width: 32rpx; height: 32rpx; border: 4rpx solid rgba(255,255,255,0.3); border-top-color: #FFFFFF; border-radius: 50%; animation: spin 0.8s linear infinite; }

/* Existing room card */
.existing-room-card { display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #FFF7E6 0%, #FFF1F0 100%); border-radius: 28rpx; padding: 28rpx 32rpx; border: 2rpx solid rgba(255,77,79,0.15); }
.existing-room-info { display: flex; flex-direction: column; gap: 8rpx; }
.existing-room-label { font-size: 22rpx; color: #86909C; }
.existing-room-id { font-size: 36rpx; font-weight: bold; color: #FF4D4F; letter-spacing: 8rpx; font-family: 'Courier New', monospace; }
.existing-room-btn { padding: 16rpx 32rpx; border-radius: 28rpx; background: #FF4D4F; }
.existing-room-btn:active { transform: scale(0.95); }
.existing-room-btn-text { font-size: 26rpx; font-weight: bold; color: #FFFFFF; }

/* Room action cards */
.room-action-card { display: flex; align-items: center; gap: 24rpx; background: #FFFFFF; border-radius: 28rpx; padding: 32rpx; box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.06); transition: all 0.3s ease; }
.room-action-card:active { transform: scale(0.97); }
.room-action-icon { width: 88rpx; height: 88rpx; border-radius: 24rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.room-action-emoji { font-size: 40rpx; }
.room-action-info { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.room-action-title { font-size: 30rpx; font-weight: bold; color: #1D2129; }
.room-action-desc { font-size: 22rpx; color: #86909C; }
.room-action-arrow { width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.room-action-arrow-text { font-size: 36rpx; color: #C9CDD4; font-weight: bold; }

/* Join input */
.join-input-row { display: flex; gap: 16rpx; align-items: center; }
.join-input { flex: 1; height: 88rpx; background: #F2F3F5; border-radius: 24rpx; padding: 0 28rpx; font-size: 32rpx; font-weight: bold; letter-spacing: 12rpx; text-align: center; color: #1D2129; font-family: 'Courier New', monospace; }
.join-btn { width: 160rpx; height: 88rpx; border-radius: 24rpx; background: #4080FF; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
.join-btn:active { transform: scale(0.95); }
.join-btn.disabled { opacity: 0.5; }
.join-btn-text { font-size: 28rpx; font-weight: bold; color: #FFFFFF; }

/* Created room success */
.created-room-section { width: 100%; }
.created-room-card { background: #FFFFFF; border-radius: 32rpx; padding: 48rpx 36rpx; display: flex; flex-direction: column; align-items: center; gap: 20rpx; box-shadow: 0 16rpx 48rpx rgba(0,0,0,0.08); }
.created-room-emoji { font-size: 80rpx; }
.created-room-title { font-size: 36rpx; font-weight: bold; color: #1D2129; }
.created-room-label { font-size: 24rpx; color: #86909C; }
.room-code-display { background: linear-gradient(135deg, #FFF1F0, #FFF7E6); border-radius: 24rpx; padding: 24rpx 48rpx; border: 3rpx dashed #FF4D4F; }
.room-code-text { font-size: 56rpx; font-weight: bold; color: #FF4D4F; letter-spacing: 16rpx; font-family: 'Courier New', monospace; }
.created-room-hint { font-size: 24rpx; color: #86909C; text-align: center; line-height: 1.6; }
.created-room-actions { display: flex; gap: 20rpx; width: 100%; margin-top: 12rpx; }
.copy-btn { flex: 1; height: 84rpx; border-radius: 42rpx; background: #F7F8FA; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }
.copy-btn:active { transform: scale(0.95); }
.copy-btn-text { font-size: 26rpx; font-weight: bold; color: #4E5969; }
.continue-btn { flex: 1; height: 84rpx; border-radius: 42rpx; background: #FF4D4F; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }
.continue-btn:active { transform: scale(0.95); }
.continue-btn-text { font-size: 28rpx; font-weight: bold; color: #FFFFFF; }

/* Room badge */
.room-badge { align-self: center; padding: 12rpx 28rpx; background: #FFF1F0; border-radius: 24rpx; border: 2rpx solid rgba(255,77,79,0.15); }
.room-badge-text { font-size: 24rpx; font-weight: bold; color: #FF4D4F; letter-spacing: 4rpx; }

/* Role cards */
.role-card { display: flex; align-items: center; gap: 28rpx; background: #FFFFFF; border-radius: 32rpx; padding: 36rpx 32rpx; box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.06); transition: all 0.3s cubic-bezier(0.4,0,0.2,1); position: relative; overflow: hidden; }
.role-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 32rpx; border: 3rpx solid transparent; transition: border-color 0.3s ease; }
.role-card.pressed { transform: scale(0.97); box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.08); }
.customer-card.pressed::before { border-color: #FF4D4F; }
.chef-card.pressed::before { border-color: #4080FF; }
.role-card-bg { width: 108rpx; height: 108rpx; border-radius: 28rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.customer-bg { background: linear-gradient(135deg, #FFF1F0 0%, #FFD6D9 100%); }
.chef-bg { background: linear-gradient(135deg, #E8F3FF 0%, #BEDAFF 100%); }
.role-icon-ring { width: 80rpx; height: 80rpx; border-radius: 50%; background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; }
.role-emoji { font-size: 44rpx; }
.role-card-info { flex: 1; display: flex; flex-direction: column; gap: 10rpx; }
.role-name { font-size: 34rpx; font-weight: bold; color: #1D2129; }
.role-desc { font-size: 24rpx; color: #86909C; line-height: 1.5; }
.role-tag { align-self: flex-start; padding: 6rpx 20rpx; border-radius: 20rpx; margin-top: 4rpx; }
.customer-tag { background: #FFF1F0; }
.chef-tag { background: #E8F3FF; }
.role-tag-text { font-size: 20rpx; font-weight: bold; color: #4E5969; }
.role-arrow { width: 56rpx; height: 56rpx; border-radius: 28rpx; background: #F7F8FA; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.role-arrow-text { font-size: 36rpx; color: #86909C; font-weight: bold; }

/* Footer */
.footer { padding-top: 20rpx; }
.footer-text { font-size: 24rpx; color: #C9CDD4; text-align: center; }
</style>
