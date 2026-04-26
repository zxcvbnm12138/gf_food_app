<template>
  <view class="page">
    <view class="status-bar"></view>

    <view class="orders-header">
      <view class="header-copy">
        <text class="header-kicker">投喂记录</text>
        <text class="header-title">清单总览</text>
      </view>
      <view class="header-stat">
        <text class="stat-num">{{ sortedOrders.length }}</text>
        <text class="stat-label">单</text>
      </view>
    </view>

    <scroll-view class="orders-scroll" scroll-y :enhanced="true" :show-scrollbar="false">
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
          >
            <view class="order-card-head">
              <text class="order-time">{{ formatTime(order.createdAt) }}</text>
              <text class="order-count">{{ order.totalCount }} 件</text>
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
          <view v-for="order in sortedOrders" :key="order.id" class="timeline-row" @click="selectOrderDate(order)">
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

    <TabBar :current="2" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import store from '@/store/index.js'
import TabBar from '@/components/TabBar.vue'

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const touchStartX = ref(0)

const toDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getOrderDate = (order) => toDateKey(new Date(order.createdAt))

const sortedOrders = computed(() => {
  return [...store.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

const initialDate = sortedOrders.value[0] ? new Date(sortedOrders.value[0].createdAt) : new Date()
const activeMonth = ref(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
const selectedDate = ref(toDateKey(initialDate))

const monthLabel = computed(() => {
  const date = activeMonth.value
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
})

const dateCounts = computed(() => {
  return store.orders.reduce((map, order) => {
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
    cells.push({
      dateKey: key,
      day,
      count: dateCounts.value[key] || 0,
    })
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

const selectDate = (dateKey) => {
  selectedDate.value = dateKey
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
  const parts = []
  if (item.options?.sweet) parts.push(item.options.sweet)
  if (item.options?.extras?.length) parts.push(...item.options.extras)
  if (item.options?.extra) parts.push(item.options.extra)
  if (item.options?.note) parts.push(item.options.note)
  return parts.join(' / ') || '默认口味'
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

.header-stat {
  min-width: 104rpx;
  height: 72rpx;
  border-radius: 36rpx;
  background: #FFF1F0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  margin-right: 150rpx;
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
</style>
