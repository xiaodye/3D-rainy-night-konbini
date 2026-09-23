# 场景源码还原说明

> 把外部 demo 的单文件打包产物还原为项目内的 TypeScript 源码。
> 相关：[`reference/README.md`](../reference/README.md)（上游 demo 留档）· [`performance-report.md`](./performance-report.md)（性能优化）

---

## 1. 为什么做这件事

场景最初以「提取出来的打包文件」形式接入：

- `public/diorama.js`（约 200KB）—— 场景代码
- `public/vendor/three-r160.js`（约 670KB）—— 内联的 three.js r160

这带来四个问题：

1. **不可维护**：改任何细节都要动 `index.html` 里的 hack（比如注入 `?msaa=2`）
2. **不可调试**：断点落在打包产物里
3. **无 HMR**：改场景必须整页刷新
4. **重复体积**：内联的 three 与 `node_modules` 里的 three 各存一份

目标：还原为项目内的 TS 源码，逻辑不变、行为一致。

---

## 2. 为什么可行（不是逆向工程）

改造前做了四项核实，结论是这属于**机械转换**而非逆向：

| 核实项 | 结果 |
|---|---|
| 是否被压缩 | **没有**。保留完整变量名、注释、缩进 |
| 模块边界 | 清晰，有 `// ==== src/<name>.js ====` 标记 |
| 模块间依赖 | 有向无环，统一用 `const { A, B } = __M.other` 解构 |
| 动态命名空间访问 | **0 处**（`__M[...]` 一次都没出现） |

另外一个关键发现：**3,462 行自研代码之外的 2,773 行（占 44%）是 three.js 官方 addon 的内联副本**（OrbitControls 1,414 行 + BufferGeometryUtils 1,359 行）。这部分不需要"还原"，直接用 npm 包替代即可。

自研代码规模：

| 模块 | 行数 | 职责 |
|---|---|---|
| `config` | 136 | 布局常量（底座/街道/店面/邻居楼）+ 调色板 + 小工具 |
| `toon` | 271 | toon 材质 + `Builder`（几何合并 + 倒壳描边） |
| `sky` | 43 | 夜空渐变贴图（同时充当湿地反射的背景） |
| `ground` | 713 | 湿地面着色器 + 平面镜反射 |
| `postfx` | 210 | bloom / 曝光 / 暗角 / 颗粒 合成 |
| `rain` | 316 | 雨与雨滴溅落 |
| `props` | 735 | 街道道具（贩卖机/信号灯/路灯/自行车/植被…） |
| `store` | 808 | 便利店本体（含自动门、招牌闪烁） |
| `main` | 230 | 装配 + 相机取景 + 主循环 |

---

## 3. 还原后的结构

```
src/scene/diorama/
├── index.ts     装配入口：bootDiorama()
├── adapter.ts   与 React 层的接口（句柄类型、水面参数表、画质档位）
├── config.ts    布局常量与调色板          ← TYPED ✓
├── sky.ts       夜空渐变贴图             ← TYPED ✓
├── toon.ts      toon 材质 + 几何 Builder
├── ground.ts    湿地面 + 平面镜反射
├── postfx.ts    后处理合成
├── rain.ts      雨
├── props.ts     街道道具
└── store.ts     便利店
```

依赖方向（单向，无环）：

```
config ─┬─> toon ─┬─> ground ──┐
        │         ├─> props ───┤
        │         └─> store ───┼─> index
        ├─> sky ──────────────┤
        ├─> postfx ───────────┤
        └─> rain ─────────────┘
```

`adapter.ts` 不 import `three`，只描述结构，供 UI 层使用。

---

## 4. 转换规则（`scripts/extract-diorama-modules.py`）

对每个模块：

| 原写法 | 还原后 |
|---|---|
| `__M.toon = {}` + `(function () { 'use strict'; … })()` | 去掉包装，直接模块作用域 |
| `const __THREE = window.THREE` / `const THREE = __THREE` | `import * as THREE from 'three'` |
| `const { toon, Builder } = __M.toon` | `import { toon, Builder } from './toon'` |
| `const { mergeGeometries } = __M.BufferGeometryUtils` | `import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'` |
| `const { OrbitControls } = __M.OrbitControls` | `import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'` |
| `Object.assign(__M.store, { buildStore })` | `export { buildStore }` |
| 两个 addon 段（2,773 行） | 整段丢弃 |

### 两个必须知道的坑

**① 只能删顶层 IIFE 包装。**
`props.js` 和 `store.js` 内部有 **18 处箭头函数 IIFE**（`(() => { … })();`）作为子作用域。
如果按「删除所有 `})();` 行」处理，会把这些子作用域的收尾一并删掉，导致括号不平衡
（表现为 `TS1005: ')' expected`）。正确做法是**锚定第一个开括号行与最后一个收尾行**。

**② `@ts-nocheck` 必须是行注释。**
写成 `/* @ts-nocheck */` 放在块注释里 **TS 会忽略**，编译时依然报一堆 `implicitly has an 'any' type`。

重构脚本可重复执行（源文件为归档的 `_legacy/diorama.bundle-r160.js`），且会跳过 `index.ts`
——它是手工维护的，重新生成会覆盖掉改造。

---

## 5. 相对原 bundle 的三处有意变更

还原不是逐字节复制，以下三点是刻意改的：

### 5.1 入口改为 `bootDiorama()`

原 bundle 靠 `<script>` 标签的副作用立即执行。现在由 React 在挂载后调用：

```ts
// src/scene/SceneDriver.tsx
let dio = getDiorama()
if (!dio) dio = bootDiorama()      // 幂等，StrictMode 双挂载安全
```

好处：场景构建发生在 Loading 层已经绘制之后，用户先看到进度条而不是白屏；且创建时机可控。

`window.__DIORAMA` 仍然照旧暴露（`docs/performance-report.md` 里的诊断脚本与截图工具依赖它）。

### 5.2 移除自带调参面板，URL 参数改为直通 uniform

原 bundle 的面板代码会把 `?wave=1.4` 这类参数先写进隐藏的 `<input type="range">`，再由 range 驱动 uniform。
面板换成我们的 React 版（`src/ui/WaterPanel.tsx`）后，这条链路直接简化成：

```ts
ground.uniforms.uWaveScale.value = num('wave', 0.6);
// …
rain.setAmount(num('rain', 1));
post.composite.material.uniforms.uExposure.value = num('expo', 1.62);
```

于是 `index.html` 里那段仅供 bundle 读取的隐藏面板 DOM（`#demo-ui`）也一并删掉了。

### 5.3 MSAA 默认值 4 → 2

原先靠 `index.html` 里一段内联脚本注入 `?msaa=2`（见 performance-report 第 4.1 节，那是"不能改源码"时的权宜做法）。
现在直接写在源码里：

```ts
const post = new PostFX(renderer, num('msaa', 2));
```

`?msaa=` 仍然可以被 URL 覆盖。

### 附带的版本变化

three 从内联的 **r160** 换成 `node_modules` 的 **r169**。改造前已逐个核对过用到的 55 个 three API：
没有 `onBeforeCompile` / `useLegacyLights` / `texture.encoding` / `sRGBEncoding` 等已废弃写法，
`mergeGeometries`（而非旧的 `mergeBufferGeometries`）也是新版本的名字。**无需改写任何调用**。

---

## 6. 怎么确认行为一致

四条独立证据：

| 验证 | 结果 |
|---|---|
| **场景图统计**（`data-stats`） | 迁移前后逐项相同：`buckets 137 / meshes 1318 / tris 26214` |
| **五幕机位**（滚动驱动后的相机坐标） | 逐位一致，如第 3 幕 `[3.6, 1.9, 5.0]` |
| **像素对比** | 用同一套 URL 参数（`?t=8&az=23&el=21&d=47&tx=…`）冻结时间与机位，在对照页（原 bundle）与源码版各截一张，几何/材质/光照/雨/反射全部对应 |
| **控制台** | 零错误零警告 |

功能回归同样通过：五幕叙事、水面面板（拖动即改 uniform）、画质档位、360° 自由查看。

> 像素对比时踩过一个坑值得记下：对照页里的 `<input type="range">` 忘了写 `min/max/step`，
> 浏览器默认 `0–100 step 1` 把曝光 `1.62` 四舍五入成 `2`，导致两版亮度明显不同。
> **做 A/B 视觉对比时，先对齐所有输入参数再下结论。**

### 体积变化

| | 之前 | 之后 |
|---|---|---|
| 主 bundle | 155 KB | **942 KB**（含 tree-shaken 的 three） |
| 场景 bundle | 871 KB | —（已并入源码） |
| 内联 three | 670 KB | —（改用 npm） |
| gzip 后 | 约 310 KB（三者合计） | **260 KB** |

---

## 7. 渐进类型化

当前状态：**9 个模块中 2 个已类型化**（`config.ts`、`sky.ts`），其余 7 个带 `// @ts-nocheck`。

### 做法（三步）

1. 删掉文件首行的 `// @ts-nocheck`
2. 跑 `npx tsc --noEmit`，看它报出的 `implicitly has an 'any' type` 清单
3. 只给**函数签名**补类型；数据对象（`BASE`/`COLORS`/材质配置等）交给 TS 推断，不要手写重复的接口

判断依据：这类代码里真正需要标注的是参数与返回值（它们是模块间的契约），
而数据结构一旦手写接口就和源码形成两份真相，反而容易失配。

### 参考范例

`config.ts` 是推荐模板：`Box2` 接口 + `makeRng/lerp/clamp/smoothstep/box2/inBox` 的签名，
数据对象全部推断。

### 建议顺序与提醒

按"被依赖程度 + 复杂度"排序：

1. ~~`sky.ts`~~ ✓
2. ~~`config.ts`~~ ✓
3. `postfx.ts`（210 行，主要是 RT 与 uniform）
4. `rain.ts`（316 行）
5. `toon.ts`（271 行，`Builder` 是核心，建议连同它的 options 一起定义）
6. `ground.ts`（713 行，含大量 uniform 与着色器字符串）
7. `props.ts` / `store.ts`（最大的两个，内部有子作用域，建议按需类型化——改到哪补哪）
8. `index.ts`（装配层，等被依赖模块定型后再收口）

**务实建议**：不必追求一次性全量类型化。这类场景代码的可读性主要来自结构而非类型，
按需在改动处补齐签名，比为了消除 `@ts-nocheck` 而强行套类型更有价值。

---

## 8. 回退与升级

- **回退**：`_legacy/diorama.bundle-r160.js` + `_legacy/three-r160.js` 是原始产物。
  把它们放回 `public/`，再恢复 `index.html` 里两段 `defer` 脚本与隐藏的 `#demo-ui` DOM 即可（见 git 历史）。
- **升级上游 demo**：按 `reference/README.md` 的 checklist 重新提取 → 重跑
  `scripts/extract-diorama-modules.py` → 手工把 `index.ts` 的改造（`bootDiorama` 包装、面板移除、参数直通）重新套一遍。
  这也意味着：**上游若有逻辑更新，需要人工合并**——这是选择"还原源码"换来的可维护性所对应的代价。
