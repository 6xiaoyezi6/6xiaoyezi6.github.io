/* 功能：验证两体/三体数值闭合、边界残差、阈值/守恒、偏导数和独立误差传播。
 * 方法：使用质量表构造真实反应，多角度多激发态验证重建；边界用独立模长闭合条件检验。
 * 注意事项：无需浏览器和 npm 依赖；三体有限网格只检查采样边界，不宣称解析精确包络。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, momentum, solveTwo, solveThree, validateReaction, reconstruct, derivative, sensitivity, shift } from '../assets/js/physics.js';
import { twoBodyCurves } from '../kinematics/two-body/script.js';
import { threeBodyCurves } from '../kinematics/three-body/script.js';
const data = JSON.parse(readFileSync(new URL('../assets/data/nuclear-masses.json', import.meta.url)));
const n = name => data.nuclides.find(n => n.name === name);
const two = (ex = 0) => ({ kind: 'two', beam: n('4He'), target: n('1H'), particle: n('1H'), residue: n('4He'), energy: 150, ex });
const three = (ex = 0) => ({ kind: 'three', beam: n('10Be'), target: n('1H'), residue: n('6He'), particle1: n('1H'), particle2: n('4He'), energy: 150, ex });
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
test('质量表包含原接口全部核素且质量数独立保存', () => {
  assert.equal(data.nuclides.length, 3558);
  assert.equal(n('10Be').A, 10); assert.equal(n('1n').Z, 0);
  assert.match(data.table_sha256, /^[a-f0-9]{64}$/);
  assert.equal(new Set(data.nuclides.map(n => n.name)).size, 3558);
});
test('两体在不同束流/Ex/角度下每个非零物理解均闭合', () => {
  let events = 0;
  for (const ex of [0, 1, 4]) for (const energy of [20, 150, 300]) for (const theta of [0, 2, 15, 30, 65, 89, 120, 180]) {
    const r = { ...two(ex), energy };
    for (const Tc of solveTwo(r, theta)) { near(reconstruct(r, { Tc, theta_c: theta }), ex); events++; }
  }
  assert.ok(events > 70);
});
test('三体两种激发态及非共面几何均闭合，负动能拒绝', () => {
  for (const ex of [0, 1]) for (const dphi of [180, 163]) {
    const r = three(ex), v = { T1: 40, theta1: 65, theta2: 7.7, dphi };
    const roots = solveThree(r, v); assert.ok(roots.length);
    roots.forEach(T2 => near(reconstruct(r, { ...v, T2 }), ex));
    assert.deepEqual(solveThree(r, { ...v, T1: -1 }), []);
  }
});
test('双分支反应保留全部物理解与曲线', () => {
  const r = { ...two(), beam: n('10Be'), particle: n('10Be'), residue: n('1H') };
  const roots = solveTwo(r, 2); assert.equal(roots.length, 2);
  roots.forEach(Tc => near(reconstruct(r, { Tc, theta_c: 2 }), 0));
  const plots = twoBodyCurves(r); assert.equal(plots.length, 3);
  assert.ok(plots[0].branches.every(branch => branch.some(Boolean)));
});
test('守恒、负激发能与未开放反应道明确报错', () => {
  assert.throws(() => validateReaction({ ...two(), residue: n('6He') }), /守恒/);
  assert.throws(() => validateReaction(two(-1)), /非负/);
  assert.throws(() => validateReaction(two(999)), /未开放/);
  assert.throws(() => validateReaction({ ...two(), energy: Infinity }), /有限/);
  assert.doesNotThrow(() => validateReaction(three()));
});
test('中心差分收敛、边界单侧差分、σ传播与 ±1 定义', () => {
  const r = two(), v = { theta_c: 65, Tc: solveTwo(r, 65).at(-1) };
  for (const key of ['theta_c', 'Tc']) near(derivative(r, v, key), derivative(r, v, key, .0005), 2e-6);
  const zero = { theta_c: 0, Tc: solveTwo(r, 0).at(-1) };
  assert.ok(Number.isFinite(derivative(r, zero, 'theta_c')));
  assert.ok(Number.isNaN(shift(r, zero, 'theta_c', -1)));
  const variables = [{ key: 'theta_c' }, { key: 'Tc' }], sigmas = { theta_c: .25, Tc: 1 };
  const result = sensitivity(r, v, variables, sigmas);
  near(result.sigma, Math.hypot(derivative(r, v, 'theta_c') * .25, derivative(r, v, 'Tc')));
  near(result.rows.reduce((s, row) => s + row.fraction, 0), 1);
  near(sensitivity(r, v, variables, { theta_c: 0, Tc: 0 }).sigma, 0);
});
test('三体七图边界满足模长闭合与余核激发能约定', () => {
  for (const ex of [0, 1]) {
    const r = three(ex), plots = threeBodyCurves(r), { E, p } = initialState(r);
    assert.equal(plots.length, 7);
    plots.forEach(plot => assert.ok(plot.branches.flat().some(Boolean), plot.title));
    const m = [r.particle1.mass, r.particle2.mass, r.residue.mass + r.ex], available = E - m.reduce((a, b) => a + b, 0);
    [[0, 2], [0, 1], [2, 1]].forEach(([ix, iy], k) => {
      const iz = 3 - ix - iy;
      for (const branch of plots[k].branches) for (let i = 0; i < branch.length; i += 47) {
        const point = branch[i]; if (!point) continue;
        const [x, y] = point, ps = [p[2], momentum(x, m[ix]), momentum(y, m[iy]), momentum(Math.max(0, available - x - y), m[iz])];
        assert.ok(Math.min(...ps.map(v => Math.abs(2 * v - ps.reduce((a, b) => a + b, 0)))) < 1e-5);
      }
    });
    for (let k = 0; k < 3; k++) for (const branch of plots[k + 3].branches) for (let i = 0; i < branch.length; i += 89) {
      if (!branch[i]) continue;
      const [angle, T] = branch[i], M = m.reduce((a, v, j) => a + (j === k ? 0 : v), 0), pc = momentum(T, m[k]);
      const invariant = (E - m[k] - T) ** 2 - (p[2] ** 2 + pc ** 2 - 2 * p[2] * pc * Math.cos(angle * Math.PI / 180));
      near(invariant, M * M, 2e-5);
    }
  }
});
