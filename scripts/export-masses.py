#!/usr/bin/env python3
# 功能：将原 NuclearMass::MassTable 的全部基态核素导出为网页 JSON。
# 方法：只读取外部表的核素名称，在网站 .cache 内编译 C++ 桥接并逐项调用 Get。
# 注意事项：仅写当前网站；需 C++11 编译器和原质量库。质量为 MeV/c²，不含激发能。
import hashlib
import json
from pathlib import Path
import subprocess
import sys

SITE = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else
              '/Users/yemingxin/anaroot/output/Analysis/MyToolsFunction/NuclearMass')
TABLE = SOURCE / 'nubtab20.asc'
cache = SITE / '.cache'
cache.mkdir(exist_ok=True)
names = [line[11:16].strip() for line in TABLE.read_text().splitlines()
         if line and not line.startswith('#') and int(line[4:8]) % 10 == 0]
bridge = cache / 'export-masses.cc'
bridge.write_text('''// 功能：导出核质量查询结果；方法：调用原库 Get；注意事项：仅输出 JSON 至标准输出。
#include ''' + json.dumps(str(SOURCE / 'NuclearMass.cc')) + '''
#include <iostream>
#include <iomanip>
int main() {
  NuclearMass::MassTable table(''' + json.dumps(str(TABLE)) + ''');
  const char* names[] = {''' + ','.join(json.dumps(n) for n in names) + '''};
  std::cout << std::setprecision(17) << "[";
  bool first = true;
  for (const auto name : names) {
    auto n = table.Get(name);
    if (!first) std::cout << ",";
    first = false;
    std::cout << "{\\\"name\\\":\\\"" << n.Name << "\\\",\\\"A\\\":" << n.A
      << ",\\\"Z\\\":" << n.Z << ",\\\"mass\\\":" << n.MassMeV
      << ",\\\"estimated\\\":" << (n.Estimated ? "true" : "false") << "}";
  }
  std::cout << "]";
}
''')
executable = cache / 'export-masses'
subprocess.run(['c++', '-std=c++11', '-O2', str(bridge), '-o', str(executable)], check=True)
nuclides = json.loads(subprocess.check_output([str(executable)], text=True))
data = {'source': 'NuclearMass::MassTable::Get / NUBASE2020',
        'table_sha256': hashlib.sha256(TABLE.read_bytes()).hexdigest(),
        'amuMeV': 931.49410372, 'electronMassMeV': 0.51099895069,
        'massUnit': 'MeV/c^2', 'convention': 'Nuclear ground-state mass; electronic binding neglected',
        'nuclides': nuclides}
output = SITE / 'assets/data/nuclear-masses.json'
output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Exported {len(nuclides)} nuclides to {output.relative_to(SITE)}')
