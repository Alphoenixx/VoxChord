"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, TorusKnot, MeshTransmissionMaterial, Icosahedron } from "@react-three/drei";
import * as THREE from "three";
import { useScrollStore } from "@/stores/useScrollStore";

/* ── Advanced particle cloud vertex shader with morphing ── */
const particleVert = `
  uniform float uTime;
  attribute float aScale;
  attribute float aRandom;
  attribute float aPhase;
  varying float vAlpha;
  varying float vRandom;

  void main() {
    vRandom = aRandom;
    vec3 pos = position;

    // Morphing wave patterns
    float t = uTime * 0.15;
    float phase = aPhase;
    
    // Multiple sine/cosine layers for complex motion
    pos.x += sin(t + aRandom * 6.28 + phase) * 0.8;
    pos.y += cos(t * 0.7 + aRandom * 3.14 + phase * 0.5) * 0.6;
    pos.z += sin(t * 0.5 + aRandom * 9.42 + phase * 0.3) * 0.5;
    
    // Breathing effect
    float breathing = sin(t * 0.3) * 0.1 + 0.1;
    pos *= 1.0 + breathing;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    float dist = -mvPos.z;
    gl_PointSize = aScale * (120.0 / dist) * (1.0 + breathing * 0.5);

    // Depth fade with smoother transition
    vAlpha = smoothstep(35.0, 3.0, dist) * 0.8;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const particleFrag = `
  varying float vAlpha;
  varying float vRandom;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float d = length(coord);
    if (d > 0.5) discard;
    
    // Multi-ring glow
    float innerGlow = exp(-d * d * 4.0) * 0.6;
    float outerGlow = pow(1.0 - d * 2.0, 2.0) * 0.3;
    float glow = innerGlow + outerGlow;

    // Color shifting between purple and cyan with intermediate hues
    vec3 violet = vec3(0.35, 0.2, 0.7);
    vec3 magenta = vec3(0.6, 0.1, 0.6);
    vec3 cyan = vec3(0.0, 0.4, 0.6);
    
    vec3 col = mix(violet, magenta, sin(vRandom * 3.14) * 0.5 + 0.5);
    col = mix(col, cyan, vRandom);

    gl_FragColor = vec4(col, glow * vAlpha);
  }
`;

export default function EnhancedHeroScene() {
  const groupRef = useRef<THREE.Group>(null);
  const knotRef = useRef<THREE.Mesh>(null);
  const spheresRef = useRef<THREE.Mesh[]>([]);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const COUNT = 1200; // More particles for denser cloud
  const [positions, scales, randoms, phases] = useMemo(() => {
    const p = new Float32Array(COUNT * 3);
    const s = new Float32Array(COUNT);
    const r = new Float32Array(COUNT);
    const ph = new Float32Array(COUNT);
    
    for (let i = 0; i < COUNT; i++) {
      // Spherical shell with multiple layers
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 2 + Math.random() * 16; // More varied radii
      
      p[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = radius * Math.cos(phi);
      
      s[i] = Math.random() * 2.5 + 0.3;
      r[i] = Math.random();
      ph[i] = Math.random() * Math.PI * 2;
    }
    return [p, s, r, ph];
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (matRef.current) matRef.current.uniforms.uTime.value = t;

    // Rotating knot with precession
    if (knotRef.current) {
      knotRef.current.rotation.x = t * 0.08 + Math.sin(t * 0.05) * 0.3;
      knotRef.current.rotation.y = t * 0.12 + Math.cos(t * 0.07) * 0.4;
      knotRef.current.rotation.z = Math.sin(t * 0.03) * 0.2;
    }

    // Orbiting spheres
    spheresRef.current.forEach((sphere, i) => {
      if (!sphere) return;
      const angle = (t * 0.5) + (i / 3) * (Math.PI * 2 / 3);
      const radius = 4.5;
      sphere.position.x = Math.cos(angle) * radius;
      sphere.position.y = Math.sin(angle * 0.7) * 2;
      sphere.position.z = Math.sin(angle) * radius;
      sphere.scale.set(1 + Math.sin(t + i) * 0.2, 1 + Math.sin(t + i) * 0.2, 1 + Math.sin(t + i) * 0.2);
    });

    // Scroll-driven parallax
    const { progress, activeSection } = useScrollStore.getState();
    if (groupRef.current) {
      const yOffset = activeSection === 0 ? progress * -8 : -8;
      groupRef.current.position.y += (yOffset - groupRef.current.position.y) * 0.05;
      groupRef.current.rotation.y += (t * 0.015 - groupRef.current.rotation.y) * 0.02;
      groupRef.current.rotation.x += (progress * 0.3 - groupRef.current.rotation.x) * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Tri-color point light rig for cinematic mood */}
      <ambientLight intensity={0.08} />
      <pointLight position={[6, 5, 8]} intensity={35} color="#9D4EDD" distance={40} decay={2} />
      <pointLight position={[-6, -3, 5]} intensity={20} color="#00D9FF" distance={35} decay={2} />
      <pointLight position={[0, -6, -5]} intensity={15} color="#5A189A" distance={30} decay={2} />
      <pointLight position={[4, 0, -4]} intensity={12} color="#FF006E" distance={25} decay={2} />

      {/* Central glowing torus knot */}
      <Float speed={1.4} rotationIntensity={0.4} floatIntensity={1.0}>
        <TorusKnot ref={knotRef} args={[1.4, 0.38, 256, 64]} position={[0, 2.8, -5]} scale={1.0}>
          <MeshTransmissionMaterial
            color="#0a0e27"
            resolution={512}
            thickness={1.8}
            roughness={0.15}
            anisotropy={0.2}
            chromaticAberration={0.08}
            transmission={0.95}
            clearcoat={0.15}
            ior={1.4}
          />
        </TorusKnot>
      </Float>

      {/* Orbiting accent spheres */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={`orbit-${i}`}
          ref={(mesh) => {
            if (mesh) spheresRef.current[i] = mesh;
          }}
          position={[0, 0, 0]}
        >
          <Icosahedron args={[0.3, 4]} />
          <meshStandardMaterial
            emissive={i === 0 ? "#9D4EDD" : i === 1 ? "#00D9FF" : "#FF006E"}
            emissiveIntensity={0.8}
            metalness={0.8}
            roughness={0.1}
          />
        </mesh>
      ))}

      {/* Particle cloud */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
          <bufferAttribute attach="attributes-aRandom" args={[randoms, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
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
