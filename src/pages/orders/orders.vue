<template>
  <view class="page">
    <view class="status-bar"></view>

    <view class="orders-header">
      <view class="header-copy">
        <text class="header-kicker">投喂记录</text>
        <view class="header-title-row">
          <text class="header-title">清单总览</text>
          <view class="today-btn" @click="goToday">
            <text class="today-btn-text">今天</text>
          </view>
        </view>
      </view>
      <view class="header-stat">
        <text class="stat-num">{{ sortedOrders.length }}</text>
        <text class="stat-label">单</text>
      </view>
    </view>

    <scroll-view class="orders-scroll" scroll-y :enhanced="true" :show-scrollbar="false" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="onPullRefresh">
      <view class="content">
        <view class="heatmap-section" @touchstart="onHeatmapTouchStart" @touchend="onHeatmapTouchEnd">
          <view class="month-row">
            <view class="month-btn" @click="changeMonth(-1)">
              <text class="month-btn-text">‹</text>
            </view>
            <text class="month-title">{{ monthLabel }}</text>
            <view class="month-btn" @click="changeMonth(1)">
              <text class="month-btn-text">›</text>
            </view>
          </view>

          <view class="week-row">
            <text v-for="day in weekDays" :key="day" class="week-text">{{ day }}</text>
          </view>

          <view class="day-grid">
            <view v-for="(cell, index) in monthCells" :key="cell.dateKey || index" class="day-cell-wrap">
              <view
                v-if="cell.dateKey"
                class="day-cell"
                :class="[getIntensityClass(cell.count), { selected: selectedDate === cell.dateKey }]"
                @click="selectDate(cell.dateKey)"
              >
                <text class="day-num" :class="{ selected: selectedDate === cell.dateKey }">{{ cell.day }}</text>
                <text v-if="cell.count > 0" class="day-dot" :class="{ selected: selectedDate === cell.dateKey }">{{ cell.count }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="section-head">
          <view class="section-title-wrap">
            <text class="section-title">{{ selectedDateTitle }}</text>
            <text class="section-desc">{{ selectedDayOrders.length > 0 ? `共 ${selectedDayTotalCount} 件` : '暂无订单' }}</text>
          </view>
        </view>

        <view v-if="selectedDayOrders.length > 0" class="order-list">
          <view
            v-for="order in selectedDayOrders"
            :key="order.id"
            class="order-card"
            @click="openOrderDetail(order)"
          >
            <view class="order-card-head">
              <text class="order-time">{{ formatTime(order.createdAt) }}</text>
              <view class="order-status-tag" :class="'tag-' + order.status"><text class="order-status-text" :class="'text-' + order.status">{{ statusLabel(order.status) }}</text></view>
            </view>
            <view class="item-list">
              <view v-for="item in order.items" :key="`${order.id}-${item.id}-${getOptionsText(item)}`" class="order-item">
                <image class="item-photo" :src="item.image" mode="aspectFill" />
                <view class="item-info">
                  <text class="item-name">{{ item.name }} × {{ item.qty }}</text>
                  <text class="item-options">{{ getOptionsText(item) }}</text>
                </view>
              </view>
            </view>
            <text v-if="order.note" class="order-note">💌 {{ order.note }}</text>
          </view>
        </view>

        <view v-else class="empty-day">
          <text class="empty-emoji">📅</text>
          <text class="empty-title">这天还没有投喂记录</text>
        </view>

        <view v-if="sortedOrders.length > 0" class="section-head all-head">
          <view class="section-title-wrap">
            <text class="section-title">全部订单</text>
            <text class="section-desc">已记录 {{ sortedOrders.length }} 单</text>
          </view>
        </view>

        <view v-if="sortedOrders.length > 0" class="timeline">
          <view v-for="order in sortedOrders" :key="order.id" class="timeline-row" @click="openOrderDetail(order)">
            <view class="timeline-date">
              <text class="timeline-day">{{ formatDay(order.createdAt) }}</text>
              <text class="timeline-month">{{ formatMonth(order.createdAt) }}</text>
            </view>
            <view class="timeline-main">
              <view class="timeline-top">
                <text class="timeline-title">{{ getOrderSummary(order) }}</text>
                <text class="timeline-count">{{ order.totalCount }} 件</text>
              </view>
              <text class="timeline-time">{{ formatTime(order.createdAt) }}</text>
            </view>
          </view>
        </view>

        <view class="bottom-spacer"></view>
      </view>
    </scroll-view>

    <!-- 订单详情弹窗 -->
    <view class="modal-overlay" v-if="showDetail" @click="showDetail = false">
      <view class="modal-card" @click.stop>
        <text class="modal-close" @click="showDetail = false">✕</text>
        <text class="modal-title">订单详情</text>
        <text class="modal-order-id">#{{ detailOrder.id ? detailOrder.id.slice(-6) : '' }}</text>
        <!-- 状态进度 -->
        <view class="progress-bar">
          <view v-for="(step, i) in statusSteps" :key="step.key" class="progress-step">
            <view class="step-dot" :class="{ active: stepActive(i), current: stepCurrent(i) }"><text class="step-dot-text">{{ step.icon }}</text></view>
            <text class="step-label" :class="{ active: stepActive(i) }">{{ step.label }}</text>
            <text v-if="stepTime(step.key)" class="step-time">{{ stepTime(step.key) }}</text>
          </view>
          <view class="progress-line"><view class="progress-fill" :style="{ width: progressWidth + '%' }"></view></view>
        </view>
        <!-- 菜品列表 -->
        <scroll-view class="modal-items-scroll" scroll-y :show-scrollbar="false">
          <view v-for="item in (detailOrder.items || [])" :key="item.id" class="modal-item">
            <image class="modal-item-photo" :src="item.image" mode="aspectFill" />
            <view class="modal-item-info">
              <text class="modal-item-name">{{ item.name }} × {{ item.qty }}</text>
              <text class="modal-item-opts">{{ getOptionsText(item) }}</text>
            </view>
          </view>
        </scroll-view>
        <text v-if="detailOrder.note" class="modal-note">💌 {{ detailOrder.note }}</text>
        <!-- 催单按钮 -->
        <view v-if="detailOrder.status !== 'done'" class="rush-section">
          <view class="rush-btn" :class="{ disabled: rushCooldown > 0, rushing: isRushing }" @click="handleRush">
            <text class="rush-btn-text">{{ rushBtnText }}</text>
          </view>
          <text v-if="rushCooldown > 0" class="rush-hint">{{ rushCooldownText }}</text>
        </view>
        <view v-else class="done-banner"><text class="done-banner-text">✅ 订单已完成</text></view>
      </view>
    </view>

    <TabBar :current="2" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { loadOrdersFromCloud, getCurrentRoomOrders, getRushCooldownRemaining, rushOrderAction, formatOrderItemOptions } from '@/store/index.js'
import TabBar from '@/components/TabBar.vue'

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const touchStartX = ref(0)
const refreshing = ref(false)

const toDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getOrderDate = (order) => toDateKey(new Date(order.createdAt))

const sortedOrders = computed(() => {
  return [...getCurrentRoomOrders()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

const initialDate = sortedOrders.value[0] ? new Date(sortedOrders.value[0].createdAt) : new Date()
const activeMonth = ref(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
const selectedDate = ref(toDateKey(initialDate))

const onPullRefresh = async () => {
  refreshing.value = true
  try {
    await loadOrdersFromCloud()
  } catch (e) {
    console.warn('[CustomerOrders] 刷新订单失败', e)
  } finally {
    refreshing.value = false
  }
}

onShow(() => {
  loadOrdersFromCloud()
})

const monthLabel = computed(() => {
  const date = activeMonth.value
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
})

const dateCounts = computed(() => {
  return sortedOrders.value.reduce((map, order) => {
    const key = getOrderDate(order)
    map[key] = (map[key] || 0) + order.totalCount
    return map
  }, {})
})

const monthCells = computed(() => {
  const year = activeMonth.value.getFullYear()
  const month = activeMonth.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay.getDay(); i++) {
    cells.push({ dateKey: '', day: '', count: 0 })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const key = toDateKey(new Date(year, month, day))
    cells.push({ dateKey: key, day, count: dateCounts.value[key] || 0 })
  }
  return cells
})

const selectedDayOrders = computed(() => {
  return sortedOrders.value.filter(order => getOrderDate(order) === selectedDate.value)
})

const selectedDayTotalCount = computed(() => {
  return selectedDayOrders.value.reduce((sum, order) => sum + order.totalCount, 0)
})

const selectedDateTitle = computed(() => {
  const [year, month, day] = selectedDate.value.split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
})

const getIntensityClass = (count) => {
  if (count >= 8) return 'level-4'
  if (count >= 5) return 'level-3'
  if (count >= 2) return 'level-2'
  if (count >= 1) return 'level-1'
  return 'level-0'
}

const changeMonth = (delta) => {
  const date = activeMonth.value
  activeMonth.value = new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

const selectDate = (dateKey) => { selectedDate.value = dateKey }

const goToday = () => {
  const today = new Date()
  activeMonth.value = new Date(today.getFullYear(), today.getMonth(), 1)
  selectedDate.value = toDateKey(today)
}

const selectOrderDate = (order) => {
  const date = new Date(order.createdAt)
  activeMonth.value = new Date(date.getFullYear(), date.getMonth(), 1)
  selectedDate.value = toDateKey(date)
}

const onHeatmapTouchStart = (event) => {
  const touch = event.changedTouches?.[0] || event.touches?.[0]
  touchStartX.value = touch?.clientX || 0
}

const onHeatmapTouchEnd = (event) => {
  const touch = event.changedTouches?.[0] || event.touches?.[0]
  const endX = touch?.clientX || 0
  const diff = endX - touchStartX.value
  if (Math.abs(diff) < 50) return
  changeMonth(diff > 0 ? -1 : 1)
}

const getOptionsText = (item) => {
  return formatOrderItemOptions(item)
}

const getOrderSummary = (order) => {
  return order.items.map(item => item.name).slice(0, 2).join('、') || '投喂订单'
}

const formatTime = (iso) => {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const formatDay = (iso) => String(new Date(iso).getDate()).padStart(2, '0')
const formatMonth = (iso) => `${new Date(iso).getMonth() + 1}月`

// ========== 订单状态弹窗 ==========
const showDetail = ref(false)
const detailOrder = ref({})
const isRushing = ref(false)
const rushCooldown = ref(0)
let rushTimer = null

const statusSteps = [
  { key: 'pending', label: '待接单', icon: '📥' },
  { key: 'accepted', label: '已接单', icon: '✋' },
  { key: 'cooking', label: '制作中', icon: '🔥' },
  { key: 'done', label: '已完成', icon: '✅' },
]

const statusLabel = (status) => {
  const map = { pending: '待接单', accepted: '已接单', cooking: '制作中', done: '已完成' }
  return map[status] || status
}

const statusIndex = computed(() => {
  const map = { pending: 0, accepted: 1, cooking: 2, done: 3 }
  return map[detailOrder.value.status] ?? 0
})

const stepActive = (i) => i <= statusIndex.value
const stepCurrent = (i) => i === statusIndex.value

const stepTime = (key) => {
  const o = detailOrder.value
  if (key === 'pending' && o.createdAt) return formatTime(o.createdAt)
  if (key === 'accepted' && o.acceptedAt) return formatTime(o.acceptedAt)
  if (key === 'cooking' && o.cookingAt) return formatTime(o.cookingAt)
  if (key === 'done' && o.completedAt) return formatTime(o.completedAt)
  return ''
}

const progressWidth = computed(() => (statusIndex.value / 3) * 100)

const rushBtnText = computed(() => {
  if (isRushing.value) return '催单中...'
  if (rushCooldown.value > 0) return '已催单'
  return '催一下主厨 💨'
})

const rushCooldownText = computed(() => {
  if (rushCooldown.value <= 0) return ''
  const mins = Math.floor(rushCooldown.value / 60000)
  const secs = Math.floor((rushCooldown.value % 60000) / 1000)
  return `${mins}分${secs}秒后可再次催单`
})

const updateCooldown = () => {
  if (!detailOrder.value.id) return
  rushCooldown.value = getRushCooldownRemaining(detailOrder.value.id)
}

const startCooldownTimer = () => {
  stopCooldownTimer()
  updateCooldown()
  rushTimer = setInterval(() => {
    updateCooldown()
    if (rushCooldown.value <= 0) stopCooldownTimer()
  }, 1000)
}

const stopCooldownTimer = () => {
  if (rushTimer) { clearInterval(rushTimer); rushTimer = null }
}

const openOrderDetail = (order) => {
  detailOrder.value = order
  showDetail.value = true
  startCooldownTimer()
}

const handleRush = async () => {
  if (isRushing.value || rushCooldown.value > 0) return
  isRushing.value = true
  try {
    const result = await rushOrderAction(detailOrder.value.id)
    uni.showToast({ title: result.message, icon: 'none', duration: 2000 })
    if (result.success) startCooldownTimer()
  } catch (e) {
    uni.showToast({ title: '催单失败', icon: 'none' })
  } finally {
    isRushing.value = false
  }
}

onUnmounted(() => { stopCooldownTimer() })
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

.orders-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 40rpx 28rpx;
  background: #FFFFFF;
}

.header-copy {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.header-kicker {
  font-size: 24rpx;
  color: #86909C;
}

.header-title {
  font-size: 40rpx;
  color: #1D2129;
  font-weight: bold;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.today-btn {
  height: 48rpx;
  padding: 0 22rpx;
  border-radius: 24rpx;
  background: #FFF1F0;
  border: 2rpx solid rgba(255, 77, 79, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.today-btn:active {
  transform: scale(0.94);
}

.today-btn-text {
  font-size: 22rpx;
  color: #FF4D4F;
  font-weight: bold;
}

.header-stat {
  min-width: 104rpx;
  height: 72rpx;
  border-radius: 36rpx;
  background: #FFF1F0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  margin-right: 200rpx;
  flex-shrink: 0;
}

.stat-num {
  font-size: 34rpx;
  color: #FF4D4F;
  font-weight: bold;
}

.stat-label {
  font-size: 22rpx;
  color: #FF4D4F;
}

.orders-scroll {
  flex: none;
  height: calc(100vh - var(--status-bar-height, 44px) - 150rpx - 150rpx);
  overflow: hidden;
}

.content {
  padding: 28rpx 32rpx 0;
}

.heatmap-section {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.month-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.month-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 32rpx;
  background: #F2F3F5;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.month-btn:active {
  transform: scale(0.92);
}

.month-btn-text {
  font-size: 48rpx;
  line-height: 1;
  color: #1D2129;
}

.month-title {
  font-size: 32rpx;
  color: #1D2129;
  font-weight: bold;
}

.week-row,
.day-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10rpx;
}

.week-row {
  margin-bottom: 12rpx;
}

.week-text {
  text-align: center;
  font-size: 22rpx;
  color: #86909C;
}

.day-cell-wrap {
  aspect-ratio: 1;
}

.day-cell {
  width: 100%;
  height: 100%;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: transform 0.2s ease, border 0.2s ease;
  border: 2rpx solid transparent;
}

.day-cell:active {
  transform: scale(0.92);
}

.day-cell.selected {
  border-color: #FF4D4F;
  box-shadow: 0 0 0 4rpx rgba(255, 77, 79, 0.12);
}

.level-0 {
  background: #F2F3F5;
}

.level-1 {
  background: #DDF6E8;
}

.level-2 {
  background: #A7E2C0;
}

.level-3 {
  background: #55C98B;
}

.level-4 {
  background: #1F9D61;
}

.day-num {
  font-size: 22rpx;
  color: #4E5969;
}

.day-num.selected {
  color: #1D2129;
  font-weight: bold;
}

.day-dot {
  position: absolute;
  right: 6rpx;
  bottom: 4rpx;
  min-width: 24rpx;
  height: 24rpx;
  border-radius: 12rpx;
  background: rgba(255, 255, 255, 0.9);
  color: #1F9D61;
  font-size: 18rpx;
  text-align: center;
  line-height: 24rpx;
  font-weight: bold;
}

.day-dot.selected {
  color: #FF4D4F;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 36rpx 8rpx 20rpx;
}

.all-head {
  margin-top: 44rpx;
}

.section-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.section-title {
  font-size: 32rpx;
  color: #1D2129;
  font-weight: bold;
}

.section-desc {
  font-size: 24rpx;
  color: #86909C;
}

.order-list,
.timeline {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.order-card {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.order-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.order-time {
  font-size: 26rpx;
  color: #4E5969;
  font-weight: bold;
}

.order-count {
  font-size: 24rpx;
  color: #FF4D4F;
  font-weight: bold;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.item-photo {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  background: #FFF7E6;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.item-name {
  font-size: 27rpx;
  color: #1D2129;
  font-weight: bold;
}

.item-options,
.order-note,
.timeline-time {
  font-size: 22rpx;
  color: #86909C;
}

.order-note {
  display: block;
  margin-top: 20rpx;
  line-height: 1.5;
}

.empty-day {
  min-height: 260rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.empty-emoji {
  font-size: 72rpx;
}

.empty-title {
  font-size: 28rpx;
  color: #86909C;
}

.timeline-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  transition: transform 0.2s ease;
}

.timeline-row:active {
  transform: scale(0.98);
}

.timeline-date {
  width: 76rpx;
  height: 88rpx;
  border-radius: 20rpx;
  background: #FFF1F0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.timeline-day {
  font-size: 30rpx;
  color: #FF4D4F;
  font-weight: bold;
}

.timeline-month {
  font-size: 20rpx;
  color: #FF4D4F;
}

.timeline-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.timeline-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.timeline-title {
  flex: 1;
  font-size: 27rpx;
  color: #1D2129;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-count {
  font-size: 24rpx;
  color: #FF4D4F;
  font-weight: bold;
  flex-shrink: 0;
}

.bottom-spacer {
  height: 180rpx;
}

/* 状态标签 */
.order-status-tag { padding: 6rpx 16rpx; border-radius: 16rpx; }
.tag-pending { background: #FFF7E6; }
.tag-accepted { background: #E8F3FF; }
.tag-cooking { background: #FFF1F0; }
.tag-done { background: #F6FFED; }
.order-status-text { font-size: 20rpx; font-weight: bold; }
.text-pending { color: #FA8C16; }
.text-accepted { color: #4080FF; }
.text-cooking { color: #FF4D4F; }
.text-done { color: #52C41A; }

/* 弹窗 */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease; }
.modal-card { width: 680rpx; max-height: 85vh; background: #FFFFFF; border-radius: 32rpx; padding: 44rpx 36rpx 36rpx; display: flex; flex-direction: column; align-items: center; gap: 20rpx; animation: bounceIn 0.4s ease; position: relative; }
.modal-close { position: absolute; top: 20rpx; right: 28rpx; font-size: 36rpx; color: #C9CDD4; padding: 10rpx; }
.modal-title { font-size: 34rpx; font-weight: bold; color: #1D2129; }
.modal-order-id { font-size: 24rpx; color: #86909C; }

/* 进度条 */
.progress-bar { width: 100%; display: flex; justify-content: space-between; align-items: flex-start; padding: 24rpx 0; position: relative; }
.progress-step { display: flex; flex-direction: column; align-items: center; gap: 8rpx; z-index: 2; flex: 1; }
.step-dot { width: 56rpx; height: 56rpx; border-radius: 50%; background: #F2F3F5; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
.step-dot.active { background: #FF4D4F; box-shadow: 0 4rpx 16rpx rgba(255,77,79,0.3); }
.step-dot.current { animation: pulse 1.5s infinite; }
.step-dot-text { font-size: 24rpx; }
.step-label { font-size: 20rpx; color: #86909C; }
.step-label.active { color: #1D2129; font-weight: bold; }
.step-time { font-size: 18rpx; color: #4080FF; }
.progress-line { position: absolute; top: 52rpx; left: 12.5%; right: 12.5%; height: 6rpx; background: #F2F3F5; border-radius: 3rpx; z-index: 1; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #FF4D4F, #FF8C9A); border-radius: 3rpx; transition: width 0.5s ease; }

/* 弹窗菜品列表 */
.modal-items-scroll { width: 100%; max-height: 280rpx; }
.modal-item { display: flex; align-items: center; gap: 16rpx; padding: 12rpx 0; }
.modal-item-photo { width: 64rpx; height: 64rpx; border-radius: 16rpx; background: #FFF7E6; flex-shrink: 0; }
.modal-item-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.modal-item-name { font-size: 26rpx; color: #1D2129; font-weight: bold; }
.modal-item-opts { font-size: 20rpx; color: #86909C; }
.modal-note { font-size: 22rpx; color: #86909C; line-height: 1.5; width: 100%; text-align: left; padding: 12rpx 16rpx; background: #FFF7E6; border-radius: 16rpx; }

/* 催单 */
.rush-section { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 12rpx; margin-top: 8rpx; }
.rush-btn { width: 100%; height: 84rpx; border-radius: 42rpx; background: linear-gradient(135deg, #FF4D4F 0%, #FF8C9A 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(255,77,79,0.3); transition: all 0.3s ease; }
.rush-btn:active { transform: scale(0.96); }
.rush-btn.disabled { background: #E5E6EB; box-shadow: none; }
.rush-btn.rushing { opacity: 0.7; }
.rush-btn-text { font-size: 28rpx; font-weight: bold; color: #FFFFFF; }
.rush-btn.disabled .rush-btn-text { color: #86909C; }
.rush-hint { font-size: 22rpx; color: #86909C; }

/* 完成 */
.done-banner { width: 100%; height: 84rpx; border-radius: 42rpx; background: #F6FFED; display: flex; align-items: center; justify-content: center; margin-top: 8rpx; }
.done-banner-text { font-size: 28rpx; font-weight: bold; color: #52C41A; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes bounceIn { 0% { opacity: 0; transform: scale(0.85); } 60% { opacity: 1; transform: scale(1.03); } 100% { transform: scale(1); } }
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,77,79,0.4); } 50% { box-shadow: 0 0 0 12rpx rgba(255,77,79,0); } }
</style>
