<template>
  <view class="page">
    <!-- 状态栏 -->
    <view class="status-bar"></view>

    <!-- 标题栏 -->
    <view class="cart-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">←</text>
      </view>
      <text class="cart-title">投喂清单</text>
      <view class="header-placeholder"></view>
    </view>

    <!-- 购物车内容 -->
    <scroll-view class="cart-scroll" scroll-y :enhanced="true" :show-scrollbar="false">
      <view class="cart-wrapper" v-if="cartItems.length > 0">
        <!-- 购物车商品列表 -->
        <view
          v-for="(item, index) in cartItems"
          :key="index"
          class="cart-item"
          :style="{ animationDelay: (index * 0.08) + 's' }"
        >
          <view class="ci-img">
            <image class="ci-photo" :src="item.image" mode="aspectFill" />
          </view>
          <view class="ci-info">
            <text class="ci-name">{{ item.name }}</text>
            <text class="ci-options">{{ getOptionsText(item) }}</text>
            <view class="ci-bottom">
              <text class="ci-price">❤️ {{ item.price }}</text>
              <view class="qty-ctrl">
                <view class="qty-btn-sm minus" @click="updateQty(index, -1)">
                  <text class="qty-btn-sm-text">-</text>
                </view>
                <text class="qty-val">{{ item.qty }}</text>
                <view class="qty-btn-sm plus" @click="updateQty(index, 1)">
                  <text class="qty-btn-sm-text white">+</text>
                </view>
              </view>
            </view>
          </view>

          <!-- 左滑删除 -->
          <view class="ci-delete" @click="removeItem(index)">
            <text class="ci-delete-icon">🗑️</text>
          </view>
        </view>

        <!-- 撒娇备注 -->
        <view class="note-section">
          <text class="note-title">撒娇备注 💌</text>
          <view class="note-box">
            <textarea
              class="note-textarea"
              v-model="store.cartNote"
              placeholder="快点送来，宝贝饿扁啦！要亲手喂我吃哦 ❤️"
              maxlength="300"
              :auto-height="true"
            />
          </view>
        </view>

        <view class="list-spacer"></view>
      </view>

      <!-- 空购物车 -->
      <view class="empty-cart" v-else>
        <text class="empty-emoji">🛒</text>
        <text class="empty-title">清单还是空的呢</text>
        <text class="empty-desc">快去挑选想吃的美食吧～</text>
        <view class="empty-btn" @click="goMenu">
          <text class="empty-btn-text">去逛逛</text>
        </view>
      </view>
    </scroll-view>

    <!-- 底部结算栏 -->
    <view class="cart-bottom" v-if="cartItems.length > 0">
      <view class="summary-row">
        <text class="summary-count">共 {{ totalCount }} 件</text>
        <text class="summary-price">❤️ 全部免费</text>
      </view>
      <view class="submit-btn" @click="handleSubmit">
        <text class="submit-emoji">🚀</text>
        <text class="submit-text">召唤专属外卖员</text>
      </view>
    </view>

    <!-- 下单成功弹窗 -->
    <view class="order-overlay" v-if="showOrderSuccess">
      <view class="order-card">
        <text class="order-emoji">🎊</text>
        <text class="order-title">投喂指令已发送！</text>
        <text class="order-desc">专属外卖员正在赶来的路上～</text>
        <view class="order-progress-bar">
          <view class="order-progress-fill" :style="{ width: progressWidth + '%' }"></view>
        </view>
        <text class="order-eta">预计 15 分钟送达 💨</text>
        <view class="order-btn" @click="closeOrderSuccess">
          <text class="order-btn-text">好哒！</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import store, {
  updateCartQty,
  removeFromCart,
  getCartTotal,
  createOrderFromCart,
  formatOrderItemOptions,
  getCartRiskWarnings,
  formatCartRiskWarnings,
  loadCurrentRoomUserPreferences,
} from '@/store/index.js'

const showOrderSuccess = ref(false)
const progressWidth = ref(0)

const cartItems = computed(() => store.cart)
const totalCount = computed(() => getCartTotal())

onShow(async () => {
  await loadCurrentRoomUserPreferences().catch((e) => {
    console.warn('[Cart] 刷新房间偏好失败', e)
  })
})

const getOptionsText = (item) => {
  return formatOrderItemOptions(item)
}

const updateQty = (index, delta) => {
  updateCartQty(index, delta)
}

const removeItem = (index) => {
  uni.showModal({
    title: '确认删除',
    content: '要把这个从清单里去掉吗？',
    confirmColor: '#FF4D4F',
    success: (res) => {
      if (res.confirm) {
        removeFromCart(index)
      }
    }
  })
}

const confirmRiskWarnings = (warnings) => new Promise((resolve) => {
  const summary = formatCartRiskWarnings(warnings)
  uni.showModal({
    title: '发现忌口 / 过敏提醒',
    content: summary ? `${summary}\n\n是否仍要继续下单？` : '当前订单命中忌口 / 过敏提醒，是否仍要继续下单？',
    confirmText: '继续下单',
    cancelText: '先返回',
    confirmColor: '#FF4D4F',
    success: (res) => {
      resolve(!!res.confirm)
    },
    fail: () => {
      resolve(false)
    },
  })
})

const handleSubmit = async () => {
  const warnings = getCartRiskWarnings()
  if (warnings.length > 0) {
    const confirmed = await confirmRiskWarnings(warnings)
    if (!confirmed) return
  }

  const order = await createOrderFromCart()
  if (!order) return
  showOrderSuccess.value = true
  progressWidth.value = 0
  // 模拟进度条动画
  const interval = setInterval(() => {
    progressWidth.value += 2
    if (progressWidth.value >= 100) {
      clearInterval(interval)
    }
  }, 30)
}

const closeOrderSuccess = () => {
  showOrderSuccess.value = false
  uni.switchTab({ url: '/pages/orders/orders' })
}

const goMenu = () => {
  uni.switchTab({ url: '/pages/menu/menu' })
}

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/menu/menu' })
  }
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

.status-bar {
  height: var(--status-bar-height, 44px);
  width: 100%;
  background: #FFFFFF;
}

/* 标题 */
.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  background: #FFFFFF;
  padding: 0 40rpx;
}

.back-btn,
.header-placeholder {
  width: 64rpx;
  height: 64rpx;
}

.back-btn {
  border-radius: 32rpx;
  background: #F2F3F5;
  display: flex;
  align-items: center;
  justify-content: center;
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

.cart-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #1D2129;
}

/* 购物车滚动区 */
.cart-scroll {
  flex: 1;
  overflow: hidden;
}

.cart-wrapper {
  padding: 32rpx 32rpx 240rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

/* 购物车项 */
.cart-item {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
  animation: fadeInUp 0.4s ease both;
  position: relative;
  transition: transform 0.3s ease;
}

.cart-item:active {
  transform: scale(0.98);
}

.ci-img {
  width: 128rpx;
  height: 128rpx;
  border-radius: 20rpx;
  background: #FFF7E6;
  overflow: hidden;
  flex-shrink: 0;
}

.ci-photo {
  width: 100%;
  height: 100%;
}

.ci-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.ci-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #1D2129;
}

.ci-options {
  font-size: 22rpx;
  color: #86909C;
}

.ci-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8rpx;
}

.ci-price {
  font-size: 28rpx;
  font-weight: bold;
  color: #FF4D4F;
}

.qty-ctrl {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.qty-btn-sm {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.qty-btn-sm.minus {
  background: #F2F3F5;
}

.qty-btn-sm.plus {
  background: #FF4D4F;
}

.qty-btn-sm:active {
  transform: scale(0.85);
}

.qty-btn-sm-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #4E5969;
}

.qty-btn-sm-text.white {
  color: #FFFFFF;
}

.qty-val {
  font-size: 26rpx;
  font-weight: bold;
  color: #1D2129;
  min-width: 30rpx;
  text-align: center;
}

.ci-delete {
  position: absolute;
  right: -8rpx;
  top: -8rpx;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FFF1F0;
  border-radius: 50%;
  opacity: 0.8;
  transition: all 0.2s ease;
}

.ci-delete:active {
  opacity: 1;
  transform: scale(1.1);
}

.ci-delete-icon {
  font-size: 24rpx;
}

/* 撒娇备注 */
.note-section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.note-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #1D2129;
}

.note-box {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 24rpx;
  min-height: 160rpx;
  border: 2rpx solid #E5E6EB;
}

.note-textarea {
  width: 100%;
  font-size: 24rpx;
  color: #4E5969;
  line-height: 1.6;
}

.list-spacer {
  height: 60rpx;
}

/* 空购物车 */
.empty-cart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 20rpx;
  padding-top: 200rpx;
}

.empty-emoji {
  font-size: 120rpx;
  animation: bounceIn 0.6s ease;
}

.empty-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #1D2129;
}

.empty-desc {
  font-size: 26rpx;
  color: #86909C;
}

.empty-btn {
  margin-top: 40rpx;
  padding: 24rpx 64rpx;
  background: #FF4D4F;
  border-radius: 40rpx;
  transition: transform 0.2s ease;
}

.empty-btn:active {
  transform: scale(0.95);
}

.empty-btn-text {
  color: #FFFFFF;
  font-size: 28rpx;
  font-weight: bold;
}

/* 底部结算 */
.cart-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #FFFFFF;
  padding: 32rpx 40rpx 72rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  box-shadow: 0 -8rpx 20rpx rgba(0, 0, 0, 0.04);
  z-index: 100;
  animation: slideUp 0.4s ease;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-count {
  font-size: 26rpx;
  color: #86909C;
}

.summary-price {
  font-size: 28rpx;
  font-weight: bold;
  color: #FF4D4F;
}

.submit-btn {
  height: 104rpx;
  background: #FF4D4F;
  border-radius: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  box-shadow: 0 12rpx 32rpx rgba(255, 77, 79, 0.25);
  transition: all 0.2s ease;
}

.submit-btn:active {
  transform: scale(0.97);
}

.submit-emoji {
  font-size: 36rpx;
}

.submit-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #FFFFFF;
}

/* 下单成功弹窗 */
.order-overlay {
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

.order-card {
  width: 620rpx;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 60rpx 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  animation: bounceIn 0.5s ease;
}

.order-emoji {
  font-size: 100rpx;
}

.order-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #1D2129;
}

.order-desc {
  font-size: 26rpx;
  color: #86909C;
  text-align: center;
}

.order-progress-bar {
  width: 100%;
  height: 12rpx;
  background: #F2F3F5;
  border-radius: 6rpx;
  overflow: hidden;
  margin: 20rpx 0;
}

.order-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF4D4F, #FF8C9A);
  border-radius: 6rpx;
  transition: width 0.1s linear;
}

.order-eta {
  font-size: 28rpx;
  font-weight: bold;
  color: #FF4D4F;
}

.order-btn {
  width: 100%;
  height: 88rpx;
  background: #FF4D4F;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20rpx;
  transition: transform 0.2s ease;
}

.order-btn:active {
  transform: scale(0.96);
}

.order-btn-text {
  font-size: 30rpx;
  font-weight: bold;
  color: #FFFFFF;
}
</style>
