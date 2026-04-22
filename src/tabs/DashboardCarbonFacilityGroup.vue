<script setup>
  import { ref, computed, watch, onUnmounted, nextTick } from 'vue';
  import * as d3 from 'd3';
  import { splitFormattedNumberForFractionXs } from '@/utils/numberDisplay.js';
  import { drawCarbonTrendLineChart } from '@/utils/carbonDashboardTrendChart.js';

  const props = defineProps({
    /** @type {{ facilityName: string, carbonFacilityTotals: { direct: number, indirect: number, total: number }, yearlyCarbonTrend: Array }} */
    facility: { type: Object, required: true },
  });

  const plotRef = ref(null);
  let resizeObserver = null;
  let raf = null;

  const formatCarbonTons = (n) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return n.toLocaleString('zh-TW', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  };

  const formatCarbonTonsParts = (n) => splitFormattedNumberForFractionXs(formatCarbonTons(n));

  const formatCarbonTonsYearlyTable = (n) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return n.toLocaleString('zh-TW', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  const formatCarbonTonsPartsYearlyTable = (n) =>
    splitFormattedNumberForFractionXs(formatCarbonTonsYearlyTable(n));

  const displayTotals = computed(() => {
    const t = props.facility.carbonFacilityTotals;
    if (!t) return null;
    return {
      direct: formatCarbonTonsParts(t.direct),
      indirect: formatCarbonTonsParts(t.indirect),
      total: formatCarbonTonsParts(t.total),
    };
  });

  const redraw = () => {
    const t = props.facility.yearlyCarbonTrend;
    if (plotRef.value && t?.length) {
      drawCarbonTrendLineChart(plotRef.value, t);
    } else if (plotRef.value) {
      d3.select(plotRef.value).selectAll('*').remove();
    }
  };

  watch(
    () => props.facility,
    () => {
      nextTick(() => {
        redraw();
        requestAnimationFrame(() => redraw());
      });
    },
    { deep: true, immediate: true }
  );

  watch(
    plotRef,
    (el) => {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (el && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (raf) cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            raf = null;
            redraw();
          });
        });
        resizeObserver.observe(el);
      }
      nextTick(() => {
        requestAnimationFrame(() => redraw());
      });
    },
    { flush: 'post' }
  );

  onUnmounted(() => {
    if (raf) cancelAnimationFrame(raf);
    if (resizeObserver) resizeObserver.disconnect();
  });
</script>

<template>
  <div class="dashboard-carbon-facility-group col-12">
    <div class="my-title-sm-black mb-2">{{ facility.facilityName }}</div>
    <div
      v-if="facility.carbonFacilityTotals"
      class="rounded-4 my-bgcolor-gray-100 p-3 mb-3"
    >
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
                <template v-if="displayTotals?.direct.frac">
                  {{ displayTotals.direct.main
                  }}<small>{{ displayTotals.direct.frac }}</small>
                </template>
                <template v-else>{{ displayTotals?.direct.main }}</template>
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
                <template v-if="displayTotals?.indirect.frac">
                  {{ displayTotals.indirect.main
                  }}<small>{{ displayTotals.indirect.frac }}</small>
                </template>
                <template v-else>{{ displayTotals?.indirect.main }}</template>
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
                <template v-if="displayTotals?.total.frac">
                  {{ displayTotals.total.main
                  }}<small>{{ displayTotals.total.frac }}</small>
                </template>
                <template v-else>{{ displayTotals?.total.main }}</template>
              </span>
            </div>
            <div class="my-content-xs-gray mt-2">合計排放</div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="facility.yearlyCarbonTrend?.length"
      class="rounded-4 my-bgcolor-gray-100 p-3 mb-3 d-flex flex-column min-h-0 min-w-0"
    >
      <div class="row g-3 g-lg-4 align-items-stretch flex-grow-1 min-h-0">
        <div class="col-12 col-lg-6 d-flex min-h-0 min-w-0 h-lg-100">
          <div
            class="d-flex flex-column flex-grow-1 w-100 min-w-0 min-h-0 h-lg-100"
          >
            <div class="my-title-sm-black mb-3 flex-shrink-0">年度趨勢</div>
            <div
              class="dashboard-carbon-trend-stack d-flex flex-column flex-grow-1 min-h-0 w-100 min-w-0"
            >
              <div
                ref="plotRef"
                class="dashboard-carbon-trend-chart dashboard-carbon-trend-chart--plot w-100 h-100 flex-grow-1 min-h-0"
              ></div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-6 d-flex min-w-0 min-h-0 h-lg-100">
          <div class="d-flex flex-column flex-grow-1 w-100 h-100 min-h-0">
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
                    v-for="row in facility.yearlyCarbonTrend"
                    :key="row.year + facility.facilityName"
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
</template>

<style scoped>
  .dashboard-carbon-trend-chart {
    width: 100%;
    min-width: 100%;
  }

  .dashboard-carbon-trend-chart--plot {
    flex: 1 1 0;
    min-height: 10rem;
    overflow: hidden;
  }

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
