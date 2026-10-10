
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

/* =========================================================
   BANAUE RICE TERRACES
   React Three Fiber / Three.js
   - Three interconnected terraced hills
   - Concentric crop shelves and retaining walls
   - Stylized foliage and rice plants
   - QR-code-inspired floor with 3D tiles
   - Compatible with view, qrTexture, isTransitioning props
========================================================= */

const GRID = 25;
const TILE = 0.118;
const HALF = (GRID * TILE) / 2;
const ROOT_Y = -0.45;
const H_BASE = 0.022;
const H_DARK = 0.072;
const H_FINDER = 0.095;

const COLORS = {
  floor: "#F0EBDD",
  floorLine: "#D5D0C3",
  crop: "#A2D037",
  cropLight: "#B7DF4D",
  cropDark: "#8DC63F",
  wall: "#1E5128",
  wallLight: "#326D32",
  base: "#4CAF50",
  baseDark: "#347C3B",
  bush: "#133E18",
  bushLight: "#245B25",
  bushMid: "#1B4B20",
  water: "#8FCB9B",
  waterHighlight: "#D0EAC0",
  soil: "#795438",
  path: "#C9AF80",
};

/* -------------------- QR MATRIX HELPERS -------------------- */

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

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
      matrix[z][x] =
        pattern < 6 ? random() > 0.22 : random() > 0.73;
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


/* -------------------- GEOMETRY HELPERS -------------------- */

function createShelfGeometry(
  radiusX,
  radiusZ,
  innerRatio,
  segments = 96,
  wave = 0.025
) {
  const positions = [];
  const indices = [];
  const uvs = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;

    const organic =
      1 +
      Math.sin(angle * 3 + 0.4) * wave +
      Math.sin(angle * 5 - 0.7) * wave * 0.45;

    const outerX = Math.cos(angle) * radiusX * organic;
    const outerZ = Math.sin(angle) * radiusZ * organic;

    const innerX =
      Math.cos(angle) * radiusX * innerRatio * organic;
    const innerZ =
      Math.sin(angle) * radiusZ * innerRatio * organic;

    positions.push(outerX, 0, outerZ);
    positions.push(innerX, 0, innerZ);

    uvs.push(i / segments, 1);
    uvs.push(i / segments, 0);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;

    indices.push(a, b, c);
    indices.push(b, d, c);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function createRetainingWallGeometry(
  radiusX,
  radiusZ,
  nextRadiusRatio,
  lowerY,
  upperY,
  segments = 96,
  wave = 0.025
) {
  const positions = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;

    const organic =
      1 +
      Math.sin(angle * 3 + 0.4) * wave +
      Math.sin(angle * 5 - 0.7) * wave * 0.45;

    const x = Math.cos(angle) * radiusX * organic;
    const z = Math.sin(angle) * radiusZ * organic;

    const topX = x * nextRadiusRatio;
    const topZ = z * nextRadiusRatio;

    positions.push(x, lowerY, z);
    positions.push(topX, upperY, topZ);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;

    indices.push(a, c, b);
    indices.push(b, c, d);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function createTopCapGeometry(
  radiusX,
  radiusZ,
  segments = 96,
  wave = 0.025
) {
  const positions = [0, 0, 0];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;

    const organic =
      1 +
      Math.sin(angle * 3 + 0.4) * wave +
      Math.sin(angle * 5 - 0.7) * wave * 0.45;

    positions.push(
      Math.cos(angle) * radiusX * organic,
      0,
      Math.sin(angle) * radiusZ * organic
    );
  }

  for (let i = 1; i <= segments; i++) {
    indices.push(0, i, i + 1);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/* -------------------- TERRACE HILL -------------------- */

function TerraceHill({
  x,
  z,
  radiusX,
  radiusZ,
  levels,
  stepHeight,
  baseY = 0.35,
  rotation = 0,
  water = true,
  seed = 1,
}) {
  const hillRef = useRef();

  const hillData = useMemo(() => {
    const shelves = [];
    const walls = [];
    const waterShelves = [];

    const reduction = 0.105;
    const wave = 0.024;

    for (let level = 0; level < levels; level++) {
      const outerRatio = 1 - level * reduction;
      const innerRatio = 1 - (level + 1) * reduction;

      const upperY = baseY + (level + 1) * stepHeight;
      const lowerY = baseY + level * stepHeight;

      const shelf = createShelfGeometry(
        radiusX * outerRatio,
        radiusZ * outerRatio,
        innerRatio / outerRatio,
        96,
        wave
      );

      shelves.push({
        geometry: shelf,
        y: upperY,
        level,
      });

      const wall = createRetainingWallGeometry(
        radiusX * outerRatio,
        radiusZ * outerRatio,
        innerRatio / outerRatio,
        lowerY,
        upperY,
        96,
        wave
      );

      walls.push({
        geometry: wall,
        level,
      });

      if (water && level % 2 === 0) {
        const waterGeometry = createShelfGeometry(
          radiusX * outerRatio * 0.99,
          radiusZ * outerRatio * 0.99,
          (innerRatio + 0.025) / outerRatio,
          96,
          wave
        );

        waterShelves.push({
          geometry: waterGeometry,
          y: upperY + 0.009,
          level,
        });
      }
    }

    const topRatio = 1 - levels * reduction;

    const topCap = createTopCapGeometry(
      radiusX * topRatio,
      radiusZ * topRatio,
      96,
      wave
    );

    return {
      shelves,
      walls,
      waterShelves,
      topCap,
      topY: baseY + levels * stepHeight,
    };
  }, [
    radiusX,
    radiusZ,
    levels,
    stepHeight,
    baseY,
    water,
  ]);

  const shrubPositions = useMemo(() => {
    const points = [];
    const random = rng(seed * 9301 + 49297);

    for (let level = 1; level <= levels; level++) {
      const ratio = 1 - level * 0.105;
      const y = baseY + level * stepHeight + 0.055;
      const count = Math.max(3, Math.round(ratio * 13));

      for (let i = 0; i < count; i++) {
        const angle =
          (i / count) * Math.PI * 2 + random() * 0.25;

        const radius = 1 + (random() - 0.5) * 0.07;

        const px =
          Math.cos(angle) * radiusX * ratio * radius;
        const pz =
          Math.sin(angle) * radiusZ * ratio * radius;

        // Avoid excessive foliage in the inner half of shelves.
        if (random() > 0.5) {
          points.push({
            x: px,
            y,
            z: pz,
            scale: 0.055 + random() * 0.07,
            shade: Math.floor(random() * 3),
          });
        }
      }
    }

    // Bushes clustered near the summit.
    for (let i = 0; i < 9; i++) {
      points.push({
        x: (random() - 0.5) * radiusX * 0.24,
        y: hillDataTopY(
          baseY,
          levels,
          stepHeight
        ) + 0.1,
        z: (random() - 0.5) * radiusZ * 0.24,
        scale: 0.07 + random() * 0.075,
        shade: Math.floor(random() * 3),
      });
    }

    return points;
  }, [
    radiusX,
    radiusZ,
    levels,
    stepHeight,
    baseY,
    seed,
  ]);

  const plantPositions = useMemo(() => {
    const points = [];
    let state = seed * 127 + 503;

    const random = () => {
      state = (state * 16807) % 2147483647;
      return state / 2147483647;
    };

    for (let level = 0; level < levels; level++) {
      // Leave space for walls, paths, and bushes.
      if (level % 2 === 1) continue;

      const outerRatio = 1 - level * 0.105;
      const innerRatio = 1 - (level + 1) * 0.105;
      const y = baseY + (level + 1) * stepHeight + 0.025;

      for (let i = 0; i < 17; i++) {
        const angle = random() * Math.PI * 2;
        const ratio =
          innerRatio +
          (outerRatio - innerRatio) * (0.25 + random() * 0.5);

        points.push({
          x: Math.cos(angle) * radiusX * ratio,
          y,
          z: Math.sin(angle) * radiusZ * ratio,
          scale: 0.04 + random() * 0.035,
          angle,
        });
      }
    }

    return points;
  }, [
    radiusX,
    radiusZ,
    levels,
    stepHeight,
    baseY,
    seed,
  ]);

  const wallColors = [
    COLORS.wall,
    COLORS.wallLight,
    COLORS.baseDark,
  ];

  return (
    <group
      ref={hillRef}
      position={[x, 0, z]}
      rotation={[0, rotation, 0]}
    >
      {/* Retaining walls and green terrace shelves */}
      {hillData.walls.map((item, index) => (
        <mesh
          key={`wall-${index}`}
          geometry={item.geometry}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={wallColors[index % wallColors.length]}
            roughness={0.95}
            side={THREE.DoubleSide}
            flatShading
          />
        </mesh>
      ))}

      {hillData.shelves.map((item, index) => (
        <group
          key={`shelf-${index}`}
          position={[0, item.y, 0]}
        >
          <mesh
            geometry={item.geometry}
            rotation={[0, 0, 0]}
            receiveShadow
            castShadow
          >
            <meshStandardMaterial
              color={
                index % 3 === 0
                  ? COLORS.crop
                  : index % 3 === 1
                  ? COLORS.cropLight
                  : COLORS.cropDark
              }
              roughness={0.93}
              side={THREE.DoubleSide}
              flatShading
            />
          </mesh>
        </group>
      ))}

      {/* Summit plateau */}
      <mesh
        geometry={hillData.topCap}
        position={[0, hillData.topY, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color={COLORS.cropLight}
          roughness={0.95}
          side={THREE.DoubleSide}
          flatShading
        />
      </mesh>

      {/* Subtle flooded paddy shelves */}
      {hillData.waterShelves.map((item, index) => (
        <WaterPaddy
          key={`water-${index}`}
          geometry={item.geometry}
          positionY={item.y}
          seed={seed + index}
        />
      ))}

      {/* Low-poly foliage clumps along the terrace rims */}
      {shrubPositions.map((plant, index) => (
        <Bush
          key={`bush-${index}`}
          position={[plant.x, plant.y, plant.z]}
          scale={plant.scale}
          shade={plant.shade}
        />
      ))}

      {/* Small crop tufts */}
      {plantPositions.map((plant, index) => (
        <RiceTuft
          key={`rice-${index}`}
          position={[plant.x, plant.y, plant.z]}
          scale={plant.scale}
          rotation={plant.angle}
        />
      ))}
    </group>
  );
}

function hillDataTopY(baseY, levels, stepHeight) {
  return baseY + levels * stepHeight;
}

/* -------------------- WATER PADDIES -------------------- */

function WaterPaddy({ geometry, positionY, seed }) {
  const materialRef = useRef();

  useFrame(({ clock }) => {
    if (!materialRef.current) return;

    materialRef.current.opacity =
      0.28 + Math.sin(clock.elapsedTime * 0.7 + seed) * 0.035;
  });

  return (
    <mesh
      geometry={geometry}
      position={[0, positionY, 0]}
      renderOrder={2}
    >
      <meshStandardMaterial
        ref={materialRef}
        color={COLORS.water}
        transparent
        opacity={0.3}
        roughness={0.24}
        metalness={0.03}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/* -------------------- STYLIZED SHRUBS -------------------- */

function Bush({ position, scale = 0.1, shade = 0 }) {
  const palette = [
    COLORS.bush,
    COLORS.bushLight,
    COLORS.bushMid,
  ];

  const color = palette[shade % palette.length];

  return (
    <group position={position} scale={scale}>
      <mesh
        position={[0, 0.45, 0]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial
          color={color}
          roughness={1}
          flatShading
        />
      </mesh>

      <mesh
        position={[-0.45, 0.32, 0.05]}
        scale={[0.75, 0.8, 0.8]}
        castShadow
      >
        <icosahedronGeometry args={[0.65, 1]} />
        <meshStandardMaterial
          color={COLORS.bushMid}
          roughness={1}
          flatShading
        />
      </mesh>

      <mesh
        position={[0.42, 0.34, -0.06]}
        scale={[0.78, 0.75, 0.78]}
        castShadow
      >
        <icosahedronGeometry args={[0.65, 1]} />
        <meshStandardMaterial
          color={COLORS.bushLight}
          roughness={1}
          flatShading
        />
      </mesh>
    </group>
  );
}

/* -------------------- RICE PLANT TUFTS -------------------- */

function RiceTuft({ position, scale = 0.05, rotation = 0 }) {
  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      scale={scale}
    >
      {[0, 1, 2, 3].map((blade) => (
        <mesh
          key={blade}
          position={[
            Math.sin(blade * 1.6) * 0.26,
            0.27 + (blade % 2) * 0.035,
            Math.cos(blade * 1.6) * 0.26,
          ]}
          rotation={[
            Math.sin(blade * 1.7) * 0.18,
            0,
            (blade - 1.5) * 0.19,
          ]}
        >
          <coneGeometry args={[0.12, 0.68, 3]} />
          <meshStandardMaterial
            color={
              blade % 2 === 0
                ? COLORS.cropDark
                : COLORS.cropLight
            }
            roughness={1}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

/* -------------------- BASE LANDSCAPE -------------------- */

function LandscapeBase() {
  const baseGeometry = useMemo(() => {
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const position = geometry.attributes.position;

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);

      const irregularity =
        1 +
        0.035 * Math.sin(x * 8 + z * 4) +
        0.025 * Math.cos(z * 7 - y * 3);

      position.setXYZ(
        i,
        x * irregularity,
        y * irregularity,
        z * irregularity
      );
    }

    geometry.computeVertexNormals();
    return geometry;
  }, []);

  return (
    <group>
      {/* Broad organic landform under all three hills */}
      <mesh
        geometry={baseGeometry}
        position={[0, -0.1, 0]}
        scale={[1.5, 0.12, 1.5]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={COLORS.base}
          roughness={1}
          flatShading
        />
      </mesh>

      {/* Darker low-poly front edge for visual depth */}
      <mesh
        position={[0, -0.15, 0.12]}
        scale={[1.45, 0.08, 1.45]}
        receiveShadow
      >
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          color={COLORS.baseDark}
          roughness={1}
          flatShading
        />
      </mesh>
    </group>
  );
}

/* -------------------- QR GROUND -------------------- */

function Box({
  pos = [0, 0, 0],
  size = [1, 1, 1],
  color = "#ffffff",
  rot = [0, 0, 0],
  shadow = true,
}) {
  return (
    <mesh
      position={pos}
      scale={size}
      rotation={rot}
      castShadow={shadow}
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        roughness={0.88}
        flatShading
      />
    </mesh>
  );
}

function QRGround({ matrix }) {
  const tiles = useMemo(() => {
    const output = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const finder = isFinderZone(x, z);
        const timing = (x === 6 || z === 6) && !finder;
        const dark = matrix[z][x];

        let height = H_BASE;
        let color = COLORS.base;

        if (finder) {
          height = dark ? H_FINDER : H_BASE;
          color = dark ? COLORS.wall : COLORS.base;
        } else if (timing && dark) {
          height = 0.055;
          color = COLORS.wallLight;
        } else if (dark) {
          height = H_DARK;
          color = (x + z) % 4 === 0 ? COLORS.wallLight : COLORS.wall;
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
  }, [matrix]);

  return (
    <group>
      <Box
        pos={[0, -0.06, 0]}
        size={[GRID * TILE + 0.12, 0.12, GRID * TILE + 0.12]}
        color={COLORS.base}
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
        color="#5BA3C7"
      />

      <Box
        pos={[0, -0.24, 0]}
        size={[GRID * TILE + 0.12, 0.1, GRID * TILE + 0.12]}
        color="#4A8FB0"
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
          color="#4A8FB0"
        />
      ))}

      {/* Underlay provides a clean border around the terrain */}
      <Box
        pos={[0, -0.32, 0]}
        size={[GRID * TILE + 0.24, 0.08, GRID * TILE + 0.24]}
        color={COLORS.floor}
        shadow={false}
      />
    </group>
  );
}

/* -------------------- PATHS AND IRRIGATION -------------------- */

function TerracePath({ points, radius = 0.045 }) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        points.map(
          ([x, y, z]) => new THREE.Vector3(x, y, z)
        )
      ),
    [points]
  );

  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 36, radius, 5, false),
    [curve, radius]
  );

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={COLORS.path}
        roughness={1}
        flatShading
      />
    </mesh>
  );
}

/* -------------------- CLOUDS -------------------- */

function Cloud({ position = [0, 0, 0], scale = 1, seed = 1 }) {
  const cloudRef = useRef();
  
  useFrame(({ clock }) => {
    if (cloudRef.current) {
      cloudRef.current.position.x = position[0] + Math.sin(clock.elapsedTime * 0.1 + seed) * 0.05;
    }
  });

  const cloudParts = useMemo(() => {
    const random = rng(seed);
    const parts = [];
    for (let i = 0; i < 5; i++) {
      parts.push({
        x: (random() - 0.5) * 0.4,
        y: (random() - 0.5) * 0.15,
        z: (random() - 0.5) * 0.3,
        scale: 0.15 + random() * 0.2,
      });
    }
    return parts;
  }, [seed]);

  return (
    <group ref={cloudRef} position={position} scale={scale}>
      {cloudParts.map((part, i) => (
        <mesh key={i} position={[part.x, part.y, part.z]}>
          <sphereGeometry args={[part.scale, 8, 8]} />
          <meshStandardMaterial
            color="#FFFFFF"
            transparent
            opacity={0.7 + (i % 2) * 0.15}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}

function IrrigationChannel({ position, length, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[length, 0.035, 0.075]} />
        <meshStandardMaterial
          color={COLORS.wall}
          roughness={1}
          flatShading
        />
      </mesh>

      <mesh position={[0, 0.022, 0]}>
        <boxGeometry args={[length * 0.94, 0.012, 0.04]} />
        <meshStandardMaterial
          color={COLORS.waterHighlight}
          roughness={0.25}
          metalness={0.04}
        />
      </mesh>
    </group>
  );
}

/* -------------------- COMPLETE SCENE -------------------- */

export default function BanaueRiceTerraces({
  view,
  themeColors,
}) {
  const sceneRef = useRef();
  const groupRef = useRef();
  const matrix = useMemo(() => buildMatrix(), []);

  useFrame((state, delta) => {
    if (!sceneRef.current) return;

    // Get transition progress from parent TransitionRig
    const parent = sceneRef.current.parent;
    const transitionProgress = parent?.userData?.transitionProgress ?? 0;
    const isQRView = parent?.userData?.isQRView ?? false;

    // Subtle idle animation in world view
    if (!isQRView) {
      const targetY = ROOT_Y;
      sceneRef.current.position.y = THREE.MathUtils.damp(
        sceneRef.current.position.y,
        targetY,
        3,
        delta
      );
    }

    // Transform to QR view during transition
    if (groupRef.current) {
      // Flatten the scene as we approach QR view
      const flattenFactor = THREE.MathUtils.smoothstep(0.5, 1.0, transitionProgress);
      groupRef.current.scale.y = 1 - flattenFactor * 0.95;
      groupRef.current.position.y = -flattenFactor * 0.5;
    }
  });

  return (
    <group
      ref={sceneRef}
      position={[0, ROOT_Y, 0]}
      rotation={[0, Math.PI / 4, 0]}
    >
      <group ref={groupRef}>
        {/* QR-code patterned ground */}
        <QRGround matrix={matrix} />

        {/* Broad, irregular green landform */}
        <LandscapeBase />

      {/* FOREGROUND: widest, medium-height terrace hill */}
      <TerraceHill
        x={-0.56}
        z={0.48}
        radiusX={0.78}
        radiusZ={0.62}
        levels={4}
        stepHeight={0.15}
        baseY={H_DARK}
        rotation={-0.12}
        seed={11}
      />

      {/* MIDGROUND: central, tall focal-point hill */}
      <TerraceHill
        x={0}
        z={-0.12}
        radiusX={0.9}
        radiusZ={0.76}
        levels={6}
        stepHeight={0.15}
        baseY={H_DARK}
        rotation={0.16}
        seed={27}
      />

      {/* BACKGROUND RIGHT: smaller footprint, tallest summit */}
      <TerraceHill
        x={0.58}
        z={-0.67}
        radiusX={0.68}
        radiusZ={0.56}
        levels={5}
        stepHeight={0.16}
        baseY={H_DARK}
        rotation={0.3}
        seed={43}
      />

      {/* A few subtle paths crossing the landscape */}
      <TerracePath
        points={[
          [-1.1, H_DARK + 0.24, 0.9],
          [-0.85, H_DARK + 0.3, 0.72],
          [-0.62, H_DARK + 0.38, 0.5],
        ]}
        radius={0.035}
      />

      <TerracePath
        points={[
          [-0.48, H_DARK + 0.55, -0.45],
          [-0.1, H_DARK + 0.72, -0.28],
          [0.28, H_DARK + 0.85, -0.16],
        ]}
        radius={0.035}
      />

      {/* Narrow water channels near the foot of the hills */}
      <IrrigationChannel
        position={[-0.9, H_DARK + 0.2, 1.05]}
        length={0.55}
        rotation={-0.25}
      />

      <IrrigationChannel
        position={[0.9, H_DARK + 0.2, 0.75]}
        length={0.45}
        rotation={0.45}
      />

      {/* Water pool in front-left corner */}
      <group position={[-1.1, H_DARK + 0.02, 1.1]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[0.35, 0.04, 0.35]} />
          <meshStandardMaterial color="#4A8FB0" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.14, 24]} />
          <meshStandardMaterial 
            color="#5BA3C7" 
            roughness={0.15} 
            metalness={0.1}
            transparent
            opacity={0.85}
          />
        </mesh>
      </group>

      {/* Water pool in back-right corner */}
      <group position={[1.1, H_DARK + 0.02, -1.1]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[0.35, 0.04, 0.35]} />
          <meshStandardMaterial color="#4A8FB0" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.14, 24]} />
          <meshStandardMaterial 
            color="#5BA3C7" 
            roughness={0.15} 
            metalness={0.1}
            transparent
            opacity={0.85}
          />
        </mesh>
      </group>

      {/* Floating clouds in the sky */}
      <Cloud position={[-0.8, 1.8, -0.5]} scale={0.8} seed={42} />
      <Cloud position={[0.9, 2.0, -0.3]} scale={0.6} seed={78} />
      <Cloud position={[0, 2.2, 0.6]} scale={0.7} seed={123} />
      </group>
    </group>
  );
}