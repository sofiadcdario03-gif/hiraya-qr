import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function BahayKuboScene({ view, qrTexture, isTransitioning }) {
  const groupRef = useRef();
  const transitionProgress = useRef(0);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.08;
    }

    if (isTransitioning) {
      transitionProgress.current = Math.min(transitionProgress.current + 0.02, 1);
    } else {
      transitionProgress.current = 0;
    }
  });

  const fadeOpacity = view === 'qr' ? 1 - easeInOutCubic(transitionProgress.current) : 1;
  const qrOpacity = view === 'qr' ? easeInOutCubic(transitionProgress.current) : 0;

  return (
    <group ref={groupRef}>
      {/* Bahay Kubo - Main structure */}
      <group>
        {/* Floor */}
        <mesh position={[0, -1.3, 0]}>
          <cylinderGeometry args={[0.8, 0.8, 0.1, 8]} />
          <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
        </mesh>

        {/* Pillars */}
        {[...Array(4)].map((_, i) => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 0.6, -0.5, Math.sin(angle) * 0.6]}
            >
              <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
              <meshStandardMaterial color="#a0522d" roughness={0.9} />
            </mesh>
          );
        })}

        {/* Thatched roof */}
        <mesh position={[0, 0.2, 0]}>
          <coneGeometry args={[1, 0.8, 8]} />
          <meshStandardMaterial color="#daa520" roughness={0.8} transparent opacity={fadeOpacity} />
        </mesh>
      </group>

      {/* Banana plants */}
      {[...Array(4)].map((_, i) => {
        const angle = (i / 4) * Math.PI * 2;
        const radius = 1.2;
        return (
          <group key={i} position={[Math.cos(angle) * radius, -1.3, Math.sin(angle) * radius]}>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.04, 0.06, 0.6, 6]} />
              <meshStandardMaterial color="#228b22" roughness={0.8} transparent opacity={fadeOpacity} />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <coneGeometry args={[0.15, 0.4, 6]} />
              <meshStandardMaterial color="#32cd32" roughness={0.8} transparent opacity={fadeOpacity} />
            </mesh>
          </group>
        );
      })}

      {/* Rice terraces - small platforms */}
      {[...Array(3)].map((_, i) => (
        <mesh
          key={i}
          position={[0, -1.4 - i * 0.15, 0.8 + i * 0.3]}
          rotation={[-0.1, 0, 0]}
        >
          <boxGeometry args={[0.6, 0.05, 0.2]} />
          <meshStandardMaterial color="#c97c5d" roughness={0.9} transparent opacity={fadeOpacity} />
        </mesh>
      ))}

      {/* Small pathway */}
      <mesh position={[0, -1.35, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.3, 0.8]} />
        <meshStandardMaterial color="#8b4513" roughness={0.9} transparent opacity={fadeOpacity} />
      </mesh>

      {/* Floating leaves */}
      {fadeOpacity > 0.01 && (
        <group>
          {[...Array(12)].map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 3,
                -0.5 + Math.random() * 1.5,
                (Math.random() - 0.5) * 3,
              ]}
            >
              <sphereGeometry args={[0.05, 4, 4]} />
              <meshBasicMaterial color="#228b22" transparent opacity={0.6 * fadeOpacity} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
