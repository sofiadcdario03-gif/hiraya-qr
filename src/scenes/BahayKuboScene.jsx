
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
    ground: "#c9b58b",
    earth: "#785238",
    soil: "#553923",
    path: "#b58b60",
    pathLight: "#d5b38a",

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
            : C.light,
        });
      }
    }

    return result;
  }, [matrix, C]);

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
  const villageRef = useRef();

  const plants = useMemo(() => {
    const random = rng(2025);
    const result = [];

    for (let i = 0; i < 36; i++) {
      const side = random() > 0.5 ? 1 : -1;
      const x = side * (0.72 + random() * 0.22);
      const z = -0.95 + random() * 1.9;

      // Leave the main connecting path clear.
      if (Math.abs(x) < 0.75 && Math.abs(z) < 0.8) continue;

      result.push({
        x,
        z,
        scale: 0.7 + random() * 0.7,
        type: Math.floor(random() * 3),
        rotation: random() * Math.PI * 2,
      });
    }

    return result;
  }, []);

  return (
    <group ref={villageRef} position={[0, H_DARK, 0]}>
      {/* Central packed-earth lane links the entire settlement. */}
      <Box
        pos={[0, 0.012, 0.0]}
        size={[0.19, 0.025, 2.25]}
        color={C.path}
      />

      {/* Worn edges soften the straight path. */}
      <Box
        pos={[-0.105, 0.008, 0]}
        size={[0.035, 0.018, 2.15]}
        color={C.pathLight}
        castShadow={false}
      />
      <Box
        pos={[0.105, 0.008, 0]}
        size={[0.035, 0.018, 2.15]}
        color={C.earth}
        castShadow={false}
      />

      {/* Branches connect the main lane to the front stairs. */}
      {[
        [-0.48, -0.45, 0.7],
        [0.48, 0.48, 0.7],
        [-0.48, 0.45, -0.68],
      ].map(([x, z, length], i) => (
        <Box
          key={`branch-${i}`}
          pos={[x / 2, 0.015, z]}
          size={[Math.abs(x) + 0.12, 0.03, 0.13]}
          rot={[0, 0, 0]}
          color={C.path}
        />
      ))}

      {/* Small stepping stones are embedded in the earth. */}
      {Array.from({ length: 8 }, (_, i) => (
        <Box
          key={`stone-${i}`}
          pos={[
            i % 2 ? 0.045 : -0.045,
            0.033,
            -0.85 + i * 0.23,
          ]}
          size={[0.075, 0.018, 0.09]}
          color={i % 2 ? C.stone : C.stoneLight}
          castShadow={false}
        />
      ))}

      {/* Three distinct houses face the shared lane. */}
      <BahayKubo
        C={C}
        position={[-0.49, 0, 0.57]}
        scale={0.72}
        rotation={-0.12}
        variant={0}
      />

      <BahayKubo
        C={C}
        position={[0.49, 0, -0.43]}
        scale={0.68}
        rotation={Math.PI + 0.12}
        variant={1}
      />

      <BahayKubo
        C={C}
        position={[-0.47, 0, -0.78]}
        scale={0.52}
        rotation={-0.08}
        variant={0}
      />

      {/* Shared bamboo fence segments define yards, not isolated squares. */}
      {[-1, 1].map((side) => (
        <group key={`fence-${side}`}>
          {[-0.94, -0.69, -0.44, -0.19, 0.06, 0.31, 0.56, 0.81, 1.06].map(
            (z, i) => (
              <Box
                key={`post-${i}`}
                pos={[side * 0.99, 0.13, z]}
                size={[0.035, 0.26, 0.035]}
                color={C.bamboo}
              />
            )
          )}

          <Box
            pos={[side * 0.99, 0.19, 0.06]}
            size={[0.03, 0.025, 2.0]}
            color={C.wood}
          />
          <Box
            pos={[side * 0.99, 0.095, 0.06]}
            size={[0.025, 0.025, 2.0]}
            color={C.bambooDark}
          />
        </group>
      ))}

      {/* Rice paddies are broad, shallow plots instead of tiny cubes. */}
      {[
        [-0.98, 0.0, 0.48, 0.72],
        [0.99, 0.62, 0.42, 0.55],
      ].map(([x, z, width, depth], i) => (
        <group key={`paddy-${i}`} position={[x, 0, z]}>
          <Box
            pos={[0, 0.012, 0]}
            size={[width, 0.035, depth]}
            color={C.rice}
          />
          <Box
            pos={[0, 0.032, depth * 0.42]}
            size={[width * 0.92, 0.012, 0.035]}
            color={C.water}
            castShadow={false}
          />
          <Box
            pos={[0, 0.032, -depth * 0.42]}
            size={[width * 0.92, 0.012, 0.035]}
            color={C.waterLight}
            castShadow={false}
          />
        </group>
      ))}

      {/* Rice clumps follow the edges of the paddies. */}
      {Array.from({ length: 28 }, (_, i) => {
        const side = i % 2 ? -1 : 1;
        const z = -0.9 + (i % 14) * 0.13;
        const x = side * (0.79 + (i % 3) * 0.045);

        return (
          <group key={`rice-${i}`} position={[x, 0.05, z]}>
            <Beam
              start={[0, 0, 0]}
              end={[0.015 * side, 0.11, 0.01]}
              radius={0.005}
              color={C.greenDark}
            />
            <Beam
              start={[0, 0.045, 0]}
              end={[-0.035, 0.085, 0.012]}
              radius={0.004}
              color={C.green}
            />
            <Beam
              start={[0, 0.065, 0]}
              end={[0.03, 0.105, -0.01]}
              radius={0.004}
              color={C.greenLight}
            />
          </group>
        );
      })}

      {/* A connected irrigation channel follows the edge of the lane. */}
      <group position={[0.76, 0.035, 0.04]}>
        <Box
          pos={[0, 0, 0]}
          size={[0.105, 0.06, 1.8]}
          color={C.stone}
        />
        <Box
          pos={[0, 0.022, 0]}
          size={[0.07, 0.015, 1.73]}
          color={C.water}
          castShadow={false}
        />
      </group>

      {/* Tropical planting clusters have varied silhouettes and spacing. */}
      {plants.map((plant, i) => (
        <group
          key={`plant-${i}`}
          position={[plant.x, 0.025, plant.z]}
          rotation={[0, plant.rotation, 0]}
          scale={plant.scale}
        >
          {plant.type === 0 ? (
            <>
              <mesh
                position={[0, 0.16, 0]}
                material={mat(C.greenDark)}
                castShadow
              >
                <cylinderGeometry args={[0.035, 0.045, 0.32, 7]} />
              </mesh>

              {[0, 1, 2, 3, 4].map((leaf) => (
                <mesh
                  key={leaf}
                  position={[
                    Math.cos((leaf / 5) * Math.PI * 2) * 0.1,
                    0.32 + (leaf % 2) * 0.035,
                    Math.sin((leaf / 5) * Math.PI * 2) * 0.1,
                  ]}
                  rotation={[
                    0.35,
                    (leaf / 5) * Math.PI * 2,
                    leaf % 2 ? -0.38 : 0.38,
                  ]}
                  material={mat(leaf % 2 ? C.green : C.greenLight)}
                  castShadow
                >
                  <coneGeometry args={[0.055, 0.25, 5]} />
                </mesh>
              ))}
            </>
          ) : plant.type === 1 ? (
            <>
              <mesh
                position={[0, 0.2, 0]}
                material={mat(C.bamboo)}
                castShadow
              >
                <cylinderGeometry args={[0.018, 0.025, 0.4, 6]} />
              </mesh>
              {[0, 1, 2, 3].map((leaf) => (
                <Beam
                  key={leaf}
                  start={[0, 0.25 + leaf * 0.025, 0]}
                  end={[
                    Math.cos(leaf * 1.6) * 0.15,
                    0.34 + (leaf % 2) * 0.04,
                    Math.sin(leaf * 1.6) * 0.15,
                  ]}
                  radius={0.009}
                  color={C.green}
                />
              ))}
            </>
          ) : (
            <>
              <mesh
                position={[0, 0.055, 0]}
                material={mat(C.terracotta)}
                castShadow
              >
                <sphereGeometry args={[0.07, 9, 7]} />
              </mesh>
              <mesh
                position={[0, 0.12, 0]}
                material={mat(C.terracotta)}
              >
                <cylinderGeometry args={[0.035, 0.045, 0.02, 9]} />
              </mesh>
            </>
          )}
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