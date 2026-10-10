import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── QR LANDSCAPE CONSTANTS ────────────────────────────────────────
const GRID = 25;
const TILE = 0.118;
const HALF = (GRID * TILE) / 2;
const ROOT_Y = -0.45;
const H_BASE = 0.022;
const H_DARK = 0.072;
const H_FINDER = 0.095;
const H_ACCENT = 0.055;

const MOUNTAIN_HEIGHT = 1.68;
const MOUNTAIN_RADIUS = 0.82;

// ─── MATERIAL CACHE ────────────────────────────────────────────────
const materialCache = new Map();

function mat(color, roughness = 0.88, extra = {}) {
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

// ─── SEEDED RANDOM ─────────────────────────────────────────────────
function rng(seed) {
  let v = seed >>> 0;

  return () => {
    v = (v * 1664525 + 1013904223) >>> 0;
    return v / 4294967296;
  };
}

// ─── COLOR HELPERS ─────────────────────────────────────────────────
function blendHex(a, b, f) {
  const ah = parseInt(a.replace("#", ""), 16);
  const bh = parseInt(b.replace("#", ""), 16);

  const ar = (ah >> 16) & 0xff;
  const ag = (ah >> 8) & 0xff;
  const ab = ah & 0xff;

  const br = (bh >> 16) & 0xff;
  const bg = (bh >> 8) & 0xff;
  const bb = bh & 0xff;

  const r = Math.round(ar + (br - ar) * f);
  const g = Math.round(ag + (bg - ag) * f);
  const blue = Math.round(ab + (bb - ab) * f);

  return `#${((r << 16) | (g << 8) | blue)
    .toString(16)
    .padStart(6, "0")}`;
}

function lighten(hex, f) {
  return blendHex(hex, "#ffffff", f);
}

function darken(hex, f) {
  return blendHex(hex, "#000000", f);
}

// ─── MAYON / ALBAY COLOR PALETTE ───────────────────────────────────
// Natural volcanic charcoal, weathered stone, tropical greenery,
// and humid blue-gray clouds.
function resolveColors(theme = {}) {
  const forest = theme.primary || "#31583B";
  const sage = theme.secondary || "#72866A";
  const mist = theme.accent || "#C6D0D1";
  const light = theme.light || "#EAE7DE";

  return {
    modDark: "#31583B",
    modDarkAlt: "#263E30",
    modLight: "#8FA67C",
    base: "#7A9A68",

    soil: "#51463D",
    soilLight: "#76675A",

    gold: "#B99A62",
    goldLight: "#D6C18F",

    forest,
    forestDark: "#203C2B",
    forestLight: "#52774A",

    sage,
    sageDark: "#465B45",
    sageLight: "#92A182",

    mist,
    mistDark: "#9DAFB3",
    mistLight: "#E0E5E4",

    skyBlue: "#A9C0C8",
    skyDark: "#718B98",

    ivory: light,
    ivoryDark: "#D6D1C5",

    gray: "#777A78",
    grayLight: "#A9AAA4",

    stone: "#655F58",
    stoneLight: "#93887A",

    // Volcanic summit and Cagsawa masonry.
    lava: "#353735",
    lavaDark: "#262A29",
    lavaLight: "#555651",
    ash: "#79776F",
    ashLight: "#A6A095",
    ruin: "#87796A",
    ruinDark: "#5B5148",
    ruinLight: "#AA9B88",

    // Albay lowland vegetation.
    banana: "#6E8C43",
    bananaLight: "#9EAA60",
    palm: "#426644",
    palmLight: "#66804C",
    earth: "#766047",
    water: "#819FA2",
  };
}

// ─── GEOMETRY HELPERS ──────────────────────────────────────────────
function Box({
  pos,
  size,
  color,
  rot = [0, 0, 0],
  shadow = true,
  materialProps = {},
}) {
  return (
    <mesh
      position={pos}
      scale={size}
      rotation={rot}
      material={mat(color, 0.88, materialProps)}
      castShadow={shadow}
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}

function Cone({
  pos,
  rTop = 0,
  rBot,
  h,
  segs = 8,
  color,
  rot = [0, 0, 0],
  openEnded = false,
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
        args={[rTop, rBot, h, segs, 1, openEnded]}
      />
    </mesh>
  );
}

function Sphere({
  pos,
  scale = [1, 1, 1],
  color,
  transparent = false,
  opacity = 1,
  roughness = 0.9,
  segments = 8,
}) {
  return (
    <mesh
      position={pos}
      scale={scale}
      castShadow={!transparent}
      receiveShadow
    >
      <sphereGeometry args={[1, segments, segments]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        flatShading
        transparent={transparent}
        opacity={opacity}
        depthWrite={!transparent}
      />
    </mesh>
  );
}

function GlowPx({ pos, color, size = 0.04 }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse =
        0.88 +
        Math.sin(clock.elapsedTime * 2.1 + pos[0] * 3) * 0.12;

      ref.current.scale.setScalar(pulse);
    }
  });

  return (
    <mesh ref={ref} position={pos}>
      <boxGeometry args={[size, size, size]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

// ─── QR MATRIX ─────────────────────────────────────────────────────
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

// ─── QR GROUND ─────────────────────────────────────────────────────
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

  return (
    <group>
      {/* Main backing */}
      <Box
        pos={[0, -0.06, 0]}
        size={[GRID * TILE + 0.12, 0.12, GRID * TILE + 0.12]}
        color={C.base}
        shadow={false}
      />

      {/* Individual QR tiles */}
      {Array.from({ length: GRID * GRID }, (_, i) => {
        const x = i % GRID;
        const z = Math.floor(i / GRID);
        const wx = (x - (GRID - 1) / 2) * TILE;
        const wz = (z - (GRID - 1) / 2) * TILE;

        return (
          <Box
            key={`tile-${i}`}
            pos={[wx, H_BASE * 0.5, wz]}
            size={[TILE * 0.93, H_BASE, TILE * 0.93]}
            color={(x + z) % 7 === 0 ? "#6B8A5A" : C.base}
            shadow={false}
          />
        );
      })}

      {/* Raised QR modules */}
      {modules
        .filter((m) => m.h > H_BASE)
        .map((m, i) => (
          <Box
            key={`module-${i}`}
            pos={[m.x, m.h * 0.5, m.z]}
            size={[TILE * m.size, m.h, TILE * m.size]}
            color={m.color}
          />
        ))}

      {/* Earth-toned QR frame */}
      {[
        [0, -0.09, -HALF - 0.055, [GRID * TILE + 0.2, 0.09, 0.1]],
        [0, -0.09, HALF + 0.055, [GRID * TILE + 0.2, 0.09, 0.1]],
        [-HALF - 0.055, -0.09, 0, [0.1, 0.09, GRID * TILE]],
        [HALF + 0.055, -0.09, 0, [0.1, 0.09, GRID * TILE]],
      ].map(([x, y, z, size], i) => (
        <Box
          key={`frame-${i}`}
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

      {/* Corner ornaments */}
      {[
        [-HALF - 0.035, -HALF - 0.035],
        [HALF + 0.035, -HALF - 0.035],
        [-HALF - 0.035, HALF + 0.035],
        [HALF + 0.035, HALF + 0.035],
      ].map(([x, z], i) => (
        <Box
          key={`corner-${i}`}
          pos={[x, 0.018, z]}
          size={[0.13, 0.055, 0.13]}
          color={C.gold}
        />
      ))}

      {/* Border foliage */}
      {(() => {
        const r = rng(9999);
        const foliage = [];
        for (let i = 0; i < 72; i++) {
          const edge = i % 4;
          const t = Math.floor(i / 18);
          let x, z;
          if (edge === 0) { x = -HALF + t * 0.13; z = -HALF - 0.08 - r() * 0.06; }
          else if (edge === 1) { x = HALF + 0.08 + r() * 0.06; z = -HALF + t * 0.13; }
          else if (edge === 2) { x = -HALF + t * 0.13; z = HALF + 0.08 + r() * 0.06; }
          else { x = -HALF - 0.08 - r() * 0.06; z = -HALF + t * 0.13; }
          const shapeType = Math.floor(r() * 3); // 0=cone, 1=sphere, 2=box
          foliage.push({
            x, z,
            shapeType,
            height: 0.04 + r() * 0.12,
            size: 0.02 + r() * 0.05,
            color: [
              C.forest,
              C.forestLight,
              C.sage,
              C.sageLight,
              C.forestDark,
              C.sageDark,
              C.banana,
              C.palm,
            ][Math.floor(r() * 8)]
          });
        }
        return foliage.map((plant, i) => {
          if (plant.shapeType === 0) {
            return (
              <Cone
                key={`foliage-${i}`}
                pos={[plant.x, plant.height/2, plant.z]}
                rTop={0}
                rBot={plant.size}
                h={plant.height}
                segs={4}
                color={plant.color}
              />
            );
          } else if (plant.shapeType === 1) {
            return (
              <Sphere
                key={`foliage-${i}`}
                pos={[plant.x, plant.size/2, plant.z]}
                scale={[plant.size, plant.height, plant.size]}
                color={plant.color}
                segments={6}
              />
            );
          } else {
            return (
              <Box
                key={`foliage-${i}`}
                pos={[plant.x, plant.height/2, plant.z]}
                size={[plant.size, plant.height, plant.size]}
                color={plant.color}
              />
            );
          }
        });
      })()}
    </group>
  );
}

// ─── VOLCANIC SLOPE DETAILS ────────────────────────────────────────
function VolcanicRidges({ C }) {
  const ridges = useMemo(() => {
    const random = rng(5502);
    const result = [];

    for (let i = 0; i < 28; i++) {
      const angle = random() * Math.PI * 2;

      // Keep the marks on the sloping sides, not at the summit.
      const y = 0.2 + random() * 1.05;
      const slopeRadius =
        MOUNTAIN_RADIUS * (1 - y / MOUNTAIN_HEIGHT);

      const radius = slopeRadius * (0.83 + random() * 0.08);
      const length = 0.08 + random() * 0.2;

      result.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        y,
        length,
        angle,
        width: 0.008 + random() * 0.009,
        color: [
          C.lavaLight,
          C.ash,
          C.lavaDark,
          "#625F56",
        ][Math.floor(random() * 4)],
      });
    }

    return result;
  }, [C]);

  return (
    <group>
      {ridges.map((ridge, i) => (
        <Box
          key={`ridge-${i}`}
          pos={[ridge.x, ridge.y, ridge.z]}
          size={[ridge.width, ridge.length, 0.012]}
          rot={[
            -0.3,
            ridge.angle,
            -0.2,
          ]}
          color={ridge.color}
          shadow={false}
        />
      ))}
    </group>
  );
}

// ─── MOUNT MAYON: CENTRAL FOCAL POINT ──────────────────────────────
function MountMayonCentre({ C }) {
  const vegetation = useMemo(() => {
    const random = rng(12580);
    const items = [];

    for (let i = 0; i < 350; i++) {
      // More greenery near the base, less as the elevation increases.
      const y = 0.06 + Math.pow(random(), 1.65) * 1.0;
      const slopeRadius =
        MOUNTAIN_RADIUS * (1 - y / MOUNTAIN_HEIGHT);

      if (slopeRadius < 0.055) continue;

      const angle = random() * Math.PI * 2;
      const radius = slopeRadius * (0.91 + random() * 0.06);
      const size = 0.015 + random() * 0.04;

      items.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        y,
        size,
        angle,
        color: [
          C.forestDark,
          C.forest,
          C.forestLight,
          C.sageDark,
          C.sage,
          C.sageLight,
          "#496742",
          "#687E4E",
          "#3E5A38",
          "#5C7B52",
        ][Math.floor(random() * 10)],
      });
    }

    return items;
  }, [C]);

  const summitCloudRef = useRef();

  useFrame(({ clock }) => {
    if (summitCloudRef.current) {
      summitCloudRef.current.rotation.y =
        Math.sin(clock.elapsedTime * 0.12) * 0.08;
    }
  });

  return (
    <group position={[0, H_DARK, 0]}>
      {/* Broad green volcanic foothills */}
      <Cone
        pos={[0, 0.12, 0]}
        rTop={0.48}
        rBot={0.98}
        h={0.28}
        segs={12}
        color={C.forestDark}
      />

      {/* The main near-perfect volcanic cone */}
      <Cone
        pos={[0, MOUNTAIN_HEIGHT / 2 + 0.15, 0]}
        rTop={0.012}
        rBot={MOUNTAIN_RADIUS}
        h={MOUNTAIN_HEIGHT}
        segs={24}
        color={C.lava}
      />

      {/* Forest belt around the lower cone */}
      <Cone
        pos={[0, 0.35, 0]}
        rTop={0.61}
        rBot={0.87}
        h={0.43}
        segs={20}
        color={C.forest}
      />

      {/* Lower vegetation belt, preserving the steep cone silhouette */}
      <Cone
        pos={[0, 0.52, 0]}
        rTop={0.48}
        rBot={0.73}
        h={0.34}
        segs={20}
        color={C.forestDark}
      />

      {/* A muted green transition into the exposed volcanic slopes */}
      <Cone
        pos={[0, 0.75, 0]}
        rTop={0.36}
        rBot={0.58}
        h={0.31}
        segs={20}
        color={C.sageDark}
      />

      {/* Vegetation texture on the cone */}
      {vegetation.map((tree, i) => (
        <group
          key={`vegetation-${i}`}
          position={[tree.x, tree.y, tree.z]}
          rotation={[0, tree.angle, 0]}
        >
          <Cone
            pos={[0, 0, 0]}
            rTop={0}
            rBot={tree.size * 0.65}
            h={tree.size * 1.8}
            segs={4}
            color={tree.color}
          />
        </group>
      ))}

      {/* Dark lava channels on the upper exposed slopes */}
      <VolcanicRidges C={C} />

      {/* Exposed summit rock */}
      <Cone
        pos={[0, 1.72, 0]}
        rTop={0.012}
        rBot={0.075}
        h={0.14}
        segs={12}
        color={C.ash}
      />

      {/* Crater rim */}
      <mesh
        position={[0, 1.79, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.052, 0.014, 6, 12]} />
        <meshStandardMaterial color={C.lavaDark} roughness={1} />
      </mesh>

      {/* Crater opening */}
      <mesh position={[0, 1.785, 0]}>
        <cylinderGeometry args={[0.045, 0.052, 0.012, 12]} />
        <meshStandardMaterial
          color="#292B29"
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wispy summit cloud wrapping the peak */}
      <group ref={summitCloudRef} position={[0, 1.72, 0]}>
        <Sphere
          pos={[-0.035, 0.035, 0.005]}
          scale={[0.13, 0.035, 0.065]}
          color={C.ivory}
          transparent
          opacity={0.54}
          segments={10}
        />
        <Sphere
          pos={[0.025, 0.055, 0.025]}
          scale={[0.1, 0.025, 0.045]}
          color={C.mistLight}
          transparent
          opacity={0.48}
          segments={10}
        />
        <Sphere
          pos={[0.07, 0.015, -0.025]}
          scale={[0.12, 0.018, 0.035]}
          color={C.ivory}
          transparent
          opacity={0.38}
          segments={10}
        />
      </group>

      {/* Tiny high-altitude exposed rock facets */}
      {[
        [-0.07, 1.62, 0.035, C.lavaLight],
        [0.06, 1.58, -0.045, C.ash],
        [0.035, 1.68, 0.01, C.lavaDark],
        [-0.035, 1.69, -0.025, C.ashLight],
      ].map(([x, y, z, color], i) => (
        <Box
          key={`summit-rock-${i}`}
          pos={[x, y, z]}
          size={[0.025, 0.04, 0.025]}
          rot={[0.2 * i, 0.5 * i, 0.25]}
          color={color}
        />
      ))}

      {/* Tropical foothill clusters */}
      {Array.from({ length: 22 }, (_, i) => {
        const angle = (i / 22) * Math.PI * 2;
        const radius = 0.82 + (i % 3) * 0.07;

        return (
          <group
            key={`foothill-${i}`}
            position={[
              Math.cos(angle) * radius,
              0.08,
              Math.sin(angle) * radius,
            ]}
          >
            <Cone
              pos={[0, 0.06, 0]}
              rTop={0}
              rBot={0.105}
              h={0.12}
              segs={7}
              color={i % 2 ? C.forest : C.forestLight}
            />

            {[0, 1, 2].map((j) => {
              const a = (j / 3) * Math.PI * 2;

              return (
                <Cone
                  key={`tree-${j}`}
                  pos={[
                    Math.cos(a) * 0.045,
                    0.14,
                    Math.sin(a) * 0.045,
                  ]}
                  rTop={0}
                  rBot={0.012}
                  h={0.07}
                  segs={4}
                  color={C.forestDark}
                />
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

// ─── COCONUT PALM ──────────────────────────────────────────────────
function CoconutPalm({ position, scale = 1, C, rotation = 0 }) {
  const fronds = [
    [0.17, 0.06, 0.0],
    [-0.15, 0.08, 0.05],
    [0.03, 0.1, 0.17],
    [-0.04, 0.08, -0.16],
    [0.12, 0.1, -0.12],
    [-0.17, 0.05, -0.07],
  ];

  return (
    <group
      position={position}
      scale={scale}
      rotation={[0, rotation, 0]}
    >
      {/* Curved-looking segmented trunk */}
      <Cone
        pos={[0, 0.17, 0]}
        rTop={0.018}
        rBot={0.034}
        h={0.34}
        segs={6}
        color="#79654B"
      />

      <Cone
        pos={[0.018, 0.32, 0]}
        rTop={0.018}
        rBot={0.022}
        h={0.22}
        segs={6}
        color="#8B7657"
        rot={[0, 0, -0.09]}
      />

      {/* Crown */}
      <Sphere
        pos={[0.015, 0.43, 0]}
        scale={[0.045, 0.035, 0.045]}
        color={C.palm}
      />

      {fronds.map(([x, y, z], i) => (
        <group
          key={`frond-${i}`}
          position={[0.015, 0.43, 0]}
          rotation={[
            (i % 2 ? -1 : 1) * 0.22,
            i * 1.04,
            (i % 3 - 1) * 0.22,
          ]}
        >
          <Box
            pos={[x * 0.5, y, z * 0.5]}
            size={[0.22, 0.012, 0.035]}
            rot={[0, i * 0.18, -0.28]}
            color={i % 2 ? C.palm : C.palmLight}
            shadow={false}
          />

          {/* Split leaf tips */}
          <Box
            pos={[x * 0.85, y - 0.025, z * 0.85]}
            size={[0.12, 0.008, 0.018]}
            rot={[0, i * 0.18, -0.45]}
            color={C.palm}
            shadow={false}
          />
        </group>
      ))}

      {/* Coconut cluster */}
      {[
        [-0.025, 0.41, 0.025],
        [0.025, 0.4, 0.015],
        [0.0, 0.425, -0.025],
      ].map(([x, y, z], i) => (
        <Sphere
          key={`coconut-${i}`}
          pos={[x, y, z]}
          scale={[0.018, 0.02, 0.018]}
          color="#756247"
          segments={6}
        />
      ))}
    </group>
  );
}

// ─── BANANA PLANT ──────────────────────────────────────────────────
function BananaPlant({ position, scale = 1, C, rotation = 0 }) {
  return (
    <group
      position={position}
      scale={scale}
      rotation={[0, rotation, 0]}
    >
      <Cone
        pos={[0, 0.12, 0]}
        rTop={0.025}
        rBot={0.035}
        h={0.24}
        segs={5}
        color="#547346"
      />

      {Array.from({ length: 7 }, (_, i) => {
        const angle = (i / 7) * Math.PI * 2;
        const length = 0.13 + (i % 3) * 0.025;

        return (
          <group
            key={`leaf-${i}`}
            position={[0, 0.21, 0]}
            rotation={[0.15, angle, (i % 2 ? 1 : -1) * 0.22]}
          >
            <Box
              pos={[0, 0.015, length * 0.48]}
              size={[0.035, 0.012, length]}
              rot={[0.14, 0, 0.13]}
              color={i % 2 ? C.banana : C.bananaLight}
              shadow={false}
            />
          </group>
        );
      })}
    </group>
  );
}

// ─── CAGSAWA CHURCH RUINS ──────────────────────────────────────────
// A stylized, partially ruined bell tower inspired by the remaining
// Cagsawa church tower in Daraga, Albay.
function CagsawaRuins({ C }) {
  const stones = useMemo(() => {
    const random = rng(4108);
    const result = [];

    for (let i = 0; i < 32; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 0.13 + random() * 0.18;

      result.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        y: 0.025 + random() * 0.035,
        size: [
          0.025 + random() * 0.055,
          0.018 + random() * 0.035,
          0.025 + random() * 0.045,
        ],
        rot: [
          random() * 0.35,
          random() * Math.PI,
          random() * 0.35,
        ],
        color: [
          C.ruinDark,
          C.ruin,
          C.stone,
          C.ash,
          "#756A5E",
        ][Math.floor(random() * 5)],
      });
    }

    return result;
  }, [C]);

  return (
    <group position={[0.88, H_DARK, 0.22]} rotation={[0, -0.18, 0]}>
      {/* Raised, irregular rubble base */}
      <Box
        pos={[0, 0.045, 0]}
        size={[0.48, 0.09, 0.4]}
        color={C.ruinDark}
        rot={[0, 0.06, 0]}
      />

      <Box
        pos={[0, 0.085, 0]}
        size={[0.38, 0.035, 0.31]}
        color={C.ruin}
      />

      {/* Tower body */}
      <Box
        pos={[0, 0.29, 0]}
        size={[0.23, 0.42, 0.22]}
        color={C.ruin}
      />

      {/* Weathered masonry bands */}
      <Box
        pos={[0, 0.12, 0]}
        size={[0.27, 0.045, 0.26]}
        color={C.ruinDark}
      />

      <Box
        pos={[0, 0.35, 0]}
        size={[0.25, 0.04, 0.24]}
        color={C.ruinLight}
      />

      {/* Upper bell-tower stage */}
      <Box
        pos={[0, 0.48, 0]}
        size={[0.19, 0.22, 0.19]}
        color={C.ruin}
      />

      {/* Open bell chamber */}
      <Box
        pos={[0, 0.49, 0.098]}
        size={[0.095, 0.12, 0.015]}
        color={C.ruinDark}
      />

      <Box
        pos={[0, 0.49, -0.098]}
        size={[0.095, 0.12, 0.015]}
        color={C.ruinDark}
      />

      <Box
        pos={[-0.083, 0.49, 0]}
        size={[0.025, 0.13, 0.2]}
        color={C.ruinLight}
      />

      <Box
        pos={[0.083, 0.49, 0]}
        size={[0.025, 0.13, 0.2]}
        color={C.ruinDark}
      />

      {/* Side wall remnants */}
      <Box
        pos={[-0.18, 0.13, 0.02]}
        size={[0.16, 0.19, 0.1]}
        color={C.ruin}
        rot={[0, 0.08, -0.09]}
      />

      <Box
        pos={[0.17, 0.11, -0.02]}
        size={[0.13, 0.15, 0.1]}
        color={C.ruinDark}
        rot={[0, -0.15, 0.12]}
      />

      {/* Broken upper silhouette */}
      <Box
        pos={[-0.045, 0.625, 0]}
        size={[0.085, 0.065, 0.19]}
        color={C.ruinLight}
        rot={[0, 0, -0.18]}
      />

      <Box
        pos={[0.045, 0.605, 0]}
        size={[0.09, 0.045, 0.17]}
        color={C.ruinDark}
        rot={[0, 0.12, 0.2]}
      />

      {/* Front arched opening: dark inset with stone side piers */}
      <Box
        pos={[0, 0.255, 0.113]}
        size={[0.085, 0.19, 0.012]}
        color="#393A35"
        shadow={false}
      />

      <Box
        pos={[-0.063, 0.26, 0.123]}
        size={[0.027, 0.2, 0.025]}
        color={C.ruinLight}
      />

      <Box
        pos={[0.063, 0.26, 0.123]}
        size={[0.027, 0.2, 0.025]}
        color={C.ruin}
      />

      <Box
        pos={[0, 0.36, 0.123]}
        size={[0.15, 0.025, 0.025]}
        color={C.ruinLight}
      />

      {/* Broken cross-like remnant */}
      <Box
        pos={[0, 0.67, 0]}
        size={[0.018, 0.095, 0.018]}
        color={C.ruinDark}
      />

      <Box
        pos={[0, 0.69, 0]}
        size={[0.065, 0.018, 0.018]}
        color={C.ruinDark}
      />

      {/* Rubble scattered around the church */}
      {stones.map((stone, i) => (
        <Box
          key={`rubble-${i}`}
          pos={[stone.x, stone.y, stone.z]}
          size={stone.size}
          rot={stone.rot}
          color={stone.color}
        />
      ))}

      {/* Small lowland plants near the ruins */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        const radius = 0.24 + (i % 2) * 0.06;

        return (
          <Cone
            key={`church-grass-${i}`}
            pos={[
              Math.cos(angle) * radius,
              0.065,
              Math.sin(angle) * radius,
            ]}
            rTop={0}
            rBot={0.018}
            h={0.075}
            segs={4}
            color={i % 2 ? C.forest : C.sageDark}
          />
        );
      })}
    </group>
  );
}

// ─── MISTY RIDGES AROUND THE BASE ──────────────────────────────────
function DistantRidges({ C }) {
  const ridges = [
    { x: -0.95, z: -0.18, sx: 0.28, sy: 0.2, sz: 0.26 },
    { x: -0.78, z: 0.5, sx: 0.32, sy: 0.18, sz: 0.25 },
    { x: 0.55, z: -0.75, sx: 0.3, sy: 0.16, sz: 0.25 },
    { x: -0.4, z: -0.9, sx: 0.28, sy: 0.14, sz: 0.23 },
    { x: 0.3, z: 0.87, sx: 0.3, sy: 0.15, sz: 0.23 },
    { x: -0.95, z: 0.1, sx: 0.25, sy: 0.14, sz: 0.2 },
  ];

  return (
    <group>
      {ridges.map((ridge, i) => (
        <group
          key={`ridge-${i}`}
          position={[ridge.x, 0.06, ridge.z]}
        >
          <Sphere
            pos={[0, 0.04, 0]}
            scale={[ridge.sx, ridge.sy, ridge.sz]}
            color={i % 2 ? C.forestDark : C.sageDark}
          />

          <Sphere
            pos={[0.05, 0.1, 0.015]}
            scale={[
              ridge.sx * 0.68,
              ridge.sy * 0.8,
              ridge.sz * 0.72,
            ]}
            color={i % 2 ? C.sageDark : C.forest}
          />
        </group>
      ))}
    </group>
  );
}

// ─── IRREGULAR WHISPY CLOUD BANKS ──────────────────────────────────
function WispyCloudBank({
  position,
  scale = 1,
  C,
  seed = 1,
  opacity = 0.48,
}) {
  const groupRef = useRef();

  const wisps = useMemo(() => {
    const random = rng(seed);

    return Array.from({ length: 13 }, (_, i) => {
      const side = random() > 0.5 ? 1 : -1;

      return {
        position: [
          (random() - 0.5) * 0.42,
          (random() - 0.5) * 0.13,
          (random() - 0.5) * 0.23,
        ],
        scale: [
          0.12 + random() * 0.18,
          0.012 + random() * 0.025,
          0.035 + random() * 0.065,
        ],
        rotation: [
          (random() - 0.5) * 0.25,
          (random() - 0.5) * 0.8,
          (random() - 0.5) * 0.28,
        ],
        color:
          i % 4 === 0
            ? C.ivory
            : i % 3 === 0
              ? C.mistLight
              : C.mist,
        opacity: opacity * (0.62 + random() * 0.42),
        drift: 0.02 + random() * 0.045,
        phase: random() * Math.PI * 2,
        direction: side,
      };
    });
  }, [C, seed, opacity]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const t = clock.elapsedTime;

    groupRef.current.position.x =
      position[0] + Math.sin(t * 0.14 + seed) * 0.025;

    groupRef.current.position.z =
      position[2] + Math.cos(t * 0.11 + seed) * 0.025;

    groupRef.current.children.forEach((mesh, i) => {
      const wisp = wisps[i];

      if (!wisp) return;

      mesh.position.x =
        wisp.position[0] +
        Math.sin(t * 0.19 + wisp.phase) * wisp.drift;

      mesh.position.y =
        wisp.position[1] +
        Math.sin(t * 0.25 + wisp.phase) * 0.012;

      mesh.material.opacity =
        wisp.opacity *
        (0.83 + Math.sin(t * 0.4 + wisp.phase) * 0.13);
    });
  });

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
    >
      {wisps.map((wisp, i) => (
        <mesh
          key={`wisp-${i}`}
          position={wisp.position}
          rotation={wisp.rotation}
          scale={wisp.scale}
        >
          <sphereGeometry args={[1, 9, 6]} />
          <meshBasicMaterial
            color={wisp.color}
            transparent
            opacity={wisp.opacity}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── LOW-LYING FOG ─────────────────────────────────────────────────
function LowlandFog({ C }) {
  return (
    <group>
      <WispyCloudBank
        position={[-0.55, 0.38, 0.28]}
        scale={1.45}
        C={C}
        seed={71}
        opacity={0.27}
      />

      <WispyCloudBank
        position={[0.38, 0.5, -0.18]}
        scale={1.25}
        C={C}
        seed={81}
        opacity={0.24}
      />

      <WispyCloudBank
        position={[-0.12, 0.82, 0.42]}
        scale={1.1}
        C={C}
        seed={91}
        opacity={0.2}
      />

      <WispyCloudBank
        position={[0.48, 1.12, -0.1]}
        scale={0.92}
        C={C}
        seed={101}
        opacity={0.22}
      />

      <WispyCloudBank
        position={[-0.15, 1.48, 0.05]}
        scale={0.88}
        C={C}
        seed={111}
        opacity={0.35}
      />
    </group>
  );
}

// ─── BORDER LANDSCAPE DETAILS ──────────────────────────────────────
function BorderLandscape({ C }) {
  return (
    <group>
      {/* Coconut palms along the perimeter */}
      <CoconutPalm
        position={[-1.18, H_DARK, -0.83]}
        scale={0.8}
        C={C}
        rotation={0.4}
      />

      <CoconutPalm
        position={[1.13, H_DARK, -0.9]}
        scale={0.68}
        C={C}
        rotation={-0.5}
      />

      <CoconutPalm
        position={[-1.12, H_DARK, 0.82]}
        scale={0.62}
        C={C}
        rotation={1.2}
      />

      <CoconutPalm
        position={[1.2, H_DARK, 0.86]}
        scale={0.72}
        C={C}
        rotation={-0.8}
      />

      {/* Banana groves */}
      <BananaPlant
        position={[-1.02, H_DARK, -0.45]}
        scale={0.8}
        C={C}
        rotation={0.4}
      />

      <BananaPlant
        position={[0.95, H_DARK, -0.65]}
        scale={0.72}
        C={C}
        rotation={1.2}
      />

      <BananaPlant
        position={[-1.0, H_DARK, 0.48]}
        scale={0.65}
        C={C}
        rotation={-0.4}
      />

      <BananaPlant
        position={[1.1, H_DARK, 0.55]}
        scale={0.78}
        C={C}
        rotation={0.8}
      />

      {/* Volcanic boulders */}
      {[
        [-1.12, 0.1, -0.15, 0.09],
        [1.17, 0.08, 0.0, 0.07],
        [-0.75, 0.075, 1.0, 0.08],
        [0.66, 0.075, -1.04, 0.07],
        [1.02, 0.07, 0.95, 0.065],
        [-1.13, 0.08, -0.75, 0.055],
      ].map(([x, y, z, s], i) => (
        <group key={`boulder-${i}`} position={[x, y, z]}>
          <Sphere
            pos={[0, s * 0.5, 0]}
            scale={[s * 1.4, s, s * 1.15]}
            color={i % 2 ? C.lavaLight : C.lavaDark}
          />
          <Box
            pos={[s * 0.35, s * 0.75, 0]}
            size={[s * 0.55, s * 0.4, s * 0.6]}
            rot={[0.3, i * 0.5, 0.2]}
            color={C.ash}
          />
        </group>
      ))}

      {/* Lowland shrubs */}
      {Array.from({ length: 24 }, (_, i) => {
        const random = rng(6500 + i);
        const edge = i % 4;
        let x;
        let z;

        if (edge === 0) {
          x = -1.25 + random() * 2.5;
          z = -1.18 + random() * 0.12;
        } else if (edge === 1) {
          x = -1.25 + random() * 2.5;
          z = 1.08 + random() * 0.12;
        } else if (edge === 2) {
          x = -1.22 + random() * 0.12;
          z = -1.1 + random() * 2.2;
        } else {
          x = 1.1 + random() * 0.12;
          z = -1.1 + random() * 2.2;
        }

        const size = 0.035 + random() * 0.04;

        return (
          <group key={`shrub-${i}`} position={[x, H_DARK, z]}>
            <Sphere
              pos={[0, size * 0.55, 0]}
              scale={[size, size * 0.8, size]}
              color={i % 2 ? C.forestLight : C.sageDark}
            />
            <Cone
              pos={[size * 0.3, size * 0.8, 0]}
              rTop={0}
              rBot={size * 0.25}
              h={size * 1.2}
              segs={4}
              color={C.forestDark}
            />
          </group>
        );
      })}
    </group>
  );
}

// ─── FINDER LANDMARK A: FOREST HILL ────────────────────────────────
function FinderForestHill({ C }) {
  const cx = (3 - (GRID - 1) / 2) * TILE;
  const cz = (3 - (GRID - 1) / 2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      <Cone
        pos={[0, 0.06, 0]}
        rTop={0}
        rBot={0.12}
        h={0.12}
        segs={6}
        color={C.forestLight}
      />

      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;

        return (
          <Cone
            key={i}
            pos={[
              Math.cos(a) * 0.05,
              0.14,
              Math.sin(a) * 0.05,
            ]}
            rTop={0}
            rBot={0.01}
            h={0.06}
            segs={4}
            color={C.forestDark}
          />
        );
      })}

      <GlowPx pos={[0, 0.2, 0]} color={C.gold} size={0.015} />
    </group>
  );
}

// ─── FINDER LANDMARK B: MISTY RIDGE ────────────────────────────────
function FinderMistyRidge({ C }) {
  const cx = (GRID - 4 - (GRID - 1) / 2) * TILE;
  const cz = (3 - (GRID - 1) / 2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      <Cone
        pos={[0, 0.05, 0]}
        rTop={0}
        rBot={0.1}
        h={0.1}
        segs={6}
        color={C.sageDark}
      />

      <Sphere
        pos={[0, 0.12, 0]}
        scale={[0.075, 0.04, 0.06]}
        color={C.mist}
        transparent
        opacity={0.55}
      />

      <Box
        pos={[0.03, 0.06, 0]}
        size={[0.03, 0.04, 0.03]}
        color={C.stone}
      />

      <GlowPx
        pos={[0, 0.18, 0]}
        color={C.goldLight}
        size={0.018}
      />
    </group>
  );
}

// ─── FINDER LANDMARK C: VERDANT VALLEY ─────────────────────────────
function FinderVerdantValley({ C }) {
  const cx = (3 - (GRID - 1) / 2) * TILE;
  const cz = (GRID - 4 - (GRID - 1) / 2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      <Box
        pos={[0, 0.02, 0]}
        size={[0.14, 0.04, 0.14]}
        color={C.forestLight}
      />

      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;

        return (
          <Cone
            key={i}
            pos={[
              Math.cos(a) * 0.04,
              0.07,
              Math.sin(a) * 0.04,
            ]}
            rTop={0}
            rBot={0.008}
            h={0.05}
            segs={4}
            color={C.forest}
          />
        );
      })}

      <GlowPx pos={[0, 0.12, 0]} color={C.gold} size={0.015} />
    </group>
  );
}

// ─── DARK QR MODULE DECOR ──────────────────────────────────────────
function DarkModuleDecor({ matrix, C }) {
  const items = useMemo(() => {
    const random = rng(9999);
    const out = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (!matrix[z][x]) continue;
        if (isFinderZone(x, z)) continue;
        if (z === 6 || x === 6) continue;

        const cx = Math.abs(x - (GRID - 1) / 2);
        const cz = Math.abs(z - (GRID - 1) / 2);

        // Leave room for the large mountain and its surrounding scenery.
        if (cx < 7 && cz < 7) continue;
        if (random() > 0.35) continue;

        const wx = (x - (GRID - 1) / 2) * TILE;
        const wz = (z - (GRID - 1) / 2) * TILE;
        const kind = Math.floor(random() * 3);

        out.push({
          x: wx,
          z: wz,
          kind,
          seed: (x * 31 + z * 17) | 0,
        });
      }
    }

    return out;
  }, [matrix]);

  return (
    <group>
      {items.map((item, i) => {
        const random = rng(item.seed * 91);
        const y = H_DARK;

        if (item.kind === 0) {
          return (
            <Cone
              key={i}
              pos={[item.x, y + 0.03, item.z]}
              rTop={0}
              rBot={0.01}
              h={0.06}
              segs={4}
              color={C.forestDark}
            />
          );
        }

        if (item.kind === 1) {
          const s = 0.012 + random() * 0.01;

          return (
            <Box
              key={i}
              pos={[item.x, y + s / 2, item.z]}
              size={[s, s, s]}
              color={C.stone}
            />
          );
        }

        return (
          <Cone
            key={i}
            pos={[item.x, y + 0.007, item.z]}
            rTop={0}
            rBot={0.005}
            h={0.015}
            segs={3}
            color={C.sageLight}
          />
        );
      })}
    </group>
  );
}

// ─── ATMOSPHERIC BACKGROUND CLOUDS ─────────────────────────────────
function Atmosphere({ C }) {
  return (
    <group>
      {/* Broad, uneven cloud bands around the volcano */}
      <WispyCloudBank
        position={[-0.78, 0.95, -0.15]}
        scale={1.55}
        C={C}
        seed={201}
        opacity={0.3}
      />

      <WispyCloudBank
        position={[0.72, 1.25, -0.12]}
        scale={1.45}
        C={C}
        seed={202}
        opacity={0.32}
      />

      <WispyCloudBank
        position={[-0.45, 1.65, -0.3]}
        scale={1.35}
        C={C}
        seed={203}
        opacity={0.35}
      />

      <WispyCloudBank
        position={[0.15, 1.85, 0.25]}
        scale={1.25}
        C={C}
        seed={204}
        opacity={0.31}
      />

      <WispyCloudBank
        position={[0.9, 0.88, 0.35]}
        scale={1.0}
        C={C}
        seed={205}
        opacity={0.23}
      />
    </group>
  );
}

// ─── LIGHTING ──────────────────────────────────────────────────────
function SceneLighting({ C }) {
  return (
    <>
      <ambientLight intensity={0.85} color="#D6E0DE" />

      <directionalLight
        position={[-3, 6, 4]}
        intensity={1.65}
        color="#F6F0E3"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <directionalLight
        position={[3, 3, -4]}
        intensity={0.7}
        color="#A9C2C8"
      />

      <pointLight
        position={[1.2, 2.5, 1.5]}
        color={C.ivory}
        intensity={0.55}
        distance={4.5}
      />

      <pointLight
        position={[-1, 1.4, -0.5]}
        color="#B4C7C5"
        intensity={0.3}
        distance={3.5}
      />
    </>
  );
}

// ─── MAIN SCENE ────────────────────────────────────────────────────
export default function MayonScene({ themeColors }) {
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

      <QRGround matrix={matrix} C={C} />

      {/* Primary focal point */}
      <MountMayonCentre C={C} />

      {/* Iconic ruins beside the mountain */}
      <CagsawaRuins C={C} />

      {/* Lowland landscape */}
      <DistantRidges C={C} />
      <BorderLandscape C={C} />

      {/* Finder-pattern landmarks */}
      <FinderForestHill C={C} />
      <FinderMistyRidge C={C} />
      <FinderVerdantValley C={C} />

      {/* Natural detail on the QR terrain */}
      <DarkModuleDecor matrix={matrix} C={C} />

      {/* Layered, moving mist and irregular clouds */}
      <LowlandFog C={C} />
      <Atmosphere C={C} />
    </group>
  );
}