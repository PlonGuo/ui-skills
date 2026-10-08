# Morphing particles

一个独立实现的图形粒子背景，使用浏览器 Canvas 2D，采用 MIT 许可。

保留了双栏文案、浅色散点、图形聚合、悬停和键盘聚焦过渡的视觉方向。运动算法和具体帧画面与参考网站不同，不宣称逐帧一致。

## 运行

```sh
pnpm dev
```

打开 http://127.0.0.1:4321 。端口占用时使用 `pnpm dev --port 4322`。

## 实现与参数

`particle-engine.js` 实现公式图形、点位生成、平滑过渡、鼠标排斥、暂停和卸载。`app.js` 将两个实例接到展示页。大括号和立方体由几何公式生成；系统字体由浏览器提供，没有打包原站脚本、图片、字体或公共样式。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `shape` | braces | braces / cube |
| `imageUrl` | 未设置 | 使用调用者有权使用的自定义图形图片 |
| `density` | 50 | 粒子数量的相对倍率，有数量上限 |
| `particlesScale` | 0.6 | 单个点的大小 |
| `cameraZoom` | 8.8 | 兼容示例的图形缩放参数；本实现没有三维相机 |
| `pixelRatio` | 设备像素比，最高 2 | 清晰度与绘制成本 |
| `colors` | 灰、红、蓝 | 散点与图形配色 |

在已有项目中用 `mountMorphingParticles(container, options)` 挂载；`ready` 表示初始化结束，`dispose()` 释放实例。自定义图片加载过程中卸载会取消加载，并使 `ready` 以 `AbortError` 拒绝，调用者应处理该正常取消路径。

容器离开视口、标签页隐藏时停止绘制。用户启用减少动态效果时，显示静态粒子，保留交互状态和可用文案。

## 检查

`pnpm check` 检查 JavaScript 语法。`tests/browser-rendering.js` 和 `tests/browser-interaction.js` 在浏览器页面环境执行，用于检查实际像素、连续帧、布局及交互；它们不是 Node 单元测试。运行模块的生命周期、图片错误和减少动态效果还需浏览器验证。

此示例的按钮链接指向参考网站，复用时按项目需求修改。
