import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { schemeCategory10 } from 'd3';

import {
  fetchReportCarbonRowsGroupedByYear,
  buildCarbonReportPayloadFromRows,
  truncateCompanyNameForLayerDisplay,
} from '../utils/dataProcessor.js';

const REPORT_CSV_FILE = 'report_with_google_location.csv';

// 主要數據存儲定義 (Main Data Store Definition)
export const useDataStore = defineStore(
  'data',
  () => {
    /** 等時圈自動載入時優先載入的「最新年度」事業圖層 id（report-year-113 等） */
    const primaryCarbonReportLayerId = ref(null);

    const layers = ref([
      {
        groupName: '年度',
        /** 內部圖層（分析／路徑）不顯示在圖層列表；年度圖層由 initReportYearLayers 附加；「事業」群組見另一頂層 group */
        groupLayers: [
          {
            layerId: 'analysis-layer',
            layerName: '數據分析圖層',
            showInLayerPanel: false,
            visible: true, // 預設開啟
            isLoading: false,
            isLoaded: true, // 始終載入
            type: 'analysis',
            shape: 'mixed',
            colorName: 'green',
            geoJsonData: {
              type: 'FeatureCollection',
              features: [],
            },
            summaryData: {
              totalCount: 0,
              type: '分析點',
              description: '共 0 個分析點，每個點包含 2 公里分析範圍',
              lastUpdated: new Date().toISOString(),
              coverage: '0 平方公里',
            },
            tableData: [],
            legendData: null,
            loader: null, // 不需要載入器
            fileName: null,
            fieldName: null,
            isAnalysisLayer: true, // 標記為分析圖層
          },
          {
            /**
             * 等時圈分析圖層配置
             *
             * @description 此圖層提供基於真實交通網路的等時圈分析功能，
             * 使用 OpenRouteService API 計算從指定起點在指定時間內可到達的所有區域，
             * 並分析範圍內的長照設施和相關統計數據。
             *
             * 功能特色：
             * - 🌐 調用 ORS API 獲取真實的等時圈多邊形
             * - 🎯 精確計算等時圈範圍內的設施數量
             * - 🔄 API 失敗時提供圓圈分析回退方案
             * - 📊 生成詳細的統計報告和表格數據
             * - 🎨 支援多邊形和圓圈兩種視覺表示方式
             */
            layerId: 'isochrone-analysis-layer',
            layerName: '等時圈分析圖層',
            showInLayerPanel: false,
            visible: true, // 預設開啟，讓使用者可以立即使用
            isLoading: false, // 初始無加載狀態
            isLoaded: true, // 標記為已載入（分析圖層總是可用的）
            type: 'isochrone-analysis', // 特殊圖層類型
            shape: 'mixed', // 混合形狀：包含點標記和多邊形/圓圈
            colorName: 'blue',

            // GeoJSON 數據容器，存儲所有等時圈分析結果
            geoJsonData: {
              type: 'FeatureCollection',
              features: [], // 初始為空，分析點會動態添加到此陣列
            },

            // 摘要統計數據（顯示在圖層面板中）
            summaryData: {
              totalCount: 0, // 總等時圈分析數量
              type: '等時分析點', // 分析類型描述
              description: '共 0 個等時分析點，每個點包含等時圈分析範圍', // 詳細描述
              lastUpdated: new Date().toISOString(), // 最後更新時間
              coverage: '0 平方公里', // 覆蓋範圍（暫未實現）
            },

            tableData: [], // 表格數據（用於 DataTableTab 顯示）
            legendData: null, // 圖例數據（等時圈分析不需要圖例）
            loader: null, // 不需要數據載入器（分析是即時生成的）
            fileName: null, // 不對應實體檔案
            fieldName: null, // 不需要欄位映射

            // 🔍 特殊標記：標識此圖層為等時圈分析圖層
            // 此標記用於：
            // 1. 在圖層過濾時排除此圖層
            // 2. 在事件處理中識別分析圖層
            // 3. 在視覺渲染中應用特殊樣式
            isIsochroneAnalysisLayer: true,
          },
          // 🗺️ 路徑規劃圖層 - 多點路徑規劃功能
          {
            /**
             * 路徑規劃圖層配置
             *
             * @description 此圖層提供多點路徑規劃功能，
             * 使用者可以在地圖上點選多個路徑規劃點，
             * 系統將記錄這些點位並提供路徑規劃相關功能。
             *
             * 功能特色：
             * - 🎯 支援多點路徑規劃點選
             * - 📍 無數量限制的路徑點添加
             * - 🎨 清晰的路徑點視覺化
             * - 🔄 靈活的路徑點管理
             * - 📊 路徑點統計和列表顯示
             */
            layerId: 'route-planning-layer',
            layerName: '路徑規劃圖層',
            showInLayerPanel: false,
            visible: true, // 預設開啟
            isLoading: false, // 初始無加載狀態
            isLoaded: true, // 標記為已載入（路徑規劃圖層總是可用的）
            type: 'route-planning', // 特殊圖層類型
            shape: 'point', // 點狀圖層：路徑規劃點
            colorName: 'orange', // 橘色主題，與其他分析圖層區分

            // GeoJSON 數據容器，存儲所有路徑規劃點
            geoJsonData: {
              type: 'FeatureCollection',
              features: [], // 初始為空，路徑點會動態添加到此陣列
            },

            // 摘要統計數據（顯示在圖層面板中）
            summaryData: {
              totalCount: 0, // 總路徑規劃點數量
              type: '路徑規劃點', // 類型描述
              description: '共 0 個路徑規劃點，點選完成後可進行路徑規劃', // 詳細描述
              lastUpdated: new Date().toISOString(), // 最後更新時間
              coverage: '0 個路徑點', // 覆蓋範圍描述
            },

            tableData: [], // 表格數據（用於 DataTableTab 顯示）
            legendData: null, // 圖例數據（路徑規劃不需要圖例）
            loader: null, // 不需要數據載入器（路徑點是即時生成的）
            fileName: null, // 不對應實體檔案
            fieldName: null, // 不需要欄位映射

            // 🔍 特殊標記：標識此圖層為路徑規劃圖層
            // 此標記用於：
            // 1. 在圖層過濾時排除此圖層
            // 2. 在事件處理中識別路徑規劃圖層
            // 3. 在視覺渲染中應用特殊樣式
            // 4. 在點擊模式中識別路徑規劃模式
            isRoutePlanningLayer: true,
          },
          {
            /**
             * 🗺️ 路徑優化圖層 (Route Optimization Layer)
             *
             * @description 用於存儲和管理路徑優化相關的數據，包括：
             * - 🎯 支援多點路徑優化點選
             * - 📍 無數量限制的優化點添加
             * - 🎨 清晰的優化點視覺化
             * - 🔄 靈活的優化點管理
             * - 📊 優化點統計和列表顯示
             */
            layerId: 'route-optimization-layer',
            layerName: '路徑優化圖層',
            showInLayerPanel: false,
            visible: true, // 預設開啟
            isLoading: false, // 初始無加載狀態
            isLoaded: true, // 標記為已載入（路徑優化圖層總是可用的）
            type: 'route-optimization', // 特殊圖層類型
            shape: 'point', // 點狀圖層：路徑優化點
            colorName: 'purple', // 紫色主題，與路徑規劃區分

            // GeoJSON 數據容器，存儲所有路徑優化點
            geoJsonData: {
              type: 'FeatureCollection',
              features: [], // 初始為空，優化點會動態添加到此陣列
            },

            // 摘要統計數據（顯示在圖層面板中）
            summaryData: {
              totalCount: 0, // 總路徑優化點數量
              type: '路徑優化點', // 類型描述
              description: '共 0 個路徑優化點，點選完成後可進行路徑優化', // 詳細描述
              lastUpdated: new Date().toISOString(), // 最後更新時間
              coverage: '0 個優化點', // 覆蓋範圍描述
            },

            tableData: [], // 表格數據（用於 DataTableTab 顯示）
            legendData: null, // 圖例數據（路徑優化不需要圖例）
            loader: null, // 不需要數據載入器（優化點是即時生成的）
            fileName: null, // 不對應實體檔案
            fieldName: null, // 不需要欄位映射

            // 🔍 特殊標記：標識此圖層為路徑優化圖層
            // 此標記用於：
            // 1. 在圖層過濾時排除此圖層
            // 2. 在事件處理中識別路徑優化圖層
            // 3. 在視覺渲染中應用特殊樣式
            // 4. 在點擊模式中識別路徑優化模式
            isRouteOptimizationLayer: true,
          },
        ],
      },
      {
        groupName: '事業',
        /** 各統編圖層由 initReportYearLayers 依同一 CSV 預載填入 */
        groupLayers: [],
      },
    ]);

    // 在新的分組結構中搜尋指定 ID 的圖層
    const findLayerById = (layerId) => {
      for (const group of layers.value) {
        for (const layer of group.groupLayers) {
          if (layer.layerId === layerId) {
            return layer;
          }
        }
      }
      return null;
    };

    // 從分組結構中提取所有圖層的扁平陣列
    const getAllLayers = () => {
      const allLayers = [];
      for (const group of layers.value) {
        allLayers.push(...group.groupLayers);
      }
      return allLayers;
    };

    /** 碳排 CSV 僅 fetch 一次後，各年度圖層由此取預組 payload（開關圖層不再讀檔） */
    let carbonReportYearPayloadByYear = Object.create(null);

    const loadCarbonReportYearFromPrecache = (layer) => {
      const y = layer.filterYear != null ? String(layer.filterYear).trim() : '';
      const payload = carbonReportYearPayloadByYear[y];
      if (!payload) {
        return Promise.reject(new Error(`無預載年度資料: ${y || '(未指定)'}`));
      }
      return Promise.resolve(payload);
    };

    /** 與年度群組相同：依事業統編預載，開關圖層不讀檔 */
    let carbonReportBizPayloadByBizId = Object.create(null);

    const loadCarbonReportBizFromPrecache = (layer) => {
      const id = layer.filterBizId != null ? String(layer.filterBizId).trim() : '';
      const payload = carbonReportBizPayloadByBizId[id];
      if (!payload) {
        return Promise.reject(new Error(`無預載事業統編資料: ${id || '(未指定)'}`));
      }
      return Promise.resolve(payload);
    };

    const carbonReportBizLayerName = (meta, bizId, rowsForBiz) => {
      const ni = meta?.headerIndex?.['事業名稱'];
      if (ni === undefined || !rowsForBiz?.length) {
        return String(bizId);
      }
      const raw = String(rowsForBiz[0][ni] ?? '').trim();
      const nm = truncateCompanyNameForLayerDisplay(raw);
      return nm ? `${bizId}｜${nm}` : String(bizId);
    };

    /**
     * 讀取碳排 CSV 一次，依「年度」與 CSV「事業統編」欄分組並預建 geoJson／表格／摘要；開關圖層僅套用預載資料。
     */
    const initReportYearLayers = async () => {
      const infra = layers.value.find((g) => g.groupName === '年度');
      const bizGroup = layers.value.find((g) => g.groupName === '事業');
      if (!infra) return;

      const preserved = (infra.groupLayers || []).filter(
        (l) =>
          !l.isCarbonReportYearLayer && !String(l.layerId || '').startsWith('report-year')
      );

      carbonReportYearPayloadByYear = Object.create(null);
      carbonReportBizPayloadByBizId = Object.create(null);

      try {
        const grouped = await fetchReportCarbonRowsGroupedByYear(REPORT_CSV_FILE);
        const { years, rowsByYear, bizIds, rowsByBizId, meta } = grouped;

        if (!meta) {
          console.warn('碳排 CSV 無法解析（無表頭或無資料列）');
          infra.groupLayers = preserved;
          if (bizGroup) bizGroup.groupLayers = [];
          primaryCarbonReportLayerId.value = null;
          return;
        }

        const palette = schemeCategory10;

        if (years.length === 0) {
          console.warn('碳排 CSV 中未解析到任何年度（緯經度有效且「年度」非空）');
          infra.groupLayers = preserved;
          primaryCarbonReportLayerId.value = null;
        } else {
          const yearLayers = years.map((year, i) => {
            const layerStub = {
              layerId: `report-year-${year}`,
              layerName: `${year}年`,
              filterYear: year,
              layerColor: palette[i % palette.length],
            };
            carbonReportYearPayloadByYear[year] = buildCarbonReportPayloadFromRows(
              layerStub,
              meta,
              rowsByYear[year] ?? []
            );
            return {
              layerId: layerStub.layerId,
              layerName: layerStub.layerName,
              filterYear: year,
              visible: false,
              isLoading: false,
              isLoaded: false,
              type: 'point',
              shape: 'circle',
              layerColor: layerStub.layerColor,
              geoJsonData: null,
              summaryData: null,
              tableData: null,
              legendData: null,
              loader: loadCarbonReportYearFromPrecache,
              fileName: REPORT_CSV_FILE,
              fieldName: null,
              isCarbonReportYearLayer: true,
            };
          });
          infra.groupLayers = [...preserved, ...yearLayers];
          primaryCarbonReportLayerId.value = `report-year-${years[0]}`;
        }

        if (bizGroup) {
          if (bizIds.length === 0) {
            console.warn('碳排 CSV 中未解析到任何事業統編（緯經度有效且「事業統編」非空）');
            bizGroup.groupLayers = [];
          } else {
            const bizLayers = bizIds.map((bizId, i) => {
              const rows = rowsByBizId[bizId] ?? [];
              const layerStub = {
                layerId: `report-biz-${bizId}`,
                layerName: carbonReportBizLayerName(meta, bizId, rows),
                filterBizId: bizId,
                layerColor: palette[i % palette.length],
              };
              carbonReportBizPayloadByBizId[bizId] = buildCarbonReportPayloadFromRows(
                layerStub,
                meta,
                rows
              );
              return {
                layerId: layerStub.layerId,
                layerName: layerStub.layerName,
                filterBizId: bizId,
                visible: false,
                isLoading: false,
                isLoaded: false,
                type: 'point',
                shape: 'circle',
                layerColor: layerStub.layerColor,
                geoJsonData: null,
                summaryData: null,
                tableData: null,
                legendData: null,
                loader: loadCarbonReportBizFromPrecache,
                fileName: REPORT_CSV_FILE,
                fieldName: null,
                isCarbonReportBizLayer: true,
              };
            });
            bizGroup.groupLayers = bizLayers;
          }
        }
      } catch (e) {
        console.error('初始化年度／事業圖層失敗:', e);
        carbonReportYearPayloadByYear = Object.create(null);
        carbonReportBizPayloadByBizId = Object.create(null);
        infra.groupLayers = preserved;
        if (bizGroup) bizGroup.groupLayers = [];
        primaryCarbonReportLayerId.value = null;
      }
    };

    // 控制圖層的顯示/隱藏，並在需要時自動載入資料
    const toggleLayerVisibility = async (layerId) => {
      console.log('🔧 DataStore: toggleLayerVisibility 被調用', layerId);
      const layer = findLayerById(layerId);
      if (!layer) {
        console.error(`Layer with id "${layerId}" not found.`);
        return;
      }

      console.log('🔧 DataStore: 找到圖層', layer.layerName, '當前狀態:', layer.visible);
      // 切換可見性狀態
      layer.visible = !layer.visible;
      console.log('🔧 DataStore: 新狀態:', layer.visible);

      // 如果圖層被開啟且尚未載入，則載入資料（分析圖層除外）
      if (
        layer.visible &&
        !layer.isLoaded &&
        !layer.isLoading &&
        !layer.isAnalysisLayer &&
        !layer.isIsochroneAnalysisLayer
      ) {
        try {
          layer.isLoading = true;
          const result = await layer.loader(layer);

          // 將載入的資料直接存儲在圖層物件中
          layer.geoJsonData = result.geoJsonData;
          layer.tableData = result.tableData;
          layer.summaryData = result.summaryData;
          layer.legendData = result.legendData || null;
          layer.isLoaded = true;

          // 🔄 強制觸發響應式更新
          console.log(
            `✅ 圖層 "${layer.layerName}" 載入完成 (${result.geoJsonData?.features?.length || 0} 筆資料)`
          );
          console.log(`📊 圖層摘要資料:`, layer.summaryData);
        } catch (error) {
          console.error(`Failed to load data for layer "${layer.layerName}":`, error);
          layer.visible = false; // 載入失敗時恢復可見性狀態
        } finally {
          layer.isLoading = false;
        }
      }
    };

    /**
     * 指定分組（如「年度」「事業」）：一鍵全部開啟或全部關閉（若目前已全開則關閉，否則開啟並載入未載入圖層）
     */
    /**
     * @param {string} groupName
     * @param {{ layerPredicate?: (layer: object) => boolean }} [options] 若提供，只對通過 predicate 的圖層切換（其餘圖層不變）
     */
    const toggleAllLayersInGroup = async (groupName, options = {}) => {
      const { layerPredicate } = options;
      const group = layers.value.find((g) => g.groupName === groupName);
      if (!group?.groupLayers?.length) return;

      let list = group.groupLayers.filter((l) => l.showInLayerPanel !== false);
      if (typeof layerPredicate === 'function') {
        list = list.filter(layerPredicate);
      }
      if (!list.length) return;

      const allVisible = list.every((l) => l.visible);
      const targetVisible = !allVisible;

      for (const layer of list) {
        layer.visible = targetVisible;
      }

      if (!targetVisible) return;

      const toLoad = list.filter(
        (l) =>
          l.visible &&
          !l.isLoaded &&
          !l.isLoading &&
          l.loader &&
          !l.isAnalysisLayer &&
          !l.isIsochroneAnalysisLayer
      );

      await Promise.all(
        toLoad.map(async (layer) => {
          try {
            layer.isLoading = true;
            const result = await layer.loader(layer);
            layer.geoJsonData = result.geoJsonData;
            layer.tableData = result.tableData;
            layer.summaryData = result.summaryData;
            layer.legendData = result.legendData || null;
            layer.isLoaded = true;
          } catch (error) {
            console.error(`Failed to load data for layer "${layer.layerName}":`, error);
            layer.visible = false;
          } finally {
            layer.isLoading = false;
          }
        })
      );
    };

    // ------------------------------------------------------------
    // 選中的地圖物件
    const selectedFeature = ref(null);

    const setSelectedFeature = (feature) => {
      selectedFeature.value = feature;
    };

    const clearSelectedFeature = () => {
      selectedFeature.value = null;
    };

    // 🧮 計算兩點間距離 (Calculate Distance Between Two Points)
    // 使用 Haversine 公式計算地球表面兩點間的距離（公尺）
    const calculateDistance = (lat1, lng1, lat2, lng2) => {
      const R = 6371000; // 地球半徑（公尺）
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // 距離（公尺）
    };

    // 🔍 計算範圍內的點物件 (Calculate Points Within Range)
    const calculatePointsInRange = (centerLat, centerLng, radiusMeters = 2000) => {
      const pointsInRange = [];

      // 獲取所有可見且已載入的點類型圖層
      const visiblePointLayers = getAllLayers().filter(
        (layer) =>
          layer.visible &&
          layer.isLoaded &&
          layer.type === 'point' &&
          !layer.isAnalysisLayer &&
          !layer.isIsochroneAnalysisLayer &&
          layer.geoJsonData
      );

      console.log(
        '🔍 檢查可見的點圖層:',
        visiblePointLayers.map((l) => l.layerName)
      );

      visiblePointLayers.forEach((layer) => {
        if (layer.geoJsonData && layer.geoJsonData.features) {
          layer.geoJsonData.features.forEach((feature) => {
            if (feature.geometry.type === 'Point') {
              const [lng, lat] = feature.geometry.coordinates;
              const distance = calculateDistance(centerLat, centerLng, lat, lng);

              if (distance <= radiusMeters) {
                // 創建增強的 feature 物件，包含距離和圖層資訊
                const enhancedFeature = {
                  ...feature, // 保留原始 feature 的所有屬性
                  layerId: layer.layerId,
                  layerName: layer.layerName,
                  distance: Math.round(distance), // 添加距離資訊
                };
                pointsInRange.push(enhancedFeature);
              }
            }
          });
        }
      });

      // 按距離排序
      pointsInRange.sort((a, b) => a.distance - b.distance);

      console.log(`🎯 在 ${radiusMeters / 1000}公里範圍內找到 ${pointsInRange.length} 個點物件`);
      return pointsInRange;
    };

    const calculatePolygonInRange = (centerLat, centerLng, radiusMeters = 2000) => {
      const polygonInRange = [];

      // 獲取所有可見且已載入的區域類型圖層
      const visiblePolygonLayers = getAllLayers().filter(
        (layer) =>
          layer.visible &&
          layer.isLoaded &&
          layer.type === 'polygon' &&
          !layer.isAnalysisLayer &&
          !layer.isIsochroneAnalysisLayer &&
          layer.geoJsonData
      );

      console.log(
        '🔍 檢查可見的多邊形圖層:',
        visiblePolygonLayers.map((l) => l.layerName)
      );

      visiblePolygonLayers.forEach((layer) => {
        if (layer.geoJsonData && layer.geoJsonData.features) {
          layer.geoJsonData.features.forEach((feature) => {
            if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
              // 檢查多邊形是否與圓圈有重疊
              const hasOverlap = checkPolygonCircleOverlap(
                feature.geometry,
                centerLat,
                centerLng,
                radiusMeters
              );

              if (hasOverlap) {
                // 創建增強的 feature 物件，包含圖層資訊
                const enhancedFeature = {
                  ...feature, // 保留原始 feature 的所有屬性
                  layerId: layer.layerId,
                  layerName: layer.layerName,
                  overlapType: 'intersects', // 標記為相交
                };
                polygonInRange.push(enhancedFeature);
              }
            }
          });
        }
      });

      console.log(
        `🎯 在 ${radiusMeters / 1000}公里範圍內找到 ${polygonInRange.length} 個重疊多邊形`
      );
      return polygonInRange;
    };

    // 檢查多邊形與圓圈是否重疊的函數
    const checkPolygonCircleOverlap = (geometry, centerLat, centerLng, radiusMeters) => {
      const coordinates =
        geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

      for (const polygon of coordinates) {
        for (const ring of polygon) {
          for (const [lng, lat] of ring) {
            const distance = calculateDistance(centerLat, centerLng, lat, lng);
            if (distance <= radiusMeters) {
              return true; // 如果任何一個頂點在圓內，就認為有重疊
            }
          }
        }
      }

      // 也可以檢查圓心是否在多邊形內，但這裡簡化處理
      return false;
    };

    // 分析圖層管理方法
    const updateAnalysisLayerData = (analysisLayer) => {
      // 獲取所有分析圓圈
      const analysisCircles = analysisLayer.geoJsonData.features.filter(
        (f) => f.properties.type === 'circle-analysis'
      );

      // 更新 summaryData
      analysisLayer.summaryData = {
        totalCount: analysisCircles.length,
      };

      // 更新 tableData
      analysisLayer.tableData = analysisCircles.map((feature) => ({
        '#': feature.properties.id,
        名稱: feature.properties.name,
        範圍內點位數: feature.properties.pointsInRange.length,
        範圍內面域數: feature.properties.polygonInRange.length,
      }));
    };

    // 等時圈分析圖層管理方法
    /**
     * 更新等時圈分析圖層的統計數據和表格數據
     *
     * @description 此函數負責更新等時圈分析圖層的所有統計資訊，
     * 包括摘要數據（summaryData）和表格數據（tableData）。
     * 支援兩種類型的等時圈要素：真實的多邊形和回退的圓圈。
     *
     * @param {Object} isochroneLayer - 等時圈分析圖層物件
     *
     * @note 此函數會在以下情況被調用：
     * 1. 新增等時圈分析點後
     * 2. 刪除等時圈分析點後
     * 3. 清空等時圈分析圖層後
     *
     * @example
     * const isochroneLayer = findLayerById('isochrone-analysis-layer');
     * updateIsochroneAnalysisLayerData(isochroneLayer);
     */
    const updateIsochroneAnalysisLayerData = (isochroneLayer) => {
      // 獲取所有等時圈分析要素（包括多邊形和圓圈兩種類型）
      const isochroneFeatures = isochroneLayer.geoJsonData.features.filter(
        (f) =>
          f.properties.type === 'isochrone-circle-analysis' || // 回退模式的圓圈
          f.properties.type === 'isochrone-polygon-analysis' // API 模式的多邊形
      );

      // 更新摘要統計數據
      isochroneLayer.summaryData = {
        totalCount: isochroneFeatures.length, // 總等時圈分析數量
      };

      // 更新表格顯示數據（用於 DataTableTab）
      isochroneLayer.tableData = isochroneFeatures.map((feature) => ({
        '#': feature.properties.id, // 分析編號
        名稱: feature.properties.name, // 分析名稱
        // 根據要素類型顯示不同的標籤
        類型:
          feature.properties.type === 'isochrone-polygon-analysis'
            ? '等時圈多邊形' // 來自 ORS API 的真實等時圈
            : '預估圓圈', // 回退模式的圓圈分析
        // 顯示車程時間或預估標籤
        車程時間: feature.properties.travelTime ? `${feature.properties.travelTime}分鐘` : '預估',
        // 範圍內的點設施數量
        範圍內點位數: feature.properties.pointsInRange
          ? feature.properties.pointsInRange.length
          : 0,
        // 範圍內的多邊形區域數量
        範圍內面域數: feature.properties.polygonInRange
          ? feature.properties.polygonInRange.length
          : 0,
      }));
    };

    const addAnalysisPoint = (lat, lng, radius = 2000) => {
      const analysisLayer = findLayerById('analysis-layer');
      if (!analysisLayer) return;

      const pointId =
        analysisLayer.geoJsonData.features.filter((f) => f.properties.type === 'point-analysis')
          .length + 1;

      // 🎯 計算範圍內的點物件
      const pointsInRange = calculatePointsInRange(lat, lng, radius);

      // 🎯 計算範圍內的多邊形物件
      const polygonInRange = calculatePolygonInRange(lat, lng, radius);

      // 📊 統計各圖層的點數
      const layerStats = {};
      pointsInRange.forEach((feature) => {
        if (!layerStats[feature.layerName]) {
          layerStats[feature.layerName] = 0;
        }
        layerStats[feature.layerName]++;
      });

      // 📊 統計各圖層的多邊形數
      const polygonStats = {};
      polygonInRange.forEach((feature) => {
        if (!polygonStats[feature.layerName]) {
          polygonStats[feature.layerName] = 0;
        }
        polygonStats[feature.layerName]++;
      });

      const featureName = `分析範圍 ${pointId}`;

      // 創建圓圈要素（主要交互物件）
      const circleFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          id: pointId,
          layerId: 'analysis-layer', // 添加圖層ID
          type: 'circle-analysis',
          name: featureName,
          radius: radius,
          pointsInRange: pointsInRange, // 存儲範圍內的點物件
          polygonInRange: polygonInRange, // 存儲範圍內的多邊形物件
          layerStats: layerStats, // 存儲各圖層統計
          polygonStats: polygonStats, // 存儲各多邊形圖層統計
          // 添加 propertyData 供 PropertiesTab 使用
          propertyData: {
            名稱: featureName,
            範圍內點位數: pointsInRange.length,
            範圍內多邊形數: polygonInRange.length,
            分析範圍半徑: `${(radius / 1000).toFixed(1)} 公里`,
          },
        },
      };

      // 創建分析點要素（僅用於顯示位置標記）
      const pointFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          id: `${pointId}_analysis_point`,
          layerId: 'analysis-layer',
          type: 'point-analysis',
          parentId: pointId,
        },
      };

      // 添加到分析圖層（圓圈在前，點在後，這樣圓圈會在下層，點在上層）
      analysisLayer.geoJsonData.features.push(circleFeature, pointFeature);

      // 更新圖層統計和表格數據
      updateAnalysisLayerData(analysisLayer);

      // 🎯 輸出範圍內點位物件的詳細信息
      // if (pointsInRange.length > 0) {
      //   console.log('🎯 範圍內的點物件:', pointsInRange);
      // }

      return {
        pointId,
        pointsInRange,
        polygonInRange,
        layerStats,
        polygonStats,
      };
    };

    // 🌐 調用 OpenRouteService API 獲取等時圈數據
    /**
     * 從 OpenRouteService API 獲取等時圈（Isochrone）數據
     *
     * @description 此函數向 ORS API 發送請求，獲取從指定起點在指定時間內可到達的所有區域
     * 等時圈是指從某一點出發，在相同時間內可以到達的所有地點連成的邊界線
     *
     * @param {number} lat - 起點緯度（WGS84 坐標系）
     * @param {number} lng - 起點經度（WGS84 坐標系）
     * @param {number} travelTimeMinutes - 旅行時間（分鐘），默認為 10 分鐘
     *
     * @returns {Promise<Object>} 返回 GeoJSON 格式的等時圈數據
     * @throws {Error} 當 API 調用失敗時拋出錯誤
     *
     * @example
     * // 獲取台北 101 周邊 15 分鐘車程的等時圈
     * const isochrone = await fetchIsochroneData(25.034, 121.565, 15);
     */
    const fetchIsochroneData = async (lat, lng, travelTimeMinutes = 10) => {
      // OpenRouteService API 金鑰（免費額度：每日 2000 次請求）
      const apiKey = '5b3ce3597851110001cf6248cd3e1a052bec45bc8410b037091bb766';

      // ORS API 要求坐標格式為 [經度, 緯度]（與常見的 [緯度, 經度] 相反）
      const startPoint = [lng, lat];

      try {
        // 向 ORS Isochrones API 發送 POST 請求
        // https://openrouteservice.org/dev/#/api-docs/v2/isochrones/{profile}/post
        const response = await fetch(
          'https://api.openrouteservice.org/v2/isochrones/driving-car', // driving-car // cycling-electric
          {
            method: 'POST',
            headers: {
              // API 身份驗證標頭
              Authorization: apiKey,
              // 指定請求內容類型為 JSON
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              // 起點坐標陣列（可以同時計算多個起點，這裡只有一個）
              locations: [startPoint],
              // 時間範圍陣列，單位為秒（可以同時計算多個時間範圍）
              range: [travelTimeMinutes * 60],
              // 範圍類型：'time' 表示時間等時圈，'distance' 表示距離等時圈
              range_type: 'time',
            }),
          }
        );

        // 檢查 HTTP 響應狀態
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 解析 JSON 響應數據
        const data = await response.json();

        // 返回的數據格式為 GeoJSON FeatureCollection
        // 包含一個或多個 Polygon 要素，代表等時圈區域
        return data;
      } catch (error) {
        console.error('獲取等時圈數據失敗:', error);
        throw error;
      }
    };

    // 🎯 計算等時圈多邊形範圍內的點物件
    /**
     * 計算等時圈多邊形範圍內的所有點物件（長照設施等）
     *
     * @description 此函數遍歷所有可見的點圖層，檢查每個點是否位於等時圈多邊形內部
     * 使用射線投射算法（Ray Casting Algorithm）判斷點是否在多邊形內
     *
     * @param {Object} isochroneData - 來自 ORS API 的等時圈 GeoJSON 數據
     * @param {number} centerLat - 等時圈中心點緯度（用於計算距離）
     * @param {number} centerLng - 等時圈中心點經度（用於計算距離）
     *
     * @returns {Array} 包含所有在等時圈內的點物件陣列，每個物件包含：
     *   - 原始 GeoJSON feature 數據
     *   - layerId: 圖層 ID
     *   - layerName: 圖層名稱
     *   - distance: 與中心點的直線距離（公尺）
     *
     * @example
     * const pointsInRange = calculatePointsInIsochronePolygon(isochroneData, 25.034, 121.565);
     * console.log(`找到 ${pointsInRange.length} 個設施`);
     */
    const calculatePointsInIsochronePolygon = (isochroneData, centerLat, centerLng) => {
      const pointsInRange = [];

      // 檢查等時圈數據是否有效
      if (!isochroneData.features || isochroneData.features.length === 0) {
        console.warn('等時圈數據無效或為空');
        return pointsInRange;
      }

      // 取得第一個（通常也是唯一的）等時圈多邊形
      const isochronePolygon = isochroneData.features[0];

      // 獲取所有符合條件的點圖層：
      // 1. 必須是可見的 (visible = true)
      // 2. 必須已載入數據 (isLoaded = true)
      // 3. 必須是點類型 (type = 'point')
      // 4. 排除分析圖層（避免計算分析點本身）
      // 5. 必須有實際的 GeoJSON 數據
      const visiblePointLayers = getAllLayers().filter(
        (layer) =>
          layer.visible &&
          layer.isLoaded &&
          layer.type === 'point' &&
          !layer.isAnalysisLayer &&
          !layer.isIsochroneAnalysisLayer &&
          layer.geoJsonData
      );

      console.log(
        '🔍 檢查等時圈範圍內的點圖層:',
        visiblePointLayers.map((l) => l.layerName)
      );

      // 🚨 診斷：如果沒有找到符合條件的點圖層，提供詳細的診斷資訊
      if (visiblePointLayers.length === 0) {
        console.warn('⚠️ 沒有找到符合條件的點圖層進行等時圈分析！');

        // 檢查所有點圖層的狀態
        const allPointLayers = getAllLayers().filter((layer) => layer.type === 'point');
        console.log('📊 所有點圖層狀態診斷:');
        allPointLayers.forEach((layer) => {
          const status = [];
          if (!layer.visible) status.push('不可見');
          if (!layer.isLoaded) status.push('未載入');
          if (!layer.geoJsonData) status.push('無數據');

          console.log(
            `  - ${layer.layerName}: ${status.length > 0 ? status.join(', ') : '✅ 符合條件'}`
          );
        });

        console.log('💡 解決方案：');
        console.log('   1. 在左側圖層面板中開啟至少一個年度圖層（例如「113年」）');
        console.log('   2. 等待圖層載入完成後再進行等時圈分析');
        console.log('   3. 或者可以考慮自動載入相關圖層');

        return pointsInRange;
      }

      // 遍歷每個符合條件的圖層
      visiblePointLayers.forEach((layer) => {
        if (layer.geoJsonData && layer.geoJsonData.features) {
          // 遍歷圖層中的每個地理要素
          layer.geoJsonData.features.forEach((feature) => {
            // 只處理點類型的要素
            if (feature.geometry.type === 'Point') {
              // 取得點的坐標 [經度, 緯度]
              const [lng, lat] = feature.geometry.coordinates;

              // 使用點在多邊形內判斷算法檢查此點是否在等時圈內
              if (isPointInPolygon([lng, lat], isochronePolygon.geometry)) {
                // 計算點與等時圈中心的直線距離（雖然不是實際行車距離，但可作為參考）
                const distance = calculateDistance(centerLat, centerLng, lat, lng);

                // 創建增強的要素物件，包含原始數據和額外資訊
                const enhancedFeature = {
                  ...feature, // 保留原始 GeoJSON feature 的所有屬性
                  layerId: layer.layerId, // 添加圖層 ID
                  layerName: layer.layerName, // 添加圖層名稱（供顯示用）
                  distance: Math.round(distance), // 添加與中心點的距離（四捨五入到公尺）
                };
                pointsInRange.push(enhancedFeature);
              }
            }
          });
        }
      });

      // 按與中心點的距離排序（最近的在前面）
      pointsInRange.sort((a, b) => a.distance - b.distance);

      console.log(`🎯 在等時圈範圍內找到 ${pointsInRange.length} 個點物件`);
      return pointsInRange;
    };

    // 🎯 計算等時圈多邊形範圍內的多邊形物件
    /**
     * 計算與等時圈多邊形有重疊的所有多邊形物件（如行政區界、統計區域等）
     *
     * @description 此函數檢查所有可見的多邊形圖層，找出與等時圈有交集的多邊形
     * 使用簡化的重疊檢測算法：檢查多邊形頂點是否有任何一個落在等時圈內
     *
     * @param {Object} isochroneData - 來自 ORS API 的等時圈 GeoJSON 數據
     *
     * @returns {Array} 包含所有與等時圈重疊的多邊形物件陣列，每個物件包含：
     *   - 原始 GeoJSON feature 數據
     *   - layerId: 圖層 ID
     *   - layerName: 圖層名稱
     *   - overlapType: 重疊類型（'intersects'）
     *
     * @example
     * const overlappingPolygons = calculatePolygonInIsochronePolygon(isochroneData);
     * console.log(`找到 ${overlappingPolygons.length} 個重疊的行政區`);
     */
    const calculatePolygonInIsochronePolygon = (isochroneData) => {
      const polygonInRange = [];

      // 檢查等時圈數據是否有效
      if (!isochroneData.features || isochroneData.features.length === 0) {
        console.warn('等時圈數據無效或為空，無法計算多邊形重疊');
        return polygonInRange;
      }

      // 取得第一個等時圈多邊形
      const isochronePolygon = isochroneData.features[0];

      // 獲取所有符合條件的多邊形圖層：
      // 1. 必須是可見的 (visible = true)
      // 2. 必須已載入數據 (isLoaded = true)
      // 3. 必須是多邊形類型 (type = 'polygon')
      // 4. 排除分析圖層（避免與分析多邊形本身比較）
      // 5. 必須有實際的 GeoJSON 數據
      const visiblePolygonLayers = getAllLayers().filter(
        (layer) =>
          layer.visible &&
          layer.isLoaded &&
          layer.type === 'polygon' &&
          !layer.isAnalysisLayer &&
          !layer.isIsochroneAnalysisLayer &&
          layer.geoJsonData
      );

      // 遍歷每個符合條件的多邊形圖層
      visiblePolygonLayers.forEach((layer) => {
        if (layer.geoJsonData && layer.geoJsonData.features) {
          // 遍歷圖層中的每個地理要素
          layer.geoJsonData.features.forEach((feature) => {
            // 只處理 Polygon 和 MultiPolygon 類型的要素
            if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
              // 檢查此多邊形是否與等時圈有重疊
              const hasOverlap = checkPolygonIsochroneOverlap(
                feature.geometry,
                isochronePolygon.geometry
              );

              if (hasOverlap) {
                // 創建增強的要素物件，包含重疊資訊
                const enhancedFeature = {
                  ...feature, // 保留原始 GeoJSON feature 的所有屬性
                  layerId: layer.layerId, // 添加圖層 ID
                  layerName: layer.layerName, // 添加圖層名稱
                  overlapType: 'intersects', // 標記重疊類型
                };
                polygonInRange.push(enhancedFeature);
              }
            }
          });
        }
      });

      console.log(`🎯 在等時圈範圍內找到 ${polygonInRange.length} 個重疊多邊形`);
      return polygonInRange;
    };

    // 檢查點是否在多邊形內（射線投射算法）
    /**
     * 使用射線投射算法（Ray Casting Algorithm）判斷點是否在多邊形內部
     *
     * @description 此算法的基本原理：
     * 1. 從測試點向任意方向（通常是水平向右）發射一條射線
     * 2. 計算射線與多邊形邊界的交點數量
     * 3. 如果交點數量為奇數，則點在多邊形內；偶數則在外
     *
     * @param {Array} point - 測試點坐標 [經度, 緯度]
     * @param {Object} polygon - GeoJSON 多邊形幾何物件
     *
     * @returns {boolean} true 表示點在多邊形內，false 表示在外
     *
     * @example
     * const isInside = isPointInPolygon([121.565, 25.034], polygonGeometry);
     * console.log(isInside ? '在多邊形內' : '在多邊形外');
     *
     * @note 此實現為簡化版本，僅處理多邊形的外環，未考慮內環（洞）
     */
    const isPointInPolygon = (point, polygon) => {
      const [x, y] = point; // 測試點的 x, y 坐標
      let coordinates;

      // 根據多邊形類型獲取坐標陣列
      if (polygon.type === 'Polygon') {
        // 單一多邊形：取外環坐標（第一個陣列）
        coordinates = polygon.coordinates[0];
      } else if (polygon.type === 'MultiPolygon') {
        // 多重多邊形：取第一個多邊形的外環坐標
        coordinates = polygon.coordinates[0][0];
      } else {
        // 不支援的幾何類型
        console.warn(`不支援的多邊形類型: ${polygon.type}`);
        return false;
      }

      let inside = false; // 初始假設點在多邊形外

      // 遍歷多邊形的每條邊
      for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
        const [xi, yi] = coordinates[i]; // 當前頂點
        const [xj, yj] = coordinates[j]; // 前一個頂點

        // 檢查射線是否與此邊相交
        // 條件：
        // 1. 邊的兩個端點 y 坐標一個在測試點上方，一個在下方
        // 2. 交點的 x 坐標在測試點右側
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside; // 每次相交都切換內外狀態
        }
      }

      return inside;
    };

    // 檢查多邊形與等時圈是否重疊（簡化版本）
    /**
     * 檢查兩個多邊形是否有重疊或相交
     *
     * @description 此函數使用簡化的重疊檢測算法：
     * 檢查測試多邊形的所有頂點，如果有任何一個頂點落在等時圈多邊形內，
     * 就認為兩個多邊形有重疊。這是一個快速但不完美的方法。
     *
     * @param {Object} polygon - 要檢測的多邊形幾何物件
     * @param {Object} isochronePolygon - 等時圈多邊形幾何物件
     *
     * @returns {boolean} true 表示有重疊，false 表示無重疊
     *
     * @note 限制：
     * 1. 此方法只檢查頂點，可能遺漏某些邊緣相交的情況
     * 2. 不處理一個多邊形完全包含另一個的情況
     * 3. 完整的多邊形相交算法會更複雜，需要考慮所有邊的交點
     *
     * @example
     * const hasOverlap = checkPolygonIsochroneOverlap(districtGeometry, isochroneGeometry);
     * if (hasOverlap) console.log('行政區與等時圈有重疊');
     */
    const checkPolygonIsochroneOverlap = (polygon, isochronePolygon) => {
      let coordinates;

      // 根據多邊形類型獲取坐標陣列
      if (polygon.type === 'Polygon') {
        // 單一多邊形：取外環坐標
        coordinates = polygon.coordinates[0];
      } else if (polygon.type === 'MultiPolygon') {
        // 多重多邊形：取第一個多邊形的外環坐標
        coordinates = polygon.coordinates[0][0];
      } else {
        // 不支援的幾何類型
        console.warn(`不支援的多邊形類型用於重疊檢測: ${polygon.type}`);
        return false;
      }

      // 遍歷多邊形的所有頂點
      for (const [lng, lat] of coordinates) {
        // 如果任何一個頂點在等時圈內，就認為有重疊
        if (isPointInPolygon([lng, lat], isochronePolygon)) {
          return true;
        }
      }

      // 所有頂點都在等時圈外，認為無重疊
      // 注意：這可能會遺漏某些邊緣相交的情況
      return false;
    };

    /**
     * 自動載入重要的長照設施圖層用於等時圈分析
     *
     * @description 為了確保等時圈分析能夠計算到範圍內的設施，
     * 此函數會自動載入一些重要的長照相關圖層
     *
     * @returns {Promise<void>} 完成所有圖層載入的 Promise
     */
    const autoLoadImportantLayersForAnalysis = async () => {
      const importantLayerIds = primaryCarbonReportLayerId.value
        ? [primaryCarbonReportLayerId.value]
        : [];

      const layersToLoad = [];

      // 檢查哪些重要圖層需要載入
      importantLayerIds.forEach((layerId) => {
        const layer = findLayerById(layerId);
        if (layer && !layer.isLoaded && !layer.isLoading) {
          layersToLoad.push(layer);
        }
      });

      if (importantLayerIds.length === 0) {
        return;
      }
      if (layersToLoad.length === 0) {
        console.log('✅ 重要圖層已經載入，無需額外載入');
        return;
      }

      console.log(
        `🚀 自動載入 ${layersToLoad.length} 個重要圖層用於等時圈分析:`,
        layersToLoad.map((l) => l.layerName)
      );

      const loadPromises = layersToLoad.map(async (layer) => {
        try {
          layer.isLoading = true;
          layer.visible = true;

          if (layer.loader) {
            const data = await layer.loader(layer);
            layer.geoJsonData = data.geoJsonData;
            layer.summaryData = data.summaryData;
            layer.tableData = data.tableData;
            layer.legendData = data.legendData;
            layer.isLoaded = true;
            console.log(`✅ 已載入圖層: ${layer.layerName}`);
          }
        } catch (error) {
          console.error(`❌ 載入圖層失敗: ${layer.layerName}`, error);
        } finally {
          layer.isLoading = false;
        }
      });

      await Promise.all(loadPromises);
      console.log('🎉 重要圖層載入完成，可以進行等時圈分析');
    };

    /**
     * 添加等時圈分析點 - 核心功能函數
     *
     * @description 這是等時圈分析功能的主要入口點。此函數會：
     * 1. 調用 OpenRouteService API 獲取真實的等時圈數據
     * 2. 計算等時圈範圍內的所有長照設施和相關區域
     * 3. 創建可視化的等時圈多邊形和分析點
     * 4. 生成統計數據和報告
     * 5. 在 API 失敗時提供回退方案
     *
     * @param {number} lat - 分析起點的緯度（WGS84 坐標系）
     * @param {number} lng - 分析起點的經度（WGS84 坐標系）
     * @param {number} travelTimeMinutes - 等時圈時間範圍（分鐘），預設 10 分鐘
     *
     * @returns {Promise<Object>} 分析結果物件，包含：
     *   - pointId: 分析點編號
     *   - pointsInRange: 範圍內的點設施陣列
     *   - polygonInRange: 範圍內的多邊形區域陣列
     *   - layerStats: 各圖層的統計數據
     *   - polygonStats: 多邊形圖層的統計數據
     *   - isochroneData: 原始等時圈 API 數據
     *
     * @throws {Error} 當 API 調用失敗且回退方案也失敗時拋出錯誤
     *
     * @example
     * // 在台北 101 創建 15 分鐘車程的等時圈分析
     * const result = await addIsochroneAnalysisPoint(25.034, 121.565, 15);
     * console.log(`找到 ${result.pointsInRange.length} 個長照設施`);
     */
    const addIsochroneAnalysisPoint = async (lat, lng, travelTimeMinutes = 10) => {
      // 獲取等時圈分析圖層實例
      const isochroneLayer = findLayerById('isochrone-analysis-layer');
      if (!isochroneLayer) {
        console.error('找不到等時圈分析圖層');
        return;
      }

      // 🚀 自動載入重要的長照設施圖層
      await autoLoadImportantLayersForAnalysis();

      // 計算新的分析點編號（基於現有分析點數量）
      const pointId =
        isochroneLayer.geoJsonData.features.filter(
          (f) => f.properties.type === 'isochrone-point-analysis'
        ).length + 1;

      try {
        // 🚀 第一階段：調用 OpenRouteService API 獲取等時圈數據
        isochroneLayer.isLoading = true; // 設置圖層加載狀態，用於 UI 顯示
        console.log(`🌐 正在獲取 ${travelTimeMinutes} 分鐘車程的等時圈數據...`);

        // 調用 ORS API 獲取實際的等時圈多邊形
        const isochroneData = await fetchIsochroneData(lat, lng, travelTimeMinutes);

        // 🎯 第二階段：基於等時圈多邊形計算範圍內的設施和區域
        const pointsInRange = calculatePointsInIsochronePolygon(isochroneData, lat, lng);
        const polygonInRange = calculatePolygonInIsochronePolygon(isochroneData);

        // 📊 第三階段：統計各圖層的設施數量
        const layerStats = {};
        pointsInRange.forEach((feature) => {
          if (!layerStats[feature.layerName]) {
            layerStats[feature.layerName] = 0;
          }
          layerStats[feature.layerName]++;
        });

        // 📊 統計各多邊形圖層的重疊數量
        const polygonStats = {};
        polygonInRange.forEach((feature) => {
          if (!polygonStats[feature.layerName]) {
            polygonStats[feature.layerName] = 0;
          }
          polygonStats[feature.layerName]++;
        });

        // 🏷️ 第四階段：創建分析結果的顯示名稱
        const featureName = `等時分析範圍 ${pointId} (${travelTimeMinutes}分鐘車程)`;

        // 🗺️ 第五階段：創建等時圈多邊形要素（用於地圖顯示）
        const isochronePolygonFeature = {
          type: 'Feature',
          geometry: isochroneData.features[0].geometry, // 直接使用 ORS API 返回的多邊形幾何
          properties: {
            id: pointId, // 唯一識別編號
            layerId: 'isochrone-analysis-layer', // 所屬圖層
            type: 'isochrone-polygon-analysis', // 要素類型標記
            name: featureName, // 顯示名稱
            travelTime: travelTimeMinutes, // 旅行時間
            pointsInRange: pointsInRange, // 範圍內的點設施
            polygonInRange: polygonInRange, // 範圍內的多邊形區域
            layerStats: layerStats, // 圖層統計
            polygonStats: polygonStats, // 多邊形統計
            // 為屬性面板準備的格式化數據
            propertyData: {
              名稱: featureName,
              車程時間: `${travelTimeMinutes} 分鐘`,
              範圍內點位數: pointsInRange.length,
              範圍內多邊形數: polygonInRange.length,
            },
          },
        };

        // 📍 創建等時圈分析點要素（用於標記分析起點）
        const pointFeature = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat], // 分析起點坐標
          },
          properties: {
            id: `${pointId}_isochrone_analysis_point`, // 唯一識別編號
            layerId: 'isochrone-analysis-layer',
            type: 'isochrone-point-analysis', // 點標記類型
            parentId: pointId, // 關聯的多邊形 ID
          },
        };

        // 🔄 第六階段：將新創建的要素添加到圖層
        isochroneLayer.geoJsonData.features.push(isochronePolygonFeature, pointFeature);

        // 📊 更新圖層統計和表格數據
        updateIsochroneAnalysisLayerData(isochroneLayer);

        console.log(`✅ 成功創建等時圈分析 ${pointId}，包含 ${pointsInRange.length} 個點位`);

        // 返回完整的分析結果
        return {
          pointId,
          pointsInRange,
          polygonInRange,
          layerStats,
          polygonStats,
          isochroneData,
        };
      } catch (error) {
        console.error('創建等時圈分析失敗:', error);
        // 🔄 錯誤處理：API 失敗時回退到簡單圓圈分析
        console.log('🔄 回退到簡單圓圈分析模式');
        return addSimpleIsochroneAnalysisPoint(lat, lng, pointId);
      } finally {
        // 🧹 清理：無論成功或失敗都要清除加載狀態
        isochroneLayer.isLoading = false;
      }
    };

    // 🔄 回退方案：簡單圓圈分析（當 API 失敗時使用）
    /**
     * 簡單圓圈分析 - API 失敗時的回退方案
     *
     * @description 當 OpenRouteService API 調用失敗時（如網路錯誤、API 限制等），
     * 使用此函數提供基本的分析功能。以指定半徑的圓圈代替等時圈多邊形，
     * 雖然不如真實等時圈精確，但仍能提供基本的距離分析。
     *
     * @param {number} lat - 分析起點緯度
     * @param {number} lng - 分析起點經度
     * @param {number} pointId - 分析點編號
     *
     * @returns {Object} 簡化的分析結果物件
     *
     * @note 使用固定的 3 公里半徑作為預估等時圈範圍
     * 這個距離大約對應 10-15 分鐘的車程（視交通狀況而定）
     */
    const addSimpleIsochroneAnalysisPoint = (lat, lng, pointId) => {
      const isochroneLayer = findLayerById('isochrone-analysis-layer');
      if (!isochroneLayer) {
        console.error('回退方案：找不到等時圈分析圖層');
        return;
      }

      // 使用原有的圓圈範圍計算函數，半徑設為 3 公里
      const FALLBACK_RADIUS = 3000; // 3 公里，作為等時圈的粗略估計

      console.log('🔄 回退模式：使用圓圈分析計算範圍內設施');
      const pointsInRange = calculatePointsInRange(lat, lng, FALLBACK_RADIUS);
      const polygonInRange = calculatePolygonInRange(lat, lng, FALLBACK_RADIUS);

      console.log(
        `🔄 回退模式結果：找到 ${pointsInRange.length} 個點設施，${polygonInRange.length} 個多邊形區域`
      );

      // 統計各圖層的設施數量
      const layerStats = {};
      pointsInRange.forEach((feature) => {
        if (!layerStats[feature.layerName]) {
          layerStats[feature.layerName] = 0;
        }
        layerStats[feature.layerName]++;
      });

      // 統計各多邊形圖層的重疊數量
      const polygonStats = {};
      polygonInRange.forEach((feature) => {
        if (!polygonStats[feature.layerName]) {
          polygonStats[feature.layerName] = 0;
        }
        polygonStats[feature.layerName]++;
      });

      // 創建回退模式的顯示名稱
      const featureName = `等時分析範圍 ${pointId} (預估範圍)`;

      // 創建圓圈要素（回退模式下的視覺表示）
      const circleFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point', // 使用點幾何，在渲染時轉換為圓圈
          coordinates: [lng, lat],
        },
        properties: {
          id: pointId,
          layerId: 'isochrone-analysis-layer',
          type: 'isochrone-circle-analysis', // 標記為圓圈類型（非多邊形）
          name: featureName,
          radius: FALLBACK_RADIUS, // 圓圈半徑
          pointsInRange: pointsInRange,
          polygonInRange: polygonInRange,
          layerStats: layerStats,
          polygonStats: polygonStats,
          // 屬性面板數據（簡化版）
          propertyData: {
            名稱: featureName,
            範圍內點位數: pointsInRange.length,
            範圍內多邊形數: polygonInRange.length,
          },
        },
      };

      // 創建分析點標記
      const pointFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          id: `${pointId}_isochrone_analysis_point`,
          layerId: 'isochrone-analysis-layer',
          type: 'isochrone-point-analysis',
          parentId: pointId,
        },
      };

      // 添加要素到圖層
      isochroneLayer.geoJsonData.features.push(circleFeature, pointFeature);

      // 更新圖層統計
      updateIsochroneAnalysisLayerData(isochroneLayer);

      console.log(
        `🔄 回退方案：創建 ${FALLBACK_RADIUS / 1000}km 圓圈分析，包含 ${pointsInRange.length} 個點位`
      );

      return {
        pointId,
        pointsInRange,
        polygonInRange,
        layerStats,
        polygonStats,
      };
    };

    const clearAnalysisLayer = () => {
      const analysisLayer = findLayerById('analysis-layer');
      if (analysisLayer) {
        analysisLayer.geoJsonData.features = [];

        // 更新圖層統計和表格數據
        updateAnalysisLayerData(analysisLayer);

        console.log('🗑️ 清除分析圖層數據');
      }
    };

    /**
     * 清除等時圈分析圖層的所有數據
     *
     * @description 此函數會移除等時圈分析圖層中的所有分析結果，
     * 包括等時圈多邊形、分析點標記和相關統計數據。
     * 通常在使用者需要重新開始分析或清空地圖時調用。
     *
     * @note 此操作無法撤銷，清除後需要重新創建分析點
     *
     * @example
     * // 清除所有等時圈分析
     * clearIsochroneAnalysisLayer();
     */
    const clearIsochroneAnalysisLayer = () => {
      const isochroneLayer = findLayerById('isochrone-analysis-layer');
      if (isochroneLayer) {
        // 清空圖層中的所有要素
        isochroneLayer.geoJsonData.features = [];

        // 重新計算並更新圖層統計和表格數據
        updateIsochroneAnalysisLayerData(isochroneLayer);

        console.log('🗑️ 清除等時圈分析圖層數據');
      } else {
        console.warn('找不到等時圈分析圖層，無法執行清除操作');
      }
    };

    // 🗑️ 刪除單個分析點 (Delete Single Analysis Point)
    const deleteAnalysisPoint = (pointId) => {
      const analysisLayer = findLayerById('analysis-layer');
      if (!analysisLayer || !analysisLayer.geoJsonData) return;

      // 過濾掉指定的分析圓圈和其對應的點
      analysisLayer.geoJsonData.features = analysisLayer.geoJsonData.features.filter((feature) => {
        const isTargetCircle =
          feature.properties.type === 'circle-analysis' && feature.properties.id === pointId;
        const isTargetPoint =
          feature.properties.type === 'point-analysis' && feature.properties.parentId === pointId;
        return !isTargetCircle && !isTargetPoint;
      });

      // 更新圖層統計和表格數據
      updateAnalysisLayerData(analysisLayer);

      console.log('🗑️ 刪除分析點:', pointId);
    };

    // 🗑️ 刪除單個等時圈分析點 (Delete Single Isochrone Analysis Point)
    /**
     * 刪除指定的等時圈分析點及其相關要素
     *
     * @description 此函數會移除指定編號的等時圈分析結果，包括：
     * 1. 等時圈多邊形或圓圈（分析範圍的視覺表示）
     * 2. 分析點標記（藍色加號圖標）
     * 3. 更新相關的統計數據和表格數據
     *
     * @param {number|string} pointId - 要刪除的分析點編號
     *
     * @note 此操作會同時處理兩種類型的等時圈要素：
     * - isochrone-polygon-analysis: 來自 ORS API 的真實等時圈多邊形
     * - isochrone-circle-analysis: 回退模式的圓圈分析
     *
     * @example
     * // 刪除編號為 3 的等時圈分析
     * deleteIsochroneAnalysisPoint(3);
     */
    const deleteIsochroneAnalysisPoint = (pointId) => {
      const isochroneLayer = findLayerById('isochrone-analysis-layer');
      if (!isochroneLayer || !isochroneLayer.geoJsonData) {
        console.warn('找不到等時圈分析圖層或其數據，無法執行刪除操作');
        return;
      }

      // 過濾並移除指定的等時圈分析要素
      // 需要移除三種相關的要素：
      isochroneLayer.geoJsonData.features = isochroneLayer.geoJsonData.features.filter(
        (feature) => {
          // 1. 回退模式的圓圈分析
          const isTargetCircle =
            feature.properties.type === 'isochrone-circle-analysis' &&
            feature.properties.id === pointId;

          // 2. API 模式的多邊形分析
          const isTargetPolygon =
            feature.properties.type === 'isochrone-polygon-analysis' &&
            feature.properties.id === pointId;

          // 3. 分析點標記（藍色加號）
          const isTargetPoint =
            feature.properties.type === 'isochrone-point-analysis' &&
            feature.properties.parentId === pointId;

          // 保留不匹配的要素（即刪除匹配的要素）
          return !isTargetCircle && !isTargetPolygon && !isTargetPoint;
        }
      );

      // 重新計算並更新圖層統計和表格數據
      updateIsochroneAnalysisLayerData(isochroneLayer);

      console.log('🗑️ 刪除等時圈分析點:', pointId);
    };

    // 🗺️ ============ 路徑規劃圖層相關函數 (Route Planning Layer Functions) ============

    /**
     * 更新路徑規劃圖層的統計數據和表格數據
     *
     * @description 計算路徑規劃圖層中的路徑點數量，更新摘要統計和表格顯示數據。
     * 路徑規劃在點選完成前被視為一筆資料，表格只顯示一筆記錄包含所有路徑點。
     * 這個函數會在以下情況被調用：
     * 1. 添加新的路徑規劃點後
     * 2. 刪除路徑規劃點後
     * 3. 清空路徑規劃圖層後
     *
     * @param {Object} routePlanningLayer - 路徑規劃圖層物件
     *
     * @example
     * const routeLayer = findLayerById('route-planning-layer');
     * updateRoutePlanningLayerData(routeLayer);
     */
    const updateRoutePlanningLayerData = (routePlanningLayer) => {
      // 獲取已完成的路線
      const completedRoutes = routePlanningLayer.geoJsonData.features.filter(
        (f) => f.properties.type === 'route-line'
      );

      // 獲取當前正在規劃的路徑點（排除已完成的）
      const currentRoutePoints = routePlanningLayer.geoJsonData.features.filter(
        (f) => f.properties.type === 'route-planning-point' && f.properties.status !== 'completed'
      );

      // 計算總數量：已完成路線數 + (如果有正在規劃的點則+1)
      const totalCount = completedRoutes.length + (currentRoutePoints.length > 0 ? 1 : 0);

      // 更新摘要數據
      if (completedRoutes.length > 0 || currentRoutePoints.length > 0) {
        const totalDistance = completedRoutes.reduce(
          (sum, route) => sum + (route.properties.distance || 0),
          0
        );
        const totalDuration = completedRoutes.reduce(
          (sum, route) => sum + (route.properties.duration || 0),
          0
        );

        let description = '';
        if (completedRoutes.length > 0 && currentRoutePoints.length > 0) {
          description = `已完成 ${completedRoutes.length} 條路線，正在規劃第 ${completedRoutes.length + 1} 條路線（已選擇 ${currentRoutePoints.length} 個路徑點）`;
        } else if (completedRoutes.length > 0) {
          description = `已完成 ${completedRoutes.length} 條路線，總距離 ${totalDistance.toFixed(2)} 公里，總時間 ${totalDuration} 分鐘`;
        } else {
          description = `正在規劃第 1 條路線，已選擇 ${currentRoutePoints.length} 個路徑點`;
        }

        routePlanningLayer.summaryData = {
          totalCount: totalCount,
          type: '路徑規劃',
          description: description,
          lastUpdated: new Date().toISOString(),
          coverage:
            completedRoutes.length > 0
              ? `${totalDistance.toFixed(2)} 公里`
              : `${currentRoutePoints.length} 個路徑點`,
        };
      } else {
        routePlanningLayer.summaryData = {
          totalCount: 0,
          type: '路徑規劃',
          description: '尚未開始路徑規劃，點選地圖開始規劃路徑',
          lastUpdated: new Date().toISOString(),
          coverage: '0 條路線',
        };
      }

      // 更新表格數據
      const tableData = [];

      // 添加已完成的路線
      completedRoutes.forEach((route, index) => {
        tableData.push({
          '#': index + 1,
          id: route.properties.id, // 🔥 添加正確的 feature ID 用於高亮顯示
          名稱: route.properties.name || `路線 ${index + 1}`,
          類型: '已完成路線',
          起點: route.properties.startPointName || '起點',
          終點: route.properties.endPointName || '終點',
          路徑點數: route.properties.waypoints || 0,
          總距離: `${route.properties.distance} 公里`,
          預估時間: `${route.properties.duration} 分鐘`,
          建立時間: new Date(route.properties.createdAt).toLocaleString('zh-TW'),
          狀態: '已完成',
        });
      });

      // 如果有正在規劃的路徑點，添加到表格
      if (currentRoutePoints.length > 0) {
        const firstPoint = currentRoutePoints[0];
        const lastPoint = currentRoutePoints[currentRoutePoints.length - 1];

        tableData.push({
          '#': completedRoutes.length + 1,
          id: firstPoint.properties.id, // 🔥 使用第一個路徑點的 ID 作為規劃中路線的代表
          名稱: `路線 ${completedRoutes.length + 1}`,
          類型: '規劃中',
          起點: `${firstPoint.properties.name}`,
          終點: currentRoutePoints.length > 1 ? `${lastPoint.properties.name}` : '同起點',
          路徑點數: currentRoutePoints.length,
          總距離: '-',
          預估時間: '-',
          建立時間: new Date(firstPoint.properties.createdAt).toLocaleString('zh-TW'),
          狀態: '規劃中',
        });
      }

      routePlanningLayer.tableData = tableData;
    };

    /**
     * 添加路徑規劃點到地圖
     *
     * @description 在指定的經緯度位置添加一個路徑規劃點。
     * 路徑規劃點將按添加順序進行編號，支援無限數量的路徑點添加。
     *
     * @param {number} lat - 緯度
     * @param {number} lng - 經度
     * @returns {string|null} - 成功時返回路徑點ID，失敗時返回null
     *
     * @example
     * // 添加路徑規劃點
     * const pointId = addRoutePlanningPoint(25.0330, 121.5654);
     * if (pointId) {
     *   console.log('成功添加路徑點:', pointId);
     * }
     */
    const addRoutePlanningPoint = (lat, lng) => {
      // 獲取路徑規劃圖層實例
      const routePlanningLayer = findLayerById('route-planning-layer');
      if (!routePlanningLayer) {
        console.error('找不到路徑規劃圖層');
        return null;
      }

      // 計算當前正在規劃的路徑點數量，用於生成順序編號（排除已完成的）
      const currentPoints = routePlanningLayer.geoJsonData.features.filter(
        (f) => f.properties.type === 'route-planning-point' && f.properties.status !== 'completed'
      );
      const nextOrder = currentPoints.length + 1;

      // 生成唯一的路徑點ID
      const pointId = `route_point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 生成路徑點名稱
      const pointName = `路徑點 ${nextOrder}`;

      // 創建路徑規劃點的 GeoJSON 要素
      const routePlanningPointFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat], // GeoJSON 格式：[經度, 緯度]
        },
        properties: {
          id: pointId, // 唯一識別編號
          layerId: 'route-planning-layer', // 所屬圖層
          type: 'route-planning-point', // 要素類型標記
          name: pointName, // 顯示名稱
          order: nextOrder, // 路徑點順序
          latitude: lat, // 緯度（便於存取）
          longitude: lng, // 經度（便於存取）
          createdAt: new Date().toISOString(), // 建立時間
        },
      };

      // 將新的路徑點添加到圖層數據中
      routePlanningLayer.geoJsonData.features.push(routePlanningPointFeature);

      // 更新圖層統計和表格數據
      updateRoutePlanningLayerData(routePlanningLayer);

      console.log(
        `🗺️ 添加路徑規劃點 ${nextOrder}:`,
        pointName,
        `(${lat.toFixed(6)}, ${lng.toFixed(6)})`
      );
      console.log(
        `📍 路徑規劃點已添加到圖層，總點數: ${routePlanningLayer.geoJsonData.features.length}`
      );
      console.log(`🎯 路徑規劃圖層可見性: ${routePlanningLayer.visible}`);

      return pointId;
    };

    /**
     * 清空路徑規劃圖層中的所有路徑點
     *
     * @description 移除路徑規劃圖層中的所有路徑規劃點，重置圖層狀態。
     * 這個函數通常在用戶想要重新開始路徑規劃時使用。
     *
     * @example
     * // 清空所有路徑規劃點
     * clearRoutePlanningLayer();
     */
    const clearRoutePlanningLayer = (clearAll = false) => {
      // 獲取路徑規劃圖層實例
      const routePlanningLayer = findLayerById('route-planning-layer');
      if (routePlanningLayer) {
        if (clearAll) {
          // 清空圖層中的所有要素（路徑點 + 路線）
          routePlanningLayer.geoJsonData.features = [];
          console.log('🗑️ 已清空路徑規劃圖層的所有內容（包括已完成的路線和路徑點）');
        } else {
          // 只清空當前正在規劃的路徑點，保留已完成的路線和已完成的路徑點
          routePlanningLayer.geoJsonData.features = routePlanningLayer.geoJsonData.features.filter(
            (f) =>
              f.properties.type !== 'route-planning-point' || f.properties.status === 'completed'
          );
          console.log('🗑️ 已清空當前正在規劃的路徑點，保留已完成的路線和路徑點');
        }

        // 重新計算並更新圖層統計和表格數據
        updateRoutePlanningLayerData(routePlanningLayer);
      } else {
        console.warn('找不到路徑規劃圖層，無法清空');
      }
    };

    /**
     * 刪除指定的路徑規劃點
     *
     * @description 根據點ID刪除特定的路徑規劃點，並重新整理剩餘路徑點的順序編號。
     *
     * @param {string} pointId - 要刪除的路徑點ID
     *
     * @example
     * // 刪除特定的路徑規劃點
     * deleteRoutePlanningPoint('route_point_1234567890_abc123');
     */
    const deleteRoutePlanningPoint = (pointId) => {
      // 獲取路徑規劃圖層實例
      const routePlanningLayer = findLayerById('route-planning-layer');
      if (!routePlanningLayer || !routePlanningLayer.geoJsonData) {
        console.warn('找不到路徑規劃圖層或其數據，無法執行刪除操作');
        return;
      }

      // 過濾並移除指定的路徑規劃點
      const originalCount = routePlanningLayer.geoJsonData.features.length;
      routePlanningLayer.geoJsonData.features = routePlanningLayer.geoJsonData.features.filter(
        (feature) => feature.properties.id !== pointId
      );

      // 檢查是否成功刪除
      const newCount = routePlanningLayer.geoJsonData.features.length;
      if (originalCount === newCount) {
        console.warn('找不到指定的路徑規劃點:', pointId);
        return;
      }

      // 重新整理剩餘路徑點的順序編號
      const remainingPoints = routePlanningLayer.geoJsonData.features.filter(
        (f) => f.properties.type === 'route-planning-point'
      );

      remainingPoints.forEach((point, index) => {
        const newOrder = index + 1;
        point.properties.order = newOrder;
        point.properties.name = `路徑點 ${newOrder}`;
      });

      // 重新計算並更新圖層統計和表格數據
      updateRoutePlanningLayerData(routePlanningLayer);

      console.log('🗑️ 刪除路徑規劃點:', pointId);
    };

    /**
     * 獲取所有路徑規劃點的坐標列表
     *
     * @description 返回當前所有路徑規劃點的坐標陣列，按順序排列，
     * 可用於後續的路徑規劃API調用。
     *
     * @returns {Array<Array<number>>} - 坐標陣列，格式為 [[lng, lat], [lng, lat], ...]
     *
     * @example
     * // 獲取路徑點坐標用於路徑規劃
     * const coordinates = getRoutePlanningCoordinates();
     * console.log('路徑點坐標:', coordinates);
     * // 輸出: [[121.5654, 25.0330], [121.5700, 25.0350], ...]
     */
    const getRoutePlanningCoordinates = () => {
      const routePlanningLayer = findLayerById('route-planning-layer');
      if (!routePlanningLayer) {
        console.warn('找不到路徑規劃圖層');
        return [];
      }

      // 獲取正在規劃中的路徑規劃點，並按順序排序（排除已完成的）
      const routePoints = routePlanningLayer.geoJsonData.features
        .filter(
          (f) => f.properties.type === 'route-planning-point' && f.properties.status !== 'completed'
        )
        .sort((a, b) => a.properties.order - b.properties.order);

      // 提取坐標陣列
      const coordinates = routePoints.map((point) => point.geometry.coordinates);

      console.log(`📍 獲取 ${coordinates.length} 個路徑點坐標`);
      return coordinates;
    };

    /**
     * 使用 OpenRouteService Directions API 計算路徑
     *
     * @description 調用 ORS Directions API 計算多個路徑點之間的最佳路線，
     * 返回包含路徑幾何、距離、時間等詳細信息的數據。
     *
     * @param {Array<Array<number>>} coordinates - 路徑點坐標陣列 [[lng, lat], ...]
     * @param {string} profile - 交通方式 ('driving-car', 'cycling-regular', 'foot-walking')
     * @returns {Promise<Object>} - ORS Directions API 響應數據
     *
     * @throws {Error} - 當 API 調用失敗時拋出錯誤
     *
     * @example
     * const coordinates = [[121.5654, 25.0330], [121.5700, 25.0350]];
     * const routeData = await fetchRouteDirections(coordinates, 'driving-car');
     * console.log('路徑距離:', routeData.features[0].properties.summary.distance, '公尺');
     */
    const fetchRouteDirections = async (coordinates, profile = 'driving-car') => {
      const apiKey = '5b3ce3597851110001cf6248cd3e1a052bec45bc8410b037091bb766';

      if (!coordinates || coordinates.length < 2) {
        throw new Error('路徑規劃至少需要2個路徑點');
      }

      try {
        console.log(`🛣️ 開始計算路徑，使用 ${coordinates.length} 個路徑點`);
        console.log('路徑點坐標:', coordinates);

        // 使用正確的 API URL 格式 (包含 /geojson)
        const apiUrl = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            Accept:
              'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
            'Content-Type': 'application/json',
            Authorization: apiKey,
          },
          body: JSON.stringify({
            coordinates: coordinates,
          }),
        });

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.error && errorData.error.message) {
              errorMessage = errorData.error.message;
            }
          } catch (parseError) {
            // 如果無法解析錯誤響應，使用狀態碼
            errorMessage = `HTTP ${response.status} - ${response.statusText}`;
          }
          throw new Error(`ORS API 錯誤: ${errorMessage}`);
        }

        const data = await response.json();

        if (!data.features || data.features.length === 0) {
          throw new Error('API 返回的路徑數據為空');
        }

        console.log('✅ 路徑計算成功');
        console.log(
          `📏 路徑距離: ${(data.features[0].properties.summary.distance / 1000).toFixed(2)} 公里`
        );
        console.log(
          `⏱️ 預估時間: ${Math.round(data.features[0].properties.summary.duration / 60)} 分鐘`
        );

        return data;
      } catch (error) {
        console.error('🚫 路徑計算失敗:', error);
        throw error;
      }
    };

    /**
     * 計算並繪製路徑規劃路線
     *
     * @description 使用當前的路徑規劃點計算最佳路線，並將路線添加到地圖圖層中。
     * 同時更新圖層統計數據，包含路線長度、預估時間等信息。
     *
     * @param {string} profile - 交通方式，預設為 'driving-car'
     * @returns {Promise<Object|null>} - 成功時返回路線數據，失敗時返回 null
     *
     * @example
     * // 計算並繪製駕車路線
     * const routeResult = await calculateAndDrawRoute('driving-car');
     * if (routeResult) {
     *   console.log('路線已繪製，距離:', routeResult.distance, '公里');
     * }
     */
    const calculateAndDrawRoute = async (profile = 'driving-car') => {
      const routePlanningLayer = findLayerById('route-planning-layer');
      if (!routePlanningLayer) {
        console.error('找不到路徑規劃圖層');
        return null;
      }

      // 獲取路徑點坐標
      const coordinates = getRoutePlanningCoordinates();
      if (coordinates.length < 2) {
        console.warn('⚠️ 路徑規劃至少需要2個點，目前只有', coordinates.length, '個點');
        return null;
      }

      try {
        console.log('🚀 開始路徑規劃計算...');

        // 調用 ORS Directions API
        const routeData = await fetchRouteDirections(coordinates, profile);
        const route = routeData.features[0];
        const summary = route.properties.summary;

        // 獲取當前路徑點（在清除前保存信息）
        const currentRoutePoints = routePlanningLayer.geoJsonData.features.filter(
          (f) => f.properties.type === 'route-planning-point'
        );

        const firstPoint = currentRoutePoints[0];
        const lastPoint = currentRoutePoints[currentRoutePoints.length - 1];

        // 計算路線統計
        const distanceKm = (summary.distance / 1000).toFixed(2);
        const durationMin = Math.round(summary.duration / 60);

        // 獲取已完成的路線數量，用於生成路線編號
        const existingRoutes = routePlanningLayer.geoJsonData.features.filter(
          (f) => f.properties.type === 'route-line'
        );
        const routeNumber = existingRoutes.length + 1;
        const routeId = `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 創建路線 GeoJSON 要素
        const routeFeature = {
          type: 'Feature',
          geometry: route.geometry, // 直接使用 ORS 返回的幾何數據
          properties: {
            id: routeId,
            layerId: 'route-planning-layer',
            type: 'route-line',
            name: `路線 ${routeNumber}`,
            routeNumber: routeNumber, // 路線編號
            distance: parseFloat(distanceKm), // 距離（公里）
            duration: durationMin, // 時間（分鐘）
            profile: profile, // 交通方式
            waypoints: coordinates.length, // 路徑點數量
            startPointName: firstPoint.properties.name, // 起點名稱
            endPointName: lastPoint.properties.name, // 終點名稱
            createdAt: new Date().toISOString(),
          },
        };

        // 添加完成的路線到圖層
        routePlanningLayer.geoJsonData.features.push(routeFeature);

        // 🔥 修改：將當前路徑規劃點標記為已完成，但保留在地圖上
        routePlanningLayer.geoJsonData.features.forEach((feature) => {
          if (feature.properties.type === 'route-planning-point') {
            // 將路徑點標記為已完成，關聯到對應的路線
            feature.properties.status = 'completed';
            feature.properties.routeId = routeId;
            feature.properties.routeNumber = routeNumber;
          }
        });

        // 更新圖層數據（現在只有已完成的路線）
        updateRoutePlanningLayerData(routePlanningLayer);

        console.log(`✅ 路徑規劃完成！`);
        console.log(`📏 總距離: ${distanceKm} 公里`);
        console.log(`⏱️ 預估時間: ${durationMin} 分鐘`);
        console.log(`🛣️ 交通方式: ${profile}`);

        return {
          routeId,
          routeNumber: routeNumber,
          distance: parseFloat(distanceKm),
          duration: durationMin,
          waypoints: coordinates.length,
          profile,
          geometry: route.geometry,
        };
      } catch (error) {
        console.error('❌ 路徑規劃失敗:', error);

        // 錯誤時更新圖層狀態
        routePlanningLayer.summaryData.description = `路徑規劃失敗: ${error.message}`;

        return null;
      }
    };

    // 🗺️ ============ 路徑優化相關函數 (Route Optimization Functions) ============

    /**
     * 添加路徑優化點
     *
     * @description 在地圖上添加一個新的路徑優化點，用於路徑優化計算
     * @param {number} lat - 緯度
     * @param {number} lng - 經度
     * @returns {string|null} 路徑優化點的唯一ID，失敗時返回null
     *
     * @example
     * // 添加路徑優化點
     * const pointId = addRouteOptimizationPoint(25.0330, 121.5654);
     * if (pointId) {
     *   console.log('成功添加優化點:', pointId);
     * }
     */
    const addRouteOptimizationPoint = (lat, lng) => {
      // 獲取路徑優化圖層實例
      const routeOptimizationLayer = findLayerById('route-optimization-layer');
      if (!routeOptimizationLayer) {
        console.error('找不到路徑優化圖層');
        return null;
      }

      // 計算當前正在優化的點數量，用於生成順序編號（排除已完成的）
      const currentPoints = routeOptimizationLayer.geoJsonData.features.filter(
        (f) => f.properties.type === 'optimization-point' && f.properties.status !== 'completed'
      );
      const nextOrder = currentPoints.length + 1;

      // 生成唯一的優化點ID
      const pointId = `optimization_point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 生成優化點名稱
      const pointName = `優化點 ${nextOrder}`;

      // 創建路徑優化點的 GeoJSON 要素
      const routeOptimizationPointFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat], // GeoJSON 格式：[經度, 緯度]
        },
        properties: {
          id: pointId, // 唯一識別編號
          layerId: 'route-optimization-layer', // 所屬圖層
          type: 'optimization-point', // 要素類型標記
          name: pointName, // 顯示名稱
          order: nextOrder, // 優化點順序
          latitude: lat, // 緯度（便於存取）
          longitude: lng, // 經度（便於存取）
          createdAt: new Date().toISOString(), // 建立時間
        },
      };

      // 將新的優化點添加到圖層數據中
      routeOptimizationLayer.geoJsonData.features.push(routeOptimizationPointFeature);

      // 更新圖層統計和表格數據（與路徑規劃點行為一致）
      updateRouteOptimizationLayerData(routeOptimizationLayer);

      console.log(
        `🗺️ 添加路徑優化點 ${nextOrder}:`,
        pointName,
        `(${lat.toFixed(6)}, ${lng.toFixed(6)})`
      );
      console.log(
        `📍 路徑優化點已添加到圖層，總點數: ${routeOptimizationLayer.geoJsonData.features.length}`
      );
      console.log(`🎯 路徑優化圖層可見性: ${routeOptimizationLayer.visible}`);

      return pointId;
    };

    /**
     * 清空路徑優化圖層中的所有優化點
     *
     * @description 移除路徑優化圖層中的所有優化點，重置圖層狀態。
     * 這個函數通常在用戶想要重新開始路徑優化時使用。
     *
     * @example
     * // 清空所有優化點
     * clearRouteOptimizationLayer();
     */
    const clearRouteOptimizationLayer = (clearAll = false) => {
      // 獲取路徑優化圖層實例
      const routeOptimizationLayer = findLayerById('route-optimization-layer');
      if (routeOptimizationLayer) {
        if (clearAll) {
          // 清空圖層中的所有要素（優化點 + 優化路線）
          routeOptimizationLayer.geoJsonData.features = [];
          console.log('🗑️ 已清空路徑優化圖層的所有內容（包括已完成的優化路線和優化點）');
        } else {
          // 只清空當前正在優化的點，保留已完成的優化路線和已完成的優化點
          routeOptimizationLayer.geoJsonData.features =
            routeOptimizationLayer.geoJsonData.features.filter(
              (f) =>
                f.properties.type !== 'optimization-point' || f.properties.status === 'completed'
            );
          console.log('🗑️ 已清空當前正在優化的點，保留已完成的優化路線和優化點');
        }

        // 重新計算並更新圖層統計和表格數據
        updateRouteOptimizationLayerData(routeOptimizationLayer);
      } else {
        console.warn('找不到路徑優化圖層，無法清空');
      }
    };

    /**
     * 獲取路徑優化點的坐標
     *
     * @description 獲取當前路徑優化圖層中所有優化點的坐標，用於路徑優化計算
     * @returns {Array} 坐標數組，每個元素為 [經度, 緯度]
     *
     * @example
     * // 獲取優化點坐標
     * const coordinates = getRouteOptimizationCoordinates();
     * console.log('優化點坐標:', coordinates);
     */
    const getRouteOptimizationCoordinates = () => {
      const routeOptimizationLayer = findLayerById('route-optimization-layer');
      if (!routeOptimizationLayer) {
        console.warn('找不到路徑優化圖層');
        return [];
      }

      // 獲取正在優化中的優化點，並按順序排序（排除已完成的）
      const optimizationPoints = routeOptimizationLayer.geoJsonData.features
        .filter(
          (f) => f.properties.type === 'optimization-point' && f.properties.status !== 'completed'
        )
        .sort((a, b) => a.properties.order - b.properties.order);

      // 提取坐標
      return optimizationPoints.map((point) => point.geometry.coordinates);
    };

    /**
     * 更新路徑優化圖層的統計和表格數據
     *
     * @description 根據圖層中的要素更新摘要統計和表格數據
     * @param {Object} routeOptimizationLayer - 路徑優化圖層實例
     */
    const updateRouteOptimizationLayerData = (routeOptimizationLayer) => {
      // 獲取已完成的優化路線
      const completedRoutes = routeOptimizationLayer.geoJsonData.features.filter(
        (f) => f.properties.type === 'optimized-route-line'
      );

      // 獲取當前正在優化的點（排除已完成的）
      const currentOptimizationPoints = routeOptimizationLayer.geoJsonData.features.filter(
        (f) => f.properties.type === 'optimization-point' && f.properties.status !== 'completed'
      );

      // 計算總數量：已完成路線數 + (如果有正在優化的點則+1)
      const totalCount = completedRoutes.length + (currentOptimizationPoints.length > 0 ? 1 : 0);

      // 更新摘要數據
      if (completedRoutes.length > 0 || currentOptimizationPoints.length > 0) {
        const totalDistance = completedRoutes.reduce(
          (sum, route) => sum + (route.properties.distance || 0),
          0
        );
        const totalDuration = completedRoutes.reduce(
          (sum, route) => sum + (route.properties.duration || 0),
          0
        );

        let description = '';
        if (completedRoutes.length > 0 && currentOptimizationPoints.length > 0) {
          description = `已完成 ${completedRoutes.length} 條優化路線，正在規劃第 ${completedRoutes.length + 1} 條路線（已選擇 ${currentOptimizationPoints.length} 個優化點）`;
        } else if (completedRoutes.length > 0) {
          description = `已完成 ${completedRoutes.length} 條優化路線，總距離 ${totalDistance.toFixed(2)} 公里，總時間 ${totalDuration} 分鐘`;
        } else {
          description = `正在規劃第 1 條優化路線，已選擇 ${currentOptimizationPoints.length} 個優化點`;
        }

        routeOptimizationLayer.summaryData = {
          totalCount: totalCount,
          type: '路徑優化',
          description: description,
          lastUpdated: new Date().toISOString(),
          coverage:
            completedRoutes.length > 0
              ? `${totalDistance.toFixed(2)} 公里`
              : `${currentOptimizationPoints.length} 個優化點`,
        };
      } else {
        routeOptimizationLayer.summaryData = {
          totalCount: 0,
          type: '路徑優化',
          description: '尚未開始路徑優化，點選地圖開始選擇優化點',
          lastUpdated: new Date().toISOString(),
          coverage: '0 條路線',
        };
      }

      // 更新表格數據
      const tableData = [];

      // 添加已完成的優化路線
      completedRoutes.forEach((route, index) => {
        tableData.push({
          '#': index + 1,
          id: route.properties.id,
          名稱: route.properties.name || `優化路線 ${index + 1}`,
          類型: '已完成路線',
          起點: '起點',
          終點: '終點',
          路徑點數: route.properties.waypoints || 0,
          總距離: `${route.properties.distance} 公里`,
          預估時間: `${route.properties.duration} 分鐘`,
          建立時間: new Date(route.properties.createdAt).toLocaleString('zh-TW'),
          狀態: '已完成',
        });
      });

      // 如果有正在優化的點，添加到表格
      if (currentOptimizationPoints.length > 0) {
        const firstPoint = currentOptimizationPoints[0];
        const lastPoint = currentOptimizationPoints[currentOptimizationPoints.length - 1];

        tableData.push({
          '#': completedRoutes.length + 1,
          id: firstPoint.properties.id,
          名稱: `優化路線 ${completedRoutes.length + 1}`,
          類型: '規劃中',
          起點: `${firstPoint.properties.name}`,
          終點: currentOptimizationPoints.length > 1 ? `${lastPoint.properties.name}` : '同起點',
          路徑點數: currentOptimizationPoints.length,
          總距離: '-',
          預估時間: '-',
          建立時間: new Date(firstPoint.properties.createdAt).toLocaleString('zh-TW'),
          狀態: '規劃中',
        });
      }

      routeOptimizationLayer.tableData = tableData;
    };

    /**
     * 計算並繪製優化路線
     *
     * @description 使用 OpenRouteService Optimization API 計算最佳訪問順序並繪製優化路線
     * @param {string} profile - 交通方式，預設為 'driving-car'
     * @returns {Object|null} 優化結果，包含距離、時間、優化順序等，失敗時返回null
     *
     * @example
     * // 計算並繪製優化路線
     * const optimizationResult = await calculateAndDrawOptimizedRoute('driving-car');
     * if (optimizationResult) {
     *   console.log('優化路線已繪製，距離:', optimizationResult.distance, '公里');
     * }
     */
    const calculateAndDrawOptimizedRoute = async (profile = 'driving-car') => {
      const routeOptimizationLayer = findLayerById('route-optimization-layer');
      if (!routeOptimizationLayer) {
        console.error('找不到路徑優化圖層');
        return null;
      }

      // 獲取優化點坐標
      const coordinates = getRouteOptimizationCoordinates();
      if (coordinates.length < 2) {
        console.warn('⚠️ 路徑優化至少需要2個點，目前只有', coordinates.length, '個點');
        return null;
      }

      try {
        console.log('🚀 開始路徑優化計算...');

        // 調用 ORS Optimization API
        const optimizationData = await fetchRouteOptimization(coordinates, profile);

        // 處理優化結果中的每條路線
        const routeFeatures = [];
        let totalDistanceKm = 0;
        let totalDurationMin = 0;

        console.log('🔍 調試優化結果:');
        console.log('總路線數:', optimizationData.routes.length);
        console.log('原始優化點數:', coordinates.length);

        for (let i = 0; i < optimizationData.routes.length; i++) {
          const route = optimizationData.routes[i];
          console.log(`🚗 處理路線 ${i + 1}:`, route);
          console.log('路線步驟數:', route.steps.length);

          // 構建優化後的訪問順序坐標和對應的點信息
          const optimizedCoordinates = [];
          const optimizedPointInfo = [];

          // 用於追蹤已經處理過的點，避免重複
          const processedPointIds = new Set();

          console.log('🔍 詳細步驟分析:');

          // 1. 構建完整路線坐標（包含所有步驟：start, job, end）
          route.steps.forEach((step, stepIndex) => {
            console.log(`  步驟 ${stepIndex + 1}:`, {
              type: step.type,
              location: step.location,
              id: step.id,
              job: step.job,
            });
            optimizedCoordinates.push(step.location);
          });

          // 2. 建立完整的優化訪問順序：起點 → API優化的中間點 → 終點
          // 按照 route.steps 的順序來建立 optimizedPointInfo（包含所有步驟）
          console.log(`📊 處理所有步驟，共 ${route.steps.length} 個步驟`);

          route.steps.forEach((step, stepIndex) => {
            console.log(`  處理步驟 ${stepIndex + 1}:`, {
              type: step.type,
              location: step.location,
              id: step.id,
              job: step.job,
            });

            // 找到對應的原始優化點（使用更大的容差匹配，避免浮點數精度問題）
            const originalPoint = routeOptimizationLayer.geoJsonData.features.find((f) => {
              if (f.properties.type !== 'optimization-point') return false;
              const tolerance = 0.0001; // 約10米的容差，避免精度問題
              const lonDiff = Math.abs(f.geometry.coordinates[0] - step.location[0]);
              const latDiff = Math.abs(f.geometry.coordinates[1] - step.location[1]);
              return lonDiff < tolerance && latDiff < tolerance;
            });

            if (originalPoint) {
              // 檢查是否已經處理過這個點
              if (!processedPointIds.has(originalPoint.properties.id)) {
                processedPointIds.add(originalPoint.properties.id);
                optimizedPointInfo.push({
                  order: originalPoint.properties.order,
                  name: originalPoint.properties.name,
                  coordinates: originalPoint.geometry.coordinates, // 使用原始點的坐標
                  stepType: step.type, // 記錄步驟類型（start, job, end）
                  visitOrder: stepIndex + 1, // 記錄訪問順序
                });
                console.log(
                  `✅ 找到匹配點: ${originalPoint.properties.name} (${originalPoint.properties.order}) - ${step.type}`
                );
              } else {
                console.log(
                  `🔄 跳過重複點: ${originalPoint.properties.name} (${originalPoint.properties.order})`
                );
              }
            } else {
              console.warn(
                `⚠️ 未找到匹配的原始點: [${step.location[0]}, ${step.location[1]}] - ${step.type}`
              );
              // 如果找不到匹配點，創建一個臨時點信息
              optimizedPointInfo.push({
                order: optimizedPointInfo.length + 1,
                name: `${step.type === 'start' ? '起點' : step.type === 'end' ? '終點' : '未知點'} ${optimizedPointInfo.length + 1}`,
                coordinates: step.location,
                stepType: step.type,
                visitOrder: stepIndex + 1,
              });
            }
          });

          // 4. 檢查是否有遺漏的點（確保所有用戶點擊的點都被包含）
          const allUserPoints = routeOptimizationLayer.geoJsonData.features.filter(
            (f) => f.properties.type === 'optimization-point' && f.properties.status !== 'completed'
          );

          console.log(
            `🔍 檢查遺漏點: 用戶點擊了 ${allUserPoints.length} 個點，已匹配 ${optimizedPointInfo.length} 個點`
          );
          console.log(
            '🔍 所有用戶點:',
            allUserPoints.map((p) => ({
              order: p.properties.order,
              name: p.properties.name,
              coords: p.geometry.coordinates,
            }))
          );
          console.log(
            '🔍 已匹配點:',
            optimizedPointInfo.map((p) => ({
              order: p.order,
              name: p.name,
              coords: p.coordinates,
            }))
          );

          // 如果匹配的點數少於用戶點擊的點數，嘗試匹配遺漏的點
          if (optimizedPointInfo.length < allUserPoints.length) {
            allUserPoints.forEach((userPoint) => {
              // 檢查這個用戶點是否已經在 optimizedPointInfo 中
              const isAlreadyMatched = optimizedPointInfo.some((info) => {
                const tolerance = 0.0001; // 約10米的容差，與上面保持一致
                const lonDiff = Math.abs(info.coordinates[0] - userPoint.geometry.coordinates[0]);
                const latDiff = Math.abs(info.coordinates[1] - userPoint.geometry.coordinates[1]);
                return lonDiff < tolerance && latDiff < tolerance;
              });

              if (!isAlreadyMatched) {
                optimizedPointInfo.push({
                  order: userPoint.properties.order,
                  name: userPoint.properties.name,
                  coordinates: userPoint.geometry.coordinates,
                });
                console.log(
                  `✅ 補充遺漏點: ${userPoint.properties.name} (${userPoint.properties.order})`
                );
              }
            });
          }

          console.log(`📊 路線 ${i + 1} 處理結果:`);
          console.log('  優化坐標數:', optimizedCoordinates.length);
          console.log('  匹配點信息數:', optimizedPointInfo.length);
          console.log('  匹配點信息:', optimizedPointInfo);

          // 如果有足夠的點，調用 Directions API 獲取實際路線幾何
          let routeGeometry = { type: 'LineString', coordinates: [] };
          let routeDistance = 0;
          let routeDuration = 0;

          if (optimizedCoordinates.length >= 2) {
            try {
              const directionsData = await fetchRouteDirections(optimizedCoordinates, profile);
              if (directionsData && directionsData.features && directionsData.features.length > 0) {
                const feature = directionsData.features[0];
                routeGeometry = feature.geometry;
                routeDistance = (feature.properties.summary.distance / 1000).toFixed(2);
                routeDuration = Math.round(feature.properties.summary.duration / 60);
              }
            } catch (error) {
              console.warn('無法獲取路線幾何，使用直線連接:', error);
              // 如果 Directions API 失敗，使用直線連接
              routeGeometry = {
                type: 'LineString',
                coordinates: optimizedCoordinates,
              };
              routeDistance = (route.duration / 1000).toFixed(2); // 使用優化結果的估算
              routeDuration = Math.round(route.duration / 60);
            }
          }

          totalDistanceKm += parseFloat(routeDistance);
          totalDurationMin += routeDuration;

          // 獲取已完成的優化路線數量，用於生成路線編號
          const existingRoutes = routeOptimizationLayer.geoJsonData.features.filter(
            (f) => f.properties.type === 'optimized-route-line'
          );
          const routeNumber = existingRoutes.length + i + 1;
          const routeId = `optimized_route_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;

          // 創建優化路線 GeoJSON 要素
          const routeFeature = {
            type: 'Feature',
            geometry: routeGeometry,
            properties: {
              id: routeId,
              layerId: 'route-optimization-layer',
              type: 'optimized-route-line',
              name: `優化路線 ${routeNumber}`,
              routeNumber: routeNumber,
              vehicleId: route.vehicle,
              distance: parseFloat(routeDistance),
              duration: routeDuration,
              profile: profile,
              waypoints: optimizedPointInfo.length, // 只計算實際的優化點數量
              optimizedOrder: optimizedCoordinates,
              optimizedPointInfo: optimizedPointInfo,
              createdAt: new Date().toISOString(),
            },
          };

          routeFeatures.push(routeFeature);
        }

        // 添加所有優化路線到圖層
        routeFeatures.forEach((routeFeature) => {
          routeOptimizationLayer.geoJsonData.features.push(routeFeature);
        });

        // 將當前優化點標記為已完成，但保留在地圖上
        routeOptimizationLayer.geoJsonData.features.forEach((feature) => {
          if (feature.properties.type === 'optimization-point') {
            // 將優化點標記為已完成
            feature.properties.status = 'completed';
          }
        });

        // 更新圖層數據
        updateRouteOptimizationLayerData(routeOptimizationLayer);

        console.log(`✅ 路徑優化完成！`);
        console.log(`📏 總優化距離: ${totalDistanceKm.toFixed(2)} 公里`);
        console.log(`⏱️ 總優化時間: ${totalDurationMin} 分鐘`);
        console.log(`🚗 共生成 ${routeFeatures.length} 條優化路線`);
        console.log(`🛣️ 交通方式: ${profile}`);

        return {
          routeCount: routeFeatures.length,
          totalDistance: totalDistanceKm,
          totalDuration: totalDurationMin,
          waypoints: coordinates.length,
          profile,
          routes: routeFeatures.map((f) => ({
            id: f.properties.id,
            name: f.properties.name,
            distance: f.properties.distance,
            duration: f.properties.duration,
          })),
        };
      } catch (error) {
        console.error('❌ 路徑優化失敗:', error);

        // 錯誤時更新圖層狀態
        routeOptimizationLayer.summaryData.description = `路徑優化失敗: ${error.message}`;

        return null;
      }
    };

    /**
     * 調用 OpenRouteService Optimization API
     *
     * @description 使用 XMLHttpRequest 調用 ORS Optimization API 進行路徑優化
     * @param {Array} coordinates - 坐標數組，每個元素為 [經度, 緯度]
     * @param {string} profile - 交通方式
     * @returns {Object} 優化結果
     */
    const fetchRouteOptimization = async (coordinates, profile = 'driving-car') => {
      const apiKey = '5b3ce3597851110001cf6248cd3e1a052bec45bc8410b037091bb766';

      if (!coordinates || coordinates.length < 2) {
        throw new Error('路徑優化至少需要2個優化點');
      }

      try {
        console.log(`🔄 開始路徑優化計算，使用 ${coordinates.length} 個優化點`);
        console.log('優化點坐標:', coordinates);

        // 構建請求體（按照正確的API格式）
        const requestBody = {
          // 1. JOBS: 定義所有必須完成的任務（第2到第n-1個點）
          jobs: coordinates.slice(1, -1).map((coord, index) => ({
            id: index + 1,
            location: coord,
          })),
          // 2. VEHICLES: 定義執行任務的車輛
          vehicles: [
            {
              id: 1,
              profile: profile,
              start: coordinates[0], // 第1個點作為起點
              end: coordinates[coordinates.length - 1], // 第n個點作為終點
            },
          ],
        };

        // 使用 fetch API 調用 ORS Optimization API（與路徑規劃一致）
        const apiUrl = 'https://api.openrouteservice.org/optimization';

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            Accept:
              'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
            'Content-Type': 'application/json',
            Authorization: apiKey,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.error && errorData.error.message) {
              errorMessage = errorData.error.message;
            }
          } catch (parseError) {
            // 如果無法解析錯誤響應，使用狀態碼
            errorMessage = `HTTP ${response.status} - ${response.statusText}`;
          }
          throw new Error(`ORS API 錯誤: ${errorMessage}`);
        }

        const data = await response.json();

        if (data.code === 0 && data.routes && data.routes.length > 0) {
          console.log('✅ 路徑優化計算成功');
          console.log(
            `📊 總計: ${data.summary.routes} 條路線，總成本: ${data.summary.cost}，總時間: ${Math.round(data.summary.duration / 60)} 分鐘`
          );

          // 返回優化結果（包含所有路線）
          const result = {
            ...data,
            summary: data.summary,
            routes: data.routes,
            unassigned: data.unassigned || [],
          };

          console.log('🔄 優化結果:', result);

          return result;
        } else {
          throw new Error('API 返回的優化數據為空或無效');
        }
      } catch (error) {
        console.error('🚫 路徑優化計算失敗:', error);
        throw error;
      }
    };

    return {
      layers,
      findLayerById, // 根據 ID 尋找圖層
      getAllLayers, // 獲取所有圖層的扁平陣列
      initReportYearLayers,
      toggleLayerVisibility,
      toggleAllLayersInGroup,
      selectedFeature,
      setSelectedFeature,
      clearSelectedFeature,
      addAnalysisPoint, // 添加分析點
      clearAnalysisLayer, // 清除分析圖層
      deleteAnalysisPoint, // 刪除單個分析點
      addIsochroneAnalysisPoint, // 添加等時圈分析點
      clearIsochroneAnalysisLayer, // 清除等時圈分析圖層
      deleteIsochroneAnalysisPoint, // 刪除單個等時圈分析點
      addRoutePlanningPoint, // 添加路徑規劃點
      clearRoutePlanningLayer, // 清除路徑規劃圖層
      deleteRoutePlanningPoint, // 刪除單個路徑規劃點
      getRoutePlanningCoordinates, // 獲取路徑規劃點坐標
      calculateAndDrawRoute, // 計算並繪製路徑規劃路線

      // 🗺️ 路徑優化相關函數
      addRouteOptimizationPoint, // 添加路徑優化點
      clearRouteOptimizationLayer, // 清除路徑優化圖層
      getRouteOptimizationCoordinates, // 獲取路徑優化點坐標
      calculateAndDrawOptimizedRoute, // 計算並繪製優化路線

      calculatePointsInRange, // 計算範圍內的點
      calculatePolygonInRange, // 計算範圍內的多邊形
      visibleLayers: computed(() => getAllLayers().filter((layer) => layer.visible)),
      loadingLayers: computed(() => getAllLayers().filter((layer) => layer.isLoading)),
    };
  },
  {
    persist: true,
  }
);
