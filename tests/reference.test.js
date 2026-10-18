/* 功能：对比原 Python 程序生成的分支、激发能、偏导数、±1 偏差和允许区间。
 * 方法：优先读取本次生成的独立参照，否则使用随仓库保存的原程序数值快照。
 * 注意事项：scripts/validate-reference.py 可刷新对照；容差覆盖浮点消减，不放宽物理解筛选。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { solveTwo, solveThree, reconstruct, derivative, shift, allowedIntervals } from '../assets/js/physics.js';
const masses = JSON.parse(readFileSync(new URL('../assets/data/nuclear-masses.json', import.meta.url)));
const live = new URL('../.cache/python-reference.json', import.meta.url);
const path = existsSync(live) ? live : new URL('./python-reference.json', import.meta.url);
const reference = JSON.parse(readFileSync(path));
const near = (a, b, tol = 2e-7) => b === null ? assert.ok(Number.isNaN(a)) : assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
test('原 Python 数值对照（完整分支、重建、全部偏导与 ±1）', () => {
  for (const entry of reference.cases) {
    const keys = entry.kind === 'two' ? ['beam', 'target', 'particle', 'residue'] : ['beam', 'target', 'residue', 'particle1', 'particle2'];
    const r = { kind: entry.kind, energy: entry.energy, ex: entry.ex };
    keys.forEach((key, i) => r[key] = masses.nuclides.find(n => n.name === entry.names[i]));
    const roots = r.kind === 'two' ? solveTwo(r, entry.values.theta_c) : solveThree(r, entry.values);
    assert.equal(roots.length, entry.roots.length);
    roots.forEach((root, i) => near(root, entry.roots[i], 1e-6));
    near(reconstruct(r, entry.values), entry.reconstructed, 1e-7);
    for (const key of Object.keys(entry.derivatives)) {
      near(derivative(r, entry.values, key), entry.derivatives[key], 5e-7);
      near(shift(r, entry.values, key, 1), entry.plus[key]);
      near(shift(r, entry.values, key, -1), entry.minus[key]);
    }
    if (entry.intervals) {
      const ranges = allowedIntervals(r, entry.values);
      assert.equal(ranges.length, entry.intervals.length);
      ranges.forEach((range, i) => range.forEach((v, j) => near(v, entry.intervals[i][j], 1e-6)));
    }
  }
});
