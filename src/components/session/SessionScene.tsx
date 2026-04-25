"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAudioStore } from "@/stores/useAudioStore";

// Reduced particle count + lower base alpha for better glanceability
const vertexShader = `
  uniform float uTime;
  uniform float uRMS;

  attribute float aScale;
  attribute float aRandom;

  varying float vAlpha;
  varying float vRandom;

  void main() {
    vRandom = aRandom;
    vec3 pos = position;

    float t = uTime * 0.15;
    pos.x += sin(t + aRandom * 6.28) * (0.2 + uRMS * 2.0);
    pos.y += cos(t * 0.7 + aRandom * 3.14) * (0.15 + uRMS * 1.5);
    pos.z += sin(t * 0.4 + aRandom * 9.42) * 0.15;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    float depth = -mvPos.z;
    gl_PointSize = aScale * (1.0 + uRMS * 4.0) * (180.0 / depth);

    // Lower base alpha so particles don't compete with chord text
    vAlpha = smoothstep(28.0, 4.0, depth) * (0.25 + uRMS * 1.2);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float glow = pow(1.0 - d * 2.0, 3.5);
    gl_FragColor = vec4(uColor, glow * vAlpha * 0.45);
  }
`;

export default function SessionScene() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const COUNT  = 400; // reduced from 800

  const [positions, scales, randoms] = useMemo(() => {
    const p = new Float32Array(COUNT * 3);
    const s = new Float32Array(COUNT);
    const r = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const theta  = Math.random() * Math.PI * 2;
      const phi    = Math.acos(2 * Math.random() - 1);
      const radius = 3 + Math.random() * 14;
      p[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = radius * Math.cos(phi) - 3;
      s[i] = Math.random() * 1.8 + 0.3;
      r[i] = Math.random();
    }
    return [p, s, r];
  }, []);

  const uniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uRMS:   { value: 0 },
    uColor: { value: new THREE.Color("#4c1d95") }, // darker default — less intrusive
  }), []);

  useFrame((state) => {
    if (!matRef.current) return;
    const { confidence, pitchClass, voiced } = useAudioStore.getState();

    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;

    const targetRMS = voiced ? Math.min(confidence, 1.0) * 0.35 : 0;
    matRef.current.uniforms.uRMS.value +=
      (targetRMS - matRef.current.uniforms.uRMS.value) * 0.06;

    if (voiced && pitchClass >= 0) {
      const hue    = pitchClass / 12;
      const target = new THREE.Color().setHSL(hue, 0.6, 0.4); // lower lightness
      matRef.current.uniforms.uColor.value.lerp(target, 0.03);
    } else {
      matRef.current.uniforms.uColor.value.lerp(new THREE.Color("#0f0a1e"), 0.015);
    }
  });

  return (
    <>
      <ambientLight intensity={0.04} />
      <points>
        <bufferGeometry>
          <bufferAttribute attach={"attributes-position" as any} args={[positions, 3]} />
          <bufferAttribute attach={"attributes-aScale" as any}   args={[scales, 1]} />
          <bufferAttribute attach={"attributes-aRandom" as any}  args={[randoms, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={matRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}
