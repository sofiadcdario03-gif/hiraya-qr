import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function BaleteScene({ view, qrTexture, isTransitioning }) {
  const groupRef = useRef();
  const particlesRef = useRef();
  const transitionProgress = useRef(0);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
    if (particlesRef.current && view === 'world') {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }

    // Track transition progress for fading
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
      {/* Main Tree Trunk */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.6, 2.5, 8]} />
        <meshStandardMaterial color="#4a3728" roughness={0.9} />
      </mesh>

      {/* Exposed Roots */}
      {[...Array(6)].map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const radius = 0.6;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              -1,
              Math.sin(angle) * radius,
            ]}
            rotation={[Math.PI / 6, angle, 0]}
          >
            <cylinderGeometry args={[0.1, 0.2, 1, 6]} />
            <meshStandardMaterial color="#3d2e22" roughness={0.9} />
          </mesh>
        );
      })}

      {/* Branches */}
      {[...Array(4)].map((_, i) => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * 0.3,
              1,
              Math.sin(angle) * 0.3,
            ]}
            rotation={[0, angle, Math.PI / 4]}
          >
            <cylinderGeometry args={[0.08, 0.15, 1, 6]} />
            <meshStandardMaterial color="#4a3728" roughness={0.9} />
          </mesh>
        );
      })}

      {/* Leaves */}
      <group ref={particlesRef}>
        {[...Array(30)].map((_, i) => {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI;
          const radius = 0.8 + Math.random() * 0.8;
          return (
            <mesh
              key={i}
              position={[
                radius * Math.sin(phi) * Math.cos(theta),
                1.5 + radius * Math.cos(phi),
                radius * Math.sin(phi) * Math.sin(theta),
              ]}
            >
              <sphereGeometry args={[0.12, 4, 4]} />
              <meshStandardMaterial
                color="#2d5a27"
                roughness={0.8}
                transparent
                opacity={fadeOpacity}
              />
            </mesh>
          );
        })}
      </group>

      {/* Fireflies / Glowing Particles */}
      {fadeOpacity > 0.01 && (
        <group>
          {[...Array(15)].map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 3,
                -0.5 + Math.random() * 2,
                (Math.random() - 0.5) * 3,
              ]}
            >
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshBasicMaterial color="#fbbf24" transparent opacity={fadeOpacity} />
            </mesh>
          ))}
        </group>
      )}

      {/* Stone Platform */}
      <mesh position={[0, -1.4, 0]}>
        <cylinderGeometry args={[1, 1.1, 0.1, 16]} />
        <meshStandardMaterial color="#6b7280" roughness={0.7} />
      </mesh>

      {/* Mushrooms */}
      {[...Array(5)].map((_, i) => {
        const angle = (i / 5) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(angle) * 0.7, -1.3, Math.sin(angle) * 0.7]}>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.03, 0.04, 0.1, 6]} />
              <meshStandardMaterial color="#f5f5dc" />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#dc143c" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
