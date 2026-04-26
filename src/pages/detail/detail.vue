<template>
  <view class="page">
    <!-- Hero 图片区域 -->
    <view
      class="hero-area"
      :class="{ dragging: isHeroDragging }"
      :style="heroAreaStyle"
      @touchstart="startHeroDrag"
      @touchmove.stop.prevent="moveHeroDrag"
      @touchend="endHeroDrag"
      @touchcancel="endHeroDrag"
    >
      <view class="hero-bg">
        <image class="hero-photo" :src="item.image" mode="aspectFit" />
      </view>
      <!-- 返回按钮 -->
      <view class="back-btn" @click="goBack">
        <text class="back-icon">←</text>
      </view>
      <!-- 收藏按钮 -->
      <view class="fav-btn" @click="toggleFav">
        <text class="fav-icon">{{ isFav ? '❤️' : '🤍' }}</text>
      </view>
    </view>

    <!-- 详情卡片 -->
    <scroll-view class="detail-scroll" scroll-y :enhanced="true" :show-scrollbar="false">
      <view class="detail-card">
        <view
          class="detail-drag-handle"
          @touchstart="startHeroDrag"
          @touchmove.stop.prevent="moveHeroDrag"
          @touchend="endHeroDrag"
          @touchcancel="endHeroDrag"
        ></view>
        <!-- 标题行 -->
        <view class="title-row">
          <text class="item-name">{{ item.name }}</text>
          <text class="item-price">❤️ {{ item.price }}</text>
        </view>

        <!-- 描述 -->
        <text class="item-desc">{{ item.fullDesc }}</text>

        <!-- 甜度选择 -->
        <view class="option-section" v-if="item.sweetOptions && item.sweetOptions.length > 0">
          <text class="option-label">甜度选择</text>
          <view class="option-row">
            <view
              v-for="(opt, i) in item.sweetOptions"
              :key="'s' + i"
              class="option-chip"
              :class="{ active: selectedSweet === i }"
              @click="selectSweet(i)"
            >
              <text class="option-text" :class="{ active: selectedSweet === i }">{{ opt }}</text>
            </view>
          </view>
        </view>

        <!-- 加料选择 -->
        <view class="option-section" v-if="item.extraOptions && item.extraOptions.length > 0">
          <text class="option-label">加料选择</text>
          <view class="option-row">
            <view
              v-for="(opt, i) in item.extraOptions"
              :key="'e' + i"
              class="option-chip"
              :class="{ active: selectedExtras.includes(i) }"
              @click="toggleExtra(i)"
            >
              <text class="option-text" :class="{ active: selectedExtras.includes(i) }">{{ opt }}</text>
            </view>
          </view>
        </view>

        <!-- 撒娇备注 -->
        <view class="note-section">
          <text class="option-label">撒娇备注</text>
          <view class="note-input-wrap">
            <textarea
              class="note-input"
              v-model="noteText"
              placeholder="比如：多放点草莓，要亲手喂我吃..."
              maxlength="200"
              :auto-height="true"
            />
          </view>
        </view>

        <view class="detail-bottom-spacer"></view>
      </view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="bottom-action">
      <view class="qty-group">
        <view class="qty-btn minus" @click="changeQty(-1)">
          <text class="qty-btn-text">-</text>
        </view>
        <text class="qty-num">{{ quantity }}</text>
        <view class="qty-btn plus" @click="changeQty(1)">
          <text class="qty-btn-text white">+</text>
        </view>
      </view>
      <view class="add-cart-btn" @click="handleAddToCart">
        <text class="add-cart-text">加入投喂清单</text>
      </view>
    </view>

    <!-- 加入成功动画 -->
    <view class="success-overlay" v-if="showSuccess">
      <view class="success-card">
        <text class="success-emoji">🎉</text>
        <text class="success-text">已加入投喂清单！</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import store, { addToCart } from '@/store/index.js'

const itemId = ref(1)
const quantity = ref(1)
const selectedSweet = ref(0)
const selectedExtras = ref([0])
const noteText = ref('')
const isFav = ref(false)
const showSuccess = ref(false)
const isHeroDragging = ref(false)
const heroHeight = ref(500)
const touchStartY = ref(0)
const touchStartHeight = ref(500)
const pxToRpxRatio = ref(2)

const HERO_MIN_HEIGHT = 500
const HERO_MAX_HEIGHT = 750

const item = computed(() => {
  return store.menuItems.find(m => m.id === itemId.value) || store.menuItems[0]
})

const heroAreaStyle = computed(() => {
  return {
    height: `${heroHeight.value}rpx`,
  }
})

// 页面加载时获取参数
onMounted(() => {
  try {
    const systemInfo = uni.getSystemInfoSync()
    if (systemInfo.windowWidth) {
      pxToRpxRatio.value = 750 / systemInfo.windowWidth
    }
  } catch (error) {
    pxToRpxRatio.value = 2
  }

  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  // #ifdef H5
  const url = window.location.href
  const match = url.match(/[?&]id=(\d+)/)
  if (match) {
    itemId.value = parseInt(match[1])
  }
  // #endif
  // #ifndef H5
  if (currentPage && currentPage.$page && currentPage.$page.options) {
    const opts = currentPage.$page.options
    if (opts.id) itemId.value = parseInt(opts.id)
  } else if (currentPage && currentPage.options) {
    const opts = currentPage.options
    if (opts.id) itemId.value = parseInt(opts.id)
  }
  // #endif
})

const selectSweet = (index) => {
  selectedSweet.value = index
}

const toggleExtra = (index) => {
  const i = selectedExtras.value.indexOf(index)
  if (i >= 0) {
    selectedExtras.value.splice(i, 1)
  } else {
    selectedExtras.value.push(index)
  }
}

const changeQty = (delta) => {
  const next = quantity.value + delta
  if (next >= 1 && next <= 99) {
    quantity.value = next
  }
}

const clampHeroHeight = (height) => {
  return Math.max(HERO_MIN_HEIGHT, Math.min(HERO_MAX_HEIGHT, height))
}

const getTouchY = (event) => {
  const touch = event.touches?.[0] || event.changedTouches?.[0]
  return touch?.clientY || 0
}

const startHeroDrag = (event) => {
  isHeroDragging.value = true
  touchStartY.value = getTouchY(event)
  touchStartHeight.value = heroHeight.value
}

const moveHeroDrag = (event) => {
  if (!isHeroDragging.value) return
  const deltaPx = getTouchY(event) - touchStartY.value
  const deltaRpx = deltaPx * pxToRpxRatio.value
  heroHeight.value = clampHeroHeight(touchStartHeight.value + deltaRpx)
}

const endHeroDrag = () => {
  if (!isHeroDragging.value) return
  isHeroDragging.value = false
  const midpoint = HERO_MIN_HEIGHT + ((HERO_MAX_HEIGHT - HERO_MIN_HEIGHT) / 2)
  heroHeight.value = heroHeight.value >= midpoint ? HERO_MAX_HEIGHT : HERO_MIN_HEIGHT
}

const toggleFav = () => {
  isFav.value = !isFav.value
  uni.showToast({
    title: isFav.value ? '已收藏 ❤️' : '已取消收藏',
    icon: 'none',
    duration: 1200,
  })
}

const handleAddToCart = () => {
  const sweetName = item.value.sweetOptions?.[selectedSweet.value] || ''
  const extraNames = selectedExtras.value.map(i => item.value.extraOptions?.[i] || '').filter(Boolean)

  for (let i = 0; i < quantity.value; i++) {
    addToCart(item.value, {
      sweet: sweetName,
      extras: extraNames,
      note: noteText.value,
    })
  }

  showSuccess.value = true
  setTimeout(() => {
    showSuccess.value = false
    uni.navigateBack()
  }, 1200)
}

const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.page {
  position: relative;
  height: 100vh;
  background: #F7F8FA;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Hero 区域 */
.hero-area {
  position: relative;
  width: 100%;
  flex-shrink: 0;
  transition: height 0.25s ease;
}

.hero-area.dragging {
  transition: none;
}

.hero-bg {
  width: 100%;
  height: 100%;
  background: #FFF7E6;
  overflow: hidden;
}

.hero-photo {
  width: 100%;
  height: 100%;
  display: block;
  animation: bounceIn 0.6s ease;
}

.back-btn {
  position: absolute;
  left: 32rpx;
  top: calc(var(--status-bar-height, 44px) + 8rpx);
  width: 72rpx;
  height: 72rpx;
  border-radius: 36rpx;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.back-btn:active {
  transform: scale(0.9);
}

.back-icon {
  font-size: 36rpx;
  color: #FFFFFF;
}

.fav-btn {
  position: absolute;
  right: 32rpx;
  top: calc(var(--status-bar-height, 44px) + 8rpx);
  width: 72rpx;
  height: 72rpx;
  border-radius: 36rpx;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.fav-btn:active {
  transform: scale(0.85);
}

.fav-icon {
  font-size: 32rpx;
}

/* 详情卡片 */
.detail-scroll {
  flex: 1;
  margin-top: 0;
  position: relative;
  z-index: 10;
  overflow: hidden;
}

.detail-card {
  background: #FFFFFF;
  border-radius: 36rpx 36rpx 0 0;
  padding: 24rpx 40rpx 200rpx;
  display: flex;
  flex-direction: column;
  gap: 40rpx;
  box-shadow: 0 -16rpx 40rpx rgba(0, 0, 0, 0.04);
  animation: slideUp 0.4s ease;
}

.detail-drag-handle {
  width: 96rpx;
  height: 10rpx;
  border-radius: 5rpx;
  background: #E5E6EB;
  align-self: center;
  margin-bottom: -8rpx;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-name {
  font-size: 44rpx;
  font-weight: bold;
  color: #1D2129;
}

.item-price {
  font-size: 36rpx;
  font-weight: bold;
  color: #FF4D4F;
}

.item-desc {
  font-size: 26rpx;
  color: #86909C;
  line-height: 1.7;
}

/* 选项区域 */
.option-section {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.option-label {
  font-size: 30rpx;
  font-weight: bold;
  color: #1D2129;
}

.option-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.option-chip {
  padding: 16rpx 32rpx;
  border-radius: 40rpx;
  background: #F7F8FA;
  transition: all 0.25s ease;
}

.option-chip.active {
  background: #FF4D4F;
  transform: scale(1.02);
}

.option-chip:active {
  transform: scale(0.95);
}

.option-text {
  font-size: 24rpx;
  color: #4E5969;
  transition: color 0.25s ease;
}

.option-text.active {
  color: #FFFFFF;
  font-weight: bold;
}

/* 备注 */
.note-section {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.note-input-wrap {
  background: #F7F8FA;
  border-radius: 24rpx;
  padding: 24rpx;
  min-height: 144rpx;
}

.note-input {
  width: 100%;
  font-size: 24rpx;
  color: #4E5969;
  line-height: 1.6;
}

.detail-bottom-spacer {
  height: 40rpx;
}

/* 底部操作 */
.bottom-action {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx 40rpx 64rpx;
  background: #FFFFFF;
  box-shadow: 0 -8rpx 20rpx rgba(0, 0, 0, 0.04);
  z-index: 100;
  animation: slideUp 0.4s ease 0.2s both;
}

.qty-group {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.qty-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.qty-btn.minus {
  background: #F2F3F5;
}

.qty-btn.plus {
  background: #FF4D4F;
}

.qty-btn:active {
  transform: scale(0.85);
}

.qty-btn-text {
  font-size: 36rpx;
  font-weight: bold;
  color: #4E5969;
}

.qty-btn-text.white {
  color: #FFFFFF;
}

.qty-num {
  font-size: 32rpx;
  font-weight: bold;
  color: #1D2129;
  min-width: 40rpx;
  text-align: center;
}

.add-cart-btn {
  flex: 1;
  height: 96rpx;
  background: #FF4D4F;
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 32rpx rgba(255, 77, 79, 0.25);
  transition: all 0.2s ease;
}

.add-cart-btn:active {
  transform: scale(0.96);
  box-shadow: 0 6rpx 16rpx rgba(255, 77, 79, 0.35);
}

.add-cart-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #FFFFFF;
}

/* 成功弹出 */
.success-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  animation: fadeIn 0.2s ease;
}

.success-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 60rpx 80rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  animation: bounceIn 0.5s ease;
}

.success-emoji {
  font-size: 100rpx;
}

.success-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #1D2129;
}
</style>
