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
            <text class="greeting-main love-poem">{{ dailyLovePoem.text }}</text>
            <text class="poem-source">--{{ dailyLovePoem.source }}</text>
            <view v-if="roomId" class="room-badge-home" @click="copyRoomId">
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

        <!-- 专属投喂洞察 -->
        <view class="insights-section anim-item" :style="{ animationDelay: '0.1s' }">
          <view class="insights-header">
            <view class="insights-title-wrap">
              <text class="section-title">专属投喂洞察</text>
              <text class="insights-subtitle">{{ favoriteInsightText }}</text>
            </view>
            <view class="insights-pill">
              <text class="insights-pill-text">{{ insightScopeLabel }}</text>
            </view>
          </view>

          <view class="favorite-chart-card">
            <view class="favorite-chart-head">
              <view class="favorite-chart-copy">
                <text class="chart-kicker">最近最爱</text>
                <text class="favorite-main-name">{{ topFavoriteItem ? topFavoriteItem.name : '等她点第一单' }}</text>
              </view>
              <view class="favorite-avatar">
                <image
                  v-if="topFavoriteItem && topFavoriteItem.image"
                  class="favorite-avatar-img"
                  :src="topFavoriteItem.image"
                  mode="aspectFill"
                />
                <text v-else class="favorite-avatar-emoji">{{ topFavoriteItem ? topFavoriteItem.emoji : '🍽️' }}</text>
              </view>
            </view>

            <view v-if="favoriteChartRows.length > 0" class="favorite-bars">
              <view v-for="row in favoriteChartRows" :key="row.id" class="favorite-bar-row">
                <view class="favorite-bar-meta">
                  <text class="favorite-bar-name">{{ row.emoji }} {{ row.name }}</text>
                  <text class="favorite-bar-count">{{ formatFavoriteCount(row) }}</text>
                </view>
                <view class="favorite-bar-track">
                  <view class="favorite-bar-fill" :style="{ width: getFavoritePercent(row) + '%' }"></view>
                </view>
              </view>
            </view>
            <view v-else class="favorite-empty">
              <text class="favorite-empty-text">投喂一次后，这里会长出她的口味小报告</text>
            </view>
          </view>

          <view class="insight-grid">
            <view class="mini-insight-card">
              <view class="mini-card-head">
                <text class="chart-kicker">饭点时钟</text>
                <text class="mini-card-icon">🕘</text>
              </view>
              <text class="mini-card-title">{{ mealInsightTitle }}</text>
              <text class="mini-card-desc">{{ mealInsightDesc }}</text>
              <view class="meal-bars">
                <view v-for="slot in mealSlotStats" :key="slot.key" class="meal-bar-item">
                  <view class="meal-bar-track">
                    <view
                      class="meal-bar-fill"
                      :class="{ empty: slot.count === 0 }"
                      :style="{ height: slot.percent + '%', background: slot.count > 0 ? slot.color : '#E5E6EB' }"
                    ></view>
                  </view>
                  <text class="meal-bar-label" :class="{ active: slot.isTop }">{{ slot.short }}</text>
                </view>
              </view>
            </view>

            <view class="mini-insight-card safe-card" @click="goProfile">
              <view class="mini-card-head">
                <text class="chart-kicker">安心避雷</text>
                <text class="mini-card-icon">🛡️</text>
              </view>
              <text class="mini-card-title">{{ cautionInsightTitle }}</text>
              <text class="mini-card-desc">{{ cautionInsightDesc }}</text>
              <view v-if="cautionPreviewTags.length > 0" class="caution-tags">
                <view
                  v-for="tag in cautionPreviewTags"
                  :key="tag.type + '-' + tag.label"
                  class="caution-tag"
                  :class="tag.type"
                >
                  <text class="caution-tag-text">{{ tag.label }}</text>
                </view>
                <view v-if="cautionMoreCount > 0" class="caution-tag more">
                  <text class="caution-tag-text">+{{ cautionMoreCount }}</text>
                </view>
              </view>
              <view v-else class="caution-empty">
                <text class="caution-empty-text">还没有设置忌口</text>
              </view>
            </view>
          </view>
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
  loadMenuSnapshotFromCloud,
  getAvailableItems,
  loadOrdersFromCloud,
  getCurrentRoomOrders,
  getCurrentRoomFavoriteIds,
  loadCurrentRoomUserPreferences,
  startMenuRealtimeSync,
  stopMenuRealtimeSync,
  setPendingMenuCategory,
} from '@/store/index.js'
import { checkLogin } from '@/services/cloud.js'
import TabBar from '@/components/TabBar.vue'
import { getDailyLovePoem } from '@/utils/lovePoems.js'

const categories = computed(() => store.categories.slice(0, 5))
const menuItems = computed(() => getAvailableItems())
const user = computed(() => store.user)
const roomId = computed(() => store.roomId)
const MENU_REALTIME_OWNER = 'customer-index'
const getDisplayDesc = (item) => item.fullDesc || item.desc || ''
const dailyLovePoem = computed(() => getDailyLovePoem())
const FAVORITE_LOOKBACK_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
const mealSlots = [
  { key: 'late', label: '深夜', short: '夜', range: '00:00-05:59', start: 0, end: 5, color: '#7B61FF' },
  { key: 'morning', label: '上午', short: '早', range: '06:00-10:59', start: 6, end: 10, color: '#FFB020' },
  { key: 'noon', label: '中午', short: '午', range: '11:00-13:59', start: 11, end: 13, color: '#FF4D4F' },
  { key: 'afternoon', label: '下午', short: '茶', range: '14:00-17:59', start: 14, end: 17, color: '#14C9C9' },
  { key: 'evening', label: '晚上', short: '晚', range: '18:00-23:59', start: 18, end: 23, color: '#4080FF' },
]

// 菜品轮询刷新
let menuPollTimer = null
let ordersPollTimer = null
const MENU_FALLBACK_POLL_INTERVAL = 60 * 1000 // 实时监听主同步，低频轮询只做兜底
const INSIGHTS_POLL_INTERVAL = 60 * 1000

const refreshMenu = async () => {
  await loadMenuSnapshotFromCloud()
}

const refreshInsights = async () => {
  try {
    await Promise.all([
      loadOrdersFromCloud(),
      loadCurrentRoomUserPreferences(),
    ])
  } catch (e) {
    console.warn('[CustomerIndex] 刷新投喂洞察失败', e)
  }
}

const refreshInsightOrders = async () => {
  try {
    await loadOrdersFromCloud()
  } catch (e) {
    console.warn('[CustomerIndex] 刷新订单洞察失败', e)
  }
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
  refreshInsights()
  startMenuRealtimeSync(MENU_REALTIME_OWNER)
  if (!menuPollTimer) {
    menuPollTimer = setInterval(refreshMenu, MENU_FALLBACK_POLL_INTERVAL)
  }
  if (!ordersPollTimer) {
    ordersPollTimer = setInterval(refreshInsightOrders, INSIGHTS_POLL_INTERVAL)
  }
})

// 页面隐藏时停止轮询
onHide(() => {
  stopMenuRealtimeSync(MENU_REALTIME_OWNER)
  if (menuPollTimer) {
    clearInterval(menuPollTimer)
    menuPollTimer = null
  }
  if (ordersPollTimer) {
    clearInterval(ordersPollTimer)
    ordersPollTimer = null
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

const normalizeText = (value) => String(value || '').trim()

const normalizeTagList = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean)
  }
  const text = normalizeText(value)
  if (!text || text === '无') return []
  return text.split(/[,，、;；\n\r]+/).map(normalizeText).filter(Boolean)
}

const getMenuItemId = (item) => normalizeText(item?._id || item?.id || item?.name)

const findMenuItemById = (id) => {
  const normalizedId = normalizeText(id)
  if (!normalizedId) return null
  return menuItems.value.find((item) => {
    return normalizeText(item?._id) === normalizedId || normalizeText(item?.id) === normalizedId
  }) || null
}

const allOrders = computed(() => {
  return [...getCurrentRoomOrders()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

const recentOrders = computed(() => {
  const threshold = Date.now() - FAVORITE_LOOKBACK_DAYS * DAY_MS
  return allOrders.value.filter((order) => {
    const time = new Date(order.createdAt).getTime()
    return Number.isFinite(time) && time >= threshold
  })
})

const insightOrders = computed(() => {
  return recentOrders.value.length > 0 ? recentOrders.value : allOrders.value
})

const insightScopeLabel = computed(() => {
  if (recentOrders.value.length > 0) return '近30天'
  if (allOrders.value.length > 0) return '全部记录'
  if (getCurrentRoomFavoriteIds().length > 0) return '收藏兜底'
  return '待记录'
})

const favoriteChartRows = computed(() => {
  const counts = new Map()

  insightOrders.value.forEach((order) => {
    ;(Array.isArray(order.items) ? order.items : []).forEach((item) => {
      const id = getMenuItemId(item)
      if (!id) return
      const menuItem = findMenuItemById(id)
      const previous = counts.get(id)
      const qty = Math.max(1, Number(item.qty) || 1)
      counts.set(id, {
        id,
        name: item.name || menuItem?.name || '秘密料理',
        emoji: item.emoji || menuItem?.emoji || '🍽️',
        image: item.image || menuItem?.image || '',
        count: (previous?.count || 0) + qty,
        source: 'orders',
      })
    })
  })

  const orderRows = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  if (orderRows.length > 0) return orderRows

  return getCurrentRoomFavoriteIds()
    .map(findMenuItemById)
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => ({
      id: getMenuItemId(item),
      name: item.name,
      emoji: item.emoji || '🍽️',
      image: item.image || '',
      count: 1,
      source: 'favorites',
    }))
})

const topFavoriteItem = computed(() => favoriteChartRows.value[0] || null)

const maxFavoriteCount = computed(() => {
  return Math.max(1, ...favoriteChartRows.value.map((row) => row.count))
})

const getFavoritePercent = (row) => {
  return Math.max(16, Math.round((row.count / maxFavoriteCount.value) * 100))
}

const formatFavoriteCount = (row) => {
  return row.source === 'favorites' ? '已收藏' : `${row.count} 次`
}

const favoriteInsightText = computed(() => {
  const top = topFavoriteItem.value
  if (!top) return '先点一单，就会长出小报告'
  if (top.source === 'favorites') return `收藏里最想吃：${top.name}`
  return `最近最馋：${top.name}`
})

const mealSlotStats = computed(() => {
  const slotRows = mealSlots.map((slot) => ({ ...slot, count: 0 }))

  insightOrders.value.forEach((order) => {
    const date = new Date(order.createdAt)
    const hour = date.getHours()
    if (!Number.isFinite(hour)) return
    const slot = slotRows.find((item) => hour >= item.start && hour <= item.end)
    if (slot) slot.count += 1
  })

  const maxCount = Math.max(0, ...slotRows.map((slot) => slot.count))
  const topSlot = maxCount > 0 ? slotRows.find((slot) => slot.count === maxCount) : null

  return slotRows.map((slot) => ({
    ...slot,
    percent: maxCount > 0 ? Math.max(18, Math.round((slot.count / maxCount) * 100)) : 0,
    isTop: !!topSlot && slot.key === topSlot.key,
  }))
})

const topMealSlot = computed(() => mealSlotStats.value.find((slot) => slot.isTop) || null)

const mealInsightTitle = computed(() => {
  return topMealSlot.value ? `${topMealSlot.value.label}最常见` : '还没看出饭点'
})

const mealInsightDesc = computed(() => {
  return topMealSlot.value ? `${topMealSlot.value.range} 最容易被投喂` : '下单后会自动统计'
})

const cautionTags = computed(() => {
  const seen = new Set()
  const tags = []
  const pushTag = (label, type) => {
    const key = `${type}:${label}`
    if (!label || seen.has(key)) return
    seen.add(key)
    tags.push({ label, type })
  }

  normalizeTagList(user.value.dislikes).forEach((tag) => pushTag(tag, 'dislike'))
  normalizeTagList(user.value.allergies).forEach((tag) => pushTag(tag, 'allergy'))
  return tags
})

const cautionPreviewTags = computed(() => cautionTags.value.slice(0, 4))
const cautionMoreCount = computed(() => Math.max(0, cautionTags.value.length - cautionPreviewTags.value.length))

const cautionInsightTitle = computed(() => {
  return cautionTags.value.length > 0 ? `已记住 ${cautionTags.value.length} 个小雷区` : '还没有设置忌口'
})

const cautionInsightDesc = computed(() => {
  return cautionTags.value.length > 0 ? '点单前会自动提醒主厨' : '可以在个人页补上'
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

const copyRoomId = () => {
  if (!roomId.value) return
  uni.setClipboardData({
    data: roomId.value,
    success: () => {
      uni.showToast({ title: '已复制房号', icon: 'none' })
    },
  })
}

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
  gap: 24rpx;
}

.hd-left {
  flex: 1;
  min-width: 0;
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

.love-poem {
  font-size: 38rpx;
  line-height: 1.35;
  white-space: nowrap;
}

.poem-source {
  font-size: 30rpx;
  color: #86909C;
  line-height: 1.4;
}

.avatar-wrap {
  position: relative;
  margin-right: 180rpx;
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

/* 投喂洞察 */
.insights-section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.insights-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
}

.insights-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.insights-subtitle {
  font-size: 24rpx;
  color: #86909C;
  line-height: 1.35;
}

.insights-pill {
  flex-shrink: 0;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: #FFF1F0;
}

.insights-pill-text {
  font-size: 22rpx;
  color: #FF4D4F;
  font-weight: bold;
}

.favorite-chart-card,
.mini-insight-card {
  background: #FFFFFF;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.favorite-chart-card {
  padding: 28rpx;
  border-radius: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.favorite-chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}

.favorite-chart-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.chart-kicker {
  font-size: 22rpx;
  color: #86909C;
  font-weight: bold;
}

.favorite-main-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #1D2129;
  line-height: 1.25;
}

.favorite-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 28rpx;
  background: #FFF7E6;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.favorite-avatar-img {
  width: 100%;
  height: 100%;
}

.favorite-avatar-emoji {
  font-size: 48rpx;
}

.favorite-bars {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.favorite-bar-row {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.favorite-bar-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.favorite-bar-name {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: #4E5969;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-bar-count {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #FF4D4F;
  font-weight: bold;
}

.favorite-bar-track {
  height: 14rpx;
  border-radius: 999rpx;
  background: #F2F3F5;
  overflow: hidden;
}

.favorite-bar-fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #FF4D4F 0%, #FFB2BE 100%);
  transition: width 0.35s ease;
}

.favorite-empty {
  min-height: 86rpx;
  border-radius: 20rpx;
  background: #F7F8FA;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24rpx;
}

.favorite-empty-text {
  font-size: 24rpx;
  color: #86909C;
  text-align: center;
  line-height: 1.4;
}

.insight-grid {
  display: flex;
  gap: 20rpx;
}

.mini-insight-card {
  flex: 1;
  min-width: 0;
  min-height: 280rpx;
  border-radius: 28rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  transition: transform 0.2s ease;
}

.mini-insight-card:active {
  transform: scale(0.98);
}

.mini-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.mini-card-icon {
  font-size: 30rpx;
}

.mini-card-title {
  font-size: 28rpx;
  color: #1D2129;
  font-weight: bold;
  line-height: 1.3;
}

.mini-card-desc {
  min-height: 64rpx;
  font-size: 22rpx;
  color: #86909C;
  line-height: 1.45;
}

.meal-bars {
  margin-top: auto;
  display: flex;
  align-items: flex-end;
  gap: 10rpx;
  height: 108rpx;
}

.meal-bar-item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.meal-bar-track {
  width: 100%;
  height: 72rpx;
  border-radius: 14rpx;
  background: #F7F8FA;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.meal-bar-fill {
  width: 100%;
  min-height: 6rpx;
  border-radius: 14rpx 14rpx 0 0;
  transition: height 0.35s ease;
}

.meal-bar-fill.empty {
  height: 6rpx !important;
}

.meal-bar-label {
  font-size: 20rpx;
  color: #86909C;
  font-weight: bold;
}

.meal-bar-label.active {
  color: #FF4D4F;
}

.caution-tags {
  margin-top: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.caution-tag {
  max-width: 100%;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
}

.caution-tag.dislike {
  background: #FFF1F0;
}

.caution-tag.allergy {
  background: #FFF7E6;
}

.caution-tag.more {
  background: #F2F3F5;
}

.caution-tag-text {
  display: block;
  max-width: 180rpx;
  font-size: 20rpx;
  color: #D4380D;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caution-tag.more .caution-tag-text {
  color: #4E5969;
}

.caution-empty {
  margin-top: auto;
  min-height: 72rpx;
  border-radius: 18rpx;
  background: #F7F8FA;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16rpx;
}

.caution-empty-text {
  font-size: 22rpx;
  color: #86909C;
  text-align: center;
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
.room-badge-home-text { font-size: 28rpx; color: #FF4D4F; font-weight: bold; letter-spacing: 2rpx; font-family: 'Courier New', monospace; }

.bottom-spacer {
  height: 160rpx;
}
</style>
