/* 功能：绘制 LaTeX 坐标轴的 SVG 曲线，提供缩放、悬停、逐图双向查询、多反应道叠加与 CSV/SVG 导出。
 * 方法：嵌入离线 LaTeX 路径，按物理路径顺序连线；每层查询使用其反应方程求解；图例与导出记录坐标映射。
 * 注意事项：不使用样条改变数据；无效点断线。查询显示六位小数、悬停三位，CSV 保留原始精度。
 */
import { mathLabels } from './math-labels.js';
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function download(name, text, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const csv = rows => '\uFEFF' + rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
export function plotCSV(plot, series = null) {
  if (series && series.length > 1) {
    const rows = [['reaction', 'axis_mapping', 'branch', plot.xLabel, plot.yLabel]];
    series.forEach(layer => layer.branches.forEach((branch, index) => branch.forEach(point => rows.push([layer.label, layer.mapping || '', index + 1, ...(point || ['', ''])]))));
    return csv(rows);
  }
  const rows = [['branch', plot.xLabel, plot.yLabel]];
  plot.branches.forEach((branch, i) => branch.forEach(p => rows.push(p ? [i + 1, ...p] : [i + 1, '', ''])));
  return csv(rows);
}
let count = 0;
export function renderPlot(container, plot, options = {}) {
  const series = options.series || [{ label: plot.title, color: '#25688a', branches: plot.branches, query: options.query ? (axis, value) => options.query(plot.relation, value, axis) : null }];
  const wrapLegend = value => {
    const lines = []; let line = '', width = 0;
    for (const ch of value) { const w = ch.charCodeAt(0) > 255 ? 2 : 1; if (width + w > 102) { lines.push(line); line = ''; width = 0; } line += ch; width += w; }
    if (line) lines.push(line); return lines;
  };
  const legends = series.length > 1 ? series.map(layer => ({ layer, lines: [...wrapLegend(layer.label), ...wrapLegend(layer.mapping || '')] })) : [];
  const legendHeight = legends.reduce((sum, l) => sum + l.lines.length * 15 + 9, 0);
  const uid = `plot-${++count}`, W = 640, BASE_H = 350, H = BASE_H + legendHeight, L = 78, R = 22, T = 22, B = 60, PW = W - L - R, PH = BASE_H - T - B;
  const hoverPoints = series.flatMap(layer => layer.branches.flat().filter(p => p && p.every(Number.isFinite)).map(point => ({ point, label: layer.label })));
  const points = hoverPoints.map(item => item.point);
  const extent = axis => {
    let lo = Infinity, hi = -Infinity;
    for (const p of points) { lo = Math.min(lo, p[axis]); hi = Math.max(hi, p[axis]); }
    if (!points.length) return [0, 1];
    const pad = (hi - lo || Math.abs(hi) || 1) * .06;
    return [lo - pad, hi + pad];
  };
  const original = [...extent(0), ...extent(1)]; let view = [...original], mode = 'zoom', start = null;
  const queries = { x: null, y: null };
  const mathAxis = (key, fallback, transform) => {
    const label = mathLabels[key || fallback];
    if (!label) return `<text transform="${transform}" text-anchor="middle" dominant-baseline="middle" fill="#43515e">${escapeHTML(fallback)}</text>`;
    const height = 18, width = height * label.aspect;
    return `<g class="latex-axis" transform="${transform}" data-tex="${escapeHTML(label.tex)}" aria-label="${escapeHTML(fallback)}"><image href="${label.uri}" x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}"/></g>`;
  };
  const card = document.createElement('article'); card.className = 'plot-card';
  if (plot.relation) card.dataset.relation = plot.relation;
  card.innerHTML = `<div class="plot-heading"><h3>${escapeHTML(plot.title)}</h3><div class="plot-controls"><button type="button" data-action="zoom" aria-pressed="true" title="框选缩放">框选</button><button type="button" data-action="pan" aria-pressed="false">平移</button><button type="button" data-action="reset">复位</button><button type="button" data-action="csv">CSV</button><button type="button" data-action="svg">SVG</button></div></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHTML(plot.title)}" style="background:#fff;color:#43515e;font-family:Arial,sans-serif;font-size:12px;touch-action:none;user-select:none"><title>${escapeHTML(plot.title)}</title><defs><clipPath id="${uid}"><rect x="${L}" y="${T}" width="${PW}" height="${PH}"/></clipPath></defs><g class="axes"></g><g class="data" clip-path="url(#${uid})"></g><rect class="selection" fill="#256c8b" fill-opacity=".12" stroke="#256c8b" stroke-dasharray="4 3" display="none"/><g class="hover" pointer-events="none" display="none"><circle r="4" fill="#214c67"/><rect width="174" height="25" rx="4" fill="#112a3a"/><text fill="white" font-size="12"></text></g><rect class="surface" x="${L}" y="${T}" width="${PW}" height="${PH}" fill="transparent"/><text x="${L + PW / 2}" y="${H - 13}" text-anchor="middle" fill="#43515e">${escapeHTML(plot.xLabel)}</text><text transform="translate(17 ${T + PH / 2}) rotate(-90)" text-anchor="middle" fill="#43515e">${escapeHTML(plot.yLabel)}</text></svg><p class="plot-note">${escapeHTML(plot.note || (points.length ? '悬停读数 · 框选放大 · 滚轮缩放 · 双击复位' : '当前扫描未找到允许曲线。'))}</p>`;
  const axisTexts = card.querySelectorAll('svg>text');
  axisTexts[0].outerHTML = mathAxis(plot.xMath, plot.xLabel, `translate(${L + PW / 2} ${BASE_H - 20})`);
  axisTexts[1].outerHTML = mathAxis(plot.yMath, plot.yLabel, `translate(20 ${T + PH / 2}) rotate(-90)`);
  card.querySelector('.plot-note').textContent = plot.note || (points.length ? '悬停读数 · 框选放大 · Ctrl/⌘+滚轮缩放 · 双击复位' : '当前扫描未找到允许曲线。');
  if (plot.relation && series.some(layer => layer.query)) {
    card.insertAdjacentHTML('beforeend', ['x', 'y'].map(axis => {
      const inputLabel = axis === 'x' ? plot.xLabel : plot.yLabel;
      return `<form class="coordinate-query" data-axis="${axis}" aria-label="${axis === 'x' ? '横轴查纵轴' : '纵轴查横轴'}：${escapeHTML(plot.title)}"><label for="${uid}-${axis}">${axis === 'x' ? '输入横轴' : '输入纵轴'} ${escapeHTML(inputLabel)}<input id="${uid}-${axis}" type="number" step="any" required inputmode="decimal"></label><button class="button" type="submit">${axis === 'x' ? '查询纵轴' : '查询横轴'}</button><div class="coordinate-results" role="status" aria-live="polite">${axis === 'x' ? '横轴 → 纵轴' : '纵轴 → 横轴'}；分别列出当前及叠加反应道的结果。</div></form>`;
    }).join(''));
  }
  container.append(card);
  const svg = card.querySelector('svg');
  if (legends.length) {
    let y = BASE_H + 3;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g'); group.classList.add('series-legend');
    group.innerHTML = legends.map(({ layer, lines }) => {
      const row = `<path d="M20,${y + 5}H44" stroke="${escapeHTML(layer.color || '#25688a')}" stroke-width="2" ${layer.dash ? 'stroke-dasharray="6 4"' : ''}/>` + lines.map((line, i) => `<text x="52" y="${y + 9 + i * 15}" fill="${i === 0 ? '#273f50' : '#687c88'}" font-size="10">${escapeHTML(line)}</text>`).join('');
      y += lines.length * 15 + 9; return row;
    }).join(''); svg.append(group);
  }
  const surface = card.querySelector('.surface'), hover = card.querySelector('.hover'), selection = card.querySelector('.selection');
  const X = x => L + (x - view[0]) / (view[1] - view[0]) * PW;
  const Y = y => T + PH - (y - view[2]) / (view[3] - view[2]) * PH;
  const dataX = x => view[0] + (x - L) / PW * (view[1] - view[0]);
  const dataY = y => view[2] + (T + PH - y) / PH * (view[3] - view[2]);
  const tidy = v => Math.abs(v) >= 10000 || (Math.abs(v) > 0 && Math.abs(v) < .001) ? v.toExponential(1) : Number(v.toPrecision(4)).toString();
  function draw() {
    let axes = '';
    for (let i = 0; i <= 5; i++) {
      const x = L + PW * i / 5, y = T + PH * i / 5;
      axes += `<path d="M${x},${T}V${T + PH} M${L},${y}H${L + PW}" stroke="#e6ebee" fill="none"/><text x="${x}" y="${T + PH + 24}" text-anchor="middle" fill="#64717c">${tidy(dataX(x))}</text><text x="${L - 12}" y="${y + 4}" text-anchor="end" fill="#64717c">${tidy(dataY(y))}</text>`;
    }
    card.querySelector('.axes').innerHTML = axes + `<path d="M${L},${T}V${T + PH}H${L + PW}" stroke="#8996a1" fill="none"/>`;
    let paths = '';
    if (Number.isFinite(plot.baseline)) paths += `<path d="M${X(plot.baseline)},${T}V${T + PH} M${L},${Y(0)}H${L + PW}" stroke="#7b8791" stroke-dasharray="5 4" fill="none"/>`;
    series.forEach(layer => layer.branches.forEach(branch => {
      let path = '', pen = false;
      for (const point of branch) {
        if (!point || !point.every(Number.isFinite)) { pen = false; continue; }
        const x = X(point[0]), y = Y(point[1]);
        path += `${pen ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`; pen = true;
      }
      paths += `<path d="${path}" stroke="${escapeHTML(layer.color || '#25688a')}" ${layer.dash ? 'stroke-dasharray="6 4"' : ''} stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" vector-effect="non-scaling-stroke"/>`;
    }));
    for (const axis of ['x', 'y']) {
      const query = queries[axis]; if (!query) continue;
      paths += `<path class="query-guide" d="${axis === 'x' ? `M${X(query.value)},${T}V${T + PH}` : `M${L},${Y(query.value)}H${L + PW}`}" stroke="#7d8b94" stroke-dasharray="4 4" fill="none"/>`;
      for (const point of query.points) paths += `<circle class="query-marker" cx="${X(point.x)}" cy="${Y(point.y)}" r="4" fill="${escapeHTML(point.color)}" stroke="#fff" stroke-width="1.2"/>`;
    }
    if (Number.isFinite(plot.baseline)) paths += `<circle cx="${X(plot.baseline)}" cy="${Y(0)}" r="3.5" fill="#172b3a"/>`;
    card.querySelector('.data').innerHTML = paths;
  }
  function local(event) { const rect = svg.getBoundingClientRect(); return [(event.clientX - rect.left) / rect.width * W, (event.clientY - rect.top) / rect.height * H]; }
  surface.addEventListener('pointermove', event => {
    const [x, y] = local(event);
    if (start) {
      if (mode === 'pan') {
        const dx = (x - start.x) / PW * (start.view[1] - start.view[0]), dy = (y - start.y) / PH * (start.view[3] - start.view[2]);
        view = [start.view[0] - dx, start.view[1] - dx, start.view[2] + dy, start.view[3] + dy]; draw();
      } else { selection.setAttribute('x', Math.min(x, start.x)); selection.setAttribute('y', Math.min(y, start.y)); selection.setAttribute('width', Math.abs(x - start.x)); selection.setAttribute('height', Math.abs(y - start.y)); selection.setAttribute('display', ''); }
      return;
    }
    let best = null, bestLabel = '', distance = 22 ** 2;
    for (const item of hoverPoints) {
      const p = item.point;
      const px = X(p[0]), py = Y(p[1]);
      if (px < L || px > L + PW || py < T || py > T + PH) continue;
      const d = (px - x) ** 2 + (py - y) ** 2; if (d < distance) { distance = d; best = p; bestLabel = item.label; }
    }
    hover.setAttribute('display', best ? '' : 'none');
    if (best) {
      const px = X(best[0]), py = Y(best[1]), tx = Math.max(L, Math.min(px + 10, W - 180)), ty = Math.max(T, py - 33);
      hover.querySelector('circle').setAttribute('cx', px); hover.querySelector('circle').setAttribute('cy', py);
      hover.querySelector('rect').setAttribute('x', tx); hover.querySelector('rect').setAttribute('y', ty);
      hover.setAttribute('aria-label', `${bestLabel}: ${best[0]}, ${best[1]}`);
      let title = hover.querySelector('title');
      if (!title) { title = document.createElementNS('http://www.w3.org/2000/svg', 'title'); hover.append(title); }
      title.textContent = bestLabel;
      const label = hover.querySelector('text'); label.setAttribute('x', tx + 7); label.setAttribute('y', ty + 17); label.textContent = `[${best[0].toFixed(3)}, ${best[1].toFixed(3)}]`;
    }
  });
  surface.addEventListener('pointerleave', () => hover.setAttribute('display', 'none'));
  surface.addEventListener('pointerdown', event => { if (event.button !== 0) return; const [x, y] = local(event); start = { x, y, view: [...view] }; surface.setPointerCapture(event.pointerId); hover.setAttribute('display', 'none'); });
  surface.addEventListener('pointerup', event => {
    if (!start) return;
    const [rawX, rawY] = local(event), x = Math.max(L, Math.min(L + PW, rawX)), y = Math.max(T, Math.min(T + PH, rawY));
    if (mode === 'zoom' && Math.abs(x - start.x) > 8 && Math.abs(y - start.y) > 8) view = [dataX(Math.min(x, start.x)), dataX(Math.max(x, start.x)), dataY(Math.max(y, start.y)), dataY(Math.min(y, start.y))];
    start = null; selection.setAttribute('display', 'none'); draw();
  });
  surface.addEventListener('pointercancel', () => { start = null; selection.setAttribute('display', 'none'); });
  surface.addEventListener('dblclick', () => { view = [...original]; draw(); });
  // Ctrl/⌘ + 滚轮才缩放，避免浏览长页面时误操作图像。
  surface.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault(); const [x, y] = local(event), cx = dataX(x), cy = dataY(y), factor = event.deltaY > 0 ? 1.15 : 1 / 1.15;
    view = [cx + (view[0] - cx) * factor, cx + (view[1] - cx) * factor, cy + (view[2] - cy) * factor, cy + (view[3] - cy) * factor]; draw();
  }, { passive: false });
  for (const button of card.querySelectorAll('button')) button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'reset') { view = [...original]; draw(); }
    if (action === 'csv') download(`${uid}.csv`, plotCSV(plot, series), 'text/csv;charset=utf-8');
    if (action === 'svg') { const copy = svg.cloneNode(true); copy.querySelector('.hover').remove(); copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); download(`${uid}.svg`, new XMLSerializer().serializeToString(copy), 'image/svg+xml'); }
    if (action === 'zoom' || action === 'pan') { mode = action; surface.style.cursor = mode === 'pan' ? 'grab' : 'crosshair'; card.querySelectorAll('[aria-pressed]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.action === mode))); }
  });
  for (const queryForm of card.querySelectorAll('.coordinate-query')) {
    const axis = queryForm.dataset.axis, index = axis === 'x' ? 0 : 2;
    const input = queryForm.querySelector('input'), output = queryForm.querySelector('.coordinate-results');
    const midpoint = (original[index] + original[index + 1]) / 2, inputLabel = axis === 'x' ? plot.xLabel : plot.yLabel, outputLabel = axis === 'x' ? plot.yLabel : plot.xLabel;
    input.value = inputLabel.includes('°') && original[index] <= 65 && original[index + 1] >= 65 ? 65 : Number(midpoint.toPrecision(7));
    queryForm.addEventListener('submit', event => {
      event.preventDefault(); if (!queryForm.reportValidity()) return;
      queryForm.dataset.queried = 'true';
      const value = Number(input.value), markers = [];
      output.innerHTML = series.filter(layer => layer.query).map(layer => {
        const heading = series.length > 1 ? `<span class="query-layer-name" style="color:${escapeHTML(layer.color || '#25688a')}">${escapeHTML(layer.label)}</span>` : '';
        try {
          const result = layer.query(axis, value), values = result.values.filter(Number.isFinite);
          for (const v of values) markers.push({ x: axis === 'x' ? value : v, y: axis === 'x' ? v : value, color: layer.color || '#a95839' });
          if (result.type === 'undefined') return `<section class="query-result">${heading}<span>${escapeHTML(result.message)}</span></section>`;
          if (!values.length) return `<section class="query-result">${heading}<span>当前图覆盖范围内没有对应物理解，请调整输入值。</span></section>`;
          if (result.type === 'interval') return `<section class="query-result">${heading}<span>${escapeHTML(outputLabel)} 允许区间：[${values[0].toFixed(6)}, ${values.at(-1).toFixed(6)}]（整体三体相空间）</span></section>`;
          return `<section class="query-result">${heading}<span>${escapeHTML(outputLabel)} · ${values.length} 个对应值</span>${values.map((v, i) => `<strong>解 ${i + 1}：${v.toFixed(6)}</strong>`).join('')}</section>`;
        } catch (error) { return `<section class="query-result">${heading}<span>查询失败：${escapeHTML(error.message)}</span></section>`; }
      }).join('');
      queries[axis] = { value, points: markers }; draw();
    });
  }
  draw();
}
