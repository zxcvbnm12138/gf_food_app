<template>
  <view class="chef-tabbar-root">
    <view class="tabbar-wrapper">
      <view class="tabbar">
        <view
          v-for="(tab, index) in tabs"
          :key="tab.name"
          class="tab-item"
          :class="{ active: props.current === index }"
          @click="switchTab(index)"
        >
          <view class="tab-icon-wrap" :class="{ active: props.current === index }">
            <text class="tab-icon">{{ tab.icon }}</text>
          </view>
          <text class="tab-label" :class="{ active: props.current === index }">{{ tab.label }}</text>
        </view>
      </view>
    </view>

    <!-- 催单通知弹窗 -->
    <view class="rush-overlay" v-if="showRushAlert" @click="dismissRush">
      <view class="rush-modal" @click.stop>
        <view class="rush-modal-ring">
          <text class="rush-modal-emoji">💨</text>
        </view>
        <text class="rush-modal-title">宝贝催单啦！</text>
        <text class="rush-modal-order">#{{ rushAlertData.orderShortId }}</text>
        <text class="rush-modal-items">{{ rushAlertData.items }}</text>
        <text class="rush-modal-hint">快去看看吧，别让她等太久哦～</text>
        <view class="rush-modal-actions">
          <view class="rush-modal-btn" @click="dismissRush">
            <text class="rush-modal-btn-text">知道啦 ❤️</text>
          </view>
          <view class="rush-modal-btn rush-go-btn" @click="goOrdersFromRush">
            <text class="rush-modal-btn-text">去处理 ›</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import store, { dismissRushNotification, startChefOrdersSync, stopChefOrdersSync } from '@/store/index.js'

const props = defineProps({
  current: {
    type: Number,
    default: 0
  }
})

const tabs = [
  { name: 'dashboard', label: '首页', icon: '🏠', path: '/pages/chef/dashboard' },
  { name: 'orders', label: '订单', icon: '📋', path: '/pages/chef/orders' },
  { name: 'menu', label: '菜品', icon: '🍽️', path: '/pages/chef/menu-manage' },
  { name: 'profile', label: '我的', icon: '👨‍🍳', path: '/pages/chef/profile' },
]

const syncOwner = `chef-tabbar-${Date.now()}-${Math.random()}`
const rushAlertData = computed(() => store.activeRushNotification || { orderShortId: '', items: '', orderId: '' })
const showRushAlert = computed(() => store.currentRole === 'chef' && !!store.activeRushNotification)

onMounted(() => {
  startChefOrdersSync(syncOwner)
})

onUnmounted(() => {
  stopChefOrdersSync(syncOwner)
})

const switchTab = (index) => {
  if (props.current === index) return
  uni.switchTab({
    url: tabs[index].path,
  })
}

const dismissRush = () => {
  dismissRushNotification()
}

const goOrdersFromRush = () => {
  dismissRushNotification()
  uni.switchTab({ url: '/pages/chef/orders' })
}
</script>

<style scoped>
.chef-tabbar-root {
  position: relative;
}

.tabbar-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: 0 32rpx 20rpx;
  z-index: 999;
  pointer-events: none;
}

.tabbar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  max-width: 716rpx;
  height: 112rpx;
  background: #1D2129;
  border-radius: 56rpx;
  padding: 8rpx;
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.18);
  pointer-events: auto;
  animation: slideUp 0.4s ease-out;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  border-radius: 48rpx;
  gap: 4rpx;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.tab-item.active {
  background: #4080FF;
}

.tab-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

.tab-icon-wrap.active {
  transform: scale(1.1);
}

.tab-icon {
  font-size: 36rpx;
  line-height: 1;
}

.tab-label {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.5);
  font-weight: normal;
  transition: all 0.3s ease;
}

.tab-label.active {
  color: #FFFFFF;
  font-weight: bold;
}

/* 催单通知弹窗 */
.rush-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease;
}

.rush-modal {
  width: 600rpx;
  background: #FFFFFF;
  border-radius: 36rpx;
  padding: 52rpx 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  animation: rushBounce 0.5s ease;
  position: relative;
  overflow: hidden;
}

.rush-modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 8rpx;
  background: linear-gradient(90deg, #FF4D4F, #FF8C9A, #FFBB96, #FF4D4F);
  background-size: 300% 100%;
  animation: rushShine 2s linear infinite;
}

.rush-modal-ring {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #FFF1F0, #FFD6D9);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: rushPulse 1.5s ease infinite;
}

.rush-modal-emoji { font-size: 64rpx; }
.rush-modal-title { font-size: 38rpx; font-weight: bold; color: #1D2129; }
.rush-modal-order { font-size: 26rpx; color: #86909C; font-family: 'Courier New', monospace; letter-spacing: 4rpx; }
.rush-modal-items { font-size: 28rpx; color: #4E5969; font-weight: bold; }
.rush-modal-hint { font-size: 24rpx; color: #86909C; }
.rush-modal-actions { display: flex; gap: 20rpx; width: 100%; margin-top: 12rpx; }

.rush-modal-btn {
  flex: 1;
  height: 84rpx;
  border-radius: 42rpx;
  background: #F7F8FA;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.rush-modal-btn:active { transform: scale(0.95); }
.rush-go-btn { background: linear-gradient(135deg, #FF4D4F 0%, #FF8C9A 100%); box-shadow: 0 8rpx 24rpx rgba(255,77,79,0.3); }
.rush-modal-btn-text { font-size: 28rpx; font-weight: bold; color: #4E5969; }
.rush-go-btn .rush-modal-btn-text { color: #FFFFFF; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes rushBounce { 0% { opacity: 0; transform: scale(0.7) translateY(40rpx); } 50% { transform: scale(1.05) translateY(-10rpx); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes rushPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
@keyframes rushShine { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
</style>
