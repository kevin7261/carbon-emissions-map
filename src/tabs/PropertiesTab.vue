<script>
  import DetailItem from '../components/DetailItem.vue';
  import { useDataStore } from '../stores/dataStore';
  import { computed } from 'vue';

  export default {
    name: 'PropertiesTab',

    /**
     * 🧩 組件註冊 (Component Registration)
     * 註冊物件屬性分頁內使用的子組件
     */
    components: {
      DetailItem, // 詳細資訊項目組件
    },

    /**
     * 🔧 組件設定函數 (Component Setup)
     * 使用 Composition API 設定組件邏輯
     */
    setup() {
      // 📦 取得 Pinia 數據存儲實例
      const dataStore = useDataStore();

      /**
       * 📊 選中物件計算屬性 (Selected Feature Computed Property)
       * 從 Pinia store 獲取當前選中的地圖物件
       * 提供響應式的選中物件數據
       */
      const selectedFeature = computed(() => dataStore.selectedFeature);

      const selectedLayer = computed(() => {
        if (!selectedFeature.value?.properties?.layerId) {
          return null;
        }

        const layerId = selectedFeature.value.properties.layerId;
        const layer = dataStore.findLayerById(layerId);
        return layer;
      });

      /**
       * 🏷️ 圖層名稱計算屬性 (Layer Name Computed Property)
       * 根據 selectedFeature.properties.layerId 從 dataStore 的 layers 中找到對應的圖層名稱
       */
      const layerName = computed(() => {
        if (!selectedFeature.value?.properties?.layerId) {
          return null;
        }

        const layerId = selectedFeature.value.properties.layerId;
        const layer = dataStore.findLayerById(layerId);
        return layer ? layer.layerName : layerId;
      });

      /**
       * 📋 是否有屬性計算屬性 (Has Properties Computed Property)
       * 檢查選中物件是否包含有效的屬性資料
       *
       * @returns {boolean} 是否有屬性資料
       */
      const hasProperties = computed(() => {
        return (
          !!selectedFeature.value?.properties?.propertyData &&
          Object.keys(selectedFeature.value.properties.propertyData).length > 0
        );
      });

      /**
       * 🎯 是否為分析圖層物件 (Is Analysis Layer Object)
       * 檢查選中物件是否為分析圖層的物件
       */
      const isAnalysisObject = computed(() => {
        return selectedFeature.value?.properties?.layerId === 'analysis-layer';
      });

      /**
       * 🚗 是否為等時圈分析圖層物件 (Is Isochrone Analysis Layer Object)
       * 檢查選中物件是否為等時圈分析圖層的物件
       */
      const isIsochroneAnalysisObject = computed(() => {
        return selectedFeature.value?.properties?.layerId === 'isochrone-analysis-layer';
      });

      /**
       * 🛣️ 是否為路徑規劃圖層物件 (Is Route Planning Layer Object)
       * 檢查選中物件是否為路徑規劃圖層的物件
       */
      const isRoutePlanningObject = computed(() => {
        return selectedFeature.value?.properties?.layerId === 'route-planning-layer';
      });

      /**
       * 🛣️ 是否為路徑規劃路線 (Is Route Planning Line)
       * 檢查選中物件是否為路徑規劃路線
       */
      const isRoutePlanningLine = computed(() => {
        return (
          isRoutePlanningObject.value && selectedFeature.value?.properties?.type === 'route-line'
        );
      });

      /**
       * 📍 是否為路徑規劃點 (Is Route Planning Point)
       * 檢查選中物件是否為路徑規劃點
       */
      const isRoutePlanningPoint = computed(() => {
        return (
          isRoutePlanningObject.value &&
          selectedFeature.value?.properties?.type === 'route-planning-point'
        );
      });

      /**
       * 🗺️ 是否為路徑優化圖層物件 (Is Route Optimization Layer Object)
       * 檢查選中物件是否為路徑優化圖層的物件
       */
      const isRouteOptimizationObject = computed(() => {
        return selectedFeature.value?.properties?.layerId === 'route-optimization-layer';
      });

      /**
       * 🗺️ 是否為路徑優化路線 (Is Route Optimization Line)
       * 檢查選中物件是否為路徑優化路線
       */
      const isRouteOptimizationLine = computed(() => {
        return (
          isRouteOptimizationObject.value &&
          selectedFeature.value?.properties?.type === 'optimized-route-line'
        );
      });

      /**
       * 🗺️ 是否為路徑優化點 (Is Route Optimization Point)
       * 檢查選中物件是否為路徑優化點
       */
      const isRouteOptimizationPoint = computed(() => {
        return (
          isRouteOptimizationObject.value &&
          selectedFeature.value?.properties?.type === 'optimization-point'
        );
      });

      /**
       * 📍 路徑規劃路線詳細信息 (Route Planning Line Details)
       * 獲取路徑規劃路線的詳細信息，包括關聯的路徑點
       */
      const routePlanningDetails = computed(() => {
        if (!isRoutePlanningLine.value) return null;

        const routeFeature = selectedFeature.value;
        const routeId = routeFeature.properties.id;
        const routeNumber = routeFeature.properties.routeNumber;

        // 從圖層中找到關聯的路徑點
        const routePlanningLayer = dataStore.findLayerById('route-planning-layer');
        if (!routePlanningLayer) return null;

        const relatedPoints = routePlanningLayer.geoJsonData.features
          .filter(
            (f) => f.properties.type === 'route-planning-point' && f.properties.routeId === routeId
          )
          .sort((a, b) => a.properties.order - b.properties.order);

        return {
          routeInfo: {
            id: routeId,
            name: routeFeature.properties.name,
            routeNumber: routeNumber,
            distance: routeFeature.properties.distance,
            duration: routeFeature.properties.duration,
            profile: routeFeature.properties.profile,
            waypoints: routeFeature.properties.waypoints,
            startPointName: routeFeature.properties.startPointName,
            endPointName: routeFeature.properties.endPointName,
            createdAt: routeFeature.properties.createdAt,
          },
          routePoints: relatedPoints.map((point) => ({
            order: point.properties.order,
            name: point.properties.name,
            latitude: point.properties.latitude,
            longitude: point.properties.longitude,
            coordinates: point.geometry.coordinates,
            createdAt: point.properties.createdAt,
          })),
        };
      });

      /**
       * 🗺️ 路徑優化路線詳細信息 (Route Optimization Line Details)
       * 獲取路徑優化路線的詳細信息，包括優化後的訪問順序
       */
      const routeOptimizationDetails = computed(() => {
        if (!isRouteOptimizationLine.value) return null;

        const routeFeature = selectedFeature.value;
        const routeId = routeFeature.properties.id;
        const routeNumber = routeFeature.properties.routeNumber;

        // 直接使用路線特性中存儲的優化點信息，確保數據一致性
        const optimizedPointInfo = routeFeature.properties.optimizedPointInfo || [];

        return {
          routeInfo: {
            id: routeId,
            name: routeFeature.properties.name,
            routeNumber: routeNumber,
            distance: routeFeature.properties.distance,
            duration: routeFeature.properties.duration,
            profile: routeFeature.properties.profile,
            waypoints: routeFeature.properties.waypoints,
            vehicleId: routeFeature.properties.vehicleId,
            createdAt: routeFeature.properties.createdAt,
          },
          routePoints: optimizedPointInfo.map((point) => ({
            order: point.order,
            name: point.name,
            latitude: point.coordinates[1],
            longitude: point.coordinates[0],
            coordinates: point.coordinates,
            createdAt: routeFeature.properties.createdAt, // 使用路線的創建時間
          })),
          optimizedOrder: routeFeature.properties.optimizedOrder || [],
          optimizedPointInfo: optimizedPointInfo,
        };
      });

      /**
       * 📍 範圍內點位清單 (Points In Range List)
       * 獲取分析圖層物件範圍內的點清單（支援數據分析和等時圈分析）
       */
      const pointsInRange = computed(() => {
        if (!isAnalysisObject.value && !isIsochroneAnalysisObject.value) return [];
        return selectedFeature.value?.properties?.pointsInRange || [];
      });

      /**
       * 🏢 範圍內多邊形清單 (Polygon In Range List)
       * 獲取分析圖層物件範圍內的多邊形清單（支援數據分析和等時圈分析）
       */
      const polygonInRange = computed(() => {
        if (!isAnalysisObject.value && !isIsochroneAnalysisObject.value) return [];
        return selectedFeature.value?.properties?.polygonInRange || [];
      });

      /**
       * 📋 範圍內所有物件清單 (All Objects In Range List)
       * 整合點物件和多邊形物件的統一清單
       */
      const allObjectsInRange = computed(() => {
        const points = pointsInRange.value.map((obj) => ({ ...obj, objectType: 'point' }));
        const polygons = polygonInRange.value.map((obj) => ({ ...obj, objectType: 'polygon' }));
        return [...points, ...polygons];
      });

      /**
       * 📊 圖層統計 (Layer Statistics)
       * 獲取範圍內各圖層的統計信息（點物件）（支援數據分析和等時圈分析）
       */
      const layerStats = computed(() => {
        if (!isAnalysisObject.value && !isIsochroneAnalysisObject.value) return {};
        return selectedFeature.value?.properties?.layerStats || {};
      });

      /**
       * 🏢 多邊形圖層統計 (Polygon Layer Statistics)
       * 獲取範圍內各圖層的統計信息（多邊形物件）（支援數據分析和等時圈分析）
       */
      const polygonStats = computed(() => {
        if (!isAnalysisObject.value && !isIsochroneAnalysisObject.value) return {};
        return selectedFeature.value?.properties?.polygonStats || {};
      });

      /**
       * 📊 整合統計 (Combined Statistics)
       * 整合點物件和多邊形物件的統計
       */
      const combinedStats = computed(() => {
        const combined = { ...layerStats.value };
        Object.entries(polygonStats.value).forEach(([layerName, count]) => {
          const key = `${layerName} (多邊形)`;
          combined[key] = count;
        });
        return combined;
      });

      /**
       * 🕐 格式化日期時間 (Format Date Time)
       * 將 ISO 字串轉換為本地化的日期時間格式
       * @param {string} isoString - ISO 格式的日期時間字串
       * @returns {string} - 格式化後的日期時間字串
       */
      const formatDateTime = (isoString) => {
        if (!isoString) return 'N/A';
        try {
          return new Date(isoString).toLocaleString('zh-TW');
        } catch (error) {
          console.warn('日期格式化失敗:', error);
          return isoString;
        }
      };

      // 📤 返回響應式數據給模板使用
      return {
        selectedFeature, // 選中物件
        selectedLayer, // 選中圖層
        layerName, // 圖層名稱
        hasProperties, // 是否有屬性
        isAnalysisObject, // 是否為分析圖層物件
        isIsochroneAnalysisObject, // 是否為等時圈分析圖層物件
        isRoutePlanningObject, // 是否為路徑規劃圖層物件
        isRoutePlanningLine, // 是否為路徑規劃路線
        isRoutePlanningPoint, // 是否為路徑規劃點
        routePlanningDetails, // 路徑規劃路線詳細信息
        isRouteOptimizationObject, // 是否為路徑優化圖層物件
        isRouteOptimizationLine, // 是否為路徑優化路線
        isRouteOptimizationPoint, // 是否為路徑優化點
        routeOptimizationDetails, // 路徑優化路線詳細信息
        pointsInRange, // 範圍內點位清單
        polygonInRange, // 範圍內多邊形清單
        allObjectsInRange, // 範圍內所有物件清單
        layerStats, // 點圖層統計
        polygonStats, // 多邊形圖層統計
        combinedStats, // 整合統計
        formatDateTime, // 日期時間格式化函數
      };
    },

    /**
     * 🛠️ 組件方法定義 (Component Methods)
     * 定義資料格式化和處理方法
     */
    methods: {
      /**
       * 📝 格式化屬性標籤 (Format Property Label)
       * 將英文屬性名稱轉換為中文顯示名稱
       *
       * @param {string} key - 原始屬性名稱
       * @returns {string} 格式化後的顯示名稱
       */
      formatLabel(key) {
        // 屬性名稱對照表，提供中文化顯示
        const labelMap = {
          PTVNAME: '區域名稱',
          中位數: '中位數',
          name: '名稱',
          count: '數量',
          area: '面積',
          population: '人口',
          density: '密度',
          // 分析圖層專用標籤
          分析點名稱: '分析點名稱',
          分析範圍名稱: '分析範圍名稱',
          緯度: '緯度',
          經度: '經度',
          中心緯度: '中心緯度',
          中心經度: '中心經度',
          分析半徑: '分析半徑',
          建立時間: '建立時間',
          關聯分析點: '關聯分析點',
        };
        return labelMap[key] || key;
      },

      /**
       * 🎨 格式化屬性值 (Format Property Value)
       * 根據值的類型進行適當的格式化處理
       *
       * @param {any} value - 原始屬性值
       * @returns {string} 格式化後的顯示值
       */
      formatValue(value) {
        // 數字類型：添加千分位分隔符
        if (typeof value === 'number') {
          return value.toLocaleString();
        }
        // 其他類型：直接返回
        return value;
      },
    },
  };
</script>

<template>
  <div class="h-100 flex-grow-1 d-flex flex-column my-bgcolor-gray-200">
    <div v-if="selectedFeature" class="my-bgcolor-white h-100">
      <div>
        <div
          v-if="selectedLayer"
          :class="`my-bgcolor-${selectedLayer.colorName}`"
          :style="{ minHeight: '4px' }"
        ></div>

        <div class="p-3">
          <DetailItem label="圖層" :value="layerName" />
          <template v-if="hasProperties">
            <DetailItem
              v-for="(value, key) in selectedFeature.properties.propertyData"
              :key="key"
              :label="formatLabel(key)"
              :value="formatValue(value)"
            />
          </template>

          <!-- 🎯 分析圖層專用：範圍內物件清單（支援數據分析和等時圈分析） -->
          <template
            v-if="
              (isAnalysisObject || isIsochroneAnalysisObject) &&
              (pointsInRange.length > 0 || polygonInRange.length > 0)
            "
          >
            <!-- 📍 點物件清單 -->
            <template v-if="pointsInRange.length > 0">
              <hr class="my-3" />

              <div class="my-title-xs-gray mb-3">範圍內點物件 {{ pointsInRange.length }}</div>
              <DetailItem
                v-for="(point, index) in pointsInRange"
                :key="index"
                :label="point.properties.layerName"
                :value="`${point.properties.name} (${point.distance}m)`"
              />
            </template>

            <!-- 🏢 多邊形物件清單 -->
            <template v-if="polygonInRange.length > 0">
              <hr class="my-3" />

              <div class="my-title-xs-gray mb-3">範圍內面域物件 {{ polygonInRange.length }}</div>
              <DetailItem
                v-for="(polygon, index) in polygonInRange"
                :key="index"
                :label="polygon.properties.layerName"
                :value="polygon.properties.name"
              />
            </template>
          </template>

          <!-- 🛣️ 路徑規劃路線專用：路線詳細信息 -->
          <template v-if="isRoutePlanningLine && routePlanningDetails">
            <hr class="my-3" />

            <!-- 路線基本信息 -->
            <div class="my-title-xs-gray mb-3">路線信息</div>
            <DetailItem label="路線名稱" :value="routePlanningDetails.routeInfo.name" />
            <DetailItem
              label="路線編號"
              :value="`路線 ${routePlanningDetails.routeInfo.routeNumber}`"
            />
            <DetailItem label="總距離" :value="`${routePlanningDetails.routeInfo.distance} 公里`" />
            <DetailItem
              label="預估時間"
              :value="`${routePlanningDetails.routeInfo.duration} 分鐘`"
            />
            <DetailItem
              label="交通方式"
              :value="
                routePlanningDetails.routeInfo.profile === 'driving-car'
                  ? '駕車'
                  : routePlanningDetails.routeInfo.profile
              "
            />
            <DetailItem
              label="路徑點數"
              :value="`${routePlanningDetails.routeInfo.waypoints} 個`"
            />
            <DetailItem label="起點" :value="routePlanningDetails.routeInfo.startPointName" />
            <DetailItem label="終點" :value="routePlanningDetails.routeInfo.endPointName" />
            <DetailItem
              label="建立時間"
              :value="formatDateTime(routePlanningDetails.routeInfo.createdAt)"
            />

            <!-- 路徑點詳細清單 -->
            <template v-if="routePlanningDetails.routePoints.length > 0">
              <hr class="my-3" />

              <div class="my-title-xs-gray mb-3">
                路徑點詳細 {{ routePlanningDetails.routePoints.length }}
              </div>

              <div
                v-for="(point, index) in routePlanningDetails.routePoints"
                :key="index"
                class="mb-3 p-2 border rounded"
              >
                <div class="my-content-sm-black fw-bold mb-2">{{ point.name }}</div>
                <DetailItem label="順序" :value="`第 ${point.order} 個路徑點`" />
                <DetailItem label="緯度" :value="point.latitude.toFixed(6)" />
                <DetailItem label="經度" :value="point.longitude.toFixed(6)" />
                <DetailItem
                  label="坐標"
                  :value="`[${point.coordinates[1].toFixed(6)}, ${point.coordinates[0].toFixed(6)}]`"
                />
                <DetailItem label="建立時間" :value="formatDateTime(point.createdAt)" />
              </div>
            </template>
          </template>

          <!-- 📍 路徑規劃點專用：路徑點詳細信息 -->
          <template v-if="isRoutePlanningPoint">
            <hr class="my-3" />

            <!-- 路徑點基本信息 -->
            <div class="my-title-xs-gray mb-3">路徑點信息</div>
            <DetailItem label="點名稱" :value="selectedFeature.properties.name" />
            <DetailItem label="順序" :value="`第 ${selectedFeature.properties.order} 個路徑點`" />
            <DetailItem
              label="狀態"
              :value="selectedFeature.properties.status === 'completed' ? '已完成' : '規劃中'"
            />

            <!-- 已完成路徑點的額外信息 -->
            <template v-if="selectedFeature.properties.status === 'completed'">
              <DetailItem
                label="所屬路線"
                :value="`路線 ${selectedFeature.properties.routeNumber}`"
              />
              <DetailItem label="路線ID" :value="selectedFeature.properties.routeId" />
            </template>

            <!-- 坐標信息 -->
            <hr class="my-3" />
            <div class="my-title-xs-gray mb-3">坐標信息</div>
            <DetailItem
              label="緯度"
              :value="selectedFeature.properties.latitude?.toFixed(6) || 'N/A'"
            />
            <DetailItem
              label="經度"
              :value="selectedFeature.properties.longitude?.toFixed(6) || 'N/A'"
            />
            <DetailItem
              label="GeoJSON坐標"
              :value="`[${selectedFeature.properties.latitude?.toFixed(6) || 'N/A'}, ${selectedFeature.properties.longitude?.toFixed(6) || 'N/A'}]`"
            />

            <!-- 其他屬性 -->
            <hr class="my-3" />
            <div class="my-title-xs-gray mb-3">其他屬性</div>
            <DetailItem label="要素ID" :value="selectedFeature.properties.id" />
            <DetailItem label="圖層ID" :value="selectedFeature.properties.layerId" />
            <DetailItem label="要素類型" :value="selectedFeature.properties.type" />
            <DetailItem
              label="建立時間"
              :value="formatDateTime(selectedFeature.properties.createdAt)"
            />
          </template>

          <!-- 🗺️ 路徑優化路線專用：優化路線詳細信息 -->
          <template v-if="isRouteOptimizationLine && routeOptimizationDetails">
            <hr class="my-3" />

            <!-- 優化路線基本信息 -->
            <div class="my-title-xs-gray mb-3">優化路線信息</div>
            <DetailItem label="路線名稱" :value="routeOptimizationDetails.routeInfo.name" />
            <DetailItem
              label="路線編號"
              :value="`優化路線 ${routeOptimizationDetails.routeInfo.routeNumber}`"
            />
            <DetailItem
              label="總距離"
              :value="`${routeOptimizationDetails.routeInfo.distance} 公里`"
            />
            <DetailItem
              label="預估時間"
              :value="`${routeOptimizationDetails.routeInfo.duration} 分鐘`"
            />
            <DetailItem
              label="交通方式"
              :value="
                routeOptimizationDetails.routeInfo.profile === 'driving-car'
                  ? '駕車'
                  : routeOptimizationDetails.routeInfo.profile
              "
            />
            <DetailItem
              label="優化點數"
              :value="`${routeOptimizationDetails.routeInfo.waypoints} 個`"
            />
            <DetailItem
              label="車輛ID"
              :value="routeOptimizationDetails.routeInfo.vehicleId || 'N/A'"
            />
            <DetailItem
              label="建立時間"
              :value="formatDateTime(routeOptimizationDetails.routeInfo.createdAt)"
            />

            <!-- 優化點詳細清單 -->
            <template v-if="routeOptimizationDetails.routePoints.length > 0">
              <hr class="my-3" />

              <div class="my-title-xs-gray mb-3">
                優化點詳細 {{ routeOptimizationDetails.routePoints.length }}
              </div>

              <div
                v-for="(point, index) in routeOptimizationDetails.routePoints"
                :key="index"
                class="mb-3 p-2 border rounded"
              >
                <div class="my-content-sm-black fw-bold mb-2">
                  <span class="badge bg-primary me-2">{{ point.order }}</span>
                  {{ point.name }}
                </div>
                <DetailItem label="順序" :value="`第 ${point.order} 個優化點`" />
                <DetailItem label="緯度" :value="point.latitude.toFixed(6)" />
                <DetailItem label="經度" :value="point.longitude.toFixed(6)" />
                <DetailItem
                  label="坐標"
                  :value="`[${point.coordinates[1].toFixed(6)}, ${point.coordinates[0].toFixed(6)}]`"
                />
                <DetailItem label="建立時間" :value="formatDateTime(point.createdAt)" />
              </div>
            </template>

            <!-- 優化順序顯示 -->
            <template
              v-if="
                routeOptimizationDetails.optimizedPointInfo &&
                routeOptimizationDetails.optimizedPointInfo.length > 0
              "
            >
              <hr class="my-3" />
              <div class="my-title-xs-gray mb-3">優化訪問順序</div>
              <div class="mb-3 p-2 border rounded bg-light">
                <div
                  v-for="(point, index) in routeOptimizationDetails.optimizedPointInfo"
                  :key="index"
                  class="mb-2"
                >
                  <span class="badge bg-success me-2"
                    >訪問順序 {{ point.visitOrder || index + 1 }}</span
                  >
                  <span class="badge bg-primary me-2">優化點 {{ point.order }}</span>
                  <span v-if="point.stepType" class="badge bg-secondary me-2">{{
                    point.stepType === 'start'
                      ? '起點'
                      : point.stepType === 'end'
                        ? '終點'
                        : point.stepType === 'job'
                          ? '任務'
                          : point.stepType
                  }}</span>
                  <span class="my-content-sm-black">
                    {{ point.name }}
                    <small class="text-muted ms-2">
                      ({{ point.coordinates[1].toFixed(6) }}, {{ point.coordinates[0].toFixed(6) }})
                    </small>
                  </span>
                </div>
              </div>
            </template>
          </template>

          <!-- 🗺️ 路徑優化點專用：優化點詳細信息 -->
          <template v-if="isRouteOptimizationPoint">
            <hr class="my-3" />

            <!-- 優化點基本信息 -->
            <div class="my-title-xs-gray mb-3">優化點信息</div>
            <DetailItem
              label="點名稱"
              :value="`${selectedFeature.properties.order}. ${selectedFeature.properties.name}`"
            />
            <DetailItem label="順序" :value="`第 ${selectedFeature.properties.order} 個優化點`" />
            <DetailItem
              label="狀態"
              :value="selectedFeature.properties.status === 'completed' ? '已完成' : '規劃中'"
            />

            <!-- 已完成優化點的額外信息 -->
            <template v-if="selectedFeature.properties.status === 'completed'">
              <DetailItem
                label="所屬路線"
                :value="`優化路線 ${selectedFeature.properties.routeNumber}`"
              />
              <DetailItem label="路線ID" :value="selectedFeature.properties.routeId" />
            </template>

            <!-- 坐標信息 -->
            <hr class="my-3" />
            <div class="my-title-xs-gray mb-3">坐標信息</div>
            <DetailItem
              label="緯度"
              :value="selectedFeature.geometry.coordinates[1]?.toFixed(6) || 'N/A'"
            />
            <DetailItem
              label="經度"
              :value="selectedFeature.geometry.coordinates[0]?.toFixed(6) || 'N/A'"
            />
            <DetailItem
              label="GeoJSON坐標"
              :value="`[${selectedFeature.geometry.coordinates[1].toFixed(6)}, ${selectedFeature.geometry.coordinates[0].toFixed(6)}]`"
            />

            <!-- 其他屬性 -->
            <hr class="my-3" />
            <div class="my-title-xs-gray mb-3">其他屬性</div>
            <DetailItem label="要素ID" :value="selectedFeature.properties.id" />
            <DetailItem label="圖層ID" :value="selectedFeature.properties.layerId" />
            <DetailItem label="要素類型" :value="selectedFeature.properties.type" />
            <DetailItem
              label="建立時間"
              :value="formatDateTime(selectedFeature.properties.createdAt)"
            />
          </template>
        </div>
      </div>
    </div>

    <!-- 📭 無點擊地圖上物件的空狀態 -->
    <div v-else class="flex-grow-1 d-flex align-items-center justify-content-center">
      <div class="text-center">
        <div class="my-title-md-gray p-3">沒有點擊地圖上的物件</div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
