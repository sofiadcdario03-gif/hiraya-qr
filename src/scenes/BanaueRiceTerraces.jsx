import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ============================================================
// BanaueRiceTerraces.jsx
// A grand, layered Banaue / Ifugao rice-terrace landscape.
// Preserves the QR-inspired ground and themeColors API.
// ============================================================

const GRID = 25;
const TILE = 0.118;
const HALF = (GRID * TILE) / 2;
const ROOT_Y = -0.45;

const materialCache = new Map();

function mat(color, roughness = 0.85, extra = {}) {
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function blendHex(a, b, factor) {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), factor).getHexString()}`;
}

function darken(color, factor) {
  return blendHex(color, "#000000", factor);
}

function lighten(color, factor) {
  return blendHex(color, "#ffffff", factor);
}

// ------------------------------------------------------------
// QR matrix
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// Theme colors
// ------------------------------------------------------------

function resolveColors(theme = {}) {
  const green = theme.primary || "#397746";
  const emerald = theme.secondary || "#628D55";
  const gold = theme.accent || "#D8B45A";
  const light = theme.light || "#E4E8D5";

  return {
    modDark: green,
    modDarkAlt: darken(green, 0.22),
    modLight: light,
    base: lighten(light, 0.035),

    soil: "#62452F",
    soilLight: "#8A6445",
    soilDark: "#453526",

    stone: "#756F61",
    stoneLight: "#A69D87",
    stoneDark: "#4E4C43",

    gold,
    goldLight: lighten(gold, 0.28),
    sun: lighten(gold, 0.34),

    riceGreen: emerald,
    riceLight: lighten(emerald, 0.2),
    forestGreen: darken(green, 0.27),
    mossGreen: "#526541",
    leafLight: "#91A96A",

    water: "#75B9C0",
    waterLight: "#B6DCDD",
    waterDark: "#4C8F98",

    mountain: "#4F7052",
    mountainLight: "#73916A",
    mountainDark: "#334C3A",
    distantMountain: "#8BA38B",

    wood: "#765039",
    woodLight: "#A47B50",
    thatch: "#927648",
    mist: "#F1F3E9",
  };
}

// ------------------------------------------------------------
// Basic geometry
// ------------------------------------------------------------

function Box({
  pos = [0, 0, 0],
  size = [1, 1, 1],
  color = "#ffffff",
  rot = [0, 0, 0],
  castShadow = true,
  receiveShadow = true,
  material,
}) {
  return (
    <mesh
      position={pos}
      rotation={rot}
      material={material || mat(color)}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <boxGeometry args={size} />
    </mesh>
  );
}

function Cylinder({
  pos = [0, 0, 0],
  top = 0.02,
  bottom = 0.04,
  height = 0.1,
  segments = 7,
  color = "#ffffff",
  rot = [0, 0, 0],
}) {
  return (
    <mesh
      position={pos}
      rotation={rot}
      material={mat(color)}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[top, bottom, height, segments]} />
    </mesh>
  );
}

function Orb({
  pos = [0, 0, 0],
  radius = 0.1,
  color = "#ffffff",
  scale = [1, 1, 1],
  emissive = "#000000",
  emissiveIntensity = 0,
}) {
  return (
    <mesh position={pos} scale={scale} castShadow receiveShadow>
      <sphereGeometry args={[radius, 10, 8]} />
      <meshStandardMaterial
        color={color}
        roughness={0.9}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

function GlowPx({ pos, color, size = 0.025 }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;

    const t = clock.elapsedTime;
    const pulse = 0.9 + Math.sin(t * 2.2 + pos[0] * 3) * 0.1;
    ref.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={ref} position={pos}>
      <boxGeometry args={[size, size, size]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

// ------------------------------------------------------------
// Mountain profiles
//
// The terraces follow multiple connected, curved mountain
// contours rather than appearing as square stacked platforms.
// ------------------------------------------------------------

const HILLS = [
  {
    x: -0.34,
    z: -0.25,
    width: 1.02,
    depth: 0.91,
    height: 0.88,
    seed: 2.1,
    levels: 12,
  },
  {
    x: 0.36,
    z: -0.31,
    width: 0.93,
    depth: 0.84,
    height: 0.79,
    seed: 5.4,
    levels: 11,
  },
  {
    x: 0.02,
    z: -0.11,
    width: 0.82,
    depth: 0.75,
    height: 0.66,
    seed: 8.3,
    levels: 10,
  },
];

function hillProfile(x, z, hill) {
  const dx = (x - hill.x) / hill.width;
  const dz = (z - hill.z) / hill.depth;
  const distance = dx * dx + dz * dz;

  if (distance >= 1.15) return 0;

  const broad = Math.pow(Math.max(0, 1 - distance), 0.72);
  const shoulder = Math.exp(-distance * 1.35);

  const irregularity =
    Math.sin(x * 13 + hill.seed) *
      Math.cos(z * 11 + hill.seed * 2) *
      0.024 +
    Math.sin(x * 21 - z * 16 + hill.seed) * 0.012;

  return Math.max(
    0,
    hill.height * broad * 0.76 +
      hill.height * 0.23 * shoulder +
      irregularity
  );
}

function terrainHeight(x, z) {
  let height = 0;

  for (const hill of HILLS) {
    height = Math.max(height, hillProfile(x, z, hill));
  }

  // A steep but gradual descent toward the front valley.
  const frontFade = clamp((0.8 - z) / 0.92, 0, 1);

  return height * frontFade;
}

// ------------------------------------------------------------
// Natural mountain mesh
// ------------------------------------------------------------

function createTerrainGeometry() {
  const segmentsX = 110;
  const segmentsZ = 100;
  const width = 2.95;
  const depth = 2.72;

  const geometry = new THREE.PlaneGeometry(
    width,
    depth,
    segmentsX,
    segmentsZ
  );

  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const colors = [];

  const low = new THREE.Color("#3D573C");
  const middle = new THREE.Color("#617F4F");
  const high = new THREE.Color("#8C9D6B");
  const random = rng(3041);

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);

    const height =
      terrainHeight(x, z) + (random() - 0.5) * 0.006;

    positions.setY(i, height);

    const color = new THREE.Color();

    if (height < 0.12) {
      color.copy(low).lerp(middle, height / 0.12);
    } else {
      color
        .copy(middle)
        .lerp(high, clamp((height - 0.12) / 0.7, 0, 1));
    }

    const variation = (random() - 0.5) * 0.045;
    color.offsetHSL(0, variation * 0.18, variation);

    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );

  geometry.computeVertexNormals();

  return geometry;
}

function DistantRidge({ position, scale, color }) {
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 32, 20);
    const positions = geo.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);

      const roughness =
        Math.sin(x * 7 + z * 3) * 0.028 +
        Math.cos(z * 9 + y * 4) * 0.02;

      positions.setXYZ(
        i,
        x * (1 + roughness),
        y * (1 + roughness),
        z * (1 + roughness)
      );
    }

    geo.computeVertexNormals();

    return geo;
  }, []);

  return (
    <mesh
      geometry={geometry}
      position={position}
      scale={scale}
      material={mat(color, 1)}
      castShadow
      receiveShadow
    />
  );
}

function MountainTerrain({ C }) {
  const geometry = useMemo(() => createTerrainGeometry(), []);

  return (
    <group>
      <mesh
        geometry={geometry}
        position={[0, -0.018, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>

      {/* Layered mountain ridges behind the paddies */}
      <DistantRidge
        position={[-0.88, 0.18, -0.78]}
        scale={[0.82, 0.76, 0.42]}
        color={C.mountainDark}
      />

      <DistantRidge
        position={[0.78, 0.16, -0.82]}
        scale={[0.92, 0.78, 0.43]}
        color={C.mountain}
      />

      <DistantRidge
        position={[0.02, 0.2, -0.96]}
        scale={[1.05, 0.76, 0.4]}
        color={C.distantMountain}
      />

      {/* Dark forest band below the far ridge */}
      {Array.from({ length: 21 }, (_, i) => {
        const x = -1.24 + i * 0.124;
        const z = -0.83 + Math.sin(i * 0.68) * 0.07;
        const y = terrainHeight(x, z) + 0.02;

        return (
          <Orb
            key={`ridge-tree-${i}`}
            pos={[x, y, z]}
            radius={0.11 + (i % 3) * 0.015}
            scale={[1.15, 1.3, 0.9]}
            color={i % 2 ? C.mountainDark : C.forestGreen}
          />
        );
      })}
    </group>
  );
}

// ------------------------------------------------------------
// Curved terrace geometry
//
// Every terrace is a broad, curved ribbon following a hill's
// contour. Its upper surface and retaining wall are separate.
// ------------------------------------------------------------

function terracePoint(hill, level, u, levels) {
  const normalizedX = u * 2 - 1;

  const edge = Math.sqrt(
    Math.max(0, 1 - normalizedX * normalizedX)
  );

  const x = hill.x + normalizedX * hill.width * 0.98;

  // Curved contour bends, similar to terraces wrapping a slope.
  const bend =
    normalizedX * normalizedX * 0.12 +
    Math.sin(normalizedX * 3.1 + hill.seed) * 0.045;

  const z =
    hill.z +
    bend +
    (level / levels - 0.5) * hill.depth * 1.22;

  const heightRatio = level / levels;

  const y =
    0.055 +
    heightRatio * hill.height * 0.62 +
    edge * hill.height * 0.14 +
    Math.sin(normalizedX * 4.2 + hill.seed) * 0.012;

  return {
    x,
    z,
    y,
    edge,
    normalizedX,
  };
}

function createTerraceGeometry(hill, level, levels) {
  if (!hill || !hill.width || !hill.height || !hill.depth || levels <= 0) {
    return new THREE.BufferGeometry();
  }

  const segments = 96;
  const t = level / levels;

  const width = hill.width * (1 - t * 0.28);
  const y = 0.10 + level * hill.height / levels;
  const zCenter = hill.z - level * hill.depth * 0.72 / levels;

  const positions = [];
  const indices = [];
  const colors = [];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const x = (u - 0.5) * width;
    const contour =
      Math.sin(u * Math.PI) * 0.075 +
      Math.sin(u * Math.PI * 2) * 0.018;

    const z = zCenter + contour;

    positions.push(x, y, z);
    positions.push(x, y, z + 0.04);

    const color = new THREE.Color();
    color.setHSL(0.25 + u * 0.05, 0.45, 0.55);
    colors.push(color.r, color.g, color.b);
    colors.push(color.r, color.g, color.b);

    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1);
      indices.push(a + 1, a + 2, a + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function createRetainingWallGeometry(hill, level, levels) {
  if (!hill || !hill.width || !hill.height || !hill.depth || levels <= 0) {
    return new THREE.BufferGeometry();
  }

  const segments = 48;
  const t = level / levels;

  const width = hill.width * (1 - t * 0.28);
  const depth = hill.depth / levels * 1.5;
  const yTop = 0.10 + level * hill.height / levels;
  const yBottom = yTop - Math.max(0.035, hill.height / levels * 0.9);
  const zCenter = hill.z - level * hill.depth * 0.72 / levels;

  const positions = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const x = (u - 0.5) * width;
    const contour =
      Math.sin(u * Math.PI) * 0.075 +
      Math.sin(u * Math.PI * 2) * 0.018;

    const z = zCenter + depth * 0.5 + contour;

    positions.push(x, yTop, z);
    positions.push(x, yBottom, z + 0.008);

    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2);
      indices.push(a + 1, a + 3, a + 2);
    }
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

function TerraceBand({ hill, level, levels, C }) {
  const paddyGeometry = useMemo(
    () => createTerraceGeometry(hill, level, levels),
    [hill, level, levels]
  );

  const wallGeometry = useMemo(
    () => createRetainingWallGeometry(hill, level, levels),
    [hill, level, levels]
  );

  if (!hill || !hill.width || !hill.height || !hill.depth || levels <= 0) {
    return null;
  }

  return (
    <group>
      {/* Flat cultivated paddy */}
      <mesh
        geometry={paddyGeometry}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.32}
          metalness={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Exposed earth-and-stone retaining wall */}
      <mesh
        geometry={wallGeometry}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          color={level % 2 === 0 ? C.soilLight : C.stone}
          roughness={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------
// Terrace detailing
// ------------------------------------------------------------

function TerraceStonework({ C }) {
  const stones = useMemo(() => {
    const random = rng(8241);
    const items = [];

    HILLS.forEach((hill, hillIndex) => {
      for (let level = 0; level < hill.levels; level++) {
        // Small, irregular stones follow selected retaining walls.
        for (let i = 0; i < 28; i++) {
          const u = (i + random() * 0.7) / 28;
          const p = terracePoint(hill, level, u, hill.levels);

          if (p.edge < 0.2 || random() > 0.76) continue;

          items.push({
            key: `${hillIndex}-${level}-${i}`,
            pos: [
              p.x,
              p.y - 0.018,
              p.z + 0.043,
            ],
            size: [
              0.018 + random() * 0.018,
              0.012 + random() * 0.009,
              0.012 + random() * 0.01,
            ],
            color:
              random() > 0.5
                ? C.stone
                : C.stoneLight,
          });
        }
      }
    });

    return items;
  }, [C]);

  return (
    <group>
      {stones.map((stone) => (
        <Box
          key={stone.key}
          pos={stone.pos}
          size={stone.size}
          color={stone.color}
        />
      ))}
    </group>
  );
}

function RicePlants({ C }) {
  const plants = useMemo(() => {
    const random = rng(1542);
    const items = [];

    HILLS.forEach((hill, hillIndex) => {
      for (let level = 0; level < hill.levels; level++) {
        for (let i = 0; i < 17; i++) {
          if (random() > 0.62) continue;

          const u = 0.12 + (i / 17) * 0.76;
          const p = terracePoint(hill, level, u, hill.levels);

          // Keep some open surfaces to read as water-filled paddies.
          if (level % 4 === 1 || level % 4 === 2) continue;

          items.push({
            key: `${hillIndex}-${level}-${i}`,
            pos: [
              p.x + (random() - 0.5) * 0.04,
              p.y + 0.006,
              p.z + (random() - 0.5) * 0.045,
            ],
            height: 0.025 + random() * 0.045,
            color:
              random() > 0.5
                ? C.riceGreen
                : C.riceLight,
          });
        }
      }
    });

    return items;
  }, [C]);

  return (
    <group>
      {plants.map((plant) => (
        <group key={plant.key} position={plant.pos}>
          <Cylinder
            pos={[0, plant.height / 2, 0]}
            top={0.002}
            bottom={0.004}
            height={plant.height}
            segments={4}
            color={plant.color}
          />

          <Cylinder
            pos={[-0.006, plant.height * 0.66, 0]}
            top={0.001}
            bottom={0.0025}
            height={plant.height * 0.65}
            segments={4}
            color={C.leafLight}
            rot={[0, 0, -0.25]}
          />

          <Cylinder
            pos={[0.006, plant.height * 0.58, 0.003]}
            top={0.001}
            bottom={0.0025}
            height={plant.height * 0.58}
            segments={4}
            color={C.riceLight}
            rot={[0, 0, 0.3]}
          />
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------
// Main central rice-terrace landscape
// ------------------------------------------------------------

function RiceTerraces({ C }) {
  return (
    <group>
      {/* The central hill is the largest and tallest focal point */}
      {HILLS.map((hill, hillIndex) => (
        <group key={`hill-${hillIndex}`}>
          {Array.from({ length: hill.levels }, (_, level) => (
            <TerraceBand
              key={`${hillIndex}-${level}`}
              hill={hill}
              level={level}
              levels={hill.levels}
              C={C}
            />
          ))}
        </group>
      ))}

      <TerraceStonework C={C} />
      <RicePlants C={C} />

      {/* A narrow irrigation channel winding down the terraces */}
      {Array.from({ length: 8 }, (_, i) => {
        const t = i / 7;
        const x = -0.23 + Math.sin(t * Math.PI * 1.4) * 0.17;
        const z = -0.7 + t * 1.05;
        const y = terrainHeight(x, z) + 0.045;

        return (
          <group key={`irrigation-${i}`}>
            <Box
              pos={[x, y, z]}
              size={[0.045, 0.009, 0.105]}
              color={C.water}
              rot={[0, Math.sin(t * 4) * 0.16, 0]}
            />

            <Box
              pos={[x - 0.027, y + 0.008, z]}
              size={[0.009, 0.018, 0.11]}
              color={C.stone}
            />
          </group>
        );
      })}

      {/* Small crossing paths connecting levels */}
      {[
        [-0.56, 0.3, -0.14],
        [-0.39, 0.27, 0.04],
        [0.37, 0.25, -0.05],
        [0.55, 0.22, 0.12],
      ].map((pos, i) => (
        <Box
          key={`terrace-path-${i}`}
          pos={pos}
          size={[0.15, 0.018, 0.055]}
          color={C.soilLight}
          rot={[0, i % 2 === 0 ? -0.2 : 0.2, 0]}
        />
      ))}
    </group>
  );
}

// ------------------------------------------------------------
// Ifugao-inspired raised granaries and huts
// ------------------------------------------------------------

function IfugaoHut({ C, position, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      {/* Four raised wooden supports */}
      {[
        [-0.07, -0.06],
        [0.07, -0.06],
        [-0.07, 0.06],
        [0.07, 0.06],
      ].map(([x, z], i) => (
        <Box
          key={`hut-post-${i}`}
          pos={[x, 0.105, z]}
          size={[0.014, 0.21, 0.014]}
          color={C.wood}
        />
      ))}

      <Box
        pos={[0, 0.215, 0]}
        size={[0.21, 0.025, 0.19]}
        color={C.woodLight}
      />

      <Box
        pos={[0, 0.29, 0]}
        size={[0.17, 0.13, 0.15]}
        color={C.wood}
      />

      <Box
        pos={[0, 0.275, 0.077]}
        size={[0.035, 0.08, 0.008]}
        color={C.soilDark}
      />

      {/* Steep roof silhouette */}
      <Cylinder
        pos={[0, 0.395, 0]}
        top={0}
        bottom={0.155}
        height={0.19}
        segments={4}
        color={C.thatch}
        rot={[0, Math.PI / 4, 0]}
      />

      <Cylinder
        pos={[0, 0.315, 0]}
        top={0.155}
        bottom={0.15}
        height={0.025}
        segments={4}
        color={C.wood}
        rot={[0, Math.PI / 4, 0]}
      />
    </group>
  );
}

function Village({ C }) {
  return (
    <group>
      {/* Kept to the side and rear so the terraces remain dominant */}
      <IfugaoHut
        C={C}
        position={[-0.91, 0.12, -0.48]}
        scale={0.52}
      />

      <IfugaoHut
        C={C}
        position={[0.91, 0.1, -0.47]}
        scale={0.48}
      />

      <IfugaoHut
        C={C}
        position={[0.78, 0.04, 0.54]}
        scale={0.4}
      />
    </group>
  );
}

// ------------------------------------------------------------
// Forest and border vegetation
// ------------------------------------------------------------

function Tree({ C, position, scale = 1, seed = 1 }) {
  const random = rng(seed);

  const crownColors = [
    C.forestGreen,
    C.mossGreen,
    C.mountain,
    C.riceGreen,
  ];

  return (
    <group position={position} scale={scale}>
      <Cylinder
        pos={[0, 0.13, 0]}
        top={0.012}
        bottom={0.022}
        height={0.26}
        segments={5}
        color={C.wood}
      />

      {[0, 1, 2].map((i) => {
        const y = 0.24 + i * 0.065;
        const radius = 0.09 - i * 0.018;

        return (
          <mesh
            key={i}
            position={[
              (random() - 0.5) * 0.035,
              y,
              (random() - 0.5) * 0.035,
            ]}
            material={mat(crownColors[i % crownColors.length])}
            castShadow
          >
            <coneGeometry args={[radius, 0.16, 6]} />
          </mesh>
        );
      })}
    </group>
  );
}

function Forest({ C }) {
  const trees = useMemo(() => {
    const random = rng(4567);
    const items = [];

    for (let i = 0; i < 54; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (0.98 + random() * 0.36);
      const z = -0.95 + random() * 1.9;

      items.push({
        x,
        z,
        scale: 0.42 + random() * 0.58,
        seed: i * 19 + 31,
      });
    }

    // Back ridge trees frame the terraces like a forested valley.
    for (let i = 0; i < 15; i++) {
      const x = -1.16 + i * 0.165;
      const z = -1.12 + Math.sin(i * 0.7) * 0.05;

      items.push({
        x,
        z,
        scale: 0.42 + random() * 0.4,
        seed: i * 31 + 100,
      });
    }

    return items;
  }, []);

  return (
    <group>
      {trees.map((tree, i) => (
        <Tree
          key={i}
          C={C}
          position={[
            tree.x,
            terrainHeight(tree.x, tree.z) - 0.005,
            tree.z,
          ]}
          scale={tree.scale}
          seed={tree.seed}
        />
      ))}
    </group>
  );
}

// ------------------------------------------------------------
// Terraced-field border accents
// ------------------------------------------------------------

function BorderDetails({ C }) {
  const random = useMemo(() => rng(6124), []);

  const stones = useMemo(() => {
    const items = [];

    for (let i = 0; i < 34; i++) {
      const side = i % 4;
      const t = -1.16 + random() * 2.32;

      let x;
      let z;

      if (side === 0) {
        x = t;
        z = -1.25;
      } else if (side === 1) {
        x = t;
        z = 1.25;
      } else if (side === 2) {
        x = -1.25;
        z = t;
      } else {
        x = 1.25;
        z = t;
      }

      items.push({
        pos: [x, 0.01, z],
        size: [
          0.06 + random() * 0.06,
          0.025 + random() * 0.02,
          0.05 + random() * 0.045,
        ],
        color: random() > 0.5 ? C.stone : C.stoneDark,
      });
    }

    return items;
  }, [C, random]);

  return (
    <group>
      {/* Mossy stones framing the miniature landscape */}
      {stones.map((stone, i) => (
        <group key={`border-stone-${i}`}>
          <Box
            pos={stone.pos}
            size={stone.size}
            color={stone.color}
          />

          {i % 3 === 0 && (
            <Orb
              pos={[
                stone.pos[0],
                stone.pos[1] + 0.025,
                stone.pos[2],
              ]}
              radius={0.035}
              scale={[1.2, 0.35, 0.9]}
              color={C.mossGreen}
            />
          )}
        </group>
      ))}

      {/* Small rice bundles and cultivated plants along the edges */}
      {Array.from({ length: 22 }, (_, i) => {
        const side = i % 4;
        const t = -1.15 + (i / 22) * 2.3;

        let x;
        let z;

        if (side === 0) {
          x = t;
          z = -1.2;
        } else if (side === 1) {
          x = t;
          z = 1.2;
        } else if (side === 2) {
          x = -1.2;
          z = t;
        } else {
          x = 1.2;
          z = t;
        }

        return (
          <group key={`border-rice-${i}`} position={[x, 0.02, z]}>
            <Cylinder
              pos={[0, 0.045, 0]}
              top={0.002}
              bottom={0.006}
              height={0.09}
              segments={4}
              color={C.riceGreen}
            />

            <Orb
              pos={[-0.018, 0.075, 0]}
              radius={0.025}
              scale={[1.3, 0.35, 0.55]}
              color={C.riceLight}
            />

            <Orb
              pos={[0.018, 0.06, 0.008]}
              radius={0.024}
              scale={[1.3, 0.35, 0.55]}
              color={C.leafLight}
            />
          </group>
        );
      })}

      {/* Golden field markers */}
      {Array.from({ length: 12 }, (_, i) => {
        const x = -0.93 + i * 0.169;

        return (
          <group key={`field-marker-${i}`}>
            <Box
              pos={[x, 0.009, -1.35]}
              size={[0.028, 0.015, 0.045]}
              color={i % 3 === 0 ? C.gold : C.soilLight}
            />

            <Box
              pos={[x, 0.009, 1.35]}
              size={[0.028, 0.015, 0.045]}
              color={i % 3 === 0 ? C.gold : C.soilLight}
            />
          </group>
        );
      })}

      {/* Warm fireflies around the valley border */}
      {Array.from({ length: 18 }, (_, i) => {
        const random = rng(i + 803);
        const x = (random() - 0.5) * 2.45;
        const y = 0.12 + random() * 0.55;
        const z = (random() - 0.5) * 2.45;

        return (
          <GlowPx
            key={`border-firefly-${i}`}
            pos={[x, y, z]}
            color={i % 3 === 0 ? C.goldLight : C.sun}
            size={i % 4 === 0 ? 0.018 : 0.012}
          />
        );
      })}
    </group>
  );
}

// ------------------------------------------------------------
// Small QR-corner landmarks
// ------------------------------------------------------------

function FinderIfugaoShrine({ C }) {
  const x = (3 - (GRID - 1) / 2) * TILE;
  const z = (3 - (GRID - 1) / 2) * TILE;

  return (
    <group position={[x, 0.095, z]}>
      <Box pos={[0, 0.025, 0]} size={[0.24, 0.05, 0.22]} color={C.stone} />
      <Box pos={[0, 0.065, 0]} size={[0.17, 0.035, 0.16]} color={C.stoneLight} />
      <Box pos={[0, 0.09, 0]} size={[0.1, 0.025, 0.1]} color={C.wood} />
      <Box pos={[0, 0.17, 0]} size={[0.035, 0.15, 0.035]} color={C.wood} />
      <Box pos={[0, 0.255, 0]} size={[0.075, 0.025, 0.075]} color={C.gold} />
      <GlowPx pos={[0, 0.3, 0]} color={C.goldLight} size={0.022} />
    </group>
  );
}

function FinderWaterfallStream({ C }) {
  const x = (GRID - 4 - (GRID - 1) / 2) * TILE;
  const z = (3 - (GRID - 1) / 2) * TILE;
  const waterRef = useRef();

  useFrame(({ clock }) => {
    if (!waterRef.current) return;

    waterRef.current.material.opacity =
      0.45 + Math.sin(clock.elapsedTime * 2.1) * 0.12;
  });

  return (
    <group position={[x, 0.095, z]}>
      <Box pos={[0, 0.025, 0]} size={[0.23, 0.05, 0.21]} color={C.stone} />
      <Box pos={[0, 0.055, 0]} size={[0.15, 0.025, 0.14]} color={C.stoneLight} />

      <mesh
        ref={waterRef}
        position={[0, 0.08, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.07, 12]} />
        <meshBasicMaterial
          color={C.waterLight}
          transparent
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>

      <Box
        pos={[0, 0.115, 0.045]}
        size={[0.035, 0.075, 0.025]}
        color={C.water}
      />

      <GlowPx pos={[0, 0.17, 0.045]} color={C.waterLight} size={0.02} />
    </group>
  );
}

function FinderRiceGranary({ C }) {
  const x = (3 - (GRID - 1) / 2) * TILE;
  const z = (GRID - 4 - (GRID - 1) / 2) * TILE;

  return (
    <group position={[x, 0.095, z]}>
      <Box pos={[0, 0.02, 0]} size={[0.2, 0.04, 0.19]} color={C.stone} />

      {[
        [-0.06, -0.06],
        [0.06, -0.06],
        [-0.06, 0.06],
        [0.06, 0.06],
      ].map(([dx, dz], i) => (
        <Box
          key={i}
          pos={[dx, 0.09, dz]}
          size={[0.012, 0.12, 0.012]}
          color={C.wood}
        />
      ))}

      <Box pos={[0, 0.16, 0]} size={[0.15, 0.025, 0.15]} color={C.woodLight} />
      <Box pos={[0, 0.225, 0]} size={[0.13, 0.11, 0.13]} color={C.wood} />

      <Cylinder
        pos={[0, 0.315, 0]}
        top={0}
        bottom={0.105}
        height={0.085}
        segments={4}
        color={C.thatch}
        rot={[0, Math.PI / 4, 0]}
      />

      <GlowPx pos={[0, 0.37, 0]} color={C.gold} size={0.02} />
    </group>
  );
}

// ------------------------------------------------------------
// QR ground
// ------------------------------------------------------------

function QRGround({ matrix, C }) {
  const modules = useMemo(() => {
    const items = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const finder = isFinderZone(x, z);
        const timing = (z === 6 || x === 6) && !finder;
        const dark = matrix[z][x];

        let height = 0.022;
        let color = C.base;

        if (finder) {
          height = 0.095;
          color = dark ? C.modDark : C.modLight;
        } else if (timing) {
          height = dark ? 0.055 : 0.022;
          color = dark ? C.modDarkAlt : C.base;
        } else if (dark) {
          height = 0.072;
          color = (x + z) % 4 === 0 ? C.modDarkAlt : C.modDark;
        }

        items.push({
          key: `${x}-${z}`,
          x: (x - (GRID - 1) / 2) * TILE,
          z: (z - (GRID - 1) / 2) * TILE,
          height,
          color,
          dark,
          finder,
        });
      }
    }

    return items;
  }, [matrix, C]);

  return (
    <group>
      <Box
        pos={[0, -0.07, 0]}
        size={[GRID * TILE + 0.14, 0.13, GRID * TILE + 0.14]}
        color={C.soilDark}
        castShadow={false}
      />

      {modules.map((module) => (
        <Box
          key={module.key}
          pos={[module.x, module.height / 2, module.z]}
          size={[
            TILE * (module.finder ? 0.97 : 0.94),
            module.height,
            TILE * (module.finder ? 0.97 : 0.94),
          ]}
          color={module.color}
          castShadow={module.dark}
        />
      ))}

      {/* Earthen perimeter */}
      {[
        [0, -0.13, -HALF - 0.045, [GRID * TILE + 0.12, 0.08, 0.08]],
        [0, -0.13, HALF + 0.045, [GRID * TILE + 0.12, 0.08, 0.08]],
        [-HALF - 0.045, -0.13, 0, [0.08, 0.08, GRID * TILE]],
        [HALF + 0.045, -0.13, 0, [0.08, 0.08, GRID * TILE]],
      ].map(([x, y, z, size], i) => (
        <Box
          key={i}
          pos={[x, y, z]}
          size={size}
          color={C.soil}
        />
      ))}
    </group>
  );
}

// ------------------------------------------------------------
// Decorative QR modules
// ------------------------------------------------------------

function DarkModuleDecor({ matrix, C }) {
  const items = useMemo(() => {
    const random = rng(9999);
    const output = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (!matrix[z][x] || isFinderZone(x, z)) continue;
        if (z === 6 || x === 6) continue;

        const cx = Math.abs(x - (GRID - 1) / 2);
        const cz = Math.abs(z - (GRID - 1) / 2);

        // Protect the central mountain silhouette.
        if (cx < 6 && cz < 6) continue;
        if (random() > 0.19) continue;

        output.push({
          key: `${x}-${z}`,
          x: (x - (GRID - 1) / 2) * TILE,
          z: (z - (GRID - 1) / 2) * TILE,
          height: 0.035 + random() * 0.025,
          type: Math.floor(random() * 3),
        });
      }
    }

    return output;
  }, [matrix]);

  return (
    <group>
      {items.map((item) => (
        <group key={item.key} position={[item.x, 0.072, item.z]}>
          {item.type === 0 ? (
            <>
              <Box
                pos={[0, item.height / 2, 0]}
                size={[0.006, item.height, 0.006]}
                color={C.forestGreen}
              />

              <Cylinder
                pos={[0, item.height, 0]}
                top={0}
                bottom={0.009}
                height={0.04}
                segments={4}
                color={C.riceLight}
              />
            </>
          ) : item.type === 1 ? (
            <Box
              pos={[0, 0.014, 0]}
              size={[0.025, 0.025, 0.02]}
              color={C.stone}
            />
          ) : (
            <>
              <Box
                pos={[0, 0.025, 0]}
                size={[0.006, 0.05, 0.006]}
                color={C.forestGreen}
              />

              <GlowPx
                pos={[0, 0.055, 0]}
                color={C.goldLight}
                size={0.012}
              />
            </>
          )}
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------
// Animated mist
// ------------------------------------------------------------

function MistClouds({ C }) {
  const group = useRef();

  const clouds = useMemo(() => {
    const random = rng(6666);

    return Array.from({ length: 12 }, () => ({
      x: (random() - 0.5) * 2.25,
      y: 0.42 + random() * 0.42,
      z: -0.65 + (random() - 0.5) * 1.25,
      phase: random() * Math.PI * 2,
      speed: 0.12 + random() * 0.16,
      size: 0.1 + random() * 0.11,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;

    const t = clock.elapsedTime;

    group.current.children.forEach((mesh, i) => {
      const cloud = clouds[i];

      mesh.position.set(
        cloud.x + Math.sin(t * cloud.speed + cloud.phase) * 0.07,
        cloud.y + Math.sin(t * cloud.speed * 0.8 + cloud.phase) * 0.025,
        cloud.z + Math.cos(t * cloud.speed + cloud.phase) * 0.06
      );
    });
  });

  return (
    <group ref={group}>
      {clouds.map((cloud, i) => (
        <mesh key={i} position={[cloud.x, cloud.y, cloud.z]}>
          <sphereGeometry args={[cloud.size, 10, 7]} />

          <meshBasicMaterial
            color={C.mist}
            transparent
            opacity={0.11}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------------
// Rice-field fireflies
// ------------------------------------------------------------

function Fireflies({ C }) {
  const group = useRef();

  const particles = useMemo(() => {
    const random = rng(7777);

    return Array.from({ length: 22 }, () => ({
      x: (random() - 0.5) * 2.15,
      y: 0.2 + random() * 0.65,
      z: -0.4 + (random() - 0.5) * 1.5,
      phase: random() * Math.PI * 2,
      speed: 0.25 + random() * 0.4,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;

    const t = clock.elapsedTime;

    group.current.children.forEach((mesh, i) => {
      const particle = particles[i];

      mesh.position.set(
        particle.x + Math.sin(t * particle.speed + particle.phase) * 0.045,
        particle.y + Math.sin(t * particle.speed * 1.5 + particle.phase) * 0.05,
        particle.z + Math.cos(t * particle.speed + particle.phase) * 0.04
      );
    });
  });

  return (
    <group ref={group}>
      {particles.map((particle, i) => (
        <mesh key={i} position={[particle.x, particle.y, particle.z]}>
          <sphereGeometry args={[0.009, 5, 5]} />

          <meshBasicMaterial
            color={i % 3 === 0 ? C.goldLight : C.sun}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------------
// Lighting
// ------------------------------------------------------------

function SceneLighting({ C }) {
  const sunlight = useRef();

  useFrame(({ clock }) => {
    if (sunlight.current) {
      sunlight.current.intensity =
        1.15 + Math.sin(clock.elapsedTime * 0.3) * 0.08;
    }
  });

  return (
    <>
      <ambientLight intensity={0.82} color="#E6EFD9" />

      <hemisphereLight
        args={["#DCEAD9", "#3C4938", 0.65]}
      />

      <directionalLight
        position={[-3, 6, 4]}
        intensity={1.8}
        color="#FFF0CE"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <directionalLight
        position={[3, 4, -4]}
        intensity={0.75}
        color="#B8D5B3"
      />

      <pointLight
        ref={sunlight}
        position={[-0.5, 2.3, -0.8]}
        color={C.sun}
        intensity={1.1}
        distance={5}
      />
    </>
  );
}

// ------------------------------------------------------------
// Main scene
// ------------------------------------------------------------

export default function BanaueRiceTerraces({ themeColors }) {
  const matrix = useMemo(() => buildMatrix(), []);

  const C = useMemo(
    () => resolveColors(themeColors),
    [themeColors]
  );

  return (
    <group
      position={[0, ROOT_Y, 0]}
      rotation={[0, Math.PI / 4, 0]}
    >
      <SceneLighting C={C} />

      {/* QR-inspired base */}
      <QRGround matrix={matrix} C={C} />

      {/* Main focal point: broad, high, curved rice terraces */}
      <MountainTerrain C={C} />
      <RiceTerraces C={C} />

      {/* Field structure and landscape details */}
      <Village C={C} />
      <Forest C={C} />
      <BorderDetails C={C} />

      {/* QR corner landmarks */}
      <FinderIfugaoShrine C={C} />
      <FinderWaterfallStream C={C} />
      <FinderRiceGranary C={C} />

      {/* Animated atmosphere */}
      <DarkModuleDecor matrix={matrix} C={C} />
      <MistClouds C={C} />
      <Fireflies C={C} />
    </group>
  );
}
