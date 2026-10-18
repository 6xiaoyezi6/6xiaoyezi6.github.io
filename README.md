# 6xiaoyezi6.github.io

个人学术网站与相对论核运动学工具。纯 HTML/CSS/JavaScript，无运行时第三方依赖，可直接部署到 GitHub Pages。姓名、单位、简介、联系方式、头像与论文信息均待补充；目前头像为几何占位图。

## 本地预览

```sh
python3 -m http.server 8000
```

访问 http://localhost:8000 ，或直接双击 `index.html`。两种方式均可使用计算器：在线/HTTP 优先使用模块 Worker；`file://` 使用包含核质量数据的传统脚本入口，在页面内计算，不请求本地 JSON、不加载模块 Worker。线上无需 Python、ROOT 或计算后端。

## 目录

```text
index.html                  个人主页
research.html               科研方向
publications.html           发表论文
contact.html                联系方式
kinematics/
  index.html                工具入口
  two-body/                 两体 index.html / script.js / style.css
  three-body/               三体 index.html / script.js / style.css
assets/
  css/style.css             公共样式与移动端适配
  js/main.js                公共导航
  js/physics.js             四动量、求根、重建与误差传播
  js/kinematic-geometry.js  连续边界、投影区间与逐图查询
  js/math-labels.js         LaTeX 生成的离线 SVG 坐标字形
  js/plots.js               SVG 交互图、双向查询与多层导出
  js/overlay-manager.js     多反应道曲线库、坐标映射与叠画管理
  js/tool.js                工具表单和展示
  js/curve-worker.js        后台曲线计算
  js/calculator.js          自动生成的本地/在线兼容入口（内置质量表）
  data/nuclear-masses.json  从原 NuclearMass 接口导出的核质量表
  images/profile.jpg        头像占位图，待替换
publications/papers/         论文 PDF
scripts/                    质量导出与原程序对照工具
tests/                      计算验证与参照结果
```

## 手动修改指南

先根据下表找到源文件。**个人页面和 CSS 修改后刷新即可；计算器 JavaScript 修改后还需要运行 `npm run build`，更新实际加载的入口。** 所有路径均相对本仓库根目录。

### 个人资料、页面和样式

| 想修改的内容 | 修改哪个文件 | 在文件中找什么 / 如何修改 | 需要重新构建吗 |
| --- | --- | --- | --- |
| 首页标题、自我介绍、姓名、单位、研究兴趣标签 | [index.html](index.html) | 搜索 `关于我`、`姓名 / 单位待补充`、`hero`、`tags`，替换相应文字 | 不需要 |
| 个人头像 | [assets/images/profile.jpg](assets/images/profile.jpg) | 用自己的 JPG 替换同名文件；头像说明和尺寸在首页 `<img>` 中修改 | 不需要 |
| 首页右侧示意图 | [index.html](index.html) | 搜索 `hero-visual`，修改其内联 SVG；此图只是示意，不是计算器数据 | 不需要 |
| 科研方向、具体项目和成果简介 | [research.html](research.html) | 搜索 `research-item` 和 `待补充`，修改或增加对应文章卡片 | 不需要 |
| 论文作者、题目、期刊、年份和 DOI | [publications.html](publications.html) | 用真实论文条目替换 `论文信息待补充` 区域 | 不需要 |
| 论文 PDF | [publications/papers/](publications/papers/) 和 [publications.html](publications.html) | PDF 放入前者，在后者添加如 `publications/papers/my-paper.pdf` 的相对链接 | 不需要 |
| 邮箱、地址、单位、ORCID、GitHub 链接 | [contact.html](contact.html) | 修改相应 `contact-row`；邮箱可用 `mailto:` 链接 | 不需要 |
| 工具总入口的介绍和两张入口卡片 | [kinematics/index.html](kinematics/index.html) | 修改说明文字与 `tool-card`；首页也展示了一份入口卡片，需同步修改 [index.html](index.html) | 不需要 |
| 顶部网站名称、导航文字/链接、页脚内容 | 各个 `.html` 页面 | 搜索 `brand`、`site-nav`、`site-footer`；当前每页分别保存，需同步修改所有页面，并保持子目录中的相对路径正确 | 不需要 |
| 移动端菜单开关、页脚年份、初始化失败提示 | [assets/js/main.js](assets/js/main.js) | 导航点击事件、`data-year` 和计算器启动超时检查；此文件不生成导航内容 | 不需要 |
| 全站颜色、字体、边距、卡片、手机布局 | [assets/css/style.css](assets/css/style.css) | 文件开头 `:root` 为配色/字体；`.plot-card` 等为组件；`@media` 为窄屏样式 | 不需要 |
| 两体/三体页面独有样式 | [kinematics/two-body/style.css](kinematics/two-body/style.css)、[kinematics/three-body/style.css](kinematics/three-body/style.css) | 这些规则叠加在公共样式之上；公共样式先加载 | 不需要 |

### 运动学计算器

两个工具的页面标题、顶部反应式、章节跳转和说明位于各自的 `index.html`；**反应输入框、曲线卡片和偏导数表由 JavaScript 生成，不在 HTML 中直接编辑。**

| 想修改的内容 | 修改哪个文件 | 关键位置 | 后续操作 |
| --- | --- | --- | --- |
| 两体页面的标题、顶部静态反应式和简介 | [kinematics/two-body/index.html](kinematics/two-body/index.html) | `<title>`、`<h1>`、`reaction-equation`、`page-heading`；顶部反应式是说明示例，当前配置反应式由脚本生成 | 刷新页面 |
| 三体页面的标题、顶部静态反应式和简介 | [kinematics/three-body/index.html](kinematics/three-body/index.html) | 同上 | 刷新页面 |
| 默认反应核素 | [assets/js/tool.js](assets/js/tool.js) | `mountTool` 中的 `names`：`isThree` 两侧分别对应三体/两体；同时用于恢复默认 | `npm run build` |
| 默认束流能量、Ex、测量角度、T₁ 和 Δφ | [assets/js/tool.js](assets/js/tool.js) | 搜索 `field('energy'`、`field('ex'`、`field('theta_c'`、`field('T1'`、`field('theta1'`、`field('theta2'`、`id="dphi"`，修改对应默认值 | `npm run build` |
| 默认 1σ 误差 | [assets/js/tool.js](assets/js/tool.js) | `sigmas` 初始化及 `reset-tool` 点击事件中的恢复默认值要同步修改 | `npm run build` |
| 输入框名称、按钮文字、提示说明、偏导数表列名和页面顺序 | [assets/js/tool.js](assets/js/tool.js) | `mountTool` 的页面模板和 `variables`；曲线在 `curves`，偏导数在 `sensitivity` | `npm run build` |
| 两体三张图的名称、坐标对应关系、取点与转折点 | [kinematics/two-body/script.js](kinematics/two-body/script.js) | `twoBodyCurves` 中的 `plots`、质心角列表和转折点插入逻辑 | `npm run build` 后 `npm test` |
| 三体七张图的名称、坐标对应关系、取点密度 | [kinematics/three-body/script.js](kinematics/three-body/script.js) | `threeBodyCurves` 的 `specs` 和 `cosineGrid`；`fine` 区分精细/标准模式 | `npm run build` 后 `npm test` |
| 相空间允许区间、角度包络、逐图对应值查询的物理算法 | [assets/js/kinematic-geometry.js](assets/js/kinematic-geometry.js) | `energyEnergyInterval`、`energyAtAngle`、`angleAngleInterval`、`queryKinematic` 和 `queryKinematicReverse`；正反查询和绘图共用物理方程 | `npm run build` 后 `npm test` |
| 两体图覆盖角范围 | [kinematics/two-body/script.js](kinematics/two-body/script.js)、[assets/js/kinematic-geometry.js](assets/js/kinematic-geometry.js) | 当前为 `0.1°–89.9°`；改变时同步修改曲线筛选、截断点和 `queryKinematic` 的查询范围，以及页面说明 | `npm run build` 后 `npm test` |
| 缺失质量、解析动量求根、局部偏导数和误差传播 | [assets/js/physics.js](assets/js/physics.js) | `reconstruct`、`solveEmission`、`derivative`、`sensitivity`；改变差分步长时同步更新页面中的说明 | `npm run build` 后 `npm test` |
| 曲线颜色/线宽、坐标轴边距、悬停、缩放、查询框及结果显示位数 | [assets/js/plots.js](assets/js/plots.js) | `renderPlot` 中 `draw`、SVG 布局常量、`coordinate-query` 与 `toFixed`；查询框的 CSS 在公共样式中 | JS 改动后 `npm run build`；只改 CSS 直接刷新 |
| 多反应道叠画面板、比较反应道默认值、曲线库保存/导入/导出 | [assets/js/overlay-manager.js](assets/js/overlay-manager.js) | `mountOverlayManager`、`fillNuclides`、`packReaction`/`unpackReaction`；比较表单默认值与主反应表单分别设置 | `npm run build` 后 `npm test` |
| 跨两体/三体的可选坐标对应、交换轴、两体能量–能量比较投影 | [assets/js/overlay-manager.js](assets/js/overlay-manager.js) | `comparisonPlots`、`mappingChoices`、`overlaySeries`；按单位匹配，查询方向随坐标交换 | `npm run build` 后 `npm test` |
| 叠画默认颜色/线型及本机存储名称 | [assets/js/overlay-manager.js](assets/js/overlay-manager.js) | `palette`、`dash` 默认值和 `key`；页面上也可逐条修改颜色、虚线与显示状态 | `npm run build` |
| 查询输入框的初始值 | [assets/js/plots.js](assets/js/plots.js) | `queryForm` 分支中的 `input.value`，当前角度图优先使用有效范围内的 `65` | `npm run build` |
| 坐标轴的 LaTeX 公式、下标和单位 | [scripts/build-math-labels.py](scripts/build-math-labels.py) | 修改 `plain, tex` 标签映射和单位拼接；若修改标签键名，同步修改曲线 `xLabel`/`yLabel` 及响应图 `xMath` | 先生成字形，再构建，命令见下文 |
| 核质量数据来源与导出 | [scripts/export-masses.py](scripts/export-masses.py) | 从指定的原 `NuclearMass` 目录只读导出；页面不直接调用外部源码 | 先导出质量，再 `npm run build` |
| 后台曲线任务的分发 | [assets/js/curve-worker.js](assets/js/curve-worker.js) | 按反应类型调用两体/三体函数；本地 `file://` 的回退计算由 `tool.js` 管理 | 只改 Worker 刷新；若同时改计算源文件则构建 |
| 本地文件兼容入口的构建方式 | [scripts/build-calculator.py](scripts/build-calculator.py) | `files` 是需要合并的源文件列表，构建尾部负责初始化计算器 | `npm run build` |

例如，把默认两体测量角改为 `60°`：在 `assets/js/tool.js` 中找到 `field('theta_c', ..., 65, 0, 180)`，将默认值 `65` 改为 `60`，然后运行 `npm run build` 并刷新页面。若想改变每张图的查询框默认值，则另外修改 `plots.js` 中的 `input.value`，两者用途不同。

### 双向查询与叠画的使用方法

每张运动学图下有两行输入：**输入横轴 → 查询纵轴**、**输入纵轴 → 查询横轴**。正反查询均使用反应方程，保留全部离散解或三体允许区间。叠画后会逐个反应道列出结果，并分别标记位置；曲线显示、隐藏或坐标映射变化时，已经查询的数值会自动重新计算。零动能粒子的方向未定义，会明确提示。

例如，默认两体反应在“测量粒子能量–角度”中，横轴输入 `65` 可得 `60.296196 MeV`；再在纵轴输入这个能量，可反查到约 `65°`。三体图对应整体相空间，通常返回允许区间，而不是唯一能量/角度。

叠加多个反应道有两种方式：

1. 点击“保存当前反应道”，再修改主反应的核素、束流能量或 Ex 并点击“计算运动学”。保存的曲线保持原配置，与新的主曲线叠画；可重复保存。
2. 展开“添加比较反应道（两体 / 三体）”，独立选择类型、输入反应核素与参数，再点击“计算并加入叠画”。不需要改变当前主反应，也可以在三体页面直接添加两体反应，反之亦然。

每条比较反应道支持显示/隐藏、颜色、实线/虚线及移除。展开该条目的“坐标对应关系”，可为每一张主图选择来源投影、交换横纵轴，或设为“不叠加到此图”。不同粒子间的对应由此处明确选择；单位相同只说明可以放在同一坐标系，并不意味着粒子身份相同。图例和导出文件会写出来源量到目标量的映射。

两体还提供 `Tc–Td` 能量关联作为比较投影，因此也能叠加到三体的能量–能量边界图中。主页面仍保留原来的三张两体图。

浏览器允许时，曲线库会自动保存在本机并在刷新后恢复；`file://` 在不同浏览器/不同 HTML 页面间的存储范围可能不同。需要把两体页面的库转移到三体页面时，可以先“导出曲线库 JSON”，再在另一页面“导入曲线库 JSON”。导入是追加；数据会校验核素、守恒与阈值，并使用当前质量表重新计算。

叠画只影响运动学图与逐图查询，**下方基准事件、偏导数和分辨率始终针对当前主反应**。隐藏的曲线不参与图轴范围、查询或导出。逐图 CSV 包含反应道、轴映射、分支和数值；SVG 保留曲线颜色、线型、LaTeX 标签及图例。

### 修改后的更新步骤

只修改个人页面、普通说明文字或 CSS：保存后刷新浏览器即可。若改的是计算器生成的提示文字，则属于 `tool.js`，仍需构建。

修改计算器源 JS 后，在仓库根目录执行：

```sh
npm run build
npm test
```

修改坐标轴 LaTeX 后执行（开发电脑需安装 `latex` 和 `dvisvgm`）：

```sh
python3 scripts/build-math-labels.py
npm run build
npm test
```

更新核质量数据时，从已有的原接口只读导出：

```sh
python3 scripts/export-masses.py /path/to/NuclearMass
npm run build
npm test
```

`npm run build` 等价于 `python3 scripts/build-calculator.py`，不需要先运行 `npm install`。测试需要 Node.js；构建需要 Python 3。浏览器端不需要安装这些软件。

### 自动生成文件与验证文件

| 文件 / 目录 | 用途 | 是否应直接手动编辑 |
| --- | --- | --- |
| `assets/js/calculator.js` | 页面实际加载的兼容入口，包含计算源码、LaTeX 字形与质量数据 | 否；修改源文件后构建 |
| `assets/js/math-labels.js` | LaTeX 生成的矢量字形 | 否；修改 `build-math-labels.py` 后生成 |
| `assets/data/nuclear-masses.json` | 原质量接口的导出快照 | 通常不手改；通过导出脚本更新 |
| `tests/physics.test.js` | 守恒、阈值、缺失质量、偏导数与边界残差检查 | 物理行为确有变更时按新定义维护 |
| `tests/kinematic-queries.test.js` | 多解查询、三体区间、转折点与 LaTeX 字形检查 | 查询/曲线行为变更时同步维护 |
| `tests/overlay-and-reverse.test.js` | 双向闭合、混合叠画、交换轴、配置校验和导出检查 | 反查/叠画行为变更时同步维护 |
| `tests/reference.test.js`、`tests/python-reference.json` | 与原 Python 的独立数值对照及参照快照 | 不应为消除失败而直接修改参照数值 |
| `.cache/` | 临时编译文件、LaTeX 中间文件、开发截图与对照结果 | 不作为网站源码或发布文件；已被 Git 忽略 |

## 工具功能与顺序

每个计算页：**反应道配置 → 比较反应道管理 → 运动学曲线 → 基准事件与偏导数 → 独立误差传播 → 可展开的非线性响应曲线**。

- 两体 `A+t→c+d*`：Tc–θc、Td–θd、θc–θd 三种关联；测量粒子极角和总动能的两个偏导数。
- 三体 `A+t→B*+1+2`：TB–T1、T2–T1、T2–TB、T1–θ1、T2–θ2、TB–θB、θ1–θ2 七种关联；两个测量粒子极角和总动能的四个偏导数。
- 自定义核素、余核 Ex、反应道 A/Z 守恒与阈值检查、全部非零物理解选择；三体支持共面带符号角/任意 Δφ，提供粒子 1 的允许动能区间。
- 局部偏导数、精确 ±1 测量偏差、每项独立 1σ、激发能 σ 和高斯等效 FWHM、方差贡献。
- 图表悬停显示三位小数、框选缩放、平移、Ctrl/⌘+滚轮缩放、双击或按钮复位、逐图 CSV/SVG 导出；灵敏度结果 CSV 包含配置、质量来源和完整数值精度。
- 每张图支持横轴查纵轴、纵轴查横轴；两体列出全部对应值，三体显示允许区间，图中标记结果；直接求物理方程，不依赖曲线插值。
- 支持多个两体、多个三体以及两体/三体混合叠画；每层可选坐标映射和轴互换，显示/隐藏、调整颜色/线型、移除；曲线库可本机保存及 JSON 导入导出。
- 坐标轴用真正的 LaTeX 生成 SVG 矢量字形，包含希腊字母、上下标及正体单位；本地/离线与 SVG 导出均可显示。
- 基准事件无解时仍显示反应道整体运动学曲线。修改输入后须点击对应计算/更新按钮应用；页面提示旧结果状态。

## 物理与数值约定

功能迁移自只读源文件：
`/Users/yemingxin/anaroot/output/Analysis/MyToolsFunction/KinematicsSensitivity/KinematicsSensitivity.py`，以及其依赖的 TwoBodyKinematics / ThreeBodyKinematics。没有修改任何外部源码。

使用相同相对论动量 `p=√[T(T+2m)]`、固定方向解析动量求根，并回代未平方方程与缺失质量排除伪根。重建 `Ex=√[(PA+Pt−ΣP测量)²]−M余核基态`。仅余核增加指定 Ex，质量数 A 独立保存，不把质量 u 当作 A。

质量来自 `NuclearMass::MassTable::Get`，共 3558 个 NUBASE2020 基态核素；单位 MeV/c²，已扣除电子静质量，忽略电子结合能，不回退到硬编码质量。JSON 保存原表 SHA-256 与估算标记。更新源质量表后，可执行：

```sh
python3 scripts/export-masses.py /path/to/NuclearMass
python3 scripts/build-calculator.py
```

导出需 C++11 编译器；桥接代码和可执行文件只写本站 `.cache/`，不修改原表与原库。部署时不需运行此脚本。

束流动能 MeV/u，图中与测量总动能 MeV，角度 degree，c=1。与原工具保持一致，两体图扫描 θc=0.1°–89.9°；灵敏度输入仍允许 0°–180°。偏导数 `h=0.001`，边界使用单侧差分，角度偏导为 MeV/degree。三体负的带符号角转换成非负极角和 Δφ，显示的偏导针对极角而非带符号角。

三体图为整体相空间投影，不限制为当前基准事件的几何。能量–能量在给定横轴后，用动量多边形闭合的凹函数和单调不等式求纵轴允许区间；能量–角度用其余二粒子最低不变质量解析求根。角度–角度用余下二体系统的允许角锥，在出射动能允许区间上求极值（标准/精细80/160点加黄金分割细化），替代原能量网格包络。角度包络仍为数值极值结果。每个边界按余弦节点取点，含真实端点，以同一路径连接上下界；标准/精细模式为一般边界700/1400步、角度包络300/600步。两体改为质心角连续参数化，3000步并插入两粒子的精确转折点及0.1°/89.9°截断点，不在不同能量根之间误连或通过样条改变物理数据。

坐标字形由 `scripts/build-math-labels.py` 调用本机 `latex` 和 `dvisvgm --no-fonts` 生成。仅需在修改固定标签时重新生成，再执行 `npm run build`；网页运行时无 TeX、字体或 CDN 依赖。

误差传播假设测量误差互不相关，`σ²Ex=Σ(∂Ex/∂xi·σi)²`；FWHM=2.354820045σ 为高斯等效值。没有计入束流能散、顶点、能损、Δφ误差、相关性与非高斯尾部。灵敏度逐项固定其余测量量，不重新求解末态动能。

## 验证

```sh
npm test
python3 scripts/validate-reference.py /path/to/KinematicsSensitivity.py
```

Node 测试无需安装包，默认可用 `tests/python-reference.json` 中保存的原程序数值快照。对照脚本只读取原 Python，通过已导出的原接口质量运行独立参照，生成网站内 `.cache/python-reference.json` 并优先使用；原文件和外部目录不写入任何文件。

页面加载 `assets/js/calculator.js`（传统脚本，可直接从本地文件加载）。物理、绘图、UI 和各页 `script.js` 是可维护源文件；修改这些文件或质量 JSON 后运行 `npm run build`。构建只合并本项目指定模块，不需安装打包工具；`npm test` 会检查生成入口是否与源文件一致。不要直接编辑生成入口。HTTP 下如模块 Worker 不可用，会回退到同一套页面内计算。

## 线上更新

本地保存和 `npm run build` 不会自动更新 `6xiaoyezi6.github.io`。需要将修改后的源文件、静态资源以及生成的 `assets/js/calculator.js` 一同提交并推送到 GitHub，再等待 GitHub Pages 部署完成。`node_modules/` 和 `.cache/` 不参与发布。

GitHub 仓库 Settings → Pages 中应选择实际使用的部署分支和根目录；在线页面未变化时，先检查推送和部署状态，再强制刷新浏览器。本轮操作没有自动提交、推送或发布。
