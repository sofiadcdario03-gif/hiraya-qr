
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/*
 * CoralScene — Coral Kingdom PH
 *
 * • 25 × 25 QR module grid forms the reef floor.
 * • Raised dark modules create coral-colored terrain.
 * • Three finder-pattern corners contain distinct reef landmarks.
 * • Large central coral kingdom with branching coral towers,
 *   brain coral, sea fans, seaweed, shells, and tropical fish.
 * • Tiny coral, shell, seaweed, starfish, and fish details
 *   decorate the outer QR border.
 * • Animated fish, bubbles, and underwater lighting.
 */

// ─── Constants ──────────────────────────────────────────────────

const GRID = 25;
const TILE = 0.118;
const HALF = (GRID * TILE) / 2;
const ROOT_Y = -0.45;

const H_BASE = 0.022;
const H_DARK = 0.072;
const H_FINDER = 0.095;
const H_ACCENT = 0.055;

// ─── Material cache ──────────────────────────────────────────────

const materialCache = new Map();

function mat(color, roughness = 0.8, extra = {}) {
  const key = `${color}|${roughness}|${JSON.stringify(extra)}`;

  if (!materialCache.has(key)) {
    materialCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        flatShading: true,
        ...extra,
      })
    );
  }

  return materialCache.get(key);
}

// ─── Seeded random generator ─────────────────────────────────────

function rng(seed) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

// ─── QR matrix ───────────────────────────────────────────────────

function inFinder(x, z, ox, oz) {
  return (
    x >= ox &&
    x < ox + 7 &&
    z >= oz &&
    z < oz + 7
  );
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

  const matrix = Array.from(
    { length: GRID },
    () => Array(GRID).fill(false)
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
        pattern < 6
          ? random() > 0.22
          : random() > 0.73;
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

// ─── Color helpers ───────────────────────────────────────────────

function blendHex(a, b, factor) {
  const ah = parseInt(a.replace("#", ""), 16);
  const bh = parseInt(b.replace("#", ""), 16);

  const ar = (ah >> 16) & 0xff;
  const ag = (ah >> 8) & 0xff;
  const ab = ah & 0xff;

  const br = (bh >> 16) & 0xff;
  const bg = (bh >> 8) & 0xff;
  const bb = bh & 0xff;

  const r = Math.round(ar + (br - ar) * factor);
  const g = Math.round(ag + (bg - ag) * factor);
  const blue = Math.round(ab + (bb - ab) * factor);

  return `#${((r << 16) | (g << 8) | blue)
    .toString(16)
    .padStart(6, "0")}`;
}

function lighten(hex, factor) {
  return blendHex(hex, "#ffffff", factor);
}

function darken(hex, factor) {
  return blendHex(hex, "#000000", factor);
}

function resolveColors(theme = {}) {
  const coral = theme.primary || "#f472b6";
  const aqua = theme.secondary || "#0e5f76";
  const gold = theme.accent || "#fbbf24";
  const light = theme.light || "#e0fafa";

  return {
    modDark: coral,
    modDarkAlt: darken(coral, 0.15),
    modLight: light,
    base: lighten(light, 0.06),

    soil: darken(coral, 0.45),
    soilLight: darken(coral, 0.3),

    gold,
    goldLight: lighten(gold, 0.25),

    coral,
    coralDark: darken(coral, 0.4),
    coralLight: lighten(coral, 0.2),
    coralPink: "#ff83bd",
    coralOrange: "#ff945c",
    coralPurple: "#b28bff",
    coralRed: "#ff665f",
    coralYellow: "#ffd76b",

    stone: "#6b5a4e",
    stoneLight: "#9e8a7a",

    aqua,
    aquaDark: darken(aqua, 0.35),
    aquaLight: lighten(aqua, 0.25),

    teal: "#0d9488",
    tealDark: darken("#0d9488", 0.4),
    tealLight: lighten("#0d9488", 0.25),

    ocean: "#145578",
    oceanDark: "#062d48",
    sand: "#f5deb3",
    sandDark: darken("#f5deb3", 0.2),

    water: "#4fc3f7",
    waterLight: "#81d4fa",
    white: "#ffffff",

    seaweed: "#22c55e",
    seaweedDark: darken("#22c55e", 0.35),
  };
}

// ─── Basic geometry components ───────────────────────────────────

function Box({
  pos,
  size,
  color,
  rot = [0, 0, 0],
  shadow = true,
}) {
  return (
    <mesh
      position={pos}
      scale={size}
      rotation={rot}
      material={mat(color)}
      castShadow={shadow}
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}

function Cone({
  pos,
  rTop,
  rBot,
  h,
  segs = 6,
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
      <cylinderGeometry args={[rTop, rBot, h, segs]} />
    </mesh>
  );
}

function GlowPx({ pos, color, size = 0.04 }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;

    const pulse =
      0.88 +
      Math.sin(clock.elapsedTime * 2.4 + pos[0] * 3) * 0.12;

    ref.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={ref} position={pos}>
      <boxGeometry args={[size, size, size]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

// ─── Organic coral branch ────────────────────────────────────────

function Branch({ start, end, radius = 0.025, color }) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);

  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  const midpoint = new THREE.Vector3()
    .addVectors(a, b)
    .multiplyScalar(0.5);

  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );

  return (
    <mesh
      position={midpoint}
      quaternion={quaternion}
      material={mat(color)}
      castShadow
    >
      <cylinderGeometry
        args={[radius * 0.72, radius, length, 7]}
      />
    </mesh>
  );
}

function BranchingCoral({
  position,
  scale = 1,
  color,
  accent,
}) {
  const branches = [
    [[0, 0, 0], [-0.1, 0.32, 0], 0.075],
    [[0, 0, 0], [0.12, 0.36, 0.015], 0.07],
    [[-0.1, 0.32, 0], [-0.27, 0.49, 0.02], 0.048],
    [[-0.1, 0.32, 0], [-0.04, 0.57, 0], 0.043],
    [[0.12, 0.36, 0.015], [0.29, 0.51, 0], 0.046],
    [[0.12, 0.36, 0.015], [0.1, 0.6, 0.02], 0.04],
    [[-0.27, 0.49, 0.02], [-0.36, 0.62, 0], 0.027],
    [[0.29, 0.51, 0], [0.39, 0.62, 0.02], 0.026],
  ];

  return (
    <group position={position} scale={scale}>
      {branches.map(([start, end, radius], i) => (
        <Branch
          key={i}
          start={start}
          end={end}
          radius={radius}
          color={i % 3 === 0 ? accent || color : color}
        />
      ))}

      {[
        [-0.36, 0.62, 0],
        [-0.04, 0.57, 0],
        [0.1, 0.6, 0.02],
        [0.39, 0.62, 0.02],
      ].map((position, i) => (
        <mesh
          key={i}
          position={position}
          material={mat(i % 2 ? color : accent || color)}
        >
          <sphereGeometry args={[0.045, 8, 8]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Brain coral ─────────────────────────────────────────────────

function BrainCoral({ position, scale = 1, color }) {
  return (
    <group position={position} scale={scale}>
      <mesh
        position={[0, 0.15, 0]}
        scale={[1.15, 0.8, 1]}
        material={mat(color)}
        castShadow
      >
        <dodecahedronGeometry args={[0.27, 2]} />
      </mesh>

      {Array.from({ length: 9 }, (_, i) => {
        const angle = (i / 9) * Math.PI * 2;

        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * 0.16,
              0.18 + Math.sin(i * 2) * 0.035,
              Math.sin(angle) * 0.16,
            ]}
            scale={[0.8, 0.65, 0.8]}
            material={mat(color)}
          >
            <sphereGeometry args={[0.105, 8, 8]} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Sea fan ─────────────────────────────────────────────────────

function SeaFan({ position, scale = 1, color }) {
  const ribs = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const t = i / 10;
        const angle = -Math.PI * 0.82 + t * Math.PI * 0.64;

        return [
          [0, 0.04, 0],
          [
            Math.cos(angle) * 0.42,
            0.45 + Math.sin(t * Math.PI) * 0.12,
            0,
          ],
        ];
      }),
    []
  );

  return (
    <group position={position} scale={scale}>
      <Branch
        start={[0, 0, 0]}
        end={[0, 0.44, 0]}
        radius={0.025}
        color={color}
      />

      {ribs.map(([start, end], i) => (
        <Branch
          key={i}
          start={start}
          end={end}
          radius={0.012}
          color={color}
        />
      ))}

      <Branch
        start={[-0.42, 0.43, 0]}
        end={[0.42, 0.43, 0]}
        radius={0.014}
        color={color}
      />
    </group>
  );
}

// ─── Sea anemone ─────────────────────────────────────────────────

function Anemone({ position, color, scale = 1, accent }) {
  return (
    <group position={position} scale={scale}>
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const length = 0.24 + (i % 3) * 0.055;
        const x = Math.cos(angle) * 0.13;
        const z = Math.sin(angle) * 0.13;

        return (
          <group key={i}>
            <Branch
              start={[0, 0.08, 0]}
              end={[x * 1.8, length, z * 1.8]}
              radius={0.018}
              color={color}
            />

            <mesh
              position={[x * 1.8, length, z * 1.8]}
              material={mat(accent || COLORS.gold)}
            >
              <sphereGeometry args={[0.03, 8, 8]} />
            </mesh>
          </group>
        );
      })}

      <mesh position={[0, 0.07, 0]} material={mat(color)}>
        <sphereGeometry args={[0.13, 10, 10]} />
      </mesh>
    </group>
  );
}

// ─── Seaweed ─────────────────────────────────────────────────────

function Seaweed({ position, scale = 1, color, accent }) {
  const blades = [
    [-0.1, 0.48, -0.03],
    [0.08, 0.65, 0.02],
    [0.22, 0.42, 0.04],
  ];

  return (
    <group position={position} scale={scale}>
      {blades.map((tip, i) => (
        <group key={i}>
          <Branch
            start={[0, 0, 0]}
            end={tip}
            radius={0.035}
            color={color}
          />

          <mesh position={tip} material={mat(accent || color)}>
            <sphereGeometry args={[0.055, 8, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Swimming tropical fish ──────────────────────────────────────

function Fish({
  position,
  color,
  scale = 1,
  speed = 1,
  phase = 0,
}) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;

    const t = clock.elapsedTime * speed + phase;

    ref.current.position.x = position[0] + Math.sin(t) * 0.38;
    ref.current.position.y =
      position[1] + Math.sin(t * 2) * 0.055;

    ref.current.rotation.y = Math.cos(t) < 0 ? Math.PI : 0;
  });

  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh material={mat(color)}>
        <sphereGeometry args={[0.105, 12, 10]} />
      </mesh>

      <mesh
        position={[-0.1, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        material={mat(color)}
      >
        <coneGeometry args={[0.075, 0.13, 4]} />
      </mesh>

      <mesh position={[0.015, 0.025, 0.087]}>
        <sphereGeometry args={[0.014, 6, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      <mesh position={[0.018, 0.025, 0.099]}>
        <sphereGeometry args={[0.007, 6, 6]} />
        <meshBasicMaterial color="#123044" />
      </mesh>

      <mesh
        position={[0.015, -0.065, 0]}
        rotation={[0, 0, -0.3]}
        material={mat(lighten(color, 0.18))}
      >
        <coneGeometry args={[0.045, 0.09, 4]} />
      </mesh>
    </group>
  );
}

// ─── Animated ocean bubbles ──────────────────────────────────────

function OceanBubbles({ C }) {
  const group = useRef();

  const bubbles = useMemo(() => {
    const random = rng(8888);

    return Array.from({ length: 18 }, (_, i) => ({
      base: [
        (random() - 0.5) * 2.7,
        0.15 + random() * 1.0,
        (random() - 0.5) * 2.7,
      ],
      phase: random() * Math.PI * 2,
      speed: 0.35 + random() * 0.7,
      size: 0.012 + random() * 0.018,
      color: i % 2 === 0 ? C.waterLight : C.aquaLight,
    }));
  }, [C]);

  useFrame(({ clock }) => {
    if (!group.current) return;

    const t = clock.elapsedTime;

    group.current.children.forEach((mesh, i) => {
      const bubble = bubbles[i];

      mesh.position.set(
        bubble.base[0] +
          Math.sin(t * bubble.speed + bubble.phase) * 0.07,
        bubble.base[1] +
          ((t * bubble.speed * 0.35) % 0.7),
        bubble.base[2] +
          Math.cos(t * bubble.speed + bubble.phase) * 0.06
      );

      if (mesh.material) {
        mesh.material.opacity =
          0.35 + (Math.sin(t * 2 + bubble.phase) + 1) * 0.2;
      }
    });
  });

  return (
    <group ref={group}>
      {bubbles.map((bubble, i) => (
        <mesh key={i} position={bubble.base}>
          <sphereGeometry args={[bubble.size, 8, 8]} />
          <meshBasicMaterial
            color={bubble.color}
            toneMapped={false}
            transparent
            opacity={0.55}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── QR ground ───────────────────────────────────────────────────

function QRGround({ matrix, C }) {
  const modules = useMemo(() => {
    const items = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const wx = (x - (GRID - 1) / 2) * TILE;
        const wz = (z - (GRID - 1) / 2) * TILE;

        const finder = isFinderZone(x, z);
        const timing = (z === 6 || x === 6) && !finder;
        const dark = matrix[z][x];

        let h;
        let color;

        if (finder) {
          h = H_FINDER;
          color = dark ? C.modDark : C.modLight;
        } else if (timing) {
          h = dark ? H_ACCENT : H_BASE;
          color = dark ? C.modDarkAlt : C.base;
        } else {
          h = dark ? H_DARK : H_BASE;
          color = dark
            ? (x + z) % 4 === 0
              ? C.modDarkAlt
              : C.modDark
            : C.base;
        }

        items.push({
          x: wx,
          z: wz,
          h,
          color,
          size: finder ? 0.96 : 0.9,
        });
      }
    }

    return items;
  }, [matrix, C]);

  const tiles = useMemo(
    () =>
      Array.from({ length: GRID * GRID }, (_, i) => {
        const x = i % GRID;
        const z = Math.floor(i / GRID);

        return {
          id: i,
          x: (x - (GRID - 1) / 2) * TILE,
          z: (z - (GRID - 1) / 2) * TILE,
          color:
            (x + z) % 7 === 0
              ? darken(C.base, 0.05)
              : C.base,
        };
      }),
    [C]
  );

  return (
    <group>
      {/* Solid backing */}
      <Box
        pos={[0, -0.06, 0]}
        size={[GRID * TILE + 0.12, 0.12, GRID * TILE + 0.12]}
        color={C.base}
        shadow={false}
      />

      {/* Base tile grid */}
      {tiles.map((tile) => (
        <Box
          key={tile.id}
          pos={[tile.x, H_BASE * 0.5, tile.z]}
          size={[TILE * 0.93, H_BASE, TILE * 0.93]}
          color={tile.color}
          shadow={false}
        />
      ))}

      {/* Raised QR modules */}
      {modules
        .filter((module) => module.h > H_BASE)
        .map((module, i) => (
          <Box
            key={i}
            pos={[module.x, module.h * 0.5, module.z]}
            size={[
              TILE * module.size,
              module.h,
              TILE * module.size,
            ]}
            color={module.color}
          />
        ))}

      {/* Border around the QR reef */}
      {[
        [0, -0.09, -HALF - 0.055, [GRID * TILE + 0.2, 0.09, 0.1]],
        [0, -0.09, HALF + 0.055, [GRID * TILE + 0.2, 0.09, 0.1]],
        [-HALF - 0.055, -0.09, 0, [0.1, 0.09, GRID * TILE]],
        [HALF + 0.055, -0.09, 0, [0.1, 0.09, GRID * TILE]],
      ].map(([x, y, z, size], i) => (
        <Box
          key={i}
          pos={[x, y, z]}
          size={size}
          color={C.soil}
        />
      ))}

      <Box
        pos={[0, -0.18, 0]}
        size={[GRID * TILE + 0.16, 0.12, GRID * TILE + 0.16]}
        color={C.soilLight}
      />

      <Box
        pos={[0, -0.28, 0]}
        size={[GRID * TILE + 0.12, 0.1, GRID * TILE + 0.12]}
        color={C.soil}
      />

      {/* Gold corner markers */}
      {[
        [-HALF - 0.035, -HALF - 0.035],
        [HALF + 0.035, -HALF - 0.035],
        [-HALF - 0.035, HALF + 0.035],
        [HALF + 0.035, HALF + 0.035],
      ].map(([x, z], i) => (
        <Box
          key={i}
          pos={[x, 0.018, z]}
          size={[0.13, 0.055, 0.13]}
          color={C.gold}
        />
      ))}
    </group>
  );
}

// ─── Central Coral Kingdom ───────────────────────────────────────

function CoralReefCentre({ C }) {
  const fishRefs = useRef([]);
  const bubbleRefs = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    fishRefs.current.forEach((fish, i) => {
      if (!fish) return;

      const angle = t * (0.42 + i * 0.06) + i * 1.7;
      fish.position.x = Math.sin(angle) * (0.66 + (i % 2) * 0.1);
      fish.position.y =
        0.55 + (i % 3) * 0.13 + Math.sin(angle * 1.8) * 0.06;
      fish.rotation.y = Math.cos(angle) < 0 ? Math.PI : 0;
    });

    bubbleRefs.current.forEach((bubble, i) => {
      if (!bubble) return;

      const angle = i * 2.4;
      const radius = 0.68 + (i % 3) * 0.1;

      bubble.position.x =
        Math.cos(angle) * radius + Math.sin(t * 1.2 + i) * 0.04;

      bubble.position.z = Math.sin(angle) * radius * 0.7;
      bubble.position.y = 0.15 + ((t * 0.3 + i * 0.13) % 0.95);

      if (bubble.material) {
        bubble.material.opacity =
          0.35 + (Math.sin(t * 2 + i) + 1) * 0.2;
      }
    });
  });

  const towers = [
    { x: -0.62, z: 0.05, h: 0.86, color: C.coralRed, scale: 0.88 },
    { x: -0.35, z: -0.24, h: 1.08, color: C.coralPurple, scale: 1.0 },
    { x: 0.0, z: -0.1, h: 1.3, color: C.coralPink, scale: 1.1 },
    { x: 0.38, z: -0.18, h: 1.08, color: C.coralOrange, scale: 0.98 },
    { x: 0.63, z: 0.15, h: 0.82, color: C.coralYellow, scale: 0.86 },
    { x: -0.52, z: 0.3, h: 0.68, color: C.aquaLight, scale: 0.8 },
  ];

  const fish = [
    { color: C.gold, scale: 0.8 },
    { color: C.aquaLight, scale: 0.72 },
    { color: C.coralOrange, scale: 0.7 },
    { color: C.white, scale: 0.58 },
    { color: C.coralPurple, scale: 0.62 },
  ];

  return (
    <group position={[0, H_DARK, 0]}>
      {/* Large organic reef foundation */}
      <mesh
        position={[0, 0.12, 0]}
        scale={[1.28, 0.43, 1.0]}
        material={mat(C.stone)}
        castShadow
        receiveShadow
      >
        <dodecahedronGeometry args={[0.7, 2]} />
      </mesh>

      <mesh
        position={[-0.48, 0.13, 0.15]}
        scale={[1.0, 0.48, 0.82]}
        material={mat(C.stoneLight)}
        castShadow
      >
        <icosahedronGeometry args={[0.46, 2]} />
      </mesh>

      <mesh
        position={[0.48, 0.13, -0.15]}
        scale={[1.0, 0.44, 0.82]}
        material={mat(C.aquaDark)}
        castShadow
      >
        <dodecahedronGeometry args={[0.47, 2]} />
      </mesh>

      {/* Tiered rock shelves */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * 0.68;
        const z = Math.sin(angle) * 0.55;

        return (
          <mesh
            key={i}
            position={[x, 0.17 + (i % 2) * 0.04, z]}
            scale={[0.38, 0.18, 0.32]}
            material={mat(i % 2 ? C.stoneLight : C.stone)}
          >
            <dodecahedronGeometry args={[0.45, 1]} />
          </mesh>
        );
      })}

      {/* Tall colorful coral towers */}
      {towers.map((tower, i) => (
        <group
          key={i}
          position={[tower.x, 0.17, tower.z]}
          scale={tower.scale}
        >
          <Cone
            pos={[0, tower.h * 0.35, 0]}
            rTop={0.025}
            rBot={0.14}
            h={tower.h * 0.7}
            segs={7}
            color={tower.color}
            rot={[0.02, 0, i % 2 ? -0.1 : 0.1]}
          />

          <BranchingCoral
            position={[-0.03, tower.h * 0.38, 0.015]}
            scale={0.95 + (i % 2) * 0.16}
            color={tower.color}
            accent={i % 2 ? C.gold : C.coralLight}
          />

          <Cone
            pos={[-0.12, tower.h * 0.68, 0.02]}
            rTop={0.008}
            rBot={0.055}
            h={tower.h * 0.35}
            segs={6}
            color={i % 2 ? C.gold : C.coralLight}
            rot={[0, 0, 0.32]}
          />

          <Cone
            pos={[0.13, tower.h * 0.73, -0.01]}
            rTop={0.006}
            rBot={0.05}
            h={tower.h * 0.32}
            segs={6}
            color={i % 2 ? C.aquaLight : C.coralPink}
            rot={[0, 0, -0.34]}
          />

          {[0, 1, 2].map((j) => (
            <mesh
              key={j}
              position={[
                (j - 1) * 0.09,
                tower.h * (0.8 + (j % 2) * 0.07),
                0.025,
              ]}
              material={mat(
                [C.coralYellow, C.coralPink, C.aquaLight][(i + j) % 3]
              )}
            >
              <sphereGeometry args={[0.05, 8, 8]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Large brain coral colonies */}
      <BrainCoral
        position={[-0.73, 0.17, 0.37]}
        scale={0.95}
        color={C.coralPurple}
      />

      <BrainCoral
        position={[0.54, 0.17, 0.39]}
        scale={0.85}
        color={C.coralYellow}
      />

      <BrainCoral
        position={[0.02, 0.17, 0.55]}
        scale={0.78}
        color={C.coralRed}
      />

      <BrainCoral
        position={[-0.37, 0.17, -0.48]}
        scale={0.76}
        color={C.aqua}
      />

      {/* Giant sea fans */}
      <SeaFan
        position={[-0.87, 0.18, -0.16]}
        scale={1.25}
        color={C.coralOrange}
      />

      <SeaFan
        position={[0.84, 0.18, -0.2]}
        scale={1.15}
        color={C.coralPurple}
      />

      {/* Colorful anemones */}
      <Anemone
        position={[0.0, 0.19, 0.77]}
        color={C.aquaLight}
        accent={C.gold}
        scale={0.88}
      />

      <Anemone
        position={[-0.82, 0.18, 0.18]}
        color={C.coralPink}
        accent={C.coralYellow}
        scale={0.64}
      />

      <Anemone
        position={[0.77, 0.18, 0.05]}
        color={C.coralOrange}
        accent={C.white}
        scale={0.65}
      />

      {/* Seaweed garden surrounding the reef */}
      {Array.from({ length: 9 }, (_, i) => {
        const angle = (i / 9) * Math.PI * 2;
        const x = Math.cos(angle) * 0.93;
        const z = Math.sin(angle) * 0.72;

        return (
          <Seaweed
            key={i}
            position={[x, 0.13, z]}
            scale={0.65 + (i % 3) * 0.15}
            color={i % 2 ? C.seaweed : C.seaweedDark}
            accent={C.aquaLight}
          />
        );
      })}

      {/* Miniature shells around the foundation */}
      {Array.from({ length: 16 }, (_, i) => {
        const angle = i * 2.4;
        const radius = 0.74 + (i % 3) * 0.075;

        return (
          <group
            key={i}
            position={[
              Math.cos(angle) * radius,
              0.2 + (i % 2) * 0.025,
              Math.sin(angle) * radius * 0.73,
            ]}
            rotation={[0, angle, 0]}
          >
            <Cone
              pos={[0, 0.025, 0]}
              rTop={0}
              rBot={0.055}
              h={0.055}
              segs={7}
              color={i % 2 ? C.white : C.coralLight}
            />

            <GlowPx
              pos={[0, 0.055, 0]}
              color={C.goldLight}
              size={0.012}
            />
          </group>
        );
      })}

      {/* Swimming fish around the coral towers */}
      {fish.map((item, i) => (
        <group
          key={i}
          ref={(el) => {
            fishRefs.current[i] = el;
          }}
          position={[
            (i - 2) * 0.12,
            0.55 + (i % 3) * 0.13,
            i % 2 ? 0.52 : -0.42,
          ]}
          scale={item.scale}
        >
          <mesh material={mat(item.color)}>
            <sphereGeometry args={[0.085, 10, 8]} />
          </mesh>

          <Cone
            pos={[-0.1, 0, 0]}
            rTop={0}
            rBot={0.05}
            h={0.09}
            segs={4}
            color={item.color}
            rot={[0, 0, Math.PI / 2]}
          />

          <mesh position={[0.02, 0.02, 0.073]}>
            <sphereGeometry args={[0.011, 6, 6]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}

      {/* Bubble streams around the coral kingdom */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            bubbleRefs.current[i] = el;
          }}
          position={[
            Math.cos(i * 2.4) * (0.68 + (i % 3) * 0.1),
            0.15 + (i % 4) * 0.08,
            Math.sin(i * 2.4) * 0.48,
          ]}
        >
          <sphereGeometry args={[0.018 + (i % 3) * 0.006, 8, 8]} />
          <meshBasicMaterial
            color={C.waterLight}
            transparent
            opacity={0.55}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Warm and cool reef lighting */}
      <pointLight
        position={[0, 0.9, 0.2]}
        color={C.aquaLight}
        intensity={1.5}
        distance={3.0}
      />

      <pointLight
        position={[-0.55, 0.55, 0.25]}
        color={C.coralPink}
        intensity={0.7}
        distance={2.5}
      />

      <pointLight
        position={[0.55, 0.6, -0.2]}
        color={C.gold}
        intensity={0.65}
        distance={2.3}
      />
    </group>
  );
}

// ─── Finder landmark: Coral garden ───────────────────────────────

function FinderCoralGarden({ C }) {
  const cx = (3 - (GRID - 1) / 2) * TILE;
  const cz = (3 - (GRID - 1) / 2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      <Box
        pos={[0, 0.02, 0]}
        size={[0.18, 0.04, 0.18]}
        color={C.stone}
      />

      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;

        return (
          <group
            key={i}
            position={[
              Math.cos(angle) * 0.065,
              0.04,
              Math.sin(angle) * 0.065,
            ]}
          >
            <Cone
              pos={[0, 0.03, 0]}
              rTop={0}
              rBot={0.02}
              h={0.05}
              segs={5}
              color={C.coral}
            />

            <Cone
              pos={[0, 0.07, 0]}
              rTop={0}
              rBot={0.012}
              h={0.04}
              segs={4}
              color={C.coralDark}
            />
          </group>
        );
      })}

      <Seaweed
        position={[-0.07, 0.04, 0.04]}
        scale={0.32}
        color={C.seaweed}
      />

      <GlowPx
        pos={[0, 0.12, 0]}
        color={C.gold}
        size={0.015}
      />

      <pointLight
        position={[0, 0.3, 0]}
        color={C.gold}
        intensity={0.45}
        distance={0.8}
      />
    </group>
  );
}

// ─── Finder landmark: Shell cluster ──────────────────────────────

function FinderShellCluster({ C }) {
  const cx = (GRID - 4 - (GRID - 1) / 2) * TILE;
  const cz = (3 - (GRID - 1) / 2) * TILE;

  const shells = useMemo(() => {
    const random = rng(7777);

    return Array.from({ length: 6 }, (_, i) => ({
      x: (random() - 0.5) * 0.1,
      z: (random() - 0.5) * 0.1,
      color: i % 2 === 0 ? C.white : C.coralLight,
    }));
  }, [C.white, C.coralLight]);

  return (
    <group position={[cx, H_FINDER, cz]}>
      <Box
        pos={[0, 0.02, 0]}
        size={[0.16, 0.04, 0.16]}
        color={C.sand}
      />

      {shells.map((shell, i) => (
        <group
          key={i}
          position={[shell.x, 0.05, shell.z]}
        >
          <Cone
            pos={[0, 0.02, 0]}
            rTop={0}
            rBot={0.015}
            h={0.025}
            segs={5}
            color={shell.color}
          />

          <GlowPx
            pos={[0, 0.05, 0]}
            color={C.gold}
            size={0.006}
          />
        </group>
      ))}

      <Cone
        pos={[0, 0.04, 0]}
        rTop={0}
        rBot={0.02}
        h={0.04}
        segs={5}
        color={C.coral}
      />

      <GlowPx
        pos={[0, 0.09, 0]}
        color={C.goldLight}
        size={0.018}
      />

      <pointLight
        position={[0, 0.3, 0]}
        color={C.gold}
        intensity={0.45}
        distance={0.8}
      />
    </group>
  );
}

// ─── Finder landmark: Sea fan ────────────────────────────────────

function FinderSeaFan({ C }) {
  const cx = (3 - (GRID - 1) / 2) * TILE;
  const cz = (GRID - 4 - (GRID - 1) / 2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      <Box
        pos={[0, 0.02, 0]}
        size={[0.16, 0.04, 0.16]}
        color={C.stone}
      />

      <SeaFan
        position={[0, 0.04, 0]}
        scale={0.25}
        color={C.coralLight}
      />

      <Cone
        pos={[0, 0.06, 0]}
        rTop={0}
        rBot={0.02}
        h={0.06}
        segs={5}
        color={C.coral}
      />

      <GlowPx
        pos={[0, 0.13, 0]}
        color={C.gold}
        size={0.02}
      />

      <pointLight
        position={[0, 0.3, 0]}
        color={C.gold}
        intensity={0.45}
        distance={0.8}
      />
    </group>
  );
}

// ─── Border reef details ─────────────────────────────────────────

function BorderReefDecor({ matrix, C }) {
  const items = useMemo(() => {
    const random = rng(68421);
    const result = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (!matrix[z][x]) continue;
        if (isFinderZone(x, z)) continue;
        if (x === 6 || z === 6) continue;

        const edge = Math.min(
          x,
          z,
          GRID - 1 - x,
          GRID - 1 - z
        );

        if (edge > 2) continue;
        if (random() > 0.68) continue;

        result.push({
          x: (x - (GRID - 1) / 2) * TILE,
          z: (z - (GRID - 1) / 2) * TILE,
          kind: Math.floor(random() * 5),
          scale: 0.65 + random() * 0.5,
          rotation: random() * Math.PI * 2,
        });
      }
    }

    return result;
  }, [matrix]);

  return (
    <group>
      {items.map((item, i) => (
        <group
          key={i}
          position={[item.x, H_DARK, item.z]}
          scale={item.scale}
        >
          {/* Branching mini coral */}
          {item.kind === 0 && (
            <BranchingCoral
              position={[0, 0.015, 0]}
              scale={0.22}
              color={C.coralLight}
              accent={C.coralDark}
            />
          )}

          {/* Tiny shells */}
          {item.kind === 1 && (
            <group rotation={[0, item.rotation, 0]}>
              <Cone
                pos={[0, 0.015, 0]}
                rTop={0}
                rBot={0.02}
                h={0.025}
                segs={6}
                color={C.white}
              />

              <GlowPx
                pos={[0, 0.035, 0]}
                color={C.goldLight}
                size={0.009}
              />
            </group>
          )}

          {/* Seaweed */}
          {item.kind === 2 && (
            <Seaweed
              position={[0, 0.01, 0]}
              scale={0.24}
              color={C.seaweed}
              accent={C.seaweedDark}
            />
          )}

          {/* Small starfish-like reef ornament */}
          {item.kind === 3 && (
            <group rotation={[0, item.rotation, 0]}>
              <mesh position={[0, 0.02, 0]}>
                <dodecahedronGeometry args={[0.025, 0]} />
                <meshStandardMaterial color={C.coralOrange} />
              </mesh>

              {Array.from({ length: 5 }, (_, j) => {
                const angle = (j / 5) * Math.PI * 2;

                return (
                  <Cone
                    key={j}
                    pos={[
                      Math.cos(angle) * 0.028,
                      0.018,
                      Math.sin(angle) * 0.028,
                    ]}
                    rTop={0}
                    rBot={0.009}
                    h={0.025}
                    segs={4}
                    color={C.coralOrange}
                    rot={[0, -angle, 0]}
                  />
                );
              })}
            </group>
          )}

          {/* Miniature fish */}
          {item.kind === 4 && (
            <group rotation={[0, item.rotation, 0]}>
              <Box
                pos={[0, 0.025, 0]}
                size={[0.055, 0.024, 0.03]}
                color={C.aquaLight}
                shadow={false}
              />

              <Cone
                pos={[-0.04, 0.025, 0]}
                rTop={0}
                rBot={0.017}
                h={0.035}
                segs={4}
                color={C.gold}
                rot={[0, 0, Math.PI / 2]}
              />

              <GlowPx
                pos={[0.015, 0.04, 0.02]}
                color={C.white}
                size={0.007}
              />
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

// ─── Tiny decorations on dark QR modules ─────────────────────────

function DarkModuleDecor({ matrix, C }) {
  const items = useMemo(() => {
    const random = rng(9999);
    const result = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (!matrix[z][x]) continue;
        if (isFinderZone(x, z)) continue;
        if (x === 6 || z === 6) continue;

        const dx = Math.abs(x - (GRID - 1) / 2);
        const dz = Math.abs(z - (GRID - 1) / 2);

        // Leave enough space around the central reef.
        if (dx < 5 && dz < 5) continue;

        // Keep the border for its dedicated decorations.
        const edge = Math.min(
          x,
          z,
          GRID - 1 - x,
          GRID - 1 - z
        );

        if (edge <= 2) continue;
        if (random() > 0.13) continue;

        result.push({
          x: (x - (GRID - 1) / 2) * TILE,
          z: (z - (GRID - 1) / 2) * TILE,
          kind: Math.floor(random() * 3),
        });
      }
    }

    return result;
  }, [matrix]);

  return (
    <group>
      {items.map((item, i) => (
        <group
          key={i}
          position={[item.x, H_DARK, item.z]}
        >
          {item.kind === 0 && (
            <group>
              <Cone
                pos={[0, 0.02, 0]}
                rTop={0}
                rBot={0.012}
                h={0.03}
                segs={5}
                color={C.coral}
              />

              <Cone
                pos={[0.01, 0.04, 0]}
                rTop={0}
                rBot={0.007}
                h={0.025}
                segs={4}
                color={C.coralDark}
              />
            </group>
          )}

          {item.kind === 1 && (
            <Cone
              pos={[0, 0.015, 0]}
              rTop={0}
              rBot={0.011}
              h={0.02}
              segs={5}
              color={C.white}
            />
          )}

          {item.kind === 2 && (
            <>
              <Box
                pos={[0, 0.02, 0]}
                size={[0.008, 0.04, 0.008]}
                color={C.seaweedDark}
              />

              <Cone
                pos={[0, 0.045, 0]}
                rTop={0}
                rBot={0.006}
                h={0.03}
                segs={4}
                color={C.seaweed}
              />
            </>
          )}
        </group>
      ))}
    </group>
  );
}

// ─── Scene lighting ──────────────────────────────────────────────

function SceneLighting({ C }) {
  const oceanLight = useRef();

  useFrame(({ clock }) => {
    if (!oceanLight.current) return;

    oceanLight.current.intensity =
      1.0 + Math.sin(clock.elapsedTime * 0.5) * 0.15;
  });

  return (
    <>
      <ambientLight intensity={0.85} color="#a8d8e0" />

      <hemisphereLight
        args={["#b8f1ff", "#153b4c", 1.1]}
      />

      <directionalLight
        position={[-2, 7, 4]}
        intensity={1.8}
        color="#e0f7fa"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <directionalLight
        position={[3, 5, -4]}
        intensity={0.8}
        color="#7dd3fc"
      />

      <pointLight
        ref={oceanLight}
        position={[1, 3, 1]}
        color={C.aqua}
        intensity={1.2}
        distance={5}
      />

      <pointLight
        position={[-1.5, 1.5, -1]}
        color={C.coralPink}
        intensity={0.45}
        distance={4}
      />
    </>
  );
}

// ─── Main scene ──────────────────────────────────────────────────

export default function CoralScene({ themeColors }) {
  const matrix = useMemo(buildMatrix, []);

  const C = useMemo(
    () => resolveColors(themeColors),
    [themeColors]
  );

  const sceneRef = useRef();

  useFrame(({ clock }) => {
    if (sceneRef.current) {
      sceneRef.current.position.y =
        ROOT_Y + Math.sin(clock.elapsedTime * 0.45) * 0.018;
    }
  });

  return (
    <group
      ref={sceneRef}
      position={[0, ROOT_Y, 0]}
      rotation={[0, Math.PI / 4, 0]}
    >
      <SceneLighting C={C} />

      <QRGround matrix={matrix} C={C} />

      <CoralReefCentre C={C} />

      <FinderCoralGarden C={C} />
      <FinderShellCluster C={C} />
      <FinderSeaFan C={C} />

      <DarkModuleDecor matrix={matrix} C={C} />
      <BorderReefDecor matrix={matrix} C={C} />
      <OceanBubbles C={C} />
    </group>
  );
}