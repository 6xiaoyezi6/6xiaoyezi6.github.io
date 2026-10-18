#!/usr/bin/env python3
# 功能：生成可从 file:// 和 HTTP 直接加载的传统脚本计算器入口。
# 方法：合并物理、双向投影、LaTeX、叠画管理与 UI，嵌入核质量 JSON；不需要 npm 依赖。
# 注意事项：只处理明确列出的本地模块；修改源代码或质量表后须重新生成；不更改外部源码。
import argparse
from pathlib import Path
import re

site = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true', help='仅检查生成文件是否最新')
args = parser.parse_args()
files = ['assets/js/physics.js', 'assets/js/kinematic-geometry.js', 'assets/js/math-labels.js', 'assets/js/plots.js',
         'kinematics/two-body/script.js', 'kinematics/three-body/script.js', 'assets/js/overlay-manager.js', 'assets/js/tool.js']
parts = []
for name in files:
    code = (site / name).read_text()
    code = re.sub(r'^import .+;\n', '', code, flags=re.M)
    code = re.sub(r'\nif \(typeof document !== \'undefined\'\) \{.*?\n\}', '', code, flags=re.S)
    code = re.sub(r'^export ', '', code, flags=re.M)
    code = code.replace('import.meta.url', 'bundleURL')
    parts.append(code)
header = '''/* 功能：本地文件与在线网页通用的计算器入口（自动生成）。
 * 方法：合并物理/双向投影/LaTeX/叠画/UI 并内置质量；HTTP 优先 Worker，本地文件直接计算。
 * 注意事项：不要直接编辑；运行 python3 scripts/build-calculator.py 更新。没有外部依赖和网络质量查询。
 */
(() => {
'use strict';
const bundleURL = document.currentScript.src;
const esc = value => escapeHTML(value);
'''
masses = (site / 'assets/data/nuclear-masses.json').read_text().strip()
footer = '''
const calculator = document.querySelector('#calculator');
if (calculator) {
  const kind = document.body.classList.contains('three-body') ? 'three' : 'two';
  mountTool(kind, {baseURL: bundleURL, masses: bundledMasses, curves: {two: twoBodyCurves, three: threeBodyCurves}})
    .catch(error => {
      console.error(error);
      calculator.replaceChildren();
      const message = document.createElement('p');
      message.className = 'notice error';
      message.setAttribute('role', 'alert');
      message.textContent = '计算器启动失败：' + error.message + '。请刷新页面或检查网站文件是否完整。';
      calculator.append(message);
    });
}
})();
'''
result = header + '\n'.join(parts) + '\nconst bundledMasses = ' + masses + ';\n' + footer
output = site / 'assets/js/calculator.js'
if args.check:
    if not output.exists() or output.read_text() != result:
        raise SystemExit('calculator.js 已过期，请运行 python3 scripts/build-calculator.py')
    print('Calculator bundle is current')
else:
    output.write_text(result)
    print(f'Built {output.relative_to(site)} ({len(result.encode())} bytes)')
