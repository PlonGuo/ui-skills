---
name: morphing-particles
description: Use when adding an image-shaped morphing particle background, Antigravity-inspired particle silhouettes, hover-driven particle transitions, or a responsive two-card solutions section to a web project. Supports standalone pages and integration into existing frontend frameworks. Not for unrelated confetti effects.
---

# 图形变换粒子 UI

用独立实现的 Canvas 2D 引擎，在文案背后绘制流动粒子、大括号或立方体，并响应悬停与键盘聚焦。

## 接入方式

先阅读目标页面和调用位置，沿用现有框架、目录结构、包管理器和设计变量。

- **独立展示页**：使用 `assets/template/`，包含完整页面、引擎、样式和预览服务。读取 [原理与参数](references/implementation.md) 后按需修改。
- **已有项目**：读取 [接入说明](references/integration.md)，只复制粒子引擎和许可证；布局、文案、字体和按钮沿用目标项目。

用脚本复制到一个新目录，`<skill-dir>` 指本技能所在目录：

```sh
python3 <skill-dir>/scripts/materialize.py --destination <new-directory> --mode runtime
```

独立页使用 `--mode standalone`，生成后运行 `pnpm dev`。脚本不覆盖现有目录。无需安装 Three.js、GSAP 或其他粒子库。

## 关键约束

- 使用所附 `particle-engine.js`；它是独立实现，不是原站脚本、Shader 或素材的分发包。MIT 覆盖所附独立代码和文档，不授予参考网站的商标或素材权利。
- 默认大括号和立方体由公式生成，没有图片和字体依赖。自定义图片只使用用户拥有权利或许可允许的素材，不从别人的网站下载图标、代码或字体来追求逐帧一致。
- `mountMorphingParticles()` 在客户端、容器有非零尺寸后调用。处理 `ready` 的失败，在卸载时调用 `dispose()`。图片加载中卸载产生 `AbortError`，属于正常取消。
- `shape` 为 `braces` 或 `cube`；自定义图形使用单个 `imageUrl`。本引擎不使用旧版 `textureUrls` 数组或原站 `vendor` 文件。
- 装饰画布设置 `aria-hidden="true"`，正文和按钮保留可访问性。引擎支持键盘聚焦和减少动态效果，窄屏双栏改为纵向。
- 既有项目只引入需要的样式，并限定到组件，避免将独立页的全局样式覆盖全站。
- 视觉目标是相近的布局、粒子图形和交互方向；算法和具体帧不同，不宣称原站 1:1 源码或逐帧复刻。

## 验证

用项目可用浏览器检查桌面、手机、非背景像素和连续帧变化。检查进入/离开、聚焦/失焦后粒子颜色恢复，以及卸载、重新挂载、无效图片和容器缩放。

减少动态效果模式下，粒子保持静态，正文和按钮仍可用。不要在该模式下要求连续帧变化。

画布存在或构建通过不能代替实际绘制验证。无法验证的路径应明确说明。

布局参考：[桌面](references/desktop.png)、[手机](references/mobile.png)。这些截图由所附独立实现生成。

交付文件位置、启动方式、参数和验证结果。项目内技能文件夹需要复制到目标项目的技能目录后，才能被该项目发现。
