
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

function mat(color, roughness = 0.8, extra = {}) {
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

function blendHex(a, b, amount) {
  const aa = parseInt(a.replace("#", ""), 16);
  const bb = parseInt(b.replace("#", ""), 16);

  const channel = (shift) => {
    const start = (aa >> shift) & 255;
    const end = (bb >> shift) & 255;
    return Math.round(start + (end - start) * amount);
  };

  return `#${((channel(16) << 16) |
    (channel(8) << 8) |
    channel(0))
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
  const red = theme.primary || "#d91e42";
  const gold = theme.accent || "#ffc83d";
  const green = theme.secondary || "#16834a";
  const light = theme.light || "#fff1ce";

  return {
    red,
    redDark: darken(red, 0.35),
    redLight: lighten(red, 0.3),
    gold,
    goldLight: lighten(gold, 0.32),
    green,
    greenDark: darken(green, 0.3),
    greenLight: lighten(green, 0.3),
    light,
    white: "#fffdf4",
    base: "#A8A8A8", // gray concrete
    soil: "#65402d",
    soilLight: "#9b6240",
    wood: "#8a5632",
    woodLight: "#c58c4b",
    glow: "#fff1a8",
    blue: "#36bde8",
    blueDark: "#2876bc",
    pink: "#ff7eb6",
    purple: "#a77aff",
    orange: "#ff8a38",
    teal: "#28c6b6",
  };
}

function Box({
  pos,
  size,
  color,
  rotation = [0, 0, 0],
  shadow = true,
}) {
  return (
    <mesh
      position={pos}
      scale={size}
      rotation={rotation}
      material={mat(color)}
      castShadow={shadow}
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}

function Sphere({
  pos,
  position = pos,
  radius,
  color,
  emissive = false,
  scale = [1, 1, 1],
}) {
  return (
    <mesh position={position} scale={scale} castShadow>
      <sphereGeometry args={[radius, 14, 12]} />
      {emissive ? (
        <meshBasicMaterial color={color} toneMapped={false} />
      ) : (
        <meshStandardMaterial color={color} roughness={0.4} />
      )}
    </mesh>
  );
}

function Rod({
  start,
  end,
  radius = 0.01,
  color,
  radialSegments = 8,
}) {
  const geometry = useMemo(() => {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const direction = new THREE.Vector3().subVectors(b, a);
    const length = direction.length();
    const midpoint = a.clone().add(b).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    );

    return { length, midpoint, quaternion };
  }, [start, end]);

  return (
    <mesh
      position={geometry.midpoint}
      quaternion={geometry.quaternion}
      castShadow
      material={mat(color, 0.45, { metalness: 0.2 })}
    >
      <cylinderGeometry
        args={[radius, radius, geometry.length, radialSegments]}
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
    <mesh position={pos} rotation={rot} material={mat(color)} castShadow receiveShadow>
      <cylinderGeometry args={[rTop, rBot, h, segs]} />
    </mesh>
  );
}

function Glow({ pos, color, size = 0.025 }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse =
        0.85 + Math.sin(clock.elapsedTime * 2.8 + pos[0] * 4) * 0.15;
      ref.current.scale.setScalar(pulse);
    }
  });

  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[size, 10, 10]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

// ------------------------------------------------------------
// QR MATRIX
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
// QR PLATFORM
// ------------------------------------------------------------

function QRGround({ matrix, C }) {
  const tiles = useMemo(() => {
    const output = [];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const finder = isFinderZone(x, z);
        const timing = (x === 6 || z === 6) && !finder;
        const dark = matrix[z][x];

        let height = H_BASE;
        let color = C.base;

        if (finder) {
          height = dark ? H_FINDER : H_BASE;
          color = dark ? C.red : C.base;
        } else if (timing && dark) {
          height = 0.055;
          color = C.redDark;
        } else if (dark) {
          height = H_DARK;
          color = (x + z) % 4 === 0 ? C.redDark : C.red;
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
  }, [matrix, C]);

  return (
    <group>
      <Box
        pos={[0, -0.06, 0]}
        size={[GRID * TILE + 0.12, 0.12, GRID * TILE + 0.12]}
        color={C.base}
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
        color={C.soilLight}
      />

      <Box
        pos={[0, -0.24, 0]}
        size={[GRID * TILE + 0.12, 0.1, GRID * TILE + 0.12]}
        color={C.soil}
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
          color={C.wood}
        />
      ))}

      {/* Gold corner studs */}
      {[
        [-1.48, -1.48],
        [1.48, -1.48],
        [-1.48, 1.48],
        [1.48, 1.48],
      ].map(([x, z], i) => (
        <group key={i} position={[x, -0.025, z]}>
          <Sphere pos={[0, 0.03, 0]} radius={0.045} color={C.gold} />
          <Sphere
            pos={[0, 0.065, 0]}
            radius={0.018}
            color={C.glow}
            emissive
          />
        </group>
      ))}

      {/* Small Christmas trees around the edges */}
      {[
        [-1.1, -1.2],
        [1.1, -1.2],
        [-1.1, 1.2],
        [1.1, 1.2],
        [-0.6, -1.4],
        [0.6, -1.4],
        [-0.6, 1.4],
        [0.6, 1.4],
      ].map(([x, z], i) => (
        <group key={`tree-${i}`} position={[x, 0, z]}>
          {/* Tree trunk */}
          <Box pos={[0, 0.04, 0]} size={[0.015, 0.08, 0.015]} color={C.wood} />
          {/* Tree layers */}
          <Cone pos={[0, 0.12, 0]} rTop={0} rBot={0.08} h={0.08} segs={6} color={C.green} />
          <Cone pos={[0, 0.18, 0]} rTop={0} rBot={0.06} h={0.07} segs={6} color={C.greenDark} />
          <Cone pos={[0, 0.23, 0]} rTop={0} rBot={0.04} h={0.05} segs={6} color={C.greenLight} />
          {/* Star on top */}
          <Sphere pos={[0, 0.27, 0]} radius={0.012} color={C.gold} emissive />
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------
// STAR SHAPE HELPERS
// ------------------------------------------------------------

function createStarPoints(outerRadius, innerRadius, count = 5) {
  const points = [];

  for (let i = 0; i < count * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / count;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;

    points.push([
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    ]);
  }

  return points;
}

function makeStarShape(outerRadius, innerRadius) {
  const points = createStarPoints(outerRadius, innerRadius);
  const shape = new THREE.Shape();

  shape.moveTo(points[0][0], points[0][1]);

  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }

  shape.closePath();
  return shape;
}

function StarPanel({
  radius,
  outerRadius = radius,
  innerRadius,
  color,
  z = 0,
  opacity = 1,
  depth = 0,
}) {
  const shape = useMemo(
    () => makeStarShape(outerRadius, innerRadius),
    [outerRadius, innerRadius]
  );

  return (
    <mesh position={[0, 0, z]} renderOrder={2}>
      {depth > 0 ? (
        <extrudeGeometry args={[shape, { depth, bevelEnabled: false }]} />
      ) : (
        <shapeGeometry args={[shape]} />
      )}
      <meshBasicMaterial
        color={color}
        side={THREE.DoubleSide}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
        toneMapped={false}
      />
    </mesh>
  );
}

// ------------------------------------------------------------
// GRAND FILIPINO PAROL
// ------------------------------------------------------------


function ParolCentre({ C }) {
  const groupRef = useRef();
  const glowRef = useRef();

  const outerRadius = 1.08;
  const innerRadius = 0.47;
  const centerY = H_DARK + 1.20;

  const points = useMemo(
    () => createStarPoints(outerRadius, innerRadius),
    []
  );

  const innerPoints = useMemo(
    () => createStarPoints(0.88, 0.385),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.35) * 0.035;
    }

    if (glowRef.current) {
      const pulse = 0.85 + Math.sin(t * 2.2) * 0.15;
      glowRef.current.intensity = 1.8 * pulse;
    }
  });

  const gold = C.gold || "#D9AE50";
  const goldLight = C.goldLight || "#FFE6A0";
  const red = C.red || "#C73532";
  const redDark = C.redDark || "#781C2B";
  const orange = C.orange || "#F28C28";
  const green = C.green || "#26734D";
  const blue = C.blue || "#45BDE8";
  const cream = C.cream || "#FFF2CC";

  const pointAt = (p, z) => [p[0], p[1], z];

  return (
    <group ref={groupRef} position={[0, centerY, 0]}>

      {/* Deep shadow backing: gives the entire parol physical thickness */}
      <StarPanel
        outerRadius={1.105}
        innerRadius={0.485}
        z={-0.16}
        color={redDark}
        depth={0.22}
      />

      {/* Thick outer frame */}
      <StarPanel
        outerRadius={1.08}
        innerRadius={0.47}
        z={-0.035}
        color={gold}
        depth={0.15}
      />

      {/* Raised red enamel layer */}
      <StarPanel
        outerRadius={1.015}
        innerRadius={0.442}
        z={0.045}
        color={redDark}
        depth={0.13}
      />

      {/* Orange-gold transition layer */}
      <StarPanel
        outerRadius={0.935}
        innerRadius={0.407}
        z={0.105}
        color={orange}
        depth={0.11}
      />

      {/* Main red star face */}
      <StarPanel
        outerRadius={0.855}
        innerRadius={0.372}
        z={0.165}
        color={red}
        depth={0.10}
      />

      {/* Inner gold star frame */}
      <StarPanel
        outerRadius={0.745}
        innerRadius={0.325}
        z={0.215}
        color={goldLight}
        depth={0.09}
      />

      {/* Smaller decorative star layers */}
      <StarPanel
        outerRadius={0.665}
        innerRadius={0.29}
        z={0.265}
        color={redDark}
        depth={0.08}
      />

      <StarPanel
        outerRadius={0.565}
        innerRadius={0.247}
        z={0.305}
        color={gold}
        depth={0.075}
      />

      <StarPanel
        outerRadius={0.465}
        innerRadius={0.203}
        z={0.345}
        color={red}
        depth={0.065}
      />

      {/* Thick gold perimeter rails */}
      {points.map((p, i) => {
        const next = points[(i + 1) % points.length];

        return (
          <group key={`outer-rail-${i}`}>
            <Rod
              start={pointAt(p, 0.255)}
              end={pointAt(next, 0.255)}
              radius={0.019}
              color={goldLight}
            />
            <Rod
              start={pointAt(p, 0.285)}
              end={pointAt(next, 0.285)}
              radius={0.008}
              color={cream}
            />
          </group>
        );
      })}

      {/* Secondary inner frame */}
      {innerPoints.map((p, i) => {
        const next = innerPoints[(i + 1) % innerPoints.length];

        return (
          <Rod
            key={`inner-rail-${i}`}
            start={pointAt(p, 0.345)}
            end={pointAt(next, 0.345)}
            radius={0.013}
            color={goldLight}
          />
        );
      })}

      {/* Heavy structural ribs from center toward the five tips */}
      {points.filter((_, i) => i % 2 === 0).map((p, i) => (
        <group key={`heavy-rib-${i}`}>
          <Rod
            start={[0, 0, 0.30]}
            end={pointAt(p, 0.30)}
            radius={0.025}
            color={gold}
          />
          <Rod
            start={[0, 0, 0.325]}
            end={[p[0] * 0.82, p[1] * 0.82, 0.325]}
            radius={0.009}
            color={goldLight}
          />
        </group>
      ))}

      {/* Fine decorative spokes */}
      {points.map((p, i) => (
        <Rod
          key={`fine-spoke-${i}`}
          start={[0, 0, 0.365]}
          end={[p[0] * 0.80, p[1] * 0.80, 0.365]}
          radius={0.008}
          color={goldLight}
        />
      ))}

      {/* Gold studs following the star's outline */}
      {points.map((p, i) => (
        <group key={`tip-jewel-${i}`}>
          <Sphere
            position={[p[0] * 0.94, p[1] * 0.94, 0.34]}
            radius={0.052}
            color={gold}
          />
          <Sphere
            position={[p[0] * 0.94, p[1] * 0.94, 0.385]}
            radius={0.026}
            color={cream}
          />
        </group>
      ))}

      {/* Small beads along each star arm */}
      {points.filter((_, i) => i % 2 === 0).flatMap((p, i) => {
        const positions = [0.36, 0.52, 0.68];

        return positions.map((t, j) => (
          <Sphere
            key={`arm-bead-${i}-${j}`}
            position={[p[0] * t, p[1] * t, 0.37]}
            radius={j === 1 ? 0.022 : 0.015}
            color={j === 1 ? goldLight : gold}
          />
        ));
      })}

      {/* Five raised jewel settings around the center */}
      {points.filter((_, i) => i % 2 === 0).map((p, i) => {
        const x = p[0] * 0.24;
        const y = p[1] * 0.24;
        const jewelColors = [blue, green, goldLight, blue, green];

        return (
          <group key={`arm-jewel-${i}`} position={[x, y, 0.41]}>
            <mesh>
              <torusGeometry args={[0.045, 0.008, 8, 24]} />
              <meshStandardMaterial
                color={goldLight}
                metalness={0.8}
                roughness={0.25}
              />
            </mesh>
            <Sphere
              position={[0, 0, 0.012]}
              radius={0.022}
              color={jewelColors[i % jewelColors.length]}
            />
          </group>
        );
      })}

      {/* Raised central medallion backing */}
      <Sphere
        position={[0, 0, 0.405]}
        radius={0.12}
        color={redDark}
      />

      {/* Layered circular gold medallion */}
      <mesh position={[0, 0, 0.49]}>
        <torusGeometry args={[0.095, 0.018, 12, 48]} />
        <meshStandardMaterial
          color={goldLight}
          metalness={0.85}
          roughness={0.2}
          emissive={gold}
          emissiveIntensity={0.3}
        />
      </mesh>

      <mesh position={[0, 0, 0.475]}>
        <torusGeometry args={[0.065, 0.008, 10, 40]} />
        <meshStandardMaterial
          color={cream}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>

      <Sphere
        position={[0, 0, 0.49]}
        radius={0.055}
        color={gold}
      />

      <Sphere
        position={[0, 0, 0.545]}
        radius={0.035}
        color={cream}
      />

      {/* Tiny central red jewel */}
      <Sphere
        position={[0, 0, 0.615]}
        radius={0.034}
        color={red}
      />

      {/* Radial gold details around the medallion */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const r1 = 0.07;
        const r2 = 0.10;

        return (
          <group key={`medallion-ray-${i}`}>
            <Rod
              start={[
                Math.cos(angle) * r1,
                Math.sin(angle) * r1,
                0.52
              ]}
              end={[
                Math.cos(angle) * r2,
                Math.sin(angle) * r2,
                0.52
              ]}
              radius={0.008}
              color={goldLight}
            />
            <Sphere
              position={[
                Math.cos(angle) * 0.17,
                Math.sin(angle) * 0.17,
                0.51
              ]}
              radius={0.012}
              color={cream}
            />
          </group>
        );
      })}

      <pointLight
        ref={glowRef}
        position={[0, 0, 0.8]}
        color={goldLight}
        intensity={1.8}
        distance={3.2}
      />

      {/* Thick suspension loop */}
      <mesh position={[0, 1.13, 0]}>
        <torusGeometry args={[0.105, 0.018, 10, 28]} />
        <meshStandardMaterial
          color={gold}
          metalness={0.8}
          roughness={0.25}
        />
      </mesh>

      <Rod
        start={[0, 1.02, 0]}
        end={[0, 1.32, 0]}
        radius={0.018}
        color={gold}
      />

      {/* Fuller, wider hanging ribbons */}
      {[
        { x: -0.34, len: 0.62, color: red },
        { x: -0.18, len: 0.78, color: gold },
        { x: 0, len: 0.90, color: blue },
        { x: 0.18, len: 0.78, color: green },
        { x: 0.34, len: 0.62, color: red }
      ].map((ribbon, i) => (
        <group
          key={`ribbon-${i}`}
          position={[ribbon.x, -0.80, 0.05]}
        >
          {/* Broad ribbon body */}
          <mesh position={[0, -ribbon.len / 2, 0]}>
            <boxGeometry args={[0.105, ribbon.len, 0.045]} />
            <meshStandardMaterial
              color={ribbon.color}
              metalness={0.25}
              roughness={0.38}
            />
          </mesh>

          {/* Gold center stripe */}
          <mesh position={[0, -ribbon.len / 2, 0.027]}>
            <boxGeometry args={[0.018, ribbon.len * 0.88, 0.012]} />
            <meshStandardMaterial
              color={goldLight}
              metalness={0.7}
              roughness={0.25}
            />
          </mesh>

          {/* Ribbon-end ornament */}
          <Sphere
            position={[0, -ribbon.len - 0.015, 0.025]}
            radius={0.045}
            color={gold}
          />

          <Sphere
            position={[0, -ribbon.len - 0.015, 0.065]}
            radius={0.022}
            color={cream}
          />
        </group>
      ))}
    </group>
  );
}
// ------------------------------------------------------------
// MINI PAROLS FOR THE PLATFORM BORDER
// ------------------------------------------------------------

function MiniParol({ C, scale = 1 }) {
  const points = useMemo(() => createStarPoints(0.14, 0.06), []);

  return (
    <group scale={scale}>
      <StarPanel
        radius={0.14}
        innerRadius={0.06}
        color={C.red}
        z={0}
      />

      <StarPanel
        radius={0.095}
        innerRadius={0.04}
        color={C.gold}
        z={0.012}
      />

      {points.map((point, index) => {
        const next = points[(index + 1) % points.length];

        return (
          <Rod
            key={index}
            start={[point[0], point[1], 0.02]}
            end={[next[0], next[1], 0.02]}
            radius={0.004}
            color={C.goldLight}
          />
        );
      })}

      {[0, 2, 4, 6, 8].map((index) => (
        <Sphere
          key={index}
          pos={[points[index][0], points[index][1], 0.03]}
          radius={0.009}
          color={C.white}
          emissive
        />
      ))}

      <Sphere
        pos={[0, 0, 0.035]}
        radius={0.026}
        color={C.goldLight}
      />

      <Rod
        start={[0, -0.12, 0]}
        end={[0, -0.23, 0]}
        radius={0.005}
        color={C.gold}
      />

      <Sphere
        pos={[0, -0.24, 0]}
        radius={0.012}
        color={C.red}
      />
    </group>
  );
}

// ------------------------------------------------------------
// MINI CHRISTMAS TREES
// ------------------------------------------------------------

function ChristmasTree({ C, scale = 1 }) {
  const starRef = useRef();

  useFrame(({ clock }) => {
    if (starRef.current) {
      starRef.current.scale.setScalar(
        0.9 + Math.sin(clock.elapsedTime * 3) * 0.1
      );
    }
  });

  return (
    <group scale={scale}>
      <Box
        pos={[0, 0.035, 0]}
        size={[0.07, 0.07, 0.07]}
        color={C.wood}
      />

      {[0, 1, 2].map((index) => (
        <mesh
          key={index}
          position={[0, 0.085 + index * 0.065, 0]}
          material={mat(
            index === 1 ? C.green : C.greenDark,
            0.7
          )}
          castShadow
        >
          <coneGeometry args={[0.105 - index * 0.023, 0.13, 7]} />
        </mesh>
      ))}

      <mesh ref={starRef} position={[0, 0.3, 0]}>
        <octahedronGeometry args={[0.035, 0]} />
        <meshBasicMaterial color={C.gold} toneMapped={false} />
      </mesh>

      {[
        [-0.05, 0.11, C.red],
        [0.05, 0.14, C.gold],
        [-0.035, 0.19, C.blue],
        [0.035, 0.23, C.pink],
        [0, 0.08, C.gold],
      ].map(([x, y, color], index) => (
        <Sphere
          key={index}
          pos={[x, y, 0.075]}
          radius={0.013}
          color={color}
          emissive
        />
      ))}
    </group>
  );
}

// ------------------------------------------------------------
// CHRISTMAS GIFTS
// ------------------------------------------------------------

function ChristmasGift({ position, C, color, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <Box
        pos={[0, 0.055, 0]}
        size={[0.105, 0.11, 0.105]}
        color={color}
      />

      <Box
        pos={[0, 0.057, 0.054]}
        size={[0.018, 0.11, 0.005]}
        color={C.gold}
      />

      <Box
        pos={[0, 0.057, 0]}
        size={[0.11, 0.018, 0.11]}
        color={C.gold}
      />

      <Box
        pos={[0, 0.12, 0]}
        size={[0.025, 0.018, 0.025]}
        color={C.goldLight}
      />

      <Rod
        start={[0, 0.13, 0]}
        end={[-0.03, 0.16, 0]}
        radius={0.009}
        color={C.gold}
      />

      <Rod
        start={[0, 0.13, 0]}
        end={[0.03, 0.16, 0]}
        radius={0.009}
        color={C.gold}
      />
    </group>
  );
}

// ------------------------------------------------------------
// SAMPAGUITA FLOWERS
// ------------------------------------------------------------

function Sampaguita({ C, scale = 1 }) {
  return (
    <group scale={scale}>
      {/* Five soft white petals */}
      {[0, 1, 2, 3, 4].map((index) => {
        const angle = (index / 5) * Math.PI * 2;

        return (
          <Sphere
            key={index}
            pos={[
              Math.cos(angle) * 0.045,
              0,
              Math.sin(angle) * 0.045,
            ]}
            radius={0.035}
            color={C.white}
            scale={[1, 0.48, 0.72]}
          />
        );
      })}

      <Sphere
        pos={[0, 0.015, 0]}
        radius={0.022}
        color={C.gold}
      />
    </group>
  );
}

// ------------------------------------------------------------
// CAPIZ-INSPIRED ORNAMENTS
// ------------------------------------------------------------

function CapizOrnament({ C, color, scale = 1 }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y =
        Math.sin(clock.elapsedTime * 0.8) * 0.12;
    }
  });

  return (
    <group ref={ref} scale={scale}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.008, 8, 28]} />
        <meshStandardMaterial
          color={C.gold}
          metalness={0.5}
          roughness={0.35}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.075, 16, 12]} />
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={0.58}
          roughness={0.2}
          metalness={0.08}
          clearcoat={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      <Sphere
        pos={[0, 0, 0.04]}
        radius={0.025}
        color={C.goldLight}
        emissive
      />

      <Rod
        start={[0, 0.08, 0]}
        end={[0, 0.15, 0]}
        radius={0.005}
        color={C.gold}
      />
    </group>
  );
}

// ------------------------------------------------------------
// COLORFUL BANDERITAS
// ------------------------------------------------------------

function makeFlagShape() {
  const shape = new THREE.Shape();

  shape.moveTo(-0.055, 0.045);
  shape.lineTo(0.055, 0.045);
  shape.lineTo(0, -0.045);
  shape.closePath();

  return shape;
}

function Banderitas({ C }) {
  const flagShape = useMemo(() => makeFlagShape(), []);

  const flags = useMemo(
    () => [
      C.red,
      C.gold,
      C.blue,
      C.green,
      C.pink,
      C.purple,
      C.orange,
      C.white,
      C.red,
      C.green,
      C.gold,
      C.blue,
    ],
    [C]
  );

  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[0, 0, side * 1.37]}>
          <Rod
            start={[-1.34, 0.25, 0]}
            end={[1.34, 0.25, 0]}
            radius={0.007}
            color={C.gold}
          />

          {flags.map((color, index) => {
            const x = -1.25 + index * 0.227;

            return (
              <group
                key={index}
                position={[x, 0.205, 0]}
                rotation={[0, side === -1 ? Math.PI : 0, 0]}
              >
                <mesh>
                  <shapeGeometry args={[flagShape]} />
                  <meshStandardMaterial
                    color={color}
                    side={THREE.DoubleSide}
                    roughness={0.55}
                  />
                </mesh>

                <Sphere
                  pos={[0, -0.04, 0.006]}
                  radius={0.008}
                  color={C.goldLight}
                />
              </group>
            );
          })}
        </group>
      ))}

      {[-1, 1].map((side) => (
        <group
          key={`side-${side}`}
          position={[side * 1.37, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <Rod
            start={[-1.25, 0.25, 0]}
            end={[1.25, 0.25, 0]}
            radius={0.007}
            color={C.gold}
          />

          {flags.slice(0, 10).map((color, index) => {
            const x = -1.15 + index * 0.255;

            return (
              <mesh
                key={index}
                position={[x, 0.205, 0]}
              >
                <shapeGeometry args={[flagShape]} />
                <meshStandardMaterial
                  color={color}
                  side={THREE.DoubleSide}
                  roughness={0.55}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------
// BORDER DECORATIONS
// ------------------------------------------------------------

function BorderDecorations({ C }) {
  const miniParols = [
    { x: -1.15, z: -1.27, rotation: 0 },
    { x: -0.53, z: -1.34, rotation: 0 },
    { x: 0.53, z: -1.34, rotation: 0 },
    { x: 1.15, z: -1.27, rotation: 0 },
    { x: -1.15, z: 1.27, rotation: Math.PI },
    { x: -0.53, z: 1.34, rotation: Math.PI },
    { x: 0.53, z: 1.34, rotation: Math.PI },
    { x: 1.15, z: 1.27, rotation: Math.PI },
    { x: -1.35, z: -0.62, rotation: Math.PI / 2 },
    { x: -1.35, z: 0.62, rotation: Math.PI / 2 },
    { x: 1.35, z: -0.62, rotation: -Math.PI / 2 },
    { x: 1.35, z: 0.62, rotation: -Math.PI / 2 },
  ];

  const gifts = [
    [-1.13, H_FINDER + 0.05, -1.12, C.red],
    [1.12, H_FINDER + 0.05, -1.12, C.green],
    [-1.13, H_FINDER + 0.05, 1.12, C.blue],
    [1.12, H_FINDER + 0.05, 1.12, C.pink],
  ];

  const flowers = [
    [-1.32, 0.02, -0.95],
    [1.32, 0.02, -0.95],
    [-1.32, 0.02, 0.95],
    [1.32, 0.02, 0.95],
    [-0.95, 0.02, -1.31],
    [0.95, 0.02, -1.31],
    [-0.95, 0.02, 1.31],
    [0.95, 0.02, 1.31],
  ];

  const capiz = [
    { x: -1.38, z: -0.22, color: C.blue },
    { x: -1.38, z: 0.22, color: C.pink },
    { x: 1.38, z: -0.22, color: C.gold },
    { x: 1.38, z: 0.22, color: C.green },
  ];

  return (
    <group>
      {/* Miniature parols around all four sides */}
      {miniParols.map((item, index) => (
        <group
          key={`mini-parol-${index}`}
          position={[item.x, H_FINDER + 0.13, item.z]}
          rotation={[0, item.rotation, 0]}
        >
          <MiniParol C={C} scale={0.82} />
        </group>
      ))}

      {/* Small trees near the corners */}
      {[
        [-1.24, H_FINDER, -1.22],
        [1.24, H_FINDER, -1.22],
        [-1.24, H_FINDER, 1.22],
        [1.24, H_FINDER, 1.22],
      ].map((pos, index) => (
        <group key={`tree-${index}`} position={pos}>
          <ChristmasTree C={C} scale={0.72} />
        </group>
      ))}

      {/* Colorful gift piles */}
      {gifts.map(([x, y, z, color], index) => (
        <group key={`gift-pile-${index}`} position={[x, y, z]}>
          <ChristmasGift
            position={[0, 0, 0]}
            C={C}
            color={color}
            scale={0.72}
          />
          <ChristmasGift
            position={[0.075, 0, 0.045]}
            C={C}
            color={index % 2 === 0 ? C.gold : C.red}
            scale={0.53}
          />
        </group>
      ))}

      {/* Sampaguita garlands */}
      {flowers.map(([x, y, z], index) => (
        <group
          key={`flower-${index}`}
          position={[x, y, z]}
          rotation={[0, index * 0.6, 0]}
        >
          <Sampaguita C={C} scale={0.75} />
          <Sphere
            pos={[0, 0.015, 0]}
            radius={0.012}
            color={C.gold}
          />
        </group>
      ))}

      {/* Capiz-inspired ornaments */}
      {capiz.map((item, index) => (
        <group
          key={`capiz-${index}`}
          position={[item.x, H_FINDER + 0.16, item.z]}
          rotation={[0, item.x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
        >
          <CapizOrnament C={C} color={item.color} scale={0.72} />
        </group>
      ))}

      {/* Scattered gold beads along the edges */}
      {Array.from({ length: 32 }, (_, index) => {
        const side = index % 4;
        const step = Math.floor(index / 4);
        const offset = -1.15 + step * 0.33;

        const pos =
          side === 0
            ? [offset, 0.025, -1.43]
            : side === 1
              ? [offset, 0.025, 1.43]
              : side === 2
                ? [-1.43, 0.025, offset]
                : [1.43, 0.025, offset];

        return (
          <group key={`edge-bead-${index}`} position={pos}>
            <Sphere
              pos={[0, 0, 0]}
              radius={0.018}
              color={C.gold}
            />
            {index % 2 === 0 && (
              <Glow
                pos={[0, 0.025, 0]}
                color={C.glow}
                size={0.008}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

// ------------------------------------------------------------
// FESTIVE LIGHTS
// ------------------------------------------------------------

function ChristmasLights({ C }) {
  const groupRef = useRef();

  const lights = useMemo(() => {
    const random = rng(5555);
    const palette = [
      C.red,
      C.green,
      C.gold,
      C.blue,
      C.pink,
      C.purple,
      C.glow,
    ];

    return Array.from({ length: 46 }, (_, index) => ({
      x: (random() - 0.5) * 2.75,
      y: 0.24 + random() * 1.25,
      z: (random() - 0.5) * 2.75,
      phase: random() * Math.PI * 2,
      speed: 0.4 + random() * 0.8,
      size: 0.009 + random() * 0.013,
      color: palette[index % palette.length],
    }));
  }, [C]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const t = clock.elapsedTime;

    groupRef.current.children.forEach((mesh, index) => {
      const light = lights[index];

      mesh.position.set(
        light.x + Math.sin(t * light.speed + light.phase) * 0.025,
        light.y + Math.sin(t * light.speed * 1.2 + light.phase) * 0.025,
        light.z + Math.cos(t * light.speed + light.phase) * 0.025
      );

      if (mesh.material) {
        mesh.material.opacity =
          0.6 + Math.sin(t * 2 + light.phase) * 0.3;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {lights.map((light, index) => (
        <mesh
          key={index}
          position={[light.x, light.y, light.z]}
        >
          <sphereGeometry args={[light.size, 8, 8]} />
          <meshBasicMaterial
            color={light.color}
            toneMapped={false}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------------
// FINDER DECORATIONS
// ------------------------------------------------------------

function FinderDecorations({ C }) {
  const rightX = (GRID - 4 - (GRID - 1) / 2) * TILE;
  const topZ = (3 - (GRID - 1) / 2) * TILE;
  const bottomZ = (GRID - 4 - (GRID - 1) / 2) * TILE;

  return (
    <group>
      <group position={[(3 - 12) * TILE, H_FINDER, topZ]}>
        <ChristmasTree C={C} scale={0.65} />
      </group>

      <group position={[rightX, H_FINDER, topZ]}>
        <ChristmasGift
          position={[0, 0, 0]}
          C={C}
          color={C.red}
          scale={0.85}
        />
        <ChristmasGift
          position={[-0.1, 0, 0.02]}
          C={C}
          color={C.green}
          scale={0.65}
        />
        <Glow
          pos={[0, 0.24, 0]}
          color={C.goldLight}
          size={0.018}
        />
      </group>

      <group position={[0, H_FINDER + 0.12, bottomZ]}>
        <MiniParol C={C} scale={0.78} />
      </group>
    </group>
  );
}

// ------------------------------------------------------------
// LIGHTING
// ------------------------------------------------------------

function SceneLighting({ C }) {
  const warmLight = useRef();

  useFrame(({ clock }) => {
    if (warmLight.current) {
      warmLight.current.intensity =
        1.4 + Math.sin(clock.elapsedTime * 0.6) * 0.18;
    }
  });

  return (
    <>
      <ambientLight intensity={0.85} color="#fff3e4" />

      <directionalLight
        position={[-3, 6, 5]}
        intensity={1.8}
        color="#fff5df"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <directionalLight
        position={[3, 3, -3]}
        intensity={0.8}
        color="#ffd4a8"
      />

      <pointLight
        ref={warmLight}
        position={[0, 2.1, 0.5]}
        color={C.gold}
        intensity={1.4}
        distance={5}
      />

      <pointLight
        position={[0, 1.2, 0.8]}
        color={C.red}
        intensity={0.5}
        distance={3.5}
      />

      <pointLight
        position={[-1.1, 0.7, -0.8]}
        color={C.blue}
        intensity={0.35}
        distance={3}
      />

      <pointLight
        position={[1.1, 0.7, 0.8]}
        color={C.pink}
        intensity={0.3}
        distance={3}
      />
    </>
  );
}

// ------------------------------------------------------------
// MAIN SCENE
// ------------------------------------------------------------

export default function ParolScene({ themeColors, view }) {
  const sceneRef = useRef();
  const groupRef = useRef();
  const matrix = useMemo(() => buildMatrix(), []);

  const C = useMemo(
    () => resolveColors(themeColors),
    [themeColors]
  );

  useFrame((state, delta) => {
    if (!sceneRef.current) return;

    // Get transition progress from parent TransitionRig
    const parent = sceneRef.current.parent;
    const transitionProgress = parent?.userData?.transitionProgress ?? 0;
    const isQRView = parent?.userData?.isQRView ?? false;

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
        <SceneLighting C={C} />

        <QRGround matrix={matrix} C={C} />

        {/* Main oversized centerpiece */}
        <ParolCentre C={C} />

        {/* Traditional Filipino Christmas border */}
        <Banderitas C={C} />
        <BorderDecorations C={C} />

        {/* Extra festive ornaments around the original finder zones */}
        <FinderDecorations C={C} />

        {/* Small gifts close to the centerpiece */}
        <group>
          {[
            [-0.8, 0.025, -0.42, C.red],
            [0.78, 0.025, -0.38, C.green],
            [-0.72, 0.025, 0.48, C.blue],
            [0.77, 0.025, 0.46, C.pink],
          ].map(([x, y, z, color], index) => (
            <ChristmasGift
              key={`center-gift-${index}`}
              position={[x, y, z]}
              C={C}
              color={color}
              scale={0.75}
            />
          ))}
        </group>

        {/* Sparkling multicolor lights */}
        <ChristmasLights C={C} />
      </group>
    </group>
  );
}