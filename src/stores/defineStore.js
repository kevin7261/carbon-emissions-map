import { defineStore } from 'pinia';

export const useDefineStore = defineStore('define', {
  state: () => ({
    selectedBasemap: 'carto_light_labels', // 當前選中的底圖
    // 地圖視圖狀態
    mapView: {
      // 預設視角：台灣本島、澎湖、金門、馬祖（台澎金馬）概略中心
      center: [23.7, 119.9],
      zoom: 6,
    },
    basemaps: [
      {
        label: 'OpenStreetMap',
        value: 'osm',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      },
      {
        label: 'Esri Street',
        value: 'esri_street',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      },
      {
        label: 'Esri Topo',
        value: 'esri_topo',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      },
      {
        label: 'Esri World Imagery',
        value: 'esri_imagery',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      },
      {
        label: 'Google Maps 街道',
        value: 'google_road',
        url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      },
      {
        label: 'Google Maps 衛星',
        value: 'google_satellite',
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      },
      {
        label: '國土規劃中心電子地圖',
        value: 'nlsc_emap',
        url: 'https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}',
      },
      {
        label: '國土規劃中心正射影像',
        value: 'nlsc_photo',
        url: 'https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}',
      },
      {
        label: '地形圖',
        value: 'terrain',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      },
      {
        label: 'Carto Light',
        value: 'carto_light_labels',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      },
      {
        label: 'Carto Dark',
        value: 'carto_dark_labels',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      },
      {
        label: 'Carto Voyager',
        value: 'carto_voyager',
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      },
      {
        label: '白色地圖',
        value: 'blank',
        url: '',
      },
      {
        label: '黑色底圖',
        value: 'black',
        url: '',
      },
    ],
  }),
  actions: {
    setSelectedBasemap(value) {
      this.selectedBasemap = value;
    },
    setMapView(center, zoom) {
      this.mapView.center = center;
      this.mapView.zoom = zoom;
    },
  },
});
