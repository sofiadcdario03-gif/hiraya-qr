
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/*
 * DiwataScene.jsx
 *
 * Art direction:
 * Pixelated 3D miniature diorama, low-poly-inspired geometry,
 * organic procedural modeling, soft lighting, and an isometric view.
 *
 * Design:
 * - QR-code patterned floor with raised pixel modules
 * - Three prominent QR finder patterns
 * - Pixelated Balete tree along the back border
 * - Spring, mushrooms, stones, and flowers arranged around the edges
 * - Stepped, block-based foliage
 * - No characters and no external models
 *
 * Designed for use inside the existing WorldCanvas.
 */

const ROOT_Y = -0.45;

const GRID = 25;
const TILE = 0.12;
const HALF = (GRID * TILE) / 2;
const FLOOR_TOP = 0.025;

const COLORS = {
  base: "#e8e4d5",
  tileLight: "#d8d5c5",
  tileDark: "#183d32",
  tileDarkAlt: "#244d3a",
  tileHighlight: "#38664a",
  soil: "#604633",
  soilLight: "#846043",
  trunk: "#62452f",
  trunkLight: "#896344",
  trunkDark: "#3c2b20",
  leafDark: "#245b3b",
  leaf: "#367747",
  leafLight: "#559451",
  leafBright: "#81ac5d",
  gold: "#e3bd69",
  water: "#43bdb0",
  waterLight: "#9ae7d4",
  stone: "#858779",
  stoneLight: "#aaa993",
  flowerPink: "#e6a0c2",
  flowerCream: "#f2e6c1",
};

const matCache = new Map();

function material(color, roughness = 0.88, extra = {}) {
  const key = `${color}-${roughness}-${JSON.stringify(extra)}`;

  if (!matCache.has(key)) {
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        flatShading: true,
        ...extra,
      })
    );
  }

  return matCache.get(key);
}

function seededRandom(seed) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function Box({
  position = [0, 0, 0],
  size = [1, 1, 1],
  color = "#ffffff",
  rotation = [0, 0, 0],
  material: customMaterial,
  castShadow = true,
  receiveShadow = true,
}) {
  return (
    <mesh
      position={position}
      scale={size}
      rotation={rotation}
      material={customMaterial || material(color)}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}

function PixelSphere({
  position,
  size,
  color,
  detail = 0,
  squash = [1, 1, 1],
}) {
  return (
    <mesh
      position={position}
      scale={[size * squash[0], size * squash[1], size * squash[2]]}
      material={material(color)}
      castShadow
      receiveShadow
    >
      <icosahedronGeometry args={[1, detail]} />
    </mesh>
  );
}

// ---------------------------------------------------------
// QR floor generation
// ---------------------------------------------------------

function inFinder(x, z, ox, oz) {
  return x >= ox && x < ox + 7 && z >= oz && z < oz + 7;
}

function finderModule(x, z, ox, oz) {
  const dx = x - ox;
  const dz = z - oz;
  const edge = Math.min(dx, dz, 6 - dx, 6 - dz);

  // QR finder pattern: dark outer border, light inner border,
  // and a dark 3 x 3 center.
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

function makeQRMatrix() {
  const rand = seededRandom(7821);
  const matrix = Array.from({ length: GRID }, () =>
    Array(GRID).fill(false)
  );

  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (isFinderZone(x, z)) continue;

      // Two pixel-wide timing strips.
      if (z === 6 || x === 6) {
        matrix[z][x] = (x + z) % 2 === 0;
        continue;
      }

      // A deterministic decorative QR-like data field.
      const pattern = (x * 7 + z * 11 + x * z * 3) % 13;
      matrix[z][x] = pattern < 6 ? rand() > 0.22 : rand() > 0.73;
    }
  }

  // Three finder patterns.
  const origins = [
    [0, 0],
    [GRID - 7, 0],
    [0, GRID - 7],
  ];

  for (const [ox, oz] of origins) {
    for (let z = oz; z < oz + 7; z++) {
      for (let x = ox; x < ox + 7; x++) {
        matrix[z][x] = finderModule(x, z, ox, oz);
      }
    }
  }

  return matrix;
}

function QRFloor() {
  const matrix = useMemo(makeQRMatrix, []);

  const modules = useMemo(() => {
    const items = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (!matrix[z][x]) continue;

        const ox = x - (GRID - 1) / 2;
        const oz = z - (GRID - 1) / 2;

        const finder =
          inFinder(x, z, 0, 0) ||
          inFinder(x, z, GRID - 7, 0) ||
          inFinder(x, z, 0, GRID - 7);

        const color =
          finder
            ? COLORS.tileDark
            : (x + z) % 4 === 0
              ? COLORS.tileDarkAlt
              : COLORS.tileDark;

        items.push({
          position: [
            ox * TILE,
            FLOOR_TOP + 0.012,
            oz * TILE,
          ],
          size: finder ? 0.96 : 0.9,
          color,
        });
      }
    }

    return items;
  }, [matrix]);

  return (
    <group>
      {/* Continuous pale backing */}
      <Box
        position={[0, -0.055, 0]}
        size={[GRID * TILE + 0.12, 0.16, GRID * TILE + 0.12]}
        color={COLORS.base}
      />

      {/* Pale individual pixels */}
      {Array.from({ length: GRID * GRID }, (_, i) => {
        const x = i % GRID;
        const z = Math.floor(i / GRID);
        const ox = x - (GRID - 1) / 2;
        const oz = z - (GRID - 1) / 2;

        return (
          <Box
            key={`tile-${i}`}
            position={[
              ox * TILE,
              FLOOR_TOP,
              oz * TILE,
            ]}
            size={[TILE * 0.94, 0.025, TILE * 0.94]}
            color={
              (x + z) % 7 === 0
                ? "#d2d0be"
                : COLORS.base
            }
            castShadow={false}
          />
        );
      })}

      {/* Raised dark QR modules */}
      {modules.map((m, i) => (
        <Box
          key={`module-${i}`}
          position={m.position}
          size={[
            TILE * m.size,
            0.045,
            TILE * m.size,
          ]}
          color={m.color}
        />
      ))}

      {/* Pixelated outer border */}
      <Box
        position={[0, -0.12, -HALF - 0.055]}
        size={[GRID * TILE + 0.2, 0.12, 0.12]}
        color={COLORS.soil}
      />
      <Box
        position={[0, -0.12, HALF + 0.055]}
        size={[GRID * TILE + 0.2, 0.12, 0.12]}
        color={COLORS.soil}
      />
      <Box
        position={[-HALF - 0.055, -0.12, 0]}
        size={[0.12, 0.12, GRID * TILE]}
        color={COLORS.soil}
      />
      <Box
        position={[HALF + 0.055, -0.12, 0]}
        size={[0.12, 0.12, GRID * TILE]}
        color={COLORS.soil}
      />

      {/* Layered earth beneath the QR landscape */}
      <Box
        position={[0, -0.23, 0]}
        size={[GRID * TILE + 0.16, 0.12, GRID * TILE + 0.16]}
        color={COLORS.soilLight}
      />
      <Box
        position={[0, -0.33, 0]}
        size={[GRID * TILE + 0.12, 0.1, GRID * TILE + 0.12]}
        color={COLORS.soil}
      />

      {/* Small golden corner pixels */}
      {[
        [-HALF - 0.035, -HALF - 0.035],
        [HALF + 0.035, -HALF - 0.035],
        [-HALF - 0.035, HALF + 0.035],
        [HALF + 0.035, HALF + 0.035],
      ].map(([x, z], i) => (
        <Box
          key={`corner-${i}`}
          position={[x, 0.015, z]}
          size={[0.14, 0.07, 0.14]}
          color={COLORS.gold}
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------
// Pixelated Balete tree
// ---------------------------------------------------------

function Branch({
  start,
  end,
  thickness = 0.08,
  color = COLORS.trunk,
}) {
  const midpoint = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];

  const direction = new THREE.Vector3(
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2]
  );

  const length = direction.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );

  return (
    <mesh
      position={midpoint}
      quaternion={quaternion}
      material={material(color)}
      castShadow
      receiveShadow
    >
      <cylinderGeometry
        args={[
          thickness * 0.65,
          thickness,
          length,
          5,
        ]}
      />
    </mesh>
  );
}

function PixelCanopy({ position, size, seed = 1 }) {
  const blocks = useMemo(() => {
    const rand = seededRandom(seed * 37);
    const colors = [
      COLORS.leafDark,
      COLORS.leaf,
      COLORS.leafLight,
      COLORS.leafBright,
    ];

    const out = [];

    // Layered stepped canopy, with irregular edges.
    for (let layer = 0; layer < 3; layer++) {
      const count = layer === 0 ? 9 : layer === 1 ? 7 : 4;
      const spread = size * (layer === 0 ? 0.9 : layer === 1 ? 0.68 : 0.43);

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + rand() * 0.4;
        const radius = spread * (0.45 + rand() * 0.55);

        out.push({
          position: [
            Math.cos(angle) * radius,
            layer * size * 0.3 + (rand() - 0.5) * size * 0.15,
            Math.sin(angle) * radius,
          ],
          size: size * (0.32 + rand() * 0.18),
          color: colors[Math.floor(rand() * colors.length)],
        });
      }
    }

    // A larger central block makes the crown read as one silhouette.
    out.push({
      position: [0, size * 0.25, 0],
      size: size * 0.5,
      color: COLORS.leaf,
    });

    return out;
  }, [seed, size]);

  return (
    <group position={position}>
      {blocks.map((b, i) => (
        <PixelSphere
          key={i}
          position={b.position}
          size={b.size}
          color={b.color}
          squash={[1.15, 0.8, 1.05]}
          detail={0}
        />
      ))}
    </group>
  );
}

function BaleteTree() {
  const x = 0;
  const z = 0;
  const ground = 0.07;

  const branches = [
    { a: [x, ground + 0.5, z], b: [x - 0.45, ground + 1.15, z - 0.1] },
    { a: [x, ground + 0.75, z], b: [x + 0.42, ground + 1.35, z - 0.08] },
    { a: [x, ground + 1.0, z], b: [x - 0.05, ground + 1.7, z + 0.12] },
    { a: [x - 0.12, ground + 1.2, z], b: [x - 0.72, ground + 1.55, z + 0.08] },
    { a: [x + 0.12, ground + 1.15, z], b: [x + 0.72, ground + 1.58, z + 0.1] },
  ];

  const roots = [
    [x, ground + 0.14, z, x - 0.62, ground + 0.035, z + 0.15],
    [x, ground + 0.14, z, x + 0.56, ground + 0.035, z + 0.15],
    [x, ground + 0.14, z, x - 0.3, ground + 0.035, z + 0.55],
    [x, ground + 0.14, z, x + 0.22, ground + 0.035, z + 0.53],
    [x, ground + 0.14, z, x - 0.25, ground + 0.035, z - 0.48],
  ];

  return (
    <group>
      {/* Chunky, irregular trunk */}
      <Box
        position={[x, ground + 0.63, z]}
        size={[0.5, 1.4, 0.48]}
        color={COLORS.trunk}
      />
      <Box
        position={[x - 0.18, ground + 0.68, z + 0.12]}
        size={[0.2, 1.3, 0.22]}
        color={COLORS.trunkLight}
      />
      <Box
        position={[x + 0.18, ground + 0.62, z - 0.14]}
        size={[0.18, 1.35, 0.2]}
        color={COLORS.trunkDark}
      />

      {/* Exposed roots radiating into the border tiles */}
      {roots.map((r, i) => (
        <Branch
          key={`root-${i}`}
          start={[r[0], r[1], r[2]]}
          end={[r[3], r[4], r[5]]}
          thickness={0.12 - i * 0.005}
          color={i % 2 ? COLORS.trunkLight : COLORS.trunk}
        />
      ))}

      {/* Branches with a stepped silhouette */}
      {branches.map((b, i) => (
        <Branch
          key={`branch-${i}`}
          start={b.a}
          end={b.b}
          thickness={0.1}
          color={i % 2 ? COLORS.trunkLight : COLORS.trunk}
        />
      ))}

      {/* Pixel-like canopy clusters - bigger and bushier */}
      <PixelCanopy position={[x - 0.65, ground + 1.48, z]} size={0.75} seed={4} />
      <PixelCanopy position={[x + 0.03, ground + 1.72, z - 0.03]} size={0.85} seed={7} />
      <PixelCanopy position={[x + 0.72, ground + 1.55, z + 0.04]} size={0.7} seed={11} />
      <PixelCanopy position={[x - 0.07, ground + 1.35, z + 0.35]} size={0.62} seed={14} />
      <PixelCanopy position={[x, ground + 1.65, z + 0.5]} size={0.68} seed={18} />
      <PixelCanopy position={[x - 0.5, ground + 1.42, z - 0.45]} size={0.58} seed={21} />

      {/* Golden pixel hollow */}
      <Box
        position={[x + 0.18, ground + 0.67, z + 0.169]}
        size={[0.11, 0.2, 0.035]}
        color="#21180f"
      />
      <Box
        position={[x + 0.18, ground + 0.67, z + 0.193]}
        size={[0.045, 0.1, 0.012]}
        color="#e7ee8c"
      />

      {/* Tiny square epiphytes */}
      {[
        [-0.2, 0.55, 0.17],
        [0.12, 0.94, 0.16],
        [-0.16, 1.05, 0.15],
      ].map(([dx, dy, dz], i) => (
        <group key={`epiphyte-${i}`} position={[x + dx, ground + dy, z + dz]}>
          <Box
            position={[0, 0, 0]}
            size={[0.1, 0.08, 0.07]}
            color={i === 1 ? COLORS.leafLight : COLORS.leaf}
          />
          <Box
            position={[0.045, 0.04, 0.015]}
            size={[0.06, 0.05, 0.05]}
            color={COLORS.leafBright}
          />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------
// Border vegetation
// ---------------------------------------------------------

function PixelPlant({ position, scale = 1, seed = 1 }) {
  const leaves = useMemo(() => {
    const rand = seededRandom(seed * 91);

    return Array.from({ length: 5 }, (_, i) => {
      const angle = (i / 5) * Math.PI * 2 + rand() * 0.4;

      return {
        position: [
          Math.cos(angle) * 0.1 * scale,
          (0.08 + rand() * 0.12) * scale,
          Math.sin(angle) * 0.1 * scale,
        ],
        size: [
          (0.08 + rand() * 0.04) * scale,
          (0.12 + rand() * 0.12) * scale,
          (0.07 + rand() * 0.04) * scale,
        ],
        rotation: [
          (rand() - 0.5) * 0.3,
          angle,
          (rand() - 0.5) * 0.4,
        ],
        color: [
          COLORS.leafDark,
          COLORS.leaf,
          COLORS.leafLight,
        ][i % 3],
      };
    });
  }, [scale, seed]);

  return (
    <group position={position}>
      <Box
        position={[0, 0.07 * scale, 0]}
        size={[0.09 * scale, 0.14 * scale, 0.09 * scale]}
        color={COLORS.trunk}
      />

      {leaves.map((leaf, i) => (
        <Box
          key={i}
          position={leaf.position}
          size={leaf.size}
          rotation={leaf.rotation}
          color={leaf.color}
        />
      ))}
    </group>
  );
}

function BambooCluster({ position, seed = 1 }) {
  const canes = useMemo(() => {
    const rand = seededRandom(seed * 31);

    return Array.from({ length: 5 }, () => ({
      x: (rand() - 0.5) * 0.18,
      z: (rand() - 0.5) * 0.18,
      height: 0.5 + rand() * 0.45,
      lean: (rand() - 0.5) * 0.12,
      color: rand() > 0.5 ? "#91ad61" : "#6f914f",
    }));
  }, [seed]);

  return (
    <group position={position}>
      {canes.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation={[0, 0, c.lean]}>
          <Box
            position={[0, c.height / 2, 0]}
            size={[0.035, c.height, 0.035]}
            color={c.color}
          />

          {[0.35, 0.62, 0.85].map((f) => (
            <Box
              key={f}
              position={[0, c.height * f, 0]}
              size={[0.05, 0.025, 0.05]}
              color="#b0bd73"
            />
          ))}

          {[0, 1, 2].map((k) => (
            <Box
              key={k}
              position={[
                (k - 1) * 0.1,
                c.height * 0.78 + k * 0.035,
                0.035,
              ]}
              size={[0.12, 0.035, 0.045]}
              rotation={[0, k * 0.7, -0.35 + k * 0.3]}
              color={COLORS.leafLight}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------
// Spring and water
// ---------------------------------------------------------

function Spring() {
  const waterRef = useRef();
  const glowRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (waterRef.current) {
      waterRef.current.material.emissiveIntensity =
        0.35 + Math.sin(t * 1.3) * 0.1;
    }

    if (glowRef.current) {
      glowRef.current.intensity =
        1.0 + Math.sin(t * 1.5) * 0.25;
    }
  });

  const cx = -1.35;
  const cz = -1.35;

  return (
    <group>
      {/* Stone-lined spring at top-left corner */}
      <Box
        position={[cx, 0.045, cz]}
        size={[0.62, 0.07, 0.55]}
        color={COLORS.stone}
      />
      <Box
        position={[cx, 0.085, cz]}
        size={[0.48, 0.035, 0.41]}
        color="#a3a18b"
      />

      <mesh
        ref={waterRef}
        position={[cx, 0.108, cz]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.19, 8]} />
        <meshStandardMaterial
          color={COLORS.water}
          emissive="#176e68"
          emissiveIntensity={0.35}
          roughness={0.3}
          metalness={0.1}
          flatShading
        />
      </mesh>

      {/* Pixel stepping stones */}
      {[
        [-0.31, -0.02],
        [-0.2, 0.08],
        [0.23, 0.09],
        [0.32, -0.04],
      ].map(([dx, dz], i) => (
        <Box
          key={i}
          position={[cx + dx, 0.09, cz + dz]}
          size={[0.09, 0.045, 0.08]}
          color={i % 2 ? COLORS.stoneLight : COLORS.stone}
        />
      ))}

      <pointLight
        ref={glowRef}
        position={[cx, 0.35, cz]}
        color={COLORS.waterLight}
        intensity={1}
        distance={1.8}
      />

      <GlowPixel position={[cx, 0.18, cz]} color={COLORS.waterLight} />
    </group>
  );
}

// ---------------------------------------------------------
// Pixel flowers and mushrooms
// ---------------------------------------------------------

function GlowPixel({ position, color = COLORS.gold, size = 0.045 }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse = 0.85 + Math.sin(clock.elapsedTime * 2.1 + position[0]) * 0.15;
      ref.current.scale.setScalar(pulse);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[size, size, size]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function PixelFlower({ position, color = COLORS.flowerPink, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <Box
        position={[0, 0.075, 0]}
        size={[0.025, 0.15, 0.025]}
        color={COLORS.leaf}
      />

      {[
        [0.035, 0.16, 0],
        [-0.035, 0.16, 0],
        [0, 0.16, 0.035],
        [0, 0.16, -0.035],
      ].map((p, i) => (
        <Box
          key={i}
          position={p}
          size={[0.045, 0.035, 0.045]}
          color={color}
        />
      ))}

      <Box
        position={[0, 0.18, 0]}
        size={[0.03, 0.03, 0.03]}
        color={COLORS.gold}
      />
    </group>
  );
}

function PixelMushrooms({ position, seed = 1 }) {
  const mushrooms = useMemo(() => {
    const rand = seededRandom(seed * 71);

    // Magical mushroom varieties with glow
    const varieties = [
      { cap: "#57d9c1", stem: "#e5ddc5", glow: "#67e8f9" }, // teal
      { cap: "#f1cc72", stem: "#e5ddc5", glow: "#fbbf24" }, // gold
      { cap: "#a78bfa", stem: "#e5ddc5", glow: "#c4b5fd" }, // purple
      { cap: "#f472b6", stem: "#e5ddc5", glow: "#f9a8d4" }, // pink
      { cap: "#34d399", stem: "#e5ddc5", glow: "#6ee7b7" }, // emerald
    ];

    return Array.from({ length: 8 }, () => {
      const variety = varieties[Math.floor(rand() * varieties.length)];
      return {
        x: (rand() - 0.5) * 0.35,
        z: (rand() - 0.5) * 0.35,
        h: 0.08 + rand() * 0.18,
        cap: 0.06 + rand() * 0.05,
        ...variety,
      };
    });
  }, [seed]);

  return (
    <group position={position}>
      {mushrooms.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]}>
          <Box
            position={[0, m.h / 2, 0]}
            size={[0.04, m.h, 0.04]}
            color={m.stem}
          />

          <Box
            position={[0, m.h, 0]}
            size={[m.cap, 0.05, m.cap]}
            color={m.cap}
          />

          <GlowPixel
            position={[0, m.h + 0.06, 0]}
            color={m.glow}
            size={0.03}
          />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------
// Stones and sacred offering
// ---------------------------------------------------------

function SacredStones() {
  const stones = useMemo(() => {
    const rand = seededRandom(821);

    // Position stones around top-right corner [1.2, -1.2]
    return Array.from({ length: 18 }, (_, i) => ({
      position: [
        1.35 + (rand() - 0.5) * 0.4,
        0.06 + rand() * 0.045,
        -1.35 + (rand() - 0.5) * 0.4,
      ],
      size: [
        0.07 + rand() * 0.1,
        0.07 + rand() * 0.08,
        0.07 + rand() * 0.1,
      ],
      color: i % 3 === 0 ? COLORS.stoneLight : COLORS.stone,
      rotation: [0, rand() * Math.PI, 0],
    }));
  }, []);

  return (
    <group>
      {stones.map((stone, i) => (
        <Box
          key={i}
          position={stone.position}
          size={stone.size}
          color={stone.color}
          rotation={stone.rotation}
        />
      ))}

      {/* Magical glowing crystal formation at top-right corner */}
      <group position={[1.35, 0.04, -1.35]}>
        <Box
          position={[0, 0.04, 0]}
          size={[0.3, 0.08, 0.22]}
          color={COLORS.stone}
        />
        <Box
          position={[0, 0.1, 0]}
          size={[0.2, 0.06, 0.15]}
          color={COLORS.stoneLight}
        />
        <Box
          position={[0, 0.15, 0]}
          size={[0.11, 0.05, 0.1]}
          color={COLORS.soilLight}
        />

        {/* Glowing crystals */}
        <GlowPixel position={[0, 0.22, 0]} size={0.04} color="#a78bfa" />
        <GlowPixel position={[0.06, 0.18, 0.03]} size={0.03} color="#67e8f9" />
        <GlowPixel position={[-0.05, 0.19, -0.04]} size={0.025} color="#f472b6" />
      </group>

      {/* Enchanted offering garden around the crystal */}
      {[
        [1.25, 0.04, -1.1],
        [1.45, 0.04, -1.05],
        [1.3, 0.04, -1.15],
        [1.4, 0.04, -1.2],
        [1.2, 0.04, -1.25],
        [1.35, 0.04, -1.45],
      ].map((p, i) => (
        <PixelFlower
          key={i}
          position={p}
          scale={0.7}
          color={
            i % 4 === 0
              ? "#a78bfa"
              : i % 3 === 0
                ? "#67e8f9"
                : i % 2
                  ? COLORS.flowerCream
                  : COLORS.flowerPink
          }
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------
// Magical mist/fog particles
// ---------------------------------------------------------

function MagicalMist() {
  const group = useRef();

  const particles = useMemo(() => {
    const rand = seededRandom(999);

    return Array.from({ length: 35 }, (_, i) => ({
      base: [
        (rand() - 0.5) * 3.2,
        0.1 + rand() * 0.8,
        (rand() - 0.5) * 3.2,
      ],
      phase: rand() * Math.PI * 2,
      speed: 0.1 + rand() * 0.3,
      size: 0.15 + rand() * 0.25,
      drift: (rand() - 0.5) * 0.02,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;

    const t = clock.elapsedTime;

    group.current.children.forEach((mesh, i) => {
      const p = particles[i];

      mesh.position.set(
        p.base[0] + Math.sin(t * p.speed + p.phase) * 0.2 + t * p.drift,
        p.base[1] + Math.sin(t * p.speed * 0.7 + p.phase) * 0.15,
        p.base[2] + Math.cos(t * p.speed + p.phase) * 0.2
      );

      // Slowly fade in and out
      if (mesh.material) {
        mesh.material.opacity = 0.08 + Math.sin(t * 0.5 + p.phase) * 0.05;
      }
    });
  });

  return (
    <group ref={group}>
      {particles.map((p, i) => (
        <mesh key={i} position={p.base}>
          <sphereGeometry args={[p.size, 6, 6]} />
          <meshBasicMaterial
            color="#e8f4f8"
            transparent
            opacity={0.1}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------
// Fairy lights / hanging lanterns
// ---------------------------------------------------------

function FairyLights() {
  const group = useRef();

  const lights = useMemo(() => {
    const rand = seededRandom(777);

    const colors = [
      "#fbbf24", // warm gold
      "#fcd34d", // amber
      "#fef3c7", // cream
      "#67e8f9", // cyan
      "#a78bfa", // purple
    ];

    return Array.from({ length: 12 }, (_, i) => ({
      position: [
        (rand() - 0.5) * 2.8,
        1.2 + rand() * 0.8,
        (rand() - 0.5) * 2.8,
      ],
      color: colors[i % colors.length],
      phase: rand() * Math.PI * 2,
      swing: 0.03 + rand() * 0.05,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;

    const t = clock.elapsedTime;

    group.current.children.forEach((mesh, i) => {
      const light = lights[i];

      mesh.position.x = light.position[0] + Math.sin(t * 0.8 + light.phase) * light.swing;
      mesh.position.z = light.position[2] + Math.cos(t * 0.7 + light.phase) * light.swing;

      // Gentle glow pulse
      if (mesh.material) {
        mesh.material.opacity = 0.7 + Math.sin(t * 1.5 + light.phase) * 0.3;
      }
    });
  });

  return (
    <group ref={group}>
      {lights.map((light, i) => (
        <group key={i} position={light.position}>
          {/* Hanging string */}
          <Box
            position={[0, 0.3, 0]}
            size={[0.008, 0.6, 0.008]}
            color="#8b7355"
          />
          {/* Lantern body */}
          <mesh>
            <boxGeometry args={[0.05, 0.08, 0.05]} />
            <meshBasicMaterial
              color={light.color}
              transparent
              opacity={0.8}
              toneMapped={false}
            />
          </mesh>
          {/* Inner glow */}
          <pointLight
            color={light.color}
            intensity={0.3}
            distance={0.8}
          />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------
// Stone statues / sculptures
// ---------------------------------------------------------

function StoneStatue({ position, type = "spirit", rotation = [0, 0, 0] }) {
  if (type === "spirit") {
    return (
      <group position={position} rotation={rotation}>
        {/* Stone base */}
        <Box
          position={[0, 0.1, 0]}
          size={[0.18, 0.2, 0.18]}
          color={COLORS.stone}
        />
        {/* Spirit figure - abstract human-like form */}
        <Box
          position={[0, 0.35, 0]}
          size={[0.08, 0.3, 0.08]}
          color={COLORS.stoneLight}
        />
        <Box
          position={[0, 0.52, 0]}
          size={[0.06, 0.12, 0.06]}
          color={COLORS.stone}
        />
        {/* Glowing eyes */}
        <GlowPixel position={[-0.02, 0.55, 0.04]} size={0.015} color="#67e8f9" />
        <GlowPixel position={[0.02, 0.55, 0.04]} size={0.015} color="#67e8f9" />
        {/* Arms in blessing pose */}
        <Box
          position={[-0.08, 0.38, 0]}
          size={[0.04, 0.15, 0.04]}
          rotation={[0, 0, 0.5]}
          color={COLORS.stoneLight}
        />
        <Box
          position={[0.08, 0.38, 0]}
          size={[0.04, 0.15, 0.04]}
          rotation={[0, 0, -0.5]}
          color={COLORS.stoneLight}
        />
      </group>
    );
  }

  if (type === "animal") {
    return (
      <group position={position} rotation={rotation}>
        {/* Deer-like creature */}
        <Box position={[0, 0.08, 0]} size={[0.12, 0.16, 0.2]} color={COLORS.stone} />
        <Box position={[0, 0.2, 0.08]} size={[0.08, 0.12, 0.1]} color={COLORS.stoneLight} />
        {/* Antlers */}
        <Box position={[-0.04, 0.3, 0.05]} size={[0.02, 0.1, 0.02]} rotation={[0, 0, 0.3]} color={COLORS.stone} />
        <Box position={[0.04, 0.3, 0.05]} size={[0.02, 0.1, 0.02]} rotation={[0, 0, -0.3]} color={COLORS.stone} />
        {/* Legs */}
        <Box position={[-0.04, 0, 0.06]} size={[0.02, 0.1, 0.02]} color={COLORS.stoneLight} />
        <Box position={[0.04, 0, 0.06]} size={[0.02, 0.1, 0.02]} color={COLORS.stoneLight} />
        <Box position={[-0.04, 0, -0.06]} size={[0.02, 0.1, 0.02]} color={COLORS.stoneLight} />
        <Box position={[0.04, 0, -0.06]} size={[0.02, 0.1, 0.02]} color={COLORS.stoneLight} />
      </group>
    );
  }

  return null;
}

// ---------------------------------------------------------
// Floating pixel fireflies
// ---------------------------------------------------------

function Fireflies() {
  const group = useRef();

  const flies = useMemo(() => {
    const rand = seededRandom(427);

    // More variety: magical wisps, fireflies, and spirit particles
    const colors = [
      "#b5f4d4", // mint
      "#f4d477", // gold
      "#a78bfa", // purple
      "#f472b6", // pink
      "#67e8f9", // cyan
      "#fbbf24", // amber
    ];

    return Array.from({ length: 45 }, (_, i) => ({
      base: [
        (rand() - 0.5) * 3.0,
        0.35 + rand() * 1.8,
        (rand() - 0.5) * 3.0,
      ],
      phase: rand() * Math.PI * 2,
      speed: 0.3 + rand() * 1.2,
      color: colors[i % colors.length],
      size: 0.015 + rand() * 0.04,
      amplitude: 0.05 + rand() * 0.15,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;

    const t = clock.elapsedTime;

    group.current.children.forEach((mesh, i) => {
      const fly = flies[i];

      mesh.position.set(
        fly.base[0] + Math.sin(t * fly.speed + fly.phase) * fly.amplitude,
        fly.base[1] + Math.sin(t * fly.speed * 1.3 + fly.phase) * (fly.amplitude * 0.8),
        fly.base[2] + Math.cos(t * fly.speed + fly.phase) * fly.amplitude
      );

      // Pulse opacity for magical effect
      if (mesh.material) {
        mesh.material.opacity = 0.6 + Math.sin(t * 2 + fly.phase) * 0.4;
      }
    });
  });

  return (
    <group ref={group}>
      {flies.map((fly, i) => (
        <mesh key={i} position={fly.base}>
          <boxGeometry args={[fly.size, fly.size, fly.size]} />
          <meshBasicMaterial
            color={fly.color}
            toneMapped={false}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------
// Back-edge foliage
// ---------------------------------------------------------

function BackForest() {
  const trees = [
    { x: -1.22, z: -1.05, s: 0.8, seed: 3 },
    { x: 0.3, z: -1.35, s: 0.65, seed: 5 },
    { x: 1.15, z: -1.0, s: 0.72, seed: 9 },
  ];

  return (
    <group>
      {trees.map((tree, i) => (
        <group key={i} position={[tree.x, 0, tree.z]}>
          <Box
            position={[0, 0.43 * tree.s, 0]}
            size={[0.08 * tree.s, 0.85 * tree.s, 0.08 * tree.s]}
            color={COLORS.trunkDark}
          />
          <PixelCanopy
            position={[0, 0.82 * tree.s, 0]}
            size={0.42 * tree.s}
            seed={tree.seed}
          />
        </group>
      ))}

      <BambooCluster position={[1.22, 0.04, -0.75]} seed={10} />
      <BambooCluster position={[-1.28, 0.04, -0.55]} seed={20} />
    </group>
  );
}

// ---------------------------------------------------------
// Border decoration layout
// ---------------------------------------------------------

function BorderPlants() {
  const plants = [
    // Bottom-left corner area
    { position: [-1.25, 0.035, 1.25], scale: 0.85, seed: 1 },
    { position: [-1.15, 0.035, 1.35], scale: 0.65, seed: 2 },
    // Bottom-right corner area
    { position: [1.25, 0.035, 1.25], scale: 0.72, seed: 3 },
    { position: [1.35, 0.035, 1.15], scale: 0.62, seed: 4 },
    // Top-right corner area (near sacred stones)
    { position: [1.2, 0.035, -1.2], scale: 0.72, seed: 5 },
    { position: [1.3, 0.035, -1.3], scale: 0.78, seed: 6 },
    // Top-left corner area (near spring)
    { position: [-1.2, 0.035, -1.25], scale: 0.78, seed: 7 },
    { position: [-1.3, 0.035, -1.15], scale: 0.65, seed: 8 },
  ];

  return (
    <group>
      {plants.map((plant) => (
        <PixelPlant key={plant.seed} {...plant} />
      ))}

      {/* Mushrooms at the corners */}
      <PixelMushrooms position={[-1.2, 0.04, 1.2]} seed={1} />
      <PixelMushrooms position={[1.2, 0.04, 1.2]} seed={2} />
      <PixelMushrooms position={[1.2, 0.04, -1.2]} seed={3} />
      <PixelMushrooms position={[-1.2, 0.04, -1.2]} seed={4} />

      {/* Flowers at the corners */}
      <PixelFlower
        position={[-1.35, 0.04, 1.35]}
        color={COLORS.flowerPink}
        scale={0.8}
      />
      <PixelFlower
        position={[1.35, 0.04, 1.35]}
        color={COLORS.flowerCream}
        scale={0.8}
      />
      <PixelFlower
        position={[1.35, 0.04, -1.35]}
        color={COLORS.flowerPink}
        scale={0.8}
      />
      <PixelFlower
        position={[-1.35, 0.04, -1.35]}
        color={COLORS.flowerCream}
        scale={0.8}
      />
    </group>
  );
}

// ---------------------------------------------------------
// Lighting
// ---------------------------------------------------------

function SceneLighting() {
  const warmLight = useRef();

  useFrame(({ clock }) => {
    if (warmLight.current) {
      warmLight.current.intensity =
        1.15 + Math.sin(clock.elapsedTime * 0.8) * 0.12;
    }
  });

  return (
    <>
      <ambientLight intensity={1.0} color="#e2eedf" />

      <directionalLight
        position={[-3, 6, 4]}
        intensity={2.0}
        color="#fff0d0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <directionalLight
        position={[3, 4, -3]}
        intensity={0.8}
        color="#a8d8c0"
      />

      <pointLight
        ref={warmLight}
        position={[-0.5, 2.3, -0.8]}
        intensity={1.15}
        color="#f0d18a"
        distance={5}
      />

      <pointLight
        position={[0.8, 1.2, 0.7]}
        intensity={0.55}
        color="#71ddca"
        distance={3.5}
      />
    </>
  );
}

// ---------------------------------------------------------
// Main scene
// ---------------------------------------------------------

export default function DiwataScene() {
  return (
    <group position={[0, ROOT_Y, 0]} rotation={[0, Math.PI / 4, 0]}>
      <SceneLighting />

      {/* QR modules form the landscape itself */}
      <QRFloor />

      {/* Landmarks follow the outer edges of the QR grid */}
      <BackForest />
      <BaleteTree />
      <BorderPlants />
      <Spring />
      <SacredStones />

      {/* Magical statues at the 4 corners */}
      <StoneStatue position={[-1.35, 0.04, 1.35]} type="spirit" rotation={[0, 0.4, 0]} />
      <StoneStatue position={[1.35, 0.04, 1.35]} type="animal" rotation={[0, -0.3, 0]} />
      <StoneStatue position={[-1.35, 0.04, -1.35]} type="animal" rotation={[0, 0.5, 0]} />
      <StoneStatue position={[1.35, 0.04, -1.35]} type="spirit" rotation={[0, -0.2, 0]} />

      {/* Enchanted atmosphere */}
      <MagicalMist />
      <FairyLights />

      {/* Pixel lights give the diorama a subtle enchanted quality */}
      <Fireflies />
    </group>
  );
}