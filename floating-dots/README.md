# Floating dots

黑底蓝色短线粒子背景：环形区域随鼠标缓慢移动，半径持续变化，粒子在环边缘放大并向外偏移。参考 Google Antigravity 的下载区效果，以本地 Canvas 2D 代码实现。

## 启动 demo

需要 Node.js 20+ 和 pnpm。在仓库根目录执行：

```sh
cd floating-dots
pnpm dev
```

打开 http://127.0.0.1:4321/ 。运行 demo 无需先安装依赖。字体随项目本地加载，不需要联网。

自定义端口：

```sh
pnpm dev -- --port 4332
```

访问 `/?tune=1` 可调节粒子密度、大小、环宽、位移和跟随速度。

## 验证

```sh
pnpm check
pnpm test
```

浏览器检查需要系统已安装 Google Chrome；安装测试依赖后执行：

```sh
pnpm install --frozen-lockfile
pnpm test:browser
```

检查会启动同一个本地预览服务，验证动画、鼠标跟随和离开、内容点击、手机/平板/高清屏、减少动画及静态调参。截图保存到 `/tmp/floating-dots-verification`，可用 `SCREENSHOT_DIR` 指定其他目录。

## 接入页面

从 `floating-dots-engine.js` 导入 `mountFloatingDots(container, options)`。容器需要具有实际宽高，画布不拦截内容层的点击事件。

返回的句柄包含 `canvas`、`ready`、`stats()`、`setOptions()`、`start()`、`stop()`、`renderOnce()`、`advanceOnce(dt)`、`debugPoints()` 和 `dispose()`。卸载页面时调用 `dispose()` 清理监听器、观察器及动画资源。

支持 `prefers-reduced-motion`，此时显示静态画面。后台标签页和不可见容器暂停动画。

## 复用技能

[floating-dots skill](skills/floating-dots/SKILL.md) 包含已确认的三个运行模块、完整预览模板、本地字体、调参面板、接入说明和测试。只需复制完整的 `skills/floating-dots` 文件夹到目标项目的 `.agents/skills/floating-dots`，无需复制原 demo；只复制 `SKILL.md` 会缺少代码和资源。其他 agent 使用其支持的技能目录和加载方式。

调用示例：

```text
使用 $floating-dots，在当前页面加入蓝色漂浮粒子环，沿用现有布局和字体。使用随附引擎，验证指针经过内容时仍能跟随、按钮可点击，以及减少动画模式。
```

独立生成预览：

```sh
python3 skills/floating-dots/scripts/materialize.py --destination /tmp/floating-dots-preview --mode standalone
```

在生成目录运行 `pnpm dev`，页面无需安装依赖。已有项目使用 `--mode runtime`，输出 `floating-dots-engine.js`、`motion.js`、`noise-field.js`、`LICENSE` 和 `NOTICE.md`；三个模块放在同一目录，并按 skill 的接入说明挂载。

引擎会替换背景容器的子元素，因此正文和按钮应放在独立内容层。卸载组件时调用 `dispose()`，不要直接搬入独立页的全局样式。

验证 skill 能否脱离原项目使用时，新建空项目，只复制 skill 文件夹，然后让 agent 执行：

```text
只使用 .agents/skills/floating-dots 内的内容生成独立预览，保留默认构图、指针跟随和调参面板。运行检查并验证实际浏览器效果，不要读取原仓库或其他 demo。
```

维护时运行 `pnpm test:skill`，验证复制后的 skill 能独立生成两种输出、三个模块与 demo 一致、字体资源完整，并拒绝覆盖现有目录。引擎或模板更新后同步技能内的文件，再对生成的页面运行 `pnpm test:browser`。

## 来源

- 视觉参考：[Google Antigravity](https://antigravity.google/)。粒子分布和 Canvas 2D 抗锯齿会与参考画面有细微差异。
- Google Sans Flex 字体采用 SIL Open Font License 1.1，许可证见 `assets/OFL.txt`，来源见 `assets/SOURCES.txt`。
- 3D simplex noise 的 Ashima Arts 版权和 MIT 许可保留在 `noise-field.js`。
- 多色光标由 CSS 绘制；不分发原站可执行脚本或光标图片。
