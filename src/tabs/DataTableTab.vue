<script setup>
  import { ref, computed, defineEmits, onMounted, watch } from 'vue';
  import { useDataStore } from '@/stores/dataStore.js';

  const emit = defineEmits(['highlight-on-map']);

  const dataStore = useDataStore();

  const activeLayerTab = ref(null); /** 📑 當前作用中的圖層分頁 */
  const layerSortStates = ref({}); /** 📊 每個圖層的排序狀態 */

  // 獲取所有開啟且有資料的圖層
  const visibleLayers = computed(() => {
    const allLayers = dataStore.getAllLayers();
    return allLayers.filter((layer) => {
      if (!layer.visible) return false;
      if (
        layer.isAnalysisLayer ||
        layer.isIsochroneAnalysisLayer ||
        layer.isRoutePlanningLayer ||
        layer.isRouteOptimizationLayer
      ) {
        return false;
      }
      return true;
    });
  });

  /**
   * 📑 設定作用中圖層分頁 (Set Active Layer Tab)
   * @param {string} layerId - 圖層 ID
   */
  const setActiveLayerTab = (layerId) => {
    activeLayerTab.value = layerId;
  };

  /**
   * 根據圖層的第一筆資料，動態獲取所有適合顯示在表格中的欄位名稱
   * @param {object} layer - 圖層物件
   * @returns {string[]} - 一個包含所有欄位名稱的字串陣列
   */
  const getLayerColumns = (layer) => {
    // 獲取排序後的資料陣列
    const data = getSortedData(layer);

    // 如果沒有資料或資料為空，返回一個空陣列
    if (!data || data.length === 0) {
      return [];
    }

    // 取第一筆資料作為樣本
    const sampleItem = data[0];

    // 使用 Object.keys 獲取所有屬性名稱 (key)
    // 並過濾掉不適合直接顯示在表格中的複雜物件 (例如 geometry)
    return Object.keys(sampleItem).filter((key) => {
      const value = sampleItem[key];
      // 只保留值不是物件，或值雖是物件但為 null 的鍵
      return typeof value !== 'object' || value === null;
    });
  };

  /**
   * 📊 取得圖層資料數量 (Get Layer Data Count)
   * @param {Object} layer - 圖層物件
   * @returns {number} 資料數量
   */
  const getLayerDataCount = (layer) => {
    return layer.tableData?.length || 0;
  };

  /**
   * 📊 取得排序後的資料 (Get Sorted Data)
   * @param {Object} layer - 圖層物件
   * @returns {Array} 排序後的資料陣列
   */
  const getSortedData = (layer) => {
    if (!layer.tableData) return [];

    const sortState = layerSortStates.value[layer.layerId];
    if (!sortState || !sortState.key) {
      return layer.tableData;
    }

    return [...layer.tableData].sort((a, b) => {
      const aValue = a[sortState.key];
      const bValue = b[sortState.key];

      // 字串類型的比較
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortState.order === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // 數值類型的比較
      return sortState.order === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  /**
   * 📊 處理排序點擊 (Handle Sort Click)
   * @param {string} layerId - 圖層 ID
   * @param {string} key - 排序欄位
   */
  const handleSort = (layerId, key) => {
    if (!layerSortStates.value[layerId]) {
      layerSortStates.value[layerId] = { key: null, order: 'asc' };
    }

    const sortState = layerSortStates.value[layerId];

    if (sortState.key === key) {
      // 切換排序方向
      sortState.order = sortState.order === 'asc' ? 'desc' : 'asc';
    } else {
      // 設定新的排序欄位
      sortState.key = key;
      sortState.order = 'asc';
    }
  };

  /**
   * 🎨 取得排序圖示 (Get Sort Icon)
   * @param {string} layerId - 圖層 ID
   * @param {string} key - 欄位名稱
   * @returns {string} FontAwesome 圖示類別
   */
  const getSortIcon = (layerId, key) => {
    const sortState = layerSortStates.value[layerId];
    if (!sortState || sortState.key !== key) {
      return 'fas fa-sort';
    }
    return sortState.order === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  };

  /** 表頭顯示用：略去單位後綴，欄位 key 與排序仍用原名 */
  const formatDataTableColumnLabel = (key) => {
    if (typeof key !== 'string') return key;
    return key.replace(/\(公噸CO2e\)/g, '').trimEnd();
  };

  /**
   * 🎯 處理地圖高亮顯示 (Handle Map Highlighting)
   * @param {Object} item - 要高亮的項目
   * @param {Object} layer - 圖層物件
   */
  const handleHighlight = (item, layer) => {
    console.log('準備高亮顯示:', { item, layer: layer.layerName });

    // 傳遞包含圖層資訊和項目ID的物件
    const highlightData = {
      id: item.id || item['#'], // 🔥 優先使用 item.id，如果沒有則使用 item['#'] 作為後備
      layerId: layer.layerId,
      layerName: layer.layerName,
      item: item,
    };

    console.log('發送高亮事件:', highlightData);

    // 添加小延遲，確保地圖已準備就緒
    setTimeout(() => {
      emit('highlight-on-map', highlightData);
    }, 50);
  };

  // 記錄上一次的圖層列表用於比較
  const previousLayers = ref([]);

  /**
   * 👀 監聽可見圖層變化，自動切換到新開啟的圖層分頁
   */
  watch(
    () => visibleLayers.value,
    (newLayers) => {
      // 如果沒有可見圖層，清除選中的分頁
      if (newLayers.length === 0) {
        activeLayerTab.value = null;
        previousLayers.value = [];
        return;
      }

      // 找出新增的圖層（比較新舊圖層列表）
      const previousLayerIds = previousLayers.value.map((layer) => layer.layerId);
      const newLayerIds = newLayers.map((layer) => layer.layerId);
      const addedLayerIds = newLayerIds.filter((id) => !previousLayerIds.includes(id));

      // 如果有新增的圖層，自動切換到最新新增的圖層
      if (addedLayerIds.length > 0) {
        const newestAddedLayerId = addedLayerIds[addedLayerIds.length - 1];
        activeLayerTab.value = newestAddedLayerId;
        console.log(
          `🔄 自動切換到新開啟的圖層: ${newLayers.find((layer) => layer.layerId === newestAddedLayerId)?.layerName}`
        );
      }
      // 如果當前沒有選中分頁，或選中的分頁不在可見列表中，選中第一個
      else if (
        !activeLayerTab.value ||
        !newLayers.find((layer) => layer.layerId === activeLayerTab.value)
      ) {
        activeLayerTab.value = newLayers[0].layerId;
      }

      // 更新記錄的圖層列表
      previousLayers.value = [...newLayers];
    },
    { deep: true, immediate: true }
  );

  /**
   * 🚀 組件掛載事件 (Component Mounted Event)
   */
  onMounted(() => {
    console.log('[MultiLayerDataTableTab] Component Mounted');

    // 初始化第一個可見圖層為作用中分頁
    if (visibleLayers.value.length > 0 && !activeLayerTab.value) {
      activeLayerTab.value = visibleLayers.value[0].layerId;
    }
  });
</script>

<template>
  <!-- 📊 多圖層資料表格分頁組件 -->
  <div class="d-flex flex-column my-bgcolor-gray-200 h-100">
    <!-- 📑 圖層分頁導航 -->
    <div v-if="visibleLayers.length > 0" class="">
      <ul class="nav nav-tabs nav-fill">
        <li
          v-for="layer in visibleLayers"
          :key="layer.layerId"
          class="nav-item d-flex flex-column align-items-center"
        >
          <!-- tab按鈕 -->
          <div
            class="btn nav-link rounded-0 border-0 position-relative d-flex align-items-center justify-content-center my-bgcolor-gray-200"
            :class="{
              active: activeLayerTab === layer.layerId,
            }"
            @click="setActiveLayerTab(layer.layerId)"
          >
            <span class="my-title-sm-black"
              >{{ layer.layerName }}
              <span class="my-content-xs-gray ms-2" v-if="getLayerDataCount(layer)">
                {{ getLayerDataCount(layer) }}
              </span>
            </span>
          </div>
          <div
            class="w-100"
            :class="layer.layerColor ? undefined : `my-bgcolor-${layer.colorName}`"
            :style="
              layer.layerColor
                ? { minHeight: '4px', backgroundColor: layer.layerColor }
                : { minHeight: '4px' }
            "
          ></div>
        </li>
      </ul>
    </div>

    <!-- 📋 圖層表格內容區域 -->
    <div v-if="visibleLayers.length > 0" class="flex-grow-1 overflow-hidden">
      <div
        v-for="layer in visibleLayers"
        :key="layer.layerId"
        v-show="activeLayerTab === layer.layerId"
        class="h-100"
      >
        <div class="h-100 d-flex flex-column">
          <div class="flex-grow-1 overflow-auto">
            <table class="table mb-0 my-datatable-content-width">
              <thead class="sticky-top my-table-thead">
                <tr class="text-center text-nowrap">
                  <template v-for="column in getLayerColumns(layer)" :key="column">
                    <th
                      v-if="column !== 'color'"
                      @click="handleSort(layer.layerId, column)"
                      class="my-bgcolor-white-hover p-1 my-cursor-pointer"
                    >
                      <span class="my-title-xs-gray text-nowrap">
                        {{ formatDataTableColumnLabel(column) }}
                      </span>
                      <span class="my-title-xs-gray text-nowrap ms-2">
                        <i :class="getSortIcon(layer.layerId, column)"></i>
                      </span>
                    </th>
                  </template>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in getSortedData(layer)"
                  :key="item.id"
                  class="my-table-tr-hover text-center text-nowrap border-bottom my-cursor-pointer"
                  @click="handleHighlight(item, layer)"
                >
                  <template v-for="column in getLayerColumns(layer)" :key="column">
                    <td
                      v-if="column !== 'color'"
                      class="border-0 text-nowrap p-0 align-middle"
                    >
                      <div v-if="column === '#'" class="d-flex p-0">
                        <div
                          style="min-width: 6px"
                          :style="{
                            backgroundColor: item['color'],
                          }"
                        ></div>
                        <div class="my-content-xs-black w-100 px-3 py-2">
                          {{ item[column] }}
                        </div>
                      </div>
                      <div v-else class="my-content-xs-black px-3 py-2">
                        {{ item[column] }}
                      </div>
                    </td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 📭 無開啟圖層的空狀態 -->
    <div v-else class="flex-grow-1 d-flex align-items-center justify-content-center">
      <div class="text-center">
        <div class="my-title-md-gray p-3">沒有開啟的圖層</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .my-table-thead {
    border-bottom: 2px solid var(--my-color-gray-300) !important;
  }

  /**
   * 欄寬依「該欄所有儲存格＋表頭」中最寬者決定（table-layout: auto），
   * 不以固定像素或僅表頭縮窄；內容較寬時由外層 overflow-auto 橫向捲動。
   */
  .my-datatable-content-width {
    table-layout: auto;
    width: max-content;
    min-width: 100%;
  }

  .my-datatable-content-width th,
  .my-datatable-content-width td {
    width: auto;
    max-width: none;
  }
</style>
