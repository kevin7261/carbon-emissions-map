<script>
  import LayersTab from '../tabs/LayersTab.vue';

  export default {
    name: 'LeftView',

    /**
     * 🧩 組件註冊 (Component Registration)
     * 註冊左側面板內使用的子組件
     */
    components: {
      LayersTab, // 圖層列表分頁組件
    },

    /**
     * 🔧 組件設定函數 (Component Setup)
     * 使用 Composition API 設定組件邏輯
     */
    setup() {
      // 📤 返回響應式數據給模板使用
      return {};
    },
  };
</script>

<template>
  <div class="my-bgcolor-gray-100 h-100 d-flex flex-column overflow-hidden">
    <!-- 📰 頁面標題區域 -->
    <div class="p-3">
      <h1 class="my-font-size-lg my-letter-spacing-lg text-center m-3">碳排地圖</h1>
    </div>

    <!-- 📋 圖層列表分頁內容 -->
    <div class="flex-grow-1 overflow-hidden">
      <LayersTab />
    </div>
  </div>
</template>

<style scoped></style>
