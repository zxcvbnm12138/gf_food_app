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
} from '@/services/cloud.js'

const ORDERS_STORAGE_KEY = 'gf_food_orders'
const USER_AVATAR_STORAGE_KEY = 'gf_food_user_avatar'
const ROLE_STORAGE_KEY = 'gf_food_role'
const CHEF_AVATAR_STORAGE_KEY = 'gf_food_chef_avatar'
const RUSH_STORAGE_KEY = 'gf_food_rush_times'

function readStoredOrders() {
  try {
    if (typeof uni === 'undefined') return []
    const saved = uni.getStorageSync(ORDERS_STORAGE_KEY)
    return Array.isArray(saved) ? saved : []
  } catch (error) {
    return []
  }
}

function writeStoredOrders(orders) {
  try {
    if (typeof uni === 'undefined') return
    uni.setStorageSync(ORDERS_STORAGE_KEY, orders)
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
    { id: 'hot', name: '🔥 热销', active: true },
    { id: 'dessert', name: '🍰 甜点', active: false },
    { id: 'drink', name: '🥤 饮品', active: false },
    { id: 'carb', name: '🍜 面食', active: false },
    { id: 'light', name: '🥗 轻食', active: false },
    { id: 'warm', name: '🍵 暖饮', active: false },
  ],

  // 购物车数据
  cart: [],

  // 已下单历史（带状态）
  orders: readStoredOrders(),

  // 催单时间记录 { orderId: lastRushTimeISO }
  rushTimes: readRushTimes(),

  // 用户信息（客户端）
  user: {
    name: '小可爱',
    avatarUrl: readStoredAvatar(),
    feedCount: 23,
    privileges: 5,
    favorites: 8,
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
  coupons: [
    {
      id: 1,
      name: '15分钟肩颈按摩券',
      desc: '累计投喂 20 次即可兑换',
      emoji: '💆‍♀️',
      color: '#FFF7E6',
      required: 20,
      available: true,
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
  ],

  // 撒娇备注
  cartNote: '',
})

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

// ========== 菜品云端操作 ==========

/**
 * 从云端加载菜品到 store
 */
export async function loadMenuFromCloud() {
  try {
    const items = await cloudFetchMenuItems()
    store.menuItems = items
    store.menuLoaded = true
    console.log('[Store] 菜品已加载，共', items.length, '道')
    return items
  } catch (e) {
    console.error('[Store] 加载菜品失败:', e)
    return store.menuItems
  }
}

/**
 * 新增菜品到云端
 */
export async function addMenuItemToCloud(data) {
  const id = await cloudAddMenuItem(data)
  if (id) {
    // 刷新列表
    await loadMenuFromCloud()
  }
  return id
}

/**
 * 更新云端菜品
 */
export async function updateMenuItemInCloud(id, data) {
  const success = await cloudUpdateMenuItem(id, data)
  if (success) {
    // 同步更新本地 store
    const item = store.menuItems.find(m => m._id === id)
    if (item) {
      Object.assign(item, data)
    }
  }
  return success
}

/**
 * 删除云端菜品
 */
export async function deleteMenuItemFromCloud(id) {
  const success = await cloudDeleteMenuItem(id)
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

  const newAvail = !item.available
  item.available = newAvail // 先乐观更新

  if (isCloudAvailable()) {
    const success = await cloudToggleAvailability(item._id, newAvail)
    if (!success) {
      // 回滚
      item.available = !newAvail
    }
    return success ? newAvail : null
  }
  return newAvail
}

// ========== 订单云端操作 ==========

/**
 * 从云端加载订单到 store
 */
export async function loadOrdersFromCloud() {
  try {
    const cloudOrders = await cloudFetchOrders()
    if (cloudOrders !== null) {
      // 云端有数据，合并本地
      const localMap = {}
      store.orders.forEach(o => { localMap[o.id] = o })

      cloudOrders.forEach(co => {
        const localId = co.id || co._id
        if (localMap[localId]) {
          // 更新本地记录的云端字段
          Object.assign(localMap[localId], {
            _cloudId: co._id,
            status: co.status || localMap[localId].status,
            acceptedAt: co.acceptedAt || localMap[localId].acceptedAt,
            cookingAt: co.cookingAt || localMap[localId].cookingAt,
            completedAt: co.completedAt || localMap[localId].completedAt,
            rushLastTime: co.rushLastTime || null,
            rushCount: co.rushCount || 0,
          })
        } else {
          // 云端有但本地没有，添加到本地
          store.orders.push({
            ...co,
            _cloudId: co._id,
          })
        }
      })

      writeStoredOrders(store.orders)
      store.ordersLoaded = true
      console.log('[Store] 订单已从云端同步')
    }
    return store.orders
  } catch (e) {
    console.error('[Store] 加载订单失败:', e)
    return store.orders
  }
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
  if (store.cart.length === 0) return null

  const now = new Date()
  const order = {
    id: `GF${now.getTime()}`,
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
  store.user.feedCount += 1
  writeStoredOrders(store.orders)
  clearCart()

  // 异步上传到云端（不阻塞UI）
  try {
    const cloudId = await cloudAddOrder(order)
    if (cloudId) {
      order._cloudId = cloudId
      writeStoredOrders(store.orders)
    }
  } catch (e) {
    console.warn('[Store] 订单上传云端失败，仅保存本地', e)
  }

  return order
}

export function clearOrders() {
  store.orders.splice(0, store.orders.length)
  writeStoredOrders(store.orders)
}

export function updateUserAvatar(url) {
  store.user.avatarUrl = url || ''
  writeStoredAvatar(store.user.avatarUrl)
}

// ========== 主厨端操作 ==========

export async function acceptOrder(orderId) {
  const order = store.orders.find((o) => o.id === orderId)
  if (order && order.status === 'pending') {
    order.status = 'accepted'
    order.acceptedAt = new Date().toISOString()
    writeStoredOrders(store.orders)

    // 同步到云端
    if (order._cloudId) {
      await updateOrderInCloud(order._cloudId, {
        status: 'accepted',
        acceptedAt: order.acceptedAt,
      })
    }
    return true
  }
  return false
}

export async function startCooking(orderId) {
  const order = store.orders.find((o) => o.id === orderId)
  if (order && order.status === 'accepted') {
    order.status = 'cooking'
    order.cookingAt = new Date().toISOString()
    writeStoredOrders(store.orders)

    // 同步到云端
    if (order._cloudId) {
      await updateOrderInCloud(order._cloudId, {
        status: 'cooking',
        cookingAt: order.cookingAt,
      })
    }
    return true
  }
  return false
}

export async function completeOrder(orderId) {
  const order = store.orders.find((o) => o.id === orderId)
  if (order && (order.status === 'cooking' || order.status === 'accepted')) {
    order.status = 'done'
    order.completedAt = new Date().toISOString()
    store.chef.todayCompleted += 1
    writeStoredOrders(store.orders)

    // 同步到云端
    if (order._cloudId) {
      await updateOrderInCloud(order._cloudId, {
        status: 'done',
        completedAt: order.completedAt,
      })
    }
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
  const remaining = getRushCooldownRemaining(orderId)
  if (remaining > 0) {
    const mins = Math.ceil(remaining / 60000)
    return {
      success: false,
      message: `催单太频繁啦～ 请${mins}分钟后再试`,
      cooldownRemaining: remaining,
    }
  }

  const order = store.orders.find(o => o.id === orderId)
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
  writeStoredOrders(store.orders)

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

// 获取各状态订单
export function getOrdersByStatus(status) {
  return store.orders.filter((o) => o.status === status)
}

// 获取今日订单
export function getTodayOrders() {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return store.orders.filter((o) => {
    const d = new Date(o.createdAt)
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return dStr === todayStr
  })
}

export default store
