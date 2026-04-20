<script setup>
  import { ref, computed, watch, onMounted, nextTick, onUnmounted } from 'vue';
  import { useDataStore } from '@/stores/dataStore.js';
  import * as d3 from 'd3';

  const dataStore = useDataStore();

  const activeLayerTab = ref(null); /** 📑 當前作用中的圖層分頁 */
  const chartContainer = ref(null); /** 📊 圖表容器參考 */

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
   * 📊 當前圖層摘要 (Current Layer Summary)
   */
  const currentLayerSummary = computed(() => {
    if (!activeLayerTab.value) return null;
    const layer = visibleLayers.value.find((l) => l.layerId === activeLayerTab.value);
    return layer ? layer.summaryData || null : null;
  });

  /**
   * 📊 取得當前選中圖層名稱 (Get Current Selected Layer Name)
   */
  const currentLayerName = computed(() => {
    if (!activeLayerTab.value) return '無開啟圖層';
    const layer = visibleLayers.value.find((l) => l.layerId === activeLayerTab.value);
    return layer ? layer.layerName || '未知圖層' : '無開啟圖層';
  });

  /**
   * 📊 繪製橫向長條圖 (Draw Horizontal Bar Chart)
   * @param {Array} districtCount - 行政區統計數據
   */
  const drawHorizontalBarChart = (districtCount) => {
    if (!chartContainer.value || !districtCount || districtCount.length === 0) {
      return;
    }

    // 清除之前的圖表
    d3.select(chartContainer.value).selectAll('*').remove();

    // 設定圖表尺寸和邊距
    const margin = { top: 0, right: 48, bottom: 16, left: 48 };
    const containerWidth = chartContainer.value.clientWidth;
    const width = containerWidth - margin.left - margin.right;
    const barHeight = 8;
    const barSpacing = 24;
    const height = districtCount.length * barSpacing;

    // 創建 SVG
    const svg = d3
      .select(chartContainer.value)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // 設定比例尺
    const maxCount = d3.max(districtCount, d => d.count);
    const xScale = d3
      .scaleLinear()
      .domain([0, maxCount])
      .range([0, width]);

                /**
     * 計算刻度系統 - 所有刻度都是5的倍數，且等間隔分布，最多5個刻度
     */
    const calculateTickSystem = (dataMaxValue) => {
      // Step 1: 決定刻度間隔（必須是5的倍數），確保刻度數量不超過5個
      let interval;

      // 計算需要的間隔，使刻度數量不超過5個（包含0）
      const maxTicks = 5;
      const minInterval = Math.ceil(dataMaxValue / (maxTicks - 1));

      // 找到最小的5的倍數間隔
      if (minInterval <= 5) {
        interval = 5;
      } else if (minInterval <= 10) {
        interval = 10;
      } else if (minInterval <= 20) {
        interval = 20;
      } else if (minInterval <= 50) {
        interval = 50;
      } else if (minInterval <= 100) {
        interval = 100;
      } else {
        // 對於更大的數值，找到最接近的5的倍數
        interval = Math.ceil(minInterval / 5) * 5;
      }

      // Step 2: 計算圖表的最大刻度值
      const chartMaxValue = Math.ceil(dataMaxValue / interval) * interval;

      // Step 3: 生成刻度點，確保不超過5個
      const ticks = [];
      for (let i = 0; i <= chartMaxValue && ticks.length < maxTicks; i += interval) {
        ticks.push(i);
      }

      return {
        ticks: ticks,           // 刻度陣列 [0, 5, 10, 15...]，最多5個
        maxValue: chartMaxValue, // 圖表最大值
        interval: interval       // 刻度間隔
      };
    };

    // 計算刻度系統
    const tickSystem = calculateTickSystem(maxCount);
    const tickValues = tickSystem.ticks;

    // 更新 X 軸比例尺的範圍
    xScale.domain([0, tickSystem.maxValue]);

    g.selectAll('.grid-line')
      .data(tickValues)
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', 'var(--my-color-gray-400)')
      .attr('stroke-dasharray', '2,2')
      .attr('stroke-width', 1);

    // 添加長條
    g.selectAll('.bar')
      .data(districtCount)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', (d, i) => i * barSpacing + (barSpacing - barHeight) / 2)
      .attr('width', d => xScale(d.count))
      .attr('height', barHeight)
      .attr('fill', 'var(--my-color-blue)');

    // 添加數值標籤
    g.selectAll('.label')
      .data(districtCount)
      .enter()
      .append('text')
      .attr('class', 'label my-font-size-xs')
      .attr('x', d => xScale(d.count) + 5)
      .attr('y', (d, i) => i * barSpacing + barSpacing / 2)
      .attr('dy', '0.35em')
      .attr('fill', 'var(--my-color-black)')
      .text(d => d.count);

    // 添加區域名稱標籤
    g.selectAll('.district-label')
      .data(districtCount)
      .enter()
      .append('text')
      .attr('class', 'district-label my-font-size-xs')
      .attr('x', -5)
      .attr('y', (d, i) => i * barSpacing + barSpacing / 2)
      .attr('dy', '0.35em')
      .attr('fill', 'var(--my-color-black)')
      .style('text-anchor', 'end')
      .text(d => d.name);

    // 添加 X 軸數字標籤
    g.selectAll('.x-axis-label')
      .data(tickValues)
      .enter()
      .append('text')
      .attr('class', 'x-axis-label my-font-size-xs')
      .attr('x', d => xScale(d))
      .attr('y', height + 15)
      .attr('fill', 'var(--my-color-gray-600)')
      .style('text-anchor', 'middle')
      .text(d => d);
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
   * 👀 監聽當前圖層摘要變化，更新圖表
   */
  watch(
    () => currentLayerSummary.value,
    (newSummary) => {
      if (newSummary && newSummary.districtCount) {
        nextTick(() => {
          drawHorizontalBarChart(newSummary.districtCount);
        });
      }
    },
    { immediate: true }
  );

  /**
   * 🚀 組件掛載事件 (Component Mounted Event)
   */
  onMounted(() => {
    console.log('[DashboardTab] Component Mounted');

    // 初始化第一個可見圖層為作用中分頁
    if (visibleLayers.value.length > 0 && !activeLayerTab.value) {
      activeLayerTab.value = visibleLayers.value[0].layerId;
    }
  });

  // 監聽窗口大小變化，重新繪製圖表
  const handleResize = () => {
    if (currentLayerSummary.value && currentLayerSummary.value.districtCount) {
      nextTick(() => {
        drawHorizontalBarChart(currentLayerSummary.value.districtCount);
      });
    }
  };

  onMounted(() => {
    window.addEventListener('resize', handleResize);
  });

  // 組件卸載時移除事件監聽
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
  });
</script>

<template>
  <!-- 📊 多圖層資料儀表板視圖組件 -->
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
            <span class="my-title-sm-black">{{ layer.layerName }}</span>
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

    <!-- 有開啟圖層時的內容 -->
    <div v-if="visibleLayers.length > 0" class="flex-grow-1 overflow-auto my-bgcolor-white p-3">
      <!-- 📊 當前圖層資訊 -->
      <div class="mb-4">
        <h5 class="my-title-md-black">{{ currentLayerName }}</h5>
      </div>

      <!-- 📊 圖層摘要資料 -->
      <div v-if="currentLayerSummary">
        <div class="row">
          <!-- 基本統計信息 -->
          <div class="col-12 col-xl-6">
            <div class="rounded-4 my-bgcolor-gray-100 p-4 mb-3">
              <h6 class="mb-3">基本統計</h6>
              <div class="row">
                <div class="col-6">
                  <div class="text-center">
                    <div class="my-title-xl-black">{{ currentLayerSummary.totalCount }}</div>
                    <div class="my-title-sm-gray">總數量</div>
                  </div>
                </div>
                <div class="col-6" v-if="currentLayerSummary.districtCount">
                  <div class="text-center">
                    <div class="my-title-xl-black">{{ currentLayerSummary.districtCount.length }}</div>
                    <div class="my-title-sm-gray">行政區數量</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 行政區分布圖表 -->
          <div class="col-12 col-xl-6" v-if="currentLayerSummary.districtCount && currentLayerSummary.districtCount.length > 0">
            <div class="rounded-4 my-bgcolor-gray-100 p-4 mb-3">
              <h6 class="mb-3">行政區分布</h6>
              <div ref="chartContainer" class="w-100"></div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-5">
        <div class="my-title-md-gray">此圖層沒有可用的摘要資訊</div>
      </div>
    </div>

    <!-- 沒有開啟圖層時的空狀態 -->
    <div v-else class="flex-grow-1 d-flex align-items-center justify-content-center">
      <div class="text-center">
        <div class="my-title-md-gray p-3">沒有開啟的圖層</div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
