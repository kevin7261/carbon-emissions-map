// 🔧 Vue Composition API 引入
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * 🗺️ 地圖與面板存儲定義 (Map and Panel Store Definition)
 * 統一管理地圖狀態和響應式面板佈局
 */
export const useMapStore = defineStore('map', () => {
  // ==================== 📐 面板尺寸狀態 (Panel Size States) ====================
  const leftViewWidth = ref(300);
  const rightViewWidth = ref(300);
  const bottomViewHeight = ref(250);
  const windowWidth = ref(window.innerWidth);
  const windowHeight = ref(window.innerHeight);

  // ==================== 地圖和控制項狀態 ====================
  const zoomLevel = ref(10);
  const currentCoords = ref({ lat: 25.051474, lng: 121.557989 });

  // ==================== 地圖圖層狀態 ====================
  const mapLayers = ref({
    geojsonLayer: null,
    pointLayer: null,
    heatmapLayer: null,
    clusterLayer: null,
    bufferLayer: null,
  });

  // ==================== 計算屬性 ====================

  // 主要面板寬度（考慮Bootstrap col-12）
  const mainPanelWidth = computed(() => {
    const availableWidth = windowWidth.value - leftViewWidth.value - rightViewWidth.value;
    return Math.max(200, availableWidth); // 確保最小寬度
  });

  // ==================== 方法 ====================

  return {
    // 狀態
    leftViewWidth,
    rightViewWidth,
    bottomViewHeight,
    windowWidth,
    windowHeight,
    zoomLevel,
    currentCoords,
    mapLayers,

    // 計算屬性
    mainPanelWidth,
  };
});
