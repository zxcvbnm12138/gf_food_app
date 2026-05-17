<template>
  <view class="page">
    <view class="status-bar"></view>

    <view class="top-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">←</text>
      </view>
      <view class="header-copy">
        <text class="page-title">特权兑换券</text>
        <text class="page-subtitle">已被投喂 {{ user.feedCount }} 次</text>
      </view>
      <view class="header-badge">
        <text class="header-badge-text">{{ availableCount }} 可用</text>
      </view>
    </view>

    <scroll-view class="coupon-scroll" scroll-y :enhanced="true" :show-scrollbar="false">
      <view class="coupon-list">
        <view
          v-for="(coupon, index) in coupons"
          :key="coupon.id"
          class="coupon-card"
          :style="{ animationDelay: (index * 0.06) + 's' }"
        >
          <view class="coupon-head">
            <view class="coupon-icon-bg" :style="{ background: coupon.color }">
              <text class="coupon-emoji">{{ coupon.emoji }}</text>
            </view>
            <view class="coupon-info">
              <text class="coupon-name">{{ coupon.name }}</text>
              <text class="coupon-desc">{{ coupon.desc }}</text>
            </view>
          </view>

          <view class="progress-wrap">
            <view class="progress-meta">
              <text class="progress-text">{{ getProgressText(coupon) }}</text>
              <text class="progress-percent">{{ getProgressPercent(coupon) }}%</text>
            </view>
            <view class="progress-track">
              <view class="progress-fill" :style="{ width: getProgressPercent(coupon) + '%' }"></view>
            </view>
          </view>

          <view
            class="coupon-btn"
            :class="{ available: coupon.available }"
            @click="redeemCoupon(coupon)"
          >
            <text class="coupon-btn-text" :class="{ available: coupon.available }">
              {{ coupon.available ? '立即兑换' : '继续投喂' }}
            </text>
          </view>
        </view>

        <view class="bottom-spacer"></view>
      </view>
    </scroll-view>

    <view class="redeem-overlay" v-if="showRedeem" @click="showRedeem = false">
      <view class="redeem-card" @click.stop>
        <text class="redeem-emoji">{{ redeemItem.emoji }}</text>
        <text class="redeem-title">确认兑换？</text>
        <text class="redeem-name">{{ redeemItem.name }}</text>
        <view class="redeem-actions">
          <view class="redeem-btn cancel" @click="showRedeem = false">
            <text class="redeem-btn-text cancel">取消</text>
          </view>
          <view class="redeem-btn confirm" @click="confirmRedeem">
            <text class="redeem-btn-text confirm">确认兑换</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import store, { loadOrdersFromCloud, refreshUserStats } from '@/store/index.js'

const user = computed(() => store.user)
const coupons = computed(() => store.coupons)
const availableCount = computed(() => coupons.value.filter(coupon => coupon.available).length)
const showRedeem = ref(false)
const redeemItem = ref({})

onShow(() => {
  refreshUserStats()
  loadOrdersFromCloud()
    .then(() => refreshUserStats())
    .catch((e) => {
      console.warn('[Coupons] 刷新真实统计失败', e)
    })
})

const getProgressPercent = (coupon) => {
  if (!coupon.required) return 100
  return Math.min(100, Math.round((user.value.feedCount / coupon.required) * 100))
}

const getProgressText = (coupon) => {
  if (coupon.available) return '已达成兑换条件'
  const remaining = Math.max(0, coupon.required - user.value.feedCount)
  return `还差 ${remaining} 次投喂`
}

const redeemCoupon = (coupon) => {
  if (!coupon.available) {
    uni.showToast({
      title: getProgressText(coupon),
      icon: 'none',
      duration: 1500,
    })
    return
  }
  redeemItem.value = coupon
  showRedeem.value = true
}

const confirmRedeem = () => {
  showRedeem.value = false
  uni.showToast({
    title: '兑换成功！',
    icon: 'none',
    duration: 2000,
  })
}

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/profile/profile' })
  }
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #F7F8FA;
  overflow: hidden;
}

.status-bar {
  height: var(--status-bar-height, 44px);
  width: 100%;
  background: #FFFFFF;
}

.top-header {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 20rpx 40rpx 28rpx;
  background: #FFFFFF;
}

.back-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 32rpx;
  background: #F2F3F5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.back-btn:active {
  transform: scale(0.92);
}

.back-icon {
  font-size: 34rpx;
  color: #1D2129;
  font-weight: bold;
}

.header-copy {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.page-title {
  font-size: 40rpx;
  color: #1D2129;
  font-weight: bold;
}

.page-subtitle {
  font-size: 24rpx;
  color: #86909C;
}

.header-badge {
  height: 56rpx;
  padding: 0 24rpx;
  border-radius: 28rpx;
  background: #FFF1F0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-badge-text {
  font-size: 24rpx;
  color: #FF4D4F;
  font-weight: bold;
}

.coupon-scroll {
  flex: 1;
  overflow: hidden;
}

.coupon-list {
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.coupon-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 28rpx;
  animation: fadeInUp 0.4s ease both;
}

.coupon-head {
  display: flex;
  align-items: center;
  gap: 28rpx;
}

.coupon-icon-bg {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.coupon-emoji {
  font-size: 48rpx;
}

.coupon-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.coupon-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #1D2129;
}

.coupon-desc {
  font-size: 24rpx;
  color: #86909C;
}

.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.progress-text,
.progress-percent {
  font-size: 22rpx;
  color: #86909C;
}

.progress-percent {
  color: #FF4D4F;
  font-weight: bold;
}

.progress-track {
  height: 12rpx;
  border-radius: 6rpx;
  background: #F2F3F5;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 6rpx;
  background: linear-gradient(90deg, #FF4D4F, #FF8C9A);
  transition: width 0.3s ease;
}

.coupon-btn {
  height: 80rpx;
  border-radius: 40rpx;
  background: #F2F3F5;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, background 0.2s ease;
}

.coupon-btn.available {
  background: #FF4D4F;
}

.coupon-btn:active {
  transform: scale(0.96);
}

.coupon-btn-text {
  font-size: 28rpx;
  color: #86909C;
  font-weight: bold;
}

.coupon-btn-text.available {
  color: #FFFFFF;
}

.bottom-spacer {
  height: 80rpx;
}

.redeem-overlay {
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

.redeem-card {
  width: 560rpx;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 60rpx 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  animation: bounceIn 0.5s ease;
}

.redeem-emoji {
  font-size: 80rpx;
}

.redeem-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #1D2129;
}

.redeem-name {
  font-size: 28rpx;
  color: #4E5969;
}

.redeem-actions {
  display: flex;
  gap: 20rpx;
  width: 100%;
  margin-top: 20rpx;
}

.redeem-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.redeem-btn:active {
  transform: scale(0.95);
}

.redeem-btn.cancel {
  background: #F7F8FA;
}

.redeem-btn.confirm {
  background: #FF4D4F;
}

.redeem-btn-text.cancel {
  color: #4E5969;
  font-weight: bold;
  font-size: 28rpx;
}

.redeem-btn-text.confirm {
  color: #FFFFFF;
  font-weight: bold;
  font-size: 28rpx;
}
</style>
