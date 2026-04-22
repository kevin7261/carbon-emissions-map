import * as d3 from 'd3';

const measureWidth = (el) => {
  let w = el.clientWidth;
  if (w <= 0) w = el.getBoundingClientRect().width;
  if (w <= 0 && el.parentElement) w = el.parentElement.clientWidth;
  return w > 0 ? w : 800;
};

/**
 * 事業儀表板「多年度趨勢」折線圖；containerEl 需已有寬高，否則以 fallback 內圖高繪製。
 * @param {HTMLElement | null} containerEl
 * @param {Array<{ year: string, direct: number, indirect: number, total: number }>} trend
 */
export function drawCarbonTrendLineChart(containerEl, trend) {
  if (!containerEl || !trend || trend.length === 0) {
    return;
  }

  d3.select(containerEl).selectAll('*').remove();

  const margin = { top: 8, right: 12, bottom: 28, left: 48 };
  const el = containerEl;
  const baseW = measureWidth(el);
  const width = Math.max(120, baseW - margin.left - margin.right);
  const PLOT_FALLBACK = 150;
  const ch = el?.clientHeight ?? 0;
  let height;
  let totalH;
  if (ch > 40) {
    totalH = ch;
    height = Math.max(1, ch - margin.top - margin.bottom);
  } else {
    height = PLOT_FALLBACK;
    totalH = height + margin.top + margin.bottom;
  }
  const years = trend.map((d) => String(d.year));

  const maxVal = d3.max(trend, (d) => Math.max(d.direct || 0, d.indirect || 0, d.total || 0)) || 0;
  const yMax = maxVal <= 0 ? 1 : maxVal * 1.05;

  const svg = d3
    .select(el)
    .append('svg')
    .attr('viewBox', `0 0 ${baseW} ${totalH}`)
    .attr('preserveAspectRatio', 'xMinYMin meet')
    .attr('width', '100%')
    .attr('height', '100%')
    .style('display', 'block')
    .style('min-height', '0')
    .style('max-width', '100%');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3
    .scalePoint()
    .domain(years)
    .range([0, width])
    .padding(0.5);

  const yScale = d3.scaleLinear().domain([0, yMax]).range([height, 0]);

  /**
   * 左軸：SI 簡寫（k/M…），與舊版 `.2s` 精神相同但係數不帶小數（`.0s`）
   */
  const yAxisFormatSi = d3.format('.0s');
  const formatYAxisLabel = (d) => {
    if (d === 0) return '0';
    if (typeof d !== 'number' || !Number.isFinite(d)) return '';
    return yAxisFormatSi(d).replace(/k$/, 'K');
  };

  const line = (key) =>
    d3
      .line()
      .x((d) => xScale(String(d.year)))
      .y((d) => yScale(d[key] ?? 0))
      .curve(d3.curveMonotoneX);

  const series = [
    { key: 'direct', color: 'var(--my-color-green)' },
    { key: 'indirect', color: 'var(--my-color-blue)' },
    { key: 'total', color: 'var(--my-color-orange)' },
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
    .text((y) => String(y));

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
    .text((d) => formatYAxisLabel(d));
}
