/* 功能：验证双向物理解、三体反查区间、混合反应道叠加、轴互换和导出元数据。
 * 方法：用真实事件正反查询闭合；逐项验证叠加查询仍调用各自反应方程，比较配置只读。
 * 注意事项：全部质量使用原接口快照；总动能 MeV、角度 degree，不依赖图像或线性插值。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { queryKinematic } from '../assets/js/kinematic-geometry.js';
import { residueState } from '../assets/js/physics.js';
import { twoBodyCurves } from '../kinematics/two-body/script.js';
import { threeBodyCurves } from '../kinematics/three-body/script.js';
import { comparisonPlots, overlaySeries, mappingChoices, packReaction, unpackReaction } from '../assets/js/overlay-manager.js';
import { plotCSV } from '../assets/js/plots.js';
const masses = JSON.parse(readFileSync(new URL('../assets/data/nuclear-masses.json', import.meta.url)));
const n = name => masses.nuclides.find(n => n.name === name);
const two = { kind: 'two', beam: n('4He'), target: n('1H'), particle: n('1H'), residue: n('4He'), energy: 150, ex: 0 };
const three = { kind: 'three', beam: n('10Be'), target: n('1H'), residue: n('6He'), particle1: n('1H'), particle2: n('4He'), energy: 150, ex: 0 };
const close = (a, b, tol = 1e-5) => Math.abs(a - b) < tol;
const entry = (r, name) => ({ reaction: r, name, color: '#a84b37', visible: true, fine: false, mappings: {}, plots: comparisonPlots(r, r.kind === 'two' ? twoBodyCurves(r) : threeBodyCurves(r)) });
test('两体全部投影正反查询闭合，保留多解并处理零动量', () => {
  for (const r of [two, { ...two, beam: n('10Be'), particle: n('10Be'), residue: n('1H') }]) for (const theta of [.1, 1, 2, 5, 30, 65, 89, 89.9]) {
    for (const Tc of queryKinematic(r, 'c-angle', theta).values) {
      assert.ok(queryKinematic(r, 'c-angle', Tc, false, 'y').values.some(x => close(x, theta)));
      const d = residueState(r, { Tc, theta_c: theta });
      assert.ok(queryKinematic(r, 'd-angle', d.T, false, 'y').values.some(x => close(x, d.theta)));
      assert.ok(queryKinematic(r, 'd-c-angle', theta, false, 'y').values.some(x => close(x, d.theta)));
    }
  }
  assert.equal(queryKinematic(two, 'c-angle', 0, false, 'y').type, 'undefined');
  assert.deepEqual(queryKinematic(two, 'c-angle', 1e6, false, 'y').values, []);
});
test('三体七个投影均支持反查，原横轴值位于反查允许区间', () => {
  for (const plot of threeBodyCurves(three)) {
    const points = plot.branches.flat().filter(Boolean), x = points[Math.floor(points.length / 5)][0];
    const forward = queryKinematic(three, plot.relation, x), y = (forward.values[0] + forward.values.at(-1)) / 2;
    const reverse = queryKinematic(three, plot.relation, y, false, 'y');
    assert.equal(reverse.type, 'interval', plot.relation);
    assert.ok(x >= reverse.values[0] - 1e-5 && x <= reverse.values[1] + 1e-5, `${plot.relation}: ${x} outside ${reverse.values}`);
    assert.deepEqual(queryKinematic(three, plot.relation, -1, false, 'y').values, []);
  }
});
test('同类多反应道分别求解，隐藏及移除不会改变主反应', () => {
  const before = JSON.stringify(two), target = twoBodyCurves(two)[0], other = { ...two, energy: 120, ex: 1 };
  const a = entry(other, 'other'), b = entry({ ...two, energy: 200 }, 'high');
  const series = overlaySeries(two, target, [a, b]); assert.equal(series.length, 3);
  assert.deepEqual(series[1].query('x', 65), queryKinematic(other, 'c-angle', 65));
  assert.deepEqual(series[1].query('y', series[1].query('x', 65).values[0]), queryKinematic(other, 'c-angle', series[1].query('x', 65).values[0], false, 'y'));
  a.visible = false; assert.equal(overlaySeries(two, target, [a, b]).length, 2);
  assert.equal(JSON.stringify(two), before);
});
test('两体可叠到三体全部七图，三体可叠到两体三图，能量–能量坐标也兼容', () => {
  const b = entry(two, 'two'), t = entry(three, 'three');
  for (const plot of threeBodyCurves(three)) assert.equal(overlaySeries(three, plot, [b]).length, 2, plot.relation);
  for (const plot of twoBodyCurves(two)) assert.equal(overlaySeries(two, plot, [t]).length, 2, plot.relation);
  const target = threeBodyCurves(three)[0], layers = overlaySeries(three, target, [b]);
  const x = queryKinematic(two, 'c-angle', 65).values[0];
  const y = layers[1].query('x', x).values[0];
  assert.ok(layers[1].query('y', y).values.some(v => close(v, x)));
  assert.match(layers[1].mapping, /Tc.*T₁/);
});
test('交换轴时坐标与双向查询同时交换；显式关闭投影有效', () => {
  const e = entry(three, 'swapped'), target = threeBodyCurves(three)[0];
  e.mappings.three = { [target.relation]: 'energy-1-2:yx' };
  const series = overlaySeries(three, target, [e]), source = e.plots.find(p => p.relation === 'energy-1-2');
  assert.deepEqual(series[1].branches[0][12], [source.branches[0][12][1], source.branches[0][12][0]]);
  assert.deepEqual(series[1].query('x', 400), queryKinematic(three, source.relation, 400, false, 'y'));
  assert.deepEqual(series[1].query('y', 40), queryKinematic(three, source.relation, 40));
  e.mappings.three[target.relation] = 'off'; assert.equal(overlaySeries(three, target, [e]).length, 1);
});
test('不允许把能量–能量投影映射为角度–能量；配置导入校验守恒与核素', () => {
  const sources = comparisonPlots(two, twoBodyCurves(two));
  const choices = mappingChoices(threeBodyCurves(three)[3], sources);
  assert.ok(choices.every(c => c.relation !== 'c-energy-d-energy'));
  assert.deepEqual(packReaction(unpackReaction(packReaction(three), masses)), packReaction(three));
  assert.throws(() => unpackReaction({ ...packReaction(two), residue: '6He' }, masses), /守恒/);
  assert.throws(() => unpackReaction({ ...packReaction(two), beam: 'nope' }, masses), /核素/);
});
test('叠加CSV保留各反应道和轴映射，排除隐藏曲线', () => {
  const a = entry(two, 'visible'), b = entry({ ...two, energy: 200 }, 'hidden'); b.visible = false;
  const target = threeBodyCurves(three)[3], data = plotCSV(target, overlaySeries(three, target, [a, b]));
  assert.match(data, /axis_mapping/); assert.match(data, /visible/); assert.doesNotMatch(data, /hidden/); assert.match(data, /θc.*θ₁/);
});
