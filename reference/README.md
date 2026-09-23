# reference/ — 上游 demo 留档与升级说明

## 文件
- `demo-d9ca1e05.html` — 上游原始单文件 demo（「雨夜のコンビニ — Rainy Night Corner」，未压缩结构化源码，**6338 行**）

## 我们的项目怎么用它
项目**不直接引用**这个 HTML。构建时用的是从它提取出的两个文件：

| 产物 | 来源行区间（1-based，含首尾） | 说明 |
|---|---|---|
| `public/vendor/three-r160.js` | 90–95 | three.js r160 UMD 构建 |
| `public/diorama.js` | 98–6332 | `__M` 场景模块 + main IIFE |

被丢弃的区间：
- 76–88：dev diagnostics 脚本（会全局改写 `console.error`，干扰 Vite/React 报错）
- 89：`console.warn('Scripts "build/three.js" ... deprecated')`
- 6335：cloudflare beacon（无关）

## ⚠️ 两个必须知道的坑

1. **`0,` 前缀不是装饰**
   原文件第 89 行是 `console.warn('...'),` —— **行尾逗号**让它与 90–95 行构成一个逗号表达式。
   如果只拷 90–95 行，新文件会以 `function(` 开头，被 JS 解析成**匿名函数声明**并抛
   `SyntaxError: Function statements require a function name`，three.js 全挂。
   因此 `public/vendor/three-r160.js` 开头必须保留 `0,` 这一行。

2. **canvas id 必须是 `scene`**
   demo 第 6128 行是 `document.getElementById('scene')`。我们的 `index.html` 里因此也用
   `<canvas id="scene">`（变量名沿用项目早期习惯不变）。

## 其他关键事实（我们的适配层依赖它们）
- `window.__DIORAMA = { scene, camera, controls, renderer, post, stats, fitCamera, ground, store, props, rain, THREE }` 是整个 main IIFE 的**最后一条语句**（第 6330 行），可当作"启动完成"信号。
- **没有 ready 标志**。我们用 `__DIORAMA` 存在 + `renderer.info.render.calls > 0` 判定"已渲染过一帧"。
- demo 第 6206–6254 行是它自带的调参面板代码，其中第 6246 行 `document.getElementById('hide').addEventListener(...)` 在缺 DOM 时会抛错，而那行的位置在 `resize()` / `requestAnimationFrame(frame)` / `window.__DIORAMA = ...` **之前** → 后果是**黑屏 + 我们的 LoadingScreen 永远停在 99%**。
  因此 `index.html` 里保留了一段 `display:none` 的"参数源 DOM"（`#demo-ui`），既让这段代码跑得过去，又让 URL 参数优先语义（`?wave=` 等）继续生效。
- demo 的 OrbitControls 在 `onMouseWheel` 里 `preventDefault`，会**吃掉页面滚动**。我们的 `SceneDriver` 在 canvas 上以 **capture 阶段**拦 wheel：无修饰键 → `stopImmediatePropagation()`（页面正常滚动）；`Cmd/Ctrl + 滚轮` → 放行给 OrbitControls 缩放。
- demo 的 `controls` 每帧 `update()` 都会用球坐标**回写 `camera.position`**，并 clamp 到 `minDistance/maxDistance` 与 `min/maxPolarAngle`。所以驱动相机前必须放宽这些约束（`SceneDriver` 里的 `NARRATIVE` profile）。
- demo 自带 composite 阶段的暗角与颗粒，我们自己的 `#vig` 只是很轻的一层叠加。

## 相关文档

- **性能**：这个 bundle 的默认配置（4× MSAA、每帧全屏平面反射、每帧重算阴影）在 fill-rate 受限的 GPU 上会很吃力。
  诊断过程、优化动作与量化收益见 [`../docs/performance-report.md`](../docs/performance-report.md)。
  改动集中在 `index.html` 的 `?msaa=2` 注入与 `src/scene/SceneDriver.tsx` 的初始化部分，**不修改 bundle 本身**。

## 升级到新版 demo 的 checklist
1. 把新 HTML 放到 `reference/`，用 `grep -n '<script' / '</script>'` 重新确定四个区间边界。
2. 确认新版的 `window.__DIORAMA` 仍是 IIFE 末句、canvas id 仍是 `scene`、自带面板段仍会 `getElementById('hide')`。
3. 重新生成两个 bundle（脚本见下），跑 `node --check`。
4. 检查水面 uniform 名称（`uWaveScale / uRipAmp / uReflStrength / uWaterDark / uSparkle / uPoolStrength`）是否变了 —— 变了要同步 `src/scene/diorama.ts`。
5. 重新逐幕校准机位（`src/scene/keyframes.ts`）。

## 重新生成的命令（Python，按行区间）
```bash
python3 - <<'PY'
lines = open("reference/<new-demo>.html", encoding="utf-8").read().split("\n")
open("public/vendor/three-r160.js", "w").write("0,\n" + "\n".join(lines[89:95]) + "\n")   # 行 90-95
open("public/diorama.js", "w").write("\n".join(lines[97:6332]) + "\n")                    # 行 98-6332
PY
node --check public/vendor/three-r160.js && node --check public/diorama.js
```
