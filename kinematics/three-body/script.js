/* 功能：生成三体七类连续投影边界，并提供横轴查询标识。
 * 方法：能量–能量用凹函数/单调函数二分求精确允许区间；能量–角度解析求根；
 *       角度–角度用余下二体的角锥优化。余弦取点包含真实端点，同一闭合路径连接上下界。
 * 注意事项：总动能 MeV、角度 degree；边界不固定基准事件。角度包络仍为数值极值，提供精细模式。
 * 不通过样条平滑改变物理边界；file:// 下由内置入口在页面线程计算。
 */
import { initialState } from '../../assets/js/physics.js';
import { inclusiveEnergyLimits, maximumLabAngle, cosineGrid, queryKinematic } from '../../assets/js/kinematic-geometry.js';
export function threeBodyCurves(r, fine = false) {
  const { E, p } = initialState(r), m = [r.particle1.mass, r.particle2.mass, r.residue.mass + r.ex];
  const specs = [
    ['粒子 1 与余核能量边界', 'T₁ (MeV)', 'TB (MeV)', 'energy-1-B', 0, 2],
    ['两测量粒子能量边界', 'T₁ (MeV)', 'T₂ (MeV)', 'energy-1-2', 0, 1],
    ['余核与粒子 2 能量边界', 'TB (MeV)', 'T₂ (MeV)', 'energy-B-2', 2, 1],
    ['粒子 1 能量–角度边界', 'θ₁ (°)', 'T₁ (MeV)', 'angle-1-energy', 0],
    ['粒子 2 能量–角度边界', 'θ₂ (°)', 'T₂ (MeV)', 'angle-2-energy', 1],
    ['余核能量–角度边界', 'θB (°)', 'TB (MeV)', 'angle-B-energy', 2],
    ['两粒子角度投影包络', 'θ₂ (°)', 'θ₁ (°)', 'angle-2-1', 1]
  ];
  return specs.map(([title, xLabel, yLabel, relation, ix, iy]) => {
    const missing = m.reduce((sum, value, i) => sum + (i === ix ? 0 : value), 0);
    const range = iy !== undefined ? inclusiveEnergyLimits(E, p[2], m[ix], missing) : [0, maximumLabAngle(E, p[2], m[ix], missing)];
    const lower = [], upper = [], branches = [];
    if (!range || !range.every(Number.isFinite)) return { title, xLabel, yLabel, relation, branches };
    const grid = cosineGrid(...range, relation === 'angle-2-1' ? (fine ? 600 : 300) : (fine ? 1400 : 700));
    let start = 0;
    const closeSegment = () => {
      if (lower.length > start) {
        const lo = lower.slice(start), hi = upper.slice(start).reverse();
        branches.push([...lo, ...hi, lo[0]]);
        start = lower.length;
      }
    };
    for (const x of grid) {
      const query = queryKinematic(r, relation, x, fine);
      if (query.values.length) { lower.push([x, query.values[0]]); upper.push([x, query.values.at(-1)]); }
      else closeSegment();
    }
    closeSegment();
    return { title, xLabel, yLabel, relation, branches, note: relation === 'angle-2-1' ? '整体角度允许包络；余下二体角锥数值极值，精细模式增加采样与细化。' : '整体相空间边界；下方查询显示给定横轴的纵轴允许区间。' };
  });
}
if (typeof document !== 'undefined') {
  import('../../assets/js/tool.js').then(({ mountTool }) => mountTool('three'));
}
