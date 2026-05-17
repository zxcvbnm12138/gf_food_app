<template>
  <view class="page">
    <view class="status-bar"></view>
    <view class="top-header">
      <text class="page-title">订单管理</text>
      <view class="header-stat"><text class="stat-num">{{ allOrders.length }}</text><text class="stat-label">单</text></view>
    </view>
    <!-- Tab 栏 -->
    <view class="tab-row">
      <view v-for="(tab, i) in tabs" :key="tab.key" class="tab-item" :class="{ active: activeTab === i }" @click="activeTab = i">
        <text class="tab-text" :class="{ active: activeTab === i }">{{ tab.label }}</text>
        <view v-if="tab.count > 0" class="tab-badge"><text class="tab-badge-text">{{ tab.count }}</text></view>
      </view>
    </view>
    <!-- 订单列表 -->
    <scroll-view class="order-scroll" scroll-y :enhanced="true" :show-scrollbar="false">
      <view class="order-list" v-if="currentOrders.length > 0">
        <view v-for="(order, idx) in currentOrders" :key="order.id" class="order-card" :style="{ animationDelay: (idx * 0.06) + 's' }">
          <view class="order-head">
            <view class="order-id-wrap">
              <text class="order-dot" :class="statusClass"></text>
              <text class="order-id">#{{ order.id.slice(-6) }}</text>
            </view>
            <text class="order-time">{{ fmtTime(order.createdAt) }}</text>
          </view>
          <view class="item-list">
            <view v-for="item in order.items" :key="`${order.id}-${item.id}`" class="order-item">
              <image class="item-photo" :src="item.image" mode="aspectFill" />
              <view class="item-info">
                <text class="item-name">{{ item.name }} × {{ item.qty }}</text>
                <text class="item-opts">{{ getOptsText(item) }}</text>
              </view>
            </view>
          </view>
          <text v-if="order.note" class="order-note">💌 {{ order.note }}</text>
          <view class="order-footer">
            <text class="order-total">共 {{ order.totalCount }} 件</text>
            <view v-if="activeTab === 0" class="action-btn accept" @click="doAccept(order.id)"><text class="action-btn-text">接单</text></view>
            <view v-else-if="activeTab === 1 && order.status === 'accepted'" class="action-btn cook" @click="doCook(order.id)"><text class="action-btn-text">开始制作</text></view>
            <view v-else-if="activeTab === 1 && order.status === 'cooking'" class="action-btn done" @click="doDone(order.id)"><text class="action-btn-text">完成制作</text></view>
            <view v-else-if="activeTab === 2" class="done-tag"><text class="done-tag-text">✅ {{ fmtTime(order.completedAt) }}</text></view>
          </view>
        </view>
        <view class="list-spacer"></view>
      </view>
      <view v-else class="empty-state">
        <text class="empty-emoji">{{ emptyEmoji }}</text>
        <text class="empty-text">{{ emptyText }}</text>
      </view>
    </scroll-view>
    <ChefTabBar :current="1" />

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
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import store, { acceptOrder, startCooking, completeOrder, getOrdersByStatus, loadOrdersFromCloud, popRushNotification } from '@/store/index.js'
import ChefTabBar from '@/components/ChefTabBar.vue'
const activeTab = ref(0)

// 页面显示时刷新云端订单 + 轮询
let pollTimer = null
const refreshOrders = async () => {
  try {
    await loadOrdersFromCloud()
  } catch (e) {
    console.warn('[ChefOrders] 刷新订单失败', e)
  }
}

const startPolling = () => {
  refreshOrders()
  if (!pollTimer) {
    pollTimer = setInterval(refreshOrders, 5000)
  }
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// onShow: 每次页面可见时立即刷新 + 启动轮询
onShow(() => {
  startPolling()
})

// onHide: 页面隐藏时停止轮询
onHide(() => {
  stopPolling()
})

onUnmounted(() => {
  stopPolling()
})
const allOrders = computed(() => store.orders)
const pendingOrders = computed(() => getOrdersByStatus('pending'))
const inProgressOrders = computed(() => [...getOrdersByStatus('accepted'), ...getOrdersByStatus('cooking')].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)))
const doneOrders = computed(() => getOrdersByStatus('done').sort((a,b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt)))
const tabs = computed(() => [
  { key: 'pending', label: '待接单', count: pendingOrders.value.length },
  { key: 'progress', label: '制作中', count: inProgressOrders.value.length },
  { key: 'done', label: '已完成', count: 0 },
])
const currentOrders = computed(() => {
  if (activeTab.value === 0) return pendingOrders.value
  if (activeTab.value === 1) return inProgressOrders.value
  return doneOrders.value
})
const statusClass = computed(() => {
  if (activeTab.value === 0) return 'dot-pending'
  if (activeTab.value === 1) return 'dot-cooking'
  return 'dot-done'
})
const emptyEmoji = computed(() => ['📥','🍳','📋'][activeTab.value])
const emptyText = computed(() => ['暂无待接单订单～','暂无制作中订单～','暂无已完成订单～'][activeTab.value])
const fmtTime = (iso) => { if (!iso) return '--:--'; const d = new Date(iso); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
const getOptsText = (item) => { const p = []; if (item.options?.sweet) p.push(item.options.sweet); if (item.options?.extras?.length) p.push(...item.options.extras); return p.join(' / ') || '默认口味' }
const isOperating = ref(false)

const doAccept = async (id) => {
  if (isOperating.value) return
  isOperating.value = true
  try {
    const success = await acceptOrder(id)
    if (success) {
      uni.showToast({ title: '已接单 🎉', icon: 'none' })
    } else {
      uni.showToast({ title: '接单失败，请检查网络或云函数', icon: 'none', duration: 3000 })
    }
  } finally {
    isOperating.value = false
  }
}
const doCook = async (id) => {
  if (isOperating.value) return
  isOperating.value = true
  try {
    const success = await startCooking(id)
    if (success) {
      uni.showToast({ title: '开始制作 🔥', icon: 'none' })
    } else {
      uni.showToast({ title: '操作失败，请检查网络或云函数', icon: 'none', duration: 3000 })
    }
  } finally {
    isOperating.value = false
  }
}
const doDone = async (id) => {
  if (isOperating.value) return
  isOperating.value = true
  try {
    const success = await completeOrder(id)
    if (success) {
      uni.showToast({ title: '制作完成 ✅', icon: 'none' })
    } else {
      uni.showToast({ title: '操作失败，请检查网络或云函数', icon: 'none', duration: 3000 })
    }
  } finally {
    isOperating.value = false
  }
}

// ========== 催单通知 ==========
const showRushAlert = ref(false)
const rushAlertData = ref({ orderShortId: '', items: '', orderId: '' })

watch(() => store.rushNotifications.length, (newLen) => {
  if (newLen > 0 && !showRushAlert.value) {
    const notification = popRushNotification()
    if (notification) {
      rushAlertData.value = notification
      showRushAlert.value = true
      try { uni.vibrateShort && uni.vibrateShort() } catch (e) { /* ignore */ }
    }
  }
})

const dismissRush = () => {
  showRushAlert.value = false
  setTimeout(() => {
    if (store.rushNotifications.length > 0) {
      const next = popRushNotification()
      if (next) {
        rushAlertData.value = next
        showRushAlert.value = true
        try { uni.vibrateShort && uni.vibrateShort() } catch (e) { /* ignore */ }
      }
    }
  }, 300)
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100vh; background: #F7F8FA; overflow: hidden; }
.status-bar { height: var(--status-bar-height, 44px); width: 100%; background: #FFFFFF; }
.top-header { display: flex; align-items: center; justify-content: space-between; padding: 20rpx 40rpx 16rpx; background: #FFFFFF; }
.page-title { font-size: 40rpx; font-weight: bold; color: #1D2129; }
.header-stat { min-width: 88rpx; height: 60rpx; border-radius: 30rpx; background: #E8F3FF; display: flex; align-items: center; justify-content: center; gap: 6rpx; padding: 0 20rpx; margin-right: 200rpx; }
.stat-num { font-size: 28rpx; color: #4080FF; font-weight: bold; }
.stat-label { font-size: 20rpx; color: #4080FF; }
.tab-row { display: flex; background: #FFFFFF; padding: 0 40rpx 20rpx; gap: 32rpx; }
.tab-item { position: relative; padding: 12rpx 0; transition: all 0.25s ease; }
.tab-item.active::after { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 48rpx; height: 6rpx; border-radius: 3rpx; background: #4080FF; }
.tab-text { font-size: 28rpx; color: #86909C; transition: all 0.25s ease; }
.tab-text.active { color: #1D2129; font-weight: bold; }
.tab-badge { position: absolute; top: 4rpx; right: -28rpx; min-width: 32rpx; height: 32rpx; border-radius: 16rpx; background: #FF4D4F; display: flex; align-items: center; justify-content: center; padding: 0 8rpx; }
.tab-badge-text { font-size: 18rpx; color: #FFFFFF; font-weight: bold; }
.order-scroll { flex: 1; overflow: hidden; }
.order-list { padding: 24rpx 32rpx; display: flex; flex-direction: column; gap: 20rpx; }
.order-card { background: #FFFFFF; border-radius: 28rpx; padding: 32rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 20rpx; animation: fadeInUp 0.4s ease both; transition: transform 0.2s ease; }
.order-card:active { transform: scale(0.98); }
.order-head { display: flex; justify-content: space-between; align-items: center; }
.order-id-wrap { display: flex; align-items: center; gap: 12rpx; }
.order-dot { width: 14rpx; height: 14rpx; border-radius: 50%; }
.dot-pending { background: #FF4D4F; animation: pulse 1.5s infinite; }
.dot-cooking { background: #FF8C00; animation: pulse 1.5s infinite; }
.dot-done { background: #52C41A; }
.order-id { font-size: 28rpx; font-weight: bold; color: #1D2129; }
.order-time { font-size: 24rpx; color: #86909C; }
.item-list { display: flex; flex-direction: column; gap: 16rpx; }
.order-item { display: flex; align-items: center; gap: 16rpx; }
.item-photo { width: 72rpx; height: 72rpx; border-radius: 18rpx; background: #FFF7E6; flex-shrink: 0; }
.item-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.item-name { font-size: 26rpx; color: #1D2129; font-weight: bold; }
.item-opts { font-size: 22rpx; color: #86909C; }
.order-note { font-size: 22rpx; color: #86909C; line-height: 1.5; padding: 12rpx 16rpx; background: #FFF7E6; border-radius: 16rpx; }
.order-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 8rpx; border-top: 2rpx solid #F2F3F5; }
.order-total { font-size: 24rpx; color: #86909C; }
.action-btn { padding: 14rpx 36rpx; border-radius: 28rpx; transition: transform 0.2s ease; }
.action-btn:active { transform: scale(0.92); }
.action-btn.accept { background: #4080FF; box-shadow: 0 8rpx 20rpx rgba(64,128,255,0.2); }
.action-btn.cook { background: #FF8C00; box-shadow: 0 8rpx 20rpx rgba(255,140,0,0.2); }
.action-btn.done { background: #52C41A; box-shadow: 0 8rpx 20rpx rgba(82,196,26,0.2); }
.action-btn-text { font-size: 24rpx; font-weight: bold; color: #FFFFFF; }
.done-tag { padding: 8rpx 20rpx; border-radius: 20rpx; background: #F6FFED; }
.done-tag-text { font-size: 22rpx; color: #52C41A; font-weight: bold; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 200rpx; gap: 20rpx; }
.empty-emoji { font-size: 100rpx; animation: bounceIn 0.6s ease; }
.empty-text { font-size: 28rpx; color: #86909C; }
.list-spacer { height: 200rpx; }

/* 催单通知弹窗 */
.rush-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 2000; animation: fadeIn 0.2s ease; }
.rush-modal { width: 600rpx; background: #FFFFFF; border-radius: 36rpx; padding: 52rpx 40rpx 40rpx; display: flex; flex-direction: column; align-items: center; gap: 20rpx; animation: rushBounce 0.5s ease; position: relative; overflow: hidden; }
.rush-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 8rpx; background: linear-gradient(90deg, #FF4D4F, #FF8C9A, #FFBB96, #FF4D4F); background-size: 300% 100%; animation: rushShine 2s linear infinite; }
.rush-modal-ring { width: 120rpx; height: 120rpx; border-radius: 50%; background: linear-gradient(135deg, #FFF1F0, #FFD6D9); display: flex; align-items: center; justify-content: center; animation: rushPulse 1.5s ease infinite; }
.rush-modal-emoji { font-size: 64rpx; }
.rush-modal-title { font-size: 38rpx; font-weight: bold; color: #1D2129; }
.rush-modal-order { font-size: 26rpx; color: #86909C; font-family: 'Courier New', monospace; letter-spacing: 4rpx; }
.rush-modal-items { font-size: 28rpx; color: #4E5969; font-weight: bold; }
.rush-modal-hint { font-size: 24rpx; color: #86909C; }
.rush-modal-actions { display: flex; gap: 20rpx; width: 100%; margin-top: 12rpx; }
.rush-modal-btn { flex: 1; height: 84rpx; border-radius: 42rpx; background: #F7F8FA; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }
.rush-modal-btn:active { transform: scale(0.95); }
.rush-modal-btn-text { font-size: 28rpx; font-weight: bold; color: #4E5969; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes rushBounce { 0% { opacity: 0; transform: scale(0.7) translateY(40rpx); } 50% { transform: scale(1.05) translateY(-10rpx); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes rushPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
@keyframes rushShine { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
</style>
