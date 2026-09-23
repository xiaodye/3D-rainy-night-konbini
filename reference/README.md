# reference/ — 上游 demo 留档与升级说明

> **当前状态**：场景已**还原为项目内的 TypeScript 源码**（`src/scene/diorama/`），运行时不再加载任何提取出来的打包文件。
> 本目录保留上游原件，用途变为「还原来源 + 升级参考」。还原过程见 [`../docs/source-restore.md`](../docs/source-restore.md)。

## 文件
- `demo-d9ca1e05.html` — 上游原始单文件 demo（「雨夜のコンビニ — Rainy Night Corner」，**6338 行**，未压缩的结构化源码）

## 历史：曾经怎么接入（现已不再使用）
场景一度以打包产物的形式运行：
- `public/vendor/three-r160.js` ← 提取自第 90–95 行（three.js r160 UMD）
- `public/diorama.js` ← 提取自第 98–6332 行（`__M` 场景模块 + main IIFE）
- `index.html` 里用两段 `<script defer>` 加载它们，并额外补了一段 `display:none` 的面板 DOM

这些 hack 都已删除。现在 `index.html` 只有 `<canvas id="scene">` 与 React 入口；
原始产物归档在 `_legacy/diorama.bundle-r160.js` 与 `_legacy/three-r160.js`（回退用）。

## 相关文档

- **源码还原**：`src/scene/diorama/` 的结构、转换规则、行为一致性验证、渐进类型化路径 —— 见 [`../docs/source-restore.md`](../docs/source-restore.md)
- **性能**：上游默认配置（4× MSAA、每帧全屏平面反射、每帧重算阴影）在 fill-rate 受限的 GPU 上很吃力。
  诊断与优化见 [`../docs/performance-report.md`](../docs/performance-report.md)

## 升级到新版 demo 的 checklist

> 注意：还原成源码后，**上游的逻辑更新需要人工合并**（不再是替换一个文件即可）。
> 这是换取可维护性所对应的代价；若上游只是改参数/色调，通常直接改 `src/scene/diorama/config.ts` 更快。

1. 把新 HTML 放到 `reference/`，用 `grep -n '<script' / '</script>'` 重新确定区间边界。
2. 确认新版的 `window.__DIORAMA` 仍是 IIFE 末句、canvas id 仍是 `scene`、自带面板段仍会 `getElementById('hide')`。
3. 重新生成两个 bundle（脚本见下），跑 `node --check`。
4. 重跑转换脚本 `python3 scripts/extract-diorama-modules.py`（源文件指向 `_legacy/diorama.bundle-r160.js`，
   需先替换成新提取的产物；脚本会自动跳过手工维护的 `index.ts`）。
5. 手工把 `index.ts` 的三处改造重新套一遍：`bootDiorama()` 包装、移除自带面板段、URL 参数直通 uniform。
6. 检查水面 uniform 名称（`uWaveScale / uRipAmp / uReflStrength / uWaterDark / uSparkle / uPoolStrength`）是否变了 ——
   变了要同步 `src/scene/diorama/adapter.ts`。
7. 重新逐幕校准机位（`src/scene/keyframes.ts`），并核对 `data-stats` 的 meshes/tris 是否如预期变化。

## 完整提取命令（Python，按行区间）
```bash
python3 - <<'PY'
lines = open("reference/<new-demo>.html", encoding="utf-8").read().split("\n")
open("_legacy/three-r160.js", "w").write("0,\n" + "\n".join(lines[89:95]) + "\n")   # 行 90-95
open("_legacy/diorama.bundle-r160.js", "w").write("\n".join(lines[97:6332]) + "\n") # 行 98-6332
PY
node --check _legacy/three-r160.js && node --check _legacy/diorama.bundle-r160.js
```

> ⚠️ `0,` 前缀不是装饰：原文件第 89 行以 `console.warn(...)` **逗号结尾**，让它与 90–95 行构成逗号表达式。
> 只拷 90–95 行会让新文件以 `function(` 开头，被解析成匿名函数声明并抛 `SyntaxError`，three 全挂。
