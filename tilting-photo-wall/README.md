# Tilting photo wall

照片沿三维螺旋循环移动，前景大卡片从右下向左上掠过，背景小卡片向右回转。黑色背景、圆角、景深明暗与初始构图按用户提供的 2026-10-15 截图和录屏调整；原始参考文件仅保留在本地，不随仓库发布。

## 本地运行

需要 Node.js 20+，运行页面无需安装依赖。在当前目录执行：

```sh
pnpm dev -- --port 4341
```

打开 http://127.0.0.1:4341/ 。不传端口时使用 4321。

- 向下滚动加速，向上滚动减速并可反转；松开后恢复慢速。
- 支持触摸滑动，手机和平板会按屏幕宽度缩放。
- 系统开启“减少动画”时显示静止构图。
- `?index=1` 显示照片编号；`?notes=1` 显示说明浮层。

## 素材

`assets/photos/` 包含从用户提供的截图和录屏中截取、校正透视的 15 张静态图片，总计约 784 KB。顺序由 `app.js` 的数组控制，替换这些路径即可使用自己的照片。

这些图片是参考素材的静态帧，未还原卡片内部的视频播放。攀岩图片在原图中有遮挡，使用其可见区域裁切。页面没有远程图片请求，也没有添加参考画面中不存在的刻度尺或导航栏。`rulers.js` 仍可独立使用，但默认页面不挂载它。

## 验证

```sh
pnpm install
pnpm check
pnpm test
pnpm test:skill
pnpm test:browser
```

浏览器验证使用系统 Google Chrome，并自动启动、关闭测试服务器。覆盖桌面构图、透视贴图边缘、前后运动方向、滚轮与惯性、手机/平板布局、完整循环连续性和减少动画模式。截图保存在 `/tmp/tilting-photo-wall-verification`；可通过 `SCREENSHOT_DIR` 更换目录。

## 接入页面

`mountPhotoWall` 把画布挂到具有实际宽高的容器中；卸载时调用 `dispose()` 清理画布和监听器。

```js
import { mountPhotoWall } from './photo-wall-engine.js';

const wall = mountPhotoWall(document.querySelector('#wall'), {
  images: ['./assets/photos/eye.jpg', './assets/photos/sandboarding.jpg'],
});

wall.dispose();
```

返回句柄提供 `ready`、`stats()`、`quads()`、`setOptions()`、`start()`、`stop()`、`renderOnce()`、`advanceOnce(dt)` 与 `dispose()`。`ready` 表示已有图片加载完成。初始化时传入 `images`，为空时使用 `imageUrl`；图片列表不支持通过 `setOptions()` 动态替换。

主要参数见 `photo-wall-engine.js` 的 `WALL_DEFAULTS`：`helix` 控制轨道半径、圈距和卡片数，`camera` 控制镜头和画面中心，`cardWidth` / `cardAspect` 控制尺寸，`driftDegPerSec` 控制慢速自转。`camera` 和 `helix` 支持部分覆盖。

卡片的高度与角度由同一个循环位置计算，完整播放一轮后回到相同轨道。画布使用 Canvas 2D，每张图片分成小三角形后投影，避免单次平面贴图在梯形轮廓内留下黑边。

## 复用技能

[tilting-photo-wall skill](skills/tilting-photo-wall/SKILL.md) 包含同一套引擎、独立预览模板、已有项目接入说明、参数与排障文档。模板使用 15 张本地生成的 SVG 示例图；当前 demo 中从参考录屏截取的照片不打包进 skill。

把 `skills/tilting-photo-wall` 复制到目标项目的 `.agents/skills/tilting-photo-wall`，然后调用：

```text
使用 $tilting-photo-wall，在当前项目加入倾斜照片墙，沿用现有图片和布局。
```

测试 skill 能否独立使用时，新建空项目，只复制上述 skill 文件夹，开启新 agent 会话并使用以下提示词：

```text
只使用 .agents/skills/tilting-photo-wall 内的内容，在当前空项目生成独立照片墙预览。保留默认构图、运动和滚轮方向，使用随附示例图。运行检查并启动页面，给我预览地址；不要读取原仓库或其他 demo。
```

模板引擎与已确认 demo 保持一致，但示例图片不同。检查构图、透视、循环和上下滚动；比较照片内容时，需为两边提供同一组图片。测试通过不代表已逐像素复刻原录屏。

也可直接生成独立预览：

```sh
python3 skills/tilting-photo-wall/scripts/materialize.py --destination /tmp/photo-wall-preview --mode standalone
```

在新目录执行 `pnpm dev`。已有项目使用 `--mode runtime`，并阅读 skill 中对窗口滚轮监听、生命周期和图片加载的说明。复制脚本不会覆盖现有目录。

维护 skill 时运行 `pnpm test:skill`，检查两种输出、拒绝覆盖现有文件，以及打包引擎与本项目已确认引擎的一致性。引擎更新后需同步 `skills/tilting-photo-wall/assets/template/photo-wall-engine.js`；实际渲染仍需在生成模板中运行浏览器检查。
