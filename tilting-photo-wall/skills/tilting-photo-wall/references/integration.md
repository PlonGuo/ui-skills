# 接入已有项目

把照片墙挂到有尺寸的容器中，再由页面负责它的进入与退出。

这像把展示柜放进房间：展示柜负责照片，房间仍负责布局和通道。直接复制独立页的全屏样式、滚轮监听，会占用原页面的滚动通道，所以应先选择全屏展示还是局部组件。

## 生成模块

```sh
python3 <skill-dir>/scripts/materialize.py --destination <project>/src/effects/photo-wall --mode runtime
```

输出包括引擎和许可文件，不包括照片、全局样式、服务器或依赖。图片地址相对于浏览器页面解析；沿用目标框架的资源导入或 `public` 目录规则，不要照抄技能所在机器的路径。

## 全屏展示的最小示例

以下调用适用于专门展示照片墙的页面。`images` 使用已有项目的真实图片地址。

```html
<main class="photo-wall-page">
  <div class="photo-wall-host" aria-hidden="true"></div>
</main>
```

```css
.photo-wall-page { position: fixed; inset: 0; overflow: hidden; background: #000; }
.photo-wall-host { position: absolute; inset: 0; }
```

```js
import { mountPhotoWall } from './effects/photo-wall/photo-wall-engine.js';

const wall = mountPhotoWall(document.querySelector('.photo-wall-host'), {
  images: ['/photos/first.jpg', '/photos/second.jpg', '/photos/third.jpg'],
});

// 在页面或组件卸载时调用；重新进入时创建新的实例。
function cleanup() {
  wall.dispose();
}
```

图片少于 15 张时会循环使用；传入更多图片不会自动增加卡片数。保留默认几何即可复用已确认的构图，需要改变数量时再调整 `helix`。

## 局部组件与框架

引擎默认在 `window` 上监听 `wheel` 并调用 `preventDefault()`，因此**原样接入普通长页面会阻止页面滚动**。

若需求是长页面中的局部照片墙，修改复制到目标项目的模块，将 wheel 的注册和 `dispose()` 中的移除都改为 `container`，并按产品交互决定何时阻止默认滚动。两个位置必须一起改；验证鼠标在组件外时页面正常滚动。不要向 `mountPhotoWall` 传入不存在的 `wheelTarget`、`interactive` 或 `onScroll` 选项。

- 容器使用组件自己的 `position: relative`、明确高度和 `overflow: hidden`；不要复制 demo 中对 `body`、`html` 的全局规则。
- React 在 effect 中挂载并返回清理函数，Vue 在挂载/卸载钩子中处理。服务端渲染只输出容器，浏览器接管后才创建实例。
- 重复挂载前释放旧实例。一个全屏页面只挂一个默认实例，避免多个窗口滚轮监听叠加。
- 宿主按钮放在画布上层。画布中的照片不可被键盘逐项选择；如需相册导航或有意义的图片内容，另外实现语义化 HTML，不把装饰画布当作可访问相册。

## 加载与更新

`ready` 是布尔值，只说明已有图片加载。不要写 `wall.ready.then(...)` 或 `wall.ready.catch(...)`；`await wall.ready` 也不会等待解码。

需要“全部照片加载完成”时，在挂载前用项目的图片加载机制确认所有 URL 成功；图片失败会留下深色占位，引擎没有公开图片失败回调。使用同源图片最容易检查画布像素；跨域图片可能让浏览器禁止读取像素。

`setOptions()` 可更新几何和运动参数，并合并部分 `camera` / `helix` 配置；它不会重新加载 `images` 或 `imageUrl`。更换图片列表需要销毁后重建。

`stop()` 暂停动画，`start()` 恢复。页面重新可见时引擎会调用 `start()`。减少动画偏好在启动时检查；若产品要求立刻响应系统偏好切换，由宿主监听变化，再调用 `stop()` / `start()`，并在卸载时移除宿主监听。

## 自检

- 组件外还能正常滚动吗？关闭页面后滚轮和触摸监听是否移除？
- 图片路径来自目标项目吗？是否把 `ready` 错当成“全部图片就绪”？
- `deltaY > 0` 是否加速前景向左上运动，`deltaY < 0` 是否减速并可反转？
