// @ts-nocheck — pending incremental typing (see docs/source-restore.md)

/*
 * Restored from the bundled diorama (see reference/README.md).
 *
 * Mechanically converted back to source: the original module had the same
 * structure, this file just swaps the `window.__M` namespace wiring for ES
 * module imports/exports. The rendering logic itself is unchanged.
 */

import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Post processing: HDR scene target -> bright pass -> 3-level gaussian bloom
// -> filmic composite with vignette, grain and a soft toon grade.
// ---------------------------------------------------------------------------

const QUAD_VS = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FS = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform float uThreshold;
  uniform float uSoft;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    float k = smoothstep(uThreshold, uThreshold + uSoft, l);
    gl_FragColor = vec4(c * k, 1.0);
  }
`;

const BLUR_FS = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform vec2 uDir;      // texel-sized direction
  void main() {
    vec3 s = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
    s += texture2D(tDiffuse, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
    s += texture2D(tDiffuse, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
    s += texture2D(tDiffuse, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
    s += texture2D(tDiffuse, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(s, 1.0);
  }
`;

const COMPOSITE_FS = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tScene;
  uniform sampler2D tBloom0;
  uniform sampler2D tBloom1;
  uniform sampler2D tBloom2;
  uniform float uBloom;
  uniform float uExposure;
  uniform float uTime;
  uniform vec2 uRes;

  vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  vec3 lin2srgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  void main() {
    vec2 uv = vUv;
    // gentle lens breathing / chromatic separation towards the frame edge
    vec2 d = uv - 0.5;
    float r2 = dot(d, d);
    vec2 off = d * r2 * 0.0022;
    vec3 col;
    col.r = texture2D(tScene, uv + off).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv - off).b;

    vec3 bloom = texture2D(tBloom0, uv).rgb * 0.55
               + texture2D(tBloom1, uv).rgb * 0.32
               + texture2D(tBloom2, uv).rgb * 0.24;
    col += bloom * uBloom;

    col *= uExposure;
    col = aces(col);

    // cool the shadows, warm the highlights — the classic night-anime grade
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col * vec3(0.92, 0.97, 1.08), col * vec3(1.06, 1.005, 0.94), smoothstep(0.18, 0.85, lum));
    // saturation lift
    col = mix(vec3(lum), col, 1.18);

    // vignette
    float vig = smoothstep(1.25, 0.20, r2 * 1.6);
    col *= mix(0.82, 1.0, vig);

    // fine grain so the flats never look dead
    float g = hash(uv * uRes + fract(uTime) * 91.7) - 0.5;
    col += g * 0.018 * (1.0 - lum * 0.6);

    gl_FragColor = vec4(lin2srgb(col), 1.0);
  }
`;

class Pass {
  constructor(material) {
    this.material = material;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  render(renderer, target) {
    renderer.setRenderTarget(target || null);
    renderer.clear(true, false, false);
    renderer.render(this.scene, this.camera);
  }
}

class PostFX {
  constructor(renderer, samples = 4) {
    this.renderer = renderer;
    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false, samples };
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.sceneRT.texture.minFilter = THREE.LinearFilter;
    this.sceneRT.texture.magFilter = THREE.LinearFilter;

    const small = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
    this.brightRT = new THREE.WebGLRenderTarget(1, 1, small);
    this.blurA = [0, 1, 2].map(() => new THREE.WebGLRenderTarget(1, 1, small));
    this.blurB = [0, 1, 2].map(() => new THREE.WebGLRenderTarget(1, 1, small));
    for (const rt of [this.brightRT, ...this.blurA, ...this.blurB]) {
      rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter;
      rt.texture.wrapS = rt.texture.wrapT = THREE.ClampToEdgeWrapping;
    }

    this.brightPass = new Pass(new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: BRIGHT_FS, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: 1.28 }, uSoft: { value: 0.7 } },
    }));
    this.blurPass = new Pass(new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: BLUR_FS, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
    }));
    this.composite = new Pass(new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: COMPOSITE_FS, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: null }, tBloom0: { value: null }, tBloom1: { value: null }, tBloom2: { value: null },
        uBloom: { value: 1.05 }, uExposure: { value: 1.62 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
      },
    }));
    this.setSize(1, 1);
  }

  setSize(w, h) {
    const dpr = this.renderer.getPixelRatio();
    const W = Math.max(1, Math.floor(w * dpr));
    const H = Math.max(1, Math.floor(h * dpr));
    this.sceneRT.setSize(W, H);
    this.brightRT.setSize(Math.max(1, W >> 1), Math.max(1, H >> 1));
    for (let i = 0; i < 3; i++) {
      const s = 2 << (i + 1); // 4, 8, 16
      this.blurA[i].setSize(Math.max(1, Math.floor(W / s)), Math.max(1, Math.floor(H / s)));
      this.blurB[i].setSize(Math.max(1, Math.floor(W / s)), Math.max(1, Math.floor(H / s)));
    }
    this.composite.material.uniforms.uRes.value.set(W, H);
    this.size = [W, H];
  }

  render(scene, camera, time) {
    const r = this.renderer;
    const prevAutoClear = r.autoClear;
    r.autoClear = true;

    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);

    // bright pass
    this.brightPass.material.uniforms.tDiffuse.value = this.sceneRT.texture;
    this.brightPass.render(r, this.brightRT);

    // gaussian chain
    let src = this.brightRT.texture;
    for (let i = 0; i < 3; i++) {
      const a = this.blurA[i], b = this.blurB[i];
      const tw = 1 / a.width, th = 1 / a.height;
      this.blurPass.material.uniforms.tDiffuse.value = src;
      this.blurPass.material.uniforms.uDir.value.set(tw * (1.0 + i * 0.6), 0);
      this.blurPass.render(r, a);
      this.blurPass.material.uniforms.tDiffuse.value = a.texture;
      this.blurPass.material.uniforms.uDir.value.set(0, th * (1.0 + i * 0.6));
      this.blurPass.render(r, b);
      src = b.texture;
    }

    const u = this.composite.material.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tBloom0.value = this.blurB[0].texture;
    u.tBloom1.value = this.blurB[1].texture;
    u.tBloom2.value = this.blurB[2].texture;
    u.uTime.value = time;
    this.composite.render(r, null);
    r.autoClear = prevAutoClear;
  }
}

export { PostFX };
