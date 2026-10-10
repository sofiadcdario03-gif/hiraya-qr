
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const GRID = 25;
const TILE = 0.118;
const HALF = (GRID * TILE) / 2;
const ROOT_Y = -0.45;

const H_BASE = 0.022;
const H_DARK = 0.072;
const H_FINDER = 0.095;
const H_ACCENT = 0.055;

// ------------------------------------------------------
// COLOR UTILITIES
// ------------------------------------------------------

function themeColors(theme = {}) {
  const forest = theme.primary ?? "#315b38";
  const teal = theme.secondary ?? "#43c7c3";
  const gold = theme.accent ?? "#c9af80";
  const light = theme.light ?? "#e8fdf8";

  return {
    modDark: "#1A2E1A", // dark dark green
    modDarkAlt: "#0F1F0F", // even darker green
    modLight: "#4A5C4A", // muddy green brown
    base: "#5D6B4F", // muddy green brown
    soil: "#51463D",
    soilLight: "#76675A",
    gold,
    goldLight: lighten(gold, 0.25),
    ground: theme.ground ?? "#182b29",
    tile: theme.tile ?? "#263d35",
    dark: theme.dark ?? "#10251f",
    trunk: theme.trunk ?? "#563c2a",
    bark: theme.bark ?? "#78533a",
    leaf: theme.leaf ?? "#315b38",
    leafLight: theme.leafLight ?? "#527d43",
    leafDark: theme.leafDark ?? "#203e2c",
    water: theme.water ?? "#A0E8F0", // crystal clear blue
    glow: theme.glow ?? "#f6d77a",
    stone: theme.stone ?? "#756c59",
    flower: theme.flower ?? "#e8a7c5",
  };
}

function lighten(hex, amount = 0.15) {
  return new THREE.Color(hex).lerp(new THREE.Color("#ffffff"), amount).getStyle();
}

function darken(hex, amount = 0.15) {
  return new THREE.Color(hex).lerp(new THREE.Color("#000000"), amount).getStyle();
}

function seededRandom(seed) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

// ------------------------------------------------------
// BASIC OBJECTS
// ------------------------------------------------------

function Box({
  pos = [0, 0, 0],
  size = [1, 1, 1],
  color = "#ffffff",
  rot = [0, 0, 0],
  radius = 0,
  metalness = 0,
  roughness = 0.85,
  shadow = true,
}) {
  return (
    <mesh position={pos} rotation={rot} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
      />
    </mesh>
  );
}

function Sphere({
  pos = [0, 0, 0],
  r = 0.1,
  color = "#ffffff",
  squash = [1, 1, 1],
  detail = 12,
  roughness = 0.9,
  emissive = "#000000",
  emissiveIntensity = 0,
}) {
  return (
    <mesh position={pos} scale={squash} castShadow receiveShadow>
      <sphereGeometry args={[r, detail, Math.max(6, Math.floor(detail * 0.7))]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

function Cone({
  pos = [0, 0, 0],
  rTop = 0,
  rBot = 0.5,
  h = 1,
  segs = 8,
  color = "#ffffff",
  rot = [0, 0, 0],
}) {
  return (
    <mesh position={pos} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[rTop, rBot, h, segs]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Cylinder({
  pos = [0, 0, 0],
  top = 0.1,
  bottom = 0.1,
  height = 1,
  color = "#ffffff",
  rot = [0, 0, 0],
  segments = 10,
  roughness = 0.9,
  emissive = "#000000",
  emissiveIntensity = 0,
}) {
  return (
    <mesh position={pos} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[top, bottom, height, segments]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

function OrganicBranch({
  start,
  end,
  radius = 0.04,
  color = "#563c2a",
  radiusEnd = 0.015,
}) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(to, from);
  const midpoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);

  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  );

  return (
    <mesh
      position={midpoint}
      quaternion={quaternion}
      castShadow
      receiveShadow
    >
      <cylinderGeometry
        args={[radiusEnd, radius, direction.length(), 8]}
      />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function GlowOrb({ pos, color = "#f6d77a", scale = 0.025, intensity = 2 }) {
  return (
    <group position={pos}>
      <Sphere
        r={scale}
        color={color}
        detail={8}
        roughness={0.25}
        emissive={color}
        emissiveIntensity={intensity}
      />
      <pointLight color={color} intensity={0.15} distance={0.32} />
    </group>
  );
}

// ------------------------------------------------------
// LIGHTING
// ------------------------------------------------------

function Lighting({ C }) {
  return (
    <>
      <ambientLight intensity={0.65} color="#c2d6c8" />
      <hemisphereLight
        skyColor="#c2e5d8"
        groundColor="#17221b"
        intensity={1.15}
      />

      <directionalLight
        position={[3, 5, 4]}
        intensity={2.2}
        color="#ffe7b0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <directionalLight
        position={[-4, 3, -2]}
        intensity={0.85}
        color="#74d7c3"
      />

      <pointLight
        position={[0, 1.7, 0.45]}
        intensity={1.1}
        distance={3.8}
        color={C.glow}
      />

      <fog attach="fog" args={["#152b27", 4.5, 9]} />
    </>
  );
}

// ------------------------------------------------------
// QR MATRIX BUILDER (same as other scenes)
// ------------------------------------------------------

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
  return inFinder(x, z, 0, 0) || inFinder(x, z, GRID - 7, 0) || inFinder(x, z, 0, GRID - 7);
}

function buildMatrix() {
  const r = seededRandom(7821);
  const m = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  for (let z = 0; z < GRID; z++)
    for (let x = 0; x < GRID; x++) {
      if (isFinderZone(x, z)) continue;
      if (z === 6 || x === 6) { m[z][x] = (x + z) % 2 === 0; continue; }
      const p = (x * 7 + z * 11 + x * z * 3) % 13;
      m[z][x] = p < 6 ? r() > 0.22 : r() > 0.73;
    }
  for (const [ox, oz] of [[0, 0], [GRID - 7, 0], [0, GRID - 7]])
    for (let z = oz; z < oz + 7; z++)
      for (let x = ox; x < ox + 7; x++)
        m[z][x] = finderBit(x, z, ox, oz);
  return m;
}

// ------------------------------------------------------
// QR-INSPIRED FOREST FLOOR
// ------------------------------------------------------

function QRGround({ matrix, C }) {
  const modules = useMemo(() => {
    const items = [];
    // Pool center at [0, 0.59] with radius ~0.455
    const poolCenterZ = 0.59;
    const poolRadius = 0.48;
    
    for (let z = 0; z < GRID; z++)
      for (let x = 0; x < GRID; x++) {
        const wx = (x - (GRID - 1) / 2) * TILE;
        const wz = (z - (GRID - 1) / 2) * TILE;
        const finder = isFinderZone(x, z);
        const timing = (z === 6 || x === 6) && !finder;
        const dark = matrix[z][x];
        let h, color;
        
        // Check if module is in pool area
        const distToPool = Math.sqrt(wx * wx + (wz - poolCenterZ) * (wz - poolCenterZ));
        const inPool = distToPool < poolRadius;
        
        if (finder) {
          h = H_FINDER;
          color = dark ? C.modDark : C.modLight;
        } else if (timing) {
          h = dark ? H_ACCENT : H_BASE;
          color = dark ? C.modDarkAlt : C.base;
        } else {
          h = dark ? H_DARK : H_BASE;
          color = dark ? ((x + z) % 4 === 0 ? C.modDarkAlt : C.modDark) : C.base;
        }
        
        // Blend with water color if in pool area
        if (inPool) {
          color = C.water;
          h = H_BASE; // Pool area is flat
        }
        
        items.push({ x: wx, z: wz, h, color, size: finder ? 0.96 : 0.90 });
      }
    return items;
  }, [matrix, C]);

  return (
    <group>
      <Box pos={[0, -0.06, 0]} size={[GRID * TILE + 0.12, 0.12, GRID * TILE + 0.12]} color={C.base} shadow={false} />

      {Array.from({ length: GRID * GRID }, (_, i) => {
        const x = i % GRID, z = Math.floor(i / GRID);
        const wx = (x - (GRID - 1) / 2) * TILE, wz = (z - (GRID - 1) / 2) * TILE;
        return (
          <Box key={`t${i}`} pos={[wx, H_BASE * 0.5, wz]} size={[TILE * 0.93, H_BASE, TILE * 0.93]} color={(x + z) % 7 === 0 ? darken(C.base, 0.05) : C.base} shadow={false} />
        );
      })}

      {modules.filter(m => m.h > H_BASE).map((m, i) => (
        <Box key={`m${i}`} pos={[m.x, m.h * 0.5, m.z]} size={[TILE * m.size, m.h, TILE * m.size]} color={m.color} />
      ))}

      {/* Soil border */}
      {[
        [0, -0.09, -HALF - 0.055, [GRID * TILE + 0.2, 0.09, 0.10]],
        [0, -0.09, HALF + 0.055, [GRID * TILE + 0.2, 0.09, 0.10]],
        [-HALF - 0.055, -0.09, 0, [0.10, 0.09, GRID * TILE]],
        [HALF + 0.055, -0.09, 0, [0.10, 0.09, GRID * TILE]],
      ].map(([x, y, z, s], i) => <Box key={`b${i}`} pos={[x, y, z]} size={s} color={C.soil} />)}

      <Box pos={[0, -0.18, 0]} size={[GRID * TILE + 0.16, 0.12, GRID * TILE + 0.16]} color={C.soilLight} />
      <Box pos={[0, -0.28, 0]} size={[GRID * TILE + 0.12, 0.10, GRID * TILE + 0.12]} color={C.soil} />

      {/* Gold corner accents */}
      {[[-HALF - 0.035, -HALF - 0.035], [HALF + 0.035, -HALF - 0.035],
        [-HALF - 0.035, HALF + 0.035], [HALF + 0.035, HALF + 0.035]].map(([x, z], i) => (
        <Box key={`c${i}`} pos={[x, 0.018, z]} size={[0.13, 0.055, 0.13]} color={C.gold} />
      ))}

      {/* Border rocks */}
      {(() => {
        const r = seededRandom(6666);
        const rockColors = ["#6B6B6B", "#4A4A4A", "#3D3D3D", "#2E4A2E", "#1A3A1A", "#4A5C4A"];
        const rocks = [];
        for (let i = 0; i < 48; i++) {
          const edge = i % 4; // 0=top, 1=right, 2=bottom, 3=left
          const t = Math.floor(i / 4);
          let x, z;
          if (edge === 0) { x = -HALF + t * 0.2; z = -HALF - 0.15; }
          else if (edge === 1) { x = HALF + 0.15; z = -HALF + t * 0.2; }
          else if (edge === 2) { x = -HALF + t * 0.2; z = HALF + 0.15; }
          else { x = -HALF - 0.15; z = -HALF + t * 0.2; }
          rocks.push({
            x, z,
            size: 0.06 + r() * 0.08,
            squash: [0.8 + r() * 0.4, 0.6 + r() * 0.3, 0.8 + r() * 0.4],
            color: rockColors[Math.floor(r() * rockColors.length)]
          });
        }
        return rocks.map((rock, i) => (
          <Sphere key={`rock-${i}`} pos={[rock.x, rock.size/2, rock.z]} r={rock.size} squash={rock.squash} color={rock.color} detail={8} />
        ));
      })()}

      {/* Border foliage */}
      {(() => {
        const r = seededRandom(7777);
        const foliage = [];
        for (let i = 0; i < 32; i++) {
          const edge = i % 4;
          const t = Math.floor(i / 8);
          let x, z;
          if (edge === 0) { x = -HALF + t * 0.2; z = -HALF - 0.12; }
          else if (edge === 1) { x = HALF + 0.12; z = -HALF + t * 0.2; }
          else if (edge === 2) { x = -HALF + t * 0.2; z = HALF + 0.12; }
          else { x = -HALF - 0.12; z = -HALF + t * 0.2; }
          foliage.push({ x, z, height: 0.04 + r() * 0.06, color: r() > 0.5 ? C.leaf : C.leafLight });
        }
        return foliage.map((plant, i) => (
          <Cone key={`foliage-${i}`} pos={[plant.x, plant.height/2, plant.z]} rTop={0} rBot={0.015} h={plant.height} segs={4} color={plant.color} />
        ));
      })()}

      {/* Mossy border edging */}
      {Array.from({ length: 21 }, (_, i) => {
        const offset = -1.2 + i * 0.12;

        return (
          <group key={`edge-${i}`}>
            <Box
              pos={[offset, -0.002, -1.43]}
              size={[0.075, 0.025, 0.04]}
              color={i % 3 === 0 ? C.gold : C.leafDark}
            />
            <Box
              pos={[offset, -0.002, 1.43]}
              size={[0.075, 0.025, 0.04]}
              color={i % 3 === 0 ? C.gold : C.leafDark}
            />
            <Box
              pos={[-1.43, -0.002, offset]}
              size={[0.04, 0.025, 0.075]}
              color={i % 3 === 0 ? C.gold : C.leafDark}
            />
            <Box
              pos={[1.43, -0.002, offset]}
              size={[0.04, 0.025, 0.075]}
              color={i % 3 === 0 ? C.gold : C.leafDark}
            />
          </group>
        );
      })}
    </group>
  );
}

// ------------------------------------------------------
// THE ENCHANTED BALETE TREE
// ------------------------------------------------------

function CentreBaleteTree({ C }) {
  const random = useMemo(() => seededRandom(903), []);
  const canopyRefs = useRef([]);

  const aerialRoots = useMemo(() => {
    const roots = [];

    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2 + random() * 0.12;
      const radius = 0.43 + random() * 0.38;
      const height = 0.62 + random() * 0.75;
      const sway = (random() - 0.5) * 0.19;

      roots.push({
        angle,
        radius,
        height,
        sway,
        thickness: 0.008 + random() * 0.014,
      });
    }

    return roots;
  }, [random]);

  const canopy = useMemo(() => {
    const leaves = [];

    // Tier 1: Lower, wider leaves (larger clusters)
    for (let i = 0; i < 60; i++) {
      const angle = random() * Math.PI * 2;
      const ring = Math.sqrt(random());
      const radius = 0.28 + ring * 0.5;

      leaves.push({
        pos: [
          Math.cos(angle) * radius * 0.95,
          1.35 + random() * 0.35 - ring * 0.08,
          Math.sin(angle) * radius * 0.75,
        ],
        basePos: [
          Math.cos(angle) * radius * 0.95,
          1.35 + random() * 0.35 - ring * 0.08,
          Math.sin(angle) * radius * 0.75,
        ],
        size: [
          0.3 + random() * 0.2,
          0.22 + random() * 0.14,
          0.28 + random() * 0.16,
        ],
        color: [
          C.leafDark,
          C.leaf,
          darken(C.leaf, 0.2),
          C.leafLight,
        ][Math.floor(random() * 4)],
        swayPhase: random() * Math.PI * 2,
        swaySpeed: 0.4 + random() * 0.3,
        swayAmp: 0.03 + random() * 0.04,
        swayZPhase: random() * Math.PI * 2,
      });
    }

    // Tier 2: Middle canopy (most dense)
    for (let i = 0; i < 100; i++) {
      const angle = random() * Math.PI * 2;
      const ring = Math.sqrt(random());
      const radius = 0.35 + ring * 0.55;

      leaves.push({
        pos: [
          Math.cos(angle) * radius * 0.92,
          1.55 + random() * 0.45 - ring * 0.1,
          Math.sin(angle) * radius * 0.72,
        ],
        basePos: [
          Math.cos(angle) * radius * 0.92,
          1.55 + random() * 0.45 - ring * 0.1,
          Math.sin(angle) * radius * 0.72,
        ],
        size: [
          0.22 + random() * 0.16,
          0.16 + random() * 0.12,
          0.22 + random() * 0.14,
        ],
        color: [
          C.leaf,
          C.leafLight,
          C.leafDark,
          darken(C.leaf, 0.12),
        ][Math.floor(random() * 4)],
        swayPhase: random() * Math.PI * 2,
        swaySpeed: 0.5 + random() * 0.4,
        swayAmp: 0.025 + random() * 0.035,
        swayZPhase: random() * Math.PI * 2,
      });
    }

    // Tier 3: Upper canopy (smaller, lighter leaves)
    for (let i = 0; i < 70; i++) {
      const angle = random() * Math.PI * 2;
      const ring = Math.sqrt(random());
      const radius = 0.42 + ring * 0.4;

      leaves.push({
        pos: [
          Math.cos(angle) * radius * 0.88,
          1.75 + random() * 0.35 - ring * 0.08,
          Math.sin(angle) * radius * 0.68,
        ],
        basePos: [
          Math.cos(angle) * radius * 0.88,
          1.75 + random() * 0.35 - ring * 0.08,
          Math.sin(angle) * radius * 0.68,
        ],
        size: [
          0.18 + random() * 0.12,
          0.12 + random() * 0.1,
          0.18 + random() * 0.1,
        ],
        color: [
          C.leafLight,
          C.leaf,
          darken(C.leafLight, 0.15),
          C.leafDark,
        ][Math.floor(random() * 4)],
        swayPhase: random() * Math.PI * 2,
        swaySpeed: 0.6 + random() * 0.5,
        swayAmp: 0.02 + random() * 0.03,
        swayZPhase: random() * Math.PI * 2,
      });
    }

    // Tier 4: Topmost leaves (smallest, most movement)
    for (let i = 0; i < 40; i++) {
      const angle = random() * Math.PI * 2;
      const ring = Math.sqrt(random());
      const radius = 0.48 + ring * 0.25;

      leaves.push({
        pos: [
          Math.cos(angle) * radius * 0.85,
          1.9 + random() * 0.25 - ring * 0.06,
          Math.sin(angle) * radius * 0.65,
        ],
        basePos: [
          Math.cos(angle) * radius * 0.85,
          1.9 + random() * 0.25 - ring * 0.06,
          Math.sin(angle) * radius * 0.65,
        ],
        size: [
          0.14 + random() * 0.1,
          0.1 + random() * 0.08,
          0.14 + random() * 0.08,
        ],
        color: [
          C.leafLight,
          darken(C.leafLight, 0.1),
          C.leaf,
          C.leafDark,
        ][Math.floor(random() * 4)],
        swayPhase: random() * Math.PI * 2,
        swaySpeed: 0.8 + random() * 0.6,
        swayAmp: 0.025 + random() * 0.04,
        swayZPhase: random() * Math.PI * 2,
      });
    }

    return leaves;
  }, [C, random]);

  const spiritLights = useMemo(() => {
    const lights = [];

    for (let i = 0; i < 15; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 0.48 + random() * 0.48;

      lights.push([
        Math.cos(angle) * radius,
        0.38 + random() * 1.45,
        Math.sin(angle) * radius * 0.72,
      ]);
    }

    return lights;
  }, [random]);

  // Animate canopy leaves swaying
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    canopyRefs.current.forEach((ref, i) => {
      if (ref && canopy[i]) {
        const leaf = canopy[i];
        ref.position.x = leaf.basePos[0] + Math.sin(t * leaf.swaySpeed + leaf.swayPhase) * leaf.swayAmp;
        ref.position.z = leaf.basePos[2] + Math.cos(t * leaf.swaySpeed * 0.7 + leaf.swayZPhase) * leaf.swayAmp;
        ref.position.y = leaf.basePos[1] + Math.sin(t * leaf.swaySpeed * 1.2 + leaf.swayPhase) * leaf.swayAmp * 0.5;
      }
    });
  });

  return (
    <group>
      {/* Ancient root mound */}
      <Sphere
        pos={[0, 0.015, 0]}
        r={0.55}
        squash={[1.14, 0.22, 0.93]}
        color="#3b4430"
        detail={16}
      />

      {/* Massive, irregular lower trunk */}
      <Cylinder
        pos={[0, 0.61, 0]}
        top={0.27}
        bottom={0.42}
        height={1.28}
        color={C.trunk}
        segments={13}
      />

      {/* Knotted bark formations */}
      <Sphere
        pos={[-0.15, 0.56, 0.17]}
        r={0.29}
        squash={[0.68, 1.45, 0.73]}
        color={darken(C.trunk, 0.08)}
        detail={12}
      />

      <Sphere
        pos={[0.17, 0.78, -0.12]}
        r={0.24}
        squash={[0.72, 1.3, 0.77]}
        color={C.bark}
        detail={12}
      />

      {/* Bark ridges running vertically */}
      {Array.from({ length: 13 }, (_, i) => {
        const angle = (i / 13) * Math.PI * 2;
        const radius = 0.31 + (i % 3) * 0.025;

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius * 0.82;

        return (
          <OrganicBranch
            key={`bark-ridge-${i}`}
            start={[x * 0.84, 0.08, z * 0.84]}
            end={[x * 0.68, 1.22 + (i % 4) * 0.06, z * 0.68]}
            radius={0.027 + (i % 3) * 0.007}
            radiusEnd={0.009}
            color={i % 2 === 0 ? "#8a6342" : "#392b22"}
          />
        );
      })}

      {/* Large buttress roots spreading across the ground */}
      {Array.from({ length: 9 }, (_, i) => {
        const angle = (i / 9) * Math.PI * 2;
        const endRadius = 0.66 + (i % 3) * 0.06;

        const start = [
          Math.cos(angle) * 0.2,
          0.48,
          Math.sin(angle) * 0.17,
        ];

        const end = [
          Math.cos(angle) * endRadius,
          0.025,
          Math.sin(angle) * endRadius * 0.76,
        ];

        return (
          <group key={`buttress-${i}`}>
            <OrganicBranch
              start={start}
              end={end}
              radius={0.105 + (i % 3) * 0.018}
              radiusEnd={0.025}
              color={i % 2 === 0 ? C.trunk : "#68482f"}
            />
            <OrganicBranch
              start={[
                Math.cos(angle) * 0.29,
                0.27,
                Math.sin(angle) * 0.23,
              ]}
              end={[
                Math.cos(angle) * (endRadius * 0.83),
                0.035,
                Math.sin(angle) * (endRadius * 0.83) * 0.76,
              ]}
              radius={0.052}
              radiusEnd={0.012}
              color="#765238"
            />
          </group>
        );
      })}

      {/* Main branches spreading beneath the canopy */}
      <OrganicBranch
        start={[0, 0.95, 0]}
        end={[-0.64, 1.52, 0.04]}
        radius={0.14}
        radiusEnd={0.07}
        color={C.trunk}
      />

      <OrganicBranch
        start={[0.02, 1.03, -0.03]}
        end={[0.62, 1.55, -0.08]}
        radius={0.13}
        radiusEnd={0.06}
        color={C.trunk}
      />

      <OrganicBranch
        start={[0, 1.05, 0]}
        end={[-0.14, 1.64, -0.47]}
        radius={0.12}
        radiusEnd={0.045}
        color="#69472f"
      />

      <OrganicBranch
        start={[0.02, 1.1, 0]}
        end={[0.16, 1.58, 0.48]}
        radius={0.11}
        radiusEnd={0.045}
        color="#69472f"
      />

      {/* Fine hanging aerial roots */}
      {aerialRoots.map((root, i) => {
        const x = Math.cos(root.angle) * root.radius;
        const z = Math.sin(root.angle) * root.radius * 0.72;
        const startY = 1.42 + (i % 4) * 0.12;
        const endY = Math.max(0.08, startY - root.height);

        const middleX = x + root.sway;
        const middleZ = z - root.sway * 0.35;

        return (
          <group key={`aerial-root-${i}`}>
            <OrganicBranch
              start={[x * 0.76, startY, z * 0.76]}
              end={[middleX, (startY + endY) / 2, middleZ]}
              radius={root.thickness}
              radiusEnd={root.thickness * 0.72}
              color={i % 3 === 0 ? "#8c6745" : "#57412e"}
            />

            <OrganicBranch
              start={[middleX, (startY + endY) / 2, middleZ]}
              end={[x + root.sway * 1.4, endY, z]}
              radius={root.thickness * 0.72}
              radiusEnd={0.003}
              color="#79583c"
            />
          </group>
        );
      })}

      {/* Additional hanging branches from canopy */}
      {(() => {
        const r = seededRandom(9999);
        const branches = [];
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2 + r() * 0.2;
          const radius = 0.35 + r() * 0.4;
          const startX = Math.cos(angle) * radius * 0.85;
          const startZ = Math.sin(angle) * radius * 0.7;
          const startY = 1.6 + r() * 0.35;
          const endY = 0.8 + r() * 0.3;
          const sway = (r() - 0.5) * 0.12;
          branches.push({ startX, startZ, startY, endY, sway, thickness: 0.008 + r() * 0.012 });
        }
        return branches.map((branch, i) => (
          <group key={`hanging-branch-${i}`}>
            <OrganicBranch
              start={[branch.startX, branch.startY, branch.startZ]}
              end={[branch.startX + branch.sway, (branch.startY + branch.endY) / 2, branch.startZ - branch.sway * 0.4]}
              radius={branch.thickness}
              radiusEnd={branch.thickness * 0.6}
              color="#5D7A5D"
            />
            <OrganicBranch
              start={[branch.startX + branch.sway, (branch.startY + branch.endY) / 2, branch.startZ - branch.sway * 0.4]}
              end={[branch.startX + branch.sway * 1.5, branch.endY, branch.startZ]}
              radius={branch.thickness * 0.6}
              radiusEnd={0.004}
              color="#4A664A"
            />
            <Sphere
              pos={[branch.startX + branch.sway * 1.5, branch.endY - 0.05, branch.startZ]}
              r={0.025}
              squash={[0.8, 1.2, 0.8]}
              color={C.leafLight}
              detail={6}
            />
          </group>
        ));
      })()}

      {/* Broad, layered canopy - multiple distinct clumps */}
      <Sphere
        pos={[0, 1.55, 0]}
        r={0.55}
        squash={[1.4, 0.7, 1.3]}
        color={C.leafDark}
        detail={14}
      />

      <Sphere
        pos={[-0.5, 1.58, 0.15]}
        r={0.48}
        squash={[1.3, 0.75, 1.2]}
        color={C.leaf}
        detail={12}
      />

      <Sphere
        pos={[0.52, 1.62, -0.1]}
        r={0.48}
        squash={[1.35, 0.72, 1.25]}
        color={C.leaf}
        detail={12}
      />

      <Sphere
        pos={[-0.2, 1.78, 0.28]}
        r={0.42}
        squash={[1.45, 0.68, 1.15]}
        color={C.leafLight}
        detail={12}
      />

      <Sphere
        pos={[0.3, 1.82, -0.22]}
        r={0.42}
        squash={[1.4, 0.65, 1.1]}
        color={C.leaf}
        detail={12}
      />

      <Sphere
        pos={[0.1, 1.95, 0.08]}
        r={0.38}
        squash={[1.5, 0.62, 1.15]}
        color={C.leafLight}
        detail={10}
      />

      <Sphere
        pos={[-0.45, 1.48, -0.22]}
        r={0.45}
        squash={[1.3, 0.78, 1.2]}
        color={C.leafDark}
        detail={12}
      />

      <Sphere
        pos={[0.48, 1.52, 0.18]}
        r={0.45}
        squash={[1.32, 0.76, 1.22]}
        color={C.leafDark}
        detail={12}
      />

      {canopy.map((leaf, i) => (
        <Sphere
          key={`canopy-leaf-${i}`}
          ref={el => { if(el) canopyRefs.current[i] = el; }}
          pos={leaf.pos}
          r={0.18}
          squash={leaf.size}
          color={leaf.color}
          detail={8}
        />
      ))}

      {/* Small hanging vine tips */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const x = Math.cos(angle) * (0.7 + (i % 3) * 0.06);
        const z = Math.sin(angle) * (0.49 + (i % 2) * 0.07);

        return (
          <group key={`vine-tip-${i}`}>
            <OrganicBranch
              start={[x * 0.92, 1.69 - (i % 3) * 0.07, z * 0.92]}
              end={[x, 1.35 - (i % 4) * 0.12, z]}
              radius={0.012}
              radiusEnd={0.004}
              color="#48653b"
            />
            <Sphere
              pos={[x, 1.34 - (i % 4) * 0.12, z]}
              r={0.025}
              squash={[0.7, 1.4, 0.7]}
              color={C.leafLight}
              detail={7}
            />
          </group>
        );
      })}

      {/* Enchanted lights suspended around the tree */}
      {spiritLights.map((pos, i) => (
        <GlowOrb
          key={`tree-spirit-${i}`}
          pos={pos}
          color={i % 4 === 0 ? "#9ff8d7" : C.glow}
          scale={i % 3 === 0 ? 0.025 : 0.016}
          intensity={1.8}
        />
      ))}

      {/* Moss, small plants, and stones around the roots */}
      {Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const radius = 0.58 + (i % 4) * 0.055;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius * 0.78;

        return (
          <group key={`root-ground-detail-${i}`}>
            <Sphere
              pos={[x, 0.035, z]}
              r={0.075 + (i % 3) * 0.012}
              squash={[1.2, 0.45, 0.9]}
              color={i % 2 === 0 ? "#3e5940" : "#62634a"}
              detail={8}
            />
            {i % 2 === 0 && (
              <Sphere
                pos={[x + 0.025, 0.08, z - 0.015]}
                r={0.04}
                squash={[0.6, 1.5, 0.6]}
                color={C.leafLight}
                detail={7}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

// ------------------------------------------------------
// NATURAL SPRING AND STONE POOL
// ------------------------------------------------------

function BaleteSpringPool({ C }) {
  const waterRef = useRef();
  const channelRef = useRef();

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    if (waterRef.current) {
      waterRef.current.material.emissiveIntensity =
        0.22 + Math.sin(time * 1.5) * 0.08;
    }

    if (channelRef.current) {
      channelRef.current.material.emissiveIntensity =
        0.25 + Math.sin(time * 2.1) * 0.1;
    }
  });

  const rimStones = useMemo(() => {
    const random = seededRandom(400);
    const stones = [];

    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      const radiusX = 0.53 + random() * 0.035;
      const radiusZ = 0.34 + random() * 0.035;

      stones.push({
        pos: [
          Math.cos(angle) * radiusX,
          0.005 + random() * 0.012,
          0.59 + Math.sin(angle) * radiusZ,
        ],
        rot: [0, -angle, (random() - 0.5) * 0.13],
        size: [
          0.13 + random() * 0.055,
          0.055 + random() * 0.02,
          0.1 + random() * 0.035,
        ],
        color: ["#777363", "#625f50", "#89816a"][Math.floor(random() * 3)],
      });
    }

    return stones;
  }, []);

  return (
    <group>
      {/* Earth and stone foundation beneath the pool */}
      <Sphere
        pos={[0, -0.005, 0.59]}
        r={0.56}
        squash={[1.12, 0.1, 0.76]}
        color="#293c30"
        detail={16}
      />

      {/* Dark stone bed */}
      <mesh position={[0, 0.014, 0.59]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.51, 40]} />
        <meshStandardMaterial color="#4b594d" roughness={0.95} />
      </mesh>

      {/* Turquoise spring water */}
      <mesh
        ref={waterRef}
        position={[0, 0.037, 0.59]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.455, 48]} />
        <meshStandardMaterial
          color={C.water}
          roughness={0.22}
          metalness={0.12}
          transparent
          opacity={0.86}
          emissive="#27a99c"
          emissiveIntensity={0.22}
        />
      </mesh>

      {/* Shallow ripples */}
      {[0.19, 0.29, 0.39].map((radius, i) => (
        <mesh
          key={`water-ripple-${i}`}
          position={[0.02, 0.043 + i * 0.001, 0.59]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[radius, radius + 0.009, 48]} />
          <meshBasicMaterial
            color={i === 1 ? "#b5fff1" : "#8ce8df"}
            transparent
            opacity={0.32 - i * 0.06}
          />
        </mesh>
      ))}

      {/* Individual natural stones form an uneven pool rim */}
      {rimStones.map((stone, i) => (
        <Box
          key={`spring-rim-${i}`}
          pos={stone.pos}
          size={stone.size}
          color={stone.color}
          rot={stone.rot}
        />
      ))}

      {/* Water flowing from the tree's roots into the pool */}
      <mesh
        ref={channelRef}
        position={[0, 0.035, 0.27]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.2, 0.5]} />
        <meshStandardMaterial
          color="#68e3d6"
          transparent
          opacity={0.8}
          emissive="#31c6b9"
          emissiveIntensity={0.25}
          roughness={0.2}
        />
      </mesh>

      {/* Pebbles in and beside the spring */}
      {Array.from({ length: 13 }, (_, i) => {
        const angle = i * 2.399;
        const radius = 0.14 + (i % 4) * 0.075;

        return (
          <Sphere
            key={`spring-pebble-${i}`}
            pos={[
              Math.cos(angle) * radius,
              0.045 + (i % 3) * 0.002,
              0.59 + Math.sin(angle) * radius * 0.66,
            ]}
            r={0.024 + (i % 3) * 0.008}
            squash={[1.3, 0.45, 0.9]}
            color={i % 2 === 0 ? "#b4a88a" : "#758777"}
            detail={7}
          />
        );
      })}

      {/* Stepping stones leading to the spring */}
      {[
        [-0.28, 0.025, 1.0],
        [-0.09, 0.026, 1.11],
        [0.15, 0.025, 1.0],
        [0.31, 0.024, 0.91],
      ].map((pos, i) => (
        <Sphere
          key={`spring-step-${i}`}
          pos={pos}
          r={0.105}
          squash={[1.15, 0.32, 0.78]}
          color={i % 2 === 0 ? "#827b68" : "#6d725f"}
          detail={8}
        />
      ))}

      {/* Aquatic plants at the edge of the pool */}
      {[
        [-0.52, 0.06, 0.37],
        [0.49, 0.05, 0.39],
        [-0.43, 0.05, 0.86],
        [0.48, 0.06, 0.82],
      ].map((pos, i) => (
        <group key={`pool-plant-${i}`} position={pos}>
          <OrganicBranch
            start={[0, 0, 0]}
            end={[-0.04, 0.16, 0]}
            radius={0.012}
            radiusEnd={0.006}
            color="#456b40"
          />
          <Sphere
            pos={[-0.07, 0.12, 0.015]}
            r={0.065}
            squash={[1.3, 0.36, 0.7]}
            color={C.leafLight}
            detail={8}
          />
          <Sphere
            pos={[0.045, 0.09, -0.02]}
            r={0.055}
            squash={[1.2, 0.34, 0.7]}
            color={C.leaf}
            detail={8}
          />
        </group>
      ))}

      <GlowOrb pos={[-0.34, 0.11, 0.52]} color="#9ffff0" scale={0.018} />
      <GlowOrb pos={[0.34, 0.1, 0.69]} color="#9ffff0" scale={0.018} />
    </group>
  );
}

// ------------------------------------------------------
// FILIPINO TROPICAL BORDER DETAILS
// ------------------------------------------------------

function Fern({ pos, scale = 1, color = "#3d7547", rotation = 0 }) {
  return (
    <group position={pos} scale={scale} rotation={[0, rotation, 0]}>
      <OrganicBranch
        start={[0, 0, 0]}
        end={[0, 0.28, 0]}
        radius={0.012}
        radiusEnd={0.004}
        color="#527647"
      />

      {Array.from({ length: 5 }, (_, i) => {
        const y = 0.055 + i * 0.045;
        const spread = 0.055 + i * 0.012;

        return (
          <group key={`fern-frond-${i}`}>
            <OrganicBranch
              start={[0, y, 0]}
              end={[-spread, y + 0.06, 0.015]}
              radius={0.008}
              radiusEnd={0.003}
              color="#527647"
            />
            <OrganicBranch
              start={[0, y, 0]}
              end={[spread, y + 0.06, -0.015]}
              radius={0.008}
              radiusEnd={0.003}
              color="#527647"
            />
            <Sphere
              pos={[-spread * 0.8, y + 0.065, 0.02]}
              r={0.045}
              squash={[1.3, 0.3, 0.6]}
              color={color}
              detail={7}
            />
            <Sphere
              pos={[spread * 0.8, y + 0.065, -0.02]}
              r={0.045}
              squash={[1.3, 0.3, 0.6]}
              color={color}
              detail={7}
            />
          </group>
        );
      })}
    </group>
  );
}

function StoneLantern({ pos, C }) {
  return (
    <group position={pos}>
      <Box
        pos={[0, 0.055, 0]}
        size={[0.14, 0.11, 0.14]}
        color="#615b49"
      />

      <Box
        pos={[0, 0.15, 0]}
        size={[0.11, 0.08, 0.11]}
        color="#786b52"
      />

      <Box
        pos={[0, 0.21, 0]}
        size={[0.16, 0.035, 0.16]}
        color="#4b483c"
      />

      <Sphere
        pos={[0, 0.15, 0]}
        r={0.035}
        color={C.glow}
        emissive={C.glow}
        emissiveIntensity={2.4}
        detail={8}
      />

      <pointLight
        position={[0, 0.17, 0]}
        color={C.glow}
        intensity={0.28}
        distance={0.6}
      />
    </group>
  );
}

function BaleteBorderDecor({ C }) {
  const borderPlants = useMemo(() => {
    const random = seededRandom(721);
    const plants = [];

    for (let i = 0; i < 30; i++) {
      const side = i % 4;
      const t = -1.16 + random() * 2.32;
      let x;
      let z;

      if (side === 0) {
        x = t;
        z = -1.23;
      } else if (side === 1) {
        x = t;
        z = 1.23;
      } else if (side === 2) {
        x = -1.23;
        z = t;
      } else {
        x = 1.23;
        z = t;
      }

      plants.push({
        pos: [x, 0, z],
        scale: 0.65 + random() * 0.65,
        rotation: random() * Math.PI * 2,
        color: random() > 0.5 ? C.leaf : C.leafLight,
      });
    }

    return plants;
  }, [C]);

  return (
    <group>
      {/* Dense ferns around the outer border */}
      {borderPlants.map((plant, i) => (
        <Fern
          key={`border-fern-${i}`}
          pos={plant.pos}
          scale={plant.scale}
          rotation={plant.rotation}
          color={plant.color}
        />
      ))}

      {/* Lanterns mark the enchanted clearing */}
      <StoneLantern pos={[-1.06, 0, -0.93]} C={C} />
      <StoneLantern pos={[1.06, 0, -0.93]} C={C} />
      <StoneLantern pos={[-1.08, 0, 0.91]} C={C} />
      <StoneLantern pos={[1.08, 0, 0.91]} C={C} />

      {/* Moss-covered boulders */}
      {[
        [-0.93, 0.025, -0.72],
        [0.94, 0.02, -0.66],
        [-1.0, 0.02, 0.35],
        [1.0, 0.025, 0.3],
        [-0.84, 0.02, 1.04],
        [0.83, 0.02, 1.03],
      ].map((pos, i) => (
        <group key={`border-boulder-${i}`}>
          <Sphere
            pos={pos}
            r={0.1 + (i % 3) * 0.025}
            squash={[1.2, 0.72, 0.9]}
            color={i % 2 === 0 ? "#555d48" : "#696652"}
            detail={9}
          />
          <Sphere
            pos={[pos[0] - 0.02, pos[1] + 0.055, pos[2]]}
            r={0.065}
            squash={[1.2, 0.25, 0.8]}
            color="#3c6743"
            detail={7}
          />
        </group>
      ))}

      {/* Subtle golden border runes / engraved markers */}
      {Array.from({ length: 12 }, (_, i) => {
        const x = -0.9 + i * 0.164;

        return (
          <group key={`border-rune-${i}`}>
            <Box
              pos={[x, 0.004, -1.34]}
              size={[0.035, 0.012, 0.055]}
              color={i % 3 === 0 ? C.gold : "#5e6248"}
            />
            <Box
              pos={[x, 0.004, 1.34]}
              size={[0.035, 0.012, 0.055]}
              color={i % 3 === 0 ? C.gold : "#5e6248"}
            />
          </group>
        );
      })}

      {/* Floating firefly clusters */}
      {Array.from({ length: 22 }, (_, i) => {
        const random = seededRandom(i + 501);

        const x = (random() - 0.5) * 2.3;
        const y = 0.12 + random() * 1.5;
        const z = (random() - 0.5) * 2.3;

        return (
          <GlowOrb
            key={`border-firefly-${i}`}
            pos={[x, y, z]}
            color={i % 4 === 0 ? "#a5ffe2" : C.glow}
            scale={i % 5 === 0 ? 0.02 : 0.012}
            intensity={1.4}
          />
        );
      })}

      {/* Small flowering plants */}
      {[
        [-0.93, 0.02, -0.35],
        [0.92, 0.02, -0.25],
        [-0.91, 0.02, 0.72],
        [0.9, 0.02, 0.7],
      ].map((pos, i) => (
        <group key={`border-flower-${i}`} position={pos}>
          <OrganicBranch
            start={[0, 0, 0]}
            end={[0, 0.13, 0]}
            radius={0.009}
            radiusEnd={0.004}
            color="#4f7444"
          />
          <Sphere
            pos={[0, 0.15, 0]}
            r={0.035}
            color={C.flower}
            detail={8}
          />
          <Sphere
            pos={[0.025, 0.14, 0.018]}
            r={0.023}
            color="#f5d79a"
            detail={7}
          />
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------
// MIST AND ATMOSPHERE
// ------------------------------------------------------

function Mist() {
  const mistRefs = useRef([]);

  const clouds = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        x: Math.cos(i * 2.4) * (0.65 + (i % 3) * 0.15),
        y: 0.12 + (i % 3) * 0.07,
        z: Math.sin(i * 2.4) * (0.65 + (i % 3) * 0.15),
        scale: 0.35 + (i % 3) * 0.12,
        speed: 0.08 + (i % 4) * 0.025,
      })),
    []
  );

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    mistRefs.current.forEach((mist, i) => {
      if (!mist) return;

      mist.position.x =
        clouds[i].x + Math.sin(time * clouds[i].speed + i) * 0.08;
      mist.position.z =
        clouds[i].z + Math.cos(time * clouds[i].speed + i) * 0.06;
    });
  });

  return (
    <group>
      {clouds.map((cloud, i) => (
        <mesh
          key={`mist-${i}`}
          ref={(el) => (mistRefs.current[i] = el)}
          position={[cloud.x, cloud.y, cloud.z]}
          scale={[cloud.scale, 0.055, cloud.scale * 0.6]}
        >
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial
            color="#b2e8d9"
            transparent
            opacity={0.065}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------
// GLOWING FIREFLIES
// ------------------------------------------------------

function Fireflies({ C }) {
  const groupRef = useRef();

  const fireflies = useMemo(() => {
    const r = seededRandom(8888);
    const palette = [
      C.gold,
      C.glow,
      C.leafLight,
      "#FFE4B5",
      "#FFF9C4",
    ];
    return Array.from({ length: 32 }, (_, i) => ({
      base: [(r() - 0.5) * 2.2, 0.4 + r() * 1.8, (r() - 0.5) * 2.2],
      phase: r() * Math.PI * 2,
      speed: 0.3 + r() * 0.6,
      amp: 0.03 + r() * 0.05,
      color: palette[i % palette.length],
      size: 0.008 + r() * 0.012,
    }));
  }, [C]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    groupRef.current.children.forEach((mesh, i) => {
      const f = fireflies[i];
      mesh.position.set(
        f.base[0] + Math.sin(t * f.speed + f.phase) * f.amp,
        f.base[1] + Math.sin(t * f.speed * 1.3 + f.phase) * f.amp * 0.6,
        f.base[2] + Math.cos(t * f.speed + f.phase) * f.amp
      );
      if (mesh.material) mesh.material.opacity = 0.5 + Math.sin(t * 2 + f.phase) * 0.4;
    });
  });

  return (
    <group ref={groupRef}>
      {fireflies.map((f, i) => (
        <mesh key={i} position={f.base}>
          <sphereGeometry args={[f.size, 6, 6]} />
          <meshBasicMaterial color={f.color} transparent opacity={0.7} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------
// MAIN SCENE
// ------------------------------------------------------

export default function DiwataScene({ themeColors: themeProp }) {
  const matrix = useMemo(buildMatrix, []);
  const C = useMemo(() => themeColors(themeProp), [themeProp]);

  return (
    <group position={[0, ROOT_Y, 0]} rotation={[0, Math.PI / 4, 0]}>
      <Lighting C={C} />

      <QRGround matrix={matrix} C={C} />

      {/* Main focal landmark */}
      <CentreBaleteTree C={C} />

      {/* Spring flowing from the ancient roots */}
      <BaleteSpringPool C={C} />

      {/* Siquijor-inspired tropical enchanted border */}
      <BaleteBorderDecor C={C} />

      {/* Glowing fireflies */}
      <Fireflies C={C} />

      {/* Atmospheric effects */}
      <Mist />
    </group>
  );
}
