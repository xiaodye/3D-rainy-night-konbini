#!/usr/bin/env python3
"""
把打包产物（原 public/diorama.js，现归档于 _legacy/diorama.bundle-r160.js）
转换回模块文件。

该产物从未被压缩 —— 它保留了真实的变量名、注释与缩进，模块之间有
`// ==== src/<name>.js ====` 标记，并且统一采用 IIFE + `window.__M`
命名空间约定。所以这是一次机械转换，而不是逆向工程：逻辑逐字复制，
只改变模块边界与依赖接线方式。

每个模块做的事
  - 去掉 `__M.<name> = {}` 声明与 `(function () { ... })()` 包装
    （连同 'use strict' 那一行）
  - `const __THREE = window.THREE` / `const THREE = __THREE`  ->  `import * as THREE from 'three'`
  - `const { A, B } = __M.other`  ->  `import { A, B } from './other'`
  - 两段内联的 three addon 整段丢弃；它们的具名导出改写为
    从 three/examples/jsm/... 的 import
  - `Object.assign(__M.<name>, { A, B })`  ->  `export { A, B }`

运行：python3 scripts/extract-diorama-modules.py
（需先备好 _legacy/diorama.bundle-r160.js）
"""

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "_legacy", "diorama.bundle-r160.js")
OUT = os.path.join(ROOT, "src", "scene", "diorama")

# (名称, 起始行, 结束行) —— 1-based 闭区间，取自模块标记
MODULES = [
    ("config", 2, 137),
    ("toon", 2911, 3181),
    ("sky", 3182, 3224),
    ("ground", 3225, 3937),
    ("postfx", 3938, 4147),
    ("rain", 4148, 4463),
    ("props", 4464, 5198),
    ("store", 5199, 6006),
    ("main", 6007, 6236),
]

# 来自 three 自带 addon（而非同级模块）的命名空间成员
ADDON_IMPORTS = {
    "mergeGeometries": "three/examples/jsm/utils/BufferGeometryUtils.js",
    "mergeBufferGeometries": "three/examples/jsm/utils/BufferGeometryUtils.js",
    "mergeAttributes": "three/examples/jsm/utils/BufferGeometryUtils.js",
    "computeMikkTSpaceTangents": "three/examples/jsm/utils/BufferGeometryUtils.js",
    "toCreasedNormals": "three/examples/jsm/utils/BufferGeometryUtils.js",
    "mergeVertices": "three/examples/jsm/utils/BufferGeometryUtils.js",
    "OrbitControls": "three/examples/jsm/controls/OrbitControls.js",
}

# 生成文件统一的头部注释（与已转换的文件保持一致）
HEADER = """/*
 * 还原自打包产物 diorama（见 docs/source-restore.md）。
 *
 * 机械转换回源码：原模块结构相同，本文件只是把 `window.__M` 命名空间
 * 接线换成 ES module 的 import/export，渲染逻辑本身未改动。
 */
"""


def convert(name: str, body: str) -> str:
    lines = body.split("\n")

    # 1. 丢弃模块分隔标记
    lines = [l for l in lines if not re.match(r"^\s*//\s*====.*====\s*$", l)]

    # 2. 只去掉顶层 IIFE 包装。props/store 这类模块内部有嵌套的箭头函数
    #    IIFE（`(() => { ... })();`）作子作用域 —— 若把所有 `})();` 都删掉，
    #    这些子作用域就会括号失衡。因此改为锚定第一个开括号行与最后一个收尾行。
    open_re = re.compile(r"^\(function\s*\(\s*\)\s*\{\s*$")
    close_re = re.compile(r"^\}\)\(\);\s*$")
    wrapper_open = next((i for i, l in enumerate(lines) if open_re.match(l.strip())), None)
    wrapper_close = next(
        (i for i in range(len(lines) - 1, -1, -1) if close_re.match(lines[i].strip())), None
    )
    drop = {i for i in (wrapper_open, wrapper_close) if i is not None}

    imports = []          # 收集到的 import 语句
    kept = []             # 保留下来的原始代码行

    for idx, line in enumerate(lines):
        if idx in drop:
            continue
        stripped = line.strip()

        # 3. 命名空间 / strict 模式的样板代码
        if re.match(r"^__M\.\w+\s*=\s*\{\};?$", stripped):
            continue
        if stripped in ("'use strict'", '"use strict"', "'use strict';", '"use strict";'):
            continue
        if re.match(r"^const __THREE = window\.THREE;?$", stripped):
            continue
        if re.match(r"^const THREE = __THREE;?$", stripped):
            continue

        # 4. 同级模块解构  ->  ES import
        m = re.match(r"^const \{([^}]*)\} = __M\.(\w+);?$", stripped)
        if m:
            names = " ".join(m.group(1).split())
            mod = m.group(2)
            if mod == "BufferGeometryUtils":
                # 内联的 three addon：把每个符号指回它真正的来源，未使用的直接丢弃
                used = [n for n in names.split(",") if n.strip() in ADDON_IMPORTS]
                by_mod = {}
                for n in used:
                    by_mod.setdefault(ADDON_IMPORTS[n.strip()], []).append(n.strip())
                for src_mod, syms in by_mod.items():
                    imports.append(f"import {{ {', '.join(syms)} }} from '{src_mod}'")
            elif mod == "OrbitControls":
                imports.append(
                    "import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'"
                )
            else:
                imports.append(f"import {{ {names} }} from './{mod}'")
            continue

        # 5. 模块导出  ->  `export { ... }`
        m = re.match(r"^Object\.assign\(__M\.(\w+),\s*\{(.*)\}\);?$", stripped)
        if m:
            names = " ".join(m.group(2).split())
            kept.append(f"export {{ {names} }};")
            continue

        kept.append(line)

    # 清掉移除包装后残留的尾部空行
    while kept and not kept[-1].strip():
        kept.pop()

    # 顺序：three 的 import → 同级模块 import → 原始代码体
    three_import = "import * as THREE from 'three'"
    dep_imports = sorted(set(imports))

    chunks = [HEADER.rstrip(), "", three_import]
    if dep_imports:
        chunks.append("")
        chunks.extend(dep_imports)
    chunks.append("")
    chunks.extend(kept)
    chunks.append("")

    return "\n".join(chunks)


def main() -> None:
    with open(SRC, encoding="utf-8") as fh:
        lines = fh.read().split("\n")

    os.makedirs(OUT, exist_ok=True)

    for name, start, end in MODULES:
        if name == "main":
            # index.ts 在转换后是手工维护的（bootDiorama 包装、
            # 面板移除、参数接线）—— 重新生成会把它覆盖掉。
            print("  (skipping index.ts — hand-maintained)")
            continue
        body = "\n".join(lines[start - 1 : end])
        out_path = os.path.join(OUT, f"{'index' if name == 'main' else name}.ts")
        with open(out_path, "w", encoding="utf-8") as fh:
            fh.write(convert(name, body))
        print(f"  {out_path.replace(ROOT + '/', '')}  ({end - start + 1} lines in)")


if __name__ == "__main__":
    main()
