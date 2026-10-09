import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function MariaMakilingScene({ view, qrTexture, isTransitioning }) {
  const groupRef = useRef();
  const mistRef = useRef();
  const transitionProgress = useRef(0);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.04) * 0.05;
    }
    if (mistRef.current) {
      mistRef.current.rotation.y = state.clock.elapsedTime * 0.02;
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
      {/* Mountain silhouettes - layered */}
      {[...Array(3)].map((_, i) => (
        <mesh
          key={i}
          position={[0, -1.2 + i * 0.2, -1.5 + i * 0.3]}
          rotation={[0, 0, 0]}
        >
          <coneGeometry args={[1.2 - i * 0.2, 1 - i * 0.2, 4]} />
          <meshStandardMaterial
            color={`rgba(30, 58, 95, ${0.6 + i * 0.2})`}
            roughness={0.9}
            transparent
            opacity={fadeOpacity}
          />
        </mesh>
      ))}

      {/* Mountain silhouettes - layered */}
      {[...Array(3)].map((_, i) => (
        <mesh
          key={i}
          position={[0, -1.2 + i * 0.2, -1.5 + i * 0.3]}
          rotation={[0, 0, 0]}
        >
          <coneGeometry args={[1.2 - i * 0.2, 1 - i * 0.2, 4]} />
          <meshStandardMaterial
            color={`rgba(30, 58, 95, ${0.6 + i * 0.2})`}
            roughness={0.9}
            transparent
            opacity={fadeOpacity}
          />
        </mesh>
      ))}

      {/* Forest trees */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 0.8 + Math.random() * 0.5;
        return (
          <group key={i} position={[Math.cos(angle) * radius, -1.3, Math.sin(angle) * radius]}>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.04, 0.06, 0.8, 6]} />
              <meshStandardMaterial color="#4a3728" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.7, 0]}>
              <coneGeometry args={[0.2, 0.5, 6]} />
              <meshStandardMaterial color="#2d5a27" roughness={0.8} transparent opacity={fadeOpacity} />
            </mesh>
          </group>
        );
      })}

      {/* Waterfall */}
      <mesh position={[0.5, -1.3, -0.5]} rotation={[0, 0, -0.3]}>
        <planeGeometry args={[0.2, 0.8]} />
        <meshStandardMaterial color="#60a5fa" roughness={0.3} transparent opacity={fadeOpacity} />
      </mesh>

      {/* River */}
      <mesh position={[0, -1.38, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.4, 1.2]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.4} transparent opacity={fadeOpacity} />
      </mesh>

      {/* Mist/clouds */}
      {fadeOpacity > 0.01 && (
        <group ref={mistRef}>
          {[...Array(10)].map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 3,
                0.5 + Math.random() * 1,
                (Math.random() - 0.5) * 3,
              ]}
            >
              <sphereGeometry args={[0.2 + Math.random() * 0.2, 8, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.3 * fadeOpacity} />
            </mesh>
          ))}
        </group>
      )}

      {/* Glowing particles */}
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
