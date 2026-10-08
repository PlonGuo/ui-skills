# 在已有项目中使用

把粒子引擎挂载到已有尺寸的背景容器，再在组件卸载时释放它。

这像把投影仪放进现有房间：房间的布局由项目负责，粒子模块只负责投影；离开时要关闭投影仪。因此已有项目不需要复制完整展示页样式。

## 生成运行模块

```sh
python3 <skill-dir>/scripts/materialize.py --destination <project>/src/effects/morphing-particles --mode runtime
```

输出包含 `particle-engine.js`、`LICENSE` 和 `NOTICE.md`，默认图形无外部资源依赖。使用项目已有构建工具，保留许可证与相关说明；不要再引入原站的 `vendor` 或 PNG。

## 一个接入示例

```html
<article class="particle-card">
  <div class="particle-background" aria-hidden="true"></div>
  <div class="particle-content"><h2>Your heading</h2><a href="/start">Get started</a></div>
</article>
```

```css
.particle-card { position: relative; min-height: 480px; overflow: hidden; }
.particle-background { position: absolute; inset: 0; }
.particle-background canvas { display: block; width: 100%; height: 100%; }
.particle-content { position: relative; z-index: 1; padding: 160px 24px; }
```

```js
import { mountMorphingParticles } from './effects/morphing-particles/particle-engine.js';

const card = document.querySelector('.particle-card');
const effect = mountMorphingParticles(card.querySelector('.particle-background'), {
  trigger: card.querySelector('.particle-content'),
  shape: 'cube',
});
effect.ready.catch(error => {
  if (error.name !== 'AbortError') console.error('Particle background failed', error);
});
// 在所属组件卸载时调用 effect.dispose()。
```

`ready` 是表示初始化何时完成的 Promise。默认公式图形立即准备；自定义图片需要异步加载。加载失败会移除画布并拒绝 Promise；图片加载中卸载会取消加载，产生正常的 `AbortError`。

## 框架与动效

- React 在 effect 中挂载，清理函数调用 `dispose()`；兼容开发模式的挂载、卸载、再次挂载。
- Vue 在 `onMounted` 中挂载，在 `onBeforeUnmount` 中释放。
- Astro 启用客户端路由时，跟随项目的进入/离开生命周期挂载和释放。
- 任何框架都只在客户端调用。容器初始隐藏且没有尺寸时，等显示后再挂载。
- 用户设置减少动态效果时，引擎只画静态粒子；交互颜色仍更新。隐藏容器不绘制，恢复尺寸后重新绘制。

## 排障与验证

空白时检查容器尺寸、`ready`、Canvas 2D 是否可用，以及自定义图片的请求和跨域读取。默认图形不需要图片或 Worker，因此无需为本引擎放宽 Blob Worker 的安全策略。

验证非背景像素、正常模式下的连续帧、悬停/离开、聚焦/失焦、两种视口、尺寸变化、卸载/重新挂载、图片错误，以及减少动态效果模式下的静态显示。

自定义图片、字体或依赖需要由项目自行确认许可；仓库的 MIT 不能授予第三方素材权利。
