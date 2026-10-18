/* 功能：组织主反应、双向查询、多反应道叠画、基准事件、偏导数与误差传播。
 * 方法：同一套质量和投影方程供主曲线及比较曲线使用；叠画管理只更新图，不改变基准事件。
 * 注意事项：输入严格校验；无解时保留整体曲线；本地文件计算期间可能短暂占用主线程。
 * 误差为独立 1σ，不含 Δφ 或束流误差；无效误差输入保留上一次有效配置并禁止导出。
 */
import { validateReaction, solveTwo, solveThree, reconstruct, residueState, allowedIntervals, sensitivity, shift, bounds } from './physics.js';
import { escapeHTML as esc, renderPlot, download, csv } from './plots.js';
import { mountOverlayManager, overlaySeries } from './overlay-manager.js';
const num = (v, digits = 6) => Number.isFinite(v) ? v.toFixed(digits) : '无效';
const field = (id, label, value, min, max, step = 'any') => `<label for="${id}">${label}<input id="${id}" name="${id}" type="number" value="${value}" min="${min}" ${max === undefined ? '' : `max="${max}"`} step="${step}" required></label>`;
export async function mountTool(kind, options = {}) {
  const baseURL = options.baseURL || import.meta.url;
  const root = document.querySelector('#calculator'), isThree = kind === 'three';
  const names = isThree ? [['beam', '束流 A', '10Be'], ['target', '靶 t', '1H'], ['residue', '余核 B', '6He'], ['particle1', '测量粒子 1', '1H'], ['particle2', '测量粒子 2', '4He']] : [['beam', '束流 A', '4He'], ['target', '靶 t', '1H'], ['particle', '测量粒子 c', '1H'], ['residue', '余核 d', '4He']];
  root.innerHTML = `<section class="config-card"><div class="section-top"><div><span class="eyebrow">REACTION SETUP</span><h2>配置反应道</h2></div><span class="pill">靶静止 · c = 1</span></div><form id="reaction-form"><div class="fields nuclide-fields">${names.map(([id, label, value]) => `<label for="${id}">${label}<input id="${id}" name="${id}" value="${value}" list="nuclides" maxlength="7" required autocomplete="off" spellcheck="false"></label>`).join('')}</div><div class="fields config-energy">${field('energy', '束流动能 (MeV/u)', 150, .001)}${field('ex', '余核激发能 Ex (MeV)', 0, 0)}${isThree ? '<label for="precision">边界网格<select id="precision"><option value="standard">标准</option><option value="fine">精细（耗时更长）</option></select></label>' : ''}<button class="button primary" type="submit">计算运动学 <span aria-hidden="true">↗</span></button><button class="button" type="button" id="reset-tool">恢复默认</button></div></form><datalist id="nuclides"></datalist><p class="hint">质量数在前，例如 10Be、4He、1H、1n；仅余核可设激发态。动能图统一使用总动能 MeV。</p><div id="reaction-error" class="notice error" role="alert" hidden></div><div id="reaction-info" class="notice" aria-live="polite">正在加载核质量表…</div></section>
  <section id="curves" class="tool-section"><div class="section-top"><div><span class="eyebrow">01 / KINEMATIC ${isThree ? 'BOUNDARIES' : 'CURVES'}</span><h2>运动学曲线 <span class="count">${isThree ? '07' : '03'}</span></h2></div></div><p class="section-description">${isThree ? '所选激发态的整体三体相空间投影边界。不固定下方测量角度、动能或 Δφ。角度关联用余下二体的允许角锥求包络，数值极值在精细模式下进一步细化。' : '所选激发态的相对论两体物理解。与原工具一致扫描 θc = 0.1°–89.9°；反向出射区不在曲线范围内。同一物理曲线连续经过动能分支的汇合点。每张图均可双向查询，并可叠加比较反应道。'}</p><p id="curve-status" role="status" aria-live="polite"></p><div class="plots-grid" id="curve-plots"></div></section>
  <section id="sensitivity" class="tool-section"><div class="section-top"><div><span class="eyebrow">02 / EXCITATION SENSITIVITY</span><h2>激发能的偏导数</h2></div><button type="button" class="button" id="export-result" disabled>导出结果 CSV ↓</button></div><p class="section-description">通过缺失质量重建余核激发能，逐一改变测量量，其余测量量保持固定。局部偏导数采用 h = 0.001 的中心差分，物理边界采用单侧差分。</p><div class="measurement-card"><h3>设置基准事件</h3><form id="measurement-form">${isThree ? `<label class="mode-label" for="angle-mode">角度输入方式<select id="angle-mode"><option value="signed">共面带符号角</option><option value="spherical">标准球坐标（任意 Δφ）</option></select></label><div class="fields measurement-fields">${field('T1', '粒子 1 总动能 T₁ (MeV)', 40, 0)}${field('theta1', '粒子 1 带符号角 (°)', 65, -180, 180)}${field('theta2', '粒子 2 带符号角 (°)', -7.7, -180, 180)}<label for="dphi">Δφ₁₂ (°)<input id="dphi" type="number" value="180" min="-360" max="360" step="any" required readonly></label></div><p id="angle-note" class="hint">带符号角异号时 Δφ=180°，同号时 Δφ=0°。偏导数针对非负极角 |θ|；负角的有符号导数与极角导数相反。</p>` : `<div class="fields">${field('theta_c', '测量粒子极角 θc (°)', 65, 0, 180)}</div>`}<button class="button" type="submit">更新基准事件</button></form><p id="allowed-intervals" class="hint"></p><div id="measurement-error" class="notice error" role="alert" hidden></div><label for="branch" class="branch-label">总动能物理解<select id="branch"></select></label><div id="event-summary" class="metrics" aria-live="polite"></div></div><div id="sensitivity-results" hidden><div class="table-wrap"><table><caption>局部灵敏度与精确 ±1 偏差</caption><thead><tr><th scope="col">测量量</th><th scope="col">∂Ex / ∂x</th><th scope="col">x + 1 的 ΔEx (MeV)</th><th scope="col">x − 1 的 ΔEx (MeV)</th></tr></thead><tbody id="derivatives"></tbody></table></div><div class="resolution-card"><div><span class="eyebrow">RESOLUTION ESTIMATE</span><h3>独立误差的一阶传播</h3><p class="hint">σ²(Ex) = Σ (∂Ex/∂xᵢ · σᵢ)²。角度 σ 使用 degree，动能 σ 使用总 MeV。</p><div id="sigma-fields" class="fields sigma-fields"></div></div><div id="resolution-summary" class="resolution-summary" aria-live="polite"></div></div><div id="variance-parts" class="variance-parts"></div><details id="responses"><summary>非线性响应曲线 <span>查看逐项 ΔEx ↗</span></summary><p class="hint">横轴是实际测量值；角度范围为基准 ±2°，动能范围为基准 ±4 MeV。黑点和虚线表示基准事件。</p><div class="plots-grid" id="response-plots"></div></details></div></section><details class="method-note"><summary>计算约定与质量来源</summary><p>原工具：KinematicsSensitivity.py；网页独立实现等价的相对论四动量和解析物理解计算，运行时无需 ROOT 或 Python。核质量经 NuclearMass::MassTable::Get 导出自 NUBASE2020，使用核基态质量（扣电子静质量，忽略电子结合能），估算质量会明确提示。</p><p>仅余核有效质量为 M基态 + Ex。激发能重建 Ex = √[(ΣE)² − |Σp|²] − M基态；选择物理解后，灵敏度计算不再次求解末态动能。FWHM = 2.354820045 σ 为高斯等效值。未计束流能散、顶点、靶内能损、Δφ 误差、误差相关性及非高斯尾部。</p><p>三体边界和允许区间均有有限网格限制。精细网格增加采样密度，但不保证捕获极窄区间。</p><p id="mass-source"></p></details>`;
  const overlayPanel = document.createElement('section');
  overlayPanel.id = 'overlays'; overlayPanel.className = 'config-card overlay-panel';
  root.querySelector('#curves').before(overlayPanel);
  let massData, reaction, values, roots = [], result, worker, generation = 0, currentPlots = [], currentFine = false, overlayController;
  const el = id => root.querySelector(`#${id}`), number = id => Number(el(id).value);
  const variables = isThree ? [{ key: 'theta1', label: '粒子 1 极角 θ₁', unit: '°' }, { key: 'T1', label: '粒子 1 总动能 T₁', unit: 'MeV' }, { key: 'theta2', label: '粒子 2 极角 θ₂', unit: '°' }, { key: 'T2', label: '粒子 2 总动能 T₂', unit: 'MeV' }] : [{ key: 'theta_c', label: '测量粒子极角 θc', unit: '°' }, { key: 'Tc', label: '测量粒子总动能 Tc', unit: 'MeV' }];
  const error = (id, message = '') => { el(id).textContent = message; el(id).hidden = !message; };
  function redrawCurves() {
    const previous = new Map([...el('curve-plots').querySelectorAll('[data-relation]')].map(card => [card.dataset.relation,
      [...card.querySelectorAll('.coordinate-query')].map(form => ({ axis: form.dataset.axis, value: form.querySelector('input').value, queried: form.dataset.queried === 'true' }))]));
    el('curve-plots').replaceChildren();
    if (!reaction) return;
    for (const plot of currentPlots) renderPlot(el('curve-plots'), plot, { series: overlaySeries(reaction, plot, overlayController?.getEntries() || [], currentFine) });
    for (const card of el('curve-plots').querySelectorAll('[data-relation]')) for (const saved of previous.get(card.dataset.relation) || []) {
      const form = card.querySelector(`.coordinate-query[data-axis="${saved.axis}"]`);
      if (form) { form.querySelector('input').value = saved.value; if (saved.queried) form.requestSubmit(); }
    }
  }
  const sigmas = Object.fromEntries(variables.map(v => [v.key, v.unit === '°' ? .25 : 1]));
  el('sigma-fields').innerHTML = variables.map(v => field(`sigma-${v.key}`, `${v.label} σ (${v.unit})`, sigmas[v.key], 0, undefined, 'any')).join('');
  function updateResolution() {
    let sigmaValid = true;
    for (const v of variables) {
      const input = el(`sigma-${v.key}`);
      input.setAttribute('aria-invalid', String(!input.checkValidity()));
      if (!input.checkValidity()) sigmaValid = false;
      else sigmas[v.key] = Number(input.value);
    }
    result = sensitivity(reaction, values, variables, sigmas);
    el('export-result').disabled = !sigmaValid;
    el('resolution-summary').innerHTML = `<div><span>激发能 σ</span><strong>${num(result.sigma, 4)} <small>MeV</small></strong></div><div><span>高斯等效 FWHM</span><strong>${num(result.fwhm, 4)} <small>MeV</small></strong></div>`;
    el('variance-parts').innerHTML = result.rows.map(v => `<div><span>${v.label}</span><meter min="0" max="1" value="${Number.isFinite(v.fraction) ? v.fraction : 0}" aria-label="${v.label}方差贡献"></meter><b>${num(v.fraction * 100, 1)}%</b></div>`).join('');
    if (!sigmaValid) el('resolution-summary').insertAdjacentHTML('beforeend', '<p class="hint">σ 输入须为有限非负数；当前显示上一次有效误差配置，暂不可导出。</p>');
    if (!Number.isFinite(result.sigma)) el('resolution-summary').insertAdjacentHTML('beforeend', '<p class="hint">基准事件附近缺失质量无效，无法给出有限的一阶分辨率。</p>');
  }
  function updateResponses() {
    el('response-plots').replaceChildren();
    if (!el('responses').open || !values || !roots.length) return;
    for (const v of variables) {
      const half = v.unit === '°' ? 2 : 4, [lo, hi] = bounds(v.key), a = Math.max(lo, values[v.key] - half), b = Math.min(hi, values[v.key] + half);
      const points = Array.from({ length: 121 }, (_, i) => { const x = a + (b - a) * i / 120, y = shift(reaction, values, v.key, x - values[v.key]); return Number.isFinite(y) ? [x, y] : null; });
      const symbols = { theta1: 'θ₁ (°)', theta2: 'θ₂ (°)', theta_c: 'θc (°)', T1: 'T₁ (MeV)', T2: 'T₂ (MeV)', Tc: 'Tc (MeV)' };
      renderPlot(el('response-plots'), { title: `${v.label} · 基准 ${num(values[v.key], 3)} ${v.unit}`, xLabel: `${v.label} (${v.unit})`, xMath: symbols[v.key], yLabel: 'ΔEx (MeV)', baseline: values[v.key], branches: [points] });
    }
  }
  function applyBranch() {
    const energy = roots[Number(el('branch').value)];
    if (energy === undefined) return;
    values[isThree ? 'T2' : 'Tc'] = energy;
    const ex = reconstruct(reaction, values), extra = isThree ? `θ₁=${num(values.theta1, 3)}° · θ₂=${num(values.theta2, 3)}° · Δφ=${num(values.dphi, 3)}°` : `余核 θd=${num(residueState(reaction, values).theta, 4)}°`;
    el('event-summary').innerHTML = `<div><span>${isThree ? 'T₂' : 'Tc'} 总动能</span><strong>${num(energy, 5)} <small>MeV</small></strong></div><div><span>重建 Ex</span><strong>${num(ex)} <small>MeV</small></strong></div><div><span>事件几何</span><p>${extra}</p><small>${roots.length} 个物理解；按动能从低到高编号</small></div>`;
    el('sensitivity-results').hidden = false; el('export-result').disabled = false;
    updateResolution();
    el('derivatives').innerHTML = result.rows.map(v => `<tr><th scope="row">${v.label}</th><td>${num(v.derivative)} <small>MeV/${v.unit}</small></td><td>${num(v.plus)}</td><td>${num(v.minus)}</td></tr>`).join('');
    updateResponses();
  }
  function updateMeasurements() {
    if (!reaction || !el('measurement-form').reportValidity()) return;
    error('measurement-error'); el('sensitivity-results').hidden = true; el('export-result').disabled = true; el('event-summary').replaceChildren();
    if (isThree) {
      const signed = el('angle-mode').value === 'signed', th1 = number('theta1'), th2 = number('theta2');
      if (signed) el('dphi').value = th1 * th2 < 0 ? 180 : 0;
      values = { T1: number('T1'), theta1: signed ? Math.abs(th1) : th1, theta2: signed ? Math.abs(th2) : th2, dphi: number('dphi') };
      const intervals = allowedIntervals(reaction, values);
      el('allowed-intervals').textContent = intervals.length ? `当前几何下粒子 1 允许总动能区间：${intervals.map(([a, b]) => `${num(a, 4)}–${num(b, 4)} MeV`).join('；')}。有限扫描可能漏掉极窄区间。` : '当前几何下有限扫描未发现粒子 1 允许动能区间。';
      roots = solveThree(reaction, values);
    } else { values = { theta_c: number('theta_c') }; roots = solveTwo(reaction, values.theta_c); }
    el('branch').innerHTML = roots.map((t, i) => `<option value="${i}">分支 ${i + 1}：${num(t)} MeV</option>`).reverse().join('');
    el('branch').disabled = !roots.length;
    if (!roots.length) { error('measurement-error', '当前角度或动能没有所选激发态的物理解，请调整基准事件。上方仍显示反应道整体运动学曲线。'); return; }
    applyBranch();
  }
  function updateReaction() {
    if (!massData || !el('reaction-form').reportValidity()) return;
    generation++; worker?.terminate(); error('reaction-error'); error('measurement-error');
    el('curve-plots').replaceChildren(); el('curve-status').textContent = ''; el('reaction-info').textContent = '';
    el('event-summary').replaceChildren(); el('allowed-intervals').textContent = ''; el('branch').replaceChildren(); el('sensitivity-results').hidden = true; el('export-result').disabled = true;
    reaction = null; result = null; roots = []; currentPlots = [];
    try {
      const r = { kind, energy: number('energy'), ex: number('ex') };
      for (const [id] of names) {
        const name = el(id).value.trim(), found = massData.nuclides.find(n => n.name === name);
        if (!found) throw new Error(`质量表中未找到核素“${name}”。请使用 10Be、1H 或 1n 格式，并注意元素大小写。`);
        r[id] = found;
      }
      const maxEx = validateReaction(r); reaction = r;
      currentFine = isThree && el('precision').value === 'fine';
      const reactionText = `${r.beam.name} + ${r.target.name} → ${isThree ? `${r.residue.name}* + ${r.particle1.name} + ${r.particle2.name}` : `${r.particle.name} + ${r.residue.name}*`}`;
      const estimated = names.filter(([id]) => r[id].estimated).map(([id]) => r[id].name);
      el('reaction-info').textContent = `${reactionText} · Ex=${r.ex} MeV · 可用 Ex ≤ ${num(maxEx, 4)} MeV${estimated.length ? ` · 注意：${estimated.join('、')} 使用表中带 # 的估算质量` : ''}`;
      el('curve-status').textContent = '正在计算运动学曲线…'; el('curve-plots').setAttribute('aria-busy', 'true');
      const thisGeneration = generation;
      const receive = ({ data }) => {
        if (thisGeneration !== generation) return;
        el('curve-plots').setAttribute('aria-busy', 'false');
        if (data.error) { el('curve-status').textContent = `曲线计算失败：${data.error}`; return; }
        currentPlots = data.plots; currentFine = fine;
        redrawCurves(); overlayController?.refresh();
        el('curve-status').textContent = `已生成 ${data.plots.length} 类关联 · 束流 ${r.energy} MeV/u · Ex ${r.ex} MeV${isThree ? ` · ${el('precision').value === 'fine' ? '精细' : '标准'}网格` : ''}`;
        worker.terminate();
      };
      const fine = isThree && el('precision').value === 'fine';
      const calculateLocally = () => {
        let cancelled = false;
        worker = { terminate() { cancelled = true; } };
        setTimeout(() => {
          if (cancelled || thisGeneration !== generation) return;
          try {
            if (!options.curves?.[kind]) throw new Error('缺少本地兼容计算入口，请刷新网页。');
            receive({ data: { plots: options.curves[kind](r, fine) } });
          } catch (e) { receive({ data: { error: e.message } }); }
        }, 0);
      };
      if (location.protocol === 'file:' || typeof Worker === 'undefined') calculateLocally();
      else {
        try {
          worker = new Worker(new URL('./curve-worker.js', baseURL), { type: 'module' });
          worker.onmessage = receive;
          worker.onerror = event => {
            event.preventDefault(); worker.terminate();
            if (thisGeneration === generation) calculateLocally();
          };
          worker.postMessage({ reaction: r, fine });
        } catch { calculateLocally(); }
      }
      updateMeasurements();
    } catch (e) { error('reaction-error', e.message); }
  }
  el('reaction-form').addEventListener('submit', event => { event.preventDefault(); updateReaction(); });
  el('reset-tool').addEventListener('click', () => {
    el('reaction-form').reset(); el('measurement-form').reset();
    if (isThree) syncAngleMode();
    for (const v of variables) el(`sigma-${v.key}`).value = v.unit === '°' ? .25 : 1;
    updateReaction();
  });
  el('measurement-form').addEventListener('submit', event => { event.preventDefault(); updateMeasurements(); });
  el('branch').addEventListener('change', applyBranch);
  el('sigma-fields').addEventListener('input', () => { if (roots.length) updateResolution(); });
  el('responses').addEventListener('toggle', updateResponses);
  function syncAngleMode() {
    const signed = el('angle-mode').value === 'signed';
    for (const id of ['theta1', 'theta2']) {
      el(id).min = signed ? -180 : 0;
      if (!signed) el(id).value = Math.abs(number(id));
      const label = el(id).parentElement.firstChild;
      label.textContent = `粒子 ${id === 'theta1' ? 1 : 2} ${signed ? '带符号角' : '极角'} (°)`;
    }
    el('dphi').readOnly = signed;
    if (signed) el('dphi').value = number('theta1') * number('theta2') < 0 ? 180 : 0;
    el('angle-note').textContent = signed ? '带符号角异号时 Δφ=180°，同号时 Δφ=0°。偏导针对非负极角；负角的有符号导数与极角导数相反。' : '极角范围 0°–180°。计算偏导数时固定输入的 Δφ，不计 Δφ 测量误差。';
  }
  if (isThree) {
    el('angle-mode').addEventListener('change', syncAngleMode);
    for (const id of ['theta1', 'theta2']) el(id).addEventListener('input', () => { if (el('angle-mode').value === 'signed') el('dphi').value = number('theta1') * number('theta2') < 0 ? 180 : 0; });
  }
  el('export-result').addEventListener('click', () => {
    if (!result || !reaction) return;
    const rows = [['kind', kind], ...names.map(([id]) => [id, reaction[id].name]), ['beam_energy_MeV_per_u', reaction.energy], ['reference_Ex_MeV', reaction.ex], ...Object.entries(values), ['mass_source', massData.source], ['mass_table_sha256', massData.table_sha256], [], ['variable', 'derivative', 'derivative_unit', 'plus1_deltaEx_MeV', 'minus1_deltaEx_MeV', 'input_sigma', 'variance_fraction'], ...result.rows.map(v => [v.key, v.derivative, `MeV/${v.unit}`, Number.isFinite(v.plus) ? v.plus : '', Number.isFinite(v.minus) ? v.minus : '', v.sigma, v.fraction]), [], ['sigma_Ex_MeV', result.sigma], ['gaussian_FWHM_MeV', result.fwhm]];
    download(`${kind}-body-sensitivity.csv`, csv(rows), 'text/csv;charset=utf-8');
  });
  // 表单更改后标记待应用，避免旧结果被误认为新配置的结果。
  el('reaction-form').addEventListener('input', () => { el('reaction-info').textContent = '配置已修改，点击“计算运动学”应用；当前结果仍对应上一次计算。'; });
  el('measurement-form').addEventListener('input', () => { el('measurement-error').hidden = false; el('measurement-error').textContent = '测量量已修改，点击“更新基准事件”应用；当前结果仍对应上一次事件。'; });
  try {
    if (options.masses) massData = options.masses;
    else {
      const response = await fetch(new URL('../data/nuclear-masses.json', baseURL));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      massData = await response.json();
    }
    el('nuclides').innerHTML = massData.nuclides.map(n => `<option value="${esc(n.name)}"></option>`).join('');
    el('mass-source').textContent = `${massData.nuclides.length} 个基态核素；原子质量单位 u = ${massData.amuMeV} MeV/c²。质量表 SHA-256：${massData.table_sha256}`;
    overlayController = mountOverlayManager(el('overlays'), { masses: massData, baseURL, curves: options.curves,
      getCurrent: () => reaction ? { reaction, plots: currentPlots, fine: currentFine } : null, onChange: redrawCurves });
    updateReaction();
  } catch (e) { error('reaction-error', `质量表加载失败：${e.message}。请确认网站资源完整并刷新网页。`); el('reaction-info').textContent = ''; }
}
