<script>
export default {
  onLaunch: function () {
    console.log('App Launch')
  },
  onShow: function () {
    console.log('App Show')
  },
  onHide: function () {
    console.log('App Hide')
  },
}
</script>

<style>
/*每个页面公共css */
page {
  background-color: #FFFDF9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #5C4B51;
  font-size: 28rpx;
}
view, text, image, button {
  box-sizing: border-box;
}
.glass-panel {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.05);
  border: 2rpx solid rgba(255, 255, 255, 0.4);
}
</style>
