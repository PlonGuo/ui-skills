---
name: floating-dots
description: Use when adding or tuning a black-background blue particle ring, floating blue dashes that follow the pointer, or an Antigravity-inspired download section. Not for fixed dot grids, morphing particle silhouettes, or confetti.
---

# 蓝色漂浮粒子环

在黑色背景上绘制随指针缓慢移动、持续呼吸的蓝色短线粒子环，像水面上的光圈带动周围亮点。使用随附 Canvas 2D（浏览器二维画布）代码保留 demo 的运动和外观。

## 选择接入方式

先阅读目标页面、调用位置和包管理器，沿用项目的框架、布局和设计变量。

| 目标 | 使用方式 |
| --- | --- |
| 独立预览完整 UI | `standalone`：包含页面、样式、本地字体、调参面板和测试 |
| 给已有页面加入效果 | `runtime`：只输出三个运行模块、`LICENSE` 和 `NOTICE.md` |
| 修改视觉或排查偏差 | 阅读 [参数与排障](references/implementation.md) |

`<skill-dir>` 为此技能目录，输出目录必须尚不存在：

```sh
python3 <skill-dir>/scripts/materialize.py --destination <new-directory> --mode standalone
```

在生成目录运行 `pnpm dev`，打开终端输出的地址；`/?tune=1` 打开调参面板。运行页面需要 Node.js 20+，无需安装依赖或访问外网。

已有项目改用 `--mode runtime`，并阅读 [接入说明](references/integration.md)。完整 skill 包含所有资源，不需要读取原仓库或安装 Three.js、GSAP。

## 关键约束

- 一起使用 `floating-dots-engine.js`、`motion.js`、`noise-field.js`，保持相对路径；只复制引擎入口会导致导入失败。
- 保留不规则散布、蓝色短线、呼吸光圈、环边缘放大和轻微外移。它不是规则点阵，也不是所有粒子向鼠标聚拢的效果。
- 给引擎一个专用、空的、有实际宽高的容器；挂载会用画布替换该容器的所有子元素，正文和按钮必须放在兄弟内容层。
- 仅在客户端挂载；卸载调用 `dispose()`。`ready` 是 Promise（表示初始化完成的异步句柄），不是图片或字体加载状态。
- 指针监听位于 `window`，画布不接收点击；保留这种方式，让鼠标位于上层文案和按钮时仍可驱动背景。触摸输入不驱动光圈，也不接管页面滚动。
- 保留容器尺寸监听、离屏/后台暂停、系统减少动画时静态显示及偏好变化响应。静态调参应刷新画面而不启动动画。
- 已有页面只加入组件所需样式；独立页的全局布局、字体和调参面板不随 `runtime` 输出。

## 验证与交付

独立模板提供 `pnpm check`、`pnpm test`；浏览器验证需执行 `pnpm install --frozen-lockfile` 后运行 `pnpm test:browser`，并安装 Google Chrome。

检查桌面、手机、高清屏实际蓝色像素与连续帧变化、指针进入/离开和经过文案、按钮点击、尺寸变化、减少动画静态显示与调参、卸载后重挂载。已有长页面还要检查组件外滚动正常。交付文件位置、启动方式和实际验证结果；未执行的检查明确说明。

预览参考：[桌面](references/desktop.png)、[手机](references/mobile.png)。仅表示本实现的外观，不承诺与参考站逐帧相同。

保留 [LICENSE](LICENSE)、[NOTICE.md](NOTICE.md) 以及 `noise-field.js` 内的第三方许可。独立预览附带字体及 `assets/OFL.txt`；已有项目可直接沿用自身字体。

使用时把本目录整体复制到目标 agent 的技能目录，例如 `.agents/skills/floating-dots`，然后调用 `$floating-dots`。只复制 `SKILL.md` 不包含实现代码；安装 skill 后仍需执行接入。
