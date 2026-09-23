import * as THREE from 'three'

/**
 * Toon gradient map: 4 lighting bands (shadow / mid / base / highlight).
 * DataTexture with NearestFilter gives the cel-shaded stepped look.
 */
let gradientMap: THREE.DataTexture | null = null

export function getGradientMap(): THREE.DataTexture {
  if (gradientMap) return gradientMap
  // 4 bands of increasing brightness — tuned for a soft anime look
  const bands = new Uint8Array([70, 128, 200, 255])
  gradientMap = new THREE.DataTexture(bands, bands.length, 1, THREE.RedFormat)
  gradientMap.minFilter = THREE.NearestFilter
  gradientMap.magFilter = THREE.NearestFilter
  gradientMap.generateMipmaps = false
  gradientMap.needsUpdate = true
  return gradientMap
}

/** Shared toon material cache keyed by color+options — keeps draw calls & memory low */
const cache = new Map<string, THREE.MeshToonMaterial>()

export interface ToonOptions {
  emissive?: string
  emissiveIntensity?: number
  transparent?: boolean
  opacity?: number
}

export function toon(color: string, opts: ToonOptions = {}): THREE.MeshToonMaterial {
  const key = `${color}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? 1}|${opts.transparent ? 't' + opts.opacity : ''}`
  let m = cache.get(key)
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color,
      gradientMap: getGradientMap(),
      ...(opts.emissive ? { emissive: new THREE.Color(opts.emissive), emissiveIntensity: opts.emissiveIntensity ?? 1 } : {}),
      ...(opts.transparent ? { transparent: true, opacity: opts.opacity ?? 1 } : {}),
    })
    cache.set(key, m)
  }
  return m
}

/* ------------------------------------------------------------------ */
/* Inverted-hull outline system                                        */
/* ------------------------------------------------------------------ */

export const OUTLINE_COLOR = '#111827'
let outlineMaterial: THREE.MeshBasicMaterial | null = null

function getOutlineMaterial(): THREE.MeshBasicMaterial {
  if (!outlineMaterial) {
    outlineMaterial = new THREE.MeshBasicMaterial({
      color: OUTLINE_COLOR,
      side: THREE.BackSide,
    })
  }
  return outlineMaterial
}

/** Push every vertex of a geometry copy along its normal — true inverted hull */
export function inflateGeometry(src: THREE.BufferGeometry, amount: number): THREE.BufferGeometry {
  const geo = src.clone()
  const pos = geo.attributes.position as THREE.BufferAttribute
  const nor = geo.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + nor.getX(i) * amount,
      pos.getY(i) + nor.getY(i) * amount,
      pos.getZ(i) + nor.getZ(i) * amount,
    )
  }
  pos.needsUpdate = true
  return geo
}

/**
 * Add an inverted-hull outline child to a mesh.
 * Returns a cleanup function removing the outline.
 */
export function attachOutline(mesh: THREE.Mesh, thickness = 0.02): () => void {
  const geo = inflateGeometry(mesh.geometry, thickness)
  const outline = new THREE.Mesh(geo, getOutlineMaterial())
  outline.renderOrder = -1
  outline.raycast = () => {} // outlines never intercept raycasts
  mesh.add(outline)
  return () => {
    mesh.remove(outline)
    geo.dispose()
  }
}

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-random (stable diorama between reloads)        */
/* ------------------------------------------------------------------ */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
