<script>
  import { computed, ref } from 'vue';
  import { useDataStore } from '@/stores/dataStore.js';
  import { truncateCompanyNameForLayerDisplay } from '@/utils/dataProcessor.js';
  import { getIcon } from '../utils/utils.js';

  export default {
    name: 'LayersTab',

    /**
     * 🔧 組件設定函數 (Component Setup)
     * 使用 Composition API 設定組件邏輯
     */
    setup() {
      // 📦 取得 Pinia 數據存儲實例
      const dataStore = useDataStore();

      // 建立一個 ref 來引用模板中的圖層列表 DOM 元素
      const layerListRef = ref(null);

      // 建立一個計算屬性，從 store 中獲取圖層數據。當 store 的 state 改變時，這裡會自動更新。
      const layers = computed(() => dataStore.layers);

      /**
       * 🔘 切換圖層可見性
       * 呼叫 store 中的 action 來切換指定圖層的顯示/隱藏狀態
       * @param {string} layerId - 要切換的圖層 ID
       */
      const toggleLayer = (layerId) => {
        console.log('🔘 LayersTab: 切換圖層', layerId);
        dataStore.toggleLayerVisibility(layerId);
      };

      /** 「事業」群組：依輸入篩選（事業統編或圖層名稱／事業名稱子字串）；空白則顯示全部 */
      const businessLayerSearch = ref('');

      const layerMatchesBusinessGroupFilter = (layer) => {
        const q = businessLayerSearch.value.trim();
        if (!q) return true;
        const id = layer.filterBizId != null ? String(layer.filterBizId) : '';
        if (id.includes(q)) return true;
        const nm = layer.layerName != null ? String(layer.layerName) : '';
        return nm.includes(q);
      };

      const panelLayersForGroup = (group) => {
        const base = (group.groupLayers || []).filter((l) => l.showInLayerPanel !== false);
        if (group.groupName !== '事業') return base;
        return base.filter(layerMatchesBusinessGroupFilter);
      };

      const toggleAllInGroup = (groupName) => {
        if (groupName === '事業') {
          const q = businessLayerSearch.value.trim();
          const layerPredicate =
            q === '' ? undefined : (l) => layerMatchesBusinessGroupFilter(l);
          dataStore.toggleAllLayersInGroup(groupName, { layerPredicate });
          return;
        }
        dataStore.toggleAllLayersInGroup(groupName);
      };

      /** 圖層面板目前列出的圖層數（「事業」群組會依篩選變動） */
      const groupPanelLayerCount = (group) => panelLayersForGroup(group).length;

      const groupAllLayersOn = (group) => {
        const panel = panelLayersForGroup(group);
        return panel.length > 0 && panel.every((l) => l.visible);
      };

      // 📤 將需要暴露給 <template> 使用的數據和方法返回
      return {
        layers,
        toggleLayer,
        toggleAllInGroup,
        groupAllLayersOn,
        groupPanelLayerCount,
        panelLayersForGroup,
        businessLayerSearch,
        layerListRef,
        getIcon,
        truncateCompanyNameForLayerDisplay,
      };
    },
  };
</script>

<template>
  <div class="h-100 d-flex flex-column overflow-hidden my-bgcolor-gray-100">
    <div class="flex-grow-1 overflow-auto layer-list-container" ref="layerListRef">
      <div class="mb-3">
        <div
          v-for="group in layers"
          v-show="group.showInLayerPanel !== false"
          :key="group.groupName"
          class="p-3"
        >
          <div class="d-flex align-items-center justify-content-between gap-2 pb-2">
            <div class="my-title-xs-gray">
              <template
                v-if="group.groupName === '年份' || group.groupName === '事業'"
              >
                {{ group.groupName }}（{{ groupPanelLayerCount(group) }}）
              </template>
              <template v-else>{{ group.groupName }}</template>
            </div>
            <div
              v-if="
                (group.groupName === '年份' || group.groupName === '事業') &&
                panelLayersForGroup(group).length > 0
              "
              class="d-flex align-items-center justify-content-center flex-shrink-0"
              :title="groupAllLayersOn(group) ? '關閉此分組所有圖層' : '開啟此分組所有圖層'"
            >
              <input
                type="checkbox"
                :id="'switch-group-' + group.groupName"
                :checked="groupAllLayersOn(group)"
                :disabled="panelLayersForGroup(group).some((l) => l.isLoading)"
                @change="toggleAllInGroup(group.groupName)"
              />
              <label :for="'switch-group-' + group.groupName"></label>
            </div>
          </div>

          <div v-if="group.groupName === '事業'" class="pb-2">
            <input
              v-model="businessLayerSearch"
              type="text"
              class="form-control form-control-sm"
              placeholder="篩選統編或事業名稱…"
              autocomplete="off"
              @click.stop
            />
          </div>

          <div
            v-for="layer in panelLayersForGroup(group)"
            :key="layer.layerId"
            class="mb-1"
          >
            <!-- 圖層卡片 -->
            <div
              class="btn rounded-0 border-0 d-flex shadow-sm my-bgcolor-white-hover p-0"
              @click="toggleLayer(layer.layerId)"
            >
              <!-- 圖層圖示 -->
              <div
                class="d-flex"
                :class="layer.layerColor ? undefined : `my-bgcolor-${layer.colorName}`"
                :style="
                  layer.layerColor
                    ? { minWidth: '6px', backgroundColor: layer.layerColor }
                    : { minWidth: '6px' }
                "
              ></div>
              <div class="w-100">
                <div class="d-flex">
                  <!-- 圖層名稱 -->
                  <div class="d-flex align-items-center text-start w-100 px-3 py-2">
                    <span class="my-content-sm-black">
                      {{ truncateCompanyNameForLayerDisplay(layer.layerName) }}
                      <span class="my-content-xs-gray ms-2">
                        {{ layer.summaryData?.totalCount }}
                      </span>
                    </span>
                  </div>
                  <!-- 切換圖層可見性 -->
                  <div class="d-flex align-items-center justify-content-center px-3 py-2">
                    <input
                      type="checkbox"
                      :id="'switch-' + layer.layerId"
                      :checked="layer.visible"
                      :disabled="layer.isLoading"
                      @change="toggleLayer(layer.layerId)"
                    />
                    <label :for="'switch-' + layer.layerId"></label>
                  </div>
                </div>
                <div v-if="layer.legendData && layer.visible" class="px-3 pb-2">
                  <div
                    v-for="data in layer.legendData"
                    :key="data.color"
                    class="d-flex align-items-center"
                  >
                    <div
                      style="min-width: 6px; min-height: 18px"
                      :style="{
                        backgroundColor: data.color,
                      }"
                    ></div>
                    <div class="my-content-xs-black text-nowrap ms-2">{{ data.label }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* 🎨 圖層切換開關樣式 (Layer Toggle Switch Styles) */
  /* https://www.tpisoftware.com/tpu/articleDetails/2744 */

  input[type='checkbox'] {
    height: 0;
    width: 0;
    visibility: hidden;
  }

  label {
    cursor: pointer;
    width: 28px;
    height: 16px;
    background: var(--my-color-gray-300);
    display: block;
    border-radius: 16px;
    position: relative;
    transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1); /* 優化背景色過渡 */
  }

  label:after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    background: var(--my-color-white);
    border-radius: 12px;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); /* 優化滑動過渡 */
  }

  input:checked + label {
    background: var(--my-color-green);
  }

  input:checked + label:after {
    transform: translateX(12px);
  }
</style>
