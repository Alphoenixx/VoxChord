"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, TorusKnot, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useScrollStore } from "@/stores/useScrollStore";

/* ── Particle cloud vertex shader ── */
const particleVert = `
  uniform float uTime;
  attribute float aScale;
  attribute float aRandom;
  varying float vAlpha;
  varying float vRandom;

  void main() {
    vRandom = aRandom;
    vec3 pos = position;

    // Perlin-like drift
    float t = uTime * 0.15;
    pos.x += sin(t + aRandom * 6.28) * 0.6;
    pos.y += cos(t * 0.7 + aRandom * 3.14) * 0.4;
    pos.z += sin(t * 0.5 + aRandom * 9.42) * 0.3;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    float dist = -mvPos.z;
    gl_PointSize = aScale * (120.0 / dist);

    // Fade based on depth
    vAlpha = smoothstep(30.0, 5.0, dist) * 0.7;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const particleFrag = `
  varying float vAlpha;
  varying float vRandom;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float glow = pow(1.0 - d * 2.0, 3.0);

    // Shift between dark violet and dark cyan per-particle
    vec3 violet = vec3(0.25, 0.15, 0.5);
    vec3 cyan   = vec3(0.01, 0.3, 0.4);
    vec3 col = mix(violet, cyan, vRandom);

    gl_FragColor = vec4(col, glow * vAlpha);
  }
`;

export default function HeroScene() {
  const groupRef = useRef<THREE.Group>(null);
  const knotRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.ShaderMaterial>(null);

  const COUNT = 600;
  const [positions, scales, randoms] = useMemo(() => {
    const p = new Float32Array(COUNT * 3);
    const s = new Float32Array(COUNT);
    const r = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      // Spherical shell distribution
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const radius = 4 + Math.random() * 14;
      p[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = radius * Math.cos(phi);
      s[i] = Math.random() * 2 + 0.5;
      r[i] = Math.random();
    }
    return [p, s, r];
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (matRef.current) matRef.current.uniforms.uTime.value = t;

    if (knotRef.current) {
      knotRef.current.rotation.x = t * 0.08;
      knotRef.current.rotation.y = t * 0.12;
    }

    // Scroll-driven parallax
    const { progress, activeSection } = useScrollStore.getState();
    if (groupRef.current) {
      const yOffset = activeSection === 0 ? progress * -6 : -6;
      groupRef.current.position.y += (yOffset - groupRef.current.position.y) * 0.04;
      groupRef.current.rotation.y += (t * 0.02 - groupRef.current.rotation.y) * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Lighting */}
      <ambientLight intensity={0.05} />
      <pointLight position={[4, 4, 6]} intensity={30} color="#8B5CF6" distance={30} decay={2} />
      <pointLight position={[-4, -2, 4]} intensity={15} color="#06B6D4" distance={25} decay={2} />
      <pointLight position={[0, -4, -3]} intensity={10} color="#4c1d95" distance={20} decay={2} />

      {/* Central glowing torus knot — positioned above & behind text */}
      <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.8}>
        <TorusKnot ref={knotRef} args={[1.2, 0.35, 256, 64]} position={[0, 2.5, -4]} scale={0.9}>
          <MeshTransmissionMaterial
            color="#0f172a"
            resolution={512}
            thickness={1.5}
            roughness={0.2}
            anisotropy={0.1}
            chromaticAberration={0.05}
            transmission={0.9}
            clearcoat={0.1}
          />
        </TorusKnot>
      </Float>

      {/* Particle cloud */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach={"attributes-position" as any} args={[positions, 3]} />
          <bufferAttribute attach={"attributes-aScale" as any}   args={[scales, 1]} />
          <bufferAttribute attach={"attributes-aRandom" as any}  args={[randoms, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={matRef}
          vertexShader={particleVert}
          fragmentShader={particleFrag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
