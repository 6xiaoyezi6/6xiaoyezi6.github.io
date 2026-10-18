/* 功能：验证逐图查询、连续转折点、三体区间与离线 LaTeX 字形。
 * 方法：对照四动量闭合和多边形不等式；以独立求解的真实三体事件检查角度包络覆盖。
 * 注意事项：总能量 MeV、角度 degree；角度极值采用数值容差，禁止用插值结果冒充精确查询。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, momentum, solveTwo, solveThree, reconstruct, residueState } from '../assets/js/physics.js';
import { queryKinematic, maximumLabAngle, energyEnergyInterval, angleAngleInterval, inclusiveEnergyLimits } from '../assets/js/kinematic-geometry.js';
import { twoBodyCurves } from '../kinematics/two-body/script.js';
import { threeBodyCurves } from '../kinematics/three-body/script.js';
import { mathLabels } from '../assets/js/math-labels.js';
const data = JSON.parse(readFileSync(new URL('../assets/data/nuclear-masses.json', import.meta.url)));
const n = name => data.nuclides.find(n => n.name === name);
const two = { kind: 'two', beam: n('4He'), target: n('1H'), particle: n('1H'), residue: n('4He'), energy: 150, ex: 0 };
const three = { kind: 'three', beam: n('10Be'), target: n('1H'), residue: n('6He'), particle1: n('1H'), particle2: n('4He'), energy: 150, ex: 0 };
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
test('两体65°查询是解析物理解，余核两图可反查同一事件', () => {
  const q = queryKinematic(two, 'c-angle', 65); assert.equal(q.type, 'points');
  near(q.values[0], 60.2961956125, 1e-5);
  near(reconstruct(two, { theta_c: 65, Tc: q.values[0] }), 0);
  const state = residueState(two, { theta_c: 65, Tc: q.values[0] });
  assert.ok(queryKinematic(two, 'd-angle', state.theta).values.some(v => Math.abs(v - state.T) < 1e-6));
  assert.ok(queryKinematic(two, 'd-c-angle', state.theta).values.some(v => Math.abs(v - 65) < 1e-6));
  assert.deepEqual(queryKinematic(two, 'c-angle', 150).values, []);
});
test('多解全部保留，曲线包含准确汇合点并满足四动量', () => {
  const r = { ...two, beam: n('10Be'), particle: n('10Be'), residue: n('1H') };
  const q = queryKinematic(r, 'c-angle', 2); assert.equal(q.values.length, 2);
  const { E, p } = initialState(r), turning = maximumLabAngle(E, p[2], r.particle.mass, r.residue.mass);
  const plot = twoBodyCurves(r)[0], points = plot.branches.flat().filter(Boolean);
  near(Math.max(...points.map(v => v[0])), turning, 1e-10);
  for (let i = 0; i < points.length; i += 83) near(reconstruct(r, { theta_c: points[i][0], Tc: points[i][1] }), 0);
});
test('三体能量–能量查询的内部满足闭合，边界外不允许', () => {
  const { E, p } = initialState(three), m = [three.particle1.mass, three.particle2.mass, three.residue.mass];
  const total = E - m.reduce((a, b) => a + b, 0);
  for (const [ix, iy] of [[0, 1], [0, 2], [2, 1]]) {
    const iz = 3 - ix - iy, limits = inclusiveEnergyLimits(E, p[2], m[ix], m[iy] + m[iz]);
    for (const fraction of [.01, .2, .5, .8, .99]) {
      const x = limits[0] + (limits[1] - limits[0]) * fraction, [lo, hi] = energyEnergyInterval(three, ix, iy, x);
      const closure = y => {
        const ps = [p[2], momentum(x, m[ix]), momentum(y, m[iy]), momentum(total - x - y, m[iz])];
        return Math.max(...ps.map(v => 2 * v - ps.reduce((a, b) => a + b, 0)));
      };
      assert.ok(closure((lo + hi) / 2) < 1e-6);
      if (lo > 1e-3) assert.ok(closure(lo - 1e-3) > 0);
      if (total - x - hi > 1e-3) assert.ok(closure(hi + 1e-3) > 0);
    }
  }
});
test('角度包络覆盖独立求得的真实事件，精细模式数值稳定', () => {
  let count = 0;
  for (const theta2 of [0, 3, 7.7, 13, 19, 23]) {
    const normal = angleAngleInterval(three, theta2), fine = angleAngleInterval(three, theta2, true);
    assert.ok(normal && fine);
    near(normal[0], fine[0], 1e-4); near(normal[1], fine[1], 1e-4);
    for (const theta1 of [0, 10, 30, 50, 65, 75]) for (const T1 of [5, 40, 120, 250]) for (const dphi of [0, 90, 180]) {
      const v = { theta1, theta2, T1, dphi };
      for (const T2 of solveThree(three, v)) {
        assert.ok(theta1 >= normal[0] - 1e-5 && theta1 <= normal[1] + 1e-5, `${theta1} outside ${normal}`);
        near(reconstruct(three, { ...v, T2 }), 0); count++;
      }
    }
  }
  assert.ok(count > 100);
});
test('七个边界均闭合且无采样断点，查询标识唯一', () => {
  const plots = threeBodyCurves(three);
  assert.equal(new Set(plots.map(p => p.relation)).size, 7);
  for (const plot of plots) {
    assert.equal(plot.branches.length, 1, plot.title);
    const branch = plot.branches[0]; assert.deepEqual(branch[0], branch.at(-1));
    assert.ok(branch.every(p => p && p.every(Number.isFinite)));
  }
});
test('全部坐标字形由LaTeX矢量路径组成，无运行时字体依赖', () => {
  const plots = [...twoBodyCurves(two), ...threeBodyCurves(three)];
  for (const key of new Set([...plots.flatMap(p => [p.xLabel, p.yLabel]), 'ΔEx (MeV)'])) {
    const label = mathLabels[key]; assert.ok(label, key); assert.match(label.tex, /\\/);
    const svg = Buffer.from(label.uri.split(',')[1], 'base64').toString();
    assert.match(svg, /<path/); assert.doesNotMatch(svg, /<text|font-face/);
  }
});
