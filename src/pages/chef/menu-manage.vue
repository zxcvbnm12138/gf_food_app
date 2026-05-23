<template>
  <view class="page">
    <view class="status-bar"></view>
    <view class="top-header">
      <text class="page-title">菜品管理</text>
      <view class="header-count"><text class="count-text">{{ menuItems.length }} 道菜品</text></view>
    </view>
    <!-- 搜索 -->
    <view class="search-bar">
      <text class="search-icon">🔍</text>
      <input class="search-input" v-model="searchText" placeholder="搜索菜品..." />
    </view>
    <!-- 菜品列表 -->
    <scroll-view class="menu-scroll" scroll-y :enhanced="true" :show-scrollbar="false" @scrolltolower="onScrollBottom" refresher-enabled :refresher-triggered="isRefreshing" @refresherrefresh="onRefresh">
      <view class="menu-list">
        <!-- 加载中状态 -->
        <view v-if="isLoading" class="loading-state">
          <view class="loading-spinner"></view>
          <text class="loading-text">加载菜品中...</text>
        </view>
        <view
          v-for="(item, idx) in filteredItems"
          :key="item._id || item.id"
          class="menu-swipe-row"
          :style="{ animationDelay: (idx * 0.06) + 's' }"
          @touchstart="startSwipe(item, $event)"
          @touchmove="moveSwipe(item, $event)"
          @touchend="endSwipe(item, $event)"
          @touchcancel="endSwipe(item, $event)"
        >
          <view class="menu-delete-action" @click.stop="confirmSwipeDelete(item)">
            <text class="menu-delete-icon">−</text>
            <text class="menu-delete-text">删除</text>
          </view>
          <view
            class="menu-card"
            :class="{ swiped: isItemSwiped(item) }"
            @click="handleCardClick(item)"
          >
            <view class="menu-img">
              <image v-if="item.image" class="menu-photo" :src="item.image" mode="aspectFill" />
              <text v-else class="menu-photo-emoji">{{ item.emoji || '🍽️' }}</text>
            </view>
            <view class="menu-info">
              <view class="menu-top-row">
                <text class="menu-name">{{ item.name }}</text>
                <view class="avail-badge" :class="item.available !== false ? 'on' : 'off'">
                  <text class="avail-text">{{ item.available !== false ? '上架中' : '已下架' }}</text>
                </view>
              </view>
              <text class="menu-desc">{{ item.desc }}</text>
              <view class="menu-bottom">
                <text class="menu-cat">{{ getCatName(item.category) }}</text>
                <view class="switch-hit-area" @click.stop @tap.stop>
                  <switch class="menu-switch" :checked="item.available !== false" @change="toggleAvail(item, $event)" color="#4080FF" />
                </view>
              </view>
            </view>
          </view>
        </view>
        <view v-if="!isLoading && filteredItems.length === 0" class="empty-state">
          <text class="empty-emoji">🍽️</text>
          <text class="empty-text">没有找到匹配的菜品</text>
        </view>
        <view class="list-spacer"></view>
      </view>
    </scroll-view>

    <!-- 添加菜品按钮 -->
    <view class="add-fab" @click="openAdd">
      <text class="add-fab-icon">+</text>
    </view>

    <!-- 编辑/新增弹窗 -->
    <view class="edit-overlay" v-if="showEdit" @click="showEdit = false">
      <view class="edit-card" @click.stop>
        <text class="edit-title">{{ isNewItem ? '新增菜品' : '编辑菜品' }}</text>

        <!-- 菜品头部（编辑模式） -->
        <view v-if="!isNewItem" class="edit-item-head">
          <image v-if="editForm.imagePreview || editForm.image" class="edit-photo" :src="editForm.imagePreview || editForm.image" mode="aspectFill" />
          <view v-else class="edit-photo edit-photo-placeholder">
            <text class="menu-photo-emoji">{{ editForm.emoji || '🍽️' }}</text>
          </view>
          <view class="edit-head-info">
            <text class="edit-name">{{ editForm.name }}</text>
            <text class="edit-cat">{{ getCatName(editForm.category) }}</text>
          </view>
        </view>

        <scroll-view class="edit-scroll" scroll-y :enhanced="true" :show-scrollbar="false">
          <!-- 菜品名称 -->
          <view class="edit-field">
            <text class="edit-label">菜品名称</text>
            <input class="edit-input" v-model="editForm.name" placeholder="输入菜品名称" maxlength="20" />
          </view>

          <!-- 分类 -->
          <view class="edit-field">
            <text class="edit-label">分类</text>
            <view class="cat-picker">
              <view v-for="cat in catOptions" :key="cat.id"
                class="cat-chip"
                :class="{ active: editForm.category === cat.id }"
                @click="selectCategory(cat)">
                <text class="cat-chip-text">{{ cat.label }}</text>
                <view v-if="isDeletingCategories" class="cat-delete-mark" @click.stop="confirmDeleteCategory(cat)">
                  <text class="cat-delete-text">−</text>
                </view>
              </view>
              <view class="cat-chip add-cat-chip" @click="toggleCategoryCreator">
                <text class="cat-chip-text add">+ 增加分类</text>
              </view>
              <view class="cat-chip delete-cat-chip" :class="{ active: isDeletingCategories }" @click="toggleCategoryDeleteMode">
                <text class="cat-chip-text delete">{{ isDeletingCategories ? '完成删除' : '删除分类' }}</text>
              </view>
            </view>

            <view v-if="showCategoryCreator" class="category-creator">
              <input class="edit-input" v-model="newCategoryName" placeholder="分类名称，如 下饭菜" maxlength="12" />
              <text class="edit-label small">选择分类图标</text>
              <view class="emoji-picker">
                <view
                  v-for="emoji in categoryEmojiOptions"
                  :key="emoji"
                  class="emoji-chip"
                  :class="{ active: newCategoryEmoji === emoji }"
                  @click="newCategoryEmoji = emoji"
                >
                  <text class="emoji-chip-text">{{ emoji }}</text>
                </view>
              </view>
              <view class="create-category-btn" :class="{ disabled: isCreatingCategory }" @click="createCategory">
                <text class="create-category-text">{{ isCreatingCategory ? '添加中...' : '保存分类' }}</text>
              </view>
            </view>
          </view>

          <!-- 图片上传 -->
          <view class="edit-field">
            <text class="edit-label">菜品图片</text>
            <view class="image-upload-area" @click="chooseAndUploadImage">
              <image v-if="editForm.imagePreview || editForm.image" class="upload-preview" :src="editForm.imagePreview || editForm.image" mode="aspectFill" />
              <view v-else class="upload-placeholder">
                <text class="upload-icon">📷</text>
                <text class="upload-hint">点击上传图片</text>
              </view>
              <view class="upload-overlay" v-if="isUploading">
                <view class="upload-spinner"></view>
                <text class="upload-progress-text">上传中...</text>
              </view>
              <view class="upload-change-btn" v-if="editForm.image && !isUploading">
                <text class="upload-change-text">更换图片</text>
              </view>
            </view>
          </view>

          <!-- 菜品描述 -->
          <view class="edit-field">
            <text class="edit-label">简要描述</text>
            <textarea class="edit-textarea" v-model="editForm.desc" :auto-height="true" maxlength="100" placeholder="简短描述" />
          </view>

          <!-- 详细描述 -->
          <view class="edit-field">
            <text class="edit-label">详细描述</text>
            <textarea class="edit-textarea" v-model="editForm.fullDesc" :auto-height="true" maxlength="500" placeholder="详细描述（可选）" />
          </view>

          <view class="edit-field">
            <text class="edit-label">绝对不吃关键词</text>
            <textarea class="edit-textarea" v-model="editForm.dislikeKeywordsStr" :auto-height="true" maxlength="100" placeholder="例如：香菜,苦瓜,洋葱" />
          </view>

          <view class="edit-field">
            <text class="edit-label">过敏关键词</text>
            <textarea class="edit-textarea" v-model="editForm.allergyKeywordsStr" :auto-height="true" maxlength="100" placeholder="例如：花生,牛奶,坚果" />
          </view>

          <!-- 价格 -->
          <view class="edit-field">
            <text class="edit-label">价格文案</text>
            <input class="edit-input" v-model="editForm.price" placeholder="免费" />
          </view>

          <!-- 排序 -->
          <view class="edit-field">
            <text class="edit-label">排序权重</text>
            <input class="edit-input" v-model="editForm.sortOrder" type="number" placeholder="1" />
          </view>

          <view class="edit-field">
            <text class="edit-label">自定义选项一</text>
            <input class="edit-input" v-model="editForm.optionGroup1Label" placeholder="选项名称，如 甜度 / 辣度 / 冰度" maxlength="12" />
            <input class="edit-input" v-model="editForm.optionGroup1OptionsStr" placeholder="选项内容，如 微辣,中辣,特辣" />
          </view>

          <view class="edit-field">
            <text class="edit-label">自定义选项二</text>
            <input class="edit-input" v-model="editForm.optionGroup2Label" placeholder="选项名称，如 加料 / 份量 / 做法" maxlength="12" />
            <input class="edit-input" v-model="editForm.optionGroup2OptionsStr" placeholder="选项内容，如 加蛋,加肉,不要葱" />
          </view>
        </scroll-view>

        <!-- 操作按钮 -->
        <view class="edit-actions">
          <view v-if="!isNewItem" class="edit-btn delete" @click="confirmDelete">
            <text class="edit-btn-text delete">删除</text>
          </view>
          <view class="edit-btn cancel" @click="showEdit = false">
            <text class="edit-btn-text cancel">取消</text>
          </view>
          <view class="edit-btn save" :class="{ disabled: isSaving }" @click="saveEdit">
            <text class="edit-btn-text save">{{ isSaving ? '保存中...' : '保存' }}</text>
          </view>
        </view>
      </view>
    </view>

    <ChefTabBar :current="2" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import store, {
  loadMenuFromCloud,
  addMenuItemToCloud,
  updateMenuItemInCloud,
  deleteMenuItemFromCloud,
  toggleItemAvailability,
  uploadImageToCloud,
  loadMenuCategoriesFromCloud,
  addMenuCategoryToCloud,
  deleteMenuCategoryFromCloud,
  getMenuItemOptionGroups,
} from '@/store/index.js'
import { isCloudAvailable } from '@/services/cloud.js'
import ChefTabBar from '@/components/ChefTabBar.vue'

const searchText = ref('')
const showEdit = ref(false)
const isNewItem = ref(false)
const isSaving = ref(false)
const isLoading = ref(false)
const isRefreshing = ref(false)
const isUploading = ref(false)
const isCreatingCategory = ref(false)
const showCategoryCreator = ref(false)
const isDeletingCategories = ref(false)
const newCategoryName = ref('')
const newCategoryEmoji = ref('🍽️')
const categoryEmojiOptions = ['🔥', '🍰', '🥤', '🍜', '🥗', '🍵', '🍚', '🥩', '🌶️', '🍲', '🍱', '🍽️']
const swipedItemId = ref('')
let swipeItemId = ''
let swipeStartX = 0
let swipeStartY = 0
let swipeLastX = 0
let swipeLastY = 0

const editForm = ref({
  _id: '',
  name: '',
  desc: '',
  fullDesc: '',
  dislikeKeywordsStr: '',
  allergyKeywordsStr: '',
  category: 'hot',
  emoji: '🍽️',
  image: '',
  imagePreview: '',
  available: true,
  price: '免费',
  sortOrder: 1,
  optionGroup1Label: '甜度',
  optionGroup1OptionsStr: '',
  optionGroup2Label: '加料',
  optionGroup2OptionsStr: '',
})

const menuItems = computed(() => store.menuItems)

const filteredItems = computed(() => {
  if (!searchText.value.trim()) return menuItems.value
  const kw = searchText.value.trim().toLowerCase()
  return menuItems.value.filter(i => i.name.toLowerCase().includes(kw) || i.desc.toLowerCase().includes(kw))
})

const catOptions = computed(() => store.categories.map(cat => ({
  id: cat.id,
  label: `${cat.emoji ? cat.emoji + ' ' : ''}${cat.name}`,
  emoji: cat.emoji || '🍽️',
})))

const getCatName = (cat) => {
  const target = store.categories.find(item => item.id === cat)
  return target ? `${target.emoji ? target.emoji + ' ' : ''}${target.name}` : cat
}
const getCatEmoji = (cat) => store.categories.find(item => item.id === cat)?.emoji || '🍽️'
const getItemKey = (item) => String(item?._id || item?.id || '')
const isItemSwiped = (item) => swipedItemId.value === getItemKey(item)

const startSwipe = (item, event) => {
  const touch = event.touches?.[0]
  if (!touch) return
  swipeItemId = getItemKey(item)
  swipeStartX = touch.clientX
  swipeStartY = touch.clientY
  swipeLastX = touch.clientX
  swipeLastY = touch.clientY
}

const moveSwipe = (item, event) => {
  const touch = event.touches?.[0]
  if (!touch || swipeItemId !== getItemKey(item)) return
  swipeLastX = touch.clientX
  swipeLastY = touch.clientY
}

const endSwipe = (item, event) => {
  const touch = event.changedTouches?.[0]
  if (touch) {
    swipeLastX = touch.clientX
    swipeLastY = touch.clientY
  }
  const itemId = getItemKey(item)
  if (!itemId || swipeItemId !== itemId) return

  const deltaX = swipeLastX - swipeStartX
  const deltaY = swipeLastY - swipeStartY
  if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -40) {
    swipedItemId.value = itemId
  } else if (deltaX > 20 || Math.abs(deltaY) > Math.abs(deltaX)) {
    swipedItemId.value = ''
  }
  swipeItemId = ''
}

const handleCardClick = (item) => {
  if (swipedItemId.value) {
    swipedItemId.value = ''
    return
  }
  openEdit(item)
}

const parseOptionList = (value) => (
  value
    ? value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    : []
)

const parseKeywordList = (value) => (
  value
    ? value.split(/[,，、;；\n]/).map(s => s.trim()).filter(Boolean)
    : []
)

const buildOptionGroups = (form) => {
  const rawGroups = [
    {
      label: form.optionGroup1Label.trim(),
      options: parseOptionList(form.optionGroup1OptionsStr),
      multiple: false,
    },
    {
      label: form.optionGroup2Label.trim(),
      options: parseOptionList(form.optionGroup2OptionsStr),
      multiple: true,
    },
  ]

  return rawGroups.filter(group => group.label && group.options.length > 0)
}

const toFormOptionGroups = (item) => {
  const groups = getMenuItemOptionGroups(item)
  return {
    optionGroup1Label: groups[0]?.label || '甜度',
    optionGroup1OptionsStr: groups[0]?.options?.join(',') || '',
    optionGroup2Label: groups[1]?.label || '加料',
    optionGroup2OptionsStr: groups[1]?.options?.join(',') || '',
  }
}

const toKeywordString = (value) => (
  Array.isArray(value)
    ? value.filter(Boolean).join(',')
    : String(value || '').split(/[,，、;；\n]/).map(s => s.trim()).filter(Boolean).join(',')
)

// 加载菜品
onMounted(async () => {
  isLoading.value = true
  await Promise.all([
    store.menuLoaded ? Promise.resolve() : loadMenuFromCloud(),
    loadMenuCategoriesFromCloud(),
  ])
  isLoading.value = false
})

// 切换上下架
const toggleAvail = async (item, event) => {
  event?.stopPropagation?.()
  const id = item._id || item.id
  const result = await toggleItemAvailability(id)
  if (result === null) {
    uni.showToast({ title: '上下架失败，请检查云函数或网络', icon: 'none' })
    return
  }
  uni.showToast({ title: result ? '已上架' : '已下架', icon: 'none' })
}

// 打开新增
const openAdd = () => {
  isNewItem.value = true
  showCategoryCreator.value = false
  isDeletingCategories.value = false
  swipedItemId.value = ''
  editForm.value = {
    _id: '',
    name: '',
    desc: '',
    fullDesc: '',
    dislikeKeywordsStr: '',
    allergyKeywordsStr: '',
    category: catOptions.value[0]?.id || 'hot',
    emoji: '🍽️',
    image: '',
    imagePreview: '',
    available: true,
    price: '免费',
    sortOrder: menuItems.value.length + 1,
    optionGroup1Label: '甜度',
    optionGroup1OptionsStr: '',
    optionGroup2Label: '加料',
    optionGroup2OptionsStr: '',
  }
  showEdit.value = true
}

// 打开编辑
const openEdit = (item) => {
  isNewItem.value = false
  showCategoryCreator.value = false
  isDeletingCategories.value = false
  swipedItemId.value = ''
  const optionForm = toFormOptionGroups(item)
  editForm.value = {
    _id: item._id || item.id,
    name: item.name,
    desc: item.desc,
    fullDesc: item.fullDesc || '',
    dislikeKeywordsStr: toKeywordString(item.dislikeKeywords),
    allergyKeywordsStr: toKeywordString(item.allergyKeywords),
    category: item.category,
    emoji: item.emoji || '🍽️',
    image: item._cloudImageId || item.image || '',
    imagePreview: item.image || item._cloudImageId || '',
    available: item.available !== false,
    price: item.price || '免费',
    sortOrder: item.sortOrder || 1,
    ...optionForm,
  }
  showEdit.value = true
}

// 保存（新增 or 更新）
const saveEdit = async () => {
  if (isSaving.value) return
  if (isUploading.value) {
    uni.showToast({ title: '图片上传中，请稍后保存', icon: 'none' })
    return
  }
  const form = editForm.value

  if (!form.name.trim()) {
    uni.showToast({ title: '请输入菜品名称', icon: 'none' })
    return
  }
  if (!store.roomId) {
    uni.showToast({ title: '请先创建或加入房间', icon: 'none' })
    return
  }

  const optionGroups = buildOptionGroups(form)
  const primaryGroup = optionGroups[0]
  const secondaryGroup = optionGroups[1]
  const data = {
    name: form.name.trim(),
    desc: form.desc.trim(),
    fullDesc: form.fullDesc.trim(),
    dislikeKeywords: parseKeywordList(form.dislikeKeywordsStr),
    allergyKeywords: parseKeywordList(form.allergyKeywordsStr),
    category: form.category,
    emoji: getCatEmoji(form.category),
    image: form.image,
    price: form.price || '免费',
    available: isNewItem.value ? true : form.available !== false,
    optionGroups,
    sweetLabel: primaryGroup?.label || '',
    sweetOptions: primaryGroup?.options || [],
    extraLabel: secondaryGroup?.label || '',
    extraOptions: secondaryGroup?.options || [],
    sortOrder: parseInt(form.sortOrder) || 1,
  }

  isSaving.value = true

  try {
    let shouldClose = false
    if (isNewItem.value) {
      const id = await addMenuItemToCloud(data)
      if (id) {
        uni.showToast({ title: '添加成功 ✨', icon: 'none' })
        shouldClose = true
      } else if (!isCloudAvailable()) {
        // H5 降级：本地添加
        store.menuItems.push({ ...data, _id: 'local_' + Date.now() })
        uni.showToast({ title: '已添加（本地）✅', icon: 'none' })
        shouldClose = true
      } else {
        uni.showToast({ title: '云端添加失败，请检查云函数', icon: 'none' })
      }
    } else {
      const success = await updateMenuItemInCloud(form._id, data)
      if (success) {
        uni.showToast({ title: '保存成功 ✅', icon: 'none' })
        shouldClose = true
      } else if (!isCloudAvailable()) {
        // H5 降级：本地更新
        const item = store.menuItems.find(m => (m._id || m.id) === form._id)
        if (item) Object.assign(item, data)
        uni.showToast({ title: '已保存（本地）✅', icon: 'none' })
        shouldClose = true
      } else {
        uni.showToast({ title: '云端保存失败，请检查云函数', icon: 'none' })
      }
    }
    if (shouldClose) showEdit.value = false
  } catch (e) {
    uni.showToast({ title: '操作失败，请重试', icon: 'none' })
  } finally {
    isSaving.value = false
  }
}

const deleteMenuItemWithConfirm = (itemId, itemName, { closeEdit = false } = {}) => {
  uni.showModal({
    title: '⚠️ 确认删除',
    content: `确定要删除「${itemName}」吗？此操作不可恢复！`,
    confirmColor: '#FF4D4F',
    success: async (res) => {
      if (res.confirm) {
        isSaving.value = true
        try {
          const success = await deleteMenuItemFromCloud(itemId)
          let removed = success
          if (success) {
            uni.showToast({ title: '已删除 🗑️', icon: 'none' })
          } else if (!isCloudAvailable()) {
            // H5 降级
            const idx = store.menuItems.findIndex(m => String(m._id || m.id) === String(itemId))
            if (idx !== -1) store.menuItems.splice(idx, 1)
            removed = idx !== -1
            uni.showToast({ title: '已删除（本地）🗑️', icon: 'none' })
          } else {
            uni.showToast({ title: '删除失败，请检查云函数', icon: 'none' })
          }
          swipedItemId.value = ''
          if (closeEdit && removed) showEdit.value = false
        } catch (e) {
          uni.showToast({ title: '删除失败', icon: 'none' })
        } finally {
          isSaving.value = false
        }
      }
    },
  })
}

// 确认删除
const confirmDelete = () => {
  deleteMenuItemWithConfirm(editForm.value._id, editForm.value.name, { closeEdit: true })
}

const confirmSwipeDelete = (item) => {
  deleteMenuItemWithConfirm(getItemKey(item), item.name)
}

const onRefresh = async () => {
  isRefreshing.value = true
  try {
    await Promise.all([
      loadMenuFromCloud(),
      loadMenuCategoriesFromCloud(),
    ])
    uni.showToast({ title: '已刷新', icon: 'none', duration: 1000 })
  } catch (e) {
    console.warn('[ChefMenu] 下拉刷新失败', e)
  } finally {
    isRefreshing.value = false
  }
}

const onScrollBottom = () => { /* future: pagination */ }

const selectCategory = (cat) => {
  if (isDeletingCategories.value) return
  editForm.value.category = cat.id
}

const toggleCategoryCreator = () => {
  isDeletingCategories.value = false
  showCategoryCreator.value = !showCategoryCreator.value
}

const toggleCategoryDeleteMode = () => {
  showCategoryCreator.value = false
  isDeletingCategories.value = !isDeletingCategories.value
}

const confirmDeleteCategory = (cat) => {
  if (isCreatingCategory.value) return
  if (store.categories.length <= 1) {
    uni.showToast({ title: '至少保留一个分类', icon: 'none' })
    return
  }

  const fallback = store.categories.find(item => item.id !== cat.id)
  if (!fallback) {
    uni.showToast({ title: '没有可承接菜品的分类', icon: 'none' })
    return
  }

  uni.showModal({
    title: '确认删除分类吗',
    content: `删除「${cat.label}」后，该分类下菜品会移到「${getCatName(fallback.id)}」。`,
    confirmColor: '#FF4D4F',
    success: async (res) => {
      if (!res.confirm) return

      uni.showLoading({ title: '删除中...', mask: true })
      try {
        const success = await deleteMenuCategoryFromCloud(cat.id, fallback.id)
        uni.hideLoading()
        if (success) {
          if (editForm.value.category === cat.id) {
            editForm.value.category = fallback.id
          }
          uni.showToast({ title: '分类已删除', icon: 'none' })
        } else {
          uni.showToast({ title: '删除失败，请检查云函数', icon: 'none' })
        }
      } catch (e) {
        uni.hideLoading()
        console.warn('[ChefMenu] 删除分类失败', e)
        uni.showToast({ title: '删除分类失败，请重试', icon: 'none' })
      }
    },
  })
}

const createCategory = async () => {
  if (isCreatingCategory.value) return
  const name = newCategoryName.value.trim()
  if (!name) {
    uni.showToast({ title: '请输入分类名称', icon: 'none' })
    return
  }

  isCreatingCategory.value = true
  try {
    const category = await addMenuCategoryToCloud({
      name,
      emoji: newCategoryEmoji.value,
      sortOrder: store.categories.length + 1,
    })
    if (category) {
      editForm.value.category = category.id
      newCategoryName.value = ''
      newCategoryEmoji.value = '🍽️'
      showCategoryCreator.value = false
      uni.showToast({ title: '分类已添加', icon: 'none' })
    } else {
      uni.showToast({ title: '添加失败，请重新部署云函数', icon: 'none' })
    }
  } catch (e) {
    console.warn('[ChefMenu] 新增分类失败', e)
    uni.showToast({ title: '添加分类失败，请稍后重试', icon: 'none' })
  } finally {
    isCreatingCategory.value = false
  }
}

// 选择图片并上传到云端
const chooseAndUploadImage = () => {
  if (isUploading.value) return

  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const tempPath = res.tempFilePaths[0]
      if (!tempPath) return

      // 先显示本地预览
      const previousImage = editForm.value.image
      const previousPreview = editForm.value.imagePreview
      editForm.value.imagePreview = tempPath
      isUploading.value = true

      try {
        const fileID = await uploadImageToCloud(tempPath)
        if (fileID) {
          editForm.value.image = fileID
          editForm.value.imagePreview = tempPath
          uni.showToast({ title: '图片上传成功 ✅', icon: 'none' })
        } else if (!isCloudAvailable()) {
          // H5 降级：使用本地路径
          editForm.value.image = tempPath
          editForm.value.imagePreview = tempPath
          uni.showToast({ title: '已使用本地图片', icon: 'none' })
        } else {
          editForm.value.image = previousImage
          editForm.value.imagePreview = previousPreview
          uni.showToast({ title: '上传失败，请重试', icon: 'none' })
        }
      } catch (e) {
        console.error('[MenuManage] 图片上传异常:', e)
        editForm.value.image = previousImage
        editForm.value.imagePreview = previousPreview
        uni.showToast({ title: '上传失败', icon: 'none' })
      } finally {
        isUploading.value = false
      }
    },
    fail: () => {
      // 用户取消选择，不处理
    },
  })
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100vh; background: #F7F8FA; overflow: hidden; }
.status-bar { height: var(--status-bar-height, 44px); width: 100%; background: #FFFFFF; }
.top-header { display: flex; align-items: center; justify-content: space-between; padding: 20rpx 40rpx 12rpx; background: #FFFFFF; }
.page-title { font-size: 40rpx; font-weight: bold; color: #1D2129; }
.header-count { padding: 8rpx 24rpx; border-radius: 24rpx; background: #E8F3FF; margin-right: 200rpx; }
.count-text { font-size: 24rpx; color: #4080FF; font-weight: bold; }
.search-bar { display: flex; align-items: center; gap: 16rpx; margin: 18rpx 32rpx 0; padding: 0 24rpx; height: 72rpx; background: #F2F3F5; border-radius: 36rpx; }
.search-icon { font-size: 28rpx; }
.search-input { flex: 1; font-size: 26rpx; color: #1D2129; height: 72rpx; }
.menu-scroll { flex: 1; overflow: hidden; }
.menu-list { padding: 24rpx 32rpx; display: flex; flex-direction: column; gap: 20rpx; }

/* 加载状态 */
.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 120rpx 0; gap: 24rpx; }
.loading-spinner { width: 48rpx; height: 48rpx; border: 6rpx solid #E5E6EB; border-top-color: #4080FF; border-radius: 50%; animation: spin 0.8s linear infinite; }
.loading-text { font-size: 26rpx; color: #86909C; }

.menu-swipe-row { position: relative; overflow: hidden; border-radius: 28rpx; animation: fadeInUp 0.4s ease both; }
.menu-delete-action { position: absolute; top: 0; right: 0; bottom: 0; width: 148rpx; background: #FF4D4F; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6rpx; }
.menu-delete-icon { width: 34rpx; height: 34rpx; border-radius: 17rpx; background: rgba(255,255,255,0.22); color: #FFFFFF; font-size: 34rpx; line-height: 28rpx; text-align: center; font-weight: bold; }
.menu-delete-text { font-size: 24rpx; color: #FFFFFF; font-weight: bold; }
.menu-card { position: relative; z-index: 1; display: flex; gap: 24rpx; background: #FFFFFF; border-radius: 28rpx; padding: 28rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); transition: transform 0.2s ease; box-sizing: border-box; }
.menu-card.swiped { transform: translateX(-148rpx); }
.menu-card:active { transform: scale(0.98); }
.menu-card.swiped:active { transform: translateX(-148rpx); }
.menu-img { width: 140rpx; height: 140rpx; border-radius: 20rpx; overflow: hidden; flex-shrink: 0; background: #FFF7E6; }
.menu-photo { width: 100%; height: 100%; }
.menu-photo-emoji { font-size: 56rpx; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.edit-photo-placeholder { display: flex; align-items: center; justify-content: center; background: #FFF7E6; }
.menu-info { flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; min-height: 140rpx; }
.menu-top-row { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; min-width: 0; }
.menu-name { flex: 1; min-width: 0; font-size: 30rpx; font-weight: bold; color: #1D2129; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.avail-badge { flex-shrink: 0; padding: 6rpx 16rpx; border-radius: 16rpx; }
.avail-badge.on { background: #F6FFED; }
.avail-badge.off { background: #FFF1F0; }
.avail-text { font-size: 20rpx; font-weight: bold; }
.avail-badge.on .avail-text { color: #52C41A; }
.avail-badge.off .avail-text { color: #FF4D4F; }
.menu-desc { display: block; width: 100%; max-width: 100%; min-width: 0; font-size: 24rpx; color: #86909C; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.menu-bottom { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; min-width: 0; }
.menu-cat { flex: 1; min-width: 0; font-size: 22rpx; color: #4E5969; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.switch-hit-area { flex-shrink: 0; padding: 8rpx 0 8rpx 24rpx; }
.menu-switch { transform: scale(0.75); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 160rpx; gap: 20rpx; }
.empty-emoji { font-size: 80rpx; }
.empty-text { font-size: 26rpx; color: #86909C; }
.list-spacer { height: 200rpx; }

/* FAB 添加按钮 */
.add-fab {
  position: fixed;
  right: 40rpx;
  bottom: 220rpx;
  width: 104rpx;
  height: 104rpx;
  border-radius: 52rpx;
  background: linear-gradient(135deg, #4080FF 0%, #6AA1FF 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 32rpx rgba(64, 128, 255, 0.4);
  z-index: 100;
  transition: transform 0.2s ease;
  animation: bounceIn 0.6s ease;
}
.add-fab:active { transform: scale(0.9); }
.add-fab-icon { font-size: 52rpx; color: #FFFFFF; font-weight: bold; line-height: 1; }

/* 编辑弹窗 */
.edit-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.25s ease; }
.edit-card { width: 680rpx; max-height: 80vh; background: #FFFFFF; border-radius: 32rpx; padding: 40rpx 36rpx 32rpx; display: flex; flex-direction: column; gap: 20rpx; animation: bounceIn 0.5s ease; box-sizing: border-box; }
.edit-title { font-size: 34rpx; font-weight: bold; color: #1D2129; text-align: center; }
.edit-scroll { max-height: 50vh; overflow: hidden; }
.edit-item-head { display: flex; align-items: center; gap: 24rpx; }
.edit-photo { width: 100rpx; height: 100rpx; border-radius: 20rpx; background: #FFF7E6; }
.edit-head-info { display: flex; flex-direction: column; gap: 8rpx; }
.edit-name { font-size: 30rpx; font-weight: bold; color: #1D2129; }
.edit-cat { font-size: 22rpx; color: #86909C; }
.edit-field { display: flex; flex-direction: column; gap: 10rpx; margin-bottom: 20rpx; }
.edit-label { font-size: 24rpx; font-weight: bold; color: #4E5969; }
.edit-label.small { font-size: 22rpx; color: #86909C; margin-top: 4rpx; }
.edit-input { width: 100%; height: 72rpx; font-size: 26rpx; color: #1D2129; background: #F7F8FA; border-radius: 16rpx; padding: 0 20rpx; box-sizing: border-box; }
.edit-textarea { width: 100%; font-size: 24rpx; color: #1D2129; background: #F7F8FA; border-radius: 16rpx; padding: 20rpx; min-height: 100rpx; line-height: 1.6; box-sizing: border-box; }

/* 分类选择器 */
.cat-picker { display: flex; flex-wrap: wrap; gap: 12rpx; }
.cat-chip { position: relative; padding: 10rpx 24rpx; border-radius: 24rpx; background: #F2F3F5; transition: all 0.2s ease; }
.cat-chip.active { background: #E8F3FF; }
.cat-chip.add-cat-chip { background: #FFF7E6; }
.cat-chip.delete-cat-chip { background: #FFF1F0; }
.cat-chip.delete-cat-chip.active { background: #FF4D4F; }
.cat-chip-text { font-size: 22rpx; color: #4E5969; }
.cat-chip-text.add { color: #FA8C16; font-weight: bold; }
.cat-chip-text.delete { color: #FF4D4F; font-weight: bold; }
.cat-chip.delete-cat-chip.active .cat-chip-text.delete { color: #FFFFFF; }
.cat-chip.active .cat-chip-text { color: #4080FF; font-weight: bold; }
.cat-delete-mark { position: absolute; top: -10rpx; right: -8rpx; width: 32rpx; height: 32rpx; border-radius: 16rpx; background: #FF4D4F; border: 4rpx solid #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 4rpx 10rpx rgba(255,77,79,0.28); }
.cat-delete-text { color: #FFFFFF; font-size: 30rpx; line-height: 24rpx; font-weight: bold; }
.category-creator { margin-top: 16rpx; padding: 20rpx; border-radius: 20rpx; background: #F7F8FA; display: flex; flex-direction: column; gap: 16rpx; box-sizing: border-box; }
.emoji-picker { display: flex; flex-wrap: wrap; gap: 12rpx; }
.emoji-chip { width: 64rpx; height: 64rpx; border-radius: 18rpx; background: #FFFFFF; display: flex; align-items: center; justify-content: center; border: 2rpx solid transparent; transition: all 0.2s ease; }
.emoji-chip.active { border-color: #4080FF; background: #E8F3FF; transform: scale(1.04); }
.emoji-chip-text { font-size: 32rpx; }
.create-category-btn { height: 72rpx; border-radius: 36rpx; background: #4080FF; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }
.create-category-btn.disabled { opacity: 0.6; }
.create-category-text { font-size: 26rpx; color: #FFFFFF; font-weight: bold; }

.edit-options { font-size: 24rpx; color: #86909C; line-height: 1.6; }
.edit-actions { display: flex; gap: 16rpx; margin-top: 8rpx; }
.edit-btn { flex: 1; height: 80rpx; border-radius: 40rpx; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }
.edit-btn:active { transform: scale(0.95); }
.edit-btn.cancel { background: #F7F8FA; }
.edit-btn.save { background: #4080FF; flex: 1.5; }
.edit-btn.save.disabled { opacity: 0.6; }
.edit-btn.delete { background: #FFF1F0; }
.edit-btn-text.cancel { color: #4E5969; font-weight: bold; font-size: 28rpx; }
.edit-btn-text.save { color: #FFFFFF; font-weight: bold; font-size: 28rpx; }
.edit-btn-text.delete { color: #FF4D4F; font-weight: bold; font-size: 28rpx; }

/* 图片上传区域 */
.image-upload-area {
  position: relative;
  width: 100%;
  height: 280rpx;
  border-radius: 20rpx;
  overflow: hidden;
  background: #F7F8FA;
  border: 2rpx dashed #C9CDD4;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-sizing: border-box;
}
.image-upload-area:active {
  transform: scale(0.98);
  border-color: #4080FF;
}
.upload-preview {
  width: 100%;
  height: 100%;
}
.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.upload-icon {
  font-size: 60rpx;
}
.upload-hint {
  font-size: 24rpx;
  color: #86909C;
}
.upload-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}
.upload-spinner {
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.3);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.upload-progress-text {
  font-size: 24rpx;
  color: #FFFFFF;
  font-weight: bold;
}
.upload-change-btn {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56rpx;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}
.upload-change-text {
  font-size: 22rpx;
  color: #FFFFFF;
  font-weight: bold;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
