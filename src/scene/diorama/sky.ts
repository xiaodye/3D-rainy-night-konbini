/*
 * 还原自打包产物 diorama（见 docs/source-restore.md）。
 *
 * 机械转换回源码：原模块结构相同，本文件只是把 `window.__M` 命名空间
 * 接线换成 ES module 的 import/export，渲染逻辑本身未改动。
 *
 * TYPED ✓ — 见 docs/source-restore.md。
 */

import * as THREE from 'three'

// ---------------------------------------------------------------------------
// 夜空：深靛蓝渐变，地平线附近带一点微弱的城市暖光。
// 同时充当湿路面的反射背景。
// ---------------------------------------------------------------------------

/** 天空只持有一张贴图；`update()` 是个空实现钩子 */
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
  // 地平线以下：柔和的蓝灰色雾霭，绝不取纯黑 —— 这是镜像相机看到的部分，
  // 于是也成为湿路面的环境光泽
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
