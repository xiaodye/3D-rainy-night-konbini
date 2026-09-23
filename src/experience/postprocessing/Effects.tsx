import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, DepthOfField, Vignette, SMAA } from "@react-three/postprocessing";
import { useExperience } from "../../state/store";

/**
 * Post-processing, kept restrained:
 *  - Bloom: only the sign / vending machine / interior light cross the
 *    luminance threshold — never the whole frame
 *  - DOF: focus locked on the store; bokeh strength peaks in Scene 03
 *  - Vignette: gentle cinema frame
 *  - SMAA: antialiasing (MSAA is off for the composer)
 *  - Mobile: no DOF, lighter bloom
 */
export default function Effects() {
  const isMobile = useExperience((s) => s.isMobile);
  const dofRef = useRef<any>(null);

  const dofTarget = useRef(new THREE.Vector3(-1.25, 1.2, -1.8));

  useFrame(() => {
    if (dofRef.current) {
      const p = useExperience.getState().scrollProgress;
      // Scene 03 centers around p ≈ 0.5
      const s3 = Math.max(0, 1 - Math.abs(p - 0.5) * 3.2);
      dofRef.current.bokehScale = 1.0 + s3 * 1.2;
    }
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur intensity={isMobile ? 0.42 : 0.55} luminanceThreshold={0.72} luminanceSmoothing={0.32} />
      {/* EffectComposer filters null children at runtime; cast keeps TS happy */}
      {(isMobile ? null : (
        <DepthOfField ref={dofRef} target={dofTarget.current} focalLength={0.4} bokehScale={1.2} />
      )) as unknown as JSX.Element}
      <Vignette offset={0.26} darkness={0.58} />
      <SMAA />
    </EffectComposer>
  );
}
