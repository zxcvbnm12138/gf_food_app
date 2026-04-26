<template>
  <view class="container">
    <!-- Header -->
    <view class="header">
      <view class="greeting">
        <text class="greeting-sub">早安宝贝，</text>
        <text class="greeting-main">今天吃点什么？</text>
      </view>
      <image class="avatar" src="/static/avatar-placeholder.png" mode="aspectFill"></image>
    </view>

    <!-- Weather Tip -->
    <view class="tip-card glass-panel">
      <text class="tip-icon">🌧️</text>
      <text class="tip-text">今天下雨，来点热乎乎的奶茶暖暖手吧~</text>
    </view>

    <!-- Random Picker (The core feature) -->
    <view class="picker-section">
      <view class="picker-card" @click="handleRandomPick">
        <view class="picker-content">
          <text class="picker-title">纠结星人专属</text>
          <text class="picker-subtitle">不知道吃啥？点我扭一下！</text>
        </view>
        <view class="gacha-machine">
          <text class="gacha-emoji">🎰</text>
        </view>
      </view>
    </view>

    <!-- Categories -->
    <view class="section-title">
      <text>专属分类</text>
    </view>
    <view class="category-grid">
      <view class="category-item cat-favorite">
        <text class="cat-icon">💖</text>
        <text class="cat-text">你的最爱</text>
      </view>
      <view class="category-item cat-carb">
        <text class="cat-icon">🍰</text>
        <text class="cat-text">碳水快乐</text>
      </view>
      <view class="category-item cat-healthy">
        <text class="cat-icon">🥗</text>
        <text class="cat-text">轻食无负担</text>
      </view>
      <view class="category-item cat-comfort glass-panel">
        <text class="cat-icon">🍵</text>
        <text class="cat-text">暖呼呼特供</text>
      </view>
    </view>

    <!-- Featured -->
    <view class="section-title">
      <text>今日主厨推荐</text>
    </view>
    <view class="featured-card">
      <image class="featured-img" src="/static/featured-placeholder.png" mode="aspectFill"></image>
      <view class="featured-info">
        <text class="featured-name">草莓甜心蛋糕</text>
        <text class="featured-desc">甜度刚刚好，就像你一样 🍓</text>
      </view>
    </view>
    
    <!-- Bottom Spacing -->
    <view class="bottom-spacer"></view>
  </view>
</template>

<script setup>
const handleRandomPick = () => {
  uni.showToast({
    title: '正在召唤美食...',
    icon: 'loading',
    duration: 1500
  });
  setTimeout(() => {
    uni.showModal({
      title: '✨ 扭蛋结果',
      content: '恭喜抽中：【芋泥波波奶茶】！要不要来一杯？',
      confirmText: '加入清单',
      confirmColor: '#FF8C9A',
      cancelText: '再扭一次'
    });
  }, 1500);
};
</script>

<style scoped>
.container {
  padding: 40rpx 32rpx;
  min-height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40rpx;
  padding-top: 20rpx;
}

.greeting {
  display: flex;
  flex-direction: column;
}

.greeting-sub {
  font-size: 28rpx;
  color: #8C7A80;
  margin-bottom: 8rpx;
}

.greeting-main {
  font-size: 44rpx;
  font-weight: bold;
  color: #FF8C9A;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background-color: #FFF3A1;
  border: 4rpx solid #fff;
}

.tip-card {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-radius: 24rpx;
  margin-bottom: 40rpx;
}

.tip-icon {
  font-size: 40rpx;
  margin-right: 16rpx;
}

.tip-text {
  font-size: 26rpx;
  color: #8C7A80;
}

.picker-section {
  margin-bottom: 40rpx;
}

.picker-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #FF8C9A 0%, #FFB6C1 100%);
  padding: 40rpx 32rpx;
  border-radius: 32rpx;
  box-shadow: 0 16rpx 32rpx rgba(255, 140, 154, 0.3);
}

.picker-content {
  display: flex;
  flex-direction: column;
}

.picker-title {
  color: #fff;
  font-size: 36rpx;
  font-weight: bold;
  margin-bottom: 8rpx;
}

.picker-subtitle {
  color: rgba(255, 255, 255, 0.9);
  font-size: 24rpx;
}

.gacha-machine {
  width: 96rpx;
  height: 96rpx;
  background: #fff;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 8rpx 16rpx rgba(0,0,0,0.1);
}

.gacha-emoji {
  font-size: 48rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #5C4B51;
  margin-bottom: 24rpx;
}

.category-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
  margin-bottom: 40rpx;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32rpx 0;
  border-radius: 32rpx;
}

.cat-icon {
  font-size: 64rpx;
  margin-bottom: 16rpx;
}

.cat-text {
  font-size: 28rpx;
  font-weight: bold;
}

.cat-favorite {
  background-color: #FF8C9A;
  color: #fff;
}

.cat-carb {
  background-color: #FFF3A1;
  color: #5C4B51;
}

.cat-healthy {
  background-color: #A8E6CF;
  color: #5C4B51;
}

.cat-comfort {
  background-color: #fff;
  color: #5C4B51;
}

.featured-card {
  background: #fff;
  border-radius: 32rpx;
  overflow: hidden;
  box-shadow: 0 16rpx 48rpx rgba(0,0,0,0.05);
}

.featured-img {
  width: 100%;
  height: 320rpx;
  background-color: #FFF3A1;
}

.featured-info {
  padding: 24rpx 32rpx;
  display: flex;
  flex-direction: column;
}

.featured-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #5C4B51;
  margin-bottom: 8rpx;
}

.featured-desc {
  font-size: 26rpx;
  color: #8C7A80;
}

.bottom-spacer {
  height: 120rpx;
}
</style>
