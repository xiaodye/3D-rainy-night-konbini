#!/usr/bin/env python3
"""
Convert the bundled diorama (public/diorama.js) back into modules.

The bundle was never minified — it keeps real names, comments and indentation,
with `// ==== src/<name>.js ====` markers between modules and a uniform
IIFE + `window.__M` namespace convention. So this is a mechanical transform,
not a reverse engineering job: logic is copied verbatim, only the module
boundaries and the dependency wiring change.

What it does per module
  - drop the `__M.<name> = {}` declaration and the `(function () { ... })()`
    wrapper (including the 'use strict' line)
  - `const __THREE = window.THREE` / `const THREE = __THREE`  ->  `import * as THREE from 'three'`
  - `const { A, B } = __M.other`  ->  `import { A, B } from './other'`
  - the two inlined three addons are dropped entirely; their named exports are
    rewritten to imports from three/examples/jsm/...
  - `Object.assign(__M.<name>, { A, B })`  ->  `export { A, B }`

Run:  python3 scripts/extract-diorama-modules.py
"""

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "_legacy", "diorama.bundle-r160.js")
OUT = os.path.join(ROOT, "src", "scene", "diorama")

# (name, first_line, last_line) — 1-based inclusive, taken from the markers
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

# namespaced things that come from three's own addons instead of a sibling module
ADDON_IMPORTS = {
    "mergeGeometries": "three/examples/jsm/utils/BufferGeometryUtils.js",
    "mergeBufferGeometries": "three/examples/jsm/utils/BufferGeometryUtils.js",
    "mergeAttributes": "three/examples/jsm/utils/BufferGeometryUtils.js",
    "computeMikkTSpaceTangents": "three/examples/jsm/utils/BufferGeometryUtils.js",
    "toCreasedNormals": "three/examples/jsm/utils/BufferGeometryUtils.js",
    "mergeVertices": "three/examples/jsm/utils/BufferGeometryUtils.js",
    "OrbitControls": "three/examples/jsm/controls/OrbitControls.js",
}

# note: @ts-nocheck must be a line comment at the very top, otherwise TS ignores it
HEADER = """// @ts-nocheck — pending incremental typing (see docs/source-restore.md)

/*
 * Restored from the bundled diorama (see reference/README.md).
 *
 * Mechanically converted back to source: the original module had the same
 * structure, this file just swaps the `window.__M` namespace wiring for ES
 * module imports/exports. The rendering logic itself is unchanged.
 */
"""


def convert(name: str, body: str) -> str:
    lines = body.split("\n")

    # 1. drop the module marker comment
    lines = [l for l in lines if not re.match(r"^\s*//\s*====.*====\s*$", l)]

    # 2. remove ONLY the top-level IIFE wrapper. Modules like props/store contain
    #    nested arrow IIFEs `(() => { ... })();` for sub-scopes — deleting every
    #    `})();` would unbalance those, so anchor on the first opener and the
    #    last closer instead.
    open_re = re.compile(r"^\(function\s*\(\s*\)\s*\{\s*$")
    close_re = re.compile(r"^\}\)\(\);\s*$")
    wrapper_open = next((i for i, l in enumerate(lines) if open_re.match(l.strip())), None)
    wrapper_close = next(
        (i for i in range(len(lines) - 1, -1, -1) if close_re.match(lines[i].strip())), None
    )
    drop = {i for i in (wrapper_open, wrapper_close) if i is not None}

    imports = []          # collected import statements
    kept = []

    for idx, line in enumerate(lines):
        if idx in drop:
            continue
        stripped = line.strip()

        # 3. namespace / strict-mode boilerplate
        if re.match(r"^__M\.\w+\s*=\s*\{\};?$", stripped):
            continue
        if stripped in ("'use strict'", '"use strict"', "'use strict';", '"use strict";'):
            continue
        if re.match(r"^const __THREE = window\.THREE;?$", stripped):
            continue
        if re.match(r"^const THREE = __THREE;?$", stripped):
            continue

        # 4. sibling-module destructuring  ->  ES import
        m = re.match(r"^const \{([^}]*)\} = __M\.(\w+);?$", stripped)
        if m:
            names = " ".join(m.group(1).split())
            mod = m.group(2)
            if mod == "BufferGeometryUtils":
                # inlined three addon: route each symbol to its real home, drop unused ones
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

        # 5. module exports  ->  `export { ... }`
        m = re.match(r"^Object\.assign\(__M\.(\w+),\s*\{(.*)\}\);?$", stripped)
        if m:
            names = " ".join(m.group(2).split())
            kept.append(f"export {{ {names} }};")
            continue

        kept.append(line)

    # strip the trailing blank lines the wrapper removal leaves behind
    while kept and not kept[-1].strip():
        kept.pop()

    # three import first, then sibling imports, then the original body
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
            # index.ts is hand-maintained after conversion (bootDiorama wrapper,
            # panel removal, parameter wiring) — regenerating would clobber it.
            print("  (skipping index.ts — hand-maintained)")
            continue
        body = "\n".join(lines[start - 1 : end])
        out_path = os.path.join(OUT, f"{'index' if name == 'main' else name}.ts")
        with open(out_path, "w", encoding="utf-8") as fh:
            fh.write(convert(name, body))
        print(f"  {out_path.replace(ROOT + '/', '')}  ({end - start + 1} lines in)")


if __name__ == "__main__":
    main()
