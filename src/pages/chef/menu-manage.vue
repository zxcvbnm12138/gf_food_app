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
    <scroll-view class="menu-scroll" scroll-y :enhanced="true" :show-scrollbar="false" @scrolltolower="onScrollBottom">
      <view class="menu-list">
        <!-- 加载中状态 -->
        <view v-if="isLoading" class="loading-state">
          <view class="loading-spinner"></view>
          <text class="loading-text">加载菜品中...</text>
        </view>
        <view v-for="(item, idx) in filteredItems" :key="item._id || item.id" class="menu-card" :style="{ animationDelay: (idx * 0.06) + 's' }" @click="openEdit(item)">
          <view class="menu-img"><image class="menu-photo" :src="item.image" mode="aspectFill" /></view>
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
          <image class="edit-photo" :src="editForm.imagePreview || editForm.image" mode="aspectFill" />
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
                @click="editForm.category = cat.id">
                <text class="cat-chip-text">{{ cat.label }}</text>
              </view>
            </view>
          </view>

          <!-- Emoji -->
          <view class="edit-field">
            <text class="edit-label">图标 Emoji</text>
            <input class="edit-input" v-model="editForm.emoji" placeholder="输入一个emoji，如 🍓" maxlength="4" />
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

          <!-- 价格 -->
          <view class="edit-field">
            <text class="edit-label">价格文案</text>
            <input class="edit-input" v-model="editForm.price" placeholder="免费" />
          </view>

          <!-- 甜度选项 -->
          <view class="edit-field">
            <text class="edit-label">甜度选项（逗号分隔）</text>
            <input class="edit-input" v-model="editForm.sweetOptionsStr" placeholder="少少糖,正常甜，也可用中文逗号" />
          </view>

          <!-- 加料选项 -->
          <view class="edit-field">
            <text class="edit-label">加料选项（逗号分隔）</text>
            <input class="edit-input" v-model="editForm.extraOptionsStr" placeholder="多放草莓,加奶油，也可用中文逗号" />
          </view>

          <!-- 排序 -->
          <view class="edit-field">
            <text class="edit-label">排序权重</text>
            <input class="edit-input" v-model="editForm.sortOrder" type="number" placeholder="1" />
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
} from '@/store/index.js'
import { isCloudAvailable } from '@/services/cloud.js'
import ChefTabBar from '@/components/ChefTabBar.vue'

const searchText = ref('')
const showEdit = ref(false)
const isNewItem = ref(false)
const isSaving = ref(false)
const isLoading = ref(false)
const isUploading = ref(false)

const editForm = ref({
  _id: '',
  name: '',
  desc: '',
  fullDesc: '',
  category: 'hot',
  emoji: '🍽️',
  image: '',
  imagePreview: '',
  available: true,
  price: '免费',
  sweetOptionsStr: '',
  extraOptionsStr: '',
  sortOrder: 1,
})

const menuItems = computed(() => store.menuItems)

const filteredItems = computed(() => {
  if (!searchText.value.trim()) return menuItems.value
  const kw = searchText.value.trim().toLowerCase()
  return menuItems.value.filter(i => i.name.toLowerCase().includes(kw) || i.desc.toLowerCase().includes(kw))
})

const catOptions = [
  { id: 'hot', label: '🔥 热销' },
  { id: 'dessert', label: '🍰 甜点' },
  { id: 'drink', label: '🥤 饮品' },
  { id: 'carb', label: '🍜 面食' },
  { id: 'light', label: '🥗 轻食' },
  { id: 'warm', label: '🍵 暖饮' },
]

const catMap = { hot: '🔥 热销', dessert: '🍰 甜点', drink: '🥤 饮品', carb: '🍜 面食', light: '🥗 轻食', warm: '🍵 暖饮' }
const getCatName = (cat) => catMap[cat] || cat
const parseOptionList = (value) => (
  value
    ? value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    : []
)

// 加载菜品
onMounted(async () => {
  if (!store.menuLoaded) {
    isLoading.value = true
    await loadMenuFromCloud()
    isLoading.value = false
  }
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
  editForm.value = {
    _id: '',
    name: '',
    desc: '',
    fullDesc: '',
    category: 'hot',
    emoji: '🍽️',
    image: '',
    imagePreview: '',
    available: true,
    price: '免费',
    sweetOptionsStr: '',
    extraOptionsStr: '',
    sortOrder: menuItems.value.length + 1,
  }
  showEdit.value = true
}

// 打开编辑
const openEdit = (item) => {
  isNewItem.value = false
  editForm.value = {
    _id: item._id || item.id,
    name: item.name,
    desc: item.desc,
    fullDesc: item.fullDesc || '',
    category: item.category,
    emoji: item.emoji || '',
    image: item._cloudImageId || item.image || '',
    imagePreview: item.image || item._cloudImageId || '',
    available: item.available !== false,
    price: item.price || '免费',
    sweetOptionsStr: (item.sweetOptions || []).join(','),
    extraOptionsStr: (item.extraOptions || []).join(','),
    sortOrder: item.sortOrder || 1,
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

  const data = {
    name: form.name.trim(),
    desc: form.desc.trim(),
    fullDesc: form.fullDesc.trim(),
    category: form.category,
    emoji: form.emoji,
    image: form.image,
    price: form.price || '免费',
    available: isNewItem.value ? true : form.available !== false,
    sweetOptions: parseOptionList(form.sweetOptionsStr),
    extraOptions: parseOptionList(form.extraOptionsStr),
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

// 确认删除
const confirmDelete = () => {
  uni.showModal({
    title: '⚠️ 确认删除',
    content: `确定要删除「${editForm.value.name}」吗？此操作不可恢复！`,
    confirmColor: '#FF4D4F',
    success: async (res) => {
      if (res.confirm) {
        isSaving.value = true
        try {
          const success = await deleteMenuItemFromCloud(editForm.value._id)
          if (success) {
            uni.showToast({ title: '已删除 🗑️', icon: 'none' })
          } else {
            // H5 降级
            const idx = store.menuItems.findIndex(m => (m._id || m.id) === editForm.value._id)
            if (idx !== -1) store.menuItems.splice(idx, 1)
            uni.showToast({ title: '已删除（本地）🗑️', icon: 'none' })
          }
          showEdit.value = false
        } catch (e) {
          uni.showToast({ title: '删除失败', icon: 'none' })
        } finally {
          isSaving.value = false
        }
      }
    },
  })
}

const onScrollBottom = () => { /* future: pagination */ }

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
          // 在小程序中 fileID 可以直接用于 image 组件显示
          uni.showToast({ title: '图片上传成功 ✅', icon: 'none' })
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

.menu-card { display: flex; gap: 24rpx; background: #FFFFFF; border-radius: 28rpx; padding: 28rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); animation: fadeInUp 0.4s ease both; transition: transform 0.2s ease; }
.menu-card:active { transform: scale(0.98); }
.menu-img { width: 140rpx; height: 140rpx; border-radius: 20rpx; overflow: hidden; flex-shrink: 0; background: #FFF7E6; }
.menu-photo { width: 100%; height: 100%; }
.menu-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-height: 140rpx; }
.menu-top-row { display: flex; justify-content: space-between; align-items: center; }
.menu-name { font-size: 30rpx; font-weight: bold; color: #1D2129; }
.avail-badge { padding: 6rpx 16rpx; border-radius: 16rpx; }
.avail-badge.on { background: #F6FFED; }
.avail-badge.off { background: #FFF1F0; }
.avail-text { font-size: 20rpx; font-weight: bold; }
.avail-badge.on .avail-text { color: #52C41A; }
.avail-badge.off .avail-text { color: #FF4D4F; }
.menu-desc { font-size: 24rpx; color: #86909C; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.menu-bottom { display: flex; justify-content: space-between; align-items: center; }
.menu-cat { font-size: 22rpx; color: #4E5969; }
.switch-hit-area { padding: 8rpx 0 8rpx 24rpx; }
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
.edit-card { width: 680rpx; max-height: 80vh; background: #FFFFFF; border-radius: 32rpx; padding: 40rpx 36rpx 32rpx; display: flex; flex-direction: column; gap: 20rpx; animation: bounceIn 0.5s ease; }
.edit-title { font-size: 34rpx; font-weight: bold; color: #1D2129; text-align: center; }
.edit-scroll { max-height: 50vh; overflow: hidden; }
.edit-item-head { display: flex; align-items: center; gap: 24rpx; }
.edit-photo { width: 100rpx; height: 100rpx; border-radius: 20rpx; background: #FFF7E6; }
.edit-head-info { display: flex; flex-direction: column; gap: 8rpx; }
.edit-name { font-size: 30rpx; font-weight: bold; color: #1D2129; }
.edit-cat { font-size: 22rpx; color: #86909C; }
.edit-field { display: flex; flex-direction: column; gap: 10rpx; margin-bottom: 20rpx; }
.edit-label { font-size: 24rpx; font-weight: bold; color: #4E5969; }
.edit-input { width: 100%; height: 72rpx; font-size: 26rpx; color: #1D2129; background: #F7F8FA; border-radius: 16rpx; padding: 0 20rpx; }
.edit-textarea { width: 100%; font-size: 24rpx; color: #1D2129; background: #F7F8FA; border-radius: 16rpx; padding: 20rpx; min-height: 100rpx; line-height: 1.6; }

/* 分类选择器 */
.cat-picker { display: flex; flex-wrap: wrap; gap: 12rpx; }
.cat-chip { padding: 10rpx 24rpx; border-radius: 24rpx; background: #F2F3F5; transition: all 0.2s ease; }
.cat-chip.active { background: #E8F3FF; }
.cat-chip-text { font-size: 22rpx; color: #4E5969; }
.cat-chip.active .cat-chip-text { color: #4080FF; font-weight: bold; }

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
