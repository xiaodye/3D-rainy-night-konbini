// @ts-nocheck — pending incremental typing (see docs/source-restore.md)

/*
 * Restored from the bundled diorama (see reference/README.md).
 *
 * Mechanically converted back to source: the original module had the same
 * structure, this file just swaps the `window.__M` namespace wiring for ES
 * module imports/exports. The rendering logic itself is unchanged.
 */

import * as THREE from 'three'

import { OUTLINE } from './config'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ---------------------------------------------------------------------------
// Toon material system + geometry builder with automatic merging and
// inverted-hull outlines (one draw call per material bucket).
// ---------------------------------------------------------------------------

// --- gradient ramp -----------------------------------------------------------
const _ramps = new Map();
function gradientMap(steps = 4) {
  if (_ramps.has(steps)) return _ramps.get(steps);
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    // ease the toe so shadows stay readable, keep a bright shoulder
    const v = Math.round(255 * Math.pow(t, 0.82) * (0.82 + 0.18 * t) + 26);
    const o = i * 4;
    data[o] = data[o + 1] = data[o + 2] = Math.min(255, v);
    data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  _ramps.set(steps, tex);
  return tex;
}

// --- material cache ----------------------------------------------------------
const _matCache = new Map();
function cache(key, make) {
  let m = _matCache.get(key);
  if (!m) { m = make(); _matCache.set(key, m); }
  return m;
}

/** Cel-shaded surface. */
function toon(color, opts = {}) {
  const {
    emissive = 0x000000, emissiveIntensity = 1, flat = false, side = THREE.FrontSide,
    opacity = 1, transparent = false, map = null, depthWrite = true, ramp = 4,
    vertexColors = false, fog = true,
  } = opts;
  const key = `T|${color}|${emissive}|${emissiveIntensity}|${flat}|${side}|${opacity}|${transparent}|${map ? map.uuid : 0}|${ramp}|${vertexColors}|${fog}`;
  return cache(key, () => {
    const m = new THREE.MeshToonMaterial({
      color, gradientMap: gradientMap(ramp), side, opacity, transparent, depthWrite,
      vertexColors, fog, flatShading: !!flat,
    });
    if (map) m.map = map;
    if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emissiveIntensity; }
    return m;
  });
}

/** Unlit / self-illuminated surface. intensity > 1 goes HDR for the bloom pass. */
function glow(color, intensity = 1, opts = {}) {
  const { side = THREE.FrontSide, opacity = 1, transparent = false, map = null, fog = false, depthWrite = true } = opts;
  const key = `G|${color}|${intensity}|${side}|${opacity}|${transparent}|${map ? map.uuid : 0}|${fog}|${depthWrite}`;
  return cache(key, () => {
    const col = new THREE.Color(color).multiplyScalar(intensity);
    const m = new THREE.MeshBasicMaterial({ color: col, side, opacity, transparent, fog, depthWrite, toneMapped: false });
    if (map) m.map = map;
    return m;
  });
}

/** Additive glow card (light halos, light shafts, wet streaks). */
function additive(color, intensity = 1, opts = {}) {
  const { map = null, opacity = 1, depthWrite = false } = opts;
  const key = `A|${color}|${intensity}|${map ? map.uuid : 0}|${opacity}|${depthWrite}`;
  return cache(key, () => {
    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity), map, transparent: true,
      opacity, blending: THREE.AdditiveBlending, depthWrite, fog: false, toneMapped: false,
      side: THREE.DoubleSide,
    });
    return m;
  });
}

// --- radial glow sprite ------------------------------------------------------
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.28, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  _glowTex = new THREE.CanvasTexture(cv);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

// --- outline shell -----------------------------------------------------------
const OUTLINE_MAT = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(OUTLINE.color) }, uPx: { value: OUTLINE.px } },
  vertexShader: /* glsl */`
    attribute float aOutline;
    uniform float uPx;
    varying float vA;
    void main() {
      vA = aOutline;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      float dist = max(-mv.z, 0.5);
      mv.xyz += n * aOutline * uPx * dist * 0.00062;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColor;
    varying float vA;
    void main() {
      if (vA < 0.01) discard;
      gl_FragColor = vec4(uColor, 1.0);
    }`,
  side: THREE.BackSide,
  fog: false,
});

// --- geometry normalisation --------------------------------------------------
function prep(geo, outline) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g === geo) g = geo.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  const n = g.attributes.position.count;
  const a = new Float32Array(n).fill(outline);
  g.setAttribute('aOutline', new THREE.BufferAttribute(a, 1));
  return g;
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

function xform(pos, rot, scale) {
  _v.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0);
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
  _q.setFromEuler(_e);
  _s.set(scale ? scale[0] : 1, scale ? scale[1] : 1, scale ? scale[2] : 1);
  return _m4.compose(_v, _q, _s);
}

// ---------------------------------------------------------------------------
// Builder: author freely, merge at the end.
// ---------------------------------------------------------------------------
class Builder {
  constructor() {
    this.root = new THREE.Group();
    this.buckets = new Map(); // material -> [geometry]
    this.count = 0;
    this.tris = 0;
    this._geoCache = new Map();
  }

  _geo(key, make) {
    let g = this._geoCache.get(key);
    if (!g) { g = make(); this._geoCache.set(key, g); }
    return g;
  }

  boxGeo(w, h, d) {
    return this._geo(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
  }
  cylGeo(rt, rb, h, seg = 10, open = false) {
    return this._geo(`c${rt}_${rb}_${h}_${seg}_${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
  }
  planeGeo(w, h, sw = 1, sh = 1) {
    return this._geo(`p${w}_${h}_${sw}_${sh}`, () => new THREE.PlaneGeometry(w, h, sw, sh));
  }
  sphereGeo(r, seg = 12) {
    return this._geo(`s${r}_${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1)));
  }
  torusGeo(r, t, seg = 12, rings = 8) {
    return this._geo(`t${r}_${t}_${seg}_${rings}`, () => new THREE.TorusGeometry(r, t, rings, seg));
  }
  capsuleGeo(r, len, seg = 10) {
    return this._geo(`k${r}_${len}_${seg}`, () => new THREE.CapsuleGeometry(r, len, 4, seg));
  }

  /**
   * Add geometry. opts: { pos, rot, scale, outline, dynamic, parent, name }
   * outline: multiplier for the hull width (0 = no outline).
   */
  add(geo, mat, opts = {}) {
    const { pos, rot, scale, outline = 1, dynamic = false, parent = null, name = '' } = opts;
    this.count++;
    this.tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;

    if (dynamic) {
      const mesh = new THREE.Mesh(geo, mat);
      if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
      if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
      if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
      if (name) mesh.name = name;
      (parent || this.root).add(mesh);
      return mesh;
    }

    const g = prep(geo, outline);
    g.applyMatrix4(xform(pos, rot, scale));
    let arr = this.buckets.get(mat);
    if (!arr) { arr = []; this.buckets.set(mat, arr); }
    arr.push(g);
    return null;
  }

  box(w, h, d, mat, opts) { return this.add(this.boxGeo(w, h, d), mat, opts); }
  cyl(rt, rb, h, seg, mat, opts) { return this.add(this.cylGeo(rt, rb, h, seg), mat, opts); }
  /** Vertical plane, normal facing +z by default. */
  plane(w, h, mat, opts) { return this.add(this.planeGeo(w, h), mat, opts); }
  /** Horizontal plane (facing up). */
  plate(w, d, mat, opts = {}) {
    const rot = opts.rot ? opts.rot.slice() : [0, 0, 0];
    const o = { ...opts, rot: [rot[0] - Math.PI / 2, rot[1], rot[2]] };
    return this.add(this.planeGeo(w, d), mat, o);
  }
  sphere(r, seg, mat, opts) { return this.add(this.sphereGeo(r, seg), mat, opts); }

  /** Merge every static bucket into one mesh per material, then build outline shells. */
  finalize({ outlineMeshes = true } = {}) {
    let buckets = 0;
    for (const [mat, geos] of this.buckets) {
      if (!geos.length) continue;
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) { console.warn('merge failed for material', mat.type); continue; }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.frustumCulled = false;
      this.root.add(mesh);
      buckets++;
      if (outlineMeshes) {
        const shell = new THREE.Mesh(merged, OUTLINE_MAT);
        shell.frustumCulled = false;
        shell.renderOrder = -1;
        this.root.add(shell);
      }
      if (geos.length > 1) geos.forEach((g) => g.dispose && g.dispose());
    }
    this.buckets.clear();
    this._geoCache.clear();
    return { buckets, meshes: this.count, tris: Math.round(this.tris) };
  }
}

/** Convenience: build a small static group and return it merged. */
function mergeGroup(group) {
  const out = new THREE.Group();
  return out;
}

export { gradientMap, toon, glow, additive, glowTexture, OUTLINE_MAT, Builder, mergeGroup };
