# 接入已有页面

粒子模块只负责背景，页面仍负责布局和正文。像把灯光装在舞台后方，按钮和文案需要保留独立的位置；否则挂载时会被画布替换。

## 生成与挂载

```sh
python3 <skill-dir>/scripts/materialize.py --destination <project>/src/effects/floating-dots --mode runtime
```

输出三个 JavaScript 模块和许可文件，无字体、图片或运行依赖。三个模块保持同一目录，沿用项目构建流程。

```html
<section class="floating-section">
  <div class="floating-backdrop" aria-hidden="true"></div>
  <div class="floating-content">
    <h2>Ideas in motion</h2>
    <a href="/start">Get started</a>
  </div>
</section>
```

```css
.floating-section { position: relative; min-height: 480px; overflow: hidden; background: #000; }
.floating-backdrop { position: absolute; inset: 0; pointer-events: none; }
.floating-content { position: relative; z-index: 1; padding: 96px 28px; }
```

```js
import { mountFloatingDots } from './effects/floating-dots/floating-dots-engine.js';

const effect = mountFloatingDots(document.querySelector('.floating-backdrop'));
effect.ready.catch(error => console.error('Floating dots initialization failed', error));

// 在所属组件卸载时执行，而不是紧跟在挂载之后立即调用。
function cleanup() {
  effect.dispose();
}
```

`mountFloatingDots()` 同步创建画布并绘制第一帧，可能因容器类型错误或 Canvas 2D 不可用而同步抛错；按宿主项目的错误处理方式调用。`ready` 是立即完成的 Promise，不表示字体加载或浏览器已显示下一帧。

## 生命周期与框架

- React 在 effect 中挂载、清理函数中释放；Vue 在 `onMounted` 中挂载、`onBeforeUnmount` 中释放。每次进入创建新实例，重复挂载前释放旧实例。
- 服务端渲染只输出容器，浏览器接管后才调用引擎。容器应有非零尺寸，初始隐藏时等显示后挂载。
- 引擎调用 `container.replaceChildren(canvas)`，专用背景容器内不要放标题、按钮或其他组件。引擎自身为画布设置 `aria-hidden` 和 `pointer-events: none`。
- 指针监听在 `window`，坐标自动换算为容器内位置；经过上层内容仍能跟随，离开容器后恢复自主运动。不要把监听改到不接收输入的背景画布。
- 触摸输入不会驱动光圈；页面可正常滚动。它没有默认滚轮拦截，不要加入 `preventDefault()` 模拟照片墙行为。
- 离屏或后台自动暂停，可见后恢复。`stop()` 是暂时暂停，可见性变化可能恢复动画；彻底退出需调用 `dispose()`。
- 系统减少动画时保留静态粒子并监听设置变化。`setOptions()` 可刷新静态帧；不要在该模式手动循环调用 `advanceOnce()`。

## 返回句柄

| 方法或字段 | 用途 |
| --- | --- |
| `canvas` / `ready` | 装饰画布 / 初始化完成的 Promise |
| `setOptions(partial)` | 更新支持的参数；密度、种子、数量上限和像素比变更会重新生成点位 |
| `stats()` | 粒子数量、尺寸、运行状态、指针、光圈及实际参数的快照 |
| `start()` / `stop()` | 恢复 / 暂停；恢复仍服从离屏、后台和减少动画设置 |
| `renderOnce()` | 只重绘，不推进运动 |
| `advanceOnce(dt)` | 手动推进并绘制，`dt` 单位为秒，限制在 0–0.05；主要用于验证 |
| `debugPoints()` | 复制屏幕坐标，用于检查位移 |
| `dispose()` | 取消动画、移除监听与观察器、释放画布，可重复调用 |

## 自检

- 内容是否放在背景容器外，按钮还能点击吗？
- 页面缩放后背景尺寸是否正确，组件外还能正常滚动吗？
- 经过文案时是否仍跟随，离开和卸载后是否正确恢复或清理？
- 系统减少动画时是否静止，更换系统设置后能否正确响应？
