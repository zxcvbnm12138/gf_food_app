<template>
  <view class="page">
    <view class="status-bar"></view>
    <scroll-view class="scroll-wrapper" scroll-y :enhanced="true" :show-scrollbar="false">
      <view class="wrapper">
        <view class="header anim-item" :style="{ animationDelay: '0.05s' }">
          <view class="hd-left">
            <text class="greeting-sub">{{ greetingText }} 👨‍🍳</text>
            <text class="greeting-main">今天又要宠她啦！</text>
          </view>
          <view class="avatar-wrap" @click="goProfile">
            <view class="avatar">
              <image v-if="chef.avatarUrl" class="avatar-image" :src="chef.avatarUrl" mode="aspectFill" />
              <text v-else class="avatar-emoji">👨‍🍳</text>
            </view>
          </view>
        </view>
        <view class="room-card anim-item" :style="{ animationDelay: '0.08s' }">
          <view class="room-card-left">
            <text class="room-card-label">当前房间号</text>
            <text class="room-card-id">{{ currentRoomId }}</text>
          </view>
          <view v-if="store.roomId" class="room-copy-btn" @click="copyRoomId">
            <text class="room-copy-text">复制</text>
          </view>
        </view>
        <view class="stats-section anim-item" :style="{ animationDelay: '0.1s' }">
          <view class="stat-card" v-for="s in statItems" :key="s.label">
            <view class="stat-icon-bg" :style="{ background: s.bg }">
              <text class="stat-icon-emoji">{{ s.icon }}</text>
            </view>
            <text class="stat-value">{{ s.value }}</text>
            <text class="stat-label">{{ s.label }}</text>
          </view>
        </view>
        <view class="overview-card anim-item" :style="{ animationDelay: '0.15s' }">
          <view class="overview-left">
            <text class="overview-title">📊 今日投喂数据</text>
            <text class="overview-desc">今天共收到 {{ todayTotal }} 道投喂指令</text>
          </view>
          <view class="overview-badge">
            <text class="overview-badge-num">{{ todayTotal }}</text>
            <text class="overview-badge-label">单</text>
          </view>
        </view>
        <view class="section anim-item" :style="{ animationDelay: '0.2s' }">
          <view class="section-header">
            <text class="section-title">最新待处理</text>
            <text class="section-link" @click="goOrders">查看全部 ›</text>
          </view>
          <view v-if="recentPending.length > 0" class="pending-list">
            <view v-for="(order, index) in recentPending" :key="order.id" class="pending-card" :style="{ animationDelay: (0.25 + index * 0.08) + 's' }" @click="goOrders">
              <view class="pending-head">
                <view class="pending-id-wrap"><text class="pending-dot"></text><text class="pending-id">#{{ order.id.slice(-6) }}</text></view>
                <text class="pending-time">{{ fmtTime(order.createdAt) }}</text>
              </view>
              <view class="pending-items">
                <text class="pending-items-text">{{ orderSummary(order) }}</text>
                <text class="pending-count">{{ order.totalCount }} 件</text>
              </view>
              <text v-if="order.note" class="pending-note">💌 {{ order.note }}</text>
              <view class="pending-actions"><view class="accept-btn" @click.stop="handleAccept(order.id)"><text class="accept-btn-text">立即接单</text></view></view>
            </view>
          </view>
          <view v-else class="empty-pending"><text class="empty-emoji">🍵</text><text class="empty-text">暂无新订单，等她来撒娇吧～</text></view>
        </view>
        <view class="quick-row anim-item" :style="{ animationDelay: '0.3s' }">
          <view class="quick-item" @click="goMenuManage"><view class="quick-icon-bg"><text class="quick-emoji">🍽️</text></view><text class="quick-label">管理菜品</text></view>
          <view class="quick-item" @click="switchToCustomer"><view class="quick-icon-bg switch-bg"><text class="quick-emoji">🔄</text></view><text class="quick-label">切换点餐</text></view>
        </view>
        <view class="bottom-spacer"></view>
      </view>
    </scroll-view>
    <ChefTabBar :current="0" />
  </view>
</template>

<script setup>
import { computed, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import store, { acceptOrder, getOrdersByStatus, getTodayOrders, setRole, loadOrdersFromCloud } from '@/store/index.js'
import ChefTabBar from '@/components/ChefTabBar.vue'
const chef = computed(() => store.chef)
const currentRoomId = computed(() => store.roomId || '未加入房间')

// 页面显示时刷新云端订单
let pollTimer = null
const refreshOrders = async () => {
  try {
    await loadOrdersFromCloud()
  } catch (e) {
    console.warn('[ChefDashboard] 刷新订单失败', e)
  }
}

const startPolling = () => {
  refreshOrders()
  if (!pollTimer) {
    pollTimer = setInterval(refreshOrders, 5000)
  }
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// onShow: 每次页面可见时立即刷新 + 启动轮询
onShow(() => {
  startPolling()
})

// onHide: 页面隐藏时停止轮询，节省资源
onHide(() => {
  stopPolling()
})

onUnmounted(() => {
  stopPolling()
})
const greetingText = computed(() => { const h = new Date().getHours(); if (h < 6) return '夜深了大厨'; if (h < 11) return '早安大厨'; if (h < 14) return '午安大厨'; if (h < 18) return '下午好大厨'; return '晚上好大厨' })
const pendingCount = computed(() => getOrdersByStatus('pending').length)
const cookingCount = computed(() => getOrdersByStatus('accepted').length + getOrdersByStatus('cooking').length)
const doneCount = computed(() => getOrdersByStatus('done').length)
const todayTotal = computed(() => getTodayOrders().length)
const statItems = computed(() => [
  { icon: '📥', value: pendingCount.value, label: '待接单', bg: '#FFF7E6' },
  { icon: '🔥', value: cookingCount.value, label: '制作中', bg: '#FFF1F0' },
  { icon: '✅', value: doneCount.value, label: '已完成', bg: '#F6FFED' },
])
const recentPending = computed(() => getOrdersByStatus('pending').slice(0, 3))
const fmtTime = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
const orderSummary = (order) => order.items.map(i => i.name).slice(0, 3).join('、')
const handleAccept = async (id) => {
  const success = await acceptOrder(id)
  if (success) {
    uni.showToast({ title: '已接单 🎉', icon: 'none', duration: 1500 })
  } else {
    uni.showToast({ title: '接单失败，请检查网络或云函数', icon: 'none', duration: 3000 })
  }
}
const goOrders = () => uni.switchTab({ url: '/pages/chef/orders' })
const goProfile = () => uni.switchTab({ url: '/pages/chef/profile' })
const goMenuManage = () => uni.switchTab({ url: '/pages/chef/menu-manage' })
const switchToCustomer = () => { setRole('customer'); uni.switchTab({ url: '/pages/index/index' }) }
const copyRoomId = () => {
  if (!store.roomId) return
  uni.setClipboardData({
    data: store.roomId,
    success: () => {
      uni.showToast({ title: '已复制房间号', icon: 'none' })
    },
  })
}
</script>

<style scoped>
.page { position: relative; display: flex; flex-direction: column; height: 100vh; background: #F7F8FA; overflow: hidden; }
.status-bar { height: var(--status-bar-height, 44px); width: 100%; background: #F7F8FA; }
.scroll-wrapper { height: calc(100vh - var(--status-bar-height, 44px)); width: 100%; }
.wrapper { padding: 32rpx 40rpx 48rpx; display: flex; flex-direction: column; gap: 40rpx; }
.anim-item { animation: fadeInUp 0.5s ease both; }
.header { display: flex; justify-content: space-between; align-items: center; }
.hd-left { display: flex; flex-direction: column; gap: 8rpx; }
.greeting-sub { font-size: 28rpx; color: #86909C; }
.greeting-main { font-size: 44rpx; font-weight: bold; color: #1D2129; }
.avatar-wrap { flex-shrink: 0; margin-right: 200rpx; }
.avatar { width: 88rpx; height: 88rpx; border-radius: 50%; background: #E8F3FF; display: flex; align-items: center; justify-content: center; font-size: 44rpx; border: 4rpx solid #fff; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.08); transition: transform 0.3s ease; overflow: hidden; }
.avatar-image { width: 100%; height: 100%; }
.avatar-emoji { font-size: 44rpx; }
.avatar:active { transform: scale(0.92); }
.room-card { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 32rpx; border-radius: 28rpx; background: #FFFFFF; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); gap: 24rpx; }
.room-card-left { display: flex; flex-direction: column; gap: 8rpx; min-width: 0; }
.room-card-label { font-size: 24rpx; color: #86909C; }
.room-card-id { font-size: 40rpx; font-weight: bold; color: #1D2129; letter-spacing: 4rpx; font-family: 'Courier New', monospace; }
.room-copy-btn { height: 64rpx; padding: 0 28rpx; border-radius: 32rpx; background: #E8F3FF; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.2s ease; }
.room-copy-btn:active { transform: scale(0.94); }
.room-copy-text { font-size: 24rpx; font-weight: bold; color: #4080FF; }
.stats-section { display: flex; gap: 20rpx; }
.stat-card { flex: 1; background: #FFFFFF; border-radius: 28rpx; padding: 32rpx 20rpx; display: flex; flex-direction: column; align-items: center; gap: 12rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); transition: transform 0.2s ease; }
.stat-card:active { transform: scale(0.96); }
.stat-icon-bg { width: 72rpx; height: 72rpx; border-radius: 20rpx; display: flex; align-items: center; justify-content: center; }
.stat-icon-emoji { font-size: 36rpx; }
.stat-value { font-size: 44rpx; font-weight: bold; color: #1D2129; }
.stat-label { font-size: 22rpx; color: #86909C; }
.overview-card { display: flex; align-items: center; justify-content: space-between; padding: 36rpx 40rpx; border-radius: 32rpx; background: linear-gradient(135deg, #4080FF 0%, #6AA1FF 100%); box-shadow: 0 16rpx 40rpx rgba(64,128,255,0.25); gap: 32rpx; }
.overview-left { display: flex; flex-direction: column; gap: 12rpx; flex: 1; }
.overview-title { font-size: 32rpx; font-weight: bold; color: #FFFFFF; }
.overview-desc { font-size: 24rpx; color: rgba(255,255,255,0.8); }
.overview-badge { width: 100rpx; height: 100rpx; border-radius: 28rpx; background: rgba(255,255,255,0.2); display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
.overview-badge-num { font-size: 40rpx; font-weight: bold; color: #FFFFFF; }
.overview-badge-label { font-size: 20rpx; color: rgba(255,255,255,0.8); }
.section { display: flex; flex-direction: column; gap: 24rpx; }
.section-header { display: flex; justify-content: space-between; align-items: center; }
.section-title { font-size: 32rpx; font-weight: bold; color: #1D2129; }
.section-link { font-size: 24rpx; color: #86909C; }
.pending-list { display: flex; flex-direction: column; gap: 20rpx; }
.pending-card { background: #FFFFFF; border-radius: 28rpx; padding: 32rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 20rpx; animation: fadeInUp 0.4s ease both; transition: transform 0.2s ease; }
.pending-card:active { transform: scale(0.98); }
.pending-head { display: flex; justify-content: space-between; align-items: center; }
.pending-id-wrap { display: flex; align-items: center; gap: 12rpx; }
.pending-dot { width: 16rpx; height: 16rpx; border-radius: 50%; background: #FF4D4F; animation: pulse 1.5s infinite; }
.pending-id { font-size: 28rpx; font-weight: bold; color: #1D2129; }
.pending-time { font-size: 24rpx; color: #86909C; }
.pending-items { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; }
.pending-items-text { font-size: 26rpx; color: #4E5969; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pending-count { font-size: 24rpx; font-weight: bold; color: #FF4D4F; flex-shrink: 0; }
.pending-note { font-size: 22rpx; color: #86909C; line-height: 1.5; }
.pending-actions { display: flex; justify-content: flex-end; }
.accept-btn { padding: 16rpx 40rpx; border-radius: 32rpx; background: #4080FF; box-shadow: 0 8rpx 24rpx rgba(64,128,255,0.25); transition: transform 0.2s ease; }
.accept-btn:active { transform: scale(0.92); }
.accept-btn-text { font-size: 26rpx; font-weight: bold; color: #FFFFFF; }
.empty-pending { display: flex; flex-direction: column; align-items: center; gap: 16rpx; padding: 60rpx 0; background: #FFFFFF; border-radius: 28rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); }
.empty-emoji { font-size: 72rpx; }
.empty-text { font-size: 26rpx; color: #86909C; }
.quick-row { display: flex; gap: 24rpx; }
.quick-item { flex: 1; background: #FFFFFF; border-radius: 28rpx; padding: 32rpx; display: flex; flex-direction: column; align-items: center; gap: 16rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); transition: transform 0.2s ease; }
.quick-item:active { transform: scale(0.95); }
.quick-icon-bg { width: 80rpx; height: 80rpx; border-radius: 24rpx; background: #E8F3FF; display: flex; align-items: center; justify-content: center; }
.switch-bg { background: #FFF1F0; }
.quick-emoji { font-size: 40rpx; }
.quick-label { font-size: 26rpx; color: #4E5969; font-weight: bold; }
.bottom-spacer { height: 160rpx; }
</style>
