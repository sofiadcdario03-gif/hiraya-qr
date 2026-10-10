import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ============================================================
// BanaueRiceTerraces.jsx
// Curved Ifugao rice terraces on a continuous mountain landscape
// Preserves the 25 x 25 QR-inspired ground and themeColors API.
// ============================================================

const GRID = 25;
const TILE = 0.118;
const HALF = (GRID * TILE) / 2;
const ROOT_Y = -0.45;
const H_BASE = 0.022;
const H_DARK = 0.072;
const H_FINDER = 0.095;

const materialCache = new Map();

function mat(color, roughness = 0.85, extra = {}) {
  const key = `${color}|${roughness}|${JSON.stringify(extra)}`;

  if (!materialCache.has(key)) {
    materialCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        flatShading: false,
        ...extra,
      })
    );
  }

  return materialCache.get(key);
}

// ------------------------------------------------------------
// Deterministic random generator
// ------------------------------------------------------------

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
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);

  return `#${ca
    .lerp(cb, factor)
    .getHexString()}`;
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
// Basic geometry components
// ------------------------------------------------------------

function Box({
  pos,
  size,
  color,
  rot = [0, 0, 0],
  castShadow = true,
  receiveShadow = true,
}) {
  return (
    <mesh
      position={pos}
      scale={size}
      rotation={rot}
      material={mat(color)}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}

function Cylinder({
  pos,
  top = 0.02,
  bottom = 0.04,
  height = 0.1,
  segments = 7,
  color,
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
      <cylinderGeometry
        args={[top, bottom, height, segments]}
      />
    </mesh>
  );
}

function GlowPx({ pos, color, size = 0.025 }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;

    const t = clock.elapsedTime;
    ref.current.scale.setScalar(
      0.9 + Math.sin(t * 2.2 + pos[0] * 3) * 0.1
    );
  });

  return (
    <mesh ref={ref} position={pos}>
      <boxGeometry args={[size, size, size]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

// ------------------------------------------------------------
// Terrain height function
//
// Overlapping, broad hills instead of stacked square platforms.
// ------------------------------------------------------------

const HILLS = [
  {
    x: -0.28,
    z: -0.48,
    width: 0.88,
    depth: 0.64,
    height: 0.53,
    seed: 2.1,
  },
  {
    x: 0.36,
    z: -0.52,
    width: 0.72,
    depth: 0.62,
    height: 0.45,
    seed: 5.4,
  },
  {
    x: 0.03,
    z: -0.12,
    width: 0.88,
    depth: 0.67,
    height: 0.43,
    seed: 8.3,
  },
];

function hillHeight(x, z, hill) {
  const dx = (x - hill.x) / hill.width;
  const dz = (z - hill.z) / hill.depth;
  const distance = dx * dx + dz * dz;

  if (distance > 4.5) return 0;

  const broad = Math.exp(-distance * 1.65);
  const shoulder = Math.exp(-distance * 0.55);

  const unevenness =
    Math.sin(x * 13 + hill.seed) *
      Math.cos(z * 11 + hill.seed * 2) *
      0.018 +
    Math.sin(x * 22 - z * 15 + hill.seed) * 0.008;

  return Math.max(
    0,
    hill.height * broad + hill.height * 0.12 * shoulder + unevenness
  );
}

function terrainHeight(x, z) {
  let height = 0;

  for (const hill of HILLS) {
    height = Math.max(height, hillHeight(x, z, hill));
  }

  // The front of the landscape gently falls away into the valley.
  const valleyFade = clamp((0.58 - z) / 0.6, 0, 1);

  return height * valleyFade;
}

// ------------------------------------------------------------
// Continuous terrain mesh
// ------------------------------------------------------------

function createTerrainGeometry() {
  const segmentsX = 100;
  const segmentsZ = 90;
  const width = 2.8;
  const depth = 2.25;

  const geometry = new THREE.PlaneGeometry(
    width,
    depth,
    segmentsX,
    segmentsZ
  );

  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const colors = [];

  const low = new THREE.Color("#415B3F");
  const mid = new THREE.Color("#627F50");
  const high = new THREE.Color("#87976A");
  const random = rng(3041);

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);

    const height =
      terrainHeight(x, z) +
      (random() - 0.5) * 0.008;

    positions.setY(i, height);

    const color = new THREE.Color();

    if (height < 0.12) {
      color.copy(low).lerp(mid, height / 0.12);
    } else {
      color.copy(mid).lerp(high, clamp((height - 0.12) / 0.42, 0, 1));
    }

    const variation = (random() - 0.5) * 0.07;
    color.offsetHSL(0, variation * 0.2, variation);

    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );

  geometry.computeVertexNormals();

  return geometry;
}

function MountainTerrain({ C }) {
  const geometry = useMemo(() => createTerrainGeometry(), []);

  return (
    <group>
      <mesh
        geometry={geometry}
        position={[0, -0.012, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          vertexColors
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Forest-covered distant ridges */}
      <DistantRidge
        position={[-0.83, 0.04, -0.78]}
        scale={[0.88, 0.72, 0.48]}
        color={C.mountainDark}
      />

      <DistantRidge
        position={[0.68, 0.025, -0.8]}
        scale={[0.92, 0.67, 0.46]}
        color={C.mountain}
      />

      <DistantRidge
        position={[0.02, 0.015, -0.96]}
        scale={[1.05, 0.58, 0.42]}
        color={C.distantMountain}
      />
    </group>
  );
}

function DistantRidge({ position, scale, color }) {
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 32, 18);
    const positions = geo.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);

      const roughness =
        Math.sin(x * 7 + z * 3) * 0.025 +
        Math.cos(z * 9 + y * 4) * 0.018;

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

// ------------------------------------------------------------
// Curved terrace mesh generation
//
// Each terrace is a ribbon following the hill contour.
// A separate narrow retaining wall connects its lower edge
// to the next paddy, avoiding floating square platforms.
// ------------------------------------------------------------

function createTerraceGeometry(hill, level, levels) {
  const segments = 72;
  const widthX = hill.width * (0.98 - level * 0.035);
  const bandDepth = 0.075 + (level % 3) * 0.008;
  const positions = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const x = mix(-widthX, widthX, u);

    const normalizedX = x / widthX;
    const edgeFalloff = Math.sqrt(
      Math.max(0, 1 - normalizedX * normalizedX)
    );

    const contourBend =
      0.10 * normalizedX * normalizedX +
      Math.sin(normalizedX * 3.2 + hill.seed) * 0.035;

    const zCenter =
      hill.z +
      contourBend +
      (level / levels) * hill.depth * 0.92;

    const terraceY =
      0.035 +
      level * 0.039 +
      edgeFalloff * 0.018 +
      Math.sin(normalizedX * 4 + hill.seed) * 0.008;

    const localBand = bandDepth * (0.65 + edgeFalloff * 0.35);

    positions.push(
      x,
      terraceY,
      zCenter - localBand / 2,

      x,
      terraceY - 0.008,
      zCenter + localBand / 2
    );

    if (i < segments) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;

      indices.push(a, c, b, b, c, d);
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

function createRetainingWallGeometry(hill, level, levels) {
  const segments = 72;
  const widthX = hill.width * (0.98 - level * 0.035);
  const bandDepth = 0.075 + (level % 3) * 0.008;

  const positions = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const x = mix(-widthX, widthX, u);
    const normalizedX = x / widthX;

    const edgeFalloff = Math.sqrt(
      Math.max(0, 1 - normalizedX * normalizedX)
    );

    const zCenter =
      hill.z +
      0.10 * normalizedX * normalizedX +
      Math.sin(normalizedX * 3.2 + hill.seed) * 0.035 +
      (level / levels) * hill.depth * 0.92;

    const y =
      0.035 +
      level * 0.039 +
      edgeFalloff * 0.018 +
      Math.sin(normalizedX * 4 + hill.seed) * 0.008;

    const z = zCenter + bandDepth / 2;

    // Top and bottom vertices of the front-facing retaining wall.
    positions.push(x, y, z);
    positions.push(x, y - 0.044, z + 0.004);

    if (i < segments) {
      const a = i * 2;

      indices.push(
        a, a + 1, a + 2,
        a + 1, a + 3, a + 2
      );
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
  const waterRef = useRef();

  const topGeometry = useMemo(
    () => createTerraceGeometry(hill, level, levels),
    [hill, level, levels]
  );

  const wallGeometry = useMemo(
    () => createRetainingWallGeometry(hill, level, levels),
    [hill, level, levels]
  );

  const isWater = level % 4 === 1 || level % 4 === 2;

  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.material.opacity =
        0.42 + Math.sin(clock.elapsedTime * 1.5 + level) * 0.07;
    }
  });

  return (
    <group>
      {/* Contoured paddy surface */}
      <mesh
        geometry={topGeometry}
        material={mat(
          isWater ? C.water : level % 2 === 0 ? C.riceGreen : C.forestGreen,
          isWater ? 0.22 : 0.92,
          isWater ? { side: THREE.DoubleSide } : { side: THREE.DoubleSide }
        )}
        receiveShadow
        castShadow
      />

      {/* Water glints remain very subtle */}
      {isWater && (
        <mesh
          ref={waterRef}
          geometry={topGeometry}
          position={[0, 0.006, -0.003]}
        >
          <meshBasicMaterial
            color={C.waterLight}
            transparent
            opacity={0.42}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Connected stone-and-earth retaining edge */}
      <mesh
        geometry={wallGeometry}
        material={mat(
          level % 3 === 0 ? C.stone : C.soilLight,
          1,
          { side: THREE.DoubleSide }
        )}
        castShadow
        receiveShadow
      />
    </group>
  );
}

function RiceTerraces({ C }) {
  return (
    <group>
      {HILLS.map((hill, hillIndex) => {
        const levels = hillIndex === 1 ? 7 : 8;

        return (
          <group key={`hill-${hillIndex}`}>
            {Array.from({ length: levels }, (_, level) => (
              <TerraceBand
                key={`${hillIndex}-${level}`}
                hill={hill}
                level={level}
                levels={levels}
                C={C}
              />
            ))}
          </group>
        );
      })}

      {/* A few small field dividers connecting the terrace contours */}
      {[-0.58, -0.2, 0.18, 0.5].map((x, i) => (
        <Box
          key={`divider-${i}`}
          pos={[x, 0.11 + (i % 2) * 0.03, -0.18 + i * 0.015]}
          size={[0.018, 0.026, 0.28]}
          color={C.soilLight}
          rot={[0, Math.sin(i) * 0.12, 0]}
        />
      ))}
    </group>
  );
}

// ------------------------------------------------------------
// Ifugao huts
// ------------------------------------------------------------

function IfugaoHut({ C, position, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      {/* Four wooden support posts */}
      {[
        [-0.07, -0.06],
        [0.07, -0.06],
        [-0.07, 0.06],
        [0.07, 0.06],
      ].map(([x, z], i) => (
        <Box
          key={`post-${i}`}
          pos={[x, 0.105, z]}
          size={[0.014, 0.21, 0.014]}
          color={C.wood}
        />
      ))}

      {/* Raised timber floor */}
      <Box
        pos={[0, 0.215, 0]}
        size={[0.21, 0.025, 0.19]}
        color={C.woodLight}
      />

      {/* Compact enclosed living space */}
      <Box
        pos={[0, 0.29, 0]}
        size={[0.17, 0.13, 0.15]}
        color={C.wood}
      />

      {/* Front door */}
      <Box
        pos={[0, 0.275, 0.077]}
        size={[0.035, 0.08, 0.008]}
        color={C.soilDark}
      />

      {/* Traditional steep roof silhouette */}
      <Cylinder
        pos={[0, 0.395, 0]}
        top={0}
        bottom={0.155}
        height={0.19}
        segments={4}
        color={C.thatch}
        rot={[0, Math.PI / 4, 0]}
      />

      {/* Roof edge */}
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
      <IfugaoHut
        C={C}
        position={[-0.57, 0.16, -0.15]}
        scale={0.75}
      />

      <IfugaoHut
        C={C}
        position={[0.54, 0.12, -0.27]}
        scale={0.63}
      />

      <IfugaoHut
        C={C}
        position={[0.14, 0.055, 0.23]}
        scale={0.55}
      />
    </group>
  );
}

// ------------------------------------------------------------
// Forest vegetation
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

    for (let i = 0; i < 64; i++) {
      const side = i % 2 === 0 ? -1 : 1;

      const x = side * (0.72 + random() * 0.47);
      const z = -0.7 + random() * 1.55;

      // Leave space for the center terraces and the three QR corners.
      if (Math.abs(x) < 0.76 && z < 0.35 && z > -0.55) {
        continue;
      }

      items.push({
        x,
        z,
        scale: 0.42 + random() * 0.62,
        seed: i * 19 + 31,
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
            terrainHeight(tree.x, tree.z) - 0.01,
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
// Finder-corner landmarks
// ------------------------------------------------------------

function FinderIfugaoShrine({ C }) {
  const x = (3 - (GRID - 1) / 2) * TILE;
  const z = (3 - (GRID - 1) / 2) * TILE;

  return (
    <group position={[x, H_FINDER, z]}>
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
    if (waterRef.current) {
      waterRef.current.material.opacity =
        0.45 + Math.sin(clock.elapsedTime * 2.1) * 0.12;
    }
  });

  return (
    <group position={[x, H_FINDER, z]}>
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

      <Box pos={[0, 0.115, 0.045]} size={[0.035, 0.075, 0.025]} color={C.water} />
      <GlowPx pos={[0, 0.17, 0.045]} color={C.waterLight} size={0.02} />
    </group>
  );
}

function FinderRiceGranary({ C }) {
  const x = (3 - (GRID - 1) / 2) * TILE;
  const z = (GRID - 4 - (GRID - 1) / 2) * TILE;

  return (
    <group position={[x, H_FINDER, z]}>
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
// QR ground plane
// ------------------------------------------------------------

function QRGround({ matrix, C }) {
  const modules = useMemo(() => {
    const items = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const finder = isFinderZone(x, z);
        const timing = (z === 6 || x === 6) && !finder;
        const dark = matrix[z][x];

        let height = H_BASE;
        let color = C.base;

        if (finder) {
          height = H_FINDER;
          color = dark ? C.modDark : C.modLight;
        } else if (timing) {
          height = dark ? 0.055 : H_BASE;
          color = dark ? C.modDarkAlt : C.base;
        } else if (dark) {
          height = H_DARK;
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
      {/* Continuous dark soil backing */}
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
          receiveShadow
        />
      ))}

      {/* Earthen QR border */}
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
// Rice plants and natural details on dark QR modules
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

        // Keep the center visually open for the landscape.
        if (cx < 5 && cz < 5) continue;
        if (random() > 0.22) continue;

        output.push({
          key: `${x}-${z}`,
          x: (x - (GRID - 1) / 2) * TILE,
          z: (z - (GRID - 1) / 2) * TILE,
          height: 0.045 + random() * 0.035,
          type: Math.floor(random() * 3),
        });
      }
    }

    return output;
  }, [matrix]);

  return (
    <group>
      {items.map((item) => (
        <group key={item.key} position={[item.x, H_DARK, item.z]}>
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
// Mist drifting between mountain ridges
// ------------------------------------------------------------

function MistClouds({ C }) {
  const group = useRef();

  const clouds = useMemo(() => {
    const random = rng(6666);

    return Array.from({ length: 12 }, () => ({
      x: (random() - 0.5) * 2.2,
      y: 0.45 + random() * 0.48,
      z: -0.65 + (random() - 0.5) * 1.25,
      phase: random() * Math.PI * 2,
      speed: 0.12 + random() * 0.16,
      size: 0.12 + random() * 0.13,
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
            opacity={0.13}
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
      x: (random() - 0.5) * 2.1,
      y: 0.22 + random() * 0.65,
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
        <mesh
          key={i}
          position={[particle.x, particle.y, particle.z]}
        >
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
        1.1 + Math.sin(clock.elapsedTime * 0.3) * 0.08;
    }
  });

  return (
    <>
      <ambientLight intensity={0.8} color="#E6EFD9" />

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

      {/* QR ground and continuous mountain terrain */}
      <QRGround matrix={matrix} C={C} />
      <MountainTerrain C={C} />

      {/* Curved rice paddies and connecting retaining walls */}
      <RiceTerraces C={C} />

      {/* Ifugao village and forested slopes */}
      <Village C={C} />
      <Forest C={C} />

      {/* Preserve all three QR finder landmarks */}
      <FinderIfugaoShrine C={C} />
      <FinderWaterfallStream C={C} />
      <FinderRiceGranary C={C} />

      {/* Small natural details and atmosphere */}
      <DarkModuleDecor matrix={matrix} C={C} />
      <MistClouds C={C} />
      <Fireflies C={C} />
    </group>
  );
}