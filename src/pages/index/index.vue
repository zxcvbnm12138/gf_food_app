<template>
  <view class="page">
    <!-- 顶部状态栏占位 -->
    <view class="status-bar"></view>

    <!-- 可滚动内容区 -->
    <scroll-view class="scroll-wrapper" scroll-y :enhanced="true" :show-scrollbar="false">
      <view class="wrapper">
        <!-- 顶部问候 + 头像 -->
        <view class="header anim-item" :style="{ animationDelay: '0.05s' }">
          <view class="hd-left">
            <text class="greeting-sub">{{ greetingText }} {{ greetingEmoji }}</text>
            <text class="greeting-main">今天想吃点什么？</text>
            <view v-if="roomId" class="room-badge-home">
              <text class="room-badge-home-text">🏠 {{ roomId }}</text>
            </view>
          </view>
          <view class="avatar-wrap" @click="goProfile">
            <view class="avatar">
              <image v-if="user.avatarUrl" class="avatar-image" :src="user.avatarUrl" mode="aspectFill" />
              <text v-else class="avatar-emoji">🧸</text>
            </view>
          </view>
        </view>

        <!-- 搜索栏 -->
        <view class="search-bar anim-item" :style="{ animationDelay: '0.1s' }" @click="goMenu">
          <text class="search-icon">🔍</text>
          <text class="search-placeholder">搜索你想吃的美食...</text>
        </view>

        <!-- 纠结星人专属随机抽取 -->
        <view
          class="picker-card anim-item"
          :style="{ animationDelay: '0.15s' }"
          :class="{ 'picker-shaking': isShaking }"
        >
          <view class="picker-left">
            <text class="picker-title">🎲 纠结星人专属</text>
            <text class="picker-desc">不知道吃啥？帮你随机抽一个！</text>
          </view>
          <view class="picker-btn" @click="handleRandomPick">
            <text class="picker-btn-text" :class="{ spinning: isSpinning }">GO!</text>
          </view>
        </view>

        <!-- 分类 -->
        <view class="section anim-item" :style="{ animationDelay: '0.2s' }">
          <view class="section-header">
            <text class="section-title">分类</text>
            <text class="section-link" @click="goMenu">查看全部 ›</text>
          </view>
          <view class="cat-row">
            <view
              v-for="(cat, i) in categories"
              :key="cat.id"
              class="cat-item"
              @click="goMenuCategory(cat.id)"
            >
              <view class="cat-icon-bg" :style="{ background: cat.color }">
                <text class="cat-emoji">{{ cat.emoji }}</text>
              </view>
              <text class="cat-name">{{ cat.name }}</text>
            </view>
          </view>
        </view>

        <!-- 今日主厨推荐 -->
        <view class="section anim-item" :style="{ animationDelay: '0.25s' }">
          <view class="section-header">
            <text class="section-title">今日主厨推荐</text>
            <text class="section-link" @click="refreshRecommend">换一批</text>
          </view>
          <view class="rec-row">
            <view
              v-for="item in recommendItems"
              :key="item._id || item.id"
              class="rec-card"
              @click="goDetail(item._id || item.id)"
            >
              <view class="rec-card-img">
                <image class="rec-card-photo" :src="item.image" mode="aspectFill" />
              </view>
              <view class="rec-card-info">
                <text class="rec-card-name">{{ item.name }}</text>
                <text class="rec-card-price">❤️ {{ item.price }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 底部安全间距 -->
        <view class="bottom-spacer"></view>
      </view>
    </scroll-view>

    <!-- 随机抽取结果弹窗 -->
    <view class="modal-overlay" v-if="showPickResult" @click="showPickResult = false">
      <view class="modal-card" @click.stop>
        <text class="modal-emoji">🎉</text>
        <text class="modal-title">恭喜抽中！</text>
        <text class="modal-item-name">{{ pickedItem.name }}</text>
        <text class="modal-item-desc">{{ getDisplayDesc(pickedItem) }}</text>
        <view class="modal-actions">
          <view class="modal-btn secondary" @click="handleRandomPick">
            <text class="modal-btn-text secondary">再扭一次</text>
          </view>
          <view class="modal-btn primary" @click="goPickedDetail">
            <text class="modal-btn-text primary">去看看</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 自定义TabBar -->
    <TabBar :current="0" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import store, {
  loadMenuFromCloud,
  getAvailableItems,
  startMenuRealtimeSync,
  stopMenuRealtimeSync,
  setPendingMenuCategory,
} from '@/store/index.js'
import { checkLogin } from '@/services/cloud.js'
import TabBar from '@/components/TabBar.vue'

const categories = computed(() => store.categories)
const menuItems = computed(() => getAvailableItems())
const user = computed(() => store.user)
const roomId = computed(() => store.roomId)
const MENU_REALTIME_OWNER = 'customer-index'
const getDisplayDesc = (item) => item.fullDesc || item.desc || ''

// 菜品轮询刷新
let menuPollTimer = null
const MENU_POLL_INTERVAL = 5000 // 实时监听失败时，5秒轮询兜底

const refreshMenu = async () => {
  await loadMenuFromCloud()
}

// 页面显示时加载云端菜品 + 启动轮询
onShow(() => {
  // 登录态检查
  const loginData = checkLogin()
  if (!loginData || !loginData.openid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  // 房间检查
  if (!store.roomId) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  // 每次页面可见时刷新菜品
  refreshMenu()
  startMenuRealtimeSync(MENU_REALTIME_OWNER)
  if (!menuPollTimer) {
    menuPollTimer = setInterval(refreshMenu, MENU_POLL_INTERVAL)
  }
})

// 页面隐藏时停止轮询
onHide(() => {
  stopMenuRealtimeSync(MENU_REALTIME_OWNER)
  if (menuPollTimer) {
    clearInterval(menuPollTimer)
    menuPollTimer = null
  }
})

const greetingText = computed(() => {
  const hour = new Date().getHours()
  if (hour < 11) return '早上好宝贝'
  if (hour < 14) return '中午好宝贝'
  if (hour < 18) return '下午好宝贝'
  return '晚上好宝贝'
})

const greetingEmoji = computed(() => {
  const hour = new Date().getHours()
  if (hour < 11) return '☀️'
  if (hour < 14) return '🌞'
  if (hour < 18) return '🌤️'
  return '🌙'
})

// 推荐菜品（只从可用菜品中推荐）
const recommendIndices = ref([0, 1])
const recommendItems = computed(() => {
  const items = menuItems.value
  if (items.length === 0) return []
  return recommendIndices.value
    .filter(i => i < items.length)
    .map(i => items[i])
})

const refreshRecommend = () => {
  const len = menuItems.value.length
  if (len === 0) return
  const shuffled = Array.from({ length: len }, (_, i) => i).sort(() => Math.random() - 0.5)
  recommendIndices.value = shuffled.slice(0, Math.min(2, len))
}

// 随机抽取
const isShaking = ref(false)
const isSpinning = ref(false)
const showPickResult = ref(false)
const pickedItem = ref({})

const handleRandomPick = () => {
  const items = menuItems.value
  if (items.length === 0) {
    uni.showToast({ title: '暂无菜品', icon: 'none' })
    return
  }
  showPickResult.value = false
  isShaking.value = true
  isSpinning.value = true

  setTimeout(() => {
    isShaking.value = false
    isSpinning.value = false
    const idx = Math.floor(Math.random() * items.length)
    pickedItem.value = items[idx]
    showPickResult.value = true
  }, 1200)
}

const goPickedDetail = () => {
  showPickResult.value = false
  const id = pickedItem.value._id || pickedItem.value.id
  uni.navigateTo({
    url: `/pages/detail/detail?id=${id}`,
  })
}

// 导航
const goMenu = () => {
  setPendingMenuCategory('all')
  uni.switchTab({ url: '/pages/menu/menu' })
}
const goProfile = () => uni.switchTab({ url: '/pages/profile/profile' })

const goMenuCategory = (catId) => {
  setPendingMenuCategory(catId)
  uni.switchTab({ url: '/pages/menu/menu' })
}

const goDetail = (id) => {
  uni.navigateTo({
    url: `/pages/detail/detail?id=${id}`,
  })
}
</script>

<style scoped>
.page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #F7F8FA;
  overflow: hidden;
}

.status-bar {
  height: var(--status-bar-height, 44px);
  width: 100%;
  background: #F7F8FA;
}

.scroll-wrapper {
  height: calc(100vh - var(--status-bar-height, 44px));
  width: 100%;
}

.wrapper {
  padding: 32rpx 40rpx 48rpx;
  display: flex;
  flex-direction: column;
  gap: 48rpx;
}

/* 动画入场 */
.anim-item {
  animation: fadeInUp 0.5s ease both;
}

/* 头部 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hd-left {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.greeting-sub {
  font-size: 28rpx;
  color: #86909C;
}

.greeting-main {
  font-size: 44rpx;
  font-weight: bold;
  color: #1D2129;
}

.avatar-wrap {
  position: relative;
  margin-right: 200rpx;
  flex-shrink: 0;
}

.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: #FFF3A1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  border: 4rpx solid #fff;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.08);
  transition: transform 0.3s ease;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
}

.avatar-emoji {
  font-size: 44rpx;
}

.avatar:active {
  transform: scale(0.92);
}

/* 搜索 */
.search-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: #FFFFFF;
  border-radius: 40rpx;
  height: 80rpx;
  padding: 0 32rpx;
  border: 2rpx solid #E5E6EB;
  transition: all 0.3s ease;
}

.search-bar:active {
  transform: scale(0.98);
  border-color: #FF4D4F;
}

.search-icon {
  font-size: 32rpx;
}

.search-placeholder {
  font-size: 28rpx;
  color: #86909C;
}

/* 随机抽取卡片 */
.picker-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 40rpx;
  border-radius: 32rpx;
  background: linear-gradient(135deg, #FF4D4F 0%, #FF8C9A 100%);
  box-shadow: 0 16rpx 40rpx rgba(255, 77, 79, 0.25);
  gap: 32rpx;
  transition: transform 0.3s ease;
}

.picker-card:active {
  transform: scale(0.98);
}

.picker-shaking {
  animation: shake 0.6s ease-in-out 2;
}

.picker-left {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  flex: 1;
}

.picker-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #FFFFFF;
}

.picker-desc {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.picker-btn {
  width: 128rpx;
  height: 64rpx;
  background: #FFFFFF;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.picker-btn:active {
  transform: scale(0.9);
}

.picker-btn-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #FF4D4F;
}

.picker-btn-text.spinning {
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

/* 分类区域 */
.section {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #1D2129;
}

.section-link {
  font-size: 24rpx;
  color: #86909C;
}

.cat-row {
  display: flex;
  justify-content: space-around;
  width: 100%;
}

.cat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  transition: transform 0.2s ease;
}

.cat-item:active {
  transform: scale(0.92);
}

.cat-icon-bg {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cat-emoji {
  font-size: 48rpx;
}

.cat-name {
  font-size: 24rpx;
  color: #4E5969;
}

/* 推荐卡片 */
.rec-row {
  display: flex;
  gap: 24rpx;
}

.rec-card {
  flex: 1;
  background: #FFFFFF;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.rec-card:active {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}

.rec-card-img {
  width: 100%;
  height: 200rpx;
  background: #FFF7E6;
  overflow: hidden;
}

.rec-card-photo {
  width: 100%;
  height: 100%;
  transition: transform 0.3s ease;
}

.rec-card:active .rec-card-photo {
  transform: scale(1.08);
}

.rec-card-info {
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.rec-card-name {
  font-size: 26rpx;
  font-weight: bold;
  color: #1D2129;
}

.rec-card-price {
  font-size: 24rpx;
  font-weight: bold;
  color: #FF4D4F;
}

/* 模态弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.25s ease;
}

.modal-card {
  width: 600rpx;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 60rpx 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  animation: bounceIn 0.5s ease;
}

.modal-emoji {
  font-size: 100rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #1D2129;
}

.modal-item-name {
  font-size: 40rpx;
  font-weight: bold;
  color: #FF4D4F;
}

.modal-item-desc {
  font-size: 26rpx;
  color: #86909C;
  text-align: center;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 20rpx;
  width: 100%;
  margin-top: 20rpx;
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.modal-btn:active {
  transform: scale(0.95);
}

.modal-btn.primary {
  background: #FF4D4F;
}

.modal-btn.secondary {
  background: #F7F8FA;
}

.modal-btn-text.primary {
  color: #FFFFFF;
  font-weight: bold;
  font-size: 28rpx;
}

.modal-btn-text.secondary {
  color: #4E5969;
  font-weight: bold;
  font-size: 28rpx;
}

/* 房间号标签 */
.room-badge-home { padding: 6rpx 16rpx; background: #FFF1F0; border-radius: 16rpx; align-self: flex-start; }
.room-badge-home-text { font-size: 20rpx; color: #FF4D4F; font-weight: bold; letter-spacing: 2rpx; font-family: 'Courier New', monospace; }

.bottom-spacer {
  height: 160rpx;
}
</style>
