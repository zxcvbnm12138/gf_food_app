<template>
  <view class="page">
    <!-- 状态栏 -->
    <view class="status-bar"></view>

    <!-- 顶部搜索栏 -->
    <view class="top-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">←</text>
      </view>
      <view class="search-box" @click="toggleSearch">
        <text class="search-icon">🔍</text>
        <input
          v-if="searchActive"
          class="search-input"
          v-model="searchText"
          placeholder="搜索美食..."
          focus
          @blur="onSearchBlur"
        />
        <text v-else class="search-placeholder">想吃点什么？</text>
      </view>
    </view>

    <!-- 主体内容 -->
    <view class="body">
      <!-- 左侧分类栏 -->
      <scroll-view class="sidebar" scroll-y :enhanced="true" :show-scrollbar="false">
        <view
          v-for="(cat, index) in sideCategories"
          :key="cat.id"
          class="side-cat"
          :class="{ active: activeCatIndex === index }"
          @click="selectCategory(index)"
        >
          <text class="side-cat-text" :class="{ active: activeCatIndex === index }">{{ cat.name }}</text>
          <text class="side-cat-count" :class="{ active: activeCatIndex === index }">{{ cat.count }}道</text>
        </view>
      </scroll-view>

      <!-- 右侧菜单列表 -->
      <scroll-view class="right-content" scroll-y :enhanced="true" :show-scrollbar="false">
        <view class="right-inner">
          <text class="list-title">{{ currentCategoryTitle }}</text>
          
          <view
            v-for="(item, index) in filteredItems"
            :key="item._id || item.id"
            class="menu-item"
            :style="{ animationDelay: (index * 0.06) + 's' }"
            @click="goDetail(item._id || item.id)"
          >
            <view class="mi-img">
              <image class="mi-photo" :src="item.image" mode="aspectFill" />
            </view>
            <view class="mi-info">
              <text class="mi-name">{{ item.name }}</text>
              <text class="mi-desc">{{ getBriefDesc(item) }}</text>
              <view class="mi-bottom">
                <text class="mi-price">❤️ {{ item.price }}</text>
                <view class="mi-add-btn" @click.stop="quickAdd(item)">
                  <text class="mi-add-icon">+</text>
                </view>
              </view>
            </view>
          </view>

          <view v-if="filteredItems.length === 0" class="empty-tip">
            <text class="empty-emoji">🍽️</text>
            <text class="empty-text">暂无此分类的美食哦</text>
          </view>

          <view class="list-bottom-spacer"></view>
        </view>
      </scroll-view>
    </view>

    <!-- 底部购物车栏 -->
    <view class="cart-bar" v-if="cartTotal > 0" @click="goCart">
      <view class="cart-left">
        <text class="cart-emoji">🛍️</text>
        <text class="cart-count">已选 {{ cartTotal }} 件</text>
      </view>
      <view class="checkout-btn">
        <text class="checkout-text">去撒娇</text>
      </view>
    </view>

    <!-- 加入动画提示 -->
    <view class="add-toast" v-if="showAddToast" :class="{ 'toast-show': showAddToast }">
      <text class="add-toast-text">✨ 已加入清单！</text>
    </view>

    <TabBar :current="1" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow, onHide } from '@dcloudio/uni-app'
import store, {
  addToCart,
  getCartTotal,
  loadMenuFromCloud,
  getAvailableItems,
  startMenuRealtimeSync,
  stopMenuRealtimeSync,
  consumePendingMenuCategory,
} from '@/store/index.js'
import TabBar from '@/components/TabBar.vue'

const searchActive = ref(false)
const searchText = ref('')
const activeCatIndex = ref(0)
const showAddToast = ref(false)
const MENU_REALTIME_OWNER = 'customer-menu'

// 只显示上架的菜品
const menuItems = computed(() => getAvailableItems())
const sideCategories = computed(() => store.sideCategories.map(cat => ({
  ...cat,
  count: cat.id === 'all'
    ? menuItems.value.length
    : menuItems.value.filter(item => item.category === cat.id).length,
})))

const cartTotal = computed(() => getCartTotal())
const getBriefDesc = (item) => item.desc || ''

// 菜品轮询刷新
let menuPollTimer = null
const MENU_POLL_INTERVAL = 5000 // 实时监听失败时，5秒轮询兜底

const refreshMenu = async () => {
  await loadMenuFromCloud()
}

const selectCategoryById = (categoryId) => {
  const targetId = categoryId || 'all'
  const index = sideCategories.value.findIndex(cat => cat.id === targetId)
  activeCatIndex.value = index >= 0 ? index : 0
}

const applyPendingCategory = () => {
  const pendingCategoryId = consumePendingMenuCategory()
  if (pendingCategoryId) {
    selectCategoryById(pendingCategoryId)
  }
}

onLoad((options = {}) => {
  if (options.category) {
    selectCategoryById(options.category)
  }
})

// onShow: 每次页面可见时立即刷新 + 启动轮询
onShow(() => {
  applyPendingCategory()
  refreshMenu()
  startMenuRealtimeSync(MENU_REALTIME_OWNER)
  if (!menuPollTimer) {
    menuPollTimer = setInterval(refreshMenu, MENU_POLL_INTERVAL)
  }
})

// onHide: 页面不可见时停止轮询
onHide(() => {
  stopMenuRealtimeSync(MENU_REALTIME_OWNER)
  if (menuPollTimer) {
    clearInterval(menuPollTimer)
    menuPollTimer = null
  }
})

const currentCategoryTitle = computed(() => {
  return sideCategories.value[activeCatIndex.value]?.name || '全部菜品'
})

const filteredItems = computed(() => {
  let items = menuItems.value
  const catKey = sideCategories.value[activeCatIndex.value]?.id
  
  if (catKey && catKey !== 'all') {
    items = items.filter(item => item.category === catKey)
  }

  if (searchText.value.trim()) {
    const keyword = searchText.value.trim().toLowerCase()
    items = items.filter(item =>
      item.name.toLowerCase().includes(keyword) ||
      getBriefDesc(item).toLowerCase().includes(keyword)
    )
  }
  
  return items
})

const selectCategory = (index) => {
  activeCatIndex.value = index
}

const toggleSearch = () => {
  searchActive.value = true
}

const onSearchBlur = () => {
  if (!searchText.value.trim()) {
    searchActive.value = false
  }
}

const quickAdd = (item) => {
  addToCart(item, {
    sweet: item.sweetOptions?.[0] || '',
    extras: item.extraOptions?.[0] ? [item.extraOptions[0]] : [],
  })
  showAddToast.value = true
  setTimeout(() => {
    showAddToast.value = false
  }, 1500)
}

const goDetail = (id) => {
  uni.navigateTo({
    url: `/pages/detail/detail?id=${id}`,
  })
}

const goCart = () => {
  uni.navigateTo({
    url: '/pages/cart/cart',
  })
}

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/index/index' })
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

/* 顶部搜索 */
.top-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 16rpx 32rpx 8rpx;
  height: 112rpx;
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

.search-box {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: #F2F3F5;
  border-radius: 36rpx;
  height: 72rpx;
  padding: 0 24rpx;
  flex: 1;
  transition: all 0.3s ease;
}

.search-icon {
  font-size: 28rpx;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1D2129;
  height: 72rpx;
}

.search-placeholder {
  font-size: 26rpx;
  color: #86909C;
}

/* 主体 */
.body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧边栏 */
.sidebar {
  width: 172rpx;
  background: #F2F3F5;
  height: 100%;
}

.side-cat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 6rpx;
  height: 104rpx;
  padding: 0 0 0 20rpx;
  transition: all 0.25s ease;
  position: relative;
}

.side-cat.active {
  background: #FFFFFF;
}

.side-cat.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6rpx;
  height: 36rpx;
  background: #FF4D4F;
  border-radius: 0 3rpx 3rpx 0;
}

.side-cat-text {
  font-size: 26rpx;
  color: #4E5969;
  transition: all 0.25s ease;
}

.side-cat-text.active {
  color: #1D2129;
  font-weight: bold;
}

.side-cat-count {
  font-size: 20rpx;
  color: #86909C;
  line-height: 1;
  transition: all 0.25s ease;
}

.side-cat-count.active {
  color: #FF4D4F;
  font-weight: bold;
}

/* 右侧内容 */
.right-content {
  flex: 1;
  background: #FFFFFF;
  height: 100%;
}

.right-inner {
  padding: 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

.list-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #1D2129;
}

.menu-item {
  display: flex;
  gap: 24rpx;
  animation: fadeInUp 0.4s ease both;
  transition: transform 0.2s ease;
}

.menu-item:active {
  transform: scale(0.98);
}

.mi-img {
  width: 160rpx;
  height: 160rpx;
  border-radius: 20rpx;
  background: #FFF7E6;
  overflow: hidden;
  flex-shrink: 0;
}

.mi-photo {
  width: 100%;
  height: 100%;
  transition: transform 0.3s ease;
}

.menu-item:active .mi-photo {
  transform: scale(1.08);
}

.mi-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 160rpx;
}

.mi-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #1D2129;
}

.mi-desc {
  font-size: 22rpx;
  color: #86909C;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
  line-height: 1.4;
}

.mi-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mi-price {
  font-size: 28rpx;
  font-weight: bold;
  color: #FF4D4F;
}

.mi-add-btn {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #FF4D4F;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.mi-add-btn:active {
  transform: scale(0.85);
  background: #D9363E;
}

.mi-add-icon {
  width: 48rpx;
  height: 48rpx;
  display: block;
  font-size: 32rpx;
  line-height: 44rpx;
  text-align: center;
  color: #FFFFFF;
  font-weight: bold;
}

/* 空提示 */
.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  padding: 80rpx 0;
}

.empty-emoji {
  font-size: 80rpx;
}

.empty-text {
  font-size: 26rpx;
  color: #86909C;
}

/* 底部购物车栏 */
.cart-bar {
  position: fixed;
  bottom: 154rpx;
  left: 32rpx;
  right: 32rpx;
  height: 104rpx;
  background: #1D2129;
  border-radius: 52rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8rpx 0 32rpx;
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.18);
  z-index: 100;
  animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.cart-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.cart-emoji {
  font-size: 44rpx;
}

.cart-count {
  font-size: 28rpx;
  font-weight: bold;
  color: #FFFFFF;
}

.checkout-btn {
  height: 88rpx;
  padding: 0 40rpx;
  background: #FF4D4F;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.checkout-btn:active {
  transform: scale(0.95);
}

.checkout-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #FFFFFF;
}

/* 添加提示Toast */
.add-toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.75);
  padding: 24rpx 40rpx;
  border-radius: 20rpx;
  z-index: 999;
  animation: bounceIn 0.4s ease;
}

.add-toast-text {
  color: #FFFFFF;
  font-size: 28rpx;
  font-weight: bold;
}

.list-bottom-spacer {
  height: 320rpx;
}
</style>
