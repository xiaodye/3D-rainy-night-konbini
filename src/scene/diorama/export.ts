/**
 * 场景的 GLB 导出。
 *
 * 导出策略（刻意**不用** `scene.clone(true)`）：
 * `Object3D.clone()` 会通过 `new this.constructor().copy(this)` 重建自定义子类，
 * 而 `WetGround` 的构造函数需要 renderer，会直接崩。所以改为：
 *
 *   1. 临时把材质换成 glTF 能表达的等价物 —— 活动场景用的是 MeshToonMaterial 与自定义
 *      ShaderMaterial，两者 glTF 都存不下；转换会保留颜色 / 贴图 / 自发光，
 *      这样导进 Blender 仍有正常外观
 *   2. 用活动的 children（灯光、已合并的几何、store / props 分组）临时拼一棵导出树
 *      —— reparent 在 `finally` 里还原
 *   3. 湿地面换成一个带贴图的普通平面（它的 ShaderMaterial 无法表达，
 *      但手绘的 albedo 贴图可以）
 *   4. 跳过 GPU 点系统（雨 / 溅落）—— 它们由 shader 驱动，不是 mesh
 */

import * as THREE from 'three'
import { WetGround } from './ground'
import type { DioramaScene } from './index'

type AnyMat = THREE.Material & Record<string, any>

/** 为场景用到的每种材质给出最接近的 glTF 友好材质 */
function convertMaterial(m: AnyMat): THREE.Material {
  if (isGlTFCompatible(m)) return m

  if (m.isShaderMaterial) {
    const u = m.uniforms ?? {}
    const map: THREE.Texture | null = u.tGround?.value ?? u.tWet?.value ?? u.map?.value ?? null
    const tint: THREE.Color | undefined = u.uTint?.value
    return new THREE.MeshStandardMaterial({
      color: tint ? tint.clone() : new THREE.Color(0x8b9ab0),
      map,
      roughness: 0.55,
      metalness: 0.05,
    })
  }

  // MeshToonMaterial → PBR，保留原有的颜色 / 贴图 / 自发光
  return new THREE.MeshStandardMaterial({
    color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
    map: m.map ?? null,
    emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
    emissiveIntensity: m.emissiveIntensity ?? 1,
    emissiveMap: m.emissiveMap ?? null,
    transparent: !!m.transparent,
    opacity: m.opacity ?? 1,
    side: m.side ?? THREE.FrontSide,
  })
}

/* three r160+ 在原型上暴露了 isMeshStandardMaterial / isMeshBasicMaterial /
   isMeshPhysicalMaterial —— 正好是 glTF 无需转换即可存储的那一类 */
function isGlTFCompatible(m: THREE.Material): boolean {
  return (
    (m as any).isMeshStandardMaterial === true ||
    (m as any).isMeshBasicMaterial === true ||
    (m as any).isMeshPhysicalMaterial === true
  )
}

function isPoints(o: THREE.Object3D): boolean {
  return (o as THREE.Points).isPoints === true
}

/**
 * 把场景序列化为二进制 glTF，并触发浏览器下载。
 * 完成后活动场景会被完整还原（材质 + 子树父子关系）。
 */
export async function exportGLB(
  dio: DioramaScene,
  filename = 'rainy-night-konbini.glb',
): Promise<{ bytes: number }> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  const scene = dio.scene

  const materialSwaps: Array<() => void> = []
  const subtreeRestores: Array<() => void> = []
  const exportScene = new THREE.Scene()

  try {
    // 1) 材质 → glTF 友好等价物（在 finally 中还原）
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || !mesh.material) return
      const original = mesh.material
      const originalArray = Array.isArray(original) ? original : [original]
      const converted = originalArray.map((m) => convertMaterial(m as AnyMat))
      materialSwaps.push(() => {
        mesh.material = original as THREE.Material | THREE.Material[]
      })
      mesh.material = (Array.isArray(original) ? converted : converted[0]) as THREE.Material
    })

    // 2) 拼装导出树
    for (const child of [...scene.children]) {
      if (isPoints(child)) continue // 雨 / 溅落：GPU 点系统

      if (child instanceof WetGround) {
        // 活动的湿地面是一个 ShaderMaterial mesh —— 换成一块带贴图的普通平面，
        // 沿用同一张手绘 albedo 画布
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2),
          new THREE.MeshStandardMaterial({
            map: (child.uniforms.tGround?.value as THREE.Texture) ?? null,
            roughness: 0.5,
            metalness: 0.0,
          }),
        )
        plane.position.copy(child.position)
        plane.name = 'wet-ground'
        exportScene.add(plane)
        continue
      }

      // 灯光、已合并几何、store / props 分组 —— 原样导出
      const parent = child.parent as THREE.Object3D
      exportScene.add(child)
      subtreeRestores.push(() => {
        parent.add(child)
      })
    }

    // 3) 导出
    const exporter = new GLTFExporter()
    const result = await exporter.parseAsync(exportScene, { binary: true })

    const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)

    return { bytes: blob.size }
  } finally {
    // 全部还原：children 回到活动场景，材质恢复原样
    for (const restore of subtreeRestores) restore()
    for (const swap of materialSwaps) swap()
  }
}
