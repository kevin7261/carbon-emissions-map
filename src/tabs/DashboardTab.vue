<script setup>
  import { ref, computed, watch, onMounted, nextTick, onUnmounted } from 'vue';
  import { useDataStore } from '@/stores/dataStore.js';
  import { splitFormattedNumberForFractionXs } from '@/utils/numberDisplay.js';
  import { drawCarbonTrendLineChart } from '@/utils/carbonDashboardTrendChart.js';
  import * as d3 from 'd3';
  import DashboardCarbonFacilityGroup from './DashboardCarbonFacilityGroup.vue';

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

  /**
   * 僅「事業」圖層、且兩家以上 事業名稱 時，顯示內層 全部/各廠 分頁。行業分類／年度 與歷層合計一樣不拆廠
   */
  const showCarbonByFacility = computed(() => {
    const l = currentLayer.value;
    const list = currentLayerSummary.value?.carbonByFacilityName;
    if (!l || !l.isCarbonReportBizLayer || !list?.length) return false;
    return list.length > 1;
  });

  const carbonByFacilityNameList = computed(() => {
    if (!showCarbonByFacility.value) return [];
    return currentLayerSummary.value.carbonByFacilityName ?? [];
  });

  /**
   * 有內層分頁（全部／各廠）時：'all' 或 事業的陣列索引
   * @type {import('vue').Ref<'all' | number>}
   */
  const activeCarbonScopeTab = ref('all');

  const setActiveCarbonScopeTab = (scope) => {
    activeCarbonScopeTab.value = scope;
  };

  /**
   * 從字首到第一個「公司」**為止，且含「公司」兩字**；其後之廠名等不顯示。無「公司」則回傳整段 trim 後字串。
   * @param {string} [name]
   * @returns {string}
   */
  const nameThroughFirstGongsi = (name) => {
    const s = String(name ?? '').trim();
    if (!s) return '—';
    const i = s.indexOf('公司');
    if (i < 0) return s;
    return s.slice(0, i + 2);
  };

  /**
   * 內層分頁文字：第一個「公司」**之後**的廠名（與主標題「至公司含兩字」分開，tab 維持廠名寫法）
   */
  const labelAfterGongsi = (facilityName) => {
    const s = String(facilityName ?? '').trim();
    if (!s) return '—';
    const i = s.indexOf('公司');
    if (i < 0) return s;
    const rest = s.slice(i + 2).trim();
    return rest || s;
  };

  const carbonScopeTabItems = computed(() => {
    if (!showCarbonByFacility.value) return [];
    return [
      { key: 'all', label: '全部' },
      ...carbonByFacilityNameList.value.map((f, i) => ({
        key: i,
        label: labelAfterGongsi(f.facilityName),
        title: f.facilityName,
      })),
    ];
  });

  const isCarbonScopeTabActive = (item) => {
    if (item.key === 'all') return activeCarbonScopeTab.value === 'all';
    return activeCarbonScopeTab.value === item.key;
  };

  const onCarbonScopeTabClick = (item) => {
    if (item.key === 'all') setActiveCarbonScopeTab('all');
    else setActiveCarbonScopeTab(item.key);
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
   * 主標題：事業圖層以「事業名稱」截到**含第一處「公司」**；其餘同圖層名
   */
  const dashboardMainTitle = computed(() => {
    const layer = currentLayer.value;
    if (!layer) return currentLayerName.value;
    if (layer.isCarbonReportBizLayer && Array.isArray(layer.tableData) && layer.tableData.length) {
      for (const row of layer.tableData) {
        const full = String(row['事業名稱'] ?? '').trim();
        if (full) return nameThroughFirstGongsi(full);
      }
    }
    return currentLayerName.value;
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


  /** 依目前圖層重繪統計圖 */
  const redrawCharts = () => {
    const summary = currentLayerSummary.value;
    const layer = currentLayer.value;
    const showYearlyTrend =
      (layer?.isCarbonReportBizLayer || layer?.isCarbonReportIndustryLayer) &&
      summary?.yearlyCarbonTrend?.length;
    if (showYearlyTrend) {
      nextTick(() => {
        drawCarbonTrendLineChart(carbonTrendChartRef.value, summary.yearlyCarbonTrend);
        requestAnimationFrame(() => {
          const s = currentLayerSummary.value;
          const l = currentLayer.value;
          const stillTrend =
            (l?.isCarbonReportBizLayer || l?.isCarbonReportIndustryLayer) &&
            s?.yearlyCarbonTrend?.length;
          if (carbonTrendChartRef.value && stillTrend) {
            drawCarbonTrendLineChart(carbonTrendChartRef.value, s.yearlyCarbonTrend);
          }
        });
      });
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
      activeCarbonScopeTab.value = 'all';
      redrawCharts();
    },
    { immediate: true, deep: true }
  );

  watch(activeCarbonScopeTab, () => {
    nextTick(() => redrawCharts());
  });

  /**
   * 🚀 組件掛載事件 (Component Mounted Event)
   */
  // 監聽窗口與圖表容器變化，重新繪製（與左欄滿高 flex 聯動）
  const handleResize = () => {
    redrawCharts();
  };

  let carbonChartResizeObserver = null;
  let chartResizeRaf = null;

  watch(
    () => carbonTrendChartRef.value,
    (chartEl) => {
      if (carbonChartResizeObserver) {
        carbonChartResizeObserver.disconnect();
        carbonChartResizeObserver = null;
      }
      if (chartEl && typeof ResizeObserver !== 'undefined') {
        carbonChartResizeObserver = new ResizeObserver(() => {
          if (chartResizeRaf) cancelAnimationFrame(chartResizeRaf);
          chartResizeRaf = requestAnimationFrame(() => {
            chartResizeRaf = null;
            const s = currentLayerSummary.value;
            if (s?.yearlyCarbonTrend?.length) {
              drawCarbonTrendLineChart(carbonTrendChartRef.value, s.yearlyCarbonTrend);
            }
          });
        });
        carbonChartResizeObserver.observe(chartEl);
      }
    }
  );

  onMounted(() => {
    console.log('[DashboardTab] Component Mounted');
    if (visibleLayers.value.length > 0 && !activeLayerTab.value) {
      activeLayerTab.value = visibleLayers.value[0].layerId;
    }
    window.addEventListener('resize', handleResize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    if (chartResizeRaf) cancelAnimationFrame(chartResizeRaf);
    if (carbonChartResizeObserver) {
      carbonChartResizeObserver.disconnect();
    }
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
        <div class="my-title-xl-black text-break">{{ dashboardMainTitle }}</div>
      </div>

      <!-- 📊 事業／年度碳排圖層儀表板 -->
      <div v-if="showCarbonReportDashboard">
        <div class="row">
          <!-- 多事業時：內層分頁「全部」＋廠名（公司後字；主標題另用至含「公司」） -->
          <div v-if="showCarbonByFacility" class="col-12">
            <div
              class="dashboard-carbon-scope-rail mb-3"
              role="tablist"
              aria-label="合計與各廠"
            >
              <ul class="dashboard-carbon-scope-nav">
                <li
                  v-for="item in carbonScopeTabItems"
                  :key="String(item.key)"
                  class="dashboard-carbon-scope-item"
                >
                  <button
                    type="button"
                    class="dashboard-carbon-scope-tab"
                    :class="{
                      'dashboard-carbon-scope-tab--active': isCarbonScopeTabActive(item),
                      'dashboard-carbon-scope-tab--all': item.key === 'all',
                    }"
                    role="tab"
                    :aria-selected="isCarbonScopeTabActive(item)"
                    :title="item.title"
                    @click="onCarbonScopeTabClick(item)"
                  >
                    <span class="dashboard-carbon-scope-tab__text">{{ item.label }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <!-- 加總（直接／間接／合計）：事業＝全公司表列加總；年度＝該年度表列加總 — 「全部」分頁，或單一面向時直接顯示 -->
          <div
            v-if="
              currentLayerSummary.carbonFacilityTotals &&
              (!showCarbonByFacility || activeCarbonScopeTab === 'all')
            "
            class="col-12"
          >
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

          <!-- 年度趨勢與各年度排放量：「全部」分頁；單一面向且無內層分頁時同左 -->
          <div
            v-if="
              (currentLayer?.isCarbonReportBizLayer ||
                currentLayer?.isCarbonReportIndustryLayer) &&
              currentLayerSummary.yearlyCarbonTrend?.length &&
              (!showCarbonByFacility || activeCarbonScopeTab === 'all')
            "
            class="col-12"
          >
            <div
              class="rounded-4 my-bgcolor-gray-100 p-3 mb-3 d-flex flex-column min-h-0 min-w-0"
            >
              <div
                class="row g-3 g-lg-4 align-items-stretch flex-grow-1 min-h-0"
              >
                <div
                  class="col-12 col-lg-6 d-flex min-h-0 min-w-0 h-lg-100"
                >
                  <div
                    class="d-flex flex-column flex-grow-1 w-100 min-w-0 min-h-0 h-lg-100"
                  >
                    <div class="my-title-sm-black mb-3 flex-shrink-0">年度趨勢</div>
                    <div
                      class="dashboard-carbon-trend-stack d-flex flex-column flex-grow-1 min-h-0 w-100 min-w-0"
                    >
                      <div
                        ref="carbonTrendChartRef"
                        class="dashboard-carbon-trend-chart dashboard-carbon-trend-chart--plot w-100 h-100 flex-grow-1 min-h-0"
                      ></div>
                    </div>
                  </div>
                </div>
                <div
                  class="col-12 col-lg-6 d-flex min-w-0 min-h-0 h-lg-100"
                >
                  <div
                    class="d-flex flex-column flex-grow-1 w-100 h-100 min-h-0"
                  >
                    <div
                      class="my-title-sm-black mb-3 d-flex flex-wrap align-items-baseline gap-2 flex-shrink-0"
                    >
                      <span>各年度排放量</span>
                      <span class="my-content-xs-gray fw-normal">(公噸 CO₂e)</span>
                    </div>
                    <div
                      class="table-responsive rounded-3 overflow-hidden my-bgcolor-white flex-grow-1"
                    >
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

          <!-- 各廠分頁：單一事業一頁 -->
          <div
            v-if="
              showCarbonByFacility &&
              activeCarbonScopeTab !== 'all' &&
              currentLayerSummary.carbonByFacilityName?.[activeCarbonScopeTab]
            "
            class="col-12"
          >
            <DashboardCarbonFacilityGroup
              :key="'sf-' + activeCarbonScopeTab"
              :facility="currentLayerSummary.carbonByFacilityName[activeCarbonScopeTab]"
            />
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
  /* 年度趨勢圖表座標刻度字級僅在 common.css（.dashboard-chart-axis-text），勿在此或 D3 內寫死 fontSize */

  .dashboard-carbon-trend-chart {
    width: 100%;
    min-width: 100%;
  }

  /* 與右欄表格同列等高：佔滿灰底區塊內剩餘高度，供 D3 讀取 clientHeight */
  .dashboard-carbon-trend-chart--plot {
    flex: 1 1 0;
    min-height: 10rem;
    overflow: hidden;
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

  /* 合計 / 各廠：深底、白字 */
  .dashboard-carbon-scope-rail {
    position: relative;
    padding: 0.4rem 0.5rem;
    border: none;
    border-radius: 0.75rem;
    background: var(--my-color-gray-800);
  }

  .dashboard-carbon-scope-nav {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 0.35rem;
    margin: 0;
    padding: 0 0.1rem;
    list-style: none;
  }

  .dashboard-carbon-scope-item {
    flex: 0 0 auto;
    min-width: 0;
    max-width: 14rem;
  }

  .dashboard-carbon-scope-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 2.35rem;
    padding: 0.4rem 0.9rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: rgba(255, 255, 255, 0.88);
    font-size: var(--my-font-size-sm);
    font-weight: var(--my-font-weight-md);
    line-height: 1.3;
    transition: color 0.16s ease, background 0.16s ease;
  }

  .dashboard-carbon-scope-tab:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .dashboard-carbon-scope-tab:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  .dashboard-carbon-scope-tab--all:not(.dashboard-carbon-scope-tab--active) {
    font-weight: var(--my-font-weight-lg);
    color: #fff;
  }

  .dashboard-carbon-scope-tab--active {
    background: var(--my-color-white);
    color: var(--my-color-gray-900);
    font-weight: var(--my-font-weight-lg);
  }

  .dashboard-carbon-scope-tab__text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .dashboard-carbon-scope-tab--active:focus-visible {
    outline-color: var(--my-color-gray-600);
  }
</style>
