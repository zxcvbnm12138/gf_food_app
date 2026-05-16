<template>
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
</template>

<script setup>
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

const switchTab = (index) => {
  if (props.current === index) return
  uni.switchTab({
    url: tabs[index].path,
  })
}
</script>

<style scoped>
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
</style>
