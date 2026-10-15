---
name: tilting-photo-wall
description: Use when implementing or tuning a tilting photo wall, a black-background 3D helical photo gallery, or scroll-driven perspective photo cards. Supports standalone previews and existing frontend projects. Not for flat masonry galleries or a conventional horizontal carousel.
---

# 倾斜照片墙

让圆角照片沿三维螺旋循环经过镜头：像旋转楼梯把照片依次送到眼前，前景大卡片向左上移动，背景小卡片向右回转。

## 接入

先阅读目标页面、调用位置、图片来源和包管理器，沿用项目技术栈。

- **独立预览**：复制 `assets/template/`。它包含已验证的引擎、15 张本地示例图和检查命令。
- **已有项目**：读取 [接入说明](references/integration.md)，只复制运行模块，再用项目照片挂载。特别注意默认滚轮监听会接管整个窗口。
- **调整外观或修复偏差**：读取 [参数与排障](references/implementation.md)，先比较构图、透视和运动，再改对应参数。

模板实际渲染参考：[桌面](references/desktop.png)、[手机](references/mobile.png)。图中使用随附示例图，替换成项目照片后保持同一套构图。

在下面命令中，`<skill-dir>` 是本技能目录，目标必须是新目录：

```sh
python3 <skill-dir>/scripts/materialize.py --destination <new-directory> --mode standalone
```

生成后在该目录执行 `pnpm dev`，打开终端输出的地址。已有项目改用 `--mode runtime`，输出只有 `photo-wall-engine.js`、`LICENSE`、`NOTICE.md`；调用时传入自己的 `images`。脚本拒绝覆盖现有目录。

## 保留已确认的行为

- 黑色背景，前景大卡片从左上排到右下；后景更小、更暗。初始视口中约四张大卡片，默认一组 15 张循环播放。只改参数时先保留这套构图。
- 默认 **向下滚动 `deltaY > 0` 加速向左上运动**；向上滚动减速，输入足够时反转。松开后回到慢速。不要把滚轮输入改成负号；用户另有明确方向要求时再调整。
- 角度与高度共用一个循环位置。首尾间距保持一致，不能独立重置角度，造成下一轮走到另一条轨道。
- 保留逐角透视投影与分片贴图。用一个平面变换填充梯形会漏黑边；整组图片只做二维旋转也无法保留远近变化。
- 客户端挂载，容器有实际尺寸，卸载调用 `dispose()`。`ready` 是“至少一张图片已加载”的布尔值，不是 Promise，也不表示全部加载成功。
- 系统减少动画模式使用静态构图；画布是装饰层。照片承载正文信息时，由宿主另提供可访问的图片或文本。

## 验证与交付

独立模板提供：

```sh
pnpm check
pnpm test
pnpm install
pnpm test:browser
```

浏览器检查需要系统 Google Chrome，会自行启动和关闭测试服务器。已有项目使用自身测试流程，实际检查桌面、手机、上下滚动、惯性、连续循环、减少动画和卸载；普通页面还要确认外部区域仍能正常滚动。

不要仅凭画布存在或构建通过判断成功。交付文件位置、启动方法、实际验证结果和未覆盖项。

模板示例图由本地 SVG（可缩放矢量图）构成；不含源录屏、参考照片或卡片内视频播放器。替换图片时保留项目实际素材许可，独立代码沿用所附 MIT 许可证。此 skill 文件夹可复制到目标项目的 `.agents/skills/tilting-photo-wall`，通过 `$tilting-photo-wall` 调用。
