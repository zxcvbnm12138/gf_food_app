import { reactive } from 'vue'
import {
  fetchMenuItems as cloudFetchMenuItems,
  fetchMenuCategories as cloudFetchMenuCategories,
  fetchMenuSnapshot as cloudFetchMenuSnapshot,
  addMenuCategory as cloudAddMenuCategory,
  deleteMenuCategory as cloudDeleteMenuCategory,
  fetchCustomCoupons as cloudFetchCustomCoupons,
  addCustomCoupon as cloudAddCustomCoupon,
  deleteCustomCoupon as cloudDeleteCustomCoupon,
  redeemCustomCoupon as cloudRedeemCustomCoupon,
  fetchRecipes as cloudFetchRecipes,
  addRecipe as cloudAddRecipe,
  updateRecipe as cloudUpdateRecipe,
  deleteRecipe as cloudDeleteRecipe,
  deleteRecipesByRoom as cloudDeleteRecipesByRoom,
  addMenuItem as cloudAddMenuItem,
  updateMenuItem as cloudUpdateMenuItem,
  deleteMenuItem as cloudDeleteMenuItem,
  toggleMenuItemAvailability as cloudToggleAvailability,
  getDefaultMenuItems,
  getDefaultMenuCategories,
  checkLogin as cloudCheckLogin,
  logout as cloudLogout,
  isCloudAvailable,
  addOrder as cloudAddOrder,
  fetchOrders as cloudFetchOrders,
  deleteOrdersByRoom as cloudDeleteOrdersByRoom,
  deleteMenuItemsByRoom as cloudDeleteMenuItemsByRoom,
  updateOrderInCloud,
  rushOrderInCloud,
  getStoredRoomId,
  setStoredRoomId,
  clearStoredRoomId,
  resolveMenuImages,
  resolveRecipePhotos,
  normalizeRecipe,
  uploadImageToCloud as cloudUploadImage,
  resolveImageUrl,
  migrateLocalImagesToCloud,
  watchMenuItems as cloudWatchMenuItems,
  watchRoomMenuVersion as cloudWatchRoomMenuVersion,
  watchOrders as cloudWatchOrders,
  normalizeRoomId,
  setLocalMenuItemAvailability,
  fetchRoomUserPreferences as cloudFetchRoomUserPreferences,
  saveRoomUserPreferences as cloudSaveRoomUserPreferences,
  normalizePreferenceList,
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
const CHEF_ORDERS_POLL_INTERVAL = 15000
const CHEF_ORDERS_POLL_FALLBACK_INTERVAL = 300000 // watch 成功时的兜底轮询间隔：5分钟
let menuRealtimeWatcher = null
let menuRoomVersionWatcher = null
let menuRealtimeRoomId = ''
let menuRealtimeSeq = 0
let isMenuMigrationRunning = false
let lastMigrationTime = 0
const menuRealtimeOwners = new Set()
let chefOrdersPollTimer = null
let chefOrdersPollInFlight = false
const chefOrdersSyncOwners = new Set()
let orderRealtimeWatcher = null
let orderRealtimeRoomId = ''
let orderRealtimeSeq = 0
const orderRealtimeOwners = new Set()
const defaultMenuCategories = getDefaultMenuCategories()

// 状态优先级：只允许前进，不允许回退
const STATUS_PRIORITY = { pending: 0, accepted: 1, cooking: 2, done: 3 }
const initialLogin = cloudCheckLogin()
const initialRoomId = getStoredRoomId()
const initialOpenid = initialLogin?.openid || ''
let ordersRoomId = initialRoomId
let userPreferenceSyncSeq = 0

function normalizeCoupon(coupon) {
  if (!coupon) return null
  const name = String(coupon.name || '').trim()
  const required = Math.max(0, Number(coupon.required) || 0)
  if (!name || !required) return null
  return {
    id: coupon.id || `coupon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    desc: coupon.desc || `累计投喂 ${required} 次即可兑换`,
    emoji: String(coupon.emoji || '🎁').trim() || '🎁',
    color: coupon.color || '#FFF1F0',
    required,
    available: false,
    redeemed: coupon.redeemed === true,
    redeemedAt: coupon.redeemedAt || null,
    redeemedBy: String(coupon.redeemedBy || '').trim(),
    custom: coupon.custom === true,
    roomId: normalizeRoomId(coupon.roomId || ''),
    _id: coupon._id || '',
  }
}

let pendingMenuCategoryId = ''
let pendingMenuSearchFocus = false

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
    dislikeKeywords: Array.isArray(item.dislikeKeywords) ? [...item.dislikeKeywords] : [],
    allergyKeywords: Array.isArray(item.allergyKeywords) ? [...item.allergyKeywords] : [],
    ingredientTags: Array.isArray(item.ingredientTags) ? [...item.ingredientTags] : [],
    riskTags: Array.isArray(item.riskTags) ? [...item.riskTags] : [],
    optionGroups: getMenuItemOptionGroups(item),
    options: {
      sweet: item.options?.sweet || '',
      extras: Array.isArray(item.options?.extras)
        ? [...item.options.extras]
        : (item.options?.extra ? [item.options.extra] : []),
      groups: Array.isArray(item.options?.groups)
        ? item.options.groups.map(group => ({
          label: group.label || '',
          values: Array.isArray(group.values) ? [...group.values] : [],
        })).filter(group => group.label && group.values.length > 0)
        : [],
      note: item.options?.note || '',
    },
  }
}

function buildSideCategories(categories) {
  return [
    { id: 'all', name: '全部菜品', active: true },
    ...(Array.isArray(categories) ? categories : []).map(category => ({
      id: category.id,
      name: `${category.emoji ? category.emoji + ' ' : ''}${category.name}`,
      emoji: category.emoji || '',
      active: false,
    })),
  ]
}

function setStoreCategories(categories) {
  const nextCategories = Array.isArray(categories) && categories.length > 0
    ? categories
    : getDefaultMenuCategories()

  store.categories.splice(0, store.categories.length, ...nextCategories.map(category => ({ ...category })))
  store.sideCategories.splice(0, store.sideCategories.length, ...buildSideCategories(nextCategories))
}

// 全局共享状态
const store = reactive({
  // 当前角色: 'customer' | 'chef' | '' (未选择)
  currentRole: readStoredRole(),

  // 登录态
  isLoggedIn: !!initialLogin,
  openid: initialOpenid,

  // 房间号
  roomId: initialRoomId,
  roomInfo: null,

  // 菜品数据（初始为默认数据，云端加载后替换）
  menuItems: getDefaultMenuItems(),

  // 菜品是否已从云端加载
  menuLoaded: false,

  recipes: [],
  recipesLoaded: false,

  // 订单是否已从云端加载
  ordersLoaded: false,

  // 分类数据
  categories: defaultMenuCategories.map(category => ({ ...category })),

  // 侧栏分类（菜单页用）
  sideCategories: buildSideCategories(defaultMenuCategories),

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
    dislikes: [],
    allergies: [],
  },

  // 主厨信息（服务端）
  chef: {
    name: '专属大厨',
    avatarUrl: readStoredChefAvatar(),
    totalOrders: 0,
    todayOrders: 0,
    todayCompleted: 0,
  },

  // 特权兑换券：只展示云端数据
  coupons: [],

  // 订单备注
  cartNote: '',

  // 催单通知队列（主厨端用）
  rushNotifications: [],

  // 当前正在展示的催单通知（主厨端所有页面共用）
  activeRushNotification: null,
})

function normalizeStoredUserPreferences(preferences = {}) {
  return {
    dislikes: normalizePreferenceList(preferences.dislikes),
    allergies: normalizePreferenceList(preferences.allergies),
  }
}

function applyUserPreferencesToStore(preferences) {
  const next = normalizeStoredUserPreferences(preferences)
  store.user.dislikes = [...next.dislikes]
  store.user.allergies = [...next.allergies]

  return next
}

function resetUserPreferencesToDefaults() {
  return applyUserPreferencesToStore({})
}

export async function loadCurrentRoomUserPreferences() {
  const roomId = normalizeRoomId(store.roomId)
  const openid = String(store.openid || '').trim()

  if (!roomId || !openid) {
    return resetUserPreferencesToDefaults()
  }

  const seq = ++userPreferenceSyncSeq
  resetUserPreferencesToDefaults()

  if (!isCloudAvailable()) {
    return resetUserPreferencesToDefaults()
  }

  try {
    const cloudPreferences = await cloudFetchRoomUserPreferences(roomId, openid)
    if (seq !== userPreferenceSyncSeq) {
      return normalizeStoredUserPreferences(store.user)
    }
    return applyUserPreferencesToStore(cloudPreferences || {})
  } catch (e) {
    console.warn('[Store] 加载房间偏好失败，已清空本地展示', e)
  }

  return resetUserPreferencesToDefaults()
}

export async function saveCurrentRoomUserPreferences(preferences = {}) {
  const roomId = normalizeRoomId(store.roomId)
  const openid = String(store.openid || '').trim()
  if (!roomId || !openid) {
    return null
  }

  const basePreferences = normalizeStoredUserPreferences({
    dislikes: preferences.dislikes ?? store.user.dislikes,
    allergies: preferences.allergies ?? store.user.allergies,
  })

  if (!isCloudAvailable()) {
    return null
  }

  try {
    const cloudPreferences = await cloudSaveRoomUserPreferences(roomId, openid, basePreferences)
    if (cloudPreferences) {
      return applyUserPreferencesToStore(cloudPreferences)
    }
  } catch (e) {
    console.warn('[Store] 保存房间偏好失败，未写入本地展示', e)
  }

  return null
}

refreshUserStats()

export function refreshUserStats() {
  const currentRoomId = normalizeRoomId(store.roomId)
  const feedCount = currentRoomId
    ? store.orders.filter((order) => normalizeOrderRoomId(order) === currentRoomId).length
    : 0

  store.user.feedCount = feedCount
  store.user.favorites = store.favoriteItemIds.length
  store.coupons.forEach((coupon) => {
    coupon.available = coupon.redeemed !== true && feedCount >= coupon.required
  })
  store.user.privileges = store.coupons.filter((coupon) => coupon.available).length
}

function setStoreCoupons(coupons) {
  store.coupons.splice(0, store.coupons.length, ...(Array.isArray(coupons) ? coupons : []))
  refreshUserStats()
}

function setStoreRecipes(recipes) {
  store.recipes.splice(0, store.recipes.length, ...(Array.isArray(recipes) ? recipes : []))
}

export async function loadCustomCouponsFromCloud() {
  const roomId = normalizeRoomId(store.roomId)
  if (!roomId) {
    setStoreCoupons([])
    return store.coupons
  }

  const cloudCoupons = await cloudFetchCustomCoupons(roomId)
  if (Array.isArray(cloudCoupons)) {
    const normalizedCoupons = cloudCoupons
      .map(coupon => normalizeCoupon({ ...coupon, custom: true }))
      .filter(Boolean)
    setStoreCoupons(normalizedCoupons)
    return store.coupons
  }

  setStoreCoupons([])
  return store.coupons
}

export async function addCustomCoupon(data) {
  const coupon = normalizeCoupon({
    ...data,
    custom: true,
  })
  if (!coupon || !store.roomId) return null

  const savedCoupon = await cloudAddCustomCoupon(coupon, store.roomId)
  if (!savedCoupon) return null

  const normalizedCoupon = normalizeCoupon({ ...savedCoupon, custom: true })
  const cloudCoupons = [
    ...store.coupons.filter(item => item.id !== normalizedCoupon.id),
    normalizedCoupon,
  ]
  setStoreCoupons(cloudCoupons)

  if (isCloudAvailable()) {
    loadCustomCouponsFromCloud()
  }

  refreshUserStats()
  return normalizedCoupon
}

export async function deleteCustomCouponFromCloud(coupon) {
  const target = normalizeCoupon(coupon)
  const roomId = normalizeRoomId(store.roomId)
  if (!target || !roomId) return false

  const success = await cloudDeleteCustomCoupon(target, roomId)
  if (!success) return false

  const idx = store.coupons.findIndex(item => item.id === target.id || (target._id && item._id === target._id))
  if (idx !== -1) {
    store.coupons.splice(idx, 1)
  }
  refreshUserStats()
  return true
}

export async function redeemCustomCouponInCloud(coupon) {
  const target = normalizeCoupon(coupon)
  const roomId = normalizeRoomId(store.roomId)
  if (!target || !roomId || target.redeemed) return null

  const redeemedCoupon = await cloudRedeemCustomCoupon(target, roomId)
  if (!redeemedCoupon) return null

  const normalizedCoupon = normalizeCoupon({ ...redeemedCoupon, custom: true })
  const idx = store.coupons.findIndex(item => item.id === normalizedCoupon.id || (normalizedCoupon._id && item._id === normalizedCoupon._id))
  if (idx !== -1) {
    store.coupons.splice(idx, 1, normalizedCoupon)
  } else {
    store.coupons.push(normalizedCoupon)
  }
  refreshUserStats()
  return normalizedCoupon
}

// ========== 登录管理 ==========

export function setLoginState(openid) {
  store.isLoggedIn = true
  store.openid = String(openid || '').trim()
  resetUserPreferencesToDefaults()
}

export function clearLoginState() {
  store.isLoggedIn = false
  store.openid = ''
  cloudLogout()
  resetUserPreferencesToDefaults()
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
    setStoreRecipes([])
    store.recipesLoaded = false
    setStoreCategories(getDefaultMenuCategories())
    setStoreCoupons([])
    replaceStoreOrders(readStoredOrders(normalizedRoomId), normalizedRoomId)
    store.ordersLoaded = false
    clearCart()
  }
  resetUserPreferencesToDefaults()
}

export function getRoomId() {
  return store.roomId
}

export function clearRoomId() {
  stopAllMenuRealtimeSync()
  store.roomId = ''
  store.roomInfo = null
  store.favoriteItemIds.splice(0, store.favoriteItemIds.length)
  setStoreCoupons([])
  setStoreRecipes([])
  store.recipesLoaded = false
  replaceStoreOrders([], '')
  store.ordersLoaded = false
  clearCart()
  clearStoredRoomId()
  resetUserPreferencesToDefaults()
}

export function setRoomInfo(info) {
  store.roomInfo = info
}

// ========== 点餐页分类跳转 ==========

export function setPendingMenuCategory(categoryId) {
  pendingMenuCategoryId = categoryId || ''
}

export function consumePendingMenuCategory() {
  const categoryId = pendingMenuCategoryId
  pendingMenuCategoryId = ''
  return categoryId
}

export function requestPendingMenuSearchFocus() {
  pendingMenuSearchFocus = true
}

export function consumePendingMenuSearchFocus() {
  const shouldFocus = pendingMenuSearchFocus
  pendingMenuSearchFocus = false
  return shouldFocus
}

// ========== 分类云端操作 ==========

export async function loadMenuCategoriesFromCloud() {
  try {
    const categories = await cloudFetchMenuCategories(store.roomId)
    setStoreCategories(categories)
    return store.categories
  } catch (e) {
    console.warn('[Store] 加载分类失败:', e)
    return store.categories
  }
}

export async function addMenuCategoryToCloud(data) {
  const category = await cloudAddMenuCategory(data, store.roomId)
  if (!category) return null

  await loadMenuCategoriesFromCloud()
  let nextCategory = store.categories.find(item => item.id === category.id)
  if (!nextCategory) {
    setStoreCategories([...store.categories, category])
    nextCategory = store.categories.find(item => item.id === category.id) || category
  }
  return nextCategory
}

export async function deleteMenuCategoryFromCloud(categoryId, fallbackCategoryId) {
  categoryId = String(categoryId || '').trim()
  fallbackCategoryId = String(fallbackCategoryId || '').trim()
  if (!categoryId || categoryId === fallbackCategoryId) return false

  const success = await cloudDeleteMenuCategory(categoryId, store.roomId, fallbackCategoryId)
  if (!success) return false

  const idx = store.categories.findIndex(item => item.id === categoryId)
  if (idx !== -1) store.categories.splice(idx, 1)

  if (fallbackCategoryId) {
    store.menuItems.forEach((item) => {
      if (item.category === categoryId) item.category = fallbackCategoryId
    })
  }

  await Promise.all([
    loadMenuCategoriesFromCloud(),
    loadMenuFromCloud(),
  ])
  return true
}

// ========== 菜品云端操作 ==========

async function applyCloudMenuItems(items, source = 'fetch', shouldAssign = true, skipMigrationCheck = false) {
  // 检查是否有本地图片路径需要迁移（跳过迁移后的重加载，避免死循环）
  // 迁移完成后设置冷却期，防止短时间内反复迁移
  const migrationCooldownMs = 5 * 60 * 1000
  const now = Date.now()
  const inCooldown = lastMigrationTime > 0 && (now - lastMigrationTime) < migrationCooldownMs
  const hasLocalImages = !skipMigrationCheck && !inCooldown && items.some(item => item.image && item.image.startsWith('/static/'))
  if (hasLocalImages && isCloudAvailable() && !isMenuMigrationRunning) {
    console.log('[Store] 检测到本地图片路径，开始自动迁移到云存储...')
    isMenuMigrationRunning = true
    migrateLocalImagesToCloud(store.roomId).then(result => {
      lastMigrationTime = Date.now()
      if (result.migrated > 0) {
        console.log(`[Store] 图片迁移完成: ${result.migrated} 张成功`)
        // 迁移完成后重新加载（标记跳过迁移检查，防止循环）
        loadMenuFromCloud('migration-reload', true)
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
export async function loadMenuFromCloud(source = 'fetch', skipMigrationCheck = false) {
  try {
    const items = await cloudFetchMenuItems(store.roomId)
    return await applyCloudMenuItems(items, source, true, skipMigrationCheck)
  } catch (e) {
    console.error('[Store] 加载菜品失败:', e)
    return store.menuItems
  }
}

export async function loadMenuSnapshotFromCloud(source = 'fetch') {
  try {
    const snapshot = await cloudFetchMenuSnapshot(store.roomId)
    setStoreCategories(snapshot.categories)
    const items = await applyCloudMenuItems(snapshot.items, source)
    return {
      items,
      categories: store.categories,
    }
  } catch (e) {
    console.error('[Store] 加载菜单快照失败:', e)
    return {
      items: store.menuItems,
      categories: store.categories,
    }
  }
}

export async function getChefEntryUrl({ forceRefresh = false } = {}) {
  if (!store.roomId) return '/pages/login/login'

  const items = !forceRefresh && store.menuLoaded ? store.menuItems : await loadMenuFromCloud()
  return Array.isArray(items) && items.length === 0
    ? '/pages/chef/menu-init'
    : '/pages/chef/dashboard'
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
        const snapshot = await cloudFetchMenuSnapshot(store.roomId)
        const appliedItems = await applyCloudMenuItems(snapshot.items, 'room-watch', false)
        if (seq === menuRealtimeSeq) {
          setStoreCategories(snapshot.categories)
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

function normalizeRecipeForStore(recipe) {
  const normalized = normalizeRecipe(recipe)
  if (!normalized) return null
  return {
    ...normalized,
    _cloudPhotos: Array.isArray(recipe?.photos) ? [...recipe.photos] : [...normalized.photos],
  }
}

async function applyCloudRecipes(recipes) {
  const normalizedRecipes = (Array.isArray(recipes) ? recipes : [])
    .map(normalizeRecipeForStore)
    .filter(Boolean)

  for (const recipe of normalizedRecipes) {
    const displayPhotos = [...recipe.photos]
    await resolveRecipePhotos(displayPhotos)
    recipe.photos = displayPhotos
  }

  setStoreRecipes(normalizedRecipes)
  store.recipesLoaded = true
  return store.recipes
}

export async function loadRecipesFromCloud() {
  const roomId = normalizeRoomId(store.roomId)
  if (!roomId) {
    setStoreRecipes([])
    store.recipesLoaded = true
    return store.recipes
  }

  try {
    const recipes = await cloudFetchRecipes(roomId)
    return await applyCloudRecipes(recipes)
  } catch (e) {
    console.error('[Store] 加载菜谱失败:', e)
    return store.recipes
  }
}

function toRecipeWriteData(data) {
  return {
    ...data,
    photos: Array.isArray(data?.photos)
      ? data.photos
      : Array.isArray(data?._cloudPhotos)
        ? data._cloudPhotos
        : [],
  }
}

export async function addRecipeToCloud(data) {
  const id = await cloudAddRecipe(toRecipeWriteData(data), store.roomId)
  if (id) {
    await loadRecipesFromCloud()
  }
  return id
}

export async function updateRecipeInCloud(id, data) {
  const success = await cloudUpdateRecipe(id, toRecipeWriteData(data), store.roomId)
  if (success) {
    await loadRecipesFromCloud()
  }
  return success
}

export async function deleteRecipeFromCloud(id) {
  const success = await cloudDeleteRecipe(id, store.roomId)
  if (success) {
    const idx = store.recipes.findIndex(item => item._id === id)
    if (idx !== -1) store.recipes.splice(idx, 1)
  }
  return success
}

export async function uploadRecipeImageToCloud(filePath) {
  const roomDir = store.roomId ? `recipe-images/${store.roomId}` : 'recipe-images/default'
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

/**
 * 启动主厨端订单同步。
 * 优先使用 collection.watch() 实时推送（零云函数消耗）；
 * watch 成功时仍保留 5 分钟轮询作为兜底；
 * watch 不可用时使用 15 秒轮询。
 * 注意：此函数仅启动监听/轮询，不会立即拉取。
 * 需要立即拉取的页面应自行调用 loadOrdersFromCloud()。
 */
export function startChefOrdersSync(owner = 'default') {
  if (owner) {
    chefOrdersSyncOwners.add(owner)
  }

  const watchStarted = startOrderRealtimeSync(owner)

  if (!chefOrdersPollTimer) {
    // watch 成功时用 5 分钟长间隔兜底；失败时保持 15 秒短间隔
    const interval = watchStarted ? CHEF_ORDERS_POLL_FALLBACK_INTERVAL : CHEF_ORDERS_POLL_INTERVAL
    chefOrdersPollTimer = setInterval(syncChefOrdersFromCloud, interval)
    console.log(`[Store] 主厨订单同步已启动, watch=${watchStarted}, 轮询间隔=${interval / 1000}秒`)
  }
}

export function stopChefOrdersSync(owner = 'default') {
  if (owner) {
    chefOrdersSyncOwners.delete(owner)
    if (chefOrdersSyncOwners.size > 0) return
  }
  stopOrderRealtimeSync(owner)
  if (chefOrdersPollTimer) {
    clearInterval(chefOrdersPollTimer)
    chefOrdersPollTimer = null
  }
}

// ========== 订单云端操作 ==========

/**
 * 从云端加载订单到 store
 */
/**
 * 将云端订单数据合并到 store.orders 中。
 * 共用于 loadOrdersFromCloud（轮询）和 watchOrders 实时回调。
 * @param {Array} cloudOrders 云端返回的订单文档数组
 */
function mergeCloudOrderDocs(cloudOrders) {
  const roomId = normalizeRoomId(store.roomId)
  if (!roomId || !Array.isArray(cloudOrders)) return

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
        riskWarnings: Array.isArray(co.riskWarnings)
          ? co.riskWarnings
          : (Array.isArray(local.riskWarnings) ? local.riskWarnings : []),
        riskCheckedAt: co.riskCheckedAt || local.riskCheckedAt || null,
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
}

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
      mergeCloudOrderDocs(cloudOrders)
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

/**
 * 启动订单实时同步。
 * watch 成功时通过 WebSocket 实时推送订单变化，不消耗云函数调用。
 * watch 失败时返回 false，轮询会继续兜底。
 */
export function startOrderRealtimeSync(owner = 'default') {
  if (!store.roomId || !isCloudAvailable()) return false
  if (owner) {
    orderRealtimeOwners.add(owner)
  }

  // 已经在监听同一房间
  if (orderRealtimeWatcher && orderRealtimeRoomId === store.roomId) {
    return true
  }

  closeOrderRealtimeWatcher()
  orderRealtimeRoomId = store.roomId

  orderRealtimeWatcher = cloudWatchOrders(
    store.roomId,
    (docs) => {
      const seq = ++orderRealtimeSeq
      try {
        ensureOrdersForCurrentRoom()
        mergeCloudOrderDocs(docs)
        if (seq === orderRealtimeSeq) {
          persistCurrentRoomOrders()
          refreshUserStats()
          store.ordersLoaded = true
        }
      } catch (e) {
        console.warn('[Store] 订单实时同步处理失败:', e)
      }
    },
    (error) => {
      console.warn('[Store] 订单监听失败，降级到轮询兜底:', error)
      closeOrderRealtimeWatcher()
    }
  )

  return !!orderRealtimeWatcher
}

export function stopOrderRealtimeSync(owner = 'default') {
  if (owner) {
    orderRealtimeOwners.delete(owner)
    if (orderRealtimeOwners.size > 0) return
  }
  closeOrderRealtimeWatcher()
}

function closeOrderRealtimeWatcher() {
  if (!orderRealtimeWatcher) return
  try {
    orderRealtimeWatcher.close()
  } catch (e) {
    console.warn('[Store] 关闭订单实时监听失败:', e)
  } finally {
    orderRealtimeWatcher = null
    orderRealtimeRoomId = ''
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

// ========== 菜品自定义选项 ==========

export function getMenuItemOptionGroups(item) {
  if (!item) return []

  if (Array.isArray(item.optionGroups) && item.optionGroups.length > 0) {
    return item.optionGroups
      .map((group, index) => ({
        label: String(group.label || '').trim(),
        options: Array.isArray(group.options)
          ? group.options.map(option => String(option).trim()).filter(Boolean)
          : [],
        multiple: group.multiple === true || index > 0,
      }))
      .filter(group => group.label && group.options.length > 0)
  }

  const groups = []
  if (Array.isArray(item.sweetOptions) && item.sweetOptions.length > 0) {
    groups.push({
      label: item.sweetLabel || '甜度',
      options: item.sweetOptions,
      multiple: false,
    })
  }
  if (Array.isArray(item.extraOptions) && item.extraOptions.length > 0) {
    groups.push({
      label: item.extraLabel || '加料',
      options: item.extraOptions,
      multiple: true,
    })
  }
  return groups
}

export function formatOrderItemOptions(item) {
  const groups = Array.isArray(item?.options?.groups) ? item.options.groups : []
  const groupParts = groups
    .map(group => {
      const label = String(group.label || '').trim()
      const values = Array.isArray(group.values)
        ? group.values.map(value => String(value).trim()).filter(Boolean)
        : []
      if (!values.length) return ''
      return label ? `${label}: ${values.join('、')}` : values.join('、')
    })
    .filter(Boolean)

  if (groupParts.length > 0) return groupParts.join(' / ')

  const parts = []
  if (item?.options?.sweet) parts.push(item.options.sweet)
  if (item?.options?.extras?.length) parts.push(...item.options.extras)
  if (item?.options?.extra) parts.push(item.options.extra)
  return parts.join(' / ') || '默认口味'
}

function matchesRiskText(text, term) {
  const source = String(text || '').toLowerCase()
  const keyword = String(term || '').trim().toLowerCase()
  if (!source || !keyword) return false

  let index = source.indexOf(keyword)
  while (index !== -1) {
    const prefix = source.slice(Math.max(0, index - 6), index)
    if (!/(不要|不加|不放|不含|无|免|去掉|去|少|别加|别放|勿加|勿放)/.test(prefix)) {
      return true
    }
    index = source.indexOf(keyword, index + keyword.length)
  }
  return false
}

function matchesExplicitRiskTerm(values, term) {
  const keyword = String(term || '').trim().toLowerCase()
  if (!keyword) return false
  return normalizePreferenceList(values).some(value => {
    const source = String(value || '').trim().toLowerCase()
    return !!source && (source === keyword || source.includes(keyword) || keyword.includes(source))
  })
}

function buildRiskTextForItem(item) {
  const selectedGroups = Array.isArray(item?.options?.groups) ? item.options.groups : []
  return [
    item?.name,
    item?.desc,
    item?.fullDesc,
    item?.options?.sweet,
    item?.options?.extra,
    ...(Array.isArray(item?.options?.extras) ? item.options.extras : []),
    ...(selectedGroups.flatMap(group => Array.isArray(group.values) ? group.values : [])),
    item?.options?.note,
  ]
    .filter(Boolean)
    .join(' \n ')
}

export function getCartRiskWarnings(cartItems = store.cart, preferences = store.user) {
  const dislikes = normalizePreferenceList(preferences?.dislikes)
  const allergies = normalizePreferenceList(preferences?.allergies)
  const warnings = []

  ;(Array.isArray(cartItems) ? cartItems : []).forEach((item) => {
    const itemId = item?._id || item?.id || ''
    const riskText = buildRiskTextForItem(item)
    const explicitDislikes = [
      item?.dislikeKeywords,
      item?.ingredientTags,
      item?.riskTags,
    ]
    const explicitAllergies = [
      item?.allergyKeywords,
      item?.ingredientTags,
      item?.riskTags,
    ]
    const matched = []
    const seen = new Set()

    dislikes.forEach((term) => {
      const key = `dislike:${term}`
      if (seen.has(key)) return
      if (
        matchesExplicitRiskTerm(explicitDislikes, term) ||
        matchesRiskText(riskText, term)
      ) {
        seen.add(key)
        matched.push({ type: 'dislike', term, label: '绝对不吃' })
      }
    })

    allergies.forEach((term) => {
      const key = `allergy:${term}`
      if (seen.has(key)) return
      if (
        matchesExplicitRiskTerm(explicitAllergies, term) ||
        matchesRiskText(riskText, term)
      ) {
        seen.add(key)
        matched.push({ type: 'allergy', term, label: '过敏提醒' })
      }
    })

    if (matched.length > 0) {
      warnings.push({
        itemId,
        itemName: item?.name || '未知菜品',
        quantity: Number(item?.qty) || 1,
        matches: matched,
      })
    }
  })

  return warnings
}

export function formatCartRiskWarnings(warnings) {
  const list = Array.isArray(warnings) ? warnings : []
  if (list.length === 0) return ''

  return list
    .slice(0, 4)
    .map((warning) => {
      const terms = warning.matches
        .map(match => `${match.label}「${match.term}」`)
        .join('、')
      return `${warning.itemName}${terms ? `：${terms}` : ''}`
    })
    .join('\n')
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
  const riskWarnings = getCartRiskWarnings()
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
    riskWarnings,
    riskCheckedAt: now.toISOString(),
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

function resetChefOrderStats() {
  store.chef.totalOrders = 0
  store.chef.todayOrders = 0
  store.chef.todayCompleted = 0
}

function clearRushTimesForOrders(orders) {
  const orderIds = new Set((Array.isArray(orders) ? orders : [])
    .map(order => order?.id)
    .filter(Boolean))
  if (orderIds.size === 0) return

  let changed = false
  orderIds.forEach((orderId) => {
    if (store.rushTimes[orderId]) {
      delete store.rushTimes[orderId]
      changed = true
    }
  })
  if (changed) {
    writeRushTimes(store.rushTimes)
  }
}

export function clearCurrentRoomFavorites() {
  store.favoriteItemIds.splice(0, store.favoriteItemIds.length)
  writeStoredFavorites([], store.roomId)
  refreshUserStats()
}

export async function clearCurrentRoomOrdersData({ clearFavorites = false } = {}) {
  const roomId = normalizeRoomId(store.roomId)
  if (!roomId) return false

  ensureOrdersForCurrentRoom()
  const currentOrders = [...store.orders]
  const cloudSuccess = await cloudDeleteOrdersByRoom(roomId)
  if (!cloudSuccess) return false

  pendingOperations.clear()
  clearRushTimesForOrders(currentOrders)
  clearRushNotifications()
  replaceStoreOrders([], roomId)
  persistCurrentRoomOrders()
  store.ordersLoaded = true
  resetChefOrderStats()

  if (clearFavorites) {
    clearCurrentRoomFavorites()
  } else {
    refreshUserStats()
  }

  return true
}

export async function clearCurrentRoomAllData() {
  const roomId = normalizeRoomId(store.roomId)
  if (!roomId) return false

  const ordersCleared = await clearCurrentRoomOrdersData({ clearFavorites: true })
  if (!ordersCleared) return false

  const menuCleared = await cloudDeleteMenuItemsByRoom(roomId)
  if (menuCleared) {
    stopAllMenuRealtimeSync()
    store.menuItems = []
    store.menuLoaded = true
    clearCart()
  }

  const recipesCleared = await cloudDeleteRecipesByRoom(roomId)
  if (recipesCleared) {
    setStoreRecipes([])
    store.recipesLoaded = true
  }

  return ordersCleared && menuCleared && recipesCleared
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
