/* 功能：生成两体三类连续关联，并提供逐图横轴查询标识。
 * 方法：按质心极角连续参数化洛伦兹变换，插入两粒子精确转折点和实验室角度截断点。
 * 注意事项：测量粒子实验室角范围仍为 0.1°–89.9°；总动能 MeV，角度 degree。
 * 以同一物理轨迹穿过多解汇合点，不对能量根排序后强行跨接；本地文件由兼容入口初始化。
 */
import { initialState, RAD, solveEmission, direction } from '../../assets/js/physics.js';
import { pairCM } from '../../assets/js/kinematic-geometry.js';
export function twoBodyCurves(r) {
  const { E, p } = initialState(r), m = r.particle.mass, M = r.residue.mass + r.ex, cm = pairCM(E, p[2], m, M);
  const plots = [
    { title: '测量粒子能量–角度', xLabel: 'θc (°)', yLabel: 'Tc (MeV)', relation: 'c-angle', branches: [[]] },
    { title: '余核能量–角度', xLabel: 'θd (°)', yLabel: 'Td (MeV)', relation: 'd-angle', branches: [[]] },
    { title: '两粒子角度关联', xLabel: 'θd (°)', yLabel: 'θc (°)', relation: 'd-c-angle', branches: [[]] }
  ];
  if (!cm) return plots;
  const angles = Array.from({ length: 3001 }, (_, i) => Math.PI * i / 3000), eD = Math.hypot(M, cm.p);
  if (cm.beta > cm.p / cm.e) angles.push(Math.acos(-cm.p / (cm.beta * cm.e)));
  if (cm.beta > cm.p / eD) angles.push(Math.acos(cm.p / (cm.beta * eD)));
  if (cm.p > 0) for (const theta of [.1, 89.9]) {
    for (const T of solveEmission(E, p, m, M, direction(theta))) {
      const energy = m + T, magnitude = Math.sqrt(T * (T + 2 * m));
      const zCM = cm.gamma * (magnitude * Math.cos(theta * RAD) - cm.beta * energy);
      angles.push(Math.acos(Math.max(-1, Math.min(1, zCM / cm.p))));
    }
  }
  for (const angle of [...new Set(angles)].sort((a, b) => a - b)) {
    const px = cm.p * Math.sin(angle), pz = cm.gamma * (cm.p * Math.cos(angle) + cm.beta * cm.e);
    const qz = p[2] - pz, pc = Math.hypot(px, pz), pd = Math.hypot(px, qz);
    const theta = Math.atan2(Math.abs(px), pz) / RAD, td = pd > 1e-9 ? Math.atan2(Math.abs(px), qz) / RAD : NaN;
    if (pc < 1e-8 || theta < .1 - 1e-8 || theta > 89.9 + 1e-8) { plots.forEach(plot => plot.branches[0].push(null)); continue; }
    const Tc = pc * pc / (Math.hypot(m, pc) + m), Td = pd * pd / (Math.hypot(M, pd) + M);
    [[theta, Tc], [td, Td], [td, theta]].forEach((point, i) => plots[i].branches[0].push(point.every(Number.isFinite) ? point : null));
  }
  return plots;
}
if (typeof document !== 'undefined') {
  import('../../assets/js/tool.js').then(({ mountTool }) => mountTool('two'));
}
