# 独立模板

独立模板包含 `index.html`、`styles.css` 和 `app.js`，用于快速查看点阵背景。它没有外部依赖，使用浏览器原生 Canvas 2D。

```sh
python3 <skill-dir>/scripts/materialize.py --destination /tmp/dot-grid-preview --mode standalone
cd /tmp/dot-grid-preview
python3 -m http.server 4321
```

打开 `http://127.0.0.1:4321` 后，将鼠标移入点阵。点的位置应保持固定，邻近点只会变亮并略微改变颜色。移出画布后，点阵应恢复到基础颜色。

如果需要改密度，优先调整模板 `app.js` 中的 `spacing`。间距越小，点越密，绘制成本也越高。
