/* 功能：求连续边界、物理区间及横轴/纵轴两个方向的查询值。
 * 方法：两体质心变换与解析反解角度；三体以质量不等式、动量多边形、角锥及粒子置换反查。
 * 注意事项：仅使用传入的原接口核质量；总动能 MeV、角度 degree。角度包络用数值极值细化。
 * 区间表示整体相空间，不固定灵敏度模块的基准事件几何；没有物理解返回 null/空数组。
 */
import { RAD, initialState, momentum, solveEmission, direction, invariantMass } from './physics.js';
export function pairCM(E, P, m, M) {
  const s = E * E - P * P, W = Math.sqrt(s);
  const f = (s - (m + M) ** 2) * (s - (m - M) ** 2);
  if (!(W > 0) || f < -1e-10 * s * s || W < m + M - 1e-7) return null;
  const p = Math.sqrt(Math.max(0, f)) / (2 * W);
  return { p, e: Math.hypot(m, p), gamma: E / W, beta: P / E, W };
}
export function inclusiveEnergyLimits(E, P, m, M) {
  const cm = pairCM(E, P, m, M);
  if (!cm) return null;
  const high = cm.gamma * (cm.e + cm.beta * cm.p) - m;
  const low = cm.beta > cm.p / cm.e ? cm.gamma * (cm.e - cm.beta * cm.p) - m : 0;
  return [Math.max(0, low), Math.max(0, high)];
}
export function maximumLabAngle(E, P, m, M) {
  const cm = pairCM(E, P, m, M);
  if (!cm) return NaN;
  if (cm.p / cm.e > cm.beta + 1e-12) return 180;
  if (Math.abs(cm.p / cm.e - cm.beta) <= 1e-12 && cm.p > 0) return 90;
  if (cm.beta === 0) return cm.p > 0 ? 180 : 0;
  return Math.asin(Math.min(1, cm.p / (cm.gamma * cm.beta * m))) / RAD;
}
export function energyAtAngle(E, P, m, M, theta) {
  if (!Number.isFinite(theta) || theta < 0 || theta > 180) return null;
  const roots = solveEmission(E, [0, 0, P], m, M, direction(theta));
  const C = (E * E - P * P + m * m - M * M) / 2;
  // T=0 的方向没有定义，但为非零动能相空间的连续极限。
  const zeroAllowed = E * m <= C + 1e-10 * Math.max(1, Math.abs(C));
  if (!roots.length) return zeroAllowed ? [0, 0] : null;
  return [zeroAllowed ? 0 : roots[0], roots.at(-1)];
}
export const cosineGrid = (low, high, n) => Array.from({ length: n + 1 }, (_, i) => low + (high - low) * (1 - Math.cos(Math.PI * i / n)) / 2);
export function bisectIncreasing(fn, lo, hi, target) {
  for (let i = 0; i < 65; i++) { const mid = (lo + hi) / 2; if (fn(mid) < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
export function energyEnergyInterval(r, ix, iy, x) {
  const { E, p } = initialState(r), P = p[2];
  const m = [r.particle1.mass, r.particle2.mass, r.residue.mass + r.ex], iz = 3 - ix - iy;
  const limits = inclusiveEnergyLimits(E, P, m[ix], m[iy] + m[iz]);
  const tol = 1e-8 * Math.max(1, limits?.[1] || 0);
  if (!Number.isFinite(x) || !limits || x < limits[0] - tol || x > limits[1] + tol) return null;
  x = Math.max(limits[0], Math.min(limits[1], x));
  const remaining = E - m.reduce((a, v) => a + v, 0) - x;
  if (remaining < -1e-7) return null;
  const maxY = Math.max(0, remaining), pi = momentum(x, m[ix]);
  const a = Math.abs(P - pi), b = P + pi, peak = maxY * m[iy] / (m[iy] + m[iz]);
  const sum = y => momentum(y, m[iy]) + momentum(Math.max(0, maxY - y), m[iz]);
  const difference = y => momentum(y, m[iy]) - momentum(Math.max(0, maxY - y), m[iz]);
  if (sum(peak) < a - 1e-6) return null;
  let lo = 0, hi = maxY;
  if (sum(0) < a) lo = bisectIncreasing(sum, 0, peak, a);
  if (sum(maxY) < a) hi = bisectIncreasing(y => -sum(y), peak, maxY, -a);
  if (difference(lo) < -b) lo = bisectIncreasing(difference, lo, hi, -b);
  if (difference(hi) > b) hi = bisectIncreasing(difference, lo, hi, b);
  if (lo > hi + 1e-6) return null;
  return [lo, hi];
}
// 从余下二体系统的质心速度得到粒子2相对其总动量方向的允许角锥。
function angleCone(E, p, emitted, missing) {
  const P = Math.hypot(...p), W = invariantMass(E, p), cm = pairCM(E, P, emitted, missing);
  if (!Number.isFinite(W) || !cm) return null;
  if (cm.p / cm.e > cm.beta + 1e-12) return [0, 180];
  const axis = P > 1e-10 ? Math.atan2(Math.hypot(p[0], p[1]), p[2]) / RAD : 0;
  const half = maximumLabAngle(E, P, emitted, missing);
  return [Math.max(0, axis - half), Math.min(180, axis + half)];
}
function goldenExtreme(fn, lo, hi, maximize) {
  const sign = maximize ? -1 : 1, ratio = (Math.sqrt(5) - 1) / 2;
  let a = hi - ratio * (hi - lo), b = lo + ratio * (hi - lo), fa = sign * fn(a), fb = sign * fn(b);
  for (let i = 0; i < 52; i++) {
    if (fa < fb) { hi = b; b = a; fb = fa; a = hi - ratio * (hi - lo); fa = sign * fn(a); }
    else { lo = a; a = b; fa = fb; b = lo + ratio * (hi - lo); fb = sign * fn(b); }
  }
  return fn((lo + hi) / 2);
}
export function angleAngleInterval(r, theta2, fine = false) {
  const { E, p } = initialState(r), m1 = r.particle1.mass, m2 = r.particle2.mass, mB = r.residue.mass + r.ex;
  const maxAngle = maximumLabAngle(E, p[2], m2, m1 + mB);
  if (!Number.isFinite(theta2) || theta2 < 0 || theta2 > maxAngle + 1e-8) return null;
  const range = energyAtAngle(E, p[2], m2, m1 + mB, Math.min(theta2, maxAngle));
  if (!range) return null;
  const n = direction(theta2), evaluate = T2 => {
    const p2 = momentum(T2, m2);
    return angleCone(E - m2 - T2, p.map((v, i) => v - n[i] * p2), m1, mB);
  };
  const grid = cosineGrid(...range, fine ? 160 : 80), samples = grid.map(evaluate);
  let low = Infinity, high = -Infinity;
  for (const v of samples) if (v) { low = Math.min(low, v[0]); high = Math.max(high, v[1]); }
  for (let j = 1; j < grid.length - 1; j++) {
    if (!samples[j - 1] || !samples[j] || !samples[j + 1]) continue;
    for (const k of [0, 1]) {
      const v = samples[j][k], left = samples[j - 1][k], right = samples[j + 1][k];
      if ((k === 0 && v <= left && v <= right && (v < left || v < right)) || (k === 1 && v >= left && v >= right && (v > left || v > right))) {
        const refined = goldenExtreme(t => evaluate(t)?.[k] ?? (k ? -Infinity : Infinity), grid[j - 1], grid[j + 1], k === 1);
        if (k === 0) low = Math.min(low, refined); else high = Math.max(high, refined);
      }
    }
  }
  return Number.isFinite(low) && Number.isFinite(high) ? [low, high] : null;
}
export function queryKinematic(r, relation, x, fine = false, axis = 'x') {
  if (axis === 'y') return queryKinematicReverse(r, relation, x, fine);
  if (!Number.isFinite(x)) return { type: 'none', values: [] };
  const state = initialState(r);
  if (r.kind === 'two') {
    if (relation === 'c-energy-d-energy') {
      const check = queryKinematicReverse(r, 'c-angle', x, fine);
      const y = state.E - r.particle.mass - r.residue.mass - r.ex - x;
      return check.values.length ? { type: 'points', values: [y] } : { type: 'none', values: [] };
    }
    if (relation === 'c-angle') {
      if (x < .1 || x > 89.9) return { type: 'none', values: [] };
      const values = solveEmission(state.E, state.p, r.particle.mass, r.residue.mass + r.ex, direction(x)).filter(t => t > 1e-9);
      return { type: 'points', values };
    }
    if (x < 0 || x > 180) return { type: 'none', values: [] };
    const roots = solveEmission(state.E, state.p, r.residue.mass + r.ex, r.particle.mass, direction(x)).filter(t => t > 1e-9);
    const values = [];
    for (const T of roots) {
      const pd = momentum(T, r.residue.mass + r.ex), pc = state.p.map((v, i) => v - direction(x)[i] * pd);
      const theta = Math.atan2(Math.hypot(pc[0], pc[1]), pc[2]) / RAD;
      const Tc = state.E - r.residue.mass - r.ex - T - r.particle.mass;
      if (theta < .1 - 1e-8 || theta > 89.9 + 1e-8 || Tc <= 1e-9) continue;
      values.push(relation === 'd-angle' ? T : theta);
    }
    return { type: 'points', values: [...new Set(values)].sort((a, b) => a - b) };
  }
  const pair = { 'energy-1-B': [0, 2], 'energy-1-2': [0, 1], 'energy-B-2': [2, 1] }[relation];
  let interval;
  if (pair) interval = energyEnergyInterval(r, ...pair, x);
  else if (relation === 'angle-2-1') interval = angleAngleInterval(r, x, fine);
  else {
    const index = { 'angle-1-energy': 0, 'angle-2-energy': 1, 'angle-B-energy': 2 }[relation];
    if (index === undefined) return { type: 'none', values: [] };
    const m = [r.particle1.mass, r.particle2.mass, r.residue.mass + r.ex];
    interval = energyAtAngle(state.E, state.p[2], m[index], m.reduce((s, v, i) => s + (i === index ? 0 : v), 0), x);
  }
  return interval ? { type: 'interval', values: interval } : { type: 'none', values: [] };
}
export function queryKinematicReverse(r, relation, y, fine = false) {
  const none = { type: 'none', values: [] };
  if (!Number.isFinite(y)) return none;
  const { E, p } = initialState(r), P = p[2];
  const restDirection = { type: 'undefined', values: [], message: '总动能为 0，粒子静止，出射角未定义。' };
  if (r.kind === 'two') {
    if (relation === 'd-c-angle') {
      const roots = queryKinematic(r, 'c-angle', y, fine).values;
      const angles = roots.map(T => {
        const pc = momentum(T, r.particle.mass), n = direction(y), q = p.map((v, i) => v - pc * n[i]);
        return Math.hypot(...q) > 1e-9 ? Math.atan2(Math.hypot(q[0], q[1]), q[2]) / RAD : NaN;
      }).filter(Number.isFinite);
      return { type: 'points', values: angles.sort((a, b) => a - b).filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) > 1e-7) };
    }
    if (relation === 'c-energy-d-energy') {
      const x = E - r.particle.mass - r.residue.mass - r.ex - y;
      return queryKinematic(r, relation, x, fine).values.length ? { type: 'points', values: [x] } : none;
    }
    if (!['c-angle', 'd-angle'].includes(relation) || y < 0) return none;
    const m = relation === 'c-angle' ? r.particle.mass : r.residue.mass + r.ex;
    const M = relation === 'c-angle' ? r.residue.mass + r.ex : r.particle.mass;
    if (y === 0) return restDirection;
    const C = (E * E - P * P + m * m - M * M) / 2;
    const cos = (E * (m + y) - C) / (P * momentum(y, m));
    if (!Number.isFinite(cos) || cos < -1 - 1e-10 || cos > 1 + 1e-10) return none;
    let theta = Math.acos(Math.max(-1, Math.min(1, cos))) / RAD;
    // 反解 acos 在角度截断点附近有消减误差，仅将浮点误差范围内的端点归回原值。
    if (relation === 'c-angle' && theta >= .1 - 1e-7 && theta <= 89.9 + 1e-7) theta = Math.max(.1, Math.min(89.9, theta));
    const check = queryKinematic(r, relation, theta, fine).values;
    return check.some(t => Math.abs(t - y) < 1e-5) ? { type: 'points', values: [theta] } : none;
  }
  const pair = { 'energy-1-B': [0, 2], 'energy-1-2': [0, 1], 'energy-B-2': [2, 1] }[relation];
  let interval;
  if (pair) interval = energyEnergyInterval(r, pair[1], pair[0], y);
  else if (relation === 'angle-2-1') interval = angleAngleInterval({ ...r, particle1: r.particle2, particle2: r.particle1 }, y, fine);
  else {
    const index = { 'angle-1-energy': 0, 'angle-2-energy': 1, 'angle-B-energy': 2 }[relation];
    if (index === undefined || y < 0) return none;
    const masses = [r.particle1.mass, r.particle2.mass, r.residue.mass + r.ex], m = masses[index], M = masses.reduce((s, v, i) => s + (i === index ? 0 : v), 0);
    const limits = inclusiveEnergyLimits(E, P, m, M);
    if (!limits || y < limits[0] - 1e-7 || y > limits[1] + 1e-7) return none;
    if (y === 0) return restDirection;
    const C = (E * E - P * P + m * m - M * M) / 2, cos = (E * (m + y) - C) / (P * momentum(y, m));
    if (!Number.isFinite(cos) || cos > 1 + 1e-9) return none;
    interval = [0, Math.acos(Math.max(-1, Math.min(1, cos))) / RAD];
  }
  return interval ? { type: 'interval', values: interval } : none;
}
