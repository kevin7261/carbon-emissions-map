<script setup>
  import { ref, computed, watch, onMounted, nextTick, onUnmounted } from 'vue';
  import { useDataStore } from '@/stores/dataStore.js';
  import { splitFormattedNumberForFractionXs } from '@/utils/numberDisplay.js';
  import * as d3 from 'd3';

  const dataStore = useDataStore();

  const activeLayerTab = ref(null); /** 📑 當前作用中的圖層分頁 */
  const carbonTrendChartRef = ref(null); /** 📊 事業年度碳排折線圖 */
  /** 折線圖 hover：數值顯示於圖例欄（與圖例同 my-content-xs-gray） */
  const carbonTrendHoverRow = ref(null);

  const currentLayer = computed(() => {
    if (!activeLayerTab.value) return null;
    return visibleLayers.value.find((l) => l.layerId === activeLayerTab.value) ?? null;
  });

  /** 公噸 CO2e 顯示（與資料表慣例一致） */
  const formatCarbonTons = (n) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return n.toLocaleString('zh-TW', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  };

  /**
   * Dashboard 數字：小數點後用 xs 字級（frac 含「.」與小數位）
   * @returns {{ main: string, frac: string | null }}
   */
  const formatCarbonTonsParts = (n) => splitFormattedNumberForFractionXs(formatCarbonTons(n));

  /** 各年度排放量表：固定小數後四位 */
  const formatCarbonTonsYearlyTable = (n) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return n.toLocaleString('zh-TW', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  const formatCarbonTonsPartsYearlyTable = (n) =>
    splitFormattedNumberForFractionXs(formatCarbonTonsYearlyTable(n));

  /** 排放量三卡數字（拆主數字／小數，供 template 使用） */
  const carbonFacilityDisplayTotals = computed(() => {
    const t = currentLayerSummary.value?.carbonFacilityTotals;
    if (!t) return null;
    return {
      direct: formatCarbonTonsParts(t.direct),
      indirect: formatCarbonTonsParts(t.indirect),
      total: formatCarbonTonsParts(t.total),
    };
  });

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

  /** 事業或年度碳排圖層：顯示與資料表一致之加總；事業另顯多年度趨勢折線 */
  const showCarbonReportDashboard = computed(() => {
    const l = currentLayer.value;
    const s = currentLayerSummary.value;
    return !!(
      l &&
      (l.isCarbonReportBizLayer || l.isCarbonReportYearLayer || l.isCarbonReportIndustryLayer) &&
      s
    );
  });

  /**
   * 直接／間接／合計排放量之年度趨勢（多序列折線）
   * @param {Array<{ year: string, direct: number, indirect: number, total: number }>} trend
   */
  const measureCarbonTrendChartWidth = (el) => {
    let w = el.clientWidth;
    if (w <= 0) w = el.getBoundingClientRect().width;
    if (w <= 0 && el.parentElement) w = el.parentElement.clientWidth;
    return w > 0 ? w : 800;
  };

  const drawCarbonTrendLineChart = (trend) => {
    carbonTrendHoverRow.value = null;
    if (!carbonTrendChartRef.value || !trend || trend.length === 0) {
      return;
    }

    d3.select(carbonTrendChartRef.value).selectAll('*').remove();

    const margin = { top: 8, right: 12, bottom: 28, left: 48 };
    const el = carbonTrendChartRef.value;
    const baseW = measureCarbonTrendChartWidth(el);
    const width = Math.max(120, baseW - margin.left - margin.right);
    const height = 150;
    const totalH = height + margin.top + margin.bottom;
    const years = trend.map((d) => String(d.year));

    const maxVal = d3.max(trend, (d) => Math.max(d.direct || 0, d.indirect || 0, d.total || 0)) || 0;
    const yMax = maxVal <= 0 ? 1 : maxVal * 1.05;

    const svg = d3
      .select(el)
      .append('svg')
      .attr('viewBox', `0 0 ${baseW} ${totalH}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('width', '100%')
      .style('display', 'block')
      .style('max-width', '100%');

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
      .attr('class', 'dashboard-chart-axis-text')
      .attr('x', (y) => xScale(y))
      .attr('y', 0)
      .attr('dy', '1.05em')
      .attr('text-anchor', 'middle')
      .text((y) => `${y}年`);

    g.append('g')
      .selectAll('text-y')
      .data(yScale.ticks(5))
      .enter()
      .append('text')
      .attr('class', 'dashboard-chart-axis-text')
      .attr('x', -8)
      .attr('y', (d) => yScale(d))
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text((d) => (d === 0 ? '0' : d3.format('.2s')(d)));

    const focus = g
      .append('g')
      .attr('class', 'dashboard-chart-focus')
      .style('opacity', 0)
      .style('pointer-events', 'none');

    const hoverLine = focus
      .append('line')
      .attr('class', 'dashboard-chart-hover-line')
      .attr('y1', 0)
      .attr('y2', height);

    const focusDots = series.map((s) =>
      focus
        .append('circle')
        .attr('class', 'dashboard-chart-focus-dot')
        .attr('r', 2.5)
        .attr('fill', '#fff')
        .attr('stroke', s.color)
        .attr('stroke-width', 1.5)
    );

    /** 繪圖區寬度均分：每個年度佔相同 hover 帶寬，垂線仍對齊該年度資料點 */
    const yearFromMxEqualBands = (mx) => {
      if (!years.length) return years[0];
      const w = Math.max(1e-6, width);
      const clamped = Math.max(0, Math.min(w, mx));
      const idx = Math.min(years.length - 1, Math.floor((clamped / w) * years.length));
      return years[idx];
    };

    const showHover = (yearStr) => {
      const row = trend.find((t) => String(t.year) === yearStr);
      if (!row) return;
      const lx = xScale(yearStr);
      hoverLine.attr('x1', lx).attr('x2', lx);

      const cys = series.map((s) => yScale(row[s.key] ?? 0));
      series.forEach((s, i) => {
        focusDots[i].attr('cx', lx).attr('cy', cys[i]);
      });

      carbonTrendHoverRow.value = {
        year: yearStr,
        direct: row.direct,
        indirect: row.indirect,
        total: row.total,
      };

      focus.style('opacity', 1);
    };

    g.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event, this);
        showHover(yearFromMxEqualBands(mx));
      })
      .on('mouseleave', () => {
        focus.style('opacity', 0);
        carbonTrendHoverRow.value = null;
      });
  };

  /** 依目前圖層重繪統計圖 */
  const redrawCharts = () => {
    const summary = currentLayerSummary.value;
    const layer = currentLayer.value;
    const showYearlyTrend =
      (layer?.isCarbonReportBizLayer || layer?.isCarbonReportIndustryLayer) &&
      summary?.yearlyCarbonTrend?.length;
    if (showYearlyTrend) {
      nextTick(() => {
        drawCarbonTrendLineChart(summary.yearlyCarbonTrend);
        requestAnimationFrame(() => {
          const s = currentLayerSummary.value;
          const l = currentLayer.value;
          const stillTrend =
            (l?.isCarbonReportBizLayer || l?.isCarbonReportIndustryLayer) &&
            s?.yearlyCarbonTrend?.length;
          if (carbonTrendChartRef.value && stillTrend) {
            drawCarbonTrendLineChart(s.yearlyCarbonTrend);
          }
        });
      });
    } else if (carbonTrendChartRef.value) {
      d3.select(carbonTrendChartRef.value).selectAll('*').remove();
      carbonTrendHoverRow.value = null;
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
            <span class="my-content-sm-black fw-medium">{{ layer.layerName }}</span>
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
      <div class="mb-3">
        <div class="my-title-xl-black">{{ currentLayerName }}</div>
      </div>

      <!-- 📊 事業／年度碳排圖層儀表板 -->
      <div v-if="showCarbonReportDashboard">
        <div class="row">
          <!-- 加總（直接／間接／合計）：事業＝全公司表列加總；年度＝該年度表列加總 -->
          <div v-if="currentLayerSummary.carbonFacilityTotals" class="col-12">
            <div class="rounded-4 my-bgcolor-gray-100 p-3 mb-3">
              <div class="my-title-sm-black mb-3 d-flex flex-wrap align-items-baseline gap-2">
                <span>排放量</span>
                <span class="my-content-xs-gray fw-normal">(公噸 CO₂e)</span>
              </div>
              <div class="row g-3">
                <div class="col-md-4">
                  <div
                    class="text-center rounded-3 my-bgcolor-white px-3 py-3 dashboard-carbon-total-card dashboard-carbon-total-card--direct"
                  >
                    <div
                      class="d-flex align-items-baseline justify-content-center gap-1 flex-wrap text-break mw-100 min-w-0"
                    >
                      <span class="dashboard-carbon-total-figure">
                        <template v-if="carbonFacilityDisplayTotals?.direct.frac">
                          {{ carbonFacilityDisplayTotals.direct.main
                          }}<small>{{
                            carbonFacilityDisplayTotals.direct.frac
                          }}</small>
                        </template>
                        <template v-else>{{ carbonFacilityDisplayTotals?.direct.main }}</template>
                      </span>
                    </div>
                    <div class="my-content-xs-gray mt-2">直接排放</div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div
                    class="text-center rounded-3 my-bgcolor-white px-3 py-3 dashboard-carbon-total-card dashboard-carbon-total-card--indirect"
                  >
                    <div
                      class="d-flex align-items-baseline justify-content-center gap-1 flex-wrap text-break mw-100 min-w-0"
                    >
                      <span class="dashboard-carbon-total-figure">
                        <template v-if="carbonFacilityDisplayTotals?.indirect.frac">
                          {{ carbonFacilityDisplayTotals.indirect.main
                          }}<small>{{
                            carbonFacilityDisplayTotals.indirect.frac
                          }}</small>
                        </template>
                        <template v-else>{{ carbonFacilityDisplayTotals?.indirect.main }}</template>
                      </span>
                    </div>
                    <div class="my-content-xs-gray mt-2">能源間接排放</div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div
                    class="text-center rounded-3 my-bgcolor-white px-3 py-3 dashboard-carbon-total-card dashboard-carbon-total-card--combined"
                  >
                    <div
                      class="d-flex align-items-baseline justify-content-center gap-1 flex-wrap text-break mw-100 min-w-0"
                    >
                      <span class="dashboard-carbon-total-figure">
                        <template v-if="carbonFacilityDisplayTotals?.total.frac">
                          {{ carbonFacilityDisplayTotals.total.main
                          }}<small>{{
                            carbonFacilityDisplayTotals.total.frac
                          }}</small>
                        </template>
                        <template v-else>{{ carbonFacilityDisplayTotals?.total.main }}</template>
                      </span>
                    </div>
                    <div class="my-content-xs-gray mt-2">合計排放</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 年度趨勢（事業：該統編多年度；行業分類：該行業彙總多年度） -->
          <div
            v-if="
              (currentLayer?.isCarbonReportBizLayer ||
                currentLayer?.isCarbonReportIndustryLayer) &&
              currentLayerSummary.yearlyCarbonTrend?.length
            "
            class="col-12"
          >
            <div class="rounded-4 my-bgcolor-gray-100 p-3 mb-3">
              <div class="my-title-sm-black mb-3">年度趨勢</div>
              <div class="dashboard-carbon-trend-stack d-flex flex-column gap-2">
                <div ref="carbonTrendChartRef" class="dashboard-carbon-trend-chart w-100"></div>
                <div
                  class="dashboard-carbon-trend-legend-panel rounded-3 my-bgcolor-white px-3 py-2"
                >
                  <div
                    class="d-flex flex-wrap align-items-center justify-content-center gap-2 gap-md-3 my-content-xs-gray"
                  >
                    <div v-if="carbonTrendHoverRow" class="text-nowrap flex-shrink-0">
                      {{ carbonTrendHoverRow.year }}年
                    </div>
                    <div
                      class="d-flex flex-wrap align-items-baseline justify-content-center gap-2 gap-md-3"
                    >
                      <span class="d-inline-flex align-items-center gap-2 text-nowrap">
                        <span
                          class="dashboard-carbon-legend-line flex-shrink-0"
                          style="background: var(--my-color-green)"
                        ></span>
                        <span>直接</span>
                        <template v-if="carbonTrendHoverRow">
                          <span class="tabular-nums">
                            <template
                              v-for="p in [formatCarbonTonsParts(carbonTrendHoverRow.direct)]"
                              :key="'h-d-' + p.main + (p.frac ?? '')"
                            >
                              <template v-if="p.frac"
                                >{{ p.main }}<small>{{ p.frac }}</small></template
                              >
                              <template v-else>{{ p.main }}</template>
                            </template>
                          </span>
                          <span class="fw-normal">公噸 CO₂e</span>
                        </template>
                      </span>
                      <span class="d-inline-flex align-items-center gap-2 text-nowrap">
                        <span
                          class="dashboard-carbon-legend-line flex-shrink-0"
                          style="background: var(--my-color-blue)"
                        ></span>
                        <span>能源間接</span>
                        <template v-if="carbonTrendHoverRow">
                          <span class="tabular-nums">
                            <template
                              v-for="p in [formatCarbonTonsParts(carbonTrendHoverRow.indirect)]"
                              :key="'h-i-' + p.main + (p.frac ?? '')"
                            >
                              <template v-if="p.frac"
                                >{{ p.main }}<small>{{ p.frac }}</small></template
                              >
                              <template v-else>{{ p.main }}</template>
                            </template>
                          </span>
                          <span class="fw-normal">公噸 CO₂e</span>
                        </template>
                      </span>
                      <span class="d-inline-flex align-items-center gap-2 text-nowrap">
                        <span
                          class="dashboard-carbon-legend-line flex-shrink-0"
                          style="background: var(--my-color-orange)"
                        ></span>
                        <span>合計</span>
                        <template v-if="carbonTrendHoverRow">
                          <span class="tabular-nums">
                            <template
                              v-for="p in [formatCarbonTonsParts(carbonTrendHoverRow.total)]"
                              :key="'h-t-' + p.main + (p.frac ?? '')"
                            >
                              <template v-if="p.frac"
                                >{{ p.main }}<small>{{ p.frac }}</small></template
                              >
                              <template v-else>{{ p.main }}</template>
                            </template>
                          </span>
                          <span class="fw-normal">公噸 CO₂e</span>
                        </template>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-4 pt-3 border-top border-secondary border-opacity-25">
                <div class="my-title-sm-black mb-3 d-flex flex-wrap align-items-baseline gap-2">
                  <span>各年度排放量</span>
                  <span class="my-content-xs-gray fw-normal">(公噸 CO₂e)</span>
                </div>
                <div class="table-responsive rounded-3 overflow-hidden my-bgcolor-white">
                  <table class="table table-sm mb-0 dashboard-yearly-emissions-table">
                    <thead>
                      <tr class="my-content-xs-gray">
                        <th class="text-start ps-3 py-2 fw-normal border-0">年度</th>
                        <th class="text-end py-2 fw-normal border-0">直接</th>
                        <th class="text-end py-2 fw-normal border-0">能源間接</th>
                        <th class="text-end pe-3 py-2 fw-normal border-0">合計</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in currentLayerSummary.yearlyCarbonTrend"
                        :key="row.year"
                        class="border-bottom border-secondary border-opacity-10"
                      >
                        <td class="text-start ps-3 py-2 align-middle my-content-sm-black">
                          {{ row.year }}
                        </td>
                        <td
                          class="text-end py-2 align-middle dashboard-yearly-num dashboard-yearly-num--direct"
                        >
                          <template
                            v-for="p in [formatCarbonTonsPartsYearlyTable(row.direct)]"
                            :key="row.year + 'd' + p.main + (p.frac ?? '')"
                          >
                            <template v-if="p.frac"
                              >{{ p.main }}<small>{{ p.frac }}</small></template
                            >
                            <template v-else>{{ p.main }}</template>
                          </template>
                        </td>
                        <td
                          class="text-end py-2 align-middle dashboard-yearly-num dashboard-yearly-num--indirect"
                        >
                          <template
                            v-for="p in [formatCarbonTonsPartsYearlyTable(row.indirect)]"
                            :key="row.year + 'i' + p.main + (p.frac ?? '')"
                          >
                            <template v-if="p.frac"
                              >{{ p.main }}<small>{{ p.frac }}</small></template
                            >
                            <template v-else>{{ p.main }}</template>
                          </template>
                        </td>
                        <td
                          class="text-end pe-3 py-2 align-middle dashboard-yearly-num dashboard-yearly-num--total"
                        >
                          <template
                            v-for="p in [formatCarbonTonsPartsYearlyTable(row.total)]"
                            :key="row.year + 't' + p.main + (p.frac ?? '')"
                          >
                            <template v-if="p.frac"
                              >{{ p.main }}<small>{{ p.frac }}</small></template
                            >
                            <template v-else>{{ p.main }}</template>
                          </template>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-5">
        <div class="my-title-sm-gray">此圖層沒有可用的摘要資訊</div>
      </div>
    </div>

    <!-- 沒有開啟圖層時的空狀態 -->
    <div v-else class="flex-grow-1 d-flex align-items-center justify-content-center">
      <div class="text-center">
        <div class="my-title-sm-gray p-3">沒有開啟的圖層</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* 刻度樣式見 common.css：與圖例同 --my-font-size-xs */

  :deep(svg .dashboard-chart-hover-line) {
    stroke: var(--my-color-gray-500);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }

  .dashboard-carbon-trend-chart {
    width: 100%;
    min-width: 100%;
  }

  .dashboard-carbon-trend-legend-panel {
    border: 1px solid var(--my-color-gray-200);
  }

  .dashboard-carbon-legend-line {
    display: inline-block;
    width: 20px;
    height: 3px;
    border-radius: 1px;
  }

  /* 「排放量」三欄與「年度趨勢」折線：直接綠、能源間接藍、合計橘 */
  .dashboard-carbon-total-figure {
    font-size: var(--my-font-size-2xl);
    font-weight: var(--my-font-weight-xl);
    line-height: 1.25;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .dashboard-carbon-total-card--direct .dashboard-carbon-total-figure {
    color: var(--my-color-green);
  }

  .dashboard-carbon-total-card--indirect .dashboard-carbon-total-figure {
    color: var(--my-color-blue);
  }

  .dashboard-carbon-total-card--combined .dashboard-carbon-total-figure {
    color: var(--my-color-orange);
  }

  /* 數字欄有 color 時，表格線若用 currentColor 會變成綠／藍／橘／黑線，改為固定灰 */
  .dashboard-yearly-emissions-table :is(th, td) {
    border-color: var(--my-color-gray-200) !important;
  }

  .dashboard-yearly-emissions-table tbody tr:last-child :is(th, td) {
    border-bottom: 0 !important;
  }

  .dashboard-yearly-num {
    font-size: var(--my-font-size-sm);
    font-variant-numeric: tabular-nums;
    font-weight: var(--my-font-weight-lg);
  }

  .dashboard-yearly-num--direct {
    color: var(--my-color-green);
  }

  .dashboard-yearly-num--indirect {
    color: var(--my-color-blue);
  }

  .dashboard-yearly-num--total {
    color: var(--my-color-orange);
  }
</style>
