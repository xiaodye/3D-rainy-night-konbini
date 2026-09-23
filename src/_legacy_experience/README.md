# _legacy_experience/ — 已退役的自研 R3F 场景

这一目录是项目早期**手写的 React Three Fiber 场景实现**（底座 / 便利店 / 街道 / 道具 / 雨 / 涟漪 / 灯光 / 后处理 / CameraRig 等），
现已**不再参与渲染**，仅作为回退参考保留。

## 现状
- 当前页面渲染的是 `/diorama.js`（外部 demo bundle，见 `reference/README.md`），
  由 `src/scene/SceneDriver.tsx` 驱动相机做五幕滚动叙事。
- 当前入口：`src/App.tsx` → `SceneDriver` + `ScrollNarrative` + `WaterPanel` + `LoadingScreen`。

## three 版本

本目录与线上场景（`src/scene/diorama/`）现在**共用同一个 three**（`node_modules/three`，ESM）。
场景源码还原之前，线上用的是内联的 r160 UMD 副本，两者不能混用（跨实例 `instanceof` 会失效）；
该副本已归档到 `_legacy/three-r160.js`，仅在需要对照旧产物时才用得上。

## 回退办法（如需）
1. `index.html`：把 `<canvas id="scene">` 改回 `id="c"`，去掉两段 demo 的 `defer` 脚本。
2. `src/App.tsx`：把 `<SceneDriver />` 换回 `<SceneCanvas />`（来自本目录）。
3. 恢复 `src/styles/global.css` 中的 `#c` 选择器（当前是 `#scene`）。

旧场景的 bundle 备份在 `_legacy/diorama.legacy.js`，旧截图在 `_legacy/screenshots/`。
