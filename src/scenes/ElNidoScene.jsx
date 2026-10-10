
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

function getMaterial(color, extra = {}) {
  const key = `${color}-${JSON.stringify(extra)}`;

  if (!materialCache.has(key)) {
    materialCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        flatShading: true,
        ...extra,
      })
    );
  }

  return materialCache.get(key);
}

function rng(seed = 1) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function blendHex(a, b, amount) {
  const aa = parseInt(a.replace("#", ""), 16);
  const bb = parseInt(b.replace("#", ""), 16);

  const ar = (aa >> 16) & 255;
  const ag = (aa >> 8) & 255;
  const ab = aa & 255;

  const br = (bb >> 16) & 255;
  const bg = (bb >> 8) & 255;
  const bv = bb & 255;

  const r = Math.round(ar + (br - ar) * amount);
  const g = Math.round(ag + (bg - ag) * amount);
  const blue = Math.round(ab + (bv - ab) * amount);

  return `#${((r << 16) | (g << 8) | blue)
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
  const dark = theme.dark || "#174536";
  const light = theme.light || "#f2ead9";
  const primary = theme.primary || "#236b54";
  const accent = theme.accent || "#e7bd68";
  const water = theme.secondary || "#36d6d0";

  return {
    dark,
    light,
    primary,
    accent,
    water,
    waterLight: lighten(water, 0.3),
    waterDeep: darken(water, 0.32),
    rock: "#888d83",
    rockLight: "#c2c3ae",
    rockShadow: "#545f58",
    sand: "#e4d3ae",
    soil: darken(dark, 0.35),
    leaf: blendHex(primary, "#4d8d4b", 0.45),
    leafLight: blendHex(primary, "#9acb71", 0.55),
    leafDark: darken(primary, 0.25),
    trunk: "#594333",
    flower: "#f4b8c7",
  };
}

function Box({
  position,
  size,
  color,
  rotation = [0, 0, 0],
  castShadow = true,
  receiveShadow = true,
  material,
}) {
  return (
    <mesh
      position={position}
      scale={size}
      rotation={rotation}
      material={material || getMaterial(color)}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}

function Rock({
  position,
  scale = [1, 1, 1],
  color,
  detail = 1,
  rotation = [0, 0, 0],
}) {
  return (
    <mesh
      position={position}
      scale={scale}
      rotation={rotation}
      material={getMaterial(color)}
      castShadow
      receiveShadow
    >
      <icosahedronGeometry args={[1, detail]} />
    </mesh>
  );
}

function Glow({
  position,
  color,
  size = 0.025,
  intensity = 1,
}) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse =
        0.88 + Math.sin(clock.elapsedTime * 2 + position[0] * 4) * 0.12;

      ref.current.scale.setScalar(pulse);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshBasicMaterial
        color={color}
        toneMapped={false}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────
// QR MATRIX
// ─────────────────────────────────────────────────────────────

function inFinder(x, z, ox, oz) {
  return (
    x >= ox &&
    x < ox + 7 &&
    z >= oz &&
    z < oz + 7
  );
}

function isFinderZone(x, z) {
  return (
    inFinder(x, z, 0, 0) ||
    inFinder(x, z, GRID - 7, 0) ||
    inFinder(x, z, 0, GRID - 7)
  );
}

function finderBit(x, z, ox, oz) {
  const dx = x - ox;
  const dz = z - oz;
  const edge = Math.min(dx, dz, 6 - dx, 6 - dz);

  return edge !== 1;
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

// ─────────────────────────────────────────────────────────────
// QR LANDSCAPE
// ─────────────────────────────────────────────────────────────

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

        let height = dark ? H_DARK : H_BASE;
        let color = dark ? C.dark : C.waterLight;

        if (finder) {
          height = H_FINDER;
        } else if (timing) {
          color = dark ? C.primary : C.waterLight;
        } else if (dark && (x + z) % 4 === 0) {
          color = C.primary;
        }

        items.push({
          x: wx,
          z: wz,
          height,
          color,
          finder,
          dark,
        });
      }
    }

    return items;
  }, [matrix, C]);

  const side = GRID * TILE;

  return (
    <group>
      <Box
        position={[0, -0.06, 0]}
        size={[side + 0.14, 0.12, side + 0.14]}
        color={C.waterLight}
        castShadow={false}
      />

      {modules.map((module, index) => (
        <Box
          key={index}
          position={[
            module.x,
            module.height / 2,
            module.z,
          ]}
          size={[
            TILE * (module.finder ? 0.96 : 0.91),
            module.height,
            TILE * (module.finder ? 0.96 : 0.91),
          ]}
          color={module.color}
        />
      ))}

      <Box
        position={[0, -0.15, 0]}
        size={[side + 0.18, 0.10, side + 0.18]}
        color={C.soil}
      />

      <Box
        position={[0, -0.24, 0]}
        size={[side + 0.12, 0.08, side + 0.12]}
        color={C.rockShadow}
      />

      {/* Gold corner details */}
      {[
        [-HALF - 0.04, -HALF - 0.04],
        [HALF + 0.04, -HALF - 0.04],
        [-HALF - 0.04, HALF + 0.04],
        [HALF + 0.04, HALF + 0.04],
      ].map(([x, z], index) => (
        <Box
          key={index}
          position={[x, 0.02, z]}
          size={[0.13, 0.045, 0.13]}
          color={C.accent}
        />
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// HIDDEN LAGOON: OPEN-FRONT LIMESTONE AMPHITHEATRE
//
// Camera/front is +Z.
// Cliffs occupy the back (-Z) and both sides.
// No cliff wall spans the front opening.
// ─────────────────────────────────────────────────────────────

function LagoonWater({ C }) {
  const waterRef = useRef();
  const shimmerRef = useRef();

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;

    if (waterRef.current) {
      waterRef.current.material.emissiveIntensity =
        0.22 + Math.sin(time * 0.8) * 0.055;
    }

    if (shimmerRef.current) {
      shimmerRef.current.position.x =
        Math.sin(time * 0.24) * 0.12;
    }
  });

  return (
    <group>
      {/* Large, shallow turquoise lagoon */}
      <mesh
        ref={waterRef}
        position={[0, 0.045, -0.01]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.68, 48]} />
        <meshStandardMaterial
          color={C.water}
          roughness={0.18}
          metalness={0.08}
          emissive={C.water}
          emissiveIntensity={0.22}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Deep-water centre */}
      <mesh
        position={[0, 0.047, -0.02]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.39, 40]} />
        <meshStandardMaterial
          color={C.waterDeep}
          roughness={0.23}
          metalness={0.08}
          transparent
          opacity={0.34}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Turquoise shallows at the open entrance */}
      <mesh
        position={[0, 0.049, 0.31]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.39, 40]} />
        <meshStandardMaterial
          color={C.waterLight}
          roughness={0.2}
          transparent
          opacity={0.56}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Small glimmering points on the water */}
      {[
        [-0.32, -0.05],
        [0.25, -0.24],
        [0.40, 0.08],
        [-0.18, 0.24],
        [0.05, -0.40],
        [-0.44, 0.13],
        [0.17, 0.40],
      ].map(([x, z], index) => (
        <mesh
          key={index}
          position={[x, 0.053, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.018, 8]} />
          <meshBasicMaterial
            color="#c3fff3"
            transparent
            opacity={0.48}
          />
        </mesh>
      ))}

      <Glow
        position={[0.08, 0.11, 0.12]}
        color={C.waterLight}
        size={0.018}
      />
    </group>
  );
}

function CliffMass({
  position,
  scale,
  color,
  rotation = [0, 0, 0],
}) {
  return (
    <Rock
      position={position}
      scale={scale}
      color={color}
      rotation={rotation}
      detail={1}
    />
  );
}

function HangingVines({ C, side = 1 }) {
  const vines = useMemo(() => {
    const random = rng(side * 371 + 19);

    return Array.from({ length: 9 }, (_, index) => ({
      x: (random() - 0.5) * 0.40,
      z: (random() - 0.5) * 0.34,
      length: 0.13 + random() * 0.25,
      lean: (random() - 0.5) * 0.11,
      color: index % 2 ? C.leaf : C.leafDark,
    }));
  }, [C, side]);

  return (
    <group>
      {vines.map((vine, index) => (
        <group
          key={index}
          position={[
            vine.x,
            0,
            vine.z,
          ]}
        >
          <Box
            position={[
              vine.lean,
              -vine.length / 2,
              0,
            ]}
            size={[0.012, vine.length, 0.012]}
            color={vine.color}
            castShadow={false}
          />

          {[0, 1, 2].map((leafIndex) => (
            <Rock
              key={leafIndex}
              position={[
                vine.lean + (leafIndex % 2 ? 0.025 : -0.02),
                -vine.length * (0.30 + leafIndex * 0.19),
                0,
              ]}
              scale={[0.035, 0.018, 0.025]}
              color={vine.color}
              detail={0}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

function LagoonCliffs({ C }) {
  const rearCliffs = useMemo(() => {
    const random = rng(2481);

    return Array.from({ length: 13 }, (_, index) => {
      const x = -0.93 + index * 0.155;
      const height = 0.83 + random() * 0.64;
      const width = 0.15 + random() * 0.10;
      const depth = 0.24 + random() * 0.12;

      return {
        x,
        height,
        width,
        depth,
        z: -0.72 - random() * 0.12,
        color: [
          C.rock,
          C.rockLight,
          C.rockShadow,
          "#a4a99a",
        ][index % 4],
        lean: (random() - 0.5) * 0.22,
      };
    });
  }, [C]);

  const sideCliffs = useMemo(() => {
    const random = rng(8802);
    const items = [];

    for (const side of [-1, 1]) {
      for (let index = 0; index < 8; index++) {
        const z = -0.65 + index * 0.135;
        const height = 0.65 + random() * 0.63;
        const width = 0.16 + random() * 0.10;

        items.push({
          side,
          z,
          height,
          width,
          x: side * (0.79 + random() * 0.08),
          color: [
            C.rock,
            C.rockLight,
            C.rockShadow,
          ][index % 3],
          lean: (random() - 0.5) * 0.15,
        });
      }
    }

    return items;
  }, [C]);

  return (
    <group>
      {/* Tall, irregular rear limestone wall */}
      {rearCliffs.map((cliff, index) => (
        <group key={`rear-${index}`}>
          <CliffMass
            position={[
              cliff.x,
              cliff.height * 0.45 + 0.12,
              cliff.z,
            ]}
            scale={[
              cliff.width,
              cliff.height,
              cliff.depth,
            ]}
            color={cliff.color}
            rotation={[0, cliff.lean, 0]}
          />

          {/* Angular ledges on the cliff face */}
          {index % 2 === 0 && (
            <Rock
              position={[
                cliff.x + 0.035,
                cliff.height * 0.58,
                cliff.z + 0.115,
              ]}
              scale={[
                cliff.width * 0.72,
                0.075,
                0.055,
              ]}
              color={C.rockLight}
              detail={0}
              rotation={[0, cliff.lean, 0.06]}
            />
          )}

          {/* Small patches of greenery */}
          {index % 2 === 1 && (
            <group
              position={[
                cliff.x,
                cliff.height * 0.48,
                cliff.z + 0.11,
              ]}
            >
              <Rock
                position={[0, 0, 0]}
                scale={[0.13, 0.07, 0.09]}
                color={C.leafDark}
                detail={1}
              />
              <Rock
                position={[0.055, 0.035, 0.025]}
                scale={[0.09, 0.06, 0.08]}
                color={C.leaf}
                detail={1}
              />
            </group>
          )}
        </group>
      ))}

      {/* Curved side walls.
          Their front ends stop short of the entrance. */}
      {sideCliffs.map((cliff, index) => (
        <group key={`side-${index}`}>
          <CliffMass
            position={[
              cliff.x,
              cliff.height * 0.43 + 0.10,
              cliff.z,
            ]}
            scale={[
              cliff.width,
              cliff.height,
              0.19 + (index % 3) * 0.045,
            ]}
            color={cliff.color}
            rotation={[
              0.02,
              cliff.lean,
              cliff.side * -0.07,
            ]}
          />

          {index % 2 === 0 && (
            <Rock
              position={[
                cliff.x - cliff.side * 0.035,
                cliff.height * 0.65,
                cliff.z + 0.09,
              ]}
              scale={[0.14, 0.07, 0.065]}
              color={C.rockLight}
              detail={0}
            />
          )}
        </group>
      ))}

      {/* Overhanging crown rocks, only along the rear */}
      {[-0.76, -0.46, -0.12, 0.24, 0.55, 0.79].map(
        (x, index) => (
          <Rock
            key={`crown-${index}`}
            position={[
              x,
              1.20 + (index % 3) * 0.12,
              -0.71,
            ]}
            scale={[
              0.22 + (index % 2) * 0.08,
              0.12 + (index % 3) * 0.04,
              0.18,
            ]}
            color={index % 2 ? C.rockLight : C.rock}
            detail={1}
            rotation={[0.05, index * 0.17, 0.12]}
          />
        )
      )}

      {/* Vines hang from cliff faces, away from the water centre */}
      {[-1, 1].map((side) => (
        <group
          key={`vines-${side}`}
          position={[side * 0.75, 0.91, -0.36]}
        >
          <HangingVines C={C} side={side} />
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// OPEN BEACH ENTRANCE
// Low, sculpted shore edges define the entrance without a wall.
// ─────────────────────────────────────────────────────────────

function LagoonShore({ C }) {
  return (
    <group>
      {/* Sandy shoreline on the left */}
      <Rock
        position={[-0.48, 0.015, 0.43]}
        scale={[0.36, 0.035, 0.15]}
        color={C.sand}
        detail={1}
      />

      {/* Sandy shoreline on the right */}
      <Rock
        position={[0.48, 0.015, 0.43]}
        scale={[0.36, 0.035, 0.15]}
        color={C.sand}
        detail={1}
      />

      {/* Low limestone rocks framing the entrance */}
      {[
        [-0.69, 0.07, 0.23, 0.16],
        [-0.60, 0.045, 0.48, 0.12],
        [0.69, 0.07, 0.23, 0.16],
        [0.60, 0.045, 0.48, 0.12],
      ].map(([x, y, z, size], index) => (
        <Rock
          key={index}
          position={[x, y, z]}
          scale={[size, size * 0.60, size * 0.75]}
          color={index % 2 ? C.rockLight : C.rock}
          detail={1}
        />
      ))}

      {/* Tiny plants beside the opening, not across it */}
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * 0.73, 0.055, 0.50]}
        >
          {[0, 1, 2].map((index) => (
            <Rock
              key={index}
              position={[
                side * index * 0.035,
                0.045 + index * 0.018,
                index * -0.035,
              ]}
              scale={[0.055, 0.025, 0.035]}
              color={index % 2 ? C.leaf : C.leafLight}
              detail={0}
              rotation={[0, index * 0.7, 0.2]}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// TROPICAL PALMS
// ─────────────────────────────────────────────────────────────

function PalmTree({ position, C, scale = 1 }) {
  const leaves = useMemo(() => {
    const random = rng(
      Math.round((position[0] + 2) * 1000) +
      Math.round((position[2] + 2) * 700)
    );

    return Array.from({ length: 8 }, (_, index) => {
      const angle = (index / 8) * Math.PI * 2;

      return {
        angle,
        length: 0.22 + random() * 0.10,
        droop: 0.08 + random() * 0.08,
        color: index % 2 ? C.leaf : C.leafLight,
      };
    });
  }, [C, position]);

  return (
    <group position={position} scale={scale}>
      <Box
        position={[0, 0.25, 0]}
        size={[0.045, 0.52, 0.045]}
        color={C.trunk}
      />

      <group position={[0, 0.52, 0]}>
        {leaves.map((leaf, index) => (
          <group
            key={index}
            rotation={[0, leaf.angle, 0]}
          >
            <Rock
              position={[
                leaf.length * 0.42,
                -leaf.droop * 0.35,
                0,
              ]}
              scale={[
                leaf.length,
                0.025,
                0.065,
              ]}
              color={leaf.color}
              detail={1}
              rotation={[0, 0, -0.22]}
            />
          </group>
        ))}
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// THEMED BORDER
// Dense, tropical details around the outside of the QR diorama.
// ─────────────────────────────────────────────────────────────

function BorderDecor({ C }) {
  const details = useMemo(() => {
    const random = rng(52991);
    const items = [];

    for (let index = 0; index < 22; index++) {
      const t = index / 21;
      const x = -HALF + t * HALF * 2;

      items.push({
        x,
        z: -HALF - 0.075,
        size: 0.045 + random() * 0.035,
        color: index % 2 ? C.leaf : C.leafDark,
        side: "back",
      });

      items.push({
        x,
        z: HALF + 0.075,
        size: 0.045 + random() * 0.035,
        color: index % 2 ? C.leafLight : C.leaf,
        side: "front",
      });
    }

    for (let index = 0; index < 22; index++) {
      const t = index / 21;
      const z = -HALF + t * HALF * 2;

      items.push({
        x: -HALF - 0.075,
        z,
        size: 0.045 + random() * 0.035,
        color: index % 2 ? C.leaf : C.leafDark,
        side: "left",
      });

      items.push({
        x: HALF + 0.075,
        z,
        size: 0.045 + random() * 0.035,
        color: index % 2 ? C.leafLight : C.leaf,
        side: "right",
      });
    }

    return items;
  }, [C]);

  return (
    <group>
      {/* Layered stone plinth */}
      <Box
        position={[0, -0.31, 0]}
        size={[GRID * TILE + 0.26, 0.075, GRID * TILE + 0.26]}
        color={C.rockShadow}
      />

      <Box
        position={[0, -0.355, 0]}
        size={[GRID * TILE + 0.30, 0.035, GRID * TILE + 0.30]}
        color={C.accent}
      />

      <Box
        position={[0, -0.39, 0]}
        size={[GRID * TILE + 0.24, 0.04, GRID * TILE + 0.24]}
        color={C.soil}
      />

      {/* Repeated foliage around the perimeter */}
      {details.map((item, index) => (
        <group
          key={index}
          position={[item.x, 0.035, item.z]}
        >
          <Rock
            position={[0, 0.025, 0]}
            scale={[
              item.size * 1.5,
              item.size * 0.65,
              item.size,
            ]}
            color={item.color}
            detail={0}
            rotation={[0, index * 0.63, 0.18]}
          />

          {index % 3 === 0 && (
            <Glow
              position={[0, 0.065, 0]}
              color={C.accent}
              size={0.012}
            />
          )}
        </group>
      ))}

      {/* Decorative coastal boulders */}
      {[
        [-1.52, -1.49],
        [-1.26, -1.52],
        [1.28, -1.52],
        [1.53, -1.48],
        [-1.52, 1.48],
        [1.52, 1.48],
      ].map(([x, z], index) => (
        <Rock
          key={index}
          position={[x, -0.005, z]}
          scale={[0.10, 0.06, 0.075]}
          color={index % 2 ? C.rockLight : C.rock}
          detail={1}
        />
      ))}

      {/* Corner palms */}
      <PalmTree position={[-1.29, 0.02, -1.23]} C={C} scale={0.78} />
      <PalmTree position={[1.29, 0.02, -1.23]} C={C} scale={0.78} />
      <PalmTree position={[-1.29, 0.02, 1.23]} C={C} scale={0.66} />
      <PalmTree position={[1.29, 0.02, 1.23]} C={C} scale={0.66} />

      {/* Golden lanterns on the four corners */}
      {[
        [-1.40, -1.40],
        [1.40, -1.40],
        [-1.40, 1.40],
        [1.40, 1.40],
      ].map(([x, z], index) => (
        <group key={index} position={[x, 0.10, z]}>
          <Box
            position={[0, 0.06, 0]}
            size={[0.035, 0.15, 0.035]}
            color={C.trunk}
          />
          <Glow
            position={[0, 0.15, 0]}
            color={C.accent}
            size={0.034}
          />
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// MUSHROOMS AND FLOWERS
// ─────────────────────────────────────────────────────────────

function TinyMushroom({ position, C, color }) {
  return (
    <group position={position}>
      <Box
        position={[0, 0.025, 0]}
        size={[0.012, 0.05, 0.012]}
        color="#e8dfcb"
        castShadow={false}
      />

      <Rock
        position={[0, 0.054, 0]}
        scale={[0.028, 0.015, 0.025]}
        color={color}
        detail={1}
      />

      <Glow
        position={[0, 0.075, 0]}
        color={color}
        size={0.008}
      />
    </group>
  );
}

function TinyFlower({ position, C, color }) {
  return (
    <group position={position}>
      <Box
        position={[0, 0.035, 0]}
        size={[0.009, 0.07, 0.009]}
        color={C.leaf}
        castShadow={false}
      />

      {[0, 1, 2, 3, 4].map((index) => {
        const angle = (index / 5) * Math.PI * 2;

        return (
          <Rock
            key={index}
            position={[
              Math.cos(angle) * 0.022,
              0.078,
              Math.sin(angle) * 0.022,
            ]}
            scale={[0.015, 0.011, 0.015]}
            color={color}
            detail={0}
          />
        );
      })}

      <Glow
        position={[0, 0.083, 0]}
        color={C.accent}
        size={0.008}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// THREE FINDER LANDMARKS
// Keep the three distinct corners readable from above.
// ─────────────────────────────────────────────────────────────

function FinderGrove({ C }) {
  const cx = (3 - (GRID - 1) / 2) * TILE;
  const cz = (3 - (GRID - 1) / 2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      <Box
        position={[0, 0.02, 0]}
        size={[0.23, 0.04, 0.23]}
        color={C.rockLight}
      />

      {Array.from({ length: 7 }, (_, index) => {
        const angle = (index / 7) * Math.PI * 2;
        const radius = 0.065 + (index % 3) * 0.018;
        const color = [
          C.accent,
          C.waterLight,
          "#c5a6ee",
          "#f2a5bd",
        ][index % 4];

        return (
          <TinyMushroom
            key={index}
            position={[
              Math.cos(angle) * radius,
              0.035,
              Math.sin(angle) * radius,
            ]}
            C={C}
            color={color}
          />
        );
      })}

      <Glow
        position={[0, 0.13, 0]}
        color={C.accent}
        size={0.025}
      />
    </group>
  );
}

function FinderShrine({ C }) {
  const cx = (GRID - 4 - (GRID - 1) / 2) * TILE;
  const cz = (3 - (GRID - 1) / 2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      <Box
        position={[0, 0.04, 0]}
        size={[0.25, 0.07, 0.23]}
        color={C.rock}
      />

      <Box
        position={[0, 0.095, 0]}
        size={[0.17, 0.045, 0.16]}
        color={C.rockLight}
      />

      <Box
        position={[0, 0.17, 0]}
        size={[0.05, 0.12, 0.05]}
        color={C.rockShadow}
      />

      <Box
        position={[0, 0.24, 0]}
        size={[0.22, 0.022, 0.045]}
        color={C.accent}
      />

      <Glow
        position={[0, 0.29, 0]}
        color={C.accent}
        size={0.025}
      />

      {[0, 1, 2, 3].map((index) => {
        const angle = (index / 4) * Math.PI * 2;

        return (
          <TinyFlower
            key={index}
            position={[
              Math.cos(angle) * 0.14,
              0.04,
              Math.sin(angle) * 0.12,
            ]}
            C={C}
            color={C.accent}
          />
        );
      })}
    </group>
  );
}

function FinderSpring({ C }) {
  const cx = (3 - (GRID - 1) / 2) * TILE;
  const cz = (GRID - 4 - (GRID - 1) / 2) * TILE;
  const waterRef = useRef();

  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.material.emissiveIntensity =
        0.28 + Math.sin(clock.elapsedTime * 1.5) * 0.12;
    }
  });

  return (
    <group position={[cx, H_FINDER, cz]}>
      <Box
        position={[0, 0.04, 0]}
        size={[0.28, 0.07, 0.27]}
        color={C.rock}
      />

      <Box
        position={[0, 0.08, 0]}
        size={[0.22, 0.035, 0.21]}
        color={C.rockLight}
      />

      <mesh
        ref={waterRef}
        position={[0, 0.105, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.085, 16]} />
        <meshStandardMaterial
          color={C.water}
          emissive={C.water}
          emissiveIntensity={0.3}
          roughness={0.2}
        />
      </mesh>

      <Glow
        position={[0, 0.16, 0]}
        color={C.waterLight}
        size={0.022}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// FIREFlIES AND MIST
// ─────────────────────────────────────────────────────────────

function Fireflies({ C }) {
  const group = useRef();

  const flies = useMemo(() => {
    const random = rng(427);
    const colors = [
      C.accent,
      C.waterLight,
      "#c5a6ee",
      "#f2a5bd",
      C.leafLight,
    ];

    return Array.from({ length: 32 }, (_, index) => ({
      base: [
        (random() - 0.5) * GRID * TILE * 0.85,
        0.28 + random() * 0.8,
        (random() - 0.5) * GRID * TILE * 0.85,
      ],
      phase: random() * Math.PI * 2,
      speed: 0.3 + random() * 0.9,
      amp: 0.035 + random() * 0.075,
      color: colors[index % colors.length],
      size: 0.009 + random() * 0.014,
    }));
  }, [C]);

  useFrame(({ clock }) => {
    if (!group.current) return;

    const time = clock.elapsedTime;

    group.current.children.forEach((mesh, index) => {
      const fly = flies[index];

      mesh.position.set(
        fly.base[0] +
          Math.sin(time * fly.speed + fly.phase) * fly.amp,
        fly.base[1] +
          Math.sin(time * fly.speed * 1.3 + fly.phase) *
            fly.amp *
            0.65,
        fly.base[2] +
          Math.cos(time * fly.speed + fly.phase) * fly.amp
      );

      mesh.material.opacity =
        0.5 + Math.sin(time * 2 + fly.phase) * 0.35;
    });
  });

  return (
    <group ref={group}>
      {flies.map((fly, index) => (
        <mesh key={index} position={fly.base}>
          <sphereGeometry args={[fly.size, 6, 6]} />
          <meshBasicMaterial
            color={fly.color}
            transparent
            opacity={0.7}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Mist() {
  const group = useRef();

  const particles = useMemo(() => {
    const random = rng(999);

    return Array.from({ length: 12 }, () => ({
      x: (random() - 0.5) * 1.9,
      z: -0.55 + random() * 0.85,
      y: 0.24 + random() * 0.38,
      phase: random() * Math.PI * 2,
      size: 0.10 + random() * 0.12,
      speed: 0.08 + random() * 0.12,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;

    const time = clock.elapsedTime;

    group.current.children.forEach((mesh, index) => {
      const particle = particles[index];

      mesh.position.x =
        particle.x +
        Math.sin(time * particle.speed + particle.phase) * 0.12;

      mesh.position.y =
        particle.y +
        Math.sin(time * particle.speed * 0.7) * 0.04;

      mesh.position.z =
        particle.z +
        Math.cos(time * particle.speed + particle.phase) * 0.06;

      mesh.material.opacity =
        0.045 + Math.sin(time * 0.4 + particle.phase) * 0.018;
    });
  });

  return (
    <group ref={group}>
      {particles.map((particle, index) => (
        <mesh
          key={index}
          position={[particle.x, particle.y, particle.z]}
        >
          <sphereGeometry args={[particle.size, 8, 6]} />
          <meshBasicMaterial
            color="#e4f5f0"
            transparent
            opacity={0.05}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Flying Birds ────────────────────────────────────────────────
function Birds({ dark = false }) {
  const group = useRef();

  const birds = useMemo(() => {
    const r = rng(831);
    return Array.from({ length: 11 }, (_, i) => ({
      x: (r() - 0.5) * 2.2,
      y: 1.65 + r() * 1.1,
      z: -1.15 - r() * 1.4,
      scale: 0.08 + r() * 0.06,
      phase: r() * Math.PI * 2,
      speed: 0.25 + r() * 0.2,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;

    const t = clock.elapsedTime;

    group.current.children.forEach((bird, i) => {
      const b = birds[i];

      bird.position.x =
        b.x + Math.sin(t * b.speed + b.phase) * 0.55;

      bird.position.y =
        b.y + Math.sin(t * 1.4 + b.phase) * 0.12;

      bird.position.z =
        b.z + Math.cos(t * b.speed * 0.7 + b.phase) * 0.18;

      bird.rotation.y = Math.sin(t * b.speed + b.phase) * 0.2;
      bird.rotation.z = Math.sin(t * 1.2 + b.phase) * 0.12;
    });
  });

  const birdColor = dark ? "#e5e7eb" : "#263746";

  return (
    <group ref={group}>
      {birds.map((bird, i) => (
        <group
          key={i}
          position={[bird.x, bird.y, bird.z]}
          scale={bird.scale}
        >
          {/* Left wing */}
          <mesh
            position={[-0.12, 0, 0]}
            rotation={[0, 0, -0.35]}
          >
            <boxGeometry args={[0.28, 0.018, 0.045]} />
            <meshBasicMaterial color={birdColor} />
          </mesh>

          {/* Right wing */}
          <mesh
            position={[0.12, 0, 0]}
            rotation={[0, 0, 0.35]}
          >
            <boxGeometry args={[0.28, 0.018, 0.045]} />
            <meshBasicMaterial color={birdColor} />
          </mesh>

          {/* Body */}
          <mesh>
            <sphereGeometry args={[0.055, 5, 4]} />
            <meshBasicMaterial color={birdColor} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// LIGHTING
// ─────────────────────────────────────────────────────────────

function Lighting({ C }) {
  const warmLight = useRef();

  useFrame(({ clock }) => {
    if (warmLight.current) {
      warmLight.current.intensity =
        1.1 + Math.sin(clock.elapsedTime * 0.8) * 0.08;
    }
  });

  return (
    <>
      <ambientLight intensity={1.0} color="#e4f1df" />

      <hemisphereLight
        skyColor="#dff9f3"
        groundColor="#594a35"
        intensity={0.65}
      />

      <directionalLight
        position={[-3, 6, 4]}
        intensity={2}
        color="#fff0d2"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <directionalLight
        position={[3, 4, -3]}
        intensity={0.85}
        color="#a7e7df"
      />

      <pointLight
        ref={warmLight}
        position={[-0.5, 1.7, -0.4]}
        intensity={1.1}
        color={C.accent}
        distance={3.8}
      />

      <pointLight
        position={[0, 0.8, 0.5]}
        intensity={0.65}
        color={C.waterLight}
        distance={2.8}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SCENE
// ─────────────────────────────────────────────────────────────

export default function ElNidoScene({
  themeColors: themeProp,
}) {
  const matrix = useMemo(buildMatrix, []);

  const C = useMemo(
    () => resolveColors(themeProp),
    [themeProp]
  );

  return (
    <group
      position={[0, ROOT_Y, 0]}
      rotation={[0, Math.PI/4, 0]}
    >
      <Lighting C={C} />
      <Birds dark={themeProp?.dark} />

      {/* Original QR-shaped terrain */}
      <QRGround matrix={matrix} C={C} />

      {/* Central attraction: open-front Hidden Lagoon */}
      <group position={[0, H_DARK, 0]}>
        <LagoonWater C={C} />
        <LagoonCliffs C={C} />
        <LagoonShore C={C} />
      </group>

      {/* QR finder-pattern landmarks */}
      <FinderGrove C={C} />
      <FinderShrine C={C} />
      <FinderSpring C={C} />

      {/* Tropical decorative perimeter */}
      <BorderDecor C={C} />

      {/* Atmosphere */}
      <Mist />
      <Fireflies C={C} />
    </group>
  );
}