# UI Skills

独立实现的网页 UI 效果和可复用编程技能，采用 [MIT License](LICENSE)。

> **重要声明**：本项目是独立维护的技术演示与编程工具，不是 Google / Google Antigravity 的官方项目，也未获得其背书。视觉参考不等于取得第三方代码、素材或商标的许可。MIT 不构成“绝不会侵权”或“绝不会被追责”的保证。完整说明见 [项目声明](NOTICE.md)。

| 效果 | 展示页 | 技能 |
| --- | --- | --- |
| 图形变换粒子背景 | [Morphing particles](morphing-particles/README.md) | [Skill](morphing-particles/skills/morphing-particles/SKILL.md) |
| 深色点阵背景 | [Dot grid background](dot-grid-background/README.md) | [Skill](dot-grid-background/skills/dot-grid-background/SKILL.md) |
| 蓝色漂浮粒子环 | [Floating dots](floating-dots/README.md) | 独立 demo |

## 运行

```sh
cd morphing-particles
pnpm dev
```

打开 http://127.0.0.1:4321 。无需安装依赖。

漂浮粒子 demo：在仓库根目录执行 `cd floating-dots`，再运行 `pnpm dev`。调参界面位于 `/?tune=1`，完整启动和测试说明见 [Floating dots](floating-dots/README.md)。

## 复用

将 `morphing-particles/skills/morphing-particles` 复制到目标项目的 `.agents/skills/morphing-particles`，然后调用 `$morphing-particles`。

将 `dot-grid-background/skills/dot-grid-background` 复制到目标项目的 `.agents/skills/dot-grid-background`，然后调用 `$dot-grid-background`。该 skill 提供独立预览模板和可挂载的 `mountDotGridBackground()` runtime 模块。

技能包含独立页面模板、可显式挂载和卸载的粒子引擎、实现原理、参数说明和参考截图。默认图形由公式生成，不需要 PNG、外部字体、Three.js 或 GSAP。

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
