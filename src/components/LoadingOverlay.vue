<script>
  export default {
    name: 'LoadingOverlay',

    /**
     * 🔧 組件屬性定義 (Component Props)
     * 接收來自父組件的載入狀態和配置選項
     */
    props: {
      /** ⏳ 是否顯示載入覆蓋層 */
      isVisible: {
        type: Boolean,
        default: false,
        required: true,
      },
      /** 📝 載入過程的主要文字描述 */
      loadingText: {
        type: String,
        default: '載入中...',
      },
      /** 📊 載入進度百分比 (0-100) */
      progress: {
        type: Number,
        default: -1,
        validator: (value) => value >= -1 && value <= 100,
      },
      /** 📊 是否顯示進度條 */
      showProgress: {
        type: Boolean,
        default: false,
      },
      /** 📝 輔助說明文字 (可選) */
      subText: {
        type: String,
        default: '',
      },
    },
  };
</script>

<template>
  <!-- ⏳ 載入覆蓋層組件 (Loading Overlay Component) -->
  <!-- 在資料載入時顯示，提供視覺化的載入進度回饋和狀態提示 -->
  <div
    class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
    style="background-color: rgba(0, 0, 0, 0.7); z-index: 9999"
    v-if="isVisible"
  >
    <!-- 📄 載入內容卡片 (Loading Content Card) -->
    <!-- 包含載入動畫、文字提示、進度條等元素的中央卡片 -->
    <div
      class="text-center my-bgcolor-white p-4 rounded shadow"
      style="min-width: 300px; max-width: 400px"
    >
      <!-- ⏳ 載入動畫圓環 (Loading Animation Spinner) -->
      <!-- Bootstrap 提供的圓形載入動畫，表示系統正在處理請求 -->
      <div class="spinner-border text-primary mb-3" style="width: 2rem; height: 2rem" role="status">
        <!-- 🔍 無障礙輔助文字 (Screen Reader Text) -->
        <!-- 為螢幕閱讀器提供的載入狀態說明 -->
        <span class="visually-hidden">載入中...</span>
      </div>

      <!-- 📝 主要載入文字 (Primary Loading Text) -->
      <!-- 顯示當前載入的主要操作或狀態描述 -->
      <div class="my-title-lg-black">{{ loadingText }}</div>

      <!-- 📊 載入進度條區域 (Loading Progress Area) -->
      <!-- 當需要顯示具體進度時，提供視覺化的進度條 -->
      <div class="mt-3" v-if="showProgress && progress >= 0">
        <!-- 📊 Bootstrap 進度條容器 (Bootstrap Progress Container) -->
        <div class="progress" style="height: 8px">
          <!-- 📊 進度條滑塊 (Progress Bar) -->
          <!-- 根據 progress 屬性動態調整寬度，顯示載入完成百分比 -->
          <div
            class="progress-bar bg-primary d-flex align-items-center justify-content-center"
            role="progressbar"
            :style="{ width: progress + '%' }"
            :aria-valuenow="progress"
            aria-valuemin="0"
            aria-valuemax="100"
            style="transition: width 0.3s ease; font-size: 0.75rem; color: white"
          >
            {{ Math.round(progress) }}%
          </div>
        </div>
      </div>

      <!-- 📝 輔助說明文字 (Secondary Text) -->
      <!-- 提供載入操作的詳細說明或提示資訊 -->
      <div v-if="subText" class="mt-2">
        <small class="my-content-xs-gray">{{ subText }}</small>
      </div>
    </div>
  </div>
</template>
