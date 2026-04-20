/**
 * 碳排 CSV 排放量欄位顯示：數字後接單位，CO 之下標 2（HTML）或 Unicode 下標（純文字）
 */

/** 欄位 key 如：直接排放量(公噸CO2e) */
export function isCarbonEmissionTonCo2eKey(key) {
  return typeof key === 'string' && key.includes('(公噸CO2e)');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 數字（維持原 CSV 字串）＋ 不換行空格 ＋ 公噸CO&lt;sub&gt;2&lt;/sub&gt;e
 */
export function formatCarbonEmissionQuantityHtml(value) {
  const raw = value == null ? '' : String(value).trim();
  if (raw === '') return '';
  return `${escapeHtml(raw)}\u00A0<span class="carbon-emission-unit">公噸CO<sub>2</sub>e</span>`;
}

/** 無 v-html 時使用（Unicode 下標 ₂ U+2082） */
export function formatCarbonEmissionQuantityPlain(value) {
  const raw = value == null ? '' : String(value).trim();
  if (raw === '') return '';
  return `${raw}\u00A0公噸CO\u2082e`;
}
