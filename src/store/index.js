import { reactive } from 'vue'
import {
  fetchMenuItems as cloudFetchMenuItems,
  addMenuItem as cloudAddMenuItem,
  updateMenuItem as cloudUpdateMenuItem,
  deleteMenuItem as cloudDeleteMenuItem,
  toggleMenuItemAvailability as cloudToggleAvailability,
  getDefaultMenuItems,
  checkLogin as cloudCheckLogin,
  logout as cloudLogout,
  isCloudAvailable,
  addOrder as cloudAddOrder,
  fetchOrders as cloudFetchOrders,
  updateOrderInCloud,
  rushOrderInCloud,
  getStoredRoomId,
  setStoredRoomId,
  clearStoredRoomId,
  resolveMenuImages,
  uploadImageToCloud as cloudUploadImage,
  resolveImageUrl,
  migrateLocalImagesToCloud,
  watchMenuItems as cloudWatchMenuItems,
  watchRoomMenuVersion as cloudWatchRoomMenuVersion,
  normalizeRoomId,
  setLocalMenuItemAvailability,
} from '@/services/cloud.js'

const ORDERS_STORAGE_KEY = 'gf_food_orders'
const USER_AVATAR_STORAGE_KEY = 'gf_food_user_avatar'
const USER_FAVORITES_STORAGE_KEY = 'gf_food_user_favorites'
const ROLE_STORAGE_KEY = 'gf_food_role'
const CHEF_AVATAR_STORAGE_KEY = 'gf_food_chef_avatar'
const RUSH_STORAGE_KEY = 'gf_food_rush_times'
const ORDERS_STORAGE_VERSION = 2
const LEGACY_ORDERS_ROOM_KEY = '__legacy__'

// 正在进行云端操作的订单ID集合（操作锁）
const pendingOperations = new Set()
const CHEF_ORDERS_POLL_INTERVAL = 5000
let menuRealtimeWatcher = null
let menuRoomVersionWatcher = null
let menuRealtimeRoomId = ''
let menuRealtimeSeq = 0
let isMenuMigrationRunning = false
const menuRealtimeOwners = new Set()
let chefOrdersPollTimer = null
let chefOrdersPollInFlight = false
const chefOrdersSyncOwners = new Set()

// 状态优先级：只允许前进，不允许回退
const STATUS_PRIORITY = { pending: 0, accepted: 1, cooking: 2, done: 3 }
const initialRoomId = getStoredRoomId()
let ordersRoomId = initialRoomId

const COUPON_DEFINITIONS = [
  {
    id: 1,
    name: '15分钟肩颈按摩券',
    desc: '累计投喂 20 次即可兑换',
    emoji: '💆‍♀️',
    color: '#FFF7E6',
    required: 20,
    available: false,
  },
  {
    id: 2,
    name: '免跑腿代买券',
    desc: '累计投喂 30 次即可兑换',
    emoji: '🛍️',
    color: '#F0F5FF',
    required: 30,
    available: false,
  },
  {
    id: 3,
    name: '指定电影陪看券',
    desc: '累计投喂 50 次即可兑换',
    emoji: '🎬',
    color: '#F6FFED',
    required: 50,
    available: false,
  },
]

function normalizeOrderRoomId(order) {
  return normalizeRoomId(order?.roomId || order?._roomId || '')
}

function emptyOrdersStorage() {
  return {
    version: ORDERS_STORAGE_VERSION,
    rooms: {},
  }
}

function normalizeOrdersStorage(saved) {
  if (Array.isArray(saved)) {
    const storage = emptyOrdersStorage()
    saved.forEach(order => {
      const roomId = normalizeOrderRoomId(order) || LEGACY_ORDERS_ROOM_KEY
      if (!storage.rooms[roomId]) storage.rooms[roomId] = []
      storage.rooms[roomId].push(order)
    })
    return storage
  }

  if (saved && typeof saved === 'object' && saved.rooms && typeof saved.rooms === 'object') {
    const storage = emptyOrdersStorage()
    Object.keys(saved.rooms).forEach(roomKey => {
      const normalizedRoomKey = roomKey === LEGACY_ORDERS_ROOM_KEY ? roomKey : normalizeRoomId(roomKey)
      if (!normalizedRoomKey || !Array.isArray(saved.rooms[roomKey])) return
      storage.rooms[normalizedRoomKey] = saved.rooms[roomKey]
    })
    return storage
  }

  return emptyOrdersStorage()
}

function readOrdersStorage() {
  try {
    if (typeof uni === 'undefined') return emptyOrdersStorage()
    const saved = uni.getStorageSync(ORDERS_STORAGE_KEY)
    return normalizeOrdersStorage(saved)
  } catch (error) {
    return emptyOrdersStorage()
  }
}

function readStoredOrders(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId)
  if (!normalizedRoomId) return []

  try {
    const storage = readOrdersStorage()
    return (storage.rooms[normalizedRoomId] || [])
      .map(order => {
        const orderRoomId = normalizeOrderRoomId(order)
        return {
          ...order,
          roomId: orderRoomId || normalizedRoomId,
        }
      })
      .filter(order => normalizeOrderRoomId(order) === normalizedRoomId)
  } catch (error) {
    return []
  }
}

function writeStoredOrders(orders, roomId) {
  try {
    if (typeof uni === 'undefined') return
    const normalizedRoomId = normalizeRoomId(roomId)
    if (!normalizedRoomId) return

    const storage = readOrdersStorage()
    storage.rooms[normalizedRoomId] = (Array.isArray(orders) ? orders : [])
      .filter(order => {
        const orderRoomId = normalizeOrderRoomId(order)
        return !orderRoomId || orderRoomId === normalizedRoomId
      })
      .map(order => ({
        ...order,
        roomId: normalizedRoomId,
      }))
    uni.setStorageSync(ORDERS_STORAGE_KEY, storage)
  } catch (error) {
    console.warn('保存订单历史失败', error)
  }
}

function readStoredAvatar() {
  try {
    if (typeof uni === 'undefined') return ''
    return uni.getStorageSync(USER_AVATAR_STORAGE_KEY) || ''
  } catch (error) {
    return ''
  }
}

function writeStoredAvatar(url) {
  try {
    if (typeof uni === 'undefined') return
    uni.setStorageSync(USER_AVATAR_STORAGE_KEY, url)
  } catch (error) {
    console.warn('保存头像失败', error)
  }
}

function emptyFavoritesStorage() {
  return {
    version: 1,
    rooms: {},
  }
}

function normalizeFavoriteId(itemId) {
  return itemId ? String(itemId) : ''
}

function normalizeFavoritesStorage(saved) {
  if (Array.isArray(saved)) {
    const storage = emptyFavoritesStorage()
    const roomId = initialRoomId || LEGACY_ORDERS_ROOM_KEY
    storage.rooms[roomId] = Array.from(new Set(saved.map(normalizeFavoriteId).filter(Boolean)))
    return storage
  }

  if (saved && typeof saved === 'object' && saved.rooms && typeof saved.rooms === 'object') {
    const storage = emptyFavoritesStorage()
    Object.keys(saved.rooms).forEach(roomKey => {
      const normalizedRoomKey = roomKey === LEGACY_ORDERS_ROOM_KEY ? roomKey : normalizeRoomId(roomKey)
      if (!normalizedRoomKey || !Array.isArray(saved.rooms[roomKey])) return
      storage.rooms[normalizedRoomKey] = Array.from(new Set(saved.rooms[roomKey].map(normalizeFavoriteId).filter(Boolean)))
    })
    return storage
  }

  return emptyFavoritesStorage()
}

function readFavoritesStorage() {
  try {
    if (typeof uni === 'undefined') return emptyFavoritesStorage()
    const saved = uni.getStorageSync(USER_FAVORITES_STORAGE_KEY)
    return normalizeFavoritesStorage(saved)
  } catch (error) {
    return emptyFavoritesStorage()
  }
}

function readStoredFavorites(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId)
  if (!normalizedRoomId) return []

  const storage = readFavoritesStorage()
  return Array.from(new Set((storage.rooms[normalizedRoomId] || []).map(normalizeFavoriteId).filter(Boolean)))
}

function writeStoredFavorites(itemIds, roomId) {
  try {
    if (typeof uni === 'undefined') return
    const normalizedRoomId = normalizeRoomId(roomId)
    if (!normalizedRoomId) return

    const storage = readFavoritesStorage()
    storage.rooms[normalizedRoomId] = Array.from(new Set((Array.isArray(itemIds) ? itemIds : []).map(normalizeFavoriteId).filter(Boolean)))
    uni.setStorageSync(USER_FAVORITES_STORAGE_KEY, storage)
  } catch (error) {
    console.warn('保存收藏菜品失败', error)
  }
}

function readStoredRole() {
  try {
    if (typeof uni === 'undefined') return ''
    return uni.getStorageSync(ROLE_STORAGE_KEY) || ''
  } catch (error) {
    return ''
  }
}

function writeStoredRole(role) {
  try {
    if (typeof uni === 'undefined') return
    uni.setStorageSync(ROLE_STORAGE_KEY, role)
  } catch (error) {
    console.warn('保存角色失败', error)
  }
}

function readStoredChefAvatar() {
  try {
    if (typeof uni === 'undefined') return ''
    return uni.getStorageSync(CHEF_AVATAR_STORAGE_KEY) || ''
  } catch (error) {
    return ''
  }
}

function writeStoredChefAvatar(url) {
  try {
    if (typeof uni === 'undefined') return
    uni.setStorageSync(CHEF_AVATAR_STORAGE_KEY, url)
  } catch (error) {
    console.warn('保存主厨头像失败', error)
  }
}

// 催单时间本地缓存
function readRushTimes() {
  try {
    if (typeof uni === 'undefined') return {}
    const data = uni.getStorageSync(RUSH_STORAGE_KEY)
    return data && typeof data === 'object' ? data : {}
  } catch (e) {
    return {}
  }
}

function writeRushTimes(data) {
  try {
    if (typeof uni === 'undefined') return
    uni.setStorageSync(RUSH_STORAGE_KEY, data)
  } catch (e) {
    console.warn('保存催单时间失败', e)
  }
}

function cloneCartItem(item) {
  return {
    id: item._id || item.id,
    name: item.name,
    desc: item.desc,
    fullDesc: item.fullDesc || '',
    category: item.category,
    emoji: item.emoji,
    image: item.image,
    price: item.price,
    qty: item.qty,
    options: {
      sweet: item.options?.sweet || '',
      extras: Array.isArray(item.options?.extras)
        ? [...item.options.extras]
        : (item.options?.extra ? [item.options.extra] : []),
      note: item.options?.note || '',
    },
  }
}

// 全局共享状态
const store = reactive({
  // 当前角色: 'customer' | 'chef' | '' (未选择)
  currentRole: readStoredRole(),

  // 登录态
  isLoggedIn: !!cloudCheckLogin(),
  openid: cloudCheckLogin()?.openid || '',

  // 房间号
  roomId: initialRoomId,
  roomInfo: null,

  // 菜品数据（初始为默认数据，云端加载后替换）
  menuItems: getDefaultMenuItems(),

  // 菜品是否已从云端加载
  menuLoaded: false,

  // 订单是否已从云端加载
  ordersLoaded: false,

  // 分类数据
  categories: [
    { id: 'hot', name: '热销', emoji: '🔥', color: '#FFF1F0' },
    { id: 'dessert', name: '甜点', emoji: '🍰', color: '#FFF7E6' },
    { id: 'drink', name: '饮品', emoji: '🥤', color: '#E6FFFB' },
    { id: 'carb', name: '碳水', emoji: '🍜', color: '#F0F5FF' },
    { id: 'light', name: '轻食', emoji: '🥗', color: '#F6FFED' },
  ],

  // 侧栏分类（菜单页用）
  sideCategories: [
    { id: 'hot', name: '全部菜品', active: true },
    { id: 'dessert', name: '🍰 甜点', active: false },
    { id: 'drink', name: '🥤 饮品', active: false },
    { id: 'carb', name: '🍜 面食', active: false },
    { id: 'light', name: '🥗 轻食', active: false },
    { id: 'warm', name: '🍵 暖饮', active: false },
  ],

  // 购物车数据
  cart: [],

  // 已下单历史（带状态）
  orders: readStoredOrders(initialRoomId),

  // 当前房间收藏菜品 id
  favoriteItemIds: readStoredFavorites(initialRoomId),

  // 催单时间记录 { orderId: lastRushTimeISO }
  rushTimes: readRushTimes(),

  // 用户信息（客户端）
  user: {
    name: '小可爱',
    avatarUrl: readStoredAvatar(),
    feedCount: 0,
    privileges: 0,
    favorites: 0,
    dislikes: ['香菜', '苦瓜'],
    allergies: '无',
  },

  // 主厨信息（服务端）
  chef: {
    name: '专属大厨',
    avatarUrl: readStoredChefAvatar(),
    totalOrders: 0,
    todayOrders: 0,
    todayCompleted: 0,
  },

  // 特权兑换券
  coupons: COUPON_DEFINITIONS.map(coupon => ({ ...coupon })),

  // 订单备注
  cartNote: '',

  // 催单通知队列（主厨端用）
  rushNotifications: [],

  // 当前正在展示的催单通知（主厨端所有页面共用）
  activeRushNotification: null,
})

refreshUserStats()

export function refreshUserStats() {
  const currentRoomId = normalizeRoomId(store.roomId)
  const feedCount = currentRoomId
    ? store.orders.filter((order) => normalizeOrderRoomId(order) === currentRoomId).length
    : 0

  store.user.feedCount = feedCount
  store.user.favorites = store.favoriteItemIds.length
  store.coupons.forEach((coupon) => {
    coupon.available = feedCount >= coupon.required
  })
  store.user.privileges = store.coupons.filter((coupon) => coupon.available).length
}

// ========== 登录管理 ==========

export function setLoginState(openid) {
  store.isLoggedIn = true
  store.openid = openid
}

export function clearLoginState() {
  store.isLoggedIn = false
  store.openid = ''
  cloudLogout()
}

export function isLoggedIn() {
  return store.isLoggedIn
}

// ========== 角色管理 ==========

export function setRole(role) {
  store.currentRole = role
  writeStoredRole(role)
}

export function getRole() {
  return store.currentRole
}

export function clearRole() {
  store.currentRole = ''
  writeStoredRole('')
}

function replaceStoreOrders(orders, roomId = store.roomId) {
  store.orders.splice(0, store.orders.length, ...(Array.isArray(orders) ? orders : []))
  ordersRoomId = normalizeRoomId(roomId)
  refreshUserStats()
}

function ensureOrdersForCurrentRoom() {
  const currentRoomId = normalizeRoomId(store.roomId)
  if (ordersRoomId === currentRoomId) return
  replaceStoreOrders(readStoredOrders(currentRoomId), currentRoomId)
  store.ordersLoaded = false
}

function persistCurrentRoomOrders() {
  writeStoredOrders(store.orders, store.roomId)
}

function isCurrentRoomOrder(order) {
  const currentRoomId = normalizeRoomId(store.roomId)
  if (!currentRoomId) return false
  return normalizeOrderRoomId(order) === currentRoomId
}

// ========== 房间管理 ==========

export function setRoomId(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId)
  const roomChanged = store.roomId !== normalizedRoomId
  if (store.roomId && roomChanged) {
    stopAllMenuRealtimeSync()
  }
  store.roomId = normalizedRoomId
  setStoredRoomId(normalizedRoomId)
  if (roomChanged) {
    store.favoriteItemIds.splice(0, store.favoriteItemIds.length, ...readStoredFavorites(normalizedRoomId))
    store.menuItems = []
    store.menuLoaded = false
    replaceStoreOrders(readStoredOrders(normalizedRoomId), normalizedRoomId)
    store.ordersLoaded = false
    clearCart()
  }
}

export function getRoomId() {
  return store.roomId
}

export function clearRoomId() {
  stopAllMenuRealtimeSync()
  store.roomId = ''
  store.roomInfo = null
  store.favoriteItemIds.splice(0, store.favoriteItemIds.length)
  replaceStoreOrders([], '')
  store.ordersLoaded = false
  clearCart()
  clearStoredRoomId()
}

export function setRoomInfo(info) {
  store.roomInfo = info
}

// ========== 菜品云端操作 ==========

async function applyCloudMenuItems(items, source = 'fetch', shouldAssign = true) {
  // 检查是否有本地图片路径需要迁移
  const hasLocalImages = items.some(item => item.image && item.image.startsWith('/static/'))
  if (hasLocalImages && isCloudAvailable() && !isMenuMigrationRunning) {
    console.log('[Store] 检测到本地图片路径，开始自动迁移到云存储...')
    isMenuMigrationRunning = true
    migrateLocalImagesToCloud(store.roomId).then(result => {
      if (result.migrated > 0) {
        console.log(`[Store] 图片迁移完成: ${result.migrated} 张成功`)
        // 迁移完成后重新加载
        loadMenuFromCloud()
      }
    }).catch(e => {
      console.warn('[Store] 图片迁移异常:', e)
    }).finally(() => {
      isMenuMigrationRunning = false
    })
  }

  // 解析云端图片链接（cloud:// -> 临时访问 URL）
  await resolveMenuImages(items)
  if (shouldAssign) {
    store.menuItems = items
  }
  store.menuLoaded = true
  console.log('[Store] 菜品已加载，共', items.length, '道, roomId:', store.roomId, 'source:', source)
  return items
}

/**
 * 从云端加载菜品到 store
 */
export async function loadMenuFromCloud() {
  try {
    const items = await cloudFetchMenuItems(store.roomId)
    return await applyCloudMenuItems(items, 'fetch')
  } catch (e) {
    console.error('[Store] 加载菜品失败:', e)
    return store.menuItems
  }
}

/**
 * 启动菜品实时同步。失败时返回 false，页面轮询会继续兜底。
 */
export function startMenuRealtimeSync(owner = 'default') {
  if (!store.roomId || !isCloudAvailable()) return false
  if (owner) {
    menuRealtimeOwners.add(owner)
  }

  if (menuRealtimeWatcher && menuRealtimeRoomId === store.roomId) {
    return true
  }

  closeMenuRealtimeWatchers()
  menuRealtimeRoomId = store.roomId

  menuRoomVersionWatcher = cloudWatchRoomMenuVersion(
    store.roomId,
    async () => {
      const seq = ++menuRealtimeSeq
      try {
        const items = await cloudFetchMenuItems(store.roomId)
        const appliedItems = await applyCloudMenuItems(items, 'room-watch', false)
        if (seq === menuRealtimeSeq) {
          store.menuItems = appliedItems
        }
      } catch (e) {
        console.warn('[Store] 房间菜单版本同步失败:', e)
      }
    },
    (error) => {
      console.warn('[Store] 房间菜单版本监听失败，保留轮询兜底:', error)
      closeRoomVersionWatcher()
    }
  )

  menuRealtimeWatcher = cloudWatchMenuItems(
    store.roomId,
    async (items) => {
      const seq = ++menuRealtimeSeq
      try {
        const appliedItems = await applyCloudMenuItems(items, 'watch', false)
        if (seq === menuRealtimeSeq) {
          store.menuItems = appliedItems
        }
      } catch (e) {
        console.warn('[Store] 菜品实时同步处理失败:', e)
      }
    },
    (error) => {
      console.warn('[Store] 菜品集合监听失败，继续使用房间版本监听和轮询兜底:', error)
      closeMenuItemsWatcher()
    }
  )

  return !!menuRealtimeWatcher || !!menuRoomVersionWatcher
}

export function stopMenuRealtimeSync(owner = 'default') {
  if (owner) {
    menuRealtimeOwners.delete(owner)
    if (menuRealtimeOwners.size > 0) return
  }
  closeMenuRealtimeWatchers()
}

export function stopAllMenuRealtimeSync() {
  menuRealtimeOwners.clear()
  closeMenuRealtimeWatchers()
}

function closeMenuRealtimeWatchers() {
  closeRoomVersionWatcher()
  closeMenuItemsWatcher()
  menuRealtimeRoomId = ''
}

function closeMenuItemsWatcher() {
  if (!menuRealtimeWatcher) return
  try {
    menuRealtimeWatcher.close()
  } catch (e) {
    console.warn('[Store] 关闭菜品实时监听失败:', e)
  } finally {
    menuRealtimeWatcher = null
  }
}

function closeRoomVersionWatcher() {
  if (!menuRoomVersionWatcher) return
  try {
    menuRoomVersionWatcher.close()
  } catch (e) {
    console.warn('[Store] 关闭房间菜单版本监听失败:', e)
  } finally {
    menuRoomVersionWatcher = null
  }
}

/**
 * 新增菜品到云端
 */
export async function addMenuItemToCloud(data) {
  const id = await cloudAddMenuItem(data, store.roomId)
  if (id) {
    // 刷新列表
    await loadMenuFromCloud()
  }
  return id
}

export async function uploadMenuImageToCloud(filePath) {
  const roomDir = store.roomId ? `menu-images/${store.roomId}` : 'menu-images/default'
  return await cloudUploadImage(filePath, roomDir)
}

/**
 * 更新云端菜品
 */
export async function updateMenuItemInCloud(id, data) {
  const success = await cloudUpdateMenuItem(id, data, store.roomId)
  if (success) {
    // 更新后立即以云端为准刷新一次，点餐端则由 watch/轮询同步。
    await loadMenuFromCloud()
  }
  return success
}

/**
 * 删除云端菜品
 */
export async function deleteMenuItemFromCloud(id) {
  const success = await cloudDeleteMenuItem(id, store.roomId)
  if (success) {
    const idx = store.menuItems.findIndex(m => m._id === id)
    if (idx !== -1) {
      store.menuItems.splice(idx, 1)
    }
  }
  return success
}

/**
 * 切换菜品上下架（云端持久化）
 */
export async function toggleItemAvailability(itemId) {
  const item = store.menuItems.find(m => (m._id || m.id) === itemId)
  if (!item) return null

  const newAvail = !(item.available !== false)
  item.available = newAvail // 先乐观更新
  const itemKey = item._id || item.id || itemId
  const isLocalDefaultItem = String(itemKey).startsWith('local_')

  if (isLocalDefaultItem) {
    setLocalMenuItemAvailability(itemKey, newAvail)
    return newAvail
  }

  if (isCloudAvailable()) {
    const success = await cloudToggleAvailability(item._id, newAvail, store.roomId)
    if (!success) {
      // 回滚
      item.available = !newAvail
      return null
    }
    await loadMenuFromCloud()
    return newAvail
  }
  return newAvail
}

async function syncChefOrdersFromCloud() {
  if (chefOrdersPollInFlight || store.currentRole !== 'chef' || !store.roomId) return
  chefOrdersPollInFlight = true
  try {
    await loadOrdersFromCloud()
  } finally {
    chefOrdersPollInFlight = false
  }
}

export function startChefOrdersSync(owner = 'default') {
  if (owner) {
    chefOrdersSyncOwners.add(owner)
  }
  syncChefOrdersFromCloud()
  if (!chefOrdersPollTimer) {
    chefOrdersPollTimer = setInterval(syncChefOrdersFromCloud, CHEF_ORDERS_POLL_INTERVAL)
  }
}

export function stopChefOrdersSync(owner = 'default') {
  if (owner) {
    chefOrdersSyncOwners.delete(owner)
    if (chefOrdersSyncOwners.size > 0) return
  }
  if (chefOrdersPollTimer) {
    clearInterval(chefOrdersPollTimer)
    chefOrdersPollTimer = null
  }
}

// ========== 订单云端操作 ==========

/**
 * 从云端加载订单到 store
 */
export async function loadOrdersFromCloud() {
  ensureOrdersForCurrentRoom()
  const roomId = normalizeRoomId(store.roomId)
  if (!roomId) {
    replaceStoreOrders([], '')
    store.ordersLoaded = true
    return store.orders
  }

  try {
    const cloudOrders = await cloudFetchOrders(roomId)
    if (cloudOrders !== null) {
      // 云端有数据，合并本地
      const localMap = {}
      store.orders.forEach(o => { localMap[o.id] = o })

      cloudOrders.forEach(co => {
        const cloudRoomId = normalizeOrderRoomId(co) || roomId
        if (cloudRoomId !== roomId) return
        const localId = co.id || co._id

        // 跳过正在操作中的订单，避免覆盖乐观更新
        if (pendingOperations.has(localId)) {
          console.log('[Store] 跳过合并（操作锁中）:', localId)
          return
        }

        if (localMap[localId]) {
          const local = localMap[localId]
          // 检测催单通知（仅主厨端关心）
          if (store.currentRole === 'chef') {
            const oldRushCount = local.rushCount || 0
            const newRushCount = co.rushCount || 0
            if (newRushCount > oldRushCount) {
              // 有新催单！推入通知队列
              enqueueRushNotification({
                orderId: localId,
                orderShortId: localId.slice(-6),
                rushCount: newRushCount,
                rushTime: co.rushLastTime || new Date().toISOString(),
                items: (local.items || co.items || []).map(i => i.name).slice(0, 3).join('、'),
                timestamp: Date.now(),
              })
            }
          }

          // 状态优先级保护：只允许前进，不允许回退
          const cloudPriority = STATUS_PRIORITY[co.status] ?? -1
          const localPriority = STATUS_PRIORITY[local.status] ?? -1
          const mergedStatus = cloudPriority >= localPriority ? co.status : local.status

          // 更新本地记录的云端字段
          Object.assign(local, {
            roomId,
            _cloudId: co._id,
            status: mergedStatus,
            acceptedAt: cloudPriority >= 1 ? (co.acceptedAt || local.acceptedAt) : local.acceptedAt,
            cookingAt: cloudPriority >= 2 ? (co.cookingAt || local.cookingAt) : local.cookingAt,
            completedAt: cloudPriority >= 3 ? (co.completedAt || local.completedAt) : local.completedAt,
            rushLastTime: co.rushLastTime || null,
            rushCount: co.rushCount || 0,
          })
        } else {
          // 云端有但本地没有，添加到本地
          store.orders.push({
            ...co,
            roomId,
            _cloudId: co._id,
          })
        }
      })

      persistCurrentRoomOrders()
      refreshUserStats()
      store.ordersLoaded = true
      console.log('[Store] 订单已从云端同步')
    }
    return store.orders
  } catch (e) {
    console.error('[Store] 加载订单失败:', e)
    return store.orders
  }
}

function promoteNextRushNotification() {
  if (!store.activeRushNotification) {
    store.activeRushNotification = store.rushNotifications.shift() || null
  }
}

function hasRushNotification(notification) {
  const sameNotification = (item) => (
    item &&
    item.orderId === notification.orderId &&
    item.rushCount === notification.rushCount
  )
  return sameNotification(store.activeRushNotification) || store.rushNotifications.some(sameNotification)
}

export function enqueueRushNotification(notification) {
  if (!notification || hasRushNotification(notification)) return
  if (store.activeRushNotification) {
    store.rushNotifications.push(notification)
  } else {
    store.activeRushNotification = notification
  }
}

/**
 * 兼容旧页面的消费方法。新页面应读取 activeRushNotification，避免隐藏页面抢占通知。
 */
export function popRushNotification() {
  const notification = store.activeRushNotification || store.rushNotifications.shift() || null
  store.activeRushNotification = null
  promoteNextRushNotification()
  return notification
}

export function dismissRushNotification() {
  store.activeRushNotification = null
  setTimeout(promoteNextRushNotification, 300)
}

/**
 * 清空所有催单通知
 */
export function clearRushNotifications() {
  store.activeRushNotification = null
  store.rushNotifications.splice(0, store.rushNotifications.length)
}

// ========== 购物车操作 ==========

export function addToCart(item, options = {}) {
  const itemId = item._id || item.id
  const existing = store.cart.find(
    (c) => (c._id || c.id) === itemId && JSON.stringify(c.options) === JSON.stringify(options)
  )
  if (existing) {
    existing.qty++
  } else {
    store.cart.push({
      ...item,
      qty: 1,
      options: options,
    })
  }
}

export function removeFromCart(index) {
  store.cart.splice(index, 1)
}

export function updateCartQty(index, delta) {
  const item = store.cart[index]
  if (!item) return
  item.qty += delta
  if (item.qty <= 0) {
    store.cart.splice(index, 1)
  }
}

export function getCartTotal() {
  return store.cart.reduce((sum, item) => sum + item.qty, 0)
}

export function clearCart() {
  store.cart.splice(0, store.cart.length)
  store.cartNote = ''
}

export async function createOrderFromCart() {
  ensureOrdersForCurrentRoom()
  if (store.cart.length === 0) return null

  const now = new Date()
  const order = {
    id: `GF${now.getTime()}`,
    roomId: store.roomId,
    createdAt: now.toISOString(),
    note: store.cartNote,
    totalCount: getCartTotal(),
    status: 'pending', // pending -> accepted -> cooking -> done
    acceptedAt: null,
    cookingAt: null,
    completedAt: null,
    rushLastTime: null,
    rushCount: 0,
    items: store.cart.map(cloneCartItem),
  }

  store.orders.unshift(order)
  persistCurrentRoomOrders()
  refreshUserStats()
  clearCart()

  // 异步上传到云端（不阻塞UI）
  try {
    const cloudId = await cloudAddOrder(order, store.roomId)
    if (cloudId) {
      order._cloudId = cloudId
      persistCurrentRoomOrders()
    }
  } catch (e) {
    console.warn('[Store] 订单上传云端失败，仅保存本地', e)
  }

  return order
}

export function clearOrders() {
  ensureOrdersForCurrentRoom()
  store.orders.splice(0, store.orders.length)
  persistCurrentRoomOrders()
  refreshUserStats()
}

export function updateUserAvatar(url) {
  store.user.avatarUrl = url || ''
  writeStoredAvatar(store.user.avatarUrl)
}

export function getCurrentRoomFavoriteIds() {
  return store.favoriteItemIds
}

export function isFavoriteItem(itemId) {
  const normalizedItemId = normalizeFavoriteId(itemId)
  return !!normalizedItemId && store.favoriteItemIds.includes(normalizedItemId)
}

export function toggleFavoriteItem(itemId) {
  const normalizedItemId = normalizeFavoriteId(itemId)
  if (!normalizedItemId || !store.roomId) return false

  const existingIndex = store.favoriteItemIds.indexOf(normalizedItemId)
  if (existingIndex >= 0) {
    store.favoriteItemIds.splice(existingIndex, 1)
  } else {
    store.favoriteItemIds.push(normalizedItemId)
  }

  writeStoredFavorites(store.favoriteItemIds, store.roomId)
  refreshUserStats()
  return existingIndex < 0
}

// ========== 主厨端操作 ==========

export async function acceptOrder(orderId) {
  ensureOrdersForCurrentRoom()
  const order = store.orders.find((o) => o.id === orderId && isCurrentRoomOrder(o))
  if (order && order.status === 'pending') {
    const prevStatus = order.status
    const prevAcceptedAt = order.acceptedAt
    pendingOperations.add(orderId) // 加锁
    try {
      order.status = 'accepted'
      order.acceptedAt = new Date().toISOString()
      persistCurrentRoomOrders()

      // 同步到云端
      if (order._cloudId) {
        const success = await updateOrderInCloud(order._cloudId, {
          status: 'accepted',
          acceptedAt: order.acceptedAt,
        })
        if (!success) {
          // 云端更新失败，回滚本地状态
          console.error('[Store] 接单云端同步失败，回滚本地状态')
          order.status = prevStatus
          order.acceptedAt = prevAcceptedAt
          persistCurrentRoomOrders()
          return false
        }
      }
    } finally {
      pendingOperations.delete(orderId) // 解锁
    }
    // 操作后主动同步一次，确保本地与云端一致
    loadOrdersFromCloud()
    return true
  }
  return false
}

export async function startCooking(orderId) {
  ensureOrdersForCurrentRoom()
  const order = store.orders.find((o) => o.id === orderId && isCurrentRoomOrder(o))
  if (order && order.status === 'accepted') {
    const prevStatus = order.status
    const prevCookingAt = order.cookingAt
    pendingOperations.add(orderId) // 加锁
    try {
      order.status = 'cooking'
      order.cookingAt = new Date().toISOString()
      persistCurrentRoomOrders()

      // 同步到云端
      if (order._cloudId) {
        const success = await updateOrderInCloud(order._cloudId, {
          status: 'cooking',
          cookingAt: order.cookingAt,
        })
        if (!success) {
          console.error('[Store] 开始制作云端同步失败，回滚本地状态')
          order.status = prevStatus
          order.cookingAt = prevCookingAt
          persistCurrentRoomOrders()
          return false
        }
      }
    } finally {
      pendingOperations.delete(orderId) // 解锁
    }
    // 操作后主动同步一次
    loadOrdersFromCloud()
    return true
  }
  return false
}

export async function completeOrder(orderId) {
  ensureOrdersForCurrentRoom()
  const order = store.orders.find((o) => o.id === orderId && isCurrentRoomOrder(o))
  if (order && (order.status === 'cooking' || order.status === 'accepted')) {
    const prevStatus = order.status
    const prevCompletedAt = order.completedAt
    pendingOperations.add(orderId) // 加锁
    try {
      order.status = 'done'
      order.completedAt = new Date().toISOString()
      store.chef.todayCompleted += 1
      persistCurrentRoomOrders()

      // 同步到云端
      if (order._cloudId) {
        const success = await updateOrderInCloud(order._cloudId, {
          status: 'done',
          completedAt: order.completedAt,
        })
        if (!success) {
          console.error('[Store] 完成制作云端同步失败，回滚本地状态')
          order.status = prevStatus
          order.completedAt = prevCompletedAt
          store.chef.todayCompleted -= 1
          persistCurrentRoomOrders()
          return false
        }
      }
    } finally {
      pendingOperations.delete(orderId) // 解锁
    }
    // 操作后主动同步一次
    loadOrdersFromCloud()
    return true
  }
  return false
}

export function updateChefAvatar(url) {
  store.chef.avatarUrl = url || ''
  writeStoredChefAvatar(store.chef.avatarUrl)
}

// ========== 催单操作 ==========

const RUSH_COOLDOWN_MS = 10 * 60 * 1000 // 10分钟

/**
 * 获取指定订单的催单冷却剩余时间（毫秒）
 * 返回 0 表示可以催单
 */
export function getRushCooldownRemaining(orderId) {
  const lastTime = store.rushTimes[orderId]
  if (!lastTime) return 0
  const elapsed = Date.now() - new Date(lastTime).getTime()
  const remaining = RUSH_COOLDOWN_MS - elapsed
  return remaining > 0 ? remaining : 0
}

/**
 * 催单操作
 * @returns {Promise<{success: boolean, message: string, cooldownRemaining?: number}>}
 */
export async function rushOrderAction(orderId) {
  ensureOrdersForCurrentRoom()
  const remaining = getRushCooldownRemaining(orderId)
  if (remaining > 0) {
    const mins = Math.ceil(remaining / 60000)
    return {
      success: false,
      message: `催单太频繁啦～ 请${mins}分钟后再试`,
      cooldownRemaining: remaining,
    }
  }

  const order = store.orders.find(o => o.id === orderId && isCurrentRoomOrder(o))
  if (!order) {
    return { success: false, message: '订单不存在' }
  }

  if (order.status === 'done') {
    return { success: false, message: '订单已完成，无需催单' }
  }

  // 记录催单时间
  const nowISO = new Date().toISOString()
  store.rushTimes[orderId] = nowISO
  writeRushTimes(store.rushTimes)

  // 更新本地订单催单信息
  order.rushLastTime = nowISO
  order.rushCount = (order.rushCount || 0) + 1
  persistCurrentRoomOrders()

  // 同步到云端
  if (order._cloudId) {
    await rushOrderInCloud(order._cloudId)
  }

  return { success: true, message: '催单成功！主厨已收到提醒 💨' }
}

// 获取可用菜品（客户端过滤）
export function getAvailableItems() {
  return store.menuItems.filter((item) => item.available !== false)
}

// 获取当前房间订单
export function getCurrentRoomOrders() {
  ensureOrdersForCurrentRoom()
  return store.orders.filter((o) => isCurrentRoomOrder(o))
}

// 获取各状态订单
export function getOrdersByStatus(status) {
  ensureOrdersForCurrentRoom()
  return store.orders.filter((o) => isCurrentRoomOrder(o) && o.status === status)
}

// 获取今日订单
export function getTodayOrders() {
  ensureOrdersForCurrentRoom()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return store.orders.filter((o) => {
    if (!isCurrentRoomOrder(o)) return false
    const d = new Date(o.createdAt)
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return dStr === todayStr
  })
}

// 云端图片操作（供页面调用）
export { uploadMenuImageToCloud as uploadImageToCloud, resolveImageUrl }

export default store
