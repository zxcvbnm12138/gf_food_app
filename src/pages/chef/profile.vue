<template>
  <view class="page">
    <view class="status-bar-p"></view>
    <!-- 个人资料头部 -->
    <view class="profile-header">
      <view class="avatar-area">
        <button class="avatar-button" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
          <view class="avatar-ring">
            <image v-if="chef.avatarUrl" class="avatar-image" :src="chef.avatarUrl" mode="aspectFill" />
            <text v-else class="avatar-emoji">👨‍🍳</text>
          </view>
        </button>
      </view>
      <text class="username">{{ chef.name }}</text>
      <text class="feed-label">已投喂 {{ totalDone }} 次 💪</text>
      <view class="stats-row">
        <view class="stat-item"><text class="stat-num">{{ totalDone }}</text><text class="stat-label">完成订单</text></view>
        <view class="stat-divider"></view>
        <view class="stat-item"><text class="stat-num">{{ pendingCount }}</text><text class="stat-label">待处理</text></view>
        <view class="stat-divider"></view>
        <view class="stat-item"><text class="stat-num">{{ todayCount }}</text><text class="stat-label">今日订单</text></view>
      </view>
    </view>
    <!-- 主体 -->
    <scroll-view class="profile-body" scroll-y :enhanced="true" :show-scrollbar="false">
      <view class="body-inner">
        <!-- 快捷操作 -->
        <text class="section-title">快捷操作</text>
        <view class="action-cards">
          <view class="action-card" @click="switchToCustomer">
            <view class="action-icon-bg customer-bg"><text class="action-emoji">🍽️</text></view>
            <text class="action-label">切换到点餐端</text>
            <view class="action-chevron"></view>
          </view>
          <view class="action-card" @click="goOrders">
            <view class="action-icon-bg orders-bg"><text class="action-emoji">📋</text></view>
            <text class="action-label">订单管理</text>
            <view class="action-chevron"></view>
          </view>
          <view class="action-card" @click="goMenu">
            <view class="action-icon-bg menu-bg"><text class="action-emoji">🍽️</text></view>
            <text class="action-label">菜品管理</text>
            <view class="action-chevron"></view>
          </view>
          <view class="action-card" @click="goRecipes">
            <view class="action-icon-bg recipe-bg"><text class="action-emoji">📖</text></view>
            <text class="action-label">菜谱管理</text>
            <view class="action-chevron"></view>
          </view>
        </view>
        <!-- 设置 -->
        <text class="section-title" style="margin-top: 16rpx;">更多</text>
        <view class="settings-card">
          <view class="setting-row" @click="showAbout"><text class="setting-icon">💝</text><text class="setting-label">关于这个App</text><view class="setting-chevron"></view></view>
          <view class="setting-divider"></view>
          <view class="setting-row" @click="clearHistory"><text class="setting-icon">🧹</text><text class="setting-label">清除当前房间所有数据</text><view class="setting-chevron"></view></view>
          <view class="setting-divider"></view>
          <view class="setting-row" @click="doLogout"><text class="setting-icon">🚪</text><text class="setting-label">退出登录</text><view class="setting-chevron"></view></view>
        </view>
        <view class="profile-spacer"></view>
      </view>
    </scroll-view>
    <ChefTabBar :current="3" />
  </view>
</template>

<script setup>
import { computed } from 'vue'
import store, { getOrdersByStatus, getTodayOrders, updateChefAvatar, clearCurrentRoomAllData, clearRole, setRole, clearLoginState } from '@/store/index.js'
import ChefTabBar from '@/components/ChefTabBar.vue'
const chef = computed(() => store.chef)
const totalDone = computed(() => getOrdersByStatus('done').length)
const pendingCount = computed(() => getOrdersByStatus('pending').length)
const todayCount = computed(() => getTodayOrders().length)
const onChooseAvatar = (e) => { const url = e.detail?.avatarUrl; if (url) updateChefAvatar(url) }
const switchToCustomer = () => { setRole('customer'); uni.switchTab({ url: '/pages/index/index' }) }
const goOrders = () => uni.switchTab({ url: '/pages/chef/orders' })
const goMenu = () => uni.switchTab({ url: '/pages/chef/menu-manage' })
const goRecipes = () => uni.navigateTo({ url: '/pages/chef/recipe-manage' })
const showAbout = () => { uni.showModal({ title: '💝 关于投喂小厨房', content: '这是专属于你们的投喂小厨房～ 主厨端帮你管理订单和菜品，用心做的每一道菜，都是爱她的方式 ❤️', showCancel: false, confirmText: '好哒！', confirmColor: '#4080FF' }) }
const clearHistory = () => {
  uni.showModal({
    title: '确认清除',
    content: '确定要清除当前房间的所有订单和菜品吗？此操作不可恢复。',
    confirmColor: '#FF4D4F',
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '清除中...', mask: true })
      try {
        const success = await clearCurrentRoomAllData()
        uni.hideLoading()
        uni.showToast({
          title: success ? '已清除当前房间数据' : '清除失败，请检查网络',
          icon: 'none',
          duration: success ? 1500 : 2500,
        })
      } catch (e) {
        uni.hideLoading()
        uni.showToast({ title: '清除失败，请重试', icon: 'none', duration: 2500 })
      }
    },
  })
}
const doLogout = () => { clearLoginState(); clearRole(); uni.reLaunch({ url: '/pages/login/login' }) }
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100vh; background: linear-gradient(180deg, #4080FF 0, #6AA1FF 360rpx, #F7F8FA 360rpx, #F7F8FA 100%); position: relative; overflow: hidden; }
.status-bar-p { height: var(--status-bar-height, 44px); width: 100%; }
.profile-header { background: linear-gradient(180deg, #4080FF 0%, #6AA1FF 100%); padding: 16rpx 40rpx 56rpx; display: flex; flex-direction: column; align-items: center; gap: 24rpx; }
.avatar-area { position: relative; margin-top: 32rpx; }
.avatar-button { width: 156rpx; height: 156rpx; padding: 0; margin: 0; border: 0; border-radius: 50%; background: transparent; line-height: 1; overflow: visible; }
.avatar-button::after { border: 0; }
.avatar-ring { width: 144rpx; height: 144rpx; border-radius: 50%; background: #E8F3FF; border: 6rpx solid #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.15); animation: bounceIn 0.6s ease; overflow: hidden; }
.avatar-emoji { font-size: 72rpx; }
.avatar-image { width: 100%; height: 100%; }
.username { font-size: 40rpx; font-weight: bold; color: #FFFFFF; }
.feed-label { font-size: 24rpx; color: rgba(255,255,255,0.8); }
.stats-row { display: flex; justify-content: space-around; align-items: center; width: 100%; padding-top: 24rpx; }
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
.stat-num { font-size: 44rpx; font-weight: bold; color: #FFFFFF; }
.stat-label { font-size: 22rpx; color: rgba(255,255,255,0.65); }
.stat-divider { width: 2rpx; height: 40rpx; background: rgba(255,255,255,0.2); }
.profile-body { flex: 1; overflow: hidden; }
.body-inner { padding: 40rpx 32rpx; display: flex; flex-direction: column; gap: 24rpx; }
.section-title { font-size: 32rpx; font-weight: bold; color: #1D2129; }
.action-cards { display: flex; flex-direction: column; gap: 16rpx; }
.action-card { display: flex; align-items: center; gap: 24rpx; background: #FFFFFF; border-radius: 28rpx; padding: 28rpx 32rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); transition: transform 0.2s ease; }
.action-card:active { transform: scale(0.98); }
.action-icon-bg { width: 80rpx; height: 80rpx; border-radius: 24rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.customer-bg { background: #FFF1F0; }
.orders-bg { background: #E8F3FF; }
.menu-bg { background: #FFF7E6; }
.recipe-bg { background: #F3E8FF; }
.action-emoji { font-size: 40rpx; }
.action-label { flex: 1; font-size: 28rpx; color: #4E5969; font-weight: bold; }
.action-chevron { width: 18rpx; height: 18rpx; border-top: 4rpx solid #C9CDD4; border-right: 4rpx solid #C9CDD4; transform: rotate(45deg); flex-shrink: 0; }
.settings-card { background: #FFFFFF; border-radius: 32rpx; padding: 0 32rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); }
.setting-row { display: flex; align-items: center; height: 100rpx; gap: 20rpx; transition: background 0.2s ease; }
.setting-row:active { background: #F7F8FA; }
.setting-icon { font-size: 36rpx; }
.setting-label { flex: 1; font-size: 28rpx; color: #4E5969; }
.setting-chevron { width: 18rpx; height: 18rpx; border-top: 4rpx solid #C9CDD4; border-right: 4rpx solid #C9CDD4; transform: rotate(45deg); flex-shrink: 0; }
.setting-divider { height: 2rpx; background: #F2F3F5; }
.profile-spacer { height: 200rpx; }
</style>
