
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ============================================================
// BAHAY KUBO VILLAGE
// Traditional raised bamboo houses, connected rural pathways,
// nipa roofs, rice paddies, and a QR-inspired landscape.
// ============================================================

const GRID = 25;
const TILE = 0.118;
const HALF = (GRID * TILE) / 2;
const ROOT_Y = -0.45;
const GROUND_Y = 0.015;
const H_DARK = 0.075;
const H_FINDER = 0.09;
const H_BASE = 0.025;

const materialCache = new Map();

function mat(color, roughness = 0.88, extra = {}) {
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

function rng(seed = 1234) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function blendHex(a, b, amount) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);

  return `#${ca
    .lerp(cb, amount)
    .getHexString()}`;
}

function resolveColors(theme = {}) {
  const bamboo = theme.primary || "#8b6543";
  const gold = theme.accent || "#d8ad59";
  const green = theme.secondary || "#477d42";
  const light = theme.light || "#eee4c9";

  return {
    ground: "#6B7D55", // muddy green for ground
    earth: "#785238",
    soil: "#553923",
    path: "#8A7B5A", // muddy green for paths
    pathLight: "#9A8B6A", // lighter muddy green
    light: "#7A8B5E", // muddy green for light modules

    bamboo,
    bambooLight: blendHex(bamboo, "#e3c999", 0.55),
    bambooDark: blendHex(bamboo, "#38281b", 0.55),

    wood: "#513823",
    woodLight: "#986b40",
    woodHighlight: "#bd9461",

    nipa: "#b89b5c",
    nipaLight: "#d4bd80",
    nipaDark: "#877044",

    wall: "#d9c69a",
    wallDark: "#ad9264",

    green,
    greenLight: blendHex(green, "#91ae59", 0.5),
    greenDark: blendHex(green, "#183d25", 0.55),

    rice: "#8ba65b",
    riceGold: "#d5ba68",
    water: "#609f9c",
    waterLight: "#9bc9bb",

    gold,
    lantern: "#ffd783",
    stone: "#817768",
    stoneLight: "#b8aa91",
    terracotta: "#b96f48",
    light,
  };
}

function Box({
  pos = [0, 0, 0],
  size = [1, 1, 1],
  color = "#ffffff",
  rot = [0, 0, 0],
  castShadow = true,
  receiveShadow = true,
  roughness = 0.88,
  materialProps = {},
}) {
  return (
    <mesh
      position={pos}
      scale={size}
      rotation={rot}
      material={mat(color, roughness, materialProps)}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <boxGeometry args={[1, 1, 1]} />
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
  castShadow = true,
  receiveShadow = true,
}) {
  return (
    <mesh
      position={pos}
      rotation={rot}
      material={mat(color)}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <cylinderGeometry args={[rTop, rBot, h, segs]} />
    </mesh>
  );
}

function Beam({
  start,
  end,
  radius = 0.018,
  color = "#8b6543",
}) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(b, a);
  const midpoint = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

  return (
    <mesh
      position={midpoint.toArray()}
      quaternion={new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize()
      )}
      castShadow
      receiveShadow
      material={mat(color)}
    >
      <cylinderGeometry
        args={[radius * 0.8, radius, direction.length(), 7]}
      />
    </mesh>
  );
}

// ============================================================
// QR MATRIX
// ============================================================

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

      if (x === 6 || z === 6) {
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

function QRGround({ matrix, C }) {
  const modules = useMemo(() => {
    const result = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const dark = matrix[z][x];
        const finder = isFinderZone(x, z);
        const wx = (x - (GRID - 1) / 2) * TILE;
        const wz = (z - (GRID - 1) / 2) * TILE;

        result.push({
          x: wx,
          z: wz,
          dark,
          finder,
          height: finder ? H_FINDER : dark ? H_DARK : H_BASE,
          color: dark
            ? finder
              ? C.bambooDark
              : (x + z) % 4 === 0
                ? C.earth
                : C.bamboo
            : C.ground, // use ground (muddy green) instead of light
        });
      }
    }

    return result;
  }, [matrix, C]);

  const grassAccents = useMemo(() => {
    const r = rng(5555);
    const grass = [];
    for (let i = 0; i < 40; i++) {
      const x = (r() - 0.5) * GRID * TILE * 0.85;
      const z = (r() - 0.5) * GRID * TILE * 0.85;
      grass.push({ x, z, height: 0.02 + r() * 0.03 });
    }
    return grass;
  }, []);

  return (
    <group>
      <Box
        pos={[0, -0.12, 0]}
        size={[GRID * TILE + 0.16, 0.2, GRID * TILE + 0.16]}
        color={C.soil}
      />

      <Box
        pos={[0, -0.015, 0]}
        size={[GRID * TILE + 0.12, 0.04, GRID * TILE + 0.12]}
        color={C.ground}
        castShadow={false}
      />

      {modules.map((m, i) => (
        <Box
          key={i}
          pos={[m.x, m.height / 2, m.z]}
          size={[
            TILE * (m.finder ? 0.98 : 0.94),
            m.height,
            TILE * (m.finder ? 0.98 : 0.94),
          ]}
          color={m.color}
          castShadow={false}
        />
      ))}

      {/* Pond at front corner */}
      <group position={[HALF - 0.2, 0.02, HALF - 0.2]}>
        <Box pos={[0, -0.02, 0]} size={[0.35, 0.04, 0.35]} color={C.earth} />
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.15, 24]} />
          <meshStandardMaterial color={C.water} roughness={0.15} metalness={0.1} />
        </mesh>
      </group>

      {/* Small grass accents scattered around */}
      {grassAccents.map((g, i) => (
        <Cone
          key={`grass-${i}`}
          pos={[g.x, g.height / 2, g.z]}
          rTop={0}
          rBot={0.006}
          h={g.height}
          segs={4}
          color={C.green}
        />
      ))}

      {/* A continuous outer earth rim makes the terrain read as one piece. */}
      <Box
        pos={[0, -0.06, -HALF - 0.055]}
        size={[GRID * TILE + 0.18, 0.1, 0.1]}
        color={C.earth}
      />
      <Box
        pos={[0, -0.06, HALF + 0.055]}
        size={[GRID * TILE + 0.18, 0.1, 0.1]}
        color={C.earth}
      />
      <Box
        pos={[-HALF - 0.055, -0.06, 0]}
        size={[0.1, 0.1, GRID * TILE]}
        color={C.earth}
      />
      <Box
        pos={[HALF + 0.055, -0.06, 0]}
        size={[0.1, 0.1, GRID * TILE]}
        color={C.earth}
      />
    </group>
  );
}

// ============================================================
// TRADITIONAL BAHAY KUBO
// Raised floor, bamboo stilts, woven walls, open windows,
// front porch, stairs, and a broad pitched nipa roof.
// Front of each house faces local +Z.
// ============================================================

function NipaRoof({ C, width = 0.78, depth = 0.76, height = 0.43 }) {
  const geometry = useMemo(() => {
    const w = width / 2;
    const d = depth / 2;

    const positions = [
      // Left roof plane
      0, 0, -d,
      0, 0, d,
      -w, -height, d,

      0, 0, -d,
      -w, -height, d,
      -w, -height, -d,

      // Right roof plane
      0, 0, d,
      0, 0, -d,
      w, -height, -d,

      0, 0, d,
      w, -height, -d,
      w, -height, d,

      // Front gable
      0, 0, d,
      -w, -height, d,
      w, -height, d,

      // Rear gable
      0, 0, -d,
      w, -height, -d,
      -w, -height, -d,
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.computeVertexNormals();

    return geo;
  }, [width, depth, height]);

  const slats = useMemo(() => {
    const result = [];
    const count = 17;

    for (let i = 0; i <= count; i++) {
      const x = -width / 2 + (width * i) / count;
      const t = Math.abs(x) / (width / 2);

      result.push({
        x,
        y: -height * t,
        side: x < 0 ? -1 : 1,
      });
    }

    return result;
  }, [width, height]);

  return (
    <group>
      <mesh
        geometry={geometry}
        material={mat(C.nipa, 1, { side: THREE.DoubleSide })}
        castShadow
        receiveShadow
      />

      {/* Narrow thatch ribs follow the two roof slopes. */}
      {slats.map((s, i) => (
        <Box
          key={i}
          pos={[
            s.x,
            s.y - 0.008,
            0,
          ]}
          size={[0.012, 0.018, depth + 0.045]}
          rot={[0, 0, s.side * Math.atan(height / (width / 2))]}
          color={i % 3 === 0 ? C.nipaDark : C.nipaLight}
          castShadow={false}
        />
      ))}

      {/* Thick eaves create the familiar overhanging roof silhouette. */}
      <Box
        pos={[-width / 2, -height, 0]}
        size={[0.035, 0.045, depth + 0.09]}
        color={C.nipaDark}
      />
      <Box
        pos={[width / 2, -height, 0]}
        size={[0.035, 0.045, depth + 0.09]}
        color={C.nipaDark}
      />

      <Beam
        start={[-width / 2, -height, depth / 2 + 0.02]}
        end={[0, 0.02, depth / 2 + 0.02]}
        radius={0.012}
        color={C.wood}
      />
      <Beam
        start={[0, 0.02, depth / 2 + 0.02]}
        end={[width / 2, -height, depth / 2 + 0.02]}
        radius={0.012}
        color={C.wood}
      />
    </group>
  );
}

function BahayKubo({
  C,
  position = [0, 0, 0],
  scale = 1,
  rotation = 0,
  variant = 0,
}) {
  const width = 0.66 * scale;
  const depth = 0.62 * scale;
  const floorY = 0.57 * scale;
  const wallHeight = 0.48 * scale;
  const roofHeight = 0.43 * scale;
  const roofWidth = width * 1.48;
  const roofDepth = depth * 1.42;
  const wallBottom = floorY + 0.045 * scale;
  const wallTop = wallBottom + wallHeight;

  const stiltXs = [-width * 0.43, width * 0.43];
  const stiltZs = [-depth * 0.42, depth * 0.42];

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Stone footings stop the wooden posts from appearing to float. */}
      {stiltXs.flatMap((x, xi) =>
        stiltZs.map((z, zi) => (
          <group key={`post-${xi}-${zi}`}>
            <Box
              pos={[x, 0.055 * scale, z]}
              size={[0.105 * scale, 0.11 * scale, 0.105 * scale]}
              color={C.stone}
            />
            <Box
              pos={[x, floorY / 2 + 0.04 * scale, z]}
              size={[0.055 * scale, floorY - 0.08 * scale, 0.055 * scale]}
              color={C.bamboo}
            />
            <Box
              pos={[x, floorY * 0.68, z]}
              size={[0.066 * scale, 0.024 * scale, 0.066 * scale]}
              color={C.bambooDark}
            />
          </group>
        ))
      )}

      {/* Continuous crossbeams connect all supporting stilts. */}
      {[-depth * 0.42, depth * 0.42].map((z, i) => (
        <Box
          key={`crossbeam-${i}`}
          pos={[0, floorY - 0.045 * scale, z]}
          size={[width * 1.04, 0.065 * scale, 0.055 * scale]}
          color={C.wood}
        />
      ))}

      {[-width * 0.43, width * 0.43].map((x, i) => (
        <Box
          key={`sidebeam-${i}`}
          pos={[x, floorY - 0.045 * scale, 0]}
          size={[0.055 * scale, 0.065 * scale, depth * 0.94]}
          color={C.wood}
        />
      ))}

      {/* Raised wooden floor and visible individual planks. */}
      <Box
        pos={[0, floorY, 0]}
        size={[width * 1.13, 0.085 * scale, depth * 1.12]}
        color={C.woodLight}
      />

      {Array.from({ length: 8 }, (_, i) => {
        const plankZ = -depth / 2 + (depth * i) / 7;

        return (
          <Box
            key={`floorplank-${i}`}
            pos={[0, floorY + 0.045 * scale, plankZ]}
            size={[width * 1.06, 0.012 * scale, 0.012 * scale]}
            color={i % 2 ? C.wood : C.woodHighlight}
            castShadow={false}
          />
        );
      })}

      {/* Four walls form a single coherent house body. */}
      <Box
        pos={[0, wallBottom + wallHeight / 2, -depth / 2]}
        size={[width, wallHeight, 0.045 * scale]}
        color={C.wall}
      />

      <Box
        pos={[-width / 2, wallBottom + wallHeight / 2, 0]}
        size={[0.045 * scale, wallHeight, depth]}
        color={C.wallDark}
      />

      <Box
        pos={[width / 2, wallBottom + wallHeight / 2, 0]}
        size={[0.045 * scale, wallHeight, depth]}
        color={C.wallDark}
      />

      {/* Front wall: separate panels leave a visible central doorway. */}
      <Box
        pos={[-width * 0.31, wallBottom + wallHeight / 2, depth / 2]}
        size={[width * 0.38, wallHeight, 0.04 * scale]}
        color={C.wall}
      />
      <Box
        pos={[width * 0.31, wallBottom + wallHeight / 2, depth / 2]}
        size={[width * 0.38, wallHeight, 0.04 * scale]}
        color={C.wall}
      />
      <Box
        pos={[0, wallBottom + wallHeight * 0.84, depth / 2]}
        size={[width * 0.25, wallHeight * 0.32, 0.04 * scale]}
        color={C.wall}
      />

      {/* Vertical bamboo strips suggest woven sawali wall panels. */}
      {Array.from({ length: 9 }, (_, i) => {
        const x = -width / 2 + (width * i) / 8;

        return (
          <Box
            key={`frontweave-${i}`}
            pos={[x, wallBottom + wallHeight / 2, depth / 2 + 0.024 * scale]}
            size={[0.012 * scale, wallHeight * 0.96, 0.012 * scale]}
            color={i % 2 ? C.bambooLight : C.bamboo}
            castShadow={false}
          />
        );
      })}

      {Array.from({ length: 7 }, (_, i) => {
        const y = wallBottom + (wallHeight * (i + 1)) / 8;

        return (
          <Box
            key={`frontcross-${i}`}
            pos={[0, y, depth / 2 + 0.03 * scale]}
            size={[width * 0.97, 0.012 * scale, 0.012 * scale]}
            color={C.bambooDark}
            castShadow={false}
          />
        );
      })}

      {/* Openable-looking wooden windows on both sides of the doorway. */}
      {[-1, 1].map((side) => (
        <group
          key={`window-${side}`}
          position={[
            side * width * 0.31,
            wallBottom + wallHeight * 0.68,
            depth / 2 + 0.035 * scale,
          ]}
        >
          <Box
            pos={[0, 0, 0]}
            size={[width * 0.2, wallHeight * 0.25, 0.025 * scale]}
            color={C.wood}
          />
          <Box
            pos={[0, 0, 0.016 * scale]}
            size={[width * 0.16, wallHeight * 0.19, 0.012 * scale]}
            color={C.water}
            castShadow={false}
          />
          {[-1, 0, 1].map((n) => (
            <Box
              key={n}
              pos={[n * width * 0.045, 0, 0.025 * scale]}
              size={[0.012 * scale, wallHeight * 0.22, 0.012 * scale]}
              color={C.woodLight}
            />
          ))}
          <Box
            pos={[0, -wallHeight * 0.15, 0.025 * scale]}
            size={[width * 0.22, 0.025 * scale, 0.04 * scale]}
            color={C.wood}
          />
        </group>
      ))}

      {/* Front veranda joins directly to the main floor. */}
      <Box
        pos={[0, floorY - 0.005 * scale, depth * 0.69]}
        size={[width * 0.94, 0.07 * scale, depth * 0.43]}
        color={C.woodLight}
      />

      {[-1, 0, 1].map((i) => (
        <Box
          key={`porchplank-${i}`}
          pos={[
            i * width * 0.29,
            floorY + 0.035 * scale,
            depth * 0.69,
          ]}
          size={[0.012 * scale, 0.01 * scale, depth * 0.4]}
          color={C.wood}
          castShadow={false}
        />
      ))}

      {/* Porch railing, deliberately leaving the entrance open. */}
      {[-1, 1].map((side) => (
        <group key={`railing-${side}`}>
          {[-1, 1].map((zSide) => (
            <Box
              key={zSide}
              pos={[
                side * width * 0.43,
                floorY + 0.12 * scale,
                depth * (0.5 + zSide * 0.12),
              ]}
              size={[0.035 * scale, 0.22 * scale, 0.035 * scale]}
              color={C.bamboo}
            />
          ))}
          <Box
            pos={[side * width * 0.43, floorY + 0.21 * scale, depth * 0.65]}
            size={[0.035 * scale, 0.035 * scale, depth * 0.38]}
            color={C.wood}
          />
        </group>
      ))}

      {/* Stairs meet the veranda rather than floating beside the house. */}
      {[0, 1, 2].map((i) => (
        <Box
          key={`stairs-${i}`}
          pos={[
            0,
            floorY - (i + 1) * 0.105 * scale,
            depth * (0.95 + i * 0.15),
          ]}
          size={[
            width * (0.45 + i * 0.08),
            0.07 * scale,
            0.19 * scale,
          ]}
          color={i % 2 ? C.woodLight : C.wood}
        />
      ))}

      {/* Roof supports connect the eaves to the wall corners. */}
      {[-1, 1].map((side) => (
        <Beam
          key={`roofbrace-${side}`}
          start={[
            side * width * 0.48,
            wallTop - 0.02 * scale,
            depth * 0.4,
          ]}
          end={[
            side * roofWidth * 0.49,
            wallTop + 0.12 * scale,
            depth * 0.4,
          ]}
          radius={0.014 * scale}
          color={C.wood}
        />
      ))}

      {/* The broad, pitched roof is the defining silhouette. */}
      <group position={[0, wallTop + roofHeight * 0.78, 0]}>
        <NipaRoof
          C={C}
          width={roofWidth}
          depth={roofDepth}
          height={roofHeight}
        />
      </group>

      {/* Ridge pole and projecting roof ends. */}
      <Box
        pos={[0, wallTop + roofHeight * 0.78 + 0.018 * scale, 0]}
        size={[0.045 * scale, 0.045 * scale, roofDepth * 1.04]}
        color={C.wood}
      />

      {/* Small clay pot beside the entrance. */}
      <mesh
        position={[
          -width * 0.42,
          floorY + 0.095 * scale,
          depth * 0.65,
        ]}
        scale={scale}
        castShadow
        material={mat(C.terracotta)}
      >
        <sphereGeometry args={[0.055, 10, 8]} />
      </mesh>

      <mesh
        position={[
          -width * 0.42,
          floorY + 0.15 * scale,
          depth * 0.65,
        ]}
        scale={scale}
        material={mat(C.terracotta)}
      >
        <cylinderGeometry args={[0.027, 0.035, 0.018, 10]} />
      </mesh>

      {/* Warm hanging lantern at the porch entrance. */}
      <Beam
        start={[width * 0.16, wallTop - 0.02 * scale, depth * 0.56]}
        end={[width * 0.16, wallTop - 0.18 * scale, depth * 0.56]}
        radius={0.006 * scale}
        color={C.wood}
      />

      <Box
        pos={[
          width * 0.16,
          wallTop - 0.22 * scale,
          depth * 0.56,
        ]}
        size={[0.055 * scale, 0.07 * scale, 0.055 * scale]}
        color={C.gold}
        materialProps={{ emissive: C.lantern, emissiveIntensity: 0.7 }}
      />

      {/* Optional roof variation distinguishes neighboring homes. */}
      {variant % 2 === 1 && (
        <Box
          pos={[
            0,
            wallTop + roofHeight * 0.78 - roofHeight * 0.35,
            0,
          ]}
          size={[roofWidth * 0.96, 0.025 * scale, roofDepth * 0.98]}
          color={C.nipaDark}
          castShadow={false}
        />
      )}
    </group>
  );
}

// ============================================================
// CONNECTED VILLAGE
// The houses sit along one shared path, with small yards and
// paddies. Walkways meet house stairs and join one another.
// ============================================================


function ConnectedVillage({ C }) {
  const waterRef = useRef();

  const borderPlants = useMemo(() => {
    const random = rng(4321);
    return Array.from({ length: 32 }, (_, i) => {
      const side = i % 4;
      const along = -1.12 + random() * 2.24;

      let x = along;
      let z = 0;

      if (side === 0) z = -1.12;
      if (side === 1) z = 1.12;
      if (side === 2) {
        x = -1.12;
        z = along;
      }
      if (side === 3) {
        x = 1.12;
        z = along;
      }

      return {
        x,
        z,
        type: Math.floor(random() * 4),
        scale: 0.65 + random() * 0.55,
        rotation: random() * Math.PI * 2,
      };
    });
  }, []);

  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.position.y =
        0.045 + Math.sin(clock.elapsedTime * 1.2) * 0.003;
    }
  });

  return (
    <group position={[0, H_DARK, 0]}>

      {/* =====================================================
          CENTRAL FOCAL POINT: ONE GRAND BAHAY KUBO
          Front entrance faces +Z.
      ===================================================== */}

      {/* Raised landscaped foundation */}
      <Box
        pos={[0, 0.045, -0.015]}
        size={[1.65, 0.09, 1.72]}
        color={C.earth}
      />

      <Box
        pos={[0, 0.095, -0.015]}
        size={[1.56, 0.035, 1.63]}
        color={C.stone}
      />

      {/* Main house: enlarged in width, height and length */}
      <BahayKubo
        C={C}
        position={[0, 0.09, -0.10]}
        scale={1.55}
        rotation={0}
        variant={0}
      />

      {/* Extra roof ridge ornament */}
      <Beam
        start={[-0.78, 1.66, -0.10]}
        end={[0.78, 1.66, -0.10]}
        radius={0.025}
        color={C.wood}
      />

      {/* Decorative ridge-end caps */}
      {[-0.78, 0.78].map((x, i) => (
        <group key={`ridge-cap-${i}`} position={[x, 1.65, -0.10]}>
          <mesh material={mat(C.gold)} castShadow>
            <sphereGeometry args={[0.045, 8, 6]} />
          </mesh>
          <Box
            pos={[0, -0.055, 0]}
            size={[0.045, 0.10, 0.045]}
            color={C.wood}
          />
        </group>
      ))}

      {/* Carved-looking front veranda trim */}
      <Box
        pos={[0, 0.80, 0.78]}
        size={[1.12, 0.035, 0.045]}
        color={C.woodHighlight}
      />

      {Array.from({ length: 11 }, (_, i) => (
        <Box
          key={`veranda-carving-${i}`}
          pos={[-0.50 + i * 0.10, 0.825, 0.805]}
          size={[0.025, 0.025, 0.018]}
          color={i % 2 ? C.gold : C.wood}
        />
      ))}

      {/* Bamboo details along the front wall */}
      {Array.from({ length: 13 }, (_, i) => (
        <Box
          key={`front-bamboo-${i}`}
          pos={[-0.47 + i * 0.078, 0.91, 0.405]}
          size={[0.014, 0.48, 0.018]}
          color={i % 2 ? C.bambooLight : C.bambooDark}
          castShadow={false}
        />
      ))}

      {/* Crosshatched sawali texture */}
      {Array.from({ length: 8 }, (_, i) => (
        <Box
          key={`woven-wall-${i}`}
          pos={[0, 0.73 + i * 0.052, 0.416]}
          size={[0.93, 0.012, 0.018]}
          color={i % 2 ? C.bamboo : C.bambooLight}
          castShadow={false}
        />
      ))}

      {/* Ornamental bamboo corner posts */}
      {[-0.49, 0.49].map((x, i) => (
        <group key={`front-corner-${i}`}>
          <Box
            pos={[x, 0.94, 0.43]}
            size={[0.055, 0.57, 0.055]}
            color={C.bambooDark}
          />
          {[0.72, 0.90, 1.08, 1.18].map((y, j) => (
            <Box
              key={j}
              pos={[x, y, 0.462]}
              size={[0.066, 0.018, 0.014]}
              color={C.gold}
            />
          ))}
        </group>
      ))}

      {/* Larger porch stairs and landing */}
      <Box
        pos={[0, 0.43, 0.94]}
        size={[0.76, 0.09, 0.34]}
        color={C.woodLight}
      />
      <Box
        pos={[0, 0.32, 1.08]}
        size={[0.66, 0.08, 0.28]}
        color={C.wood}
      />
      <Box
        pos={[0, 0.21, 1.21]}
        size={[0.56, 0.08, 0.25]}
        color={C.woodLight}
      />
      <Box
        pos={[0, 0.12, 1.31]}
        size={[0.48, 0.06, 0.18]}
        color={C.wood}
      />

      {/* Stone path leading to the house */}
      {Array.from({ length: 6 }, (_, i) => (
        <group
          key={`entrance-stone-${i}`}
          position={[
            (i % 2 ? 0.045 : -0.045),
            0.055,
            1.43 + i * 0.105,
          ]}
        >
          <Box
            pos={[0, 0, 0]}
            size={[0.23, 0.035, 0.105]}
            color={i % 2 ? C.stoneLight : C.stone}
            rot={[0, (i % 2 ? 1 : -1) * 0.06, 0]}
          />
        </group>
      ))}

      {/* Decorative carved posts flanking the front stairs */}
      {[-0.48, 0.48].map((x, i) => (
        <group key={`stair-post-${i}`} position={[x, 0.23, 1.02]}>
          <Box
            pos={[0, 0.10, 0]}
            size={[0.045, 0.22, 0.045]}
            color={C.wood}
          />
          <mesh
            position={[0, 0.23, 0]}
            material={mat(C.gold)}
            castShadow
          >
            <sphereGeometry args={[0.055, 8, 6]} />
          </mesh>
        </group>
      ))}

      {/* Hanging capiz-inspired lanterns on the veranda */}
      {[-0.39, 0, 0.39].map((x, i) => (
        <group key={`capiz-lantern-${i}`} position={[x, 1.18, 0.55]}>
          <Beam
            start={[0, 0.08, 0]}
            end={[0, -0.015, 0]}
            radius={0.006}
            color={C.wood}
          />

          <Box
            pos={[0, -0.07, 0]}
            size={[0.075, 0.095, 0.075]}
            color={C.lantern}
            materialProps={{
              emissive: C.lantern,
              emissiveIntensity: 0.55,
            }}
          />

          <Box
            pos={[0, -0.07, 0.042]}
            size={[0.045, 0.065, 0.012]}
            color={C.light}
            materialProps={{
              emissive: C.light,
              emissiveIntensity: 0.25,
            }}
            castShadow={false}
          />

          <mesh
            position={[0, -0.14, 0]}
            material={mat(C.gold)}
          >
            <coneGeometry args={[0.045, 0.045, 4]} />
          </mesh>
        </group>
      ))}

      {/* =====================================================
          SMALL KOI POND
      ===================================================== */}

      <group position={[-0.87, 0.025, 0.72]} rotation={[-0.035, 0, 0]}>

        {/* Earth bed */}
        <mesh position={[0, 0, 0]} material={mat(C.earth)}>
          <cylinderGeometry args={[0.34, 0.31, 0.075, 24]} />
        </mesh>

        {/* Natural stone rim */}
        <mesh position={[0, 0.043, 0]} material={mat(C.stone)}>
          <cylinderGeometry args={[0.315, 0.30, 0.045, 24]} />
        </mesh>

        {/* Pond water */}
        <mesh
          ref={waterRef}
          position={[0, 0.045, 0]}
          material={mat(C.water, 0.22, {
            metalness: 0.18,
            transparent: true,
            opacity: 0.92,
          })}
        >
          <cylinderGeometry args={[0.278, 0.278, 0.012, 32]} />
        </mesh>

        {/* Water highlights */}
        {[
          [-0.08, 0.055, 0.04],
          [0.07, 0.055, -0.065],
          [0.12, 0.055, 0.09],
          [-0.13, 0.055, -0.08],
        ].map((p, i) => (
          <Box
            key={`pond-glint-${i}`}
            pos={p}
            size={[0.065, 0.004, 0.009]}
            color={C.waterLight}
            castShadow={false}
          />
        ))}

        {/* Lily pads */}
        {[
          [-0.12, 0.055, 0.09],
          [0.13, 0.055, -0.08],
          [0.03, 0.055, 0.14],
        ].map((p, i) => (
          <group key={`lily-${i}`} position={p}>
            <mesh
              rotation={[-Math.PI / 2, 0, i * 0.7]}
              material={mat(i % 2 ? C.green : C.greenLight)}
            >
              <circleGeometry args={[0.065, 10]} />
            </mesh>
            <Box
              pos={[0.018, 0.003, 0]}
              size={[0.003, 0.003, 0.055]}
              color={C.greenDark}
              castShadow={false}
            />
          </group>
        ))}

        {/* Small water lily flowers */}
        {[
          [-0.12, 0.062, 0.09],
          [0.13, 0.062, -0.08],
        ].map((p, i) => (
          <group key={`water-lily-flower-${i}`} position={p}>
            {Array.from({ length: 5 }, (_, j) => {
              const angle = (j / 5) * Math.PI * 2;
              return (
                <mesh
                  key={j}
                  position={[
                    Math.cos(angle) * 0.018,
                    0.004,
                    Math.sin(angle) * 0.018,
                  ]}
                  rotation={[0.25, angle, 0]}
                  material={mat(i ? C.light : C.gold)}
                >
                  <sphereGeometry args={[0.013, 6, 5]} />
                </mesh>
              );
            })}
            <mesh
              position={[0, 0.01, 0]}
              material={mat(C.gold)}
            >
              <sphereGeometry args={[0.009, 6, 5]} />
            </mesh>
          </group>
        ))}

        {/* Rounded stones around the pond edge */}
        {Array.from({ length: 13 }, (_, i) => {
          const angle = (i / 13) * Math.PI * 2;
          const radius = 0.32;

          return (
            <mesh
              key={`pond-stone-${i}`}
              position={[
                Math.cos(angle) * radius,
                0.05,
                Math.sin(angle) * radius,
              ]}
              scale={[1.25, 0.65, 0.9]}
              material={mat(i % 2 ? C.stoneLight : C.stone)}
              castShadow
            >
              <dodecahedronGeometry args={[0.045, 0]} />
            </mesh>
          );
        })}
      </group>

      {/* Small bamboo water scoop beside the pond */}
      <group position={[-1.13, 0.09, 0.72]} rotation={[0, 0, -0.18]}>
        <Beam
          start={[0, 0, 0]}
          end={[0.17, 0.20, 0]}
          radius={0.012}
          color={C.bamboo}
        />
        <mesh
          position={[-0.015, 0.025, 0]}
          material={mat(C.woodLight)}
          castShadow
        >
          <cylinderGeometry args={[0.055, 0.045, 0.06, 8]} />
        </mesh>
      </group>

      {/* =====================================================
          FILIPINO COUNTRYSIDE DETAILS AROUND THE BORDER
      ===================================================== */}

      {/* Bamboo fence around the back and side edges */}
      {[-1, 1].map((side) => (
        <group key={`border-fence-${side}`}>
          {Array.from({ length: 9 }, (_, i) => {
            const z = -1.10 + i * 0.275;
            return (
              <group key={`fence-post-${i}`} position={[side * 1.10, 0.12, z]}>
                <Box
                  pos={[0, 0.10, 0]}
                  size={[0.035, 0.24, 0.035]}
                  color={C.bamboo}
                />
                <Box
                  pos={[0, 0.205, 0]}
                  size={[0.045, 0.025, 0.045]}
                  color={C.bambooLight}
                />
              </group>
            );
          })}

          {[0.10, 0.20].map((y, i) => (
            <Box
              key={`fence-rail-${i}`}
              pos={[side * 1.10, y, 0]}
              size={[0.025, 0.025, 2.22]}
              color={i ? C.wood : C.bambooDark}
            />
          ))}
        </group>
      ))}

      {/* Rear bamboo fence */}
      {Array.from({ length: 9 }, (_, i) => (
        <Box
          key={`back-fence-${i}`}
          pos={[-1.10 + i * 0.275, 0.14, -1.10]}
          size={[0.03, 0.28, 0.03]}
          color={C.bamboo}
        />
      ))}

      <Box
        pos={[0, 0.22, -1.10]}
        size={[2.22, 0.025, 0.025]}
        color={C.wood}
      />
      <Box
        pos={[0, 0.12, -1.10]}
        size={[2.22, 0.025, 0.025]}
        color={C.bambooDark}
      />

      {/* Small rice plots along the outer edges */}
      {[
        { x: 0.91, z: -0.73, w: 0.32, d: 0.45 },
        { x: 0.91, z: 0.00, w: 0.30, d: 0.38 },
        { x: 0.35, z: -1.03, w: 0.46, d: 0.18 },
        { x: -0.42, z: -1.03, w: 0.40, d: 0.18 },
      ].map((paddy, i) => (
        <group
          key={`border-paddy-${i}`}
          position={[paddy.x, 0.018, paddy.z]}
        >
          <Box
            pos={[0, 0, 0]}
            size={[paddy.w, 0.035, paddy.d]}
            color={C.rice}
          />

          <Box
            pos={[0, 0.02, 0]}
            size={[paddy.w * 0.84, 0.008, paddy.d * 0.70]}
            color={C.water}
            castShadow={false}
          />

          {Array.from({ length: 5 }, (_, j) => (
            <group
              key={j}
              position={[
                -paddy.w * 0.35 + j * paddy.w * 0.17,
                0.04,
                (j % 2 ? -1 : 1) * paddy.d * 0.15,
              ]}
            >
              <Beam
                start={[0, 0, 0]}
                end={[0.015, 0.095, 0]}
                radius={0.004}
                color={C.greenDark}
              />
              <Beam
                start={[0, 0.025, 0]}
                end={[-0.03, 0.075, 0.01]}
                radius={0.004}
                color={C.green}
              />
              <Beam
                start={[0, 0.04, 0]}
                end={[0.035, 0.09, -0.01]}
                radius={0.004}
                color={C.greenLight}
              />
            </group>
          ))}
        </group>
      ))}

      {/* Border plants: banana plants, coconut palms, shrubs and pots */}
      {borderPlants.map((plant, i) => (
        <group
          key={`border-plant-${i}`}
          position={[plant.x, 0.025, plant.z]}
          rotation={[0, plant.rotation, 0]}
          scale={plant.scale}
        >
          {plant.type === 0 ? (
            <>
              {/* Banana plant trunk */}
              <mesh
                position={[0, 0.20, 0]}
                material={mat(C.greenDark)}
                castShadow
              >
                <cylinderGeometry args={[0.035, 0.05, 0.40, 7]} />
              </mesh>

              {/* Broad banana leaves */}
              {Array.from({ length: 5 }, (_, j) => {
                const angle = (j / 5) * Math.PI * 2;
                return (
                  <mesh
                    key={j}
                    position={[
                      Math.cos(angle) * 0.105,
                      0.36 + (j % 2) * 0.035,
                      Math.sin(angle) * 0.105,
                    ]}
                    rotation={[
                      Math.cos(angle) * 0.45,
                      -angle,
                      Math.sin(angle) * 0.45,
                    ]}
                    material={mat(j % 2 ? C.green : C.greenLight)}
                    castShadow
                  >
                    <boxGeometry args={[0.055, 0.24, 0.012]} />
                  </mesh>
                );
              })}
            </>
          ) : plant.type === 1 ? (
            <>
              {/* Coconut palm trunk */}
              <Beam
                start={[0, 0, 0]}
                end={[0.035, 0.42, 0]}
                radius={0.025}
                color={C.woodLight}
              />

              {[0.12, 0.22, 0.32].map((y, j) => (
                <Box
                  key={j}
                  pos={[0.01, y, 0]}
                  size={[0.055, 0.018, 0.055]}
                  color={C.wood}
                />
              ))}

              {/* Palm fronds */}
              {Array.from({ length: 7 }, (_, j) => {
                const angle = (j / 7) * Math.PI * 2;
                return (
                  <group key={j} rotation={[0, angle, 0]}>
                    <Beam
                      start={[0, 0.40, 0]}
                      end={[0.18, 0.49, 0]}
                      radius={0.006}
                      color={C.greenDark}
                    />
                    {[-1, 0, 1].map((leaf) => (
                      <mesh
                        key={leaf}
                        position={[0.10, 0.47 + leaf * 0.018, leaf * 0.025]}
                        rotation={[0, 0, -0.45]}
                        material={mat(C.green)}
                      >
                        <coneGeometry args={[0.025, 0.16, 4]} />
                      </mesh>
                    ))}
                  </group>
                );
              })}
            </>
          ) : plant.type === 2 ? (
            <>
              {/* Low flowering tropical shrub */}
              {[0, 1, 2, 3, 4].map((j) => (
                <mesh
                  key={j}
                  position={[
                    Math.cos(j * 1.25) * 0.065,
                    0.07 + (j % 2) * 0.035,
                    Math.sin(j * 1.25) * 0.065,
                  ]}
                  material={mat(j % 2 ? C.green : C.greenLight)}
                  castShadow
                >
                  <sphereGeometry args={[0.065, 7, 6]} />
                </mesh>
              ))}
            </>
          ) : (
            <>
              {/* Terracotta garden pot */}
              <mesh
                position={[0, 0.055, 0]}
                material={mat(C.terracotta)}
                castShadow
              >
                <cylinderGeometry args={[0.045, 0.06, 0.10, 9]} />
              </mesh>

              <mesh
                position={[0, 0.11, 0]}
                material={mat(C.green)}
              >
                <sphereGeometry args={[0.045, 7, 6]} />
              </mesh>
            </>
          )}
        </group>
      ))}

      {/* Traditional hanging lanterns along the rear fence */}
      {[-0.78, 0, 0.78].map((x, i) => (
        <group key={`border-lantern-${i}`} position={[x, 0.36, -1.08]}>
          <Beam
            start={[0, 0.10, 0]}
            end={[0, 0.02, 0]}
            radius={0.005}
            color={C.wood}
          />
          <Box
            pos={[0, -0.035, 0]}
            size={[0.065, 0.075, 0.065]}
            color={C.lantern}
            materialProps={{
              emissive: C.lantern,
              emissiveIntensity: 0.65,
            }}
          />
          <mesh
            position={[0, -0.09, 0]}
            material={mat(C.gold)}
          >
            <coneGeometry args={[0.04, 0.04, 4]} />
          </mesh>
        </group>
      ))}

      {/* Small wooden banca beside the pond */}
      <group position={[-1.05, 0.065, 0.36]} rotation={[0, -0.25, 0]}>
        <Box
          pos={[0, 0.015, 0]}
          size={[0.12, 0.045, 0.36]}
          color={C.woodLight}
        />
        <Box
          pos={[-0.065, 0.035, 0]}
          size={[0.018, 0.055, 0.36]}
          color={C.wood}
        />
        <Box
          pos={[0.065, 0.035, 0]}
          size={[0.018, 0.055, 0.36]}
          color={C.wood}
        />
        {[-0.10, 0, 0.10].map((z, i) => (
          <Box
            key={i}
            pos={[0, 0.043, z]}
            size={[0.105, 0.012, 0.012]}
            color={C.woodHighlight}
          />
        ))}
      </group>

      {/* A few warm stepping lights around the garden */}
      {[
        [-0.64, 0.065, 0.30],
        [0.68, 0.065, 0.30],
        [-0.65, 0.065, -0.62],
        [0.70, 0.065, -0.62],
      ].map((p, i) => (
        <group key={`garden-light-${i}`} position={p}>
          <mesh material={mat(C.stone)} castShadow>
            <cylinderGeometry args={[0.045, 0.05, 0.06, 8]} />
          </mesh>
          <mesh
            position={[0, 0.035, 0]}
            material={mat(C.lantern, 0.35, {
              emissive: C.lantern,
              emissiveIntensity: 0.65,
            })}
          >
            <sphereGeometry args={[0.027, 8, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ============================================================
// QR MODULE DECOR
// Keep the QR finder patterns unobstructed and use only a few
// small plants on ordinary dark modules.
// ============================================================

function DarkModuleDecor({ matrix, C }) {
  const items = useMemo(() => {
    const random = rng(7777);
    const result = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (!matrix[z][x]) continue;
        if (isFinderZone(x, z)) continue;
        if (x === 6 || z === 6) continue;

        const dx = Math.abs(x - (GRID - 1) / 2);
        const dz = Math.abs(z - (GRID - 1) / 2);

        // Keep the central village and its paths readable.
        if (dx < 7 && dz < 8) continue;
        if (random() > 0.18) continue;

        result.push({
          x: (x - (GRID - 1) / 2) * TILE,
          z: (z - (GRID - 1) / 2) * TILE,
          height: 0.035 + random() * 0.035,
          color: random() > 0.5 ? C.green : C.greenDark,
        });
      }
    }

    return result;
  }, [matrix, C]);

  return (
    <group>
      {items.map((item, i) => (
        <group
          key={i}
          position={[item.x, H_DARK, item.z]}
        >
          <mesh
            position={[0, item.height / 2, 0]}
            material={mat(item.color)}
            castShadow
          >
            <cylinderGeometry args={[0.012, 0.018, item.height, 5]} />
          </mesh>

          <mesh
            position={[0.012, item.height, 0]}
            material={mat(C.greenLight)}
            castShadow
          >
            <coneGeometry args={[0.018, 0.04, 5]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ============================================================
// FIRELIES
// ============================================================

function GoldenSparks({ C }) {
  const groupRef = useRef();

  const sparks = useMemo(() => {
    const random = rng(9999);

    return Array.from({ length: 18 }, (_, i) => ({
      base: [
        (random() - 0.5) * 2.6,
        0.5 + random() * 0.75,
        (random() - 0.5) * 2.6,
      ],
      phase: random() * Math.PI * 2,
      speed: 0.35 + random() * 0.7,
      size: 0.012 + random() * 0.012,
      color: i % 2 ? C.gold : C.lantern,
    }));
  }, [C]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const t = clock.elapsedTime;

    groupRef.current.children.forEach((mesh, i) => {
      const spark = sparks[i];

      mesh.position.set(
        spark.base[0] + Math.sin(t * spark.speed + spark.phase) * 0.035,
        spark.base[1] + Math.sin(t * spark.speed * 1.3 + spark.phase) * 0.04,
        spark.base[2] + Math.cos(t * spark.speed + spark.phase) * 0.035
      );
    });
  });

  return (
    <group ref={groupRef}>
      {sparks.map((spark, i) => (
        <mesh key={i} position={spark.base}>
          <sphereGeometry args={[spark.size, 5, 5]} />
          <meshBasicMaterial
            color={spark.color}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================
// LIGHTING
// ============================================================

function SceneLighting({ C }) {
  const warmLight = useRef();

  useFrame(({ clock }) => {
    if (warmLight.current) {
      warmLight.current.intensity =
        0.75 + Math.sin(clock.elapsedTime * 0.7) * 0.06;
    }
  });

  return (
    <>
      <ambientLight intensity={1.05} color="#fff1d9" />

      <directionalLight
        position={[-3, 6, 4]}
        intensity={2.0}
        color="#fff2d5"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <directionalLight
        position={[3, 3, -3]}
        intensity={0.55}
        color="#d5e5bb"
      />

      <pointLight
        ref={warmLight}
        position={[-0.4, 1.8, 0.2]}
        color={C.gold}
        intensity={0.75}
        distance={3.5}
      />
    </>
  );
}

// ============================================================
// MAIN EXPORT
// ============================================================

export default function BahayKuboScene({ themeColors }) {
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
      <ConnectedVillage C={C} />
      <DarkModuleDecor matrix={matrix} C={C} />
      <GoldenSparks C={C} />
    </group>
  );
}