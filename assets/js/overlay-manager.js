/* 功能：管理多个两体/三体比较反应道、逐图坐标映射、显示开关与曲线库导入导出。
 * 方法：只保存核素名称和配置，使用同一质量表重新计算；按坐标单位匹配可选投影，支持轴互换。
 * 注意事项：比较曲线不改变基准反应及偏导；file:// 存储行为依浏览器而异，可用 JSON 跨页面转移。
 * 导入数据逐项校验；只在浏览器本机存储，不发送到服务器。两体额外提供能量–能量比较投影。
 */
import { validateReaction } from './physics.js';
import { queryKinematic } from './kinematic-geometry.js';
import { escapeHTML, download } from './plots.js';
export const reactionFields = kind => kind === 'two' ? ['beam', 'target', 'particle', 'residue'] : ['beam', 'target', 'residue', 'particle1', 'particle2'];
export function reactionLabel(r) {
  const final = r.kind === 'two' ? `${r.particle.name} + ${r.residue.name}*` : `${r.residue.name}* + ${r.particle1.name} + ${r.particle2.name}`;
  return `${r.beam.name} + ${r.target.name} → ${final}; ${r.energy} MeV/u; Ex=${r.ex} MeV`;
}
export function packReaction(r) {
  return Object.fromEntries([['kind', r.kind], ['energy', r.energy], ['ex', r.ex], ...reactionFields(r.kind).map(key => [key, r[key].name])]);
}
export function unpackReaction(config, masses) {
  if (!config || !['two', 'three'].includes(config.kind) || typeof config.energy !== 'number' || typeof config.ex !== 'number') throw new Error('曲线配置缺少有效的类型、束流能量或激发能。');
  const r = { kind: config.kind, energy: config.energy, ex: config.ex };
  for (const key of reactionFields(r.kind)) {
    const n = masses.nuclides.find(n => n.name === config[key]);
    if (!n) throw new Error(`质量表中未找到核素 ${String(config[key])}。`);
    r[key] = n;
  }
  validateReaction(r);
  return r;
}
export function comparisonPlots(r, plots) {
  if (r.kind !== 'two') return plots;
  const energies = plots[0].branches.map((branch, b) => branch.map((point, i) => point && plots[1].branches[b]?.[i] ? [point[1], plots[1].branches[b][i][1]] : null));
  return [...plots, { title: '两体末态能量关联', xLabel: 'Tc (MeV)', yLabel: 'Td (MeV)', relation: 'c-energy-d-energy', branches: energies }];
}
const axisUnit = label => label.includes('°') ? 'degree' : label.includes('MeV') ? 'MeV' : label;
export function mappingChoices(target, sources) {
  const choices = [];
  for (const source of sources) for (const swapped of [false, true]) {
    const xLabel = swapped ? source.yLabel : source.xLabel, yLabel = swapped ? source.xLabel : source.yLabel;
    if (axisUnit(xLabel) === axisUnit(target.xLabel) && axisUnit(yLabel) === axisUnit(target.yLabel)) choices.push({ key: `${source.relation}:${swapped ? 'yx' : 'xy'}`, relation: source.relation, swapped, xLabel, yLabel, title: source.title });
  }
  return choices;
}
export function overlaySeries(base, plot, entries, fine = false) {
  const series = [{ label: `当前：${reactionLabel(base)}`, color: '#25688a', dash: false, branches: plot.branches, mapping: `${plot.xLabel} → ${plot.yLabel}`, query: (axis, value) => queryKinematic(base, plot.relation, value, fine, axis) }];
  for (const entry of entries) {
    if (!entry.visible || !entry.plots) continue;
    const choices = mappingChoices(plot, entry.plots), configured = entry.mappings?.[base.kind]?.[plot.relation];
    const key = configured ?? choices.find(c => c.relation === plot.relation && !c.swapped)?.key ?? choices.find(c => !c.swapped)?.key;
    const choice = choices.find(c => c.key === key);
    if (!choice) continue;
    const source = entry.plots.find(p => p.relation === choice.relation);
    series.push({ label: `${entry.name} · ${reactionLabel(entry.reaction)}`, color: entry.color, dash: entry.dash,
      mapping: `${choice.xLabel} ↦ ${plot.xLabel}; ${choice.yLabel} ↦ ${plot.yLabel}`,
      branches: choice.swapped ? source.branches.map(b => b.map(p => p ? [p[1], p[0]] : null)) : source.branches,
      query: (axis, value) => queryKinematic(entry.reaction, source.relation, value, entry.fine, choice.swapped ? (axis === 'x' ? 'y' : 'x') : axis) });
  }
  return series;
}
export function mountOverlayManager(container, options) {
  const { masses, baseURL, curves, getCurrent, onChange } = options, key = '6xiaoyezi6-kinematic-overlays-v1';
  const palette = ['#a84b37', '#222831', '#32776b', '#795a9b'];
  let entries = [], sequence = 0, busy = false;
  container.innerHTML = `<div class="section-top"><div><span class="eyebrow">COMPARE REACTIONS</span><h2>多反应道叠画</h2></div><button class="button" type="button" id="overlay-save">保存当前反应道</button></div><p class="hint">添加两体或三体反应道后，曲线会叠加到下方同单位的图上。可展开“坐标对应关系”选择粒子、投影或交换横纵轴；图例和导出文件保留映射。比较曲线不影响下方基准事件及偏导数。</p><details class="overlay-add"><summary>添加比较反应道（两体 / 三体）</summary><form id="overlay-form"><div class="fields"><label for="overlay-kind">反应类型<select id="overlay-kind"><option value="two">两体 A+t→c+d*</option><option value="three">三体 A+t→B*+1+2</option></select></label><label for="overlay-name">曲线名称（可选）<input id="overlay-name" maxlength="60" placeholder="例如：弹性散射 / Ex=3.37"></label></div><div id="overlay-nuclides" class="fields"></div><div class="fields"><label for="overlay-energy">束流动能 (MeV/u)<input id="overlay-energy" type="number" min="0.001" step="any" value="150" required></label><label for="overlay-ex">余核 Ex (MeV)<input id="overlay-ex" type="number" min="0" step="any" value="0" required></label><label for="overlay-fine">曲线精度<select id="overlay-fine"><option value="standard">标准</option><option value="fine">精细</option></select></label><button class="button primary" type="submit">计算并加入叠画</button></div></form></details><div id="overlay-message" role="status" aria-live="polite"></div><div id="overlay-list"></div><div class="overlay-library-actions"><button class="button" type="button" id="overlay-export">导出曲线库 JSON</button><label class="button" for="overlay-import">导入曲线库 JSON<input id="overlay-import" type="file" accept="application/json,.json" hidden></label></div>`;
  const find = id => container.querySelector(`#${id}`);
  const message = text => { find('overlay-message').textContent = text; };
  const saveData = () => entries.map(({ name, color, dash, visible, fine, mappings, reaction }) => ({ name, color, dash, visible, fine, mappings, config: packReaction(reaction) }));
  const persist = () => { try { localStorage.setItem(key, JSON.stringify({ version: 1, entries: saveData() })); } catch { message('浏览器未允许本机存储，可导出 JSON 保留曲线库。'); } };
  const notify = () => { persist(); renderList(); onChange(entries); };
  function fillNuclides() {
    const type = find('overlay-kind').value, defaults = type === 'two' ? { beam: '4He', target: '1H', particle: '1H', residue: '4He' } : { beam: '10Be', target: '1H', residue: '6He', particle1: '1H', particle2: '4He' };
    const labels = { beam: '束流 A', target: '靶 t', particle: '测量粒子 c', residue: type === 'two' ? '余核 d' : '余核 B', particle1: '测量粒子 1', particle2: '测量粒子 2' };
    find('overlay-nuclides').innerHTML = reactionFields(type).map(id => `<label for="overlay-${id}">${labels[id]}<input id="overlay-${id}" value="${defaults[id]}" maxlength="7" list="nuclides" required></label>`).join('');
  }
  async function compute(r, fine) {
    const local = () => {
      if (!curves?.[r.kind]) throw new Error('未找到本地曲线计算入口，请刷新网页。');
      return curves[r.kind](r, fine);
    };
    if (location.protocol === 'file:' || typeof Worker === 'undefined') return new Promise((resolve, reject) => setTimeout(() => { try { resolve(local()); } catch (e) { reject(e); } }, 0));
    return new Promise((resolve, reject) => {
      let worker;
      const fallback = () => { worker?.terminate(); try { resolve(local()); } catch (e) { reject(e); } };
      try {
        worker = new Worker(new URL('./curve-worker.js', baseURL), { type: 'module' });
        worker.onmessage = ({ data }) => { worker.terminate(); data.error ? reject(new Error(data.error)) : resolve(data.plots); };
        worker.onerror = e => { e.preventDefault(); fallback(); };
        worker.postMessage({ reaction: r, fine });
      } catch { fallback(); }
    });
  }
  async function add(config, metadata = {}) {
    const r = unpackReaction(config, masses), fine = metadata.fine === true;
    const plots = comparisonPlots(r, await compute(r, fine));
    entries.push({ id: `overlay-${++sequence}`, reaction: r, plots, fine,
      name: typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim().slice(0, 60) : `比较 ${sequence}`,
      color: /^#[0-9a-f]{6}$/i.test(metadata.color) ? metadata.color : palette[(sequence - 1) % palette.length],
      dash: typeof metadata.dash === 'boolean' ? metadata.dash : Math.floor((sequence - 1) / palette.length) % 2 === 1, visible: metadata.visible !== false,
      mappings: metadata.mappings && typeof metadata.mappings === 'object' && !Array.isArray(metadata.mappings) ? JSON.parse(JSON.stringify(metadata.mappings)) : {} });
  }
  function renderList() {
    const current = getCurrent(), targets = current?.plots || [];
    find('overlay-list').innerHTML = entries.length ? entries.map(entry => `<article class="overlay-entry" data-id="${entry.id}"><div class="overlay-entry-top"><label class="overlay-visible"><input type="checkbox" data-action="visible" ${entry.visible ? 'checked' : ''}>${escapeHTML(entry.name)}</label><input type="color" data-action="color" value="${entry.color}" aria-label="${escapeHTML(entry.name)}颜色"><label class="overlay-dash"><input type="checkbox" data-action="dash" ${entry.dash ? 'checked' : ''}>虚线</label><button type="button" class="button" data-action="remove">移除</button></div><p class="hint">${escapeHTML(reactionLabel(entry.reaction))} · ${entry.reaction.kind === 'two' ? '两体' : '三体'}</p><details><summary>坐标对应关系（可选投影 / 交换横纵轴）</summary><div class="overlay-mappings">${targets.map(target => {
      const choices = mappingChoices(target, entry.plots), stored = entry.mappings?.[current.reaction.kind]?.[target.relation];
      const selected = stored ?? choices.find(c => c.relation === target.relation && !c.swapped)?.key ?? choices.find(c => !c.swapped)?.key;
      return `<label>${escapeHTML(target.title)}<select data-action="mapping" data-target="${target.relation}"><option value="off" ${selected === 'off' ? 'selected' : ''}>不叠加到此图</option>${choices.map(c => `<option value="${c.key}" ${c.key === selected ? 'selected' : ''}>${escapeHTML(c.xLabel)} → ${escapeHTML(c.yLabel)}${c.swapped ? '（交换轴）' : ''}</option>`).join('')}</select><span class="hint">目标：${escapeHTML(target.xLabel)} → ${escapeHTML(target.yLabel)}</span></label>`;
    }).join('')}</div></details></article>`).join('') : '<p class="hint overlay-empty">尚无比较曲线。可保存当前反应道后修改配置，也可直接添加新的两体或三体反应道。</p>';
  }
  find('overlay-list').addEventListener('change', event => {
    const action = event.target.dataset.action, item = event.target.closest('[data-id]'); if (!item) return;
    const entry = entries.find(e => e.id === item.dataset.id); if (!entry) return;
    if (action === 'visible') entry.visible = event.target.checked;
    if (action === 'dash') entry.dash = event.target.checked;
    if (action === 'color') entry.color = event.target.value;
    if (action === 'mapping') {
      const type = getCurrent()?.reaction.kind; if (!type) return;
      if (!Object.hasOwn(entry.mappings, type) || !entry.mappings[type] || typeof entry.mappings[type] !== 'object') entry.mappings[type] = {};
      entry.mappings[type][event.target.dataset.target] = event.target.value;
    }
    persist(); onChange(entries);
  });
  find('overlay-list').addEventListener('click', event => {
    if (event.target.dataset.action !== 'remove') return;
    const id = event.target.closest('[data-id]').dataset.id; entries = entries.filter(e => e.id !== id); notify();
  });
  async function perform(task) {
    if (busy) return; busy = true;
    container.querySelectorAll('button').forEach(b => b.disabled = true);
    message('正在计算比较曲线…');
    try { await task(); message('比较曲线已更新；下方图例标出反应道及坐标映射。'); notify(); }
    catch (e) { message(`未添加比较曲线：${e.message}`); }
    finally { busy = false; container.querySelectorAll('button').forEach(b => b.disabled = false); }
  }
  find('overlay-save').addEventListener('click', () => perform(async () => {
    const current = getCurrent(); if (!current?.reaction) throw new Error('请先完成有效的基准反应计算。');
    await add(packReaction(current.reaction), { fine: current.fine });
  }));
  find('overlay-kind').addEventListener('change', fillNuclides);
  find('overlay-form').addEventListener('submit', event => {
    event.preventDefault(); if (!event.target.reportValidity()) return;
    const config = { kind: find('overlay-kind').value, energy: Number(find('overlay-energy').value), ex: Number(find('overlay-ex').value) };
    for (const id of reactionFields(config.kind)) config[id] = find(`overlay-${id}`).value.trim();
    perform(() => add(config, { name: find('overlay-name').value, fine: find('overlay-fine').value === 'fine' }));
  });
  find('overlay-export').addEventListener('click', () => download('kinematic-overlays.json', JSON.stringify({ version: 1, entries: saveData() }, null, 2), 'application/json'));
  find('overlay-import').addEventListener('change', event => {
    const file = event.target.files[0]; if (!file) return;
    perform(async () => {
      if (file.size > 1024 * 1024) throw new Error('曲线库文件不能超过 1 MB。');
      const data = JSON.parse(await file.text());
      if (data.version !== 1 || !Array.isArray(data.entries)) throw new Error('不是有效的曲线库 JSON。');
      data.entries.forEach(item => unpackReaction(item.config, masses));
      const original = [...entries], oldSequence = sequence;
      try { for (const item of data.entries) await add(item.config, item); }
      catch (e) { entries = original; sequence = oldSequence; throw e; }
    });
    event.target.value = '';
  });
  fillNuclides(); renderList();
  // 本机存储仅用于便利；跨 file:// 页面仍可通过导出/导入得到同一反应道库。
  (async () => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved?.version === 1 && Array.isArray(saved.entries) && saved.entries.length) await perform(async () => { for (const item of saved.entries) await add(item.config, item); });
    } catch { message('未恢复之前的曲线库；可重新添加或导入 JSON。'); }
  })();
  return { getEntries: () => entries, refresh: renderList };
}
