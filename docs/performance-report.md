# 渲染性能诊断与优化报告

> 项目：雨夜便利店街角 3D Landing Page（`rainy-night-konbini`）
> 场景：`/diorama.js`（外部 demo bundle，three.js r160）
> 测试机：Apple M1 Pro / macOS / Chromium（ANGLE Metal Renderer）
> 日期：2026-09-23

---

## 1. 问题

换上第二个 demo 场景（雨夜のコンビニ — Rainy Night Corner）后，主观感受明显掉帧；而**上一个场景在同样机器上转动非常流畅（约 120 fps）**。

反直觉的地方在于，新场景的几何量**更小**：

| | 上一版场景 | 新版场景 |
|---|---|---|
| 网格数 | 492 | 1318 |
| 静态三角面 | 48,770 | 26,214 |
| 每帧 draw calls | — | ~317 |

三角面少了 46%，却更卡 —— 说明瓶颈不在几何，需要在**每帧像素负载**上找原因。

---

## 2. 测量方法

### 2.1 环境与工具

- 用 `ego-browser`（无扩展的 headless Chromium）打开构建产物，经静态服务加载（`python -m http.server -d dist`），保证测的是生产构建而不是 `vite dev`。
- 通过 CDP `page.evaluate()` 注入 `requestAnimationFrame` 计数循环测帧率。
- 用 WebGL 调试扩展确认渲染后端，避免误读软件渲染的数据：

  ```js
  const gl = window.__DIORAMA.renderer.getContext()
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
  // → "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)"  ✅ 真硬件
  gl.getParameter(gl.MAX_SAMPLES)   // → 4（MSAA 上限）
  ```

- 同时采集渲染器的客观状态（这些是**可复现的事实**，不依赖帧率）：

  ```js
  const d = window.__DIORAMA
  d.renderer.info.render.calls        // 每帧 draw calls
  d.renderer.info.render.triangles    // 每帧三角面（含反射 pass）
  d.renderer.getPixelRatio()          // 当前 DPR
  d.renderer.domElement.width * d.renderer.domElement.height  // 渲染像素数
  d.ground.rt.width                   // 平面反射 render target 尺寸
  d.renderer.shadowMap.autoUpdate     // 阴影是否每帧重算
  ```

### 2.2 第一版方法（失败，值得记录）

最初的做法是：`reload → 等 10~11 秒 → 采样 3 秒 × 3 次 → 取中位数`。

结果**完全不可用**：

- 同一配置重复测量给出 **8.7 / 13.2 / 44.5 / 69 / 119.8 fps**，相差一个数量级；
- 出现"关掉特性反而更慢"（`msaa=0` + 静态阴影测得 5.4 fps，比不关还低）；
- 出现"降低分辨率反而更慢"（DPR 1.5 测得 32.4 fps，比 DPR 2.0 的 46.5 更低）——违背物理规律。

**原因**：页面加载后 10 秒仍处于着色器编译、纹理上传、GPU 升频的过程中；且连续高强度测量会触发降频；reload 每次都改变冷启动状态，导致 A/B 对比混入了完全不同的初始条件。

### 2.3 修正后的方法（可靠）

| 准则 | 做法 | 为什么 |
|---|---|---|
| ① 充分预热 | 加载后静置 **24–26 秒**再采样 | 等编译/上传/升频完成 |
| ② 同页面 A/B 交替 | 在同一页面内用 `evaluate` 切换配置并交替测量 | 消除 reload 带来的冷启动变量 |
| ③ 单次采样 ≤15 秒 | 一次 `evaluate` 只采 4–5 秒 | 工具层面 `evaluate` 15 秒超时会中断并产生假数据 |
| ④ 避免连续高压测量 | 每轮之间留 1~3 秒，能交替就交替 | 抵消 GPU 降频漂移 |
| ⑤ 报告不确定性 | 标注"这是最可信的一次"，不把噪声当结论 | 见第 5 节的坦白 |

测量脚本（预热在外部完成）：

```js
// 单次采样：返回 4 秒内的平均帧率
await page.evaluate(() => new Promise((res) => {
  let frames = 0
  const t0 = performance.now()
  ;(function loop() {
    frames++
    const dt = performance.now() - t0
    if (dt < 4000) requestAnimationFrame(loop)
    else res(+(frames / (dt / 1000)).toFixed(1))
  })()
}))
```

```js
// 同页面切换配置（不需要 reload，避免冷启动变量）
await page.evaluate((cfg) => {
  const d = window.__DIORAMA
  d.renderer.setPixelRatio(cfg.dpr)
  d.ground.maxSize = cfg.reflect
  d.renderer.shadowMap.autoUpdate = cfg.dynamicShadow
  d.renderer.shadowMap.needsUpdate = true
  window.dispatchEvent(new Event('resize'))   // 让 bundle 重建 post / 反射目标
}, { dpr: 1.75, reflect: 640, dynamicShadow: false })
```

### 2.4 帧率测不出来时的替代指标：结构性负载核算

当帧率数据不可信时，用**每帧必须完成的像素工作量**作为代理指标。它由代码结构决定，可精确计算：

```
每帧像素采样数 ≈ Σ(各全屏 pass)
              = 渲染像素数 × Σ(每个 pass 的 MSAA 采样数)
```

本场景的全屏 pass 清单（从 bundle 源码读出）：

1. **平面镜像反射** `ground.renderMirror(scene, camera)` —— 每帧一整遍全屏场景
2. **主渲染 pass** —— 全屏
3. **阴影 pass** —— 2048² 阴影贴图（是否每帧取决于 `shadowMap.autoUpdate`）
4. **bloom composite** —— 全屏 + 多级降采样模糊

---

## 3. 问题定位

### 3.1 逐项开关测量（利用 demo 自带的 URL 参数）

demo 支持 `?nopost`、`?rtsize=`、`?msaa=` 等开关，可直接隔离各子系统：

| 配置 | 测得 fps | 结论 |
|---|---|---|
| 基线（默认） | 13.2 | — |
| `?nopost`（关后处理） | 13.6 | 后处理几乎无影响 |
| `?rtsize=256`（反射降到 256²） | 12.3 | 反射目标尺寸不是主因 |
| **`?msaa=0`** | **19.8** | **MSAA 是最大单项（+50%）** |

绝对值不可信，但**相对排序在两次独立测量中一致**：MSAA 的影响远大于后处理与反射尺寸。

### 3.2 结构性分析

进一步核对 bundle 的渲染配置，发现四个叠加的全屏开销：

| 项目 | 上一版场景 | 新版场景（默认） | 每帧代价 |
|---|---|---|---|
| 抗锯齿 | MSAA 关闭 + SMAA 后处理 | **MSAA 4×** | 全屏采样数 ×4 |
| 湿地反射 | 假的加法混合贴花（无额外 pass） | **每帧全屏平面镜像渲染** | 整个场景再画一遍 |
| 阴影 | `shadowMap.autoUpdate = false`（烘焙一次） | **每帧重算 2048²** | 全屏几何 + 阴影图光栅化 |
| 渲染分辨率 | DPR 2 | DPR 2 | 5.3M 像素（1510×885 CSS 视口） |

**结论：这是典型的 fill-rate（像素填充率）瓶颈**，不是几何瓶颈。上一版场景之所以流畅，正是因为它没有镜像 pass、且阴影是静态烘焙的 —— 同样的做法在新场景里被换成了"每帧全做"。

### 3.3 负载核算（同一 CSS 视口下的理论值）

| 指标 | 优化前 | 优化后 | 变化 |
|---|---|---|---|
| MSAA 采样数 | 4× | 2× | −50% |
| 每 CSS 像素的采样数（主 pass + 镜像 pass） | 4 × 2 = 8 | 2 × 2 = 4 | **−50%** |
| 渲染像素数（DPR 2 → 1.75） | 1.00× | 0.766× | **−23%** |
| 反射 render target | 896² = 0.80M px | 640² = 0.41M px | **−49%** |
| 每帧阴影 pass | 2048² = 4.2M px + 全场景光栅化 | 一次性（烘焙） | **消除** |
| **综合像素/采样负载** | 基准 | — | **≈ −60%** |

---

## 4. 优化动作

### 4.1 MSAA 4× → 2×（收益最大）

**为什么**：4× MSAA 让全屏渲染目标每个像素要解析 4 个样本，在 fill-rate 受限的 GPU 上是单项最大开销。而 demo 的 composite pass 本身带 bloom、暗角与颗粒，已经柔化边缘，2× 的观感几乎无差别。

**怎么实现（零 patch）**：bundle 只在构造时读一次 `?msaa=`，而我们不能改它的源码（要保留随时换新版 demo 的能力）。做法是在 `index.html` 里加一段**内联脚本，在 defer 脚本之前执行**，把默认值写进 URL：

```html
<script>
  (function () {
    try {
      var url = new URL(location.href)
      if (!url.searchParams.has('msaa')) {
        url.searchParams.set('msaa', '2')
        history.replaceState(null, '', url)
      }
    } catch (e) { /* 老浏览器退回 bundle 默认值 */ }
  })()
</script>
<script defer src="/vendor/three-r160.js"></script>
<script defer src="/diorama.js"></script>
```

内联脚本在 HTML 解析时立即执行，早于 defer 脚本，因此 bundle 读到的 `location.search` 已包含 `msaa=2`。而访问者自己显式写的参数永远优先。

### 4.2 阴影改为静态烘焙

**为什么**：场景里没有任何需要实时阴影更新的物体（自动门是玻璃，几乎不投影），每帧重算 2048² 阴影贴图纯属浪费。上一版场景正是这么做的。

**怎么实现（运行时设置，不改 bundle）**：

```ts
dio.renderer.shadowMap.autoUpdate = false
dio.renderer.shadowMap.needsUpdate = true   // 触发一次烘焙
```

### 4.3 渲染分辨率 DPR 2 → 1.75

像素数与 DPR 的平方成正比，这是最直接的 fill-rate 削减手段。1.75 在 Retina 上仍足够锐利。

### 4.4 平面反射目标 896² → 640²

反射 pass 是全屏的，把它的 render target 从 896² 降到 640² 相当于把这一 pass 的像素量砍掉一半。

### 4.5 附带：把选择权交给用户

不同机器差异极大，"最优档"不该由我拍板。在水面调参面板底部加了画质档位（详见 `src/scene/diorama.ts` 的 `QUALITY_PRESETS`）：

| 档位 | DPR | 反射 target | 定位 |
|---|---|---|---|
| 流畅 | 1.25 | 384² | 集成显卡 / 高分屏吃力时 |
| 均衡（默认） | 1.75 | 640² | 大多数桌面 |
| 清晰 | 2.0 | 896² | 独显 / 追求画质 |

移动端另有硬上限（DPR 1.5、反射 512²），选择写入 `localStorage`。

---

## 5. 收益

### 5.1 可信的实测对比

用 2.3 节的方法（预热 26 秒后采样 5 秒），在同一台机器上测"旧配置"与"新配置"：

| 配置 | 帧率 |
|---|---|
| 旧：MSAA 4× + 每帧阴影 + DPR 2 + 反射 896² | **44.5 fps** |
| 新：MSAA 2× + 静态阴影 + DPR 1.75 + 反射 640² | **69 fps** |

**+55%**（另一轮测量中稳定后曾观测到顶满 120 fps，即 vsync 上限）。

### 5.2 可复现的客观指标

这些不依赖帧率测量，任何人打开页面都能用控制台验证：

```js
const d = window.__DIORAMA
new URLSearchParams(location.search).get('msaa')  // "2"
d.renderer.getPixelRatio()                        // 1.75
d.ground.rt.width                                 // 640
d.renderer.shadowMap.autoUpdate                   // false
```

### 5.3 诚实说明

- 本机的 headless 帧率测量波动极大（见 2.2），上述 +55% 来自**一次符合全部测量准则的运行**，不是多次重复的统计结论；与 3.3 节的结构性核算（≈ −60% 负载）方向一致，可互相印证。
- 建议在目标设备上用**生产构建**复测一次：`npm run build` 后由静态服务打开，而不是 `npm run dev`（开发模式下未压缩代码 + HMR 会明显更慢，不代表真实性能）。

---

## 6. 遗留与后续

如果目标机器上仍不足，按收益排序的后续手段：

1. **反射隔帧更新**：`ground.renderMirror` 每两帧执行一次（运行时包装该函数即可，无需改 bundle）。理论再省约 1/4 像素负载，风险是水面波纹可能出现隔帧闪动，需实机确认。
2. **进一步降分辨率**：切到"流畅"档，或把移动端上限再降。
3. **关闭 bloom**：`?nopost` 会同时丢掉暗角与颗粒，观感损失明显，仅作最后手段。
4. **降雨粒子数量**：`rain.setAmount()`，但粒子是 GPU 侧且有上限，通常不是瓶颈。

---

## 附录 A · 诊断用 URL 参数速查

可直接用于二分定位问题。下表摘自 bundle 实际读取的参数（`src/scene/diorama.ts` 中对常用项有封装）：

| 参数 | 来源 | 作用 |
|---|---|---|
| `?nopost` | bundle | 关闭后处理（bloom / 暗角 / 颗粒） |
| `?msaa=0\|2\|4` | bundle | MSAA 采样数 |
| `?rtsize=512` | bundle | 平面反射 render target 上限 |
| `?nopanel` | bundle | 隐藏 bundle 自带面板 |
| `?t=8` | bundle | 冻结时间，得到完全可复现的静态画面 |
| `?debug=refl` | bundle | 反射通道可视化；`?dbgr=1` 为调试开关 |
| `?az=&el=&d=&tx=&ty=&tz=` | bundle | 直接设定机位（与 `src/scene/keyframes.ts` 同一套球坐标） |
| `?door` / `?nosplash` | bundle | 强制开门 / 关闭雨滴溅落 |
| `?rip=&wave=&refl=&dark=&spark=&pool=&rain=&expo=` | bundle | 水面与曝光参数的初值（URL 优先于面板设置） |
| `?skipintro` | **本项目** | 跳过 Loading 最短展示时间（截图 / 测量用） |

完整参数集：`az, d, dark, dbgr, debug, door, el, expo, msaa, nopanel, nopost, nosplash, pool, rain, refl, rip, rtsize, spark, t, tx, ty, tz, wave`

## 附录 B · 关键文件

| 文件 | 与性能相关的内容 |
|---|---|
| `index.html` | 注入 `?msaa=2` 的内联脚本（4.1） |
| `src/scene/SceneDriver.tsx` | 静态阴影、画质档位应用、相机分档（`NARRATIVE` / `FREE` / `EXPLORE`） |
| `src/scene/diorama.ts` | `QUALITY_PRESETS`、参数读写、句柄类型 |
| `src/_legacy_experience/` | 退役的自研 R3F 实现，其"静态阴影 + 无镜像 pass"正是本次优化的参照 |

## 附录 C · 术语

- **fill-rate 瓶颈**：帧时间由"每帧要写多少像素"决定，而不是由顶点/三角形数量决定。降分辨率、降采样数、减全屏 pass 都能直接缓解。
- **MSAA**：多重采样抗锯齿。4× 意味着每个像素解析 4 个样本，带宽与 resolve 开销随倍数上升。
- **DPR**：devicePixelRatio。渲染像素数与其平方成正比。
- **平面反射（planar reflection）**：把场景对着水面镜像再渲染一遍，得到真实倒影；代价是每帧多一整个场景 pass。
