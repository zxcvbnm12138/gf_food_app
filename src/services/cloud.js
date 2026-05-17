/**
 * 微信云开发服务层
 * 封装云数据库操作、微信登录、菜品 CRUD
 * H5 环境自动降级为本地数据
 */

const CLOUD_ENV = 'cloud1-d1g59kb63451bc898'
const LOGIN_KEY = 'gf_cloud_login'
const ROOM_STORAGE_KEY = 'gf_food_room_id'
const LOCAL_MENU_OVERRIDES_KEY = 'gf_food_local_menu_overrides'

// 云端图片临时链接缓存 { fileID: tempUrl }
const tempUrlCache = {}

// ========== 平台判断 ==========

/**
 * 判断当前是否在微信小程序环境
 */
export function isWxMiniProgram() {
  // #ifdef MP-WEIXIN
  return true
  // #endif
  // #ifndef MP-WEIXIN
  return false
  // #endif
}

/**
 * 判断云开发是否可用
 */
export function isCloudAvailable() {
  return isWxMiniProgram() && typeof wx !== 'undefined' && wx.cloud
}

// ========== 云初始化 ==========

let cloudInited = false

/**
 * 初始化微信云开发
 */
export function initCloud() {
  if (!isCloudAvailable()) {
    console.log('[Cloud] 非微信小程序环境，跳过云初始化')
    return false
  }
  if (cloudInited) return true
  try {
    wx.cloud.init({
      env: CLOUD_ENV,
      traceUser: true,
    })
    cloudInited = true
    console.log('[Cloud] 云开发初始化成功，环境:', CLOUD_ENV)
    return true
  } catch (e) {
    console.error('[Cloud] 云开发初始化失败:', e)
    return false
  }
}

// ========== 获取数据库引用 ==========

function getDB() {
  if (!isCloudAvailable() || !cloudInited) return null
  return wx.cloud.database()
}

function readLocalMenuOverrides() {
  try {
    if (typeof uni === 'undefined') return {}
    const data = uni.getStorageSync(LOCAL_MENU_OVERRIDES_KEY)
    return data && typeof data === 'object' ? data : {}
  } catch (e) {
    return {}
  }
}

function writeLocalMenuOverrides(data) {
  try {
    if (typeof uni === 'undefined') return
    uni.setStorageSync(LOCAL_MENU_OVERRIDES_KEY, data)
  } catch (e) {
    console.warn('[Cloud] 保存本地菜品状态失败', e)
  }
}

export function setLocalMenuItemAvailability(itemId, available) {
  if (!itemId) return
  const overrides = readLocalMenuOverrides()
  overrides[itemId] = {
    ...(overrides[itemId] || {}),
    available: available !== false,
  }
  writeLocalMenuOverrides(overrides)
}

function isCloudFunctionNotFound(error) {
  const message = String(error?.message || error || '')
  return message.includes('-501000') ||
    message.includes('FUNCTION_NOT_FOUND') ||
    message.includes('FunctionName parameter could not be found')
}

/**
 * 微信登录，获取 openid
 * 通过 login 云函数获取微信上下文，并在 users 集合中按 openid 去重。
 * @returns {Promise<{openid: string} | null>}
 */
export async function wxLogin() {
  if (!isCloudAvailable()) {
    console.log('[Cloud] H5 环境，模拟登录')
    const mockLogin = { openid: 'h5_mock_openid_' + Date.now(), timestamp: Date.now() }
    try {
      uni.setStorageSync(LOGIN_KEY, mockLogin)
    } catch (e) { /* ignore */ }
    return mockLogin
  }

  try {
    const res = await wx.cloud.callFunction({
      name: 'login',
      data: {},
    })

    if (!res.result || !res.result.success || !res.result.openid) {
      console.error('[Cloud] 登录云函数返回失败:', res.result?.message || res.result)
      return null
    }

    const loginData = {
      openid: res.result.openid,
      userId: res.result.userId || '',
      timestamp: Date.now(),
    }
    uni.setStorageSync(LOGIN_KEY, loginData)
    console.log('[Cloud] 微信登录成功, openid:', loginData.openid)
    return loginData
  } catch (e) {
    if (isCloudFunctionNotFound(e)) {
      console.error('[Cloud] login 云函数未部署或未部署到当前云环境。请上传 cloudfunctions/login 后重试:', e)
      const cachedLogin = checkLogin()
      if (cachedLogin?.openid) {
        console.warn('[Cloud] 临时使用本地登录缓存:', cachedLogin.openid)
        return cachedLogin
      }
      return null
    }
    console.error('[Cloud] 微信登录失败:', e)
    return null
  }
}

/**
 * 检查登录态
 * @returns {{ openid: string, timestamp: number } | null}
 */
export function checkLogin() {
  try {
    const data = uni.getStorageSync(LOGIN_KEY)
    if (data && data.openid) {
      return data
    }
  } catch (e) { /* ignore */ }
  return null
}

/**
 * 退出登录
 */
export function logout() {
  try {
    uni.removeStorageSync(LOGIN_KEY)
  } catch (e) { /* ignore */ }
}

// ========== 房间管理 ==========

/**
 * 生成6位英文数字混合房间号
 */
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉容易混淆的 I/O/0/1
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function normalizeRoomId(roomId) {
  return roomId ? String(roomId).trim().toUpperCase() : ''
}

function getRoomTimestamp(room) {
  const value = room?.updatedAt || room?.createdAt || 0
  if (!value) return 0
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object' && typeof value.getTime === 'function') return value.getTime()
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function normalizeUserRooms(rooms, openid) {
  const map = new Map()
  ;(Array.isArray(rooms) ? rooms : []).forEach(room => {
    const roomId = normalizeRoomId(room?.roomId)
    if (!roomId) return
    const members = Array.isArray(room.members) ? room.members : []
    const canUseRoom = !openid || room.creatorOpenid === openid || members.includes(openid)
    if (!canUseRoom) return
    const existing = map.get(roomId)
    if (!existing || getRoomTimestamp(room) > getRoomTimestamp(existing)) {
      map.set(roomId, {
        ...room,
        roomId,
        members,
        isCreator: room.creatorOpenid === openid,
      })
    }
  })
  return Array.from(map.values())
    .sort((a, b) => getRoomTimestamp(b) - getRoomTimestamp(a))
}

/**
 * 读取本地缓存的房间号
 */
export function getStoredRoomId() {
  try {
    if (typeof uni === 'undefined') return ''
    return normalizeRoomId(uni.getStorageSync(ROOM_STORAGE_KEY) || '')
  } catch (e) {
    return ''
  }
}

/**
 * 保存房间号到本地缓存
 */
export function setStoredRoomId(roomId) {
  try {
    if (typeof uni === 'undefined') return
    uni.setStorageSync(ROOM_STORAGE_KEY, normalizeRoomId(roomId))
  } catch (e) {
    console.warn('[Cloud] 保存房间号失败', e)
  }
}

/**
 * 清除本地缓存的房间号
 */
export function clearStoredRoomId() {
  try {
    if (typeof uni === 'undefined') return
    uni.removeStorageSync(ROOM_STORAGE_KEY)
  } catch (e) { /* ignore */ }
}

/**
 * 创建新房间
 * @param {string} openid 创建者的 openid
 * @returns {Promise<{roomId: string, _id: string} | null>}
 */
export async function createRoom(openid) {
  if (!isCloudAvailable() || !cloudInited) {
    // H5 环境模拟
    const roomId = generateRoomId()
    console.log('[Cloud] H5 模拟创建房间:', roomId)
    setStoredRoomId(roomId)
    return { roomId, _id: 'local_room_' + roomId }
  }

  try {
    const db = getDB()
    // 生成唯一房间号（重试避免冲突）
    let roomId = ''
    let attempts = 0
    while (attempts < 10) {
      roomId = generateRoomId()
      const existing = await db.collection('rooms').where({ roomId }).count()
      if (existing.total === 0) break
      attempts++
    }
    if (attempts >= 10) {
      console.error('[Cloud] 无法生成唯一房间号')
      return null
    }

    const res = await db.collection('rooms').add({
      data: {
        roomId,
        creatorOpenid: openid,
        members: [openid],
        maxMembers: 2,
        menuVersion: 0,
        menuUpdatedAt: new Date(),
        createdAt: new Date(),
      },
    })

    setStoredRoomId(roomId)
    console.log('[Cloud] 创建房间成功:', roomId)
    return { roomId, _id: res._id }
  } catch (e) {
    console.error('[Cloud] 创建房间失败:', e)
    return null
  }
}

/**
 * 加入房间
 * @param {string} roomId 房间号
 * @param {string} openid 加入者的 openid
 * @returns {Promise<{success: boolean, message: string, roomInfo?: Object}>}
 */
export async function joinRoom(roomId, openid) {
  roomId = normalizeRoomId(roomId)

  if (!roomId || roomId.length !== 6) {
    return { success: false, message: '请输入正确的6位房间号' }
  }

  if (!isCloudAvailable() || !cloudInited) {
    // H5 模拟
    setStoredRoomId(roomId)
    console.log('[Cloud] H5 模拟加入房间:', roomId)
    return { success: true, message: '加入成功', roomInfo: { roomId, members: [openid] } }
  }

  try {
    try {
      const cloudRes = await wx.cloud.callFunction({
        name: 'joinRoom',
        data: { roomId, openid },
      })
      if (cloudRes.result && cloudRes.result.success) {
        setStoredRoomId(roomId)
        console.log('[Cloud] 云函数加入房间成功:', roomId)
        return cloudRes.result
      }
      console.warn('[Cloud] 云函数加入房间返回失败:', cloudRes.result?.message)
    } catch (cloudErr) {
      console.warn('[Cloud] 云函数 joinRoom 调用失败，尝试直接更新:', cloudErr.message || cloudErr)
    }

    const db = getDB()
    const res = await db.collection('rooms').where({ roomId }).get()

    if (res.data.length === 0) {
      return { success: false, message: '房间不存在，请检查房间号' }
    }

    const room = res.data[0]

    const members = Array.isArray(room.members) ? room.members : []
    const existingMembers = Array.from(new Set([room.creatorOpenid, ...members].filter(Boolean)))

    // 已经在房间里
    if (existingMembers.includes(openid)) {
      setStoredRoomId(roomId)
      if (existingMembers.length !== members.length) {
        await db.collection('rooms').doc(room._id).update({
          data: {
            members: existingMembers,
            updatedAt: new Date(),
          },
        })
      }
      return { success: true, message: '已在房间中', roomInfo: { ...room, members: existingMembers } }
    }

    // 检查人数限制
    if (existingMembers.length >= (room.maxMembers || 2)) {
      return { success: false, message: '房间已满，无法加入' }
    }

    // 加入房间：兜底路径使用显式数组写入，避免数组操作符兼容/权限问题。
    const nextMembers = Array.from(new Set([...existingMembers, openid]))
    await db.collection('rooms').doc(room._id).update({
      data: {
        members: nextMembers,
        updatedAt: new Date(),
      },
    })

    setStoredRoomId(roomId)
    console.log('[Cloud] 加入房间成功:', roomId)
    return { success: true, message: '加入成功', roomInfo: { ...room, members: nextMembers } }
  } catch (e) {
    console.error('[Cloud] 加入房间失败:', e)
    return { success: false, message: '加入失败，请重试' }
  }
}

/**
 * 获取房间信息
 * @param {string} roomId 房间号
 * @returns {Promise<Object|null>}
 */
export async function getRoomInfo(roomId) {
  roomId = normalizeRoomId(roomId)
  if (!roomId) return null

  if (!isCloudAvailable() || !cloudInited) {
    return { roomId, members: [], maxMembers: 2 }
  }

  try {
    const db = getDB()
    const res = await db.collection('rooms').where({ roomId }).get()
    return res.data.length > 0 ? res.data[0] : null
  } catch (e) {
    console.error('[Cloud] 获取房间信息失败:', e)
    return null
  }
}

/**
 * 根据 openid 查找所属房间
 * @param {string} openid
 * @returns {Promise<string|null>} roomId
 */
export async function getRoomByMember(openid) {
  if (!openid) return null

  const rooms = await getUserRooms(openid)
  return rooms[0]?.roomId || getStoredRoomId() || null
}

/**
 * 根据 openid 获取用户历史房间。
 * 包含用户创建过的房间，以及 members 中包含该 openid 的房间。
 * @param {string} openid
 * @returns {Promise<Array>}
 */
export async function getUserRooms(openid) {
  if (!openid) return []

  const storedRoomId = getStoredRoomId()
  if (!isCloudAvailable() || !cloudInited) {
    return storedRoomId
      ? [{ roomId: storedRoomId, _id: 'local_room_' + storedRoomId, members: [openid], isCreator: false }]
      : []
  }

  try {
    const res = await wx.cloud.callFunction({
      name: 'getUserRooms',
      data: { openid },
    })
    if (res.result && res.result.success && Array.isArray(res.result.rooms)) {
      return normalizeUserRooms(res.result.rooms, openid)
    }
    console.warn('[Cloud] 历史房间云函数返回失败:', res.result?.message)
  } catch (e) {
    console.warn('[Cloud] getUserRooms 云函数调用失败，尝试直接查询:', e.message || e)
  }

  try {
    const db = getDB()
    const res = await db.collection('rooms')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    return normalizeUserRooms(res.data, openid)
  } catch (e) {
    console.error('[Cloud] 查找用户历史房间失败:', e)
    return storedRoomId
      ? [{ roomId: storedRoomId, _id: 'local_cached_' + storedRoomId, members: [openid], isCreator: false }]
      : []
  }
}

/**
 * 退出房间
 * @param {string} roomId
 * @param {string} openid
 * @returns {Promise<boolean>}
 */
export async function leaveRoom(roomId, openid) {
  roomId = normalizeRoomId(roomId)
  clearStoredRoomId()

  if (!isCloudAvailable() || !cloudInited) {
    return true
  }

  try {
    const db = getDB()
    const res = await db.collection('rooms').where({ roomId }).get()
    if (res.data.length === 0) return true

    const room = res.data[0]
    const _ = db.command
    await db.collection('rooms').doc(room._id).update({
      data: {
        members: _.pull(openid),
      },
    })
    console.log('[Cloud] 已退出房间:', roomId)
    return true
  } catch (e) {
    console.error('[Cloud] 退出房间失败:', e)
    return false
  }
}

// ========== 云存储（图片上传/下载） ==========

/**
 * 上传图片到微信云存储
 * @param {string} filePath 本地文件路径（如拍照/选择后的临时路径）
 * @param {string} cloudDir 云端目录，默认 'menu-images'
 * @returns {Promise<string|null>} 返回云端 fileID（cloud://...），失败返回 null
 */
export async function uploadImageToCloud(filePath, cloudDir = 'menu-images') {
  if (!isCloudAvailable() || !cloudInited) {
    console.warn('[Cloud] 非云环境，无法上传图片')
    return null
  }

  try {
    // 生成唯一云端路径
    const extMatch = filePath.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/)
    const ext = (extMatch?.[1] || 'jpg').toLowerCase()
    const safeCloudDir = (cloudDir || 'menu-images').replace(/^\/+|\/+$/g, '')
    const cloudPath = `${safeCloudDir}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

    const res = await wx.cloud.uploadFile({
      cloudPath,
      filePath,
    })

    console.log('[Cloud] 图片上传成功, fileID:', res.fileID)
    return res.fileID
  } catch (e) {
    console.error('[Cloud] 图片上传失败:', e)
    return null
  }
}

/**
 * 实时监听某个房间的菜品列表变化
 * @param {string} roomId 房间号
 * @param {(items: Array, snapshot: Object) => void} onChange
 * @param {(error: Error) => void} onError
 * @returns {Object|null} watcher，调用 close() 关闭
 */
export function watchMenuItems(roomId, onChange, onError) {
  if (!isCloudAvailable() || !cloudInited) {
    return null
  }

  try {
    const db = getDB()
    roomId = normalizeRoomId(roomId)
    if (!db || !roomId) return null

    return db.collection('menu_items')
      .where({ roomId })
      .watch({
        onChange(snapshot) {
          const docs = Array.isArray(snapshot.docs) ? snapshot.docs : []
          const items = docs
            .slice()
            .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
          onChange?.(items, snapshot)
        },
        onError(error) {
          console.error('[Cloud] 菜品实时监听失败:', error)
          onError?.(error)
        },
      })
  } catch (e) {
    console.error('[Cloud] 启动菜品实时监听失败:', e)
    onError?.(e)
    return null
  }
}

/**
 * 实时监听房间菜单版本变化。
 * 跨设备同步优先使用 rooms 作为轻量信号，避免 menu_items 集合权限影响客户设备监听。
 */
export function watchRoomMenuVersion(roomId, onChange, onError) {
  if (!isCloudAvailable() || !cloudInited) {
    return null
  }

  try {
    const db = getDB()
    roomId = normalizeRoomId(roomId)
    if (!db || !roomId) return null

    let lastVersion = null
    let lastUpdatedAt = ''

    return db.collection('rooms')
      .where({ roomId })
      .watch({
        onChange(snapshot) {
          const room = Array.isArray(snapshot.docs) ? snapshot.docs[0] : null
          if (!room) return

          const nextVersion = room.menuVersion || 0
          const nextUpdatedAt = String(room.menuUpdatedAt || '')
          const changed = lastVersion !== null && (
            nextVersion !== lastVersion || nextUpdatedAt !== lastUpdatedAt
          )

          lastVersion = nextVersion
          lastUpdatedAt = nextUpdatedAt

          if (changed) {
            onChange?.(room, snapshot)
          }
        },
        onError(error) {
          console.error('[Cloud] 房间菜单版本监听失败:', error)
          onError?.(error)
        },
      })
  } catch (e) {
    console.error('[Cloud] 启动房间菜单版本监听失败:', e)
    onError?.(e)
    return null
  }
}

async function touchRoomMenuVersion(roomId) {
  roomId = normalizeRoomId(roomId)
  if (!roomId || !isCloudAvailable() || !cloudInited) return

  try {
    const db = getDB()
    const roomRes = await db.collection('rooms').where({ roomId }).limit(1).get()
    if (!roomRes.data || roomRes.data.length === 0) return

    const room = roomRes.data[0]
    const nextVersion = (Number(room.menuVersion) || 0) + 1

    await db.collection('rooms').doc(room._id).update({
      data: {
        menuUpdatedAt: new Date(),
        menuVersion: nextVersion,
      },
    })
  } catch (e) {
    console.warn('[Cloud] 更新房间菜单版本失败:', e)
  }
}

/**
 * 批量获取云文件临时访问链接
 * 对于非 cloud:// 路径（本地或 http 链接）直接原样返回
 * @param {string[]} fileIDs 云端 fileID 数组
 * @returns {Promise<Object>} { fileID: tempUrl } 映射
 */
export async function getTempImageUrls(fileIDs) {
  if (!fileIDs || fileIDs.length === 0) return {}

  // 分离出需要解析的云文件和不需要解析的
  const cloudIds = []
  const result = {}

  for (const fid of fileIDs) {
    if (!fid) continue
    if (tempUrlCache[fid]) {
      // 缓存命中
      result[fid] = tempUrlCache[fid]
    } else if (fid.startsWith('cloud://')) {
      cloudIds.push(fid)
    } else {
      // 非云文件（本地路径或 http 链接），原样返回
      result[fid] = fid
    }
  }

  if (cloudIds.length === 0 || !isCloudAvailable() || !cloudInited) {
    return result
  }

  try {
    const res = await wx.cloud.getTempFileURL({
      fileList: cloudIds,
    })

    if (res.fileList) {
      for (const item of res.fileList) {
        if (item.tempFileURL) {
          result[item.fileID] = item.tempFileURL
          tempUrlCache[item.fileID] = item.tempFileURL
        } else {
          // 解析失败，保留原 fileID
          result[item.fileID] = item.fileID
        }
      }
    }

    console.log('[Cloud] 批量获取临时链接成功，共', cloudIds.length, '个')
    return result
  } catch (e) {
    console.error('[Cloud] 获取临时链接失败:', e)
    // 失败时保留原 fileID
    for (const fid of cloudIds) {
      result[fid] = fid
    }
    return result
  }
}

/**
 * 解析单个图片地址
 * cloud:// 开头 -> 获取临时链接
 * 其他 -> 原样返回
 * @param {string} imageUrl
 * @returns {Promise<string>}
 */
export async function resolveImageUrl(imageUrl) {
  if (!imageUrl) return ''
  if (!imageUrl.startsWith('cloud://')) return imageUrl
  if (tempUrlCache[imageUrl]) return tempUrlCache[imageUrl]

  const urlMap = await getTempImageUrls([imageUrl])
  return urlMap[imageUrl] || imageUrl
}

/**
 * 为菜品列表批量解析图片地址
 * 将所有 cloud:// 开头的 image 字段替换为临时访问链接
 * @param {Array} items 菜品列表
 * @returns {Promise<Array>} 解析后的菜品列表（原地修改）
 */
export async function resolveMenuImages(items) {
  if (!items || items.length === 0) return items
  if (!isCloudAvailable() || !cloudInited) return items

  // 收集所有需要解析的 cloud:// 链接
  const cloudFileIDs = items
    .map(item => item.image)
    .filter(img => img && img.startsWith('cloud://'))

  if (cloudFileIDs.length === 0) return items

  // 去重
  const uniqueIds = [...new Set(cloudFileIDs)]
  const urlMap = await getTempImageUrls(uniqueIds)

  // 替换
  for (const item of items) {
    if (item.image && urlMap[item.image]) {
      // 保留原始 fileID 以便后续更新
      item._cloudImageId = item.image
      item.image = urlMap[item.image]
    }
  }

  console.log('[Cloud] 菜品图片链接解析完成，共', uniqueIds.length, '个云端图片')
  return items
}

/**
 * 迁移已有云数据库中的本地图片路径到云存储
 * 扫描所有 image 字段为 /static/ 开头的记录，上传到云存储并更新数据库
 * @param {string} roomId 房间号
 * @returns {Promise<{migrated: number, failed: number}>}
 */
export async function migrateLocalImagesToCloud(roomId) {
  if (!isCloudAvailable() || !cloudInited) {
    console.warn('[Cloud] 非云环境，无法迁移图片')
    return { migrated: 0, failed: 0 }
  }

  try {
    roomId = normalizeRoomId(roomId)
    const db = getDB()
    const query = roomId ? { roomId } : {}
    const countRes = await db.collection('menu_items').where(query).count()
    const total = countRes.total
    if (total === 0) return { migrated: 0, failed: 0 }

    // 批量获取所有菜品
    const batchTimes = Math.ceil(total / 20)
    const tasks = []
    for (let i = 0; i < batchTimes; i++) {
      tasks.push(db.collection('menu_items').where(query).skip(i * 20).limit(20).get())
    }
    const results = await Promise.all(tasks)
    let allItems = []
    results.forEach(r => { allItems = allItems.concat(r.data) })

    let migrated = 0
    let failed = 0

    for (const item of allItems) {
      // 只迁移本地路径的图片
      if (item.image && item.image.startsWith('/static/')) {
        try {
          const cloudFileId = await uploadImageToCloud(item.image, `menu-images/${roomId || 'default'}`)
          if (cloudFileId) {
            await db.collection('menu_items').doc(item._id).update({
              data: { image: cloudFileId, updatedAt: new Date() },
            })
            migrated++
            console.log('[Cloud] 迁移图片成功:', item.name, '->', cloudFileId)
          } else {
            failed++
          }
        } catch (e) {
          failed++
          console.warn('[Cloud] 迁移图片失败:', item.name, e)
        }
      }
    }

    console.log(`[Cloud] 图片迁移完成: ${migrated} 成功, ${failed} 失败`)
    return { migrated, failed }
  } catch (e) {
    console.error('[Cloud] 图片迁移失败:', e)
    return { migrated: 0, failed: 0 }
  }
}

// ========== 菜品 CRUD ==========

/**
 * 默认菜品数据（首次 seed 用 & H5 降级用）
 */
const DEFAULT_MENU_ITEMS = [
  {
    name: '草莓甜心脆脆',
    desc: '新鲜草莓与法式奶油的完美结合',
    fullDesc: '使用新鲜空运奶油草莓，搭配低糖动物奶油千层酥底。一口咬下去满满幸福感，绝对不会长胖哦～',
    category: 'hot',
    emoji: '🍓',
    image: '/static/food1.jpg',
    price: '免费',
    available: true,
    sweetOptions: ['少少糖', '正常甜', '多多甜'],
    extraOptions: ['多放草莓', '加奶油', '不要香菜'],
    sortOrder: 1,
  },
  {
    name: '云朵抹茶拿铁',
    desc: '宇治抹茶搭配厚乳沫',
    fullDesc: '精选宇治抹茶，搭配绵密厚乳沫，入口即化。清新中带着一丝甜蜜，仿佛行走在京都的茶园间～',
    category: 'drink',
    emoji: '🍵',
    image: '/static/food2.jpg',
    price: '免费',
    available: true,
    sweetOptions: ['无糖', '微糖', '正常甜'],
    extraOptions: ['加椰果', '加珍珠', '加布丁'],
    sortOrder: 2,
  },
  {
    name: '杨枝甘露',
    desc: '芒果椰奶西米露，热带风情',
    fullDesc: '精选台农芒果搭配浓郁椰奶和Q弹西米，每一口都是热带阳光的味道，满满的水果鲜甜～',
    category: 'dessert',
    emoji: '🥭',
    image: '/static/food3.jpg',
    price: '免费',
    available: true,
    sweetOptions: ['少少糖', '正常甜', '多多甜'],
    extraOptions: ['多放芒果', '加西米', '加椰果'],
    sortOrder: 3,
  },
  {
    name: '芋泥波波奶茶',
    desc: '绵密芋泥配Q弹珍珠',
    fullDesc: '手工现蒸芋泥，搭配新鲜牛奶和Q弹黑糖珍珠。每一口都是软糯的幸福感，超级治愈～',
    category: 'drink',
    emoji: '🧋',
    image: '/static/food4.jpg',
    price: '免费',
    available: true,
    sweetOptions: ['无糖', '三分糖', '正常甜'],
    extraOptions: ['加芋圆', '加珍珠', '加布丁'],
    sortOrder: 4,
  },
  {
    name: '蜜桃乌龙茶',
    desc: '清新蜜桃遇上醇香乌龙',
    fullDesc: '水蜜桃果肉搭配高山乌龙茶汤，清新解腻又甜蜜。午后来一杯，好心情加倍～',
    category: 'drink',
    emoji: '🍑',
    image: '/static/food5.jpg',
    price: '免费',
    available: true,
    sweetOptions: ['无糖', '微糖', '正常甜'],
    extraOptions: ['加蜜桃果肉', '加芦荟', '加椰果'],
    sortOrder: 5,
  },
  {
    name: '提拉米苏',
    desc: '经典意式甜蜜诱惑',
    fullDesc: '手指饼干蘸取浓缩咖啡，层叠马斯卡彭芝士，撒上可可粉。一口一个天堂～',
    category: 'dessert',
    emoji: '🍰',
    image: '/static/food6.jpg',
    price: '免费',
    available: true,
    sweetOptions: ['少少糖', '正常甜', '多多甜'],
    extraOptions: ['多加可可', '加草莓', '加蓝莓'],
    sortOrder: 6,
  },
  {
    name: '日式炒乌冬',
    desc: '浓郁酱香Q弹面条',
    fullDesc: '特制日式酱汁炒制Q弹乌冬面，搭配新鲜蔬菜和温泉蛋。碳水快乐就是这么简单～',
    category: 'carb',
    emoji: '🍜',
    image: '/static/food7.jpg',
    price: '免费',
    available: true,
    sweetOptions: [],
    extraOptions: ['加温泉蛋', '加芝士', '加培根'],
    sortOrder: 7,
  },
  {
    name: '牛油果沙拉碗',
    desc: '新鲜健康轻食首选',
    fullDesc: '新鲜牛油果搭配藜麦、鸡胸肉和时令蔬菜，淋上特制油醋汁。好吃不长胖，越吃越美丽～',
    category: 'light',
    emoji: '🥗',
    image: '/static/food8.jpg',
    price: '免费',
    available: true,
    sweetOptions: [],
    extraOptions: ['多放牛油果', '加鸡胸肉', '加坚果'],
    sortOrder: 8,
  },
]

/**
 * 获取默认菜品（H5 降级用）
 */
export function getDefaultMenuItems() {
  const overrides = readLocalMenuOverrides()
  return DEFAULT_MENU_ITEMS.map((item, index) => ({
    ...item,
    ...(overrides['local_' + (index + 1)] || {}),
    _id: 'local_' + (index + 1),
  }))
}

/**
 * 从云数据库获取所有菜品
 * @returns {Promise<Array>}
 */
export async function fetchMenuItems(roomId) {
  roomId = normalizeRoomId(roomId)

  if (!isCloudAvailable() || !cloudInited) {
    // H5 环境保留演示数据；微信小程序端不再用本地默认菜品冒充云端数据。
    // #ifdef MP-WEIXIN
    console.warn('[Cloud] 微信云环境不可用，返回空菜单')
    return []
    // #endif
    console.log('[Cloud] H5 使用本地默认数据')
    return getDefaultMenuItems()
  }

  if (roomId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMenuItems',
        data: { roomId },
      })
      if (res.result && res.result.success && Array.isArray(res.result.items)) {
        console.log('[Cloud] 云函数获取菜品成功，共', res.result.items.length, '道, roomId:', roomId)
        return res.result.items
      }
      console.warn('[Cloud] 云函数获取菜品返回失败:', res.result?.message)
    } catch (e) {
      console.warn('[Cloud] 云函数 getMenuItems 调用失败，尝试直接查询:', e.message || e)
    }
  }

  try {
    const db = getDB()
    const query = roomId ? { roomId } : {}
    // 云数据库单次最多返回20条，分批拉取
    const countRes = await db.collection('menu_items').where(query).count()
    const total = countRes.total
    if (total === 0) {
      // 空集合，自动 seed
      console.log('[Cloud] 集合为空，开始 seed 默认数据...')
      await seedMenuData(roomId)
      return fetchMenuItems(roomId)
    }

    const batchTimes = Math.ceil(total / 20)
    const tasks = []
    for (let i = 0; i < batchTimes; i++) {
      tasks.push(
        db.collection('menu_items')
          .where(query)
          .orderBy('sortOrder', 'asc')
          .skip(i * 20)
          .limit(20)
          .get()
      )
    }
    const results = await Promise.all(tasks)
    let allData = []
    results.forEach(r => {
      allData = allData.concat(r.data)
    })
    console.log('[Cloud] 获取菜品成功，共', allData.length, '道')
    return allData
  } catch (e) {
    console.error('[Cloud] 获取菜品失败:', e)
    // #ifdef MP-WEIXIN
    return []
    // #endif
    return getDefaultMenuItems()
  }
}

/**
 * 新增菜品
 * @param {Object} data 菜品数据
 * @returns {Promise<string|null>} 返回新文档 _id
 */
export async function addMenuItem(data, roomId) {
  roomId = normalizeRoomId(roomId)

  if (!isCloudAvailable() || !cloudInited) {
    console.warn('[Cloud] 非云环境，无法新增菜品')
    return null
  }

  if (!roomId) {
    console.warn('[Cloud] 缺少 roomId，已取消新增菜品，避免写入公共菜单')
    return null
  }

  try {
    const res = await wx.cloud.callFunction({
      name: 'updateMenuItem',
      data: {
        action: 'add',
        updateFields: data,
        roomId,
      },
    })
    if (res.result && res.result.success && res.result._id) {
      console.log('[Cloud] 云函数新增菜品成功, _id:', res.result._id)
      return res.result._id
    }
    console.warn('[Cloud] 云函数新增菜品返回失败:', res.result?.message)
  } catch (e) {
    console.warn('[Cloud] 云函数新增菜品失败，尝试直接新增:', e.message || e)
  }

  try {
    const db = getDB()
    const now = new Date()
    const res = await db.collection('menu_items').add({
      data: {
        ...data,
        roomId: roomId || '',
        available: data.available !== false,
        createdAt: now,
        updatedAt: now,
      },
    })
    await touchRoomMenuVersion(roomId)
    console.log('[Cloud] 新增菜品成功, _id:', res._id)
    return res._id
  } catch (e) {
    console.error('[Cloud] 新增菜品失败:', e)
    return null
  }
}

/**
 * 更新菜品
 * @param {string} id 文档 _id
 * @param {Object} data 要更新的字段
 * @returns {Promise<boolean>}
 */
export async function updateMenuItem(id, data, roomId) {
  roomId = normalizeRoomId(roomId)

  if (!isCloudAvailable() || !cloudInited) {
    console.warn('[Cloud] 非云环境，无法更新菜品')
    return false
  }

  if (!id) {
    console.warn('[Cloud] 缺少菜品 id，无法更新')
    return false
  }

  // 优先使用云函数，绕过“仅创建者可写”等集合权限导致的跨端更新失败。
  try {
    const res = await wx.cloud.callFunction({
      name: 'updateMenuItem',
      data: {
        action: 'update',
        cloudId: id,
        updateFields: data,
        roomId: roomId || '',
      },
    })
    if (res.result && res.result.success) {
      console.log('[Cloud] 云函数更新菜品成功, _id:', id)
      return true
    }
    console.warn('[Cloud] 云函数更新菜品返回失败:', res.result?.message)
  } catch (e) {
    console.warn('[Cloud] 云函数 updateMenuItem 调用失败，尝试直接更新:', e.message || e)
  }

  try {
    const db = getDB()
    const nextData = {
      ...data,
      updatedAt: new Date(),
    }
    if (roomId) {
      nextData.roomId = roomId
    }
    await db.collection('menu_items').doc(id).update({
      data: nextData,
    })
    await touchRoomMenuVersion(roomId)
    console.log('[Cloud] 更新菜品成功, _id:', id)
    return true
  } catch (e) {
    console.error('[Cloud] 更新菜品失败:', e)
    console.error('[Cloud] 请确保: 1) updateMenuItem 云函数已部署  2) 或者 menu_items 集合允许主厨写入')
    return false
  }
}

/**
 * 删除菜品
 * @param {string} id 文档 _id
 * @returns {Promise<boolean>}
 */
export async function deleteMenuItem(id, roomId) {
  roomId = normalizeRoomId(roomId)

  if (!isCloudAvailable() || !cloudInited) {
    console.warn('[Cloud] 非云环境，无法删除菜品')
    return false
  }

  try {
    const res = await wx.cloud.callFunction({
      name: 'updateMenuItem',
      data: {
        action: 'delete',
        cloudId: id,
        roomId: roomId || '',
      },
    })
    if (res.result && res.result.success) {
      console.log('[Cloud] 云函数删除菜品成功, _id:', id)
      return true
    }
    console.warn('[Cloud] 云函数删除菜品返回失败:', res.result?.message)
  } catch (e) {
    console.warn('[Cloud] 云函数删除菜品失败，尝试直接删除:', e.message || e)
  }

  try {
    const db = getDB()
    await db.collection('menu_items').doc(id).remove()
    await touchRoomMenuVersion(roomId)
    console.log('[Cloud] 删除菜品成功, _id:', id)
    return true
  } catch (e) {
    console.error('[Cloud] 删除菜品失败:', e)
    return false
  }
}

/**
 * 切换菜品上下架状态
 * @param {string} id 文档 _id
 * @param {boolean} available 目标状态
 * @returns {Promise<boolean>}
 */
export async function toggleMenuItemAvailability(id, available, roomId) {
  return updateMenuItem(id, { available }, roomId)
}

/**
 * 首次使用时将默认菜品写入云数据库
 * 会自动将本地图片上传到云存储，并将云端 fileID 写入数据库
 */
export async function seedMenuData(roomId) {
  roomId = normalizeRoomId(roomId)

  if (!isCloudAvailable() || !cloudInited) {
    console.warn('[Cloud] 非云环境，无法 seed 数据')
    return false
  }

  try {
    const db = getDB()
    const now = new Date()

    // 逐个处理菜品：先上传图片，再写入数据库
    for (const item of DEFAULT_MENU_ITEMS) {
      let cloudImageId = item.image

      // 如果是本地路径，尝试上传到云存储
      if (item.image && item.image.startsWith('/static/')) {
        try {
          const uploaded = await uploadImageToCloud(item.image, `menu-images/${roomId || 'default'}`)
          if (uploaded) {
            cloudImageId = uploaded
            console.log('[Cloud] Seed 图片上传成功:', item.name, '->', uploaded)
          }
        } catch (imgErr) {
          console.warn('[Cloud] Seed 图片上传失败，使用本地路径:', item.name, imgErr)
        }
      }

      await db.collection('menu_items').add({
        data: {
          ...item,
          image: cloudImageId,
          roomId: roomId || '',
          createdAt: now,
          updatedAt: now,
        },
      })
    }

    console.log('[Cloud] Seed 默认数据成功，共', DEFAULT_MENU_ITEMS.length, '道菜品, roomId:', roomId)
    return true
  } catch (e) {
    console.error('[Cloud] Seed 数据失败:', e)
    return false
  }
}

// ========== 订单 CRUD ==========

let ordersCollectionReady = false

/**
 * 确保 orders 集合存在，不存在则自动创建
 */
async function ensureOrdersCollection() {
  if (ordersCollectionReady) return true
  if (!isCloudAvailable() || !cloudInited) return false

  try {
    const db = getDB()
    // 尝试 count，如果集合不存在会抛 -502005
    await db.collection('orders').count()
    ordersCollectionReady = true
    return true
  } catch (e) {
    const errCode = e?.errCode || e?.code
    if (errCode === -502005 || (e?.message || '').includes('not exist')) {
      console.log('[Cloud] orders 集合不存在，尝试自动创建...')
      try {
        const db = getDB()
        // 插入一条 seed 记录来自动创建集合
        const res = await db.collection('orders').add({
          data: { _seed: true, createdAt: new Date() },
        })
        // 立即删除 seed 记录
        await db.collection('orders').doc(res._id).remove()
        ordersCollectionReady = true
        console.log('[Cloud] orders 集合已自动创建')
        return true
      } catch (createErr) {
        console.error('[Cloud] 自动创建 orders 集合失败:', createErr)
        console.warn('[Cloud] 请在微信云控制台手动创建 "orders" 集合')
        return false
      }
    }
    console.error('[Cloud] 检查 orders 集合失败:', e)
    return false
  }
}

/**
 * 新增订单到云数据库
 * @param {Object} orderData 订单数据
 * @returns {Promise<string|null>} 返回云端文档 _id
 */
export async function addOrder(orderData, roomId) {
  roomId = normalizeRoomId(roomId)

  if (!isCloudAvailable() || !cloudInited) {
    console.log('[Cloud] 非云环境，订单仅保存本地')
    return null
  }

  const ready = await ensureOrdersCollection()
  if (!ready) {
    console.warn('[Cloud] orders 集合未就绪，订单仅保存本地')
    return null
  }

  try {
    const db = getDB()
    const res = await db.collection('orders').add({
      data: {
        ...orderData,
        roomId: roomId || '',
        rushLastTime: null,
        rushCount: 0,
        cloudCreatedAt: new Date(),
      },
    })
    console.log('[Cloud] 订单已上传云端, _id:', res._id)
    return res._id
  } catch (e) {
    console.error('[Cloud] 上传订单失败:', e)
    return null
  }
}

/**
 * 从云端获取所有订单
 * @returns {Promise<Array>}
 */
export async function fetchOrders(roomId) {
  roomId = normalizeRoomId(roomId)

  if (!isCloudAvailable() || !cloudInited) {
    console.log('[Cloud] 非云环境，使用本地订单')
    return null
  }

  const ready = await ensureOrdersCollection()
  if (!ready) return null

  try {
    const db = getDB()
    const query = roomId ? { roomId } : {}
    const countRes = await db.collection('orders').where(query).count()
    const total = countRes.total
    if (total === 0) return []

    const batchTimes = Math.ceil(total / 20)
    const tasks = []
    for (let i = 0; i < batchTimes; i++) {
      tasks.push(
        db.collection('orders')
          .where(query)
          .orderBy('createdAt', 'desc')
          .skip(i * 20)
          .limit(20)
          .get()
      )
    }
    const results = await Promise.all(tasks)
    let allData = []
    results.forEach(r => {
      allData = allData.concat(r.data)
    })
    console.log('[Cloud] 获取订单成功，共', allData.length, '单')
    return allData
  } catch (e) {
    console.error('[Cloud] 获取订单失败:', e)
    return null
  }
}

/**
 * 更新云端订单状态
 * 优先使用云函数（绕过安全规则，允许主厨更新客户创建的订单）
 * 云函数不可用时回退到客户端 SDK 直接更新
 * @param {string} cloudId 云端文档 _id
 * @param {Object} updateFields 要更新的字段
 * @returns {Promise<boolean>}
 */
export async function updateOrderInCloud(cloudId, updateFields) {
  if (!isCloudAvailable() || !cloudInited || !cloudId) {
    return false
  }

  // 方式1：优先使用云函数更新（不受安全规则限制）
  try {
    const res = await wx.cloud.callFunction({
      name: 'updateOrder',
      data: { cloudId, updateFields },
    })
    if (res.result && res.result.success) {
      console.log('[Cloud] 云函数更新订单成功, _id:', cloudId, '字段:', Object.keys(updateFields))
      return true
    }
    console.warn('[Cloud] 云函数返回失败:', res.result?.message)
  } catch (e) {
    console.warn('[Cloud] 云函数调用失败，尝试直接更新:', e.message || e)
  }

  // 方式2：回退到客户端 SDK 直接更新（受安全规则限制，仅创建者可写时会失败）
  try {
    const db = getDB()
    const res = await db.collection('orders').doc(cloudId).update({
      data: {
        ...updateFields,
        updatedAt: new Date(),
      },
    })
    const updated = res.stats && res.stats.updated > 0
    if (updated) {
      console.log('[Cloud] 直接更新订单成功, _id:', cloudId)
    } else {
      console.warn('[Cloud] 直接更新订单: 0条记录被更新（可能是权限问题），_id:', cloudId)
    }
    return updated
  } catch (e) {
    console.error('[Cloud] 更新订单状态失败:', e)
    console.error('[Cloud] 请确保: 1) updateOrder 云函数已部署  2) 或者 orders 集合权限设为"所有用户可读写"')
    return false
  }
}

/**
 * 催单 - 更新云端催单记录
 * @param {string} cloudId 云端文档 _id
 * @returns {Promise<boolean>}
 */
export async function rushOrderInCloud(cloudId) {
  if (!isCloudAvailable() || !cloudInited || !cloudId) {
    return false
  }

  const rushFields = {
    rushLastTime: new Date().toISOString(),
    updatedAt: new Date(),
  }

  // 方式1：优先使用云函数更新（可以使用 inc 操作符）
  try {
    const res = await wx.cloud.callFunction({
      name: 'updateOrder',
      data: {
        cloudId,
        updateFields: rushFields,
        incrementRushCount: true,
      },
    })
    if (res.result && res.result.success) {
      console.log('[Cloud] 云函数催单成功, _id:', cloudId)
      return true
    }
    console.warn('[Cloud] 云函数催单返回失败:', res.result?.message)
  } catch (e) {
    console.warn('[Cloud] 云函数催单失败，尝试直接更新:', e.message || e)
  }

  // 方式2：回退到客户端 SDK
  try {
    const db = getDB()
    const _ = db.command
    await db.collection('orders').doc(cloudId).update({
      data: {
        rushLastTime: new Date().toISOString(),
        rushCount: _.inc(1),
        updatedAt: new Date(),
      },
    })
    console.log('[Cloud] 催单成功, _id:', cloudId)
    return true
  } catch (e) {
    console.error('[Cloud] 催单失败:', e)
    return false
  }
}
