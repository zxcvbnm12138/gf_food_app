// 云函数：管理菜品（绕过客户端安全规则，允许主厨更新房间菜单）
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

exports.main = async (event, context) => {
  const { action = 'update', cloudId, updateFields } = event
  const roomId = normalizeRoomId(event.roomId)

  if (action === 'addCoupon') {
    if (!roomId || !updateFields || !String(updateFields.name || '').trim()) {
      return { success: false, message: '缺少参数' }
    }

    const required = Math.max(0, Number(updateFields.required) || 0)
    if (!required) {
      return { success: false, message: '缺少所需次数' }
    }

    try {
      const now = new Date()
      const coupon = {
        id: updateFields.id || buildCouponId(),
        name: String(updateFields.name).trim(),
        desc: updateFields.desc || `累计投喂 ${required} 次即可兑换`,
        emoji: String(updateFields.emoji || '🎁').trim() || '🎁',
        color: updateFields.color || '#FFF1F0',
        required,
        custom: true,
        roomId,
        createdAt: now,
        updatedAt: now,
      }

      const res = await addCollectionDoc('custom_coupons', coupon)
      return { success: true, _id: res._id, coupon: { ...coupon, _id: res._id } }
    } catch (e) {
      console.error('新增特权失败:', e)
      return { success: false, message: e.message || '新增失败' }
    }
  }

  if (action === 'addCategory') {
    if (!roomId || !updateFields || !String(updateFields.name || '').trim()) {
      return { success: false, message: '缺少参数' }
    }

    try {
      const now = new Date()
      const category = {
        id: updateFields.id || buildCategoryId(updateFields.name),
        name: String(updateFields.name).trim(),
        emoji: String(updateFields.emoji || '🍽️').trim() || '🍽️',
        color: updateFields.color || '#E8F3FF',
        sortOrder: Number(updateFields.sortOrder) || Date.now(),
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
    if (!roomId || !updateFields) {
      return { success: false, message: '缺少参数' }
    }

    try {
      const now = new Date()
      const res = await db.collection('menu_items').add({
        data: {
          ...updateFields,
          roomId,
          available: updateFields.available !== false,
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
      let targetRoomId = roomId
      if (!targetRoomId) {
        const current = await db.collection('menu_items').doc(cloudId).get()
        targetRoomId = current.data && current.data.roomId
      }
      const res = await db.collection('menu_items').doc(cloudId).remove()
      await touchRoomMenu(targetRoomId)
      return { success: true, removed: res.stats.removed }
    }

    if (!updateFields) {
      return { success: false, message: '缺少参数' }
    }

    if (roomId) {
      const current = await db.collection('menu_items').doc(cloudId).get()
      const currentRoomId = normalizeRoomId(current.data && current.data.roomId)
      if (currentRoomId && currentRoomId !== roomId) {
        return { success: false, message: '菜品不属于当前房间' }
      }
    }

    const nextFields = {
      ...updateFields,
      updatedAt: new Date(),
    }
    if (roomId) {
      nextFields.roomId = roomId
    }

    const res = await db.collection('menu_items').doc(cloudId).update({
      data: nextFields,
    })

    await touchRoomMenu(roomId)
    return { success: true, updated: res.stats.updated }
  } catch (e) {
    console.error('管理菜品失败:', e)
    return { success: false, message: e.message || '操作失败' }
  }
}
