<script setup>
  import { ref, computed, watch, onMounted, nextTick, onUnmounted } from 'vue';
  import { useDataStore } from '@/stores/dataStore.js';
  import * as d3 from 'd3';

  const dataStore = useDataStore();

  const activeLayerTab = ref(null); /** 📑 當前作用中的圖層分頁 */
  const carbonTrendChartRef = ref(null); /** 📊 事業年度碳排折線圖 */

  const currentLayer = computed(() => {
    if (!activeLayerTab.value) return null;
    return visibleLayers.value.find((l) => l.layerId === activeLayerTab.value) ?? null;
  });

  /** 公噸 CO2e 顯示（與資料表慣例一致） */
  const formatCarbonTons = (n) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return n.toLocaleString('zh-TW', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  };

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
   * 事業圖層：直接／間接／合計排放量之年度趨勢（多序列折線）
   * @param {Array<{ year: string, direct: number, indirect: number, total: number }>} trend
   */
  const drawCarbonTrendLineChart = (trend) => {
    if (!carbonTrendChartRef.value || !trend || trend.length === 0) {
      return;
    }

    d3.select(carbonTrendChartRef.value).selectAll('*').remove();

    const margin = { top: 12, right: 24, bottom: 36, left: 56 };
    const containerWidth = carbonTrendChartRef.value.clientWidth;
    const baseW = containerWidth > 0 ? containerWidth : 320;
    const width = baseW - margin.left - margin.right;
    const height = 220;
    const years = trend.map((d) => String(d.year));

    const maxVal = d3.max(trend, (d) => Math.max(d.direct || 0, d.indirect || 0, d.total || 0)) || 0;
    const yMax = maxVal <= 0 ? 1 : maxVal * 1.05;

    const svg = d3
      .select(carbonTrendChartRef.value)
      .append('svg')
      .attr('width', baseW)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scalePoint()
      .domain(years)
      .range([0, width])
      .padding(0.5);

    const yScale = d3.scaleLinear().domain([0, yMax]).range([height, 0]);

    const line = (key) =>
      d3
        .line()
        .x((d) => xScale(String(d.year)))
        .y((d) => yScale(d[key] ?? 0))
        .curve(d3.curveMonotoneX);

    const series = [
      { key: 'direct', label: '直接', color: 'var(--my-color-green)' },
      { key: 'indirect', label: '能源間接', color: 'var(--my-color-blue)' },
      { key: 'total', label: '合計', color: 'var(--my-color-orange)' },
    ];

    g.append('g')
      .attr('class', 'y-axis-grid')
      .selectAll('line')
      .data(yScale.ticks(5))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'var(--my-color-gray-300, #dee2e6)')
      .attr('stroke-dasharray', '2,2');

    series.forEach((s) => {
      g.append('path')
        .datum(trend)
        .attr('fill', 'none')
        .attr('stroke', s.color)
        .attr('stroke-width', 2)
        .attr('d', line(s.key));
    });

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .selectAll('text')
      .data(years)
      .enter()
      .append('text')
      .attr('class', 'my-font-size-xs')
      .attr('x', (y) => xScale(y))
      .attr('y', 0)
      .attr('dy', '1.1em')
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--my-color-gray-600)')
      .text((y) => `${y}年`);

    g.append('g')
      .selectAll('text-y')
      .data(yScale.ticks(5))
      .enter()
      .append('text')
      .attr('class', 'my-font-size-xs')
      .attr('x', -8)
      .attr('y', (d) => yScale(d))
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('fill', 'var(--my-color-gray-600)')
      .text((d) => d3.format('.2s')(d));
  };

  /** 依目前圖層重繪統計圖 */
  const redrawCharts = () => {
    const summary = currentLayerSummary.value;
    const layer = currentLayer.value;
    if (layer?.isCarbonReportBizLayer && summary?.yearlyCarbonTrend?.length) {
      nextTick(() => drawCarbonTrendLineChart(summary.yearlyCarbonTrend));
    } else if (carbonTrendChartRef.value) {
      d3.select(carbonTrendChartRef.value).selectAll('*').remove();
    }
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
    [() => currentLayerSummary.value, () => currentLayer.value?.layerId],
    () => {
      redrawCharts();
    },
    { immediate: true, deep: true }
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
    redrawCharts();
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

      <!-- 📊 事業圖層儀表板（僅事業碳排圖層有內容） -->
      <div v-if="currentLayer?.isCarbonReportBizLayer && currentLayerSummary">
        <div class="row">
          <!-- 事業圖層：全公司各工廠加總（直接／間接／合計） -->
          <div
            v-if="currentLayer?.isCarbonReportBizLayer && currentLayerSummary.carbonFacilityTotals"
            class="col-12"
          >
            <div class="rounded-4 my-bgcolor-gray-100 p-4 mb-3">
              <h6 class="mb-3">全公司工廠碳排加總</h6>
              <div class="row g-3">
                <div class="col-md-4">
                  <div
                    class="text-center rounded-3 my-bgcolor-white px-3 py-3 dashboard-carbon-total-card dashboard-carbon-total-card--direct"
                  >
                    <div
                      class="d-flex flex-wrap align-items-baseline justify-content-center gap-1 text-break"
                    >
                      <span class="dashboard-carbon-total-figure">{{
                        formatCarbonTons(currentLayerSummary.carbonFacilityTotals.direct)
                      }}</span>
                      <span class="dashboard-carbon-total-unit text-nowrap">公噸 CO₂e</span>
                    </div>
                    <div class="my-content-sm-gray mt-1">直接排放</div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div
                    class="text-center rounded-3 my-bgcolor-white px-3 py-3 dashboard-carbon-total-card dashboard-carbon-total-card--indirect"
                  >
                    <div
                      class="d-flex flex-wrap align-items-baseline justify-content-center gap-1 text-break"
                    >
                      <span class="dashboard-carbon-total-figure">{{
                        formatCarbonTons(currentLayerSummary.carbonFacilityTotals.indirect)
                      }}</span>
                      <span class="dashboard-carbon-total-unit text-nowrap">公噸 CO₂e</span>
                    </div>
                    <div class="my-content-sm-gray mt-1">能源間接排放</div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div
                    class="text-center rounded-3 my-bgcolor-white px-3 py-3 dashboard-carbon-total-card dashboard-carbon-total-card--combined"
                  >
                    <div
                      class="d-flex flex-wrap align-items-baseline justify-content-center gap-1 text-break"
                    >
                      <span class="dashboard-carbon-total-figure">{{
                        formatCarbonTons(currentLayerSummary.carbonFacilityTotals.total)
                      }}</span>
                      <span class="dashboard-carbon-total-unit text-nowrap">公噸 CO₂e</span>
                    </div>
                    <div class="my-content-sm-gray mt-1">合計排放</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 事業圖層：年度趨勢 -->
          <div
            v-if="currentLayer?.isCarbonReportBizLayer && currentLayerSummary.yearlyCarbonTrend?.length"
            class="col-12"
          >
            <div class="rounded-4 my-bgcolor-gray-100 p-4 mb-3">
              <h6 class="mb-3">碳排年度趨勢</h6>
              <div class="d-flex flex-wrap gap-3 mb-2 my-content-xs-black">
                <span class="d-inline-flex align-items-center gap-1">
                  <span class="dashboard-carbon-legend-line" style="background: var(--my-color-green)"></span>
                  直接
                </span>
                <span class="d-inline-flex align-items-center gap-1">
                  <span class="dashboard-carbon-legend-line" style="background: var(--my-color-blue)"></span>
                  能源間接
                </span>
                <span class="d-inline-flex align-items-center gap-1">
                  <span class="dashboard-carbon-legend-line" style="background: var(--my-color-orange)"></span>
                  合計
                </span>
              </div>
              <div ref="carbonTrendChartRef" class="w-100"></div>
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

<style scoped>
  .dashboard-carbon-legend-line {
    display: inline-block;
    width: 20px;
    height: 3px;
    border-radius: 1px;
  }

  /* 與「碳排年度趨勢」折線：直接綠、能源間接藍、合計橘 */
  .dashboard-carbon-total-figure {
    font-size: var(--my-font-size-lg);
    font-weight: var(--my-font-weight-xl);
  }

  .dashboard-carbon-total-unit {
    font-size: var(--my-font-size-xs);
  }

  .dashboard-carbon-total-card--direct .dashboard-carbon-total-figure,
  .dashboard-carbon-total-card--direct .dashboard-carbon-total-unit {
    color: var(--my-color-green);
  }

  .dashboard-carbon-total-card--indirect .dashboard-carbon-total-figure,
  .dashboard-carbon-total-card--indirect .dashboard-carbon-total-unit {
    color: var(--my-color-blue);
  }

  .dashboard-carbon-total-card--combined .dashboard-carbon-total-figure,
  .dashboard-carbon-total-card--combined .dashboard-carbon-total-unit {
    color: var(--my-color-orange);
  }
</style>
