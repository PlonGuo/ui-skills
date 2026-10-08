# 接入已有项目

先给背景一个有明确尺寸的容器，再把 Canvas 放在内容层下面：

```html
<section class="workspace-panel">
  <div class="dot-grid-layer" aria-hidden="true"></div>
  <div class="workspace-content">
    <h1>Workspace</h1>
  </div>
</section>
```

```css
.workspace-panel {
  position: relative;
  min-height: 480px;
  overflow: hidden;
  background: #191b1f;
}

.dot-grid-layer {
  position: absolute;
  inset: 0;
}

.dot-grid-layer canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.workspace-content {
  position: relative;
  z-index: 1;
}
```

把 runtime 输出中的 `dot-grid.js` 复制到项目后，在客户端、容器可见且有尺寸时执行：

```js
import { mountDotGridBackground } from './dot-grid.js';

const effect = mountDotGridBackground(document.querySelector('.dot-grid-layer'));
// 组件卸载时：effect.dispose();
```

React、Vue 或其他框架中，把初始化放入挂载生命周期，把 `effect.dispose()` 放入卸载生命周期。不要在服务端渲染阶段访问 `window`、`document` 或 `canvas.getContext()`。

如果项目已有 Canvas 管理器，可以只移植模板 `app.js` 的 `resize`、`draw`、指针状态和生命周期部分，保留宿主项目的模块边界与 CSS 变量。

验证时使用实际容器尺寸，而不是只检查 Canvas 元素是否存在。隐藏或零尺寸容器应在显示后再初始化。
