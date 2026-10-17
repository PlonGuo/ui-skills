# UI Skills

独立实现的网页 UI 效果和可复用编程技能，采用 [MIT License](LICENSE)。

> **重要声明**：本项目是独立维护的技术演示与编程工具，不是 Google / Google Antigravity 的官方项目，也未获得其背书。视觉参考不等于取得第三方代码、素材或商标的许可。MIT 不构成“绝不会侵权”或“绝不会被追责”的保证。完整说明见 [项目声明](NOTICE.md)。

| 效果 | 展示页 | 技能 |
| --- | --- | --- |
| 图形变换粒子背景 | [Morphing particles](morphing-particles/README.md) | [Skill](morphing-particles/skills/morphing-particles/SKILL.md) |
| 深色点阵背景 | [Dot grid background](dot-grid-background/README.md) | [Skill](dot-grid-background/skills/dot-grid-background/SKILL.md) |
| 蓝色漂浮粒子环 | [Floating dots](floating-dots/README.md) | [Skill](floating-dots/skills/floating-dots/SKILL.md) |
| 倾斜照片墙 | [Tilting photo wall](tilting-photo-wall/README.md) | [Skill](tilting-photo-wall/skills/tilting-photo-wall/SKILL.md) |

## 如何使用 Skills

每个 skill 都能指导 AI 编程 agent 把对应 UI 效果接入你的项目。可以把它理解成“接入说明＋实现零件”的完整包：所需代码已经放在 skill 内，无需额外复制外层 demo 源码，也无需搬入整个 UI 项目。

### 1. 选择效果，复制完整 skill 文件夹

下面以目标项目的 `.agents/skills/` 为技能目录：

| 效果 | 本仓库中需要复制的文件夹 | 目标项目中的位置 | 调用名称 |
| --- | --- | --- | --- |
| 图形变换粒子 | `morphing-particles/skills/morphing-particles/` | `.agents/skills/morphing-particles/` | `$morphing-particles` |
| 深色点阵 | `dot-grid-background/skills/dot-grid-background/` | `.agents/skills/dot-grid-background/` | `$dot-grid-background` |
| 蓝色漂浮粒子环 | `floating-dots/skills/floating-dots/` | `.agents/skills/floating-dots/` | `$floating-dots` |
| 倾斜照片墙 | `tilting-photo-wall/skills/tilting-photo-wall/` | `.agents/skills/tilting-photo-wall/` | `$tilting-photo-wall` |

例如，在本仓库根目录执行以下命令，把 `/path/to/your-project` 替换成你的目标项目路径：

```sh
mkdir -p /path/to/your-project/.agents/skills
cp -R floating-dots/skills/floating-dots /path/to/your-project/.agents/skills/
```

目标目录中应保留完整内容，例如：

```text
your-project/.agents/skills/floating-dots/
├── SKILL.md
├── agents/
├── scripts/
├── references/
├── assets/
│   └── template/    # 已包含效果实现代码、页面模板和所需资源
├── LICENSE
└── NOTICE.md
```

**只复制 `SKILL.md` 会缺少代码和资源；`assets/template/` 里的代码需要保留，但外层 demo 的源码不用再复制一份。** `scripts/`、`references/` 和其他随附文件也一起保留。

使用其他 agent 时，将同一个完整文件夹放到它支持的技能目录，并按该 agent 的方式加载。如果当前会话没有发现新技能，刷新技能列表或新建会话后再调用。

### 2. 在目标项目中让 agent 接入 UI

安装 skill 后还需要发出接入指令，页面才会加入效果。例如：

```text
使用 $floating-dots，在当前首页加入蓝色漂浮粒子环。
使用技能附带的实现，沿用项目现有框架、布局、文案和字体。
完成接入并检查桌面、手机、鼠标跟随、按钮点击和减少动画模式。
```

使用其他效果时，将 `$floating-dots` 替换成表中对应的技能名称，并说明要放在哪个页面或组件中。照片墙的 skill 附带 SVG 示例图；要展示实际照片，需要提供项目自己的图片或图片路径。

### 3. 按需求选择接入已有项目或生成独立预览

- **接入已有项目**：让 agent 使用 `runtime` 模式，只生成效果运行模块，再按目标框架挂载、设置容器尺寸并在卸载时清理。沿用宿主布局，避免独立页全局样式覆盖现有页面。
- **独立预览**：让 agent 使用 `standalone` 模式，生成完整展示页，用于先看效果和调参。

也可以直接运行 skill 内的生成脚本，以 floating-dots 为例，在目标项目根目录执行：

```sh
# 生成运行模块；之后仍需按 skill 的接入说明挂到页面中
python3 .agents/skills/floating-dots/scripts/materialize.py --destination src/effects/floating-dots --mode runtime

# 或生成完整独立预览
python3 .agents/skills/floating-dots/scripts/materialize.py --destination previews/floating-dots --mode standalone
```

脚本要求输出目录尚不存在，避免覆盖已有文件。floating-dots 独立预览可在生成目录运行 `pnpm dev`，无需先安装依赖；浏览器测试依赖和检查方式见各 skill 的说明。各效果的具体输出、图片需求与交互约束以对应 `SKILL.md` 为准。

## 运行仓库中的 Demo

想先查看效果，可以直接运行外层展示项目：

```sh
cd morphing-particles
pnpm dev
```

打开 http://127.0.0.1:4321 。无需安装依赖。

漂浮粒子 demo：在仓库根目录执行 `cd floating-dots`，再运行 `pnpm dev`。调参界面位于 `/?tune=1`，完整启动和测试说明见 [Floating dots](floating-dots/README.md)。

倾斜照片墙 demo：执行 `cd tilting-photo-wall`，再运行 `pnpm dev`。说明见 [Tilting photo wall](tilting-photo-wall/README.md)。

深色点阵 demo：在仓库根目录执行 `cd dot-grid-background`，再运行 `python3 -m http.server 4321`。说明见 [Dot grid background](dot-grid-background/README.md)。

## 来源与许可证

视觉探索参考了 [Google Antigravity](https://antigravity.google/) 的粒子背景及展示形式；本仓库使用本地 Canvas 2D 绘制、采样、运动和交互代码。Floating dots 的 Google Sans Flex 字体采用 SIL OFL 1.1，3D simplex noise 保留 Ashima Arts 的 MIT 许可。它不是原站可执行脚本的分发包，也不与 Google 存在隶属或背书关系。

MIT 覆盖本仓库的独立代码和文档，不授予 Google 商标权。用户自行添加的图片、字体或依赖仍需遵守各自许可；MIT 不替代这些授权。

## 使用与权利边界

- 不分发参考网站的原始可执行脚本或图标资源包；Floating dots 随附开源字体及相应许可证，其他 demo 使用系统字体。
- 示例用于说明交互思路和接入方式，不宣称原站源码、官方组件、逐帧复刻或与官方产品完全等价。
- 产品名称、链接和视觉参考只用于识别来源，不表示隶属、合作、授权或推荐关系；默认示例中的外部按钮链接不代表本项目提供对应产品或服务。
- MIT 允许其覆盖代码的商业使用、修改和分发，但不能授予项目作者不拥有的第三方权利，也不替代具体项目所需的其他许可。
- 独立编写、注明来源、使用 AI 辅助或标注“学习用途”，均不代表已经完成全面知识产权审查，也不能自动消除争议。
- 将效果用于实际产品时，请核对新增素材与依赖的许可、品牌展示方式及具体业务场景。不要将本项目的外观或文档用作第三方已授权的证明。
- 如认为具体文件涉及您的权利，请按 [反馈说明](NOTICE.md#权利问题反馈) 提供可核实材料，以便维护者审查；本项目不预先否认合法权利主张。

这些说明不增加或改变 MIT 的许可条件，也不替代专业法律意见。适用法律和实际使用情况可能影响责任判断。
