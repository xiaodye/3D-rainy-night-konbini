/*
 * Restored from the bundled diorama (see reference/README.md).
 *
 * Mechanically converted back to source: the original module had the same
 * structure, this file just swaps the `window.__M` namespace wiring for ES
 * module imports/exports. The rendering logic itself is unchanged.
 *
 * TYPED ✓ — see docs/source-restore.md.
 */

import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Night sky: a deep indigo gradient with a faint warm city glow at the horizon.
// Also supplies the reflection backdrop for the wet street.
// ---------------------------------------------------------------------------

/** the sky owns nothing but a texture; `update()` is a no-op hook */
export interface Sky {
  texture: THREE.CanvasTexture
  update(elapsed?: number, camera?: THREE.Camera): void
}

function buildSky(scene: THREE.Scene): Sky {
  const cv = document.createElement('canvas');
  cv.width = 8;
  cv.height = 512;
  const g = cv.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0.00, '#080c18');
  grd.addColorStop(0.24, '#0c1326');
  grd.addColorStop(0.42, '#131c34');
  grd.addColorStop(0.50, '#1c2542');
  // below the horizon: a soft blue-grey haze, never black — this is what the
  // mirrored camera sees, so it becomes the ambient sheen of the wet street
  grd.addColorStop(0.56, '#222c48');
  grd.addColorStop(0.66, '#26304c');
  grd.addColorStop(0.80, '#222a40');
  grd.addColorStop(1.00, '#1b2233');
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 512);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  scene.background = tex;

  return { texture: tex, update() {} };
}

export { buildSky };
