
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const GRID = 25;
const TILE = 0.118;
const HALF = (GRID * TILE) / 2;
const ROOT_Y = -0.45;

const H_BASE = 0.022;
const H_DARK = 0.072;
const H_FINDER = 0.095;

const materialCache = new Map();

function mat(color, roughness = 0.8, extra = {}) {
  const key = `${color}|${roughness}|${JSON.stringify(extra)}`;

  if (!materialCache.has(key)) {
    materialCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        ...extra,
      })
    );
  }

  return materialCache.get(key);
}

function rng(seed) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function blendHex(a, b, amount) {
  const aa = parseInt(a.replace("#", ""), 16);
  const bb = parseInt(b.replace("#", ""), 16);

  const channel = (shift) => {
    const start = (aa >> shift) & 255;
    const end = (bb >> shift) & 255;

    return Math.round(start + (end - start) * amount);
  };

  return `#${((channel(16) << 16) |
    (channel(8) << 8) |
    channel(0))
    .toString(16)
    .padStart(6, "0")}`;
}

function lighten(color, amount) {
  return blendHex(color, "#ffffff", amount);
}

function darken(color, amount) {
  return blendHex(color, "#000000", amount);
}

function resolveColors(theme = {}) {
  const red = theme.primary || "#c92636";
  const gold = theme.accent || "#f8c84e";
  const green = theme.secondary || "#167747";
  const light = theme.light || "#fff1ce";

  return {
    red,
    redDark: darken(red, 0.35),
    redLight: lighten(red, 0.25),
    gold,
    goldLight: lighten(gold, 0.28),
    green,
    greenDark: darken(green, 0.28),
    greenLight: lighten(green, 0.22),
    light,
    white: "#fffdf4",
    base: lighten(light, 0.06),
    soil: darken(red, 0.43),
    soilLight: darken(red, 0.28),
    wood: "#8a5632",
    woodLight: "#c58c4b",
    glow: "#ffe7a0",
  };
}

function Box({ pos, size, color, rotation = [0, 0, 0], shadow = true }) {
  return (
    <mesh
      position={pos}
      scale={size}
      rotation={rotation}
      material={mat(color)}
      castShadow={shadow}
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}

function Sphere({ pos, radius, color, emissive = false }) {
  return (
    <mesh position={pos} castShadow>
      <sphereGeometry args={[radius, 12, 10]} />
      {emissive ? (
        <meshBasicMaterial color={color} toneMapped={false} />
      ) : (
        <meshStandardMaterial color={color} roughness={0.45} />
      )}
    </mesh>
  );
}

// A cylinder whose endpoints meet exactly.
function Rod({ start, end, radius, color, radialSegments = 8 }) {
  const geometry = useMemo(() => {
    const direction = new THREE.Vector3()
      .subVectors(new THREE.Vector3(...end), new THREE.Vector3(...start));

    const length = direction.length();
    const midpoint = new THREE.Vector3(...start)
      .add(new THREE.Vector3(...end))
      .multiplyScalar(0.5);

    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    );

    return { length, midpoint, quaternion };
  }, [start, end]);

  return (
    <mesh
      position={geometry.midpoint}
      quaternion={geometry.quaternion}
      castShadow
      material={mat(color, 0.58)}
    >
      <cylinderGeometry
        args={[radius, radius, geometry.length, radialSegments]}
      />
    </mesh>
  );
}

function Glow({ pos, color, size = 0.025 }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse =
        0.9 + Math.sin(clock.elapsedTime * 2.5 + pos[0] * 4) * 0.1;

      ref.current.scale.setScalar(pulse);
    }
  });

  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────
// QR MATRIX
// ─────────────────────────────────────────────────────────────

function inFinder(x, z, ox, oz) {
  return x >= ox && x < ox + 7 && z >= oz && z < oz + 7;
}

function finderBit(x, z, ox, oz) {
  const dx = x - ox;
  const dz = z - oz;
  const edge = Math.min(dx, dz, 6 - dx, 6 - dz);

  if (edge === 0) return true;
  if (edge === 1) return false;

  return true;
}

function isFinderZone(x, z) {
  return (
    inFinder(x, z, 0, 0) ||
    inFinder(x, z, GRID - 7, 0) ||
    inFinder(x, z, 0, GRID - 7)
  );
}

function buildMatrix() {
  const random = rng(7821);
  const matrix = Array.from({ length: GRID }, () =>
    Array(GRID).fill(false)
  );

  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (isFinderZone(x, z)) continue;

      if (z === 6 || x === 6) {
        matrix[z][x] = (x + z) % 2 === 0;
        continue;
      }

      const pattern = (x * 7 + z * 11 + x * z * 3) % 13;
      matrix[z][x] = pattern < 6 ? random() > 0.22 : random() > 0.73;
    }
  }

  for (const [ox, oz] of [
    [0, 0],
    [GRID - 7, 0],
    [0, GRID - 7],
  ]) {
    for (let z = oz; z < oz + 7; z++) {
      for (let x = ox; x < ox + 7; x++) {
        matrix[z][x] = finderBit(x, z, ox, oz);
      }
    }
  }

  return matrix;
}

// ─────────────────────────────────────────────────────────────
// QR GROUND
// ─────────────────────────────────────────────────────────────

function QRGround({ matrix, C }) {
  const tiles = useMemo(() => {
    const output = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const finder = isFinderZone(x, z);
        const timing = (x === 6 || z === 6) && !finder;
        const dark = matrix[z][x];

        let height = H_BASE;
        let color = C.base;

        if (finder) {
          height = dark ? H_FINDER : H_BASE;
          color = dark ? C.red : C.base;
        } else if (timing && dark) {
          height = 0.055;
          color = C.redDark;
        } else if (dark) {
          height = H_DARK;
          color = (x + z) % 4 === 0 ? C.redDark : C.red;
        }

        output.push({
          x: (x - (GRID - 1) / 2) * TILE,
          z: (z - (GRID - 1) / 2) * TILE,
          height,
          color,
          size: finder ? 0.96 : 0.9,
        });
      }
    }

    return output;
  }, [matrix, C]);

  return (
    <group>
      <Box
        pos={[0, -0.06, 0]}
        size={[GRID * TILE + 0.12, 0.12, GRID * TILE + 0.12]}
        color={C.base}
        shadow={false}
      />

      {tiles.map((tile, index) => (
        <Box
          key={index}
          pos={[tile.x, tile.height / 2, tile.z]}
          size={[
            TILE * tile.size,
            tile.height,
            TILE * tile.size,
          ]}
          color={tile.color}
          shadow={false}
        />
      ))}

      <Box
        pos={[0, -0.15, 0]}
        size={[GRID * TILE + 0.18, 0.1, GRID * TILE + 0.18]}
        color={C.soilLight}
      />

      <Box
        pos={[0, -0.24, 0]}
        size={[GRID * TILE + 0.12, 0.1, GRID * TILE + 0.12]}
        color={C.soil}
      />

      {[
        [-HALF - 0.05, -0.08, 0, [0.09, 0.08, GRID * TILE]],
        [HALF + 0.05, -0.08, 0, [0.09, 0.08, GRID * TILE]],
        [0, -0.08, -HALF - 0.05, [GRID * TILE + 0.18, 0.08, 0.09]],
        [0, -0.08, HALF + 0.05, [GRID * TILE + 0.18, 0.08, 0.09]],
      ].map(([x, y, z, size], index) => (
        <Box
          key={index}
          pos={[x, y, z]}
          size={size}
          color={C.wood}
        />
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// TRADITIONAL FILIPINO PAROL
//
// Front of the lantern faces +Z.
// The star lies in the XY plane, with its center at the origin.
// The star outline, ribs, inner star and panels all share
// the same coordinate system, so their edges connect correctly.
// ─────────────────────────────────────────────────────────────

function createStarPoints(outerRadius, innerRadius, count = 5) {
  const points = [];

  for (let i = 0; i < count * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / count;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;

    points.push([
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    ]);
  }

  return points;
}

function makeStarShape(outerRadius, innerRadius) {
  const points = createStarPoints(outerRadius, innerRadius);
  const shape = new THREE.Shape();

  shape.moveTo(points[0][0], points[0][1]);

  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }

  shape.closePath();

  return shape;
}

function StarPanel({
  radius,
  innerRadius,
  color,
  z = 0,
  opacity = 1,
  emissive = false,
}) {
  const shape = useMemo(
    () => makeStarShape(radius, innerRadius),
    [radius, innerRadius]
  );

  return (
    <mesh position={[0, 0, z]} renderOrder={emissive ? 3 : 1}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial
        color={color}
        side={THREE.DoubleSide}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
        toneMapped={false}
      />
    </mesh>
  );
}

function ParolCentre({ C }) {
  const lanternRef = useRef();
  const glowRef = useRef();

  const outerRadius = 0.56;
  const innerRadius = 0.245;

  const points = useMemo(
    () => createStarPoints(outerRadius, innerRadius),
    []
  );

  const innerPoints = useMemo(
    () => createStarPoints(0.255, 0.112),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (lanternRef.current) {
      lanternRef.current.rotation.y = Math.sin(t * 0.38) * 0.09;
      lanternRef.current.rotation.z = Math.sin(t * 0.52) * 0.025;
    }

    if (glowRef.current) {
      glowRef.current.intensity = 1.2 + Math.sin(t * 2.3) * 0.3;
    }
  });

  const pointAt = (index, z) => [
    points[index][0],
    points[index][1],
    z,
  ];

  return (
    <group position={[0, H_DARK + 0.75, 0]}>
      {/* Fine hanging cord */}
      <Rod
        start={[0, 0.95, 0]}
        end={[0, 0.53, 0]}
        radius={0.008}
        color={C.wood}
      />

      <Sphere pos={[0, 0.53, 0]} radius={0.025} color={C.gold} />

      <group ref={lanternRef}>
        {/* Main translucent red star body */}
        <StarPanel
          radius={outerRadius}
          innerRadius={innerRadius}
          color={C.red}
          z={0}
          opacity={0.9}
        />

        {/* Inner warm panel gives the lantern a layered glow */}
        <StarPanel
          radius={0.43}
          innerRadius={0.19}
          color={C.redLight}
          z={0.012}
          opacity={0.88}
        />

        {/* Gold perimeter ribs: each rod ends at the next point */}
        {points.map((point, index) => {
          const next = points[(index + 1) % points.length];

          return (
            <Rod
              key={`edge-${index}`}
              start={[point[0], point[1], 0.045]}
              end={[next[0], next[1], 0.045]}
              radius={0.012}
              color={C.gold}
            />
          );
        })}

        {/* Five continuous structural spokes from the central hub */}
        {[0, 2, 4, 6, 8].map((index) => (
          <Rod
            key={`rib-${index}`}
            start={[0, 0, 0.05]}
            end={pointAt(index, 0.05)}
            radius={0.014}
            color={C.goldLight}
          />
        ))}

        {/* Fine inner ribs define the five triangular lantern panels */}
        {points.map((point, index) => {
          if (index % 2 === 0) return null;

          return (
            <Rod
              key={`inner-rib-${index}`}
              start={[0, 0, 0.058]}
              end={[point[0], point[1], 0.058]}
              radius={0.006}
              color={C.gold}
            />
          );
        })}

        {/* Small red and green inserts within the star panels */}
        {[
          { x: -0.16, y: 0.14, color: C.green },
          { x: 0.16, y: 0.14, color: C.green },
          { x: -0.14, y: -0.16, color: C.redDark },
          { x: 0.14, y: -0.16, color: C.redDark },
        ].map((panel, index) => (
          <group key={index} position={[panel.x, panel.y, 0.065]}>
            <mesh>
              <circleGeometry args={[0.055, 3]} />
              <meshBasicMaterial
                color={panel.color}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Rod
              start={[0, -0.035, 0.002]}
              end={[0, 0.035, 0.002]}
              radius={0.004}
              color={C.gold}
            />
          </group>
        ))}

        {/* Raised central five-point star */}
        <StarPanel
          radius={0.255}
          innerRadius={0.112}
          color={C.gold}
          z={0.08}
        />

        <StarPanel
          radius={0.185}
          innerRadius={0.08}
          color={C.redLight}
          z={0.092}
        />

        {/* Central decorative hub */}
        <Sphere pos={[0, 0, 0.115]} radius={0.055} color={C.gold} />
        <Sphere
          pos={[0, 0, 0.16]}
          radius={0.027}
          color={C.glow}
          emissive
        />

        <pointLight
          ref={glowRef}
          position={[0, 0, 0.2]}
          color={C.gold}
          intensity={1.2}
          distance={1.7}
        />

        {/* Traditional long decorative streamers */}
        {[
          { x: -0.43, y: -0.22, length: 0.39, color: C.red },
          { x: 0.43, y: -0.22, length: 0.39, color: C.green },
          { x: -0.28, y: -0.49, length: 0.31, color: C.gold },
          { x: 0.28, y: -0.49, length: 0.31, color: C.red },
          { x: 0, y: -0.555, length: 0.47, color: C.gold },
        ].map((tail, index) => (
          <group
            key={`tail-${index}`}
            position={[tail.x, tail.y, 0.02]}
          >
            {/* Narrow cloth-like ribbon */}
            <Box
              pos={[0, -tail.length / 2, 0]}
              size={[0.024, tail.length, 0.012]}
              color={tail.color}
              shadow={false}
            />

            {/* Gold center seam */}
            <Box
              pos={[0, -tail.length / 2, 0.007]}
              size={[0.004, tail.length * 0.9, 0.004]}
              color={C.goldLight}
              shadow={false}
            />

            {/* Decorative tassel at the end */}
            <Sphere
              pos={[0, -tail.length - 0.018, 0]}
              radius={0.025}
              color={tail.color}
            />

            <Glow
              pos={[0, -tail.length - 0.02, 0.03]}
              color={C.goldLight}
              size={0.012}
            />
          </group>
        ))}

        {/* Small gold bead at each outer tip */}
        {[0, 2, 4, 6, 8].map((index) => (
          <Sphere
            key={`tip-${index}`}
            pos={[points[index][0], points[index][1], 0.06]}
            radius={0.022}
            color={C.goldLight}
          />
        ))}
      </group>

      {/* A subtle suspension loop */}
      <mesh
        position={[0, 0.49, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.035, 0.007, 6, 20]} />
        <meshStandardMaterial color={C.gold} metalness={0.35} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// FILIPINO CHRISTMAS DECORATIONS
// ─────────────────────────────────────────────────────────────

function ChristmasTree({ C }) {
  const x = (3 - (GRID - 1) / 2) * TILE;
  const z = (3 - (GRID - 1) / 2) * TILE;
  const starRef = useRef();

  useFrame(({ clock }) => {
    if (starRef.current) {
      const pulse = 0.9 + Math.sin(clock.elapsedTime * 3) * 0.1;
      starRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[x, H_FINDER, z]}>
      <Box pos={[0, 0.025, 0]} size={[0.11, 0.05, 0.11]} color={C.wood} />

      {[0, 1, 2].map((index) => {
        const radius = 0.09 - index * 0.022;

        return (
          <mesh
            key={index}
            position={[0, 0.07 + index * 0.052, 0]}
            material={mat(C.greenDark)}
            castShadow
          >
            <coneGeometry args={[radius, 0.11, 7]} />
          </mesh>
        );
      })}

      <mesh ref={starRef} position={[0, 0.28, 0]}>
        <octahedronGeometry args={[0.035, 0]} />
        <meshBasicMaterial color={C.gold} toneMapped={false} />
      </mesh>

      {[0, 1, 2, 3].map((index) => {
        const angle = (index / 4) * Math.PI * 2;

        return (
          <Sphere
            key={index}
            pos={[
              Math.cos(angle) * 0.055,
              0.09 + index * 0.032,
              Math.sin(angle) * 0.055,
            ]}
            radius={0.012}
            color={index % 2 === 0 ? C.red : C.gold}
          />
        );
      })}
    </group>
  );
}

function ChristmasGift({ position, C, color }) {
  return (
    <group position={position}>
      <Box pos={[0, 0.055, 0]} size={[0.105, 0.11, 0.105]} color={color} />
      <Box pos={[0, 0.057, 0.054]} size={[0.018, 0.11, 0.005]} color={C.gold} />
      <Box pos={[0, 0.057, 0]} size={[0.11, 0.018, 0.11]} color={C.gold} />
      <Box pos={[0, 0.12, 0]} size={[0.025, 0.018, 0.025]} color={C.goldLight} />

      <Rod
        start={[0, 0.13, 0]}
        end={[-0.03, 0.16, 0]}
        radius={0.009}
        color={C.gold}
      />
      <Rod
        start={[0, 0.13, 0]}
        end={[0.03, 0.16, 0]}
        radius={0.009}
        color={C.gold}
      />
    </group>
  );
}

function FinderDecorations({ C }) {
  const rightX = (GRID - 4 - (GRID - 1) / 2) * TILE;
  const topZ = (3 - (GRID - 1) / 2) * TILE;
  const bottomZ = (GRID - 4 - (GRID - 1) / 2) * TILE;

  return (
    <>
      <ChristmasTree C={C} />

      {/* Small cluster of gifts */}
      <ChristmasGift
        position={[rightX, H_FINDER, topZ]}
        C={C}
        color={C.red}
      />

      <group position={[rightX, H_FINDER, topZ]}>
        <ChristmasGift
          position={[-0.09, 0, 0.02]}
          C={C}
          color={C.green}
        />
        <Sphere
          pos={[0, 0.23, 0]}
          radius={0.022}
          color={C.gold}
          emissive
        />
      </group>

      {/* Parol-inspired miniature at the lower-left finder */}
      <group position={[0, H_FINDER, bottomZ]}>
        <StarPanel
          radius={0.105}
          innerRadius={0.047}
          color={C.red}
          z={0}
        />

        {createStarPoints(0.105, 0.047).filter((_, i) => i % 2 === 0).map(
          (point, index) => (
            <Rod
              key={index}
              start={[0, 0, 0.012]}
              end={[point[0], point[1], 0.012]}
              radius={0.004}
              color={C.gold}
            />
          )
        )}

        <Sphere pos={[0, 0, 0.02]} radius={0.02} color={C.gold} />
      </group>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// FESTIVE LIGHTS
// ─────────────────────────────────────────────────────────────

function ChristmasLights({ C }) {
  const groupRef = useRef();

  const lights = useMemo(() => {
    const random = rng(5555);

    return Array.from({ length: 22 }, (_, index) => ({
      x: (random() - 0.5) * 2.65,
      y: 0.38 + random() * 1.05,
      z: (random() - 0.5) * 2.65,
      phase: random() * Math.PI * 2,
      speed: 0.4 + random() * 0.6,
      size: 0.009 + random() * 0.012,
      color: [C.red, C.green, C.gold, C.glow][index % 4],
    }));
  }, [C]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const t = clock.elapsedTime;

    groupRef.current.children.forEach((mesh, index) => {
      const light = lights[index];

      mesh.position.set(
        light.x + Math.sin(t * light.speed + light.phase) * 0.035,
        light.y + Math.sin(t * light.speed * 1.2 + light.phase) * 0.025,
        light.z + Math.cos(t * light.speed + light.phase) * 0.035
      );

      mesh.material.opacity =
        0.65 + Math.sin(t * 2 + light.phase) * 0.25;
    });
  });

  return (
    <group ref={groupRef}>
      {lights.map((light, index) => (
        <mesh
          key={index}
          position={[light.x, light.y, light.z]}
        >
          <sphereGeometry args={[light.size, 8, 8]} />
          <meshBasicMaterial
            color={light.color}
            toneMapped={false}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// LIGHTING
// ─────────────────────────────────────────────────────────────

function SceneLighting({ C }) {
  const warmLight = useRef();

  useFrame(({ clock }) => {
    if (warmLight.current) {
      warmLight.current.intensity =
        1.05 + Math.sin(clock.elapsedTime * 0.6) * 0.12;
    }
  });

  return (
    <>
      <ambientLight intensity={0.8} color="#fff3e4" />

      <directionalLight
        position={[-3, 6, 5]}
        intensity={1.6}
        color="#fff5df"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <directionalLight
        position={[3, 3, -3]}
        intensity={0.6}
        color="#ffd4a8"
      />

      <pointLight
        ref={warmLight}
        position={[0, 1.8, 0.5]}
        color={C.gold}
        intensity={1.05}
        distance={4}
      />

      <pointLight
        position={[0, 1.1, 0.8]}
        color={C.red}
        intensity={0.35}
        distance={2.5}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SCENE
// ─────────────────────────────────────────────────────────────

export default function ParolScene({ themeColors }) {
  const matrix = useMemo(() => buildMatrix(), []);
  const C = useMemo(
    () => resolveColors(themeColors),
    [themeColors]
  );

  return (
    <group position={[0, ROOT_Y, 0]} rotation={[0, Math.PI / 4, 0]}>
      <SceneLighting C={C} />

      <QRGround matrix={matrix} C={C} />

      <ParolCentre C={C} />

      <FinderDecorations C={C} />

      <group>
        {[
          [-0.25, 0.025, -0.2, C.red],
          [0.24, 0.025, -0.18, C.green],
          [-0.2, 0.025, 0.24, C.green],
          [0.25, 0.025, 0.22, C.red],
        ].map(([x, y, z, color], index) => (
          <ChristmasGift
            key={index}
            position={[x, y, z]}
            C={C}
            color={color}
          />
        ))}
      </group>

      <ChristmasLights C={C} />
    </group>
  );
}