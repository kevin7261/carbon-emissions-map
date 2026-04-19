# 碳排地圖（Carbon Emissions Map）

以 **Vue 3** 與 **Leaflet** 建置的互動式地圖，用於檢視事業體碳排相關空間資料、儀表板統計與簡易分析。預設部署於 GitHub Pages。

[![Vue.js](https://img.shields.io/badge/Vue.js-3-4FC08D?style=flat-square&logo=vue.js)](https://vuejs.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?style=flat-square&logo=leaflet)](https://leafletjs.com/)

## 線上環境

| 項目 | 連結 |
|------|------|
| 程式碼 | [github.com/kevin7261/carbon-emissions-map](https://github.com/kevin7261/carbon-emissions-map) |
| 網站 | [kevin7261.github.io/carbon-emissions-map](https://kevin7261.github.io/carbon-emissions-map) |

## 功能概覽

- **地圖**：多底圖、圖層開關與順序、點位樣式與圖例。
- **圖層資料**：以 CSV（含座標）載入；預設示例為 `public/data/csv/report_with_google_location.csv`（碳排報告含 Google 緯經度）。
- **儀表板**：依行政區等維度之摘要與 D3 圖表。
- **資料表**：分頁、排序、搜尋，並可連回地圖定位。
- **分析**：地圖上點選分析點、約 2 公里範圍；可選 **等時圈分析**（OpenRouteService，失敗時可退回圓形範圍）。
- **版面**：寬螢幕三欄與行動裝置響應式佈局。

## 技術棧

| 類別 | 套件 |
|------|------|
| 框架 | Vue 3、Vue Router、Pinia |
| 地圖 | Leaflet、proj4 |
| 介面 | Bootstrap 5、Font Awesome |
| 圖表／表單 | D3、SortableJS、SheetJS（xlsx） |
| 建置 | Vue CLI 5、Babel、ESLint、Prettier |

## 本機開發

```bash
npm install
npm run serve
```

瀏覽器開啟開發伺服器提示的網址（預設埠號見 `package.json` 的 `serve` 指令）。

```bash
npm run build
```

產出於 `dist/`；`publicPath` 設為 `/carbon-emissions-map/`，與 GitHub Pages 專案網址路徑一致。

### 常用指令

| 指令 | 說明 |
|------|------|
| `npm run lint` | ESLint 檢查 |
| `npm run lint:fix` | 自動修正可修正項目 |
| `npm run format` | Prettier 與 lint 修正 |

## 部署（GitHub Pages）

- **GitHub Actions**：`.github/workflows/deploy.yml` 在推送至 `main`（或 `master`）時建置並部署至 Pages。
- **手動**：`npm run deploy`（使用 `gh-pages` 將 `dist` 推至 `gh-pages` 分支；若已全面改用 Actions，可擇一流程以免混淆）。

部署前請在 GitHub 專案 **Settings → Pages** 確認來源與分支設定與實際流程一致。

## 專案結構（精簡）

```
public/
  data/csv/          # 公開靜態資料（CSV 等）
src/
  components/        # 共用元件
  stores/            # Pinia（圖層、地圖狀態等）
  tabs/              # 地圖／儀表板／圖層／表格等分頁
  utils/             # 資料載入與處理（含 CSV／GeoJSON 路徑）
  views/             # 版面與首頁
vue.config.js        # publicPath、devServer
```

## 授權

MIT License

Copyright (c) 2024–2026 Carbon Emissions Map

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 聯絡與問題

- 維護者：[Kevin Cheng](https://github.com/kevin7261)
- [Issues](https://github.com/kevin7261/carbon-emissions-map/issues)

---

最後更新：2026 年 4 月 · 版本 0.1.0
