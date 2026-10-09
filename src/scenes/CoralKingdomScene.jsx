import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function CoralKingdomScene({ view, qrTexture, isTransitioning }) {
  const groupRef = useRef();
  const bubblesRef = useRef();
  const transitionProgress = useRef(0);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.07) * 0.12;
    }
    if (bubblesRef.current) {
      bubblesRef.current.rotation.y = state.clock.elapsedTime * 0.03;
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
      {/* Coral formations */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 0.6 + Math.random() * 0.8;
        const color = ['#f472b6', '#0891b2', '#fbbf24', '#ec4899'][i % 4];
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * radius, -1.2, Math.sin(angle) * radius]}
          >
            <dodecahedronGeometry args={[0.15 + Math.random() * 0.1, 0]} />
            <meshStandardMaterial color={color} roughness={0.6} transparent opacity={fadeOpacity} />
          </mesh>
        );
      })}

      {/* Coral formations */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 0.6 + Math.random() * 0.8;
        const color = ['#f472b6', '#0891b2', '#fbbf24', '#ec4899'][i % 4];
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * radius, -1.2, Math.sin(angle) * radius]}
          >
            <dodecahedronGeometry args={[0.15 + Math.random() * 0.1, 0]} />
            <meshStandardMaterial color={color} roughness={0.6} transparent opacity={fadeOpacity} />
          </mesh>
        );
      })}

      {/* Sea plants/seaweed */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 1;
        return (
          <group key={i} position={[Math.cos(angle) * radius, -1.3, Math.sin(angle) * radius]}>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.02, 0.03, 0.8, 6]} />
              <meshStandardMaterial color="#10b981" roughness={0.8} transparent opacity={fadeOpacity} />
            </mesh>
            <mesh position={[0, 0.7, 0]}>
              <sphereGeometry args={[0.08, 6, 6]} />
              <meshStandardMaterial color="#34d399" roughness={0.7} transparent opacity={fadeOpacity} />
            </mesh>
          </group>
        );
      })}

      {/* Stylized sea guardian - abstract */}
      <group>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#0891b2" roughness={0.3} />
        </mesh>
        {/* Tentacles/arms */}
        {[...Array(6)].map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 0.2, -0.3, Math.sin(angle) * 0.2]}
              rotation={[Math.PI / 4, angle, 0]}
            >
              <cylinderGeometry args={[0.04, 0.06, 0.4, 6]} />
              <meshStandardMaterial color="#f472b6" roughness={0.5} transparent opacity={fadeOpacity} />
            </mesh>
          );
        })}
      </group>

      {/* Rock structures */}
      {[...Array(4)].map((_, i) => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 1.3, -1.35, Math.sin(angle) * 1.3]}
          >
            <dodecahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color="#6b7280" roughness={0.9} transparent opacity={fadeOpacity} />
          </mesh>
        );
      })}

      {/* Bubbles */}
      {fadeOpacity > 0.01 && (
        <group ref={bubblesRef}>
          {[...Array(20)].map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 3,
                -1 + Math.random() * 2,
                (Math.random() - 0.5) * 3,
              ]}
            >
              <sphereGeometry args={[0.05 + Math.random() * 0.05, 8, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.4 * fadeOpacity} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
