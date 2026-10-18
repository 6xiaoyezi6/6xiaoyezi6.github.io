#!/usr/bin/env python3
# 功能：用真正的 LaTeX 为图表坐标轴生成可离线显示/导出的矢量字形。
# 方法：在本站 .cache 内执行 latex 与 dvisvgm --no-fonts，嵌入 SVG 路径到 JavaScript 数据模块。
# 注意事项：仅生成固定标签，不处理用户输入；开发时需 TeX Live，网页运行时无需 LaTeX 或网络。
import base64
import json
from pathlib import Path
import re
import subprocess

site = Path(__file__).resolve().parents[1]
work = site / '.cache/axis-labels'
work.mkdir(parents=True, exist_ok=True)
labels = {}
for plain, tex in [('θc', r'\theta_c'), ('θd', r'\theta_d'), ('θ₁', r'\theta_1'),
                   ('θ₂', r'\theta_2'), ('θB', r'\theta_B'), ('Tc', r'T_c'), ('Td', r'T_d'),
                   ('T₁', r'T_1'), ('T₂', r'T_2'), ('TB', r'T_B'), ('ΔEx', r'\Delta E_x')]:
    angular = plain.startswith('θ')
    formula = tex + (r'\,({}^{\circ})' if angular else r'\,(\mathrm{MeV})')
    key = plain + (' (°)' if angular else ' (MeV)')
    name = f'label-{len(labels)}'
    source = r'\documentclass[border=1pt]{standalone}\usepackage{amsmath}\begin{document}$' + formula + r'$\end{document}'
    (work / f'{name}.tex').write_text(source)
    subprocess.run(['latex', '-interaction=nonstopmode', '-halt-on-error', f'{name}.tex'], cwd=work, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True)
    subprocess.run(['dvisvgm', '--no-fonts', '--exact', f'{name}.dvi', '-o', f'{name}.svg'], cwd=work, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True)
    svg = (work / f'{name}.svg').read_text()
    _, _, width, height = map(float, re.search(r"viewBox=['\"]([^'\"]+)", svg)[1].split())
    labels[key] = {'tex': formula, 'aspect': width / height,
                   'uri': 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode()).decode()}
output = site / 'assets/js/math-labels.js'
output.write_text('''/* 功能：保存真正 LaTeX 生成的坐标轴 SVG 字形（自动生成）。
 * 方法：latex + dvisvgm --no-fonts；以 data URI 内嵌矢量路径，无字体或 CDN 依赖。
 * 注意事项：运行 scripts/build-math-labels.py 重新生成；不直接修改此文件。
 */
export const mathLabels = ''' + json.dumps(labels, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'Generated {len(labels)} offline LaTeX SVG labels')
