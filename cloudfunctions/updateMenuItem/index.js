// 云函数：管理菜品（服务端校验房间成员后更新房间菜单）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command

function normalizeRoomId(roomId) {
  return roomId ? String(roomId).trim().toUpperCase() : ''
}

function getRoomIdQuery(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId)
  const rawRoomId = roomId ? String(roomId).trim() : ''
  const roomIds = Array.from(new Set([rawRoomId, normalizedRoomId].filter(Boolean)))
  return roomIds.length > 1 ? { roomId: _.in(roomIds) } : { roomId: normalizedRoomId }
}

function buildCategoryId(name) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `cat_${base || Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function buildCouponId() {
  return `coupon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function normalizeText(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeStringArray(value, maxItems = 20, maxLength = 80) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => normalizeText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function normalizeKeywordList(value, maxItems = 20, maxLength = 40) {
  if (Array.isArray(value)) {
    return normalizeStringArray(value, maxItems, maxLength)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,，、;；\n]/)
      .map(item => normalizeText(item, maxLength))
      .filter(Boolean)
      .slice(0, maxItems)
  }
  return []
}

function normalizeOptionGroups(value) {
  if (!Array.isArray(value)) return []
  return value
    .map(group => {
      if (!group || typeof group !== 'object') return null
      const label = normalizeText(group.label, 30)
      const options = normalizeStringArray(group.options, 30, 60)
      if (!label || options.length === 0) return null
      return { label, options }
    })
    .filter(Boolean)
    .slice(0, 6)
}

function sanitizeMenuItemFields(fields) {
  if (!fields || typeof fields !== 'object') return {}
  const data = {}

  if ('name' in fields) data.name = normalizeText(fields.name, 80)
  if ('desc' in fields) data.desc = normalizeText(fields.desc, 160)
  if ('fullDesc' in fields) data.fullDesc = normalizeText(fields.fullDesc, 600)
  if ('category' in fields) data.category = normalizeText(fields.category, 80)
  if ('emoji' in fields) data.emoji = normalizeText(fields.emoji, 16)
  if ('image' in fields) data.image = normalizeText(fields.image, 300)
  if ('price' in fields) data.price = normalizeText(fields.price, 40)
  if ('available' in fields) data.available = fields.available !== false
  if ('sortOrder' in fields) data.sortOrder = Number(fields.sortOrder) || 1
  if ('optionGroups' in fields) data.optionGroups = normalizeOptionGroups(fields.optionGroups)
  if ('sweetLabel' in fields) data.sweetLabel = normalizeText(fields.sweetLabel, 30)
  if ('sweetOptions' in fields) data.sweetOptions = normalizeStringArray(fields.sweetOptions, 30, 60)
  if ('extraLabel' in fields) data.extraLabel = normalizeText(fields.extraLabel, 30)
  if ('extraOptions' in fields) data.extraOptions = normalizeStringArray(fields.extraOptions, 30, 60)
  if ('dislikeKeywords' in fields) data.dislikeKeywords = normalizeKeywordList(fields.dislikeKeywords)
  if ('allergyKeywords' in fields) data.allergyKeywords = normalizeKeywordList(fields.allergyKeywords)

  return data
}

function sanitizeCategoryFields(fields) {
  if (!fields || typeof fields !== 'object') return {}
  const rawId = normalizeText(fields.id, 80)
  return {
    id: rawId.replace(/[^\w\u4e00-\u9fa5-]/g, '') || '',
    name: normalizeText(fields.name, 40),
    emoji: normalizeText(fields.emoji || '🍽️', 16) || '🍽️',
    color: normalizeText(fields.color || '#E8F3FF', 32) || '#E8F3FF',
    sortOrder: Number(fields.sortOrder) || Date.now(),
  }
}

function sanitizeCouponFields(fields) {
  if (!fields || typeof fields !== 'object') return {}
  const rawId = normalizeText(fields.id, 80)
  const required = Math.max(0, Number(fields.required) || 0)
  const data = {
    id: rawId.replace(/[^\w-]/g, '') || '',
    name: normalizeText(fields.name, 40),
    desc: normalizeText(fields.desc, 160),
    emoji: normalizeText(fields.emoji || '🎁', 16) || '🎁',
    color: normalizeText(fields.color || '#FFF1F0', 32) || '#FFF1F0',
    required,
  }
  if ('redeemed' in fields) data.redeemed = fields.redeemed === true
  if ('redeemedAt' in fields) data.redeemedAt = fields.redeemedAt || null
  if ('redeemedBy' in fields) data.redeemedBy = normalizeText(fields.redeemedBy, 80)
  return data
}

function isRoomMember(room, openid) {
  if (!room || !openid) return false
  const members = Array.isArray(room.members) ? room.members : []
  return room.creatorOpenid === openid || members.includes(openid)
}

async function authorizeRoomMember(roomId, openid) {
  const normalizedRoomId = normalizeRoomId(roomId)
  if (!openid) {
    return { success: false, message: '无法获取用户身份' }
  }
  if (!normalizedRoomId) {
    return { success: false, message: '缺少 roomId' }
  }

  const roomRes = await db.collection('rooms')
    .where(getRoomIdQuery(normalizedRoomId))
    .limit(1)
    .get()
  const room = roomRes.data && roomRes.data[0]
  if (!room) {
    return { success: false, message: '房间不存在' }
  }
  if (!isRoomMember(room, openid)) {
    return { success: false, message: '没有当前房间的操作权限' }
  }

  return { success: true, room }
}

function isCollectionMissing(error) {
  const errCode = error && (error.errCode || error.code)
  const message = String((error && error.message) || error || '').toLowerCase()
  return errCode === -502005 ||
    message.includes('collection not exists') ||
    message.includes('collection not exist') ||
    message.includes('collection does not exist') ||
    message.includes('not exist')
}

function isCollectionAlreadyExists(error) {
  const message = String((error && error.message) || error || '').toLowerCase()
  return message.includes('already exists') ||
    message.includes('already exist') ||
    message.includes('collection exists') ||
    message.includes('collection existed')
}

async function ensureCollection(collectionName) {
  if (typeof db.createCollection !== 'function') return
  try {
    await db.createCollection(collectionName)
  } catch (e) {
    if (!isCollectionAlreadyExists(e)) throw e
  }
}

async function addCollectionDoc(collectionName, data) {
  try {
    return await db.collection(collectionName).add({ data })
  } catch (e) {
    if (!isCollectionMissing(e)) throw e
    await ensureCollection(collectionName)
    return db.collection(collectionName).add({ data })
  }
}

async function removeDocsByQuery(collectionName, query) {
  let removed = 0
  while (true) {
    const res = await db.collection(collectionName)
      .where(query)
      .limit(100)
      .get()

    const docs = Array.isArray(res.data) ? res.data : []
    if (docs.length === 0) break

    await Promise.all(docs.map((doc) => db.collection(collectionName).doc(doc._id).remove()))
    removed += docs.length

    if (docs.length < 100) break
  }
  return removed
}

async function reassignMenuItemsCategory(roomId, categoryId, fallbackCategoryId) {
  if (!fallbackCategoryId) return 0

  let updated = 0
  while (true) {
    const res = await db.collection('menu_items')
      .where({ roomId, category: categoryId })
      .limit(100)
      .get()

    const docs = Array.isArray(res.data) ? res.data : []
    if (docs.length === 0) break

    await Promise.all(docs.map((doc) => db.collection('menu_items').doc(doc._id).update({
      data: {
        category: fallbackCategoryId,
        updatedAt: new Date(),
      },
    })))
    updated += docs.length

    if (docs.length < 100) break
  }
  return updated
}

async function touchRoomMenu(roomId) {
  roomId = normalizeRoomId(roomId)
  if (!roomId) return

  try {
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
    console.warn('更新房间菜单版本失败:', e)
  }
}

async function findCouponDoc({ cloudId, couponId, roomId }) {
  const normalizedRoomId = normalizeRoomId(roomId)
  const docId = String(cloudId || '').trim()
  let doc = null

  if (docId) {
    try {
      const res = await db.collection('custom_coupons').doc(docId).get()
      if (res && res.data) {
        doc = { ...res.data, _id: res.data._id || docId }
      }
    } catch (e) {
      doc = null
    }
  }

  if (!doc) {
    const normalizedCouponId = String(couponId || docId || '').trim()
    if (!normalizedCouponId || !normalizedRoomId) return null
    const res = await db.collection('custom_coupons')
      .where({ roomId: normalizedRoomId, id: normalizedCouponId })
      .limit(1)
      .get()
    doc = Array.isArray(res.data) ? res.data[0] || null : null
  }

  if (!doc) return null
  return {
    doc,
    roomId: normalizeRoomId(doc.roomId || roomId),
  }
}

exports.main = async (event, context) => {
  const { action = 'update', cloudId, updateFields } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const roomId = normalizeRoomId(event.roomId)
  let cachedAuth = null

  async function ensureRoomAuth(targetRoomId = roomId) {
    const normalizedTargetRoomId = normalizeRoomId(targetRoomId)
    if (cachedAuth && normalizeRoomId(cachedAuth.room && cachedAuth.room.roomId) === normalizedTargetRoomId) {
      return cachedAuth
    }
    cachedAuth = await authorizeRoomMember(normalizedTargetRoomId, openid)
    return cachedAuth
  }

  if (action === 'addCoupon') {
    const couponFields = sanitizeCouponFields(updateFields)
    if (!roomId || !couponFields.name) {
      return { success: false, message: '缺少参数' }
    }

    if (!couponFields.required) {
      return { success: false, message: '缺少所需次数' }
    }

    try {
      const auth = await ensureRoomAuth()
      if (!auth.success) return auth

      const now = new Date()
      const coupon = {
        id: couponFields.id || buildCouponId(),
        name: couponFields.name,
        desc: couponFields.desc || `累计投喂 ${couponFields.required} 次即可兑换`,
        emoji: couponFields.emoji,
        color: couponFields.color,
        required: couponFields.required,
        custom: true,
        redeemed: false,
        redeemedAt: null,
        redeemedBy: '',
        roomId,
        createdAt: now,
        updatedAt: now,
      }

      const res = await addCollectionDoc('custom_coupons', coupon)
      await touchRoomMenu(roomId)
      return { success: true, _id: res._id, coupon: { ...coupon, _id: res._id } }
    } catch (e) {
      console.error('新增特权失败:', e)
      return { success: false, message: e.message || '新增失败' }
    }
  }

  if (action === 'deleteCoupon') {
    const couponId = String(event.couponId || '').trim()
    if (!roomId || (!cloudId && !couponId)) {
      return { success: false, message: '缺少参数' }
    }

    try {
      const found = await findCouponDoc({ cloudId, couponId, roomId })
      if (!found || !found.doc || !found.roomId) {
        return { success: false, message: '兑换券不存在' }
      }
      if (found.roomId !== roomId) {
        return { success: false, message: '兑换券不属于当前房间' }
      }
      const auth = await ensureRoomAuth(found.roomId)
      if (!auth.success) return auth

      const res = await db.collection('custom_coupons').doc(found.doc._id).remove()
      await touchRoomMenu(found.roomId)
      return { success: true, removed: res.stats.removed }
    } catch (e) {
      console.error('删除特权失败:', e)
      return { success: false, message: e.message || '删除失败' }
    }
  }

  if (action === 'redeemCoupon') {
    const couponId = String(event.couponId || '').trim()
    if (!roomId || (!cloudId && !couponId)) {
      return { success: false, message: '缺少参数' }
    }

    try {
      const found = await findCouponDoc({ cloudId, couponId, roomId })
      if (!found || !found.doc || !found.roomId) {
        return { success: false, message: '兑换券不存在' }
      }
      if (found.roomId !== roomId) {
        return { success: false, message: '兑换券不属于当前房间' }
      }
      const auth = await ensureRoomAuth(found.roomId)
      if (!auth.success) return auth

      const now = new Date()
      const nextFields = {
        redeemed: true,
        redeemedAt: now,
        redeemedBy: openid,
        updatedAt: now,
      }
      await db.collection('custom_coupons').doc(found.doc._id).update({
        data: nextFields,
      })
      await touchRoomMenu(found.roomId)
      return {
        success: true,
        coupon: {
          ...found.doc,
          ...nextFields,
        },
      }
    } catch (e) {
      console.error('兑换特权失败:', e)
      return { success: false, message: e.message || '兑换失败' }
    }
  }

  if (action === 'addCategory') {
    const categoryFields = sanitizeCategoryFields(updateFields)
    if (!roomId || !categoryFields.name) {
      return { success: false, message: '缺少参数' }
    }

    try {
      const auth = await ensureRoomAuth()
      if (!auth.success) return auth

      const now = new Date()
      const category = {
        id: categoryFields.id || buildCategoryId(categoryFields.name),
        name: categoryFields.name,
        emoji: categoryFields.emoji,
        color: categoryFields.color,
        sortOrder: categoryFields.sortOrder,
        roomId,
        createdAt: now,
        updatedAt: now,
      }

      const res = await addCollectionDoc('menu_categories', category)
      await touchRoomMenu(roomId)
      return { success: true, _id: res._id, category: { ...category, _id: res._id } }
    } catch (e) {
      console.error('新增分类失败:', e)
      return { success: false, message: e.message || '新增失败' }
    }
  }

  if (action === 'deleteCategory') {
    const categoryId = String(event.categoryId || '').trim()
    const fallbackCategoryId = String(event.fallbackCategoryId || '').trim()
    if (!roomId || !categoryId) {
      return { success: false, message: '缺少参数' }
    }
    if (fallbackCategoryId && fallbackCategoryId === categoryId) {
      return { success: false, message: '备用分类不能和删除分类相同' }
    }

    try {
      const auth = await ensureRoomAuth()
      if (!auth.success) return auth

      const countRes = await db.collection('menu_categories').where({ roomId }).count()
      if ((Number(countRes.total) || 0) <= 1) {
        return { success: false, message: '至少保留一个分类' }
      }

      const removed = await removeDocsByQuery('menu_categories', { roomId, id: categoryId })
      if (!removed) {
        return { success: false, message: '分类不存在' }
      }

      const updatedItems = await reassignMenuItemsCategory(roomId, categoryId, fallbackCategoryId)
      await touchRoomMenu(roomId)
      return { success: true, removed, updatedItems }
    } catch (e) {
      console.error('删除分类失败:', e)
      return { success: false, message: e.message || '删除失败' }
    }
  }

  if (action === 'add') {
    const menuFields = sanitizeMenuItemFields(updateFields)
    if (!roomId || !menuFields.name) {
      return { success: false, message: '缺少参数' }
    }

    try {
      const auth = await ensureRoomAuth()
      if (!auth.success) return auth

      const now = new Date()
      const res = await db.collection('menu_items').add({
        data: {
          ...menuFields,
          roomId,
          available: menuFields.available !== false,
          createdAt: now,
          updatedAt: now,
        },
      })

      await touchRoomMenu(roomId)
      return { success: true, _id: res._id }
    } catch (e) {
      console.error('新增菜品失败:', e)
      return { success: false, message: e.message || '新增失败' }
    }
  }

  if (action === 'deleteByRoom') {
    if (!roomId) {
      return { success: false, message: '缺少 roomId' }
    }

    try {
      const auth = await ensureRoomAuth()
      if (!auth.success) return auth

      let removed = 0
      while (true) {
        const res = await db.collection('menu_items')
          .where(getRoomIdQuery(event.roomId))
          .limit(100)
          .get()

        const docs = Array.isArray(res.data) ? res.data : []
        if (docs.length === 0) break

        await Promise.all(docs.map((doc) => db.collection('menu_items').doc(doc._id).remove()))
        removed += docs.length

        if (docs.length < 100) break
      }

      await touchRoomMenu(roomId)
      return { success: true, removed }
    } catch (e) {
      console.error('清空房间菜品失败:', e)
      return { success: false, message: e.message || '清空失败' }
    }
  }

  if (!cloudId) {
    return { success: false, message: '缺少参数' }
  }

  try {
    if (action === 'delete') {
      const current = await db.collection('menu_items').doc(cloudId).get()
      const targetRoomId = normalizeRoomId((current.data && current.data.roomId) || roomId)
      if (!targetRoomId) {
        return { success: false, message: '菜品缺少房间归属' }
      }
      if (roomId && targetRoomId !== roomId) {
        return { success: false, message: '菜品不属于当前房间' }
      }
      const auth = await ensureRoomAuth(targetRoomId)
      if (!auth.success) return auth

      const res = await db.collection('menu_items').doc(cloudId).remove()
      await touchRoomMenu(targetRoomId)
      return { success: true, removed: res.stats.removed }
    }

    const menuFields = sanitizeMenuItemFields(updateFields)
    if (Object.keys(menuFields).length === 0) {
      return { success: false, message: '缺少参数' }
    }

    const current = await db.collection('menu_items').doc(cloudId).get()
    const currentRoomId = normalizeRoomId((current.data && current.data.roomId) || roomId)
    if (!currentRoomId) {
      return { success: false, message: '菜品缺少房间归属' }
    }
    if (roomId && currentRoomId !== roomId) {
      return { success: false, message: '菜品不属于当前房间' }
    }
    const auth = await ensureRoomAuth(currentRoomId)
    if (!auth.success) return auth

    const nextFields = {
      ...menuFields,
      updatedAt: new Date(),
      roomId: currentRoomId,
    }

    const res = await db.collection('menu_items').doc(cloudId).update({
      data: nextFields,
    })

    await touchRoomMenu(currentRoomId)
    return { success: true, updated: res.stats.updated }
  } catch (e) {
    console.error('管理菜品失败:', e)
    return { success: false, message: e.message || '操作失败' }
  }
}
