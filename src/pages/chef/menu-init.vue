<template>
  <view class="page">
    <view class="status-bar"></view>

    <view class="top-header">
      <view class="title-wrap">
        <text class="page-title">初始化菜单</text>
        <text class="page-subtitle">房间 {{ store.roomId }}</text>
      </view>
      <view class="count-pill">
        <text class="count-text">{{ menuItems.length }} 道</text>
      </view>
    </view>

    <scroll-view class="menu-scroll" scroll-y :enhanced="true" :show-scrollbar="false">
      <view class="menu-list">
        <view v-if="isLoading" class="loading-state">
          <view class="loading-spinner"></view>
          <text class="loading-text">加载中...</text>
        </view>

        <view v-else-if="menuItems.length === 0" class="empty-state">
          <text class="empty-emoji">🍽️</text>
          <text class="empty-title">还没有菜品</text>
          <view class="empty-btn" @click="openAdd">
            <text class="empty-btn-text">新增第一道菜</text>
          </view>
        </view>

        <block v-else>
          <view
            v-for="(item, idx) in menuItems"
            :key="item._id || item.id"
            class="menu-card"
            :style="{ animationDelay: (idx * 0.06) + 's' }"
          >
            <view class="menu-img">
              <image class="menu-photo" :src="item.image || '/static/logo.png'" mode="aspectFill" />
            </view>
            <view class="menu-info">
              <view class="menu-top-row">
                <text class="menu-name">{{ item.name }}</text>
                <text class="menu-cat">{{ getCatName(item.category) }}</text>
              </view>
              <text class="menu-desc">{{ item.fullDesc || item.desc }}</text>
            </view>
          </view>
        </block>

        <view class="list-spacer"></view>
      </view>
    </scroll-view>

    <view class="bottom-bar">
      <view class="secondary-btn" @click="openAdd">
        <text class="secondary-btn-text">+ 新增菜品</text>
      </view>
      <view class="primary-btn" :class="{ disabled: !canEnter }" @click="finishInit">
        <text class="primary-btn-text">进入接单首页</text>
      </view>
    </view>

    <view class="edit-overlay" v-if="showEdit" @click="showEdit = false">
      <view class="edit-card" @click.stop>
        <text class="edit-title">新增菜品</text>

        <scroll-view class="edit-scroll" scroll-y :enhanced="true" :show-scrollbar="false">
          <view class="edit-field">
            <text class="edit-label">菜品名称</text>
            <input class="edit-input" v-model="editForm.name" placeholder="输入菜品名称" maxlength="20" />
          </view>

          <view class="edit-field">
            <text class="edit-label">分类</text>
            <view class="cat-picker">
              <view
                v-for="cat in catOptions"
                :key="cat.id"
                class="cat-chip"
                :class="{ active: editForm.category === cat.id }"
                @click="editForm.category = cat.id"
              >
                <text class="cat-chip-text">{{ cat.label }}</text>
              </view>
              <view class="cat-chip add-cat-chip" @click="showCategoryCreator = !showCategoryCreator">
                <text class="cat-chip-text add">+ 增加分类</text>
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

          <view class="edit-field">
            <text class="edit-label">菜品图片</text>
            <view class="image-upload-area" @click="chooseAndUploadImage">
              <image class="upload-preview" :src="editForm.imagePreview || editForm.image || '/static/logo.png'" mode="aspectFill" />
              <view class="upload-overlay" v-if="isUploading">
                <view class="upload-spinner"></view>
                <text class="upload-progress-text">上传中...</text>
              </view>
              <view class="upload-change-btn" v-if="!isUploading">
                <text class="upload-change-text">更换图片</text>
              </view>
            </view>
          </view>

          <view class="edit-field">
            <text class="edit-label">简要描述</text>
            <textarea class="edit-textarea" v-model="editForm.desc" :auto-height="true" maxlength="100" placeholder="列表里显示的短描述，可不填" />
          </view>

          <view class="edit-field">
            <text class="edit-label">详细描述</text>
            <textarea class="edit-textarea large" v-model="editForm.fullDesc" :auto-height="true" maxlength="500" placeholder="点餐端会展示这里的详细描述" />
          </view>

          <view class="edit-field">
            <text class="edit-label">绝对不吃关键词</text>
            <textarea class="edit-textarea" v-model="editForm.dislikeKeywordsStr" :auto-height="true" maxlength="100" placeholder="例如：香菜,苦瓜,洋葱" />
          </view>

          <view class="edit-field">
            <text class="edit-label">过敏关键词</text>
            <textarea class="edit-textarea" v-model="editForm.allergyKeywordsStr" :auto-height="true" maxlength="100" placeholder="例如：花生,牛奶,坚果" />
          </view>

          <view class="edit-field">
            <text class="edit-label">价格文案</text>
            <input class="edit-input" v-model="editForm.price" placeholder="免费" />
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

        <view class="edit-actions">
          <view class="edit-btn cancel" @click="showEdit = false">
            <text class="edit-btn-text cancel">取消</text>
          </view>
          <view class="edit-btn save" :class="{ disabled: isSaving }" @click="saveItem">
            <text class="edit-btn-text save">{{ isSaving ? '保存中...' : '保存' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import store, { loadMenuFromCloud, addMenuItemToCloud, uploadImageToCloud, loadMenuCategoriesFromCloud, addMenuCategoryToCloud } from '@/store/index.js'
import { isCloudAvailable } from '@/services/cloud.js'

const isLoading = ref(true)
const showEdit = ref(false)
const isSaving = ref(false)
const isUploading = ref(false)
const isCreatingCategory = ref(false)
const showCategoryCreator = ref(false)
const newCategoryName = ref('')
const newCategoryEmoji = ref('🍽️')
const categoryEmojiOptions = ['🔥', '🍰', '🥤', '🍜', '🥗', '🍵', '🍚', '🥩', '🌶️', '🍲', '🍱', '🍽️']

const editForm = ref({
  name: '',
  desc: '',
  fullDesc: '',
  dislikeKeywordsStr: '',
  allergyKeywordsStr: '',
  category: 'hot',
  emoji: '🍽️',
  image: '/static/logo.png',
  imagePreview: '',
  price: '免费',
  optionGroup1Label: '甜度',
  optionGroup1OptionsStr: '',
  optionGroup2Label: '加料',
  optionGroup2OptionsStr: '',
})

const menuItems = computed(() => store.menuItems)
const canEnter = computed(() => menuItems.value.length > 0)

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
  const groups = [
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
  return groups.filter(group => group.label && group.options.length > 0)
}

onMounted(async () => {
  if (!store.roomId) {
    uni.showToast({ title: '请先创建房间', icon: 'none' })
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }

  isLoading.value = true
  await Promise.all([
    loadMenuFromCloud(),
    loadMenuCategoriesFromCloud(),
  ])
  isLoading.value = false
  if (menuItems.value.length === 0) {
    openAdd()
  }
})

const resetForm = () => {
  editForm.value = {
    name: '',
    desc: '',
    fullDesc: '',
    dislikeKeywordsStr: '',
    allergyKeywordsStr: '',
    category: 'hot',
    emoji: '🍽️',
    image: '/static/logo.png',
    imagePreview: '',
    price: '免费',
    optionGroup1Label: '甜度',
    optionGroup1OptionsStr: '',
    optionGroup2Label: '加料',
    optionGroup2OptionsStr: '',
  }
}

const openAdd = () => {
  resetForm()
  showEdit.value = true
}

const saveItem = async () => {
  if (isSaving.value || isUploading.value) return
  const form = editForm.value
  const name = form.name.trim()
  const fullDesc = form.fullDesc.trim()
  if (!name) {
    uni.showToast({ title: '请输入菜品名称', icon: 'none' })
    return
  }
  if (!fullDesc) {
    uni.showToast({ title: '请输入详细描述', icon: 'none' })
    return
  }

  const optionGroups = buildOptionGroups(form)
  const primaryGroup = optionGroups[0]
  const secondaryGroup = optionGroups[1]
  const data = {
    name,
    desc: form.desc.trim() || fullDesc.slice(0, 40),
    fullDesc,
    dislikeKeywords: parseKeywordList(form.dislikeKeywordsStr),
    allergyKeywords: parseKeywordList(form.allergyKeywordsStr),
    category: form.category,
    emoji: getCatEmoji(form.category),
    image: form.image || '/static/logo.png',
    price: form.price || '免费',
    available: true,
    optionGroups,
    sweetLabel: primaryGroup?.label || '',
    sweetOptions: primaryGroup?.options || [],
    extraLabel: secondaryGroup?.label || '',
    extraOptions: secondaryGroup?.options || [],
    sortOrder: menuItems.value.length + 1,
  }

  isSaving.value = true
  try {
    const id = await addMenuItemToCloud(data)
    if (id) {
      uni.showToast({ title: '已添加 ✅', icon: 'none' })
      showEdit.value = false
      return
    }
    if (!isCloudAvailable()) {
      store.menuItems.push({ ...data, _id: 'local_' + Date.now() })
      store.menuLoaded = true
      uni.showToast({ title: '已添加（本地）✅', icon: 'none' })
      showEdit.value = false
      return
    }
    uni.showToast({ title: '添加失败，请检查云函数', icon: 'none' })
  } catch (e) {
    uni.showToast({ title: '添加失败，请重试', icon: 'none' })
  } finally {
    isSaving.value = false
  }
}

const chooseAndUploadImage = () => {
  if (isUploading.value) return

  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const tempPath = res.tempFilePaths[0]
      if (!tempPath) return

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
          editForm.value.image = tempPath
          uni.showToast({ title: '已使用本地图片', icon: 'none' })
        } else {
          editForm.value.image = previousImage
          editForm.value.imagePreview = previousPreview
          uni.showToast({ title: '上传失败，请重试', icon: 'none' })
        }
      } catch (e) {
        editForm.value.image = previousImage
        editForm.value.imagePreview = previousPreview
        uni.showToast({ title: '上传失败', icon: 'none' })
      } finally {
        isUploading.value = false
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
    console.warn('[MenuInit] 新增分类失败', e)
    uni.showToast({ title: '添加分类失败，请稍后重试', icon: 'none' })
  } finally {
    isCreatingCategory.value = false
  }
}

const finishInit = () => {
  if (!canEnter.value) {
    uni.showToast({ title: '请先添加至少一道菜品', icon: 'none' })
    return
  }
  uni.switchTab({ url: '/pages/chef/dashboard' })
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100vh; background: #F7F8FA; overflow: hidden; }
.status-bar { height: var(--status-bar-height, 44px); width: 100%; background: #FFFFFF; }
.top-header { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 40rpx 20rpx; background: #FFFFFF; }
.title-wrap { display: flex; flex-direction: column; gap: 8rpx; min-width: 0; }
.page-title { font-size: 40rpx; font-weight: bold; color: #1D2129; }
.page-subtitle { font-size: 24rpx; color: #86909C; letter-spacing: 2rpx; font-family: 'Courier New', monospace; }
.count-pill { padding: 10rpx 24rpx; border-radius: 24rpx; background: #E8F3FF; flex-shrink: 0; margin-right: 200rpx; }
.count-text { font-size: 24rpx; color: #4080FF; font-weight: bold; }
.menu-scroll { flex: 1; overflow: hidden; }
.menu-list { padding: 28rpx 32rpx 240rpx; display: flex; flex-direction: column; gap: 20rpx; }
.loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24rpx; padding: 140rpx 0; }
.loading-spinner, .upload-spinner { width: 48rpx; height: 48rpx; border: 6rpx solid #E5E6EB; border-top-color: #4080FF; border-radius: 50%; animation: spin 0.8s linear infinite; }
.loading-text, .empty-title { font-size: 28rpx; color: #86909C; }
.empty-emoji { font-size: 92rpx; }
.empty-btn { padding: 22rpx 48rpx; border-radius: 40rpx; background: #4080FF; }
.empty-btn-text { font-size: 28rpx; color: #FFFFFF; font-weight: bold; }
.menu-card { display: flex; gap: 24rpx; background: #FFFFFF; border-radius: 28rpx; padding: 28rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04); animation: fadeInUp 0.4s ease both; }
.menu-img { width: 140rpx; height: 140rpx; border-radius: 20rpx; overflow: hidden; flex-shrink: 0; background: #FFF7E6; }
.menu-photo { width: 100%; height: 100%; }
.menu-info { flex: 1; display: flex; flex-direction: column; gap: 14rpx; min-width: 0; }
.menu-top-row { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; }
.menu-name { flex: 1; font-size: 30rpx; font-weight: bold; color: #1D2129; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.menu-cat { font-size: 22rpx; color: #4080FF; flex-shrink: 0; }
.menu-desc { font-size: 24rpx; color: #86909C; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.list-spacer { height: 40rpx; }
.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 28rpx 40rpx 68rpx; background: #FFFFFF; box-shadow: 0 -8rpx 20rpx rgba(0,0,0,0.04); display: flex; gap: 20rpx; z-index: 100; }
.secondary-btn, .primary-btn { height: 88rpx; border-radius: 44rpx; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }
.secondary-btn { flex: 1; background: #F2F3F5; }
.primary-btn { flex: 1.3; background: #4080FF; }
.primary-btn.disabled { opacity: 0.45; }
.secondary-btn:active, .primary-btn:active { transform: scale(0.96); }
.secondary-btn-text { font-size: 28rpx; color: #4E5969; font-weight: bold; }
.primary-btn-text { font-size: 28rpx; color: #FFFFFF; font-weight: bold; }
.edit-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.25s ease; }
.edit-card { width: 680rpx; max-height: 84vh; background: #FFFFFF; border-radius: 32rpx; padding: 40rpx 36rpx 32rpx; display: flex; flex-direction: column; gap: 20rpx; animation: bounceIn 0.45s ease; box-sizing: border-box; }
.edit-title { font-size: 34rpx; font-weight: bold; color: #1D2129; text-align: center; }
.edit-scroll { max-height: 56vh; overflow: hidden; }
.edit-field { display: flex; flex-direction: column; gap: 10rpx; margin-bottom: 20rpx; }
.edit-label { font-size: 24rpx; font-weight: bold; color: #4E5969; }
.edit-label.small { font-size: 22rpx; color: #86909C; margin-top: 4rpx; }
.edit-input { width: 100%; height: 72rpx; font-size: 26rpx; color: #1D2129; background: #F7F8FA; border-radius: 16rpx; padding: 0 20rpx; box-sizing: border-box; }
.edit-textarea { width: 100%; font-size: 24rpx; color: #1D2129; background: #F7F8FA; border-radius: 16rpx; padding: 20rpx; min-height: 100rpx; line-height: 1.6; box-sizing: border-box; }
.edit-textarea.large { min-height: 140rpx; }
.cat-picker { display: flex; flex-wrap: wrap; gap: 12rpx; }
.cat-chip { padding: 10rpx 24rpx; border-radius: 24rpx; background: #F2F3F5; transition: all 0.2s ease; }
.cat-chip.active { background: #E8F3FF; }
.cat-chip.add-cat-chip { background: #FFF7E6; }
.cat-chip-text { font-size: 22rpx; color: #4E5969; }
.cat-chip-text.add { color: #FA8C16; font-weight: bold; }
.cat-chip.active .cat-chip-text { color: #4080FF; font-weight: bold; }
.category-creator { margin-top: 16rpx; padding: 20rpx; border-radius: 20rpx; background: #F7F8FA; display: flex; flex-direction: column; gap: 16rpx; box-sizing: border-box; }
.emoji-picker { display: flex; flex-wrap: wrap; gap: 12rpx; }
.emoji-chip { width: 64rpx; height: 64rpx; border-radius: 18rpx; background: #FFFFFF; display: flex; align-items: center; justify-content: center; border: 2rpx solid transparent; transition: all 0.2s ease; }
.emoji-chip.active { border-color: #4080FF; background: #E8F3FF; transform: scale(1.04); }
.emoji-chip-text { font-size: 32rpx; }
.create-category-btn { height: 72rpx; border-radius: 36rpx; background: #4080FF; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }
.create-category-btn.disabled { opacity: 0.6; }
.create-category-text { font-size: 26rpx; color: #FFFFFF; font-weight: bold; }
.image-upload-area { position: relative; width: 100%; height: 260rpx; border-radius: 20rpx; overflow: hidden; background: #F7F8FA; border: 2rpx dashed #C9CDD4; box-sizing: border-box; }
.upload-preview { width: 100%; height: 100%; }
.upload-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12rpx; }
.upload-spinner { border-color: rgba(255,255,255,0.3); border-top-color: #FFFFFF; }
.upload-progress-text { font-size: 24rpx; color: #FFFFFF; font-weight: bold; }
.upload-change-btn { position: absolute; left: 0; right: 0; bottom: 0; height: 56rpx; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; }
.upload-change-text { font-size: 22rpx; color: #FFFFFF; font-weight: bold; }
.edit-actions { display: flex; gap: 16rpx; margin-top: 8rpx; }
.edit-btn { flex: 1; height: 80rpx; border-radius: 40rpx; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }
.edit-btn:active { transform: scale(0.95); }
.edit-btn.cancel { background: #F7F8FA; }
.edit-btn.save { background: #4080FF; flex: 1.5; }
.edit-btn.save.disabled { opacity: 0.6; }
.edit-btn-text.cancel { color: #4E5969; font-weight: bold; font-size: 28rpx; }
.edit-btn-text.save { color: #FFFFFF; font-weight: bold; font-size: 28rpx; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
