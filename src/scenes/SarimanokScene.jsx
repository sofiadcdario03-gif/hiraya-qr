import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function SarimanokScene({ view, qrTexture, isTransitioning }) {
  const groupRef = useRef();
  const birdRef = useRef();
  const transitionProgress = useRef(0);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.06) * 0.1;
    }
    if (birdRef.current) {
      birdRef.current.position.y = 0.3 + Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
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
      {/* Ornamental Pedestal */}
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[0.8, 1, 0.4, 16]} />
        <meshStandardMaterial color="#16a34a" roughness={0.7} />
      </mesh>

      {/* Ornamental Pedestal */}
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[0.8, 1, 0.4, 16]} />
        <meshStandardMaterial color="#16a34a" roughness={0.7} />
      </mesh>

      {/* Stylized Bird Figure */}
      <group ref={birdRef}>
        {/* Body */}
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshStandardMaterial color="#dc2626" roughness={0.5} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.6, 0.15]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#dc2626" roughness={0.5} />
        </mesh>
        {/* Beak */}
        <mesh position={[0, 0.65, 0.35]} rotation={[0, 0, -Math.PI / 4]}>
          <coneGeometry args={[0.08, 0.2, 8]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.3} />
        </mesh>
        {/* Tail feathers */}
        {[...Array(5)].map((_, i) => {
          const angle = -Math.PI / 2 + (i - 2) * 0.2;
          return (
            <mesh
              key={i}
              position={[0, 0.1, -0.3]}
              rotation={[angle, 0, 0]}
            >
              <coneGeometry args={[0.08, 0.4, 4]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? '#16a34a' : '#2563eb'}
                roughness={0.5}
                transparent
                opacity={fadeOpacity}
              />
            </mesh>
          );
        })}
        {/* Wing feathers */}
        {[...Array(3)].map((_, i) => (
          <mesh
            key={i}
            position={[0.35, 0.3 + i * 0.1, 0]}
            rotation={[0, 0, Math.PI / 3]}
          >
            <coneGeometry args={[0.06, 0.25, 4]} />
            <meshStandardMaterial
              color={i === 0 ? '#fbbf24' : i === 1 ? '#16a34a' : '#2563eb'}
              roughness={0.5}
              transparent
              opacity={fadeOpacity}
            />
          </mesh>
        ))}
      </group>

      {/* Decorative patterns on ground */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 1.2, -1.35, Math.sin(angle) * 1.2]}
          >
            <torusGeometry args={[0.1, 0.02, 8, 16]} />
            <meshStandardMaterial color="#16a34a" roughness={0.7} transparent opacity={fadeOpacity} />
          </mesh>
        );
      })}

      {/* Floating particles */}
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
              <meshBasicMaterial color="#fbbf24" transparent opacity={0.5 * fadeOpacity} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
