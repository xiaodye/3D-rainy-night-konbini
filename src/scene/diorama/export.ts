/**
 * GLB export for the diorama scene.
 *
 * Export strategy (deliberately NOT `scene.clone(true)`):
 * `Object3D.clone()` reconstructs custom subclasses via `new this.constructor().copy(this)`,
 * which crashes on `WetGround` (its constructor requires the renderer). Instead we
 *
 *   1. temporarily swap materials for glTF-friendly equivalents — the live scene uses
 *      MeshToonMaterial and custom ShaderMaterials, none of which glTF can store;
 *      conversion keeps colour / maps / emissive so the model still reads in Blender
 *   2. assemble a temporary export tree from the live children (lights, merged geometry,
 *      store / props groups) — reparenting is undone in `finally`
 *   3. swap the wet ground for a plain textured plane (its ShaderMaterial is not
 *      representable; the painted albedo map is)
 *   4. skip GPU point systems (rain / splashes) — they are shader-driven, not meshes
 */

import * as THREE from 'three'
import { WetGround } from './ground'
import type { DioramaScene } from './index'

type AnyMat = THREE.Material & Record<string, any>

/** nearest glTF-friendly material for everything the scene uses */
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

  // MeshToonMaterial → PBR, keeping the authored colour / texture / emissive
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

/* three r160+ exposes isMeshStandardMaterial / isMeshBasicMaterial / isMeshPhysicalMaterial
   on the prototypes — exactly the set glTF can store without conversion */
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
 * Serialise the scene to a binary glTF and trigger a browser download.
 * The live scene is fully restored afterwards (materials + subtree parenting).
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
    // 1) materials → glTF-friendly equivalents (restored in finally)
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

    // 2) assemble the export tree
    for (const child of [...scene.children]) {
      if (isPoints(child)) continue // rain / splashes: GPU point systems

      if (child instanceof WetGround) {
        // the live wet ground is a ShaderMaterial mesh — swap for a plain
        // textured plane carrying the same painted albedo canvas
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

      // lights, merged geometry, store / props groups — exported as-is
      const parent = child.parent as THREE.Object3D
      exportScene.add(child)
      subtreeRestores.push(() => {
        parent.add(child)
      })
    }

    // 3) export
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
    // undo everything: children back to the live scene, original materials back
    for (const restore of subtreeRestores) restore()
    for (const swap of materialSwaps) swap()
  }
}
