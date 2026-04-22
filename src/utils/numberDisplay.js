/**
 * 數字顯示：小數點後拆段，標記為 &lt;small&gt;（沿用瀏覽器對 small 的預設略小字級）。
 */

export function escapeHtmlForNumberDisplay(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 將「已格式化」的數字字串（可含千分位逗號）拆成整數側與小數側（小數側含「.」）。
 * @param {string|number|null|undefined} raw
 * @returns {{ main: string, frac: string | null }}
 */
export function splitFormattedNumberForFractionXs(raw) {
  if (raw === null || raw === undefined) return { main: '—', frac: null };
  const s = String(raw).trim();
  if (s === '' || s === '—' || s === '–') return { main: s === '' ? '—' : s, frac: null };
  const i = s.lastIndexOf('.');
  if (i < 0) return { main: s, frac: null };
  const afterDot = s.slice(i + 1);
  if (!/^\d/.test(afterDot)) return { main: s, frac: null };
  return { main: s.slice(0, i), frac: s.slice(i) };
}

/**
 * 已格式化的數字字串 → 安全 HTML（小數段包 &lt;small&gt;）
 * @param {string} displayString
 * @returns {string}
 */
export function wrapFormattedNumberStringWithFractionXsHtml(displayString) {
  const { main, frac } = splitFormattedNumberForFractionXs(displayString);
  if (!frac) return escapeHtmlForNumberDisplay(main);
  return `${escapeHtmlForNumberDisplay(main)}<small>${escapeHtmlForNumberDisplay(frac)}</small>`;
}

/**
 * 數值 → zh-TW 本地化字串後再包小數 &lt;small&gt;（供 v-html）
 * @param {number} n
 * @param {Intl.NumberFormatOptions} [options]
 * @returns {string}
 */
export function formatLocaleNumberWithFractionXsHtml(n, options = {}) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return escapeHtmlForNumberDisplay(String(n));
  const s = n.toLocaleString('zh-TW', options);
  return wrapFormattedNumberStringWithFractionXsHtml(s);
}
