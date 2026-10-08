# UI Skills

独立实现的网页 UI 效果和可复用编程技能，采用 [MIT License](LICENSE)。

| 效果 | 展示页 | 技能 |
| --- | --- | --- |
| 图形变换粒子背景 | [Morphing particles](morphing-particles/README.md) | [Skill](morphing-particles/skills/morphing-particles/SKILL.md) |

## 运行

```sh
cd morphing-particles
pnpm dev
```

打开 http://127.0.0.1:4321 。无需安装依赖。

## 复用

将 `morphing-particles/skills/morphing-particles` 复制到目标项目的 `.agents/skills/morphing-particles`，然后调用 `$morphing-particles`。

技能包含独立页面模板、可显式挂载和卸载的粒子引擎、实现原理、参数说明和参考截图。默认图形由公式生成，不需要 PNG、外部字体、Three.js 或 GSAP。

## 来源与许可证

视觉探索参考了 [Google Antigravity](https://antigravity.google/) 的粒子背景及双栏展示形式；本仓库的绘制、采样、运动、交互和图形生成由独立代码实现。它不是原站代码的分发包，也不与 Google 存在隶属或背书关系。

MIT 覆盖本仓库的独立代码和文档，不授予 Google 商标权。用户自行添加的图片、字体或依赖仍需遵守各自许可；MIT 不替代这些授权。
