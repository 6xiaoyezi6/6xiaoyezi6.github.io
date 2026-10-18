/* 功能：提供两体/三体反应的四动量、物理解、缺失质量、偏导数与误差传播。
 * 方法：移植 KinematicsSensitivity.py 的解析动量求根、回代筛选和 h=0.001 差分；质量由调用方传入。
 * 注意事项：c=1；质量 MeV/c²，总动能 MeV，束流 MeV/u，极角 degree；无效物理量为 NaN。
 * 仅余核质量增加 Ex；重建和偏导保持其余测量量固定，不重新约束在同一激发态上。
 */
export const RAD = Math.PI / 180;
export const momentum = (T, m) => T >= 0 && m > 0 ? Math.sqrt(T * (T + 2 * m)) : NaN;
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const subtract = (a, b) => a.map((v, i) => v - b[i]);
export const direction = (theta, phi = 0) => [Math.sin(theta * RAD) * Math.cos(phi * RAD), Math.sin(theta * RAD) * Math.sin(phi * RAD), Math.cos(theta * RAD)];
export const invariantMass = (E, p) => E > 0 && E * E > dot(p, p) ? Math.sqrt(E * E - dot(p, p)) : NaN;
export const initialState = r => ({ E: r.beam.mass + r.beam.A * r.energy + r.target.mass, p: [0, 0, momentum(r.beam.A * r.energy, r.beam.mass)] });
export function validateReaction(r) {
  const incoming = [r.beam, r.target], outgoing = r.kind === 'two' ? [r.particle, r.residue] : [r.particle1, r.particle2, r.residue];
  if (![r.energy, r.ex].every(Number.isFinite) || r.energy <= 0 || r.ex < 0) throw new Error('束流动能须为有限正数，激发能须为有限非负数。');
  for (const key of ['A', 'Z']) if (incoming.reduce((s, n) => s + n[key], 0) !== outgoing.reduce((s, n) => s + n[key], 0)) throw new Error('反应道不满足核子数 A 或电荷数 Z 守恒。');
  const { E, p } = initialState(r);
  const maxEx = invariantMass(E, p) - outgoing.reduce((s, n) => s + n.mass, 0);
  if (!Number.isFinite(maxEx)) throw new Error('该输入超出了双精度计算的有效范围，请降低束流动能。');
  if (r.ex > maxEx + 1e-7) throw new Error(`反应道未开放：当前束流允许 Ex ≤ ${maxEx.toFixed(6)} MeV。`);
  return maxEx;
}
export function solveEmission(E, p, m, M, n) {
  if (E <= 0) return [];
  const q = dot(p, n), C = (E * E - dot(p, p) + m * m - M * M) / 2, a = E * E - q * q;
  if (a <= 0) return [];
  const disc = C * C - a * m * m, tol = 1e-13 * (C * C + a * m * m);
  if (disc < -tol) return [];
  const roots = [];
  for (const sign of [-1, 1]) {
    let v = (C * q + sign * E * Math.sqrt(Math.max(0, disc))) / a;
    if (v < -1e-9) continue;
    v = Math.max(0, v);
    const e = Math.hypot(v, m), T = v * v / (e + m), EB = E - e;
    const PB = subtract(p, n.map(x => v * x));
    if (EB < M - 1e-7 || Math.abs(E * e - q * v - C) > 1e-7 * Math.max(1, Math.abs(C))) continue;
    if (Math.abs(invariantMass(EB, PB) - M) < 1e-5 && roots.every(t => Math.abs(t - T) > 1e-6)) roots.push(T);
  }
  return roots.sort((a, b) => a - b);
}
export function solveTwo(r, theta) {
  if (theta < 0 || theta > 180) return [];
  const { E, p } = initialState(r);
  return solveEmission(E, p, r.particle.mass, r.residue.mass + r.ex, direction(theta)).filter(t => t > 1e-9);
}
export function solveThree(r, v) {
  if (v.T1 < 0 || v.theta1 < 0 || v.theta1 > 180 || v.theta2 < 0 || v.theta2 > 180) return [];
  const state = initialState(r), p1 = momentum(v.T1, r.particle1.mass);
  return solveEmission(state.E - r.particle1.mass - v.T1,
    subtract(state.p, direction(v.theta1).map(x => x * p1)), r.particle2.mass, r.residue.mass + r.ex, direction(v.theta2, v.dphi));
}
export function reconstruct(r, v) {
  let { E, p } = initialState(r);
  const measured = r.kind === 'two' ? [[r.particle, v.Tc, v.theta_c, 0]] : [[r.particle1, v.T1, v.theta1, 0], [r.particle2, v.T2, v.theta2, v.dphi]];
  for (const [nuclide, T, theta, phi] of measured) {
    if (T < 0 || theta < 0 || theta > 180) return NaN;
    E -= nuclide.mass + T;
    p = subtract(p, direction(theta, phi).map(x => x * momentum(T, nuclide.mass)));
  }
  return invariantMass(E, p) - r.residue.mass;
}
export function residueState(r, v) {
  const state = initialState(r), pc = momentum(v.Tc, r.particle.mass);
  const p = subtract(state.p, direction(v.theta_c).map(x => x * pc));
  return { theta: Math.hypot(...p) > 1e-9 ? Math.atan2(Math.hypot(p[0], p[1]), p[2]) / RAD : NaN, T: state.E - r.particle.mass - v.Tc - r.residue.mass - r.ex };
}
export const bounds = key => key.startsWith('theta') ? [0, 180] : [0, Infinity];
export function derivative(r, v, key, h = 1e-3) {
  const [lo, hi] = bounds(key), plus = { ...v, [key]: v[key] + h }, minus = { ...v, [key]: v[key] - h };
  if (minus[key] < lo) return (reconstruct(r, plus) - reconstruct(r, v)) / h;
  if (plus[key] > hi) return (reconstruct(r, v) - reconstruct(r, minus)) / h;
  return (reconstruct(r, plus) - reconstruct(r, minus)) / (2 * h);
}
export function shift(r, v, key, delta) {
  const [lo, hi] = bounds(key), value = v[key] + delta;
  return value >= lo && value <= hi ? reconstruct(r, { ...v, [key]: value }) - reconstruct(r, v) : NaN;
}
export function allowedIntervals(r, v, n = 5000) {
  const maxT = initialState(r).E - r.residue.mass - r.ex - r.particle1.mass - r.particle2.mass;
  if (maxT <= 0) return [];
  const valid = t => solveThree(r, { ...v, T1: t }).length > 0;
  const refine = (lo, hi, rightValid) => {
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (valid(m) === rightValid) hi = m; else lo = m; }
    return (lo + hi) / 2;
  };
  const ranges = []; let start = valid(0) ? 0 : null, previous = start !== null;
  for (let i = 1; i <= n; i++) {
    const t = maxT * i / n, flag = valid(t);
    if (flag && !previous) start = refine(maxT * (i - 1) / n, t, true);
    if (!flag && previous) ranges.push([start, refine(maxT * (i - 1) / n, t, false)]);
    previous = flag;
  }
  if (previous) ranges.push([start, maxT]);
  return ranges;
}
export function sensitivity(r, v, variables, sigmas) {
  const rows = variables.map(item => ({ ...item, derivative: derivative(r, v, item.key), plus: shift(r, v, item.key, 1), minus: shift(r, v, item.key, -1), sigma: sigmas[item.key] }));
  const variance = rows.reduce((s, row) => s + (row.derivative * row.sigma) ** 2, 0);
  return { rows: rows.map(row => ({ ...row, fraction: variance > 0 ? (row.derivative * row.sigma) ** 2 / variance : 0 })), sigma: Math.sqrt(variance), fwhm: 2.354820045 * Math.sqrt(variance) };
}
