# _legacy_experience/ — 已退役的自研 R3F 场景

这一目录是项目早期**手写的 React Three Fiber 场景实现**（底座 / 便利店 / 街道 / 道具 / 雨 / 涟漪 / 灯光 / 后处理 / CameraRig 等），
现已**不再参与渲染**，仅作为回退参考保留。

## 现状
- 当前页面渲染的是 `/diorama.js`（外部 demo bundle，见 `reference/README.md`），
  由 `src/scene/SceneDriver.tsx` 驱动相机做五幕滚动叙事。
- 当前入口：`src/App.tsx` → `SceneDriver` + `ScrollNarrative` + `WaterPanel` + `LoadingScreen`。

## ⚠️ 重要警告：不要混用两套 three

| | 版本 | 形态 | 位置 |
|---|---|---|---|
| 本目录（旧实现） | three **0.169** | ESM，`import * as THREE from 'three'` | `node_modules/three` |
| 线上场景（新） | three **r160** | UMD，挂 `window.THREE` | `public/vendor/three-r160.js` |

两者是**不同的运行时实例**，跨实例的 `instanceof`（如 `obj instanceof THREE.Mesh`）会失效，
几何/材质对象也不能互通。因此：
- 新代码（`src/scene/*`、`src/ui/*`）**一律不 import `three`**，只通过 `window.__DIORAMA` 的结构化接口操作。
- 若哪天要回退到本目录的实现，请确认没有同时加载 `public/vendor/three-r160.js`。

## 回退办法（如需）
1. `index.html`：把 `<canvas id="scene">` 改回 `id="c"`，去掉两段 demo 的 `defer` 脚本。
2. `src/App.tsx`：把 `<SceneDriver />` 换回 `<SceneCanvas />`（来自本目录）。
3. 恢复 `src/styles/global.css` 中的 `#c` 选择器（当前是 `#scene`）。

旧场景的 bundle 备份在 `_legacy/diorama.legacy.js`，旧截图在 `_legacy/screenshots/`。
