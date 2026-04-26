<template>
  <view class="page">
    <!-- 状态栏 -->
    <view class="status-bar-p"></view>

    <!-- 个人资料头部 -->
    <view class="profile-header">
      <view class="avatar-area">
        <button class="avatar-button" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
          <view class="avatar-ring">
            <image v-if="user.avatarUrl" class="avatar-image" :src="user.avatarUrl" mode="aspectFill" />
            <text v-else class="avatar-emoji">🧸</text>
          </view>
        </button>
      </view>
      <text class="username">{{ user.name }}</text>
      <text class="feed-label">已被投喂 {{ user.feedCount }} 次 🥰</text>

      <!-- 统计数据 -->
      <view class="stats-row">
        <view class="stat-item">
          <text class="stat-num">{{ user.feedCount }}</text>
          <text class="stat-label">投喂次数</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num">{{ user.privileges }}</text>
          <text class="stat-label">可用特权</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num">{{ user.favorites }}</text>
          <text class="stat-label">收藏菜品</text>
        </view>
      </view>
    </view>

    <!-- 主体内容 -->
    <scroll-view class="profile-body" scroll-y :enhanced="true" :show-scrollbar="false">
      <view class="body-inner">
        <!-- 特权兑换券 -->
        <view class="section-head">
          <text class="section-title">特权兑换券 🎁</text>
          <text class="section-link">查看全部 ›</text>
        </view>

        <view
          v-for="(coupon, index) in coupons"
          :key="coupon.id"
          class="coupon-card"
          :style="{ animationDelay: (index * 0.08) + 's' }"
        >
          <view class="coupon-icon-bg" :style="{ background: coupon.color }">
            <text class="coupon-emoji">{{ coupon.emoji }}</text>
          </view>
          <view class="coupon-info">
            <text class="coupon-name">{{ coupon.name }}</text>
            <text class="coupon-desc">{{ coupon.desc }}</text>
          </view>
          <view
            class="coupon-btn"
            :class="{ available: coupon.available }"
            @click="redeemCoupon(coupon)"
          >
            <text class="coupon-btn-text" :class="{ available: coupon.available }">
              {{ coupon.available ? '兑换' : '未达成' }}
            </text>
          </view>
        </view>

        <!-- 偏好设置 -->
        <text class="section-title-solo">偏好设置</text>
        <view class="pref-card">
          <view class="pref-row">
            <text class="pref-label">绝对不吃 🚫</text>
            <view class="pref-tags">
              <view v-for="(tag, i) in user.dislikes" :key="i" class="pref-tag">
                <text class="pref-tag-text">{{ tag }}</text>
              </view>
              <view class="pref-tag add" @click="addDislike">
                <text class="pref-tag-text add">+</text>
              </view>
            </view>
          </view>
          <view class="pref-divider"></view>
          <view class="pref-row">
            <text class="pref-label">过敏提醒 ⚠️</text>
            <text class="pref-value" @click="editAllergy">{{ user.allergies }}</text>
          </view>
        </view>

        <!-- 其他设置 -->
        <text class="section-title-solo">更多</text>
        <view class="settings-card">
          <view class="setting-row" @click="showAbout">
            <text class="setting-icon">💝</text>
            <text class="setting-label">关于这个App</text>
            <view class="setting-chevron"></view>
          </view>
          <view class="setting-divider"></view>
          <view class="setting-row" @click="clearHistory">
            <text class="setting-icon">🧹</text>
            <text class="setting-label">清除历史记录</text>
            <view class="setting-chevron"></view>
          </view>
          <view class="setting-divider"></view>
          <view class="setting-row">
            <text class="setting-icon">🔔</text>
            <text class="setting-label">通知设置</text>
            <switch class="setting-switch" :checked="notifyOn" @change="toggleNotify" color="#FF4D4F" />
          </view>
        </view>

        <view class="profile-spacer"></view>
      </view>
    </scroll-view>

    <!-- 兑换弹窗 -->
    <view class="redeem-overlay" v-if="showRedeem">
      <view class="redeem-card">
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

    <!-- TabBar -->
    <TabBar :current="3" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import store, { clearOrders, updateUserAvatar } from '@/store/index.js'
import TabBar from '@/components/TabBar.vue'

const user = computed(() => store.user)
const coupons = computed(() => store.coupons)
const notifyOn = ref(true)

const showRedeem = ref(false)
const redeemItem = ref({})

const onChooseAvatar = (e) => {
  const avatarUrl = e.detail?.avatarUrl
  if (!avatarUrl) return
  updateUserAvatar(avatarUrl)
}

const redeemCoupon = (coupon) => {
  if (!coupon.available) {
    uni.showToast({
      title: '还没达成条件哦～',
      icon: 'none',
      duration: 1500
    })
    return
  }
  redeemItem.value = coupon
  showRedeem.value = true
}

const confirmRedeem = () => {
  showRedeem.value = false
  uni.showToast({
    title: '🎉 兑换成功！',
    icon: 'none',
    duration: 2000
  })
}

const addDislike = () => {
  uni.showModal({
    title: '添加不吃的食物',
    editable: true,
    placeholderText: '请输入食物名称',
    success: (res) => {
      if (res.confirm && res.content && res.content.trim()) {
        store.user.dislikes.push(res.content.trim())
      }
    }
  })
}

const editAllergy = () => {
  uni.showModal({
    title: '过敏提醒',
    editable: true,
    placeholderText: '请输入过敏原',
    content: store.user.allergies === '无' ? '' : store.user.allergies,
    success: (res) => {
      if (res.confirm) {
        store.user.allergies = res.content?.trim() || '无'
      }
    }
  })
}

const toggleNotify = (e) => {
  notifyOn.value = e.detail.value
}

const showAbout = () => {
  uni.showModal({
    title: '💝 关于投喂小厨房',
    content: '这是专属于你的投喂小厨房～ 用来记录每一次的宠爱投喂！想吃什么尽管点，因为...你值得被宠爱 ❤️',
    showCancel: false,
    confirmText: '好哒！',
    confirmColor: '#FF4D4F',
  })
}

const clearHistory = () => {
  uni.showModal({
    title: '确认清除',
    content: '确定要清除所有历史记录吗？',
    confirmColor: '#FF4D4F',
    success: (res) => {
      if (res.confirm) {
        clearOrders()
        uni.showToast({
          title: '已清除 ✨',
          icon: 'none',
          duration: 1500
        })
      }
    }
  })
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #F7F8FA;
  position: relative;
  overflow: hidden;
}

.status-bar-p {
  height: var(--status-bar-height, 44px);
  width: 100%;
  background: linear-gradient(180deg, #FF4D4F 0%, #FF8C9A 100%);
}

/* 头部 */
.profile-header {
  background: linear-gradient(180deg, #FF4D4F 0%, #FF8C9A 100%);
  padding: 16rpx 40rpx 56rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
}

.avatar-area {
  position: relative;
}

.avatar-button {
  width: 156rpx;
  height: 156rpx;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  line-height: 1;
  overflow: visible;
}

.avatar-button::after {
  border: 0;
}

.avatar-ring {
  width: 144rpx;
  height: 144rpx;
  border-radius: 50%;
  background: #FFF3A1;
  border: 6rpx solid #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.15);
  animation: bounceIn 0.6s ease;
  overflow: hidden;
}

.avatar-emoji {
  font-size: 72rpx;
}

.avatar-image {
  width: 100%;
  height: 100%;
}

.username {
  font-size: 40rpx;
  font-weight: bold;
  color: #FFFFFF;
}

.feed-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.stats-row {
  display: flex;
  justify-content: space-around;
  align-items: center;
  width: 100%;
  padding-top: 24rpx;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.stat-num {
  font-size: 44rpx;
  font-weight: bold;
  color: #FFFFFF;
}

.stat-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.65);
}

.stat-divider {
  width: 2rpx;
  height: 40rpx;
  background: rgba(255, 255, 255, 0.2);
}

/* 主体 */
.profile-body {
  flex: 1;
  overflow: hidden;
}

.body-inner {
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

/* 区域标题 */
.section-head {
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

.section-title-solo {
  font-size: 32rpx;
  font-weight: bold;
  color: #1D2129;
  margin-top: 16rpx;
}

/* 兑换券 */
.coupon-card {
  display: flex;
  align-items: center;
  gap: 28rpx;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  animation: fadeInUp 0.4s ease both;
  transition: transform 0.2s ease;
}

.coupon-card:active {
  transform: scale(0.98);
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
  font-size: 28rpx;
  font-weight: bold;
  color: #1D2129;
}

.coupon-desc {
  font-size: 22rpx;
  color: #86909C;
}

.coupon-btn {
  padding: 12rpx 28rpx;
  border-radius: 28rpx;
  background: #F2F3F5;
  transition: all 0.25s ease;
}

.coupon-btn.available {
  background: #FF4D4F;
}

.coupon-btn:active {
  transform: scale(0.92);
}

.coupon-btn-text {
  font-size: 24rpx;
  color: #86909C;
}

.coupon-btn-text.available {
  color: #FFFFFF;
  font-weight: bold;
}

/* 偏好设置卡片 */
.pref-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.pref-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pref-label {
  font-size: 26rpx;
  color: #4E5969;
  flex-shrink: 0;
}

.pref-tags {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.pref-tag {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  background: #FFF1F0;
  transition: transform 0.2s ease;
}

.pref-tag:active {
  transform: scale(0.92);
}

.pref-tag.add {
  background: #F2F3F5;
}

.pref-tag-text {
  font-size: 22rpx;
  color: #FF4D4F;
}

.pref-tag-text.add {
  color: #86909C;
  font-weight: bold;
}

.pref-divider {
  height: 2rpx;
  background: #E5E6EB;
}

.pref-value {
  font-size: 26rpx;
  color: #86909C;
}

/* 设置卡片 */
.settings-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 0 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.setting-row {
  display: flex;
  align-items: center;
  height: 100rpx;
  gap: 20rpx;
  transition: background 0.2s ease;
}

.setting-row:active {
  background: #F7F8FA;
}

.setting-icon {
  font-size: 36rpx;
}

.setting-label {
  flex: 1;
  font-size: 28rpx;
  color: #4E5969;
}

.setting-chevron {
  width: 18rpx;
  height: 18rpx;
  border-top: 4rpx solid #C9CDD4;
  border-right: 4rpx solid #C9CDD4;
  transform: rotate(45deg);
  flex-shrink: 0;
}

.setting-switch {
  transform: scale(0.8);
}

.setting-divider {
  height: 2rpx;
  background: #F2F3F5;
}

.profile-spacer {
  height: 200rpx;
}

/* 兑换弹窗 */
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
