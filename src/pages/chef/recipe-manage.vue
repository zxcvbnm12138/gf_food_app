<template>
  <view class="page">
    <view class="status-bar-p"></view>
    <view class="header">
      <view class="header-top">
        <view class="back-button" @click="goBack"><text class="back-icon">‹</text></view>
        <view class="title-wrap">
          <text class="title">菜谱管理</text>
          <text class="subtitle">共 {{ filteredRecipes.length }} 份专属菜谱</text>
        </view>
        <view class="header-action" @click="openNew"><text class="header-plus">＋</text></view>
      </view>
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input v-model="keyword" class="search-input" placeholder="搜索菜谱、材料或步骤" placeholder-class="placeholder" />
        <text v-if="keyword" class="clear-search" @click="keyword = ''">×</text>
      </view>
    </view>

    <scroll-view class="content" scroll-y :enhanced="true" :show-scrollbar="false" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="refreshRecipes">
      <view class="content-inner">
        <view v-if="isLoading && store.recipes.length === 0" class="empty-card">
          <text class="empty-emoji">📖</text>
          <text class="empty-title">菜谱加载中...</text>
        </view>

        <view v-else-if="filteredRecipes.length === 0" class="empty-card">
          <text class="empty-emoji">🍳</text>
          <text class="empty-title">还没有记录菜谱</text>
          <text class="empty-desc">把她爱吃的做法、照片和视频都存起来吧</text>
          <button class="empty-btn" @click="openNew">新增菜谱</button>
        </view>

        <view v-for="recipe in filteredRecipes" :key="recipe._id" class="recipe-card" @click="openEdit(recipe)">
          <view class="cover-wrap">
            <image v-if="recipe.photos && recipe.photos.length" class="cover" :src="recipe.photos[0]" mode="aspectFill" />
            <view v-else class="cover-placeholder"><text>🍲</text></view>
          </view>
          <view class="recipe-info">
            <view class="recipe-title-row">
              <text class="recipe-title">{{ recipe.title }}</text>
              <view v-if="recipe.videoUrl" class="video-chip" @click.stop="openVideo(recipe.videoUrl)">视频</view>
            </view>
            <text class="recipe-desc">{{ recipeSummary(recipe) }}</text>
            <view class="meta-row">
              <text class="meta-item">材料 {{ recipe.materials.length }}</text>
              <text class="meta-dot">•</text>
              <text class="meta-item">步骤 {{ recipe.process.length }}</text>
              <text class="meta-dot">•</text>
              <text class="meta-item">照片 {{ recipe.photos.length }}</text>
            </view>
          </view>
          <view class="delete-btn" @click.stop="confirmDelete(recipe)">删除</view>
        </view>
        <view class="bottom-spacer"></view>
      </view>
    </scroll-view>

    <view class="fab" @click="openNew"><text class="fab-plus">＋</text></view>

    <view v-if="showEdit" class="modal-mask" @click="closeEdit">
      <view class="edit-panel" @click.stop>
        <view class="modal-handle"></view>
        <view class="modal-header">
          <text class="modal-title">{{ isNewRecipe ? '新增菜谱' : '编辑菜谱' }}</text>
          <text class="modal-close" @click="closeEdit">×</text>
        </view>

        <scroll-view class="form-scroll" scroll-y :show-scrollbar="false">
          <view class="form-group">
            <text class="form-label">菜谱名称</text>
            <input v-model="form.title" class="form-input" placeholder="比如：番茄牛腩" placeholder-class="placeholder" maxlength="80" />
          </view>

          <view class="form-group">
            <text class="form-label">烹饪材料</text>
            <textarea v-model="form.materialsText" class="form-textarea" placeholder="一行写一种材料，例如：\n牛腩 500g\n番茄 3 个" placeholder-class="placeholder" maxlength="3000" />
            <view class="ai-btn-row">
              <button class="ai-btn" :disabled="isAiFormatting || !form.materialsText.trim()" @click="aiFormat">
                <text class="ai-btn-icon">✨</text>
                <text class="ai-btn-text">{{ isAiFormatting ? '整理中...' : 'AI一下' }}</text>
              </button>
            </view>
          </view>

          <view class="form-group">
            <text class="form-label">烹饪过程</text>
            <textarea v-model="form.processText" class="form-textarea large" placeholder="一行写一个步骤，例如：\n牛腩焯水洗净\n番茄炒出汁后加水炖煮" placeholder-class="placeholder" maxlength="6000" />
          </view>

          <view class="form-group">
            <text class="form-label">视频链接</text>
            <input v-model="form.videoUrl" class="form-input" placeholder="https:// 开头的视频链接" placeholder-class="placeholder" maxlength="500" />
            <text class="form-tip">小程序里会复制链接，H5/App 会尝试直接打开。</text>
          </view>

          <view class="form-group">
            <view class="label-row">
              <text class="form-label">菜谱照片</text>
              <text class="photo-count">{{ form.photos.length }}/9</text>
            </view>
            <view class="photo-grid">
              <view v-for="(photo, index) in form.photos" :key="`${photo}_${index}`" class="photo-item">
                <image class="photo" :src="photo" mode="aspectFill" />
                <view class="photo-remove" @click="removePhoto(index)">×</view>
              </view>
              <view v-if="form.photos.length < 9" class="photo-add" @click="choosePhotos">
                <text class="photo-add-plus">＋</text>
                <text class="photo-add-text">添加</text>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="modal-footer">
          <button class="cancel-btn" @click="closeEdit">取消</button>
          <button class="save-btn" :disabled="isSaving || isUploading" @click="saveRecipe">{{ isUploading ? '上传中...' : isSaving ? '保存中...' : '保存' }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import store, {
  loadRecipesFromCloud,
  addRecipeToCloud,
  updateRecipeInCloud,
  deleteRecipeFromCloud,
  uploadRecipeImageToCloud,
  resolveImageUrl,
} from '@/store/index.js'
import cloudbase from '@/utils/cloudbase'

const keyword = ref('')
const showEdit = ref(false)
const isNewRecipe = ref(true)
const isSaving = ref(false)
const isUploading = ref(false)
const isAiFormatting = ref(false)
const isLoading = ref(false)
const refreshing = ref(false)
const editingId = ref('')

const form = reactive({
  title: '',
  materialsText: '',
  processText: '',
  videoUrl: '',
  photos: [],
  cloudPhotos: [],
})

const filteredRecipes = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const recipes = Array.isArray(store.recipes) ? store.recipes : []
  if (!kw) return recipes

  return recipes.filter((recipe) => {
    const fields = [
      recipe.title,
      recipe.videoUrl,
      ...(Array.isArray(recipe.materials) ? recipe.materials : []),
      ...(Array.isArray(recipe.process) ? recipe.process : []),
    ]
    return fields.some(item => String(item || '').toLowerCase().includes(kw))
  })
})

onMounted(() => {
  loadRecipes()
})

const splitLines = (value) => String(value || '')
  .split(/[\n,，、;；]/)
  .map(item => item.trim())
  .filter(Boolean)

const joinLines = (value) => (Array.isArray(value) ? value : []).join('\n')

const aiFormat = async () => {
  const text = form.materialsText.trim()
  if (!text) {
    uni.showToast({ title: '请先输入材料', icon: 'none' })
    return
  }
  isAiFormatting.value = true
  try {
    const loginState = await cloudbase.auth().getLoginState()
    if (!loginState) {
      await cloudbase.auth().signInAnonymously()
    }

    uni.showLoading({
      title: '生成中...',
    })

    const res = await cloudbase
      .ai()
      .createModel('hunyuan-v3')
      .streamText({
        model: 'hy3-preview',
        messages: [{
          role: 'user',
          content: `整理烹饪材料：每行一个，格式“材料名 用量”。没写用量则补常用量。只输出材料列表。

用户输入的材料：
${text}`,
        }],
      })

    let result = ''
    for await (let str of res.textStream) {
      result += str
    }

    uni.hideLoading()
    if (result.trim()) {
      form.materialsText = result.trim()
      uni.showToast({ title: '已整理', icon: 'success' })
    } else {
      uni.showToast({ title: 'AI 未返回结果', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    console.error('[Recipe] AI 结构化材料失败:', e)
    uni.showToast({ title: '生成失败：' + e.message, icon: 'none' })
  } finally {
    isAiFormatting.value = false
  }
}

const recipeSummary = (recipe) => {
  const materials = Array.isArray(recipe.materials) ? recipe.materials : []
  if (materials.length === 0) return '还没有记录材料'
  return materials.slice(0, 4).join('、')
}

const loadRecipes = async () => {
  if (isLoading.value) return
  isLoading.value = true
  try {
    await loadRecipesFromCloud()
  } finally {
    isLoading.value = false
  }
}

const refreshRecipes = async () => {
  refreshing.value = true
  try {
    await loadRecipesFromCloud()
  } finally {
    refreshing.value = false
  }
}

const resetForm = () => {
  editingId.value = ''
  form.title = ''
  form.materialsText = ''
  form.processText = ''
  form.videoUrl = ''
  form.photos = []
  form.cloudPhotos = []
}

const openNew = () => {
  resetForm()
  isNewRecipe.value = true
  showEdit.value = true
}

const openEdit = (recipe) => {
  resetForm()
  isNewRecipe.value = false
  editingId.value = recipe._id || ''
  form.title = recipe.title || ''
  form.materialsText = joinLines(recipe.materials)
  form.processText = joinLines(recipe.process)
  form.videoUrl = recipe.videoUrl || ''
  form.photos = Array.isArray(recipe.photos) ? [...recipe.photos] : []
  form.cloudPhotos = Array.isArray(recipe._cloudPhotos) ? [...recipe._cloudPhotos] : [...form.photos]
  showEdit.value = true
}

const closeEdit = () => {
  if (isSaving.value || isUploading.value) return
  showEdit.value = false
}

const choosePhotos = () => {
  if (isUploading.value) return
  const remaining = 9 - form.photos.length
  if (remaining <= 0) return

  uni.chooseImage({
    count: remaining,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : []
      if (paths.length === 0) return
      isUploading.value = true
      uni.showLoading({ title: '上传中...', mask: true })
      try {
        for (const path of paths) {
          const fileId = await uploadRecipeImageToCloud(path)
          if (!fileId) continue
          form.cloudPhotos.push(fileId)
          const displayUrl = await resolveImageUrl(fileId)
          form.photos.push(displayUrl || fileId)
        }
      } finally {
        uni.hideLoading()
        isUploading.value = false
      }
    },
  })
}

const removePhoto = (index) => {
  form.photos.splice(index, 1)
  form.cloudPhotos.splice(index, 1)
}

const validVideoUrl = (url) => {
  const value = String(url || '').trim()
  return !value || /^https?:\/\//i.test(value)
}

const buildSaveData = () => ({
  title: form.title.trim(),
  materials: splitLines(form.materialsText),
  process: splitLines(form.processText),
  videoUrl: form.videoUrl.trim(),
  photos: [...form.cloudPhotos],
})

const saveRecipe = async () => {
  if (isSaving.value || isUploading.value) return
  if (!store.roomId) {
    uni.showToast({ title: '请先创建或加入房间', icon: 'none' })
    return
  }
  if (!form.title.trim()) {
    uni.showToast({ title: '请输入菜谱名称', icon: 'none' })
    return
  }
  if (!validVideoUrl(form.videoUrl)) {
    uni.showToast({ title: '视频链接需以 http 或 https 开头', icon: 'none' })
    return
  }

  isSaving.value = true
  try {
    const data = buildSaveData()
    const success = isNewRecipe.value
      ? await addRecipeToCloud(data)
      : await updateRecipeInCloud(editingId.value, data)

    if (success) {
      uni.showToast({ title: '已保存', icon: 'success' })
      showEdit.value = false
    } else {
      uni.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  } finally {
    isSaving.value = false
  }
}

const confirmDelete = (recipe) => {
  uni.showModal({
    title: '删除菜谱',
    content: `确定删除「${recipe.title}」吗？`,
    confirmText: '删除',
    confirmColor: '#FF4D4F',
    success: async (res) => {
      if (!res.confirm) return
      const success = await deleteRecipeFromCloud(recipe._id)
      uni.showToast({ title: success ? '已删除' : '删除失败', icon: 'none' })
    },
  })
}

const openVideo = (url) => {
  const videoUrl = String(url || '').trim()
  if (!/^https?:\/\//i.test(videoUrl)) {
    uni.showToast({ title: '视频链接无效', icon: 'none' })
    return
  }

  // #ifdef H5
  window.open(videoUrl, '_blank')
  return
  // #endif

  // #ifdef APP-PLUS
  plus.runtime.openURL(videoUrl)
  return
  // #endif

  uni.setClipboardData({
    data: videoUrl,
    success: () => {
      uni.showModal({
        title: '链接已复制',
        content: '小程序内无法保证直接打开外链，请复制后在浏览器或微信中打开。',
        showCancel: false,
        confirmText: '知道了',
      })
    },
  })
}

const goBack = () => {
  uni.navigateBack({
    fail: () => uni.switchTab({ url: '/pages/chef/profile' }),
  })
}
</script>

<style scoped>
.page { min-height: 100vh; background: #F7F8FA; display: flex; flex-direction: column; overflow: hidden; }
.status-bar-p { height: var(--status-bar-height, 44px); width: 100%; background: linear-gradient(180deg, #4080FF 0%, #6AA1FF 100%); }
.header { background: linear-gradient(180deg, #4080FF 0%, #6AA1FF 100%); padding: 20rpx 32rpx 40rpx; border-bottom-left-radius: 40rpx; border-bottom-right-radius: 40rpx; box-shadow: 0 12rpx 30rpx rgba(64,128,255,0.18); }
.header-top { display: flex; align-items: center; gap: 24rpx; }
.back-button, .header-action { width: 68rpx; height: 68rpx; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.back-icon { font-size: 56rpx; color: #FFFFFF; line-height: 1; transform: translateY(-4rpx); }
.header-plus { font-size: 44rpx; color: #FFFFFF; line-height: 1; }
.title-wrap { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.title { font-size: 42rpx; font-weight: bold; color: #FFFFFF; }
.subtitle { font-size: 24rpx; color: rgba(255,255,255,0.78); }
.search-box { margin-top: 32rpx; height: 80rpx; background: rgba(255,255,255,0.95); border-radius: 28rpx; display: flex; align-items: center; padding: 0 28rpx; gap: 16rpx; }
.search-icon { font-size: 28rpx; }
.search-input { flex: 1; height: 80rpx; font-size: 28rpx; color: #1D2129; }
.placeholder { color: #A9AEB8; }
.clear-search { font-size: 40rpx; color: #A9AEB8; padding: 0 8rpx; }
.content { flex: 1; overflow: hidden; }
.content-inner { padding: 28rpx 32rpx 160rpx; }
.empty-card { min-height: 520rpx; background: #FFFFFF; border-radius: 32rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); }
.empty-emoji { font-size: 92rpx; }
.empty-title { font-size: 32rpx; color: #1D2129; font-weight: bold; }
.empty-desc { font-size: 24rpx; color: #86909C; }
.empty-btn { margin-top: 12rpx; height: 72rpx; line-height: 72rpx; padding: 0 40rpx; border-radius: 36rpx; background: #4080FF; color: #FFFFFF; font-size: 26rpx; }
.empty-btn::after { border: 0; }
.recipe-card { background: #FFFFFF; border-radius: 32rpx; padding: 22rpx; margin-bottom: 20rpx; display: flex; align-items: center; gap: 22rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); transition: transform 0.2s ease; }
.recipe-card:active { transform: scale(0.98); }
.cover-wrap { width: 144rpx; height: 144rpx; border-radius: 28rpx; overflow: hidden; background: #E8F3FF; flex-shrink: 0; }
.cover { width: 100%; height: 100%; }
.cover-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 58rpx; }
.recipe-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12rpx; }
.recipe-title-row { display: flex; align-items: center; gap: 12rpx; }
.recipe-title { flex: 1; font-size: 32rpx; font-weight: bold; color: #1D2129; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.video-chip { padding: 6rpx 16rpx; border-radius: 999rpx; background: #FFF1F0; color: #FF4D4F; font-size: 22rpx; flex-shrink: 0; }
.recipe-desc { font-size: 24rpx; color: #4E5969; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta-row { display: flex; align-items: center; gap: 10rpx; }
.meta-item, .meta-dot { font-size: 22rpx; color: #86909C; }
.delete-btn { padding: 12rpx 16rpx; border-radius: 18rpx; background: #FFF1F0; color: #FF4D4F; font-size: 22rpx; flex-shrink: 0; }
.bottom-spacer { height: 40rpx; }
.fab { position: fixed; right: 40rpx; bottom: calc(60rpx + env(safe-area-inset-bottom)); width: 104rpx; height: 104rpx; border-radius: 50%; background: #4080FF; display: flex; align-items: center; justify-content: center; box-shadow: 0 12rpx 32rpx rgba(64,128,255,0.35); z-index: 10; }
.fab-plus { color: #FFFFFF; font-size: 58rpx; line-height: 1; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.42); display: flex; align-items: flex-end; z-index: 100; }
.edit-panel { width: 100%; max-height: 88vh; background: #FFFFFF; border-top-left-radius: 40rpx; border-top-right-radius: 40rpx; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
.modal-handle { width: 80rpx; height: 8rpx; border-radius: 999rpx; background: #E5E6EB; margin: 18rpx auto 8rpx; }
.modal-header { display: flex; align-items: center; padding: 18rpx 32rpx 24rpx; }
.modal-title { flex: 1; font-size: 36rpx; font-weight: bold; color: #1D2129; }
.modal-close { font-size: 48rpx; color: #86909C; padding: 0 8rpx; }
.form-scroll { flex: 1; max-height: 62vh; }
.form-group { padding: 0 32rpx 28rpx; display: flex; flex-direction: column; gap: 14rpx; }
.label-row { display: flex; align-items: center; justify-content: space-between; }
.form-label { font-size: 28rpx; color: #1D2129; font-weight: bold; }
.photo-count, .form-tip { font-size: 22rpx; color: #86909C; }
.form-input { height: 84rpx; border-radius: 24rpx; background: #F7F8FA; padding: 0 24rpx; font-size: 28rpx; color: #1D2129; }
.form-textarea { height: 180rpx; border-radius: 24rpx; background: #F7F8FA; padding: 22rpx 24rpx; font-size: 28rpx; color: #1D2129; box-sizing: border-box; width: 100%; }
.form-textarea.large { height: 240rpx; }
.ai-btn-row { display: flex; justify-content: flex-end; }
.ai-btn { display: flex; align-items: center; gap: 8rpx; height: 60rpx; padding: 0 24rpx; border-radius: 30rpx; background: linear-gradient(135deg, #7C5CFC 0%, #B07CFF 100%); color: #FFFFFF; font-size: 24rpx; font-weight: 500; border: 0; line-height: 60rpx; }
.ai-btn::after { border: 0; }
.ai-btn[disabled] { opacity: 0.5; }
.ai-btn-icon { font-size: 26rpx; }
.photo-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.photo-item, .photo-add { width: 148rpx; height: 148rpx; border-radius: 24rpx; overflow: hidden; position: relative; }
.photo { width: 100%; height: 100%; }
.photo-remove { position: absolute; right: 8rpx; top: 8rpx; width: 36rpx; height: 36rpx; border-radius: 50%; background: rgba(0,0,0,0.5); color: #FFFFFF; font-size: 30rpx; line-height: 34rpx; text-align: center; }
.photo-add { border: 2rpx dashed #C9CDD4; background: #F7F8FA; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6rpx; box-sizing: border-box; }
.photo-add-plus { font-size: 48rpx; color: #86909C; }
.photo-add-text { font-size: 22rpx; color: #86909C; }
.modal-footer { display: flex; gap: 20rpx; padding: 24rpx 32rpx 32rpx; box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.04); }
.cancel-btn, .save-btn { flex: 1; height: 88rpx; line-height: 88rpx; border-radius: 28rpx; font-size: 30rpx; font-weight: bold; }
.cancel-btn { background: #F2F3F5; color: #4E5969; }
.save-btn { background: #4080FF; color: #FFFFFF; }
.save-btn[disabled] { opacity: 0.65; }
.cancel-btn::after, .save-btn::after { border: 0; }
</style>
