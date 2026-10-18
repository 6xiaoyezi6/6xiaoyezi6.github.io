#!/usr/bin/env python3
# 功能：只读载入原灵敏度程序，为网页生成独立 Python 数值参照并调用 Node 对照测试。
# 方法：原程序 nuclide 查询替换为经原 NuclearMass 导出的质量，不运行 Streamlit；比较全部分支及差分。
# 注意事项：禁止外部 pycache；仅写本站 .cache；不修改原代码，无需额外安装包（原程序需 numpy）。
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import sys

sys.dont_write_bytecode = True
site = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1] if len(sys.argv) > 1 else
              '/Users/yemingxin/anaroot/output/Analysis/MyToolsFunction/KinematicsSensitivity/KinematicsSensitivity.py')
spec = importlib.util.spec_from_file_location('kinematics_reference', source)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
masses = json.loads((site / 'assets/data/nuclear-masses.json').read_text())
lookup = {n['name']: n for n in masses['nuclides']}
def query(name):
    n = lookup[name]
    return [n['name'], n['A'], n['Z'], n['mass'] / masses['amuMeV'], n['mass']]
module.query_nuclide_data = query
cases = []
for names, ex, theta in [
    (('4He', '1H', '1H', '4He'), 0, 65),
    (('12C', '1H', '1H', '12C'), 4.439, 30),
    (('1H', '4He', '1H', '4He'), 0, 30),
    (('2H', '2H', '1H', '3H'), 0, 30),
    (('10Be', '1H', '10Be', '1H'), 0, 2),
]:
    r = module.Scattering(*names, Ex=ex)
    roots = r.solve_energy(150, theta)
    assert roots, names
    for tc in roots:
        p = dict(TA_u=150, theta_c=theta, Tc=tc)
        keys = ['theta_c', 'Tc']
        cases.append(dict(kind='two', names=names, ex=ex, energy=150,
                          values={k:v for k,v in p.items() if k!='TA_u'}, roots=roots,
                          reconstructed=r.excitation(**p),
                          derivatives={k:module.derivative(r.excitation,p,k) for k in keys},
                          plus={k:module.shift(r.excitation,p,k,1) for k in keys},
                          minus={k:module.shift(r.excitation,p,k,-1) for k in keys}))
for ex, dphi in [(0,180),(1,180),(0,163)]:
    r=module.Knockout(Ex=ex)
    roots=r.solve_energy2(150,40,65,7.7,dphi)
    assert roots
    for t2 in roots:
        p=dict(TA_u=150,T1=40,theta1=65,T2=t2,theta2=7.7,dphi=dphi)
        keys=['theta1','T1','theta2','T2']
        cases.append(dict(kind='three',names=['10Be','1H','6He','1H','4He'],ex=ex,energy=150,
                          values={k:v for k,v in p.items() if k!='TA_u'},roots=roots,
                          reconstructed=r.excitation(**p),
                          derivatives={k:module.derivative(r.excitation,p,k) for k in keys},
                          plus={k:module.shift(r.excitation,p,k,1) for k in keys},
                          minus={k:module.shift(r.excitation,p,k,-1) for k in keys},
                          intervals=r.allowed_energy1_intervals(150,65,7.7,dphi)))
output=site/'.cache/python-reference.json'
output.parent.mkdir(exist_ok=True)
def finite_json(value):
    if isinstance(value, dict):
        return {key: finite_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [finite_json(item) for item in value]
    return None if isinstance(value, float) and not math.isfinite(value) else value
output.write_text(json.dumps(finite_json({'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'cases':cases}),allow_nan=False,indent=2)+'\n')
print(f'Generated {len(cases)} physical branch cases from original Python source',flush=True)
subprocess.run(['node','--test','tests/reference.test.js'],cwd=site,check=True)
