import { reactive } from 'vue'

const ORDERS_STORAGE_KEY = 'gf_food_orders'

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

function cloneCartItem(item) {
  return {
    id: item.id,
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
  // 菜单数据
  menuItems: [
    {
      id: 1,
      name: '草莓甜心脆脆',
      desc: '新鲜草莓与法式奶油的完美结合',
      fullDesc: '使用新鲜空运奶油草莓，搭配低糖动物奶油千层酥底。一口咬下去满满幸福感，绝对不会长胖哦～',
      category: 'hot',
      emoji: '🍓',
      image: '/static/food1.jpg',
      price: '免费',
      sweetOptions: ['少少糖', '正常甜', '多多甜'],
      extraOptions: ['多放草莓', '加奶油', '不要香菜'],
    },
    {
      id: 2,
      name: '云朵抹茶拿铁',
      desc: '宇治抹茶搭配厚乳沫',
      fullDesc: '精选宇治抹茶，搭配绵密厚乳沫，入口即化。清新中带着一丝甜蜜，仿佛行走在京都的茶园间～',
      category: 'drink',
      emoji: '🍵',
      image: '/static/food2.jpg',
      price: '免费',
      sweetOptions: ['无糖', '微糖', '正常甜'],
      extraOptions: ['加椰果', '加珍珠', '加布丁'],
    },
    {
      id: 3,
      name: '杨枝甘露',
      desc: '芒果椰奶西米露，热带风情',
      fullDesc: '精选台农芒果搭配浓郁椰奶和Q弹西米，每一口都是热带阳光的味道，满满的水果鲜甜～',
      category: 'dessert',
      emoji: '🥭',
      image: '/static/food3.jpg',
      price: '免费',
      sweetOptions: ['少少糖', '正常甜', '多多甜'],
      extraOptions: ['多放芒果', '加西米', '加椰果'],
    },
    {
      id: 4,
      name: '芋泥波波奶茶',
      desc: '绵密芋泥配Q弹珍珠',
      fullDesc: '手工现蒸芋泥，搭配新鲜牛奶和Q弹黑糖珍珠。每一口都是软糯的幸福感，超级治愈～',
      category: 'drink',
      emoji: '🧋',
      image: '/static/food4.jpg',
      price: '免费',
      sweetOptions: ['无糖', '三分糖', '正常甜'],
      extraOptions: ['加芋圆', '加珍珠', '加布丁'],
    },
    {
      id: 5,
      name: '蜜桃乌龙茶',
      desc: '清新蜜桃遇上醇香乌龙',
      fullDesc: '水蜜桃果肉搭配高山乌龙茶汤，清新解腻又甜蜜。午后来一杯，好心情加倍～',
      category: 'drink',
      emoji: '🍑',
      image: '/static/food5.jpg',
      price: '免费',
      sweetOptions: ['无糖', '微糖', '正常甜'],
      extraOptions: ['加蜜桃果肉', '加芦荟', '加椰果'],
    },
    {
      id: 6,
      name: '提拉米苏',
      desc: '经典意式甜蜜诱惑',
      fullDesc: '手指饼干蘸取浓缩咖啡，层叠马斯卡彭芝士，撒上可可粉。一口一个天堂～',
      category: 'dessert',
      emoji: '🍰',
      image: '/static/food6.jpg',
      price: '免费',
      sweetOptions: ['少少糖', '正常甜', '多多甜'],
      extraOptions: ['多加可可', '加草莓', '加蓝莓'],
    },
    {
      id: 7,
      name: '日式炒乌冬',
      desc: '浓郁酱香Q弹面条',
      fullDesc: '特制日式酱汁炒制Q弹乌冬面，搭配新鲜蔬菜和温泉蛋。碳水快乐就是这么简单～',
      category: 'carb',
      emoji: '🍜',
      image: '/static/food7.jpg',
      price: '免费',
      sweetOptions: [],
      extraOptions: ['加温泉蛋', '加芝士', '加培根'],
    },
    {
      id: 8,
      name: '牛油果沙拉碗',
      desc: '新鲜健康轻食首选',
      fullDesc: '新鲜牛油果搭配藜麦、鸡胸肉和时令蔬菜，淋上特制油醋汁。好吃不长胖，越吃越美丽～',
      category: 'light',
      emoji: '🥗',
      image: '/static/food8.jpg',
      price: '免费',
      sweetOptions: [],
      extraOptions: ['多放牛油果', '加鸡胸肉', '加坚果'],
    },
  ],

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

  // 已下单历史
  orders: readStoredOrders(),

  // 用户信息
  user: {
    name: '小可爱',
    feedCount: 23,
    privileges: 5,
    favorites: 8,
    dislikes: ['香菜', '苦瓜'],
    allergies: '无',
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

// 购物车操作方法
export function addToCart(item, options = {}) {
  const existing = store.cart.find(
    (c) => c.id === item.id && JSON.stringify(c.options) === JSON.stringify(options)
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

export function createOrderFromCart() {
  if (store.cart.length === 0) return null

  const now = new Date()
  const order = {
    id: `GF${now.getTime()}`,
    createdAt: now.toISOString(),
    note: store.cartNote,
    totalCount: getCartTotal(),
    items: store.cart.map(cloneCartItem),
  }

  store.orders.unshift(order)
  store.user.feedCount += 1
  writeStoredOrders(store.orders)
  clearCart()

  return order
}

export function clearOrders() {
  store.orders.splice(0, store.orders.length)
  writeStoredOrders(store.orders)
}

export default store
