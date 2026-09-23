# 仓库协作指南

## 项目结构

这是一个使用 Vite、React 和 TypeScript 构建的实时 Three.js 微缩场景项目。应用入口和组件编排位于 `src/main.tsx` 与 `src/App.tsx`。场景构建和渲染代码位于 `src/scene/diorama/`，相机与画质控制位于 `src/scene/`。叙事层、通用界面和共享状态分别位于 `src/narrative/`、`src/ui/` 和 `src/state/`。静态资源放在 `public/`，架构、性能及源码还原文档放在 `docs/`，转换工具放在 `scripts/`。

## 开发与构建

- `pnpm install` 根据仓库中的锁文件安装依赖。
- `pnpm dev` 启动 Vite 本地开发服务器。
- `pnpm build` 执行 TypeScript 项目检查，并在 `dist/` 中生成生产构建。
- `pnpm preview` 在本地预览生产构建；检查渲染性能时优先使用此命令。

目前尚未配置测试框架或 lint 脚本。提交改动前运行 `pnpm build`；涉及视觉或交互的改动还应在浏览器中检查受影响的体验。

## 代码风格

应用代码使用 TypeScript/TSX，明确导入依赖，并遵循所在模块的既有风格。大多数 React 文件使用两个空格缩进、单引号且不加分号。部分还原的 `src/scene/diorama/` 文件保留了上游分号风格；请沿用局部风格，避免无关格式调整。React 组件及组件文件使用 PascalCase，函数、变量和工具函数使用 camelCase。场景专属渲染逻辑应放在 `src/scene/diorama/`，不要混入界面组件。

## 测试与视觉检查

目前没有自动化单元测试或浏览器测试。修改场景、着色器、相机或面板后，运行 `pnpm build`，再通过 `pnpm dev` 或 `pnpm preview` 检查相关视图。若改动可能影响相机或输入行为，也要检查叙事模式和 360° 模式。后续若新增测试，请将其放在相关模块附近，并使用 `*.test.ts` 或 `*.test.tsx` 命名。

## 提交与拉取请求

近期提交使用 `feat:`、`fix:` 等类型前缀，说明文字通常简洁（例如 `fix: 地面灯管修复`）。每个提交应聚焦于一项改动，并说明用户可见的变化。拉取请求应概述行为变化、列出已执行的验证；如有相关问题请附上链接，涉及视觉变化时请提供截图。
