import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/*
 * CoralScene – QR-as-CoralReef
 *
 * Same architecture as other scenes:
 *   • 25×25 QR module grid forms the ground plane.
 *   • Dark modules = raised terrain in coral/ocean palette.
 *   • Three finder-pattern corners = distinct reef landmarks.
 *   • FOCAL POINT: central coral reef formation at world centre [0,0,0],
 *     with colorful corals, seaweed, and fish.
 *   • Ocean lighting + bubbles add underwater atmosphere.
 *
 * From the side  → vibrant coral reef as centrepiece.
 * From above     → recognisable QR pattern in coral/ocean colors.
 */

// ─── constants ────────────────────────────────────────────────────
const GRID    = 25;
const TILE    = 0.118;
const HALF    = (GRID * TILE) / 2;
const ROOT_Y  = -0.45;

const H_BASE   = 0.022;
const H_DARK   = 0.072;
const H_FINDER = 0.095;
const H_ACCENT = 0.055;

// ─── material cache ───────────────────────────────────────────────
const _mc = new Map();
function mat(color, roughness = 0.80, extra = {}) {
  const k = `${color}|${roughness}|${JSON.stringify(extra)}`;
  if (!_mc.has(k))
    _mc.set(k, new THREE.MeshStandardMaterial({ color, roughness, flatShading: true, ...extra }));
  return _mc.get(k);
}

// ─── seeded PRNG ─────────────────────────────────────────────────
function rng(seed) {
  let v = seed >>> 0;
  return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; };
}

// ─── QR matrix (same algorithm as other scenes) ───────────────────
function inFinder(x, z, ox, oz) {
  return x >= ox && x < ox + 7 && z >= oz && z < oz + 7;
}
function finderBit(x, z, ox, oz) {
  const dx = x - ox, dz = z - oz;
  const edge = Math.min(dx, dz, 6 - dx, 6 - dz);
  if (edge === 0) return true;
  if (edge === 1) return false;
  return true;
}
function isFinderZone(x, z) {
  return inFinder(x,z,0,0) || inFinder(x,z,GRID-7,0) || inFinder(x,z,0,GRID-7);
}
function buildMatrix() {
  const r = rng(7821);
  const m = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  for (let z = 0; z < GRID; z++)
    for (let x = 0; x < GRID; x++) {
      if (isFinderZone(x, z)) continue;
      if (z === 6 || x === 6) { m[z][x] = (x + z) % 2 === 0; continue; }
      const p = (x * 7 + z * 11 + x * z * 3) % 13;
      m[z][x] = p < 6 ? r() > 0.22 : r() > 0.73;
    }
  for (const [ox,oz] of [[0,0],[GRID-7,0],[0,GRID-7]])
    for (let z = oz; z < oz+7; z++)
      for (let x = ox; x < ox+7; x++)
        m[z][x] = finderBit(x, z, ox, oz);
  return m;
}

// ─── colour helpers ───────────────────────────────────────────────
function lighten(hex, f) { return blendHex(hex, "#ffffff", f); }
function darken(hex, f)  { return blendHex(hex, "#000000", f); }
function blendHex(a, b, f) {
  const ah = parseInt(a.replace("#",""), 16);
  const bh = parseInt(b.replace("#",""), 16);
  const ar = (ah>>16)&0xff, ag = (ah>>8)&0xff, ab = ah&0xff;
  const br = (bh>>16)&0xff, bg = (bh>>8)&0xff, bb = bh&0xff;
  const r = Math.round(ar+(br-ar)*f);
  const g = Math.round(ag+(bg-ag)*f);
  const bv = Math.round(ab+(bb-ab)*f);
  return `#${((r<<16)|(g<<8)|bv).toString(16).padStart(6,"0")}`;
}

// ─── theme colour resolver ────────────────────────────────────────
function resolveColors(theme = {}) {
  const coral   = theme.primary    || "#f472b6";
  const aqua    = theme.secondary  || "#0e5f76";
  const gold    = theme.accent     || "#fbbf24";
  const light   = theme.light      || "#e0fafa";

  return {
    modDark:    coral,
    modDarkAlt: darken(coral, 0.15),
    modLight:   light,
    base:       lighten(light, 0.06),
    soil:       darken(coral, 0.45),
    soilLight:  darken(coral, 0.30),
    gold,
    goldLight:  lighten(gold, 0.25),
    coralDark:  darken(coral, 0.40),
    coralLight: lighten(coral, 0.20),
    stone:      "#6b5a4e",
    stoneLight: "#9e8a7a",
    aqua,
    aquaDark:   darken(aqua, 0.35),
    aquaLight:  lighten(aqua, 0.25),
    teal:       "#0d9488",
    tealDark:   darken("#0d9488", 0.40),
    tealLight:  lighten("#0d9488", 0.25),
    ocean:      "#1e40af",
    oceanDark:  darken("#1e40af", 0.40),
    sand:       "#f5deb3",
    sandDark:   darken("#f5deb3", 0.20),
    water:      "#4fc3f7",
    waterLight: "#81d4fa",
    white:      "#ffffff",
    seaweed:    "#22c55e",
    seaweedDark: darken("#22c55e", 0.35),
  };
}

// ─── geometry atoms ───────────────────────────────────────────────
function Box({ pos, size, color, rot = [0,0,0], shadow = true }) {
  return (
    <mesh position={pos} scale={size} rotation={rot}
          material={mat(color)} castShadow={shadow} receiveShadow>
      <boxGeometry args={[1,1,1]} />
    </mesh>
  );
}

function Cone({ pos, rTop, rBot, h, segs = 6, color, rot = [0,0,0] }) {
  return (
    <mesh position={pos} rotation={rot} material={mat(color)} castShadow receiveShadow>
      <cylinderGeometry args={[rTop, rBot, h, segs]} />
    </mesh>
  );
}

function GlowPx({ pos, color, size = 0.04 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current)
      ref.current.scale.setScalar(0.82 + Math.sin(clock.elapsedTime * 2.4 + pos[0] * 3) * 0.18);
  });
  return (
    <mesh ref={ref} position={pos}>
      <boxGeometry args={[size, size, size]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

// ─── QR ground ───────────────────────────────────────────────────
function QRGround({ matrix, C }) {
  const modules = useMemo(() => {
    const items = [];
    for (let z = 0; z < GRID; z++)
      for (let x = 0; x < GRID; x++) {
        const wx = (x-(GRID-1)/2)*TILE;
        const wz = (z-(GRID-1)/2)*TILE;
        const finder = isFinderZone(x, z);
        const timing = (z===6||x===6) && !finder;
        const dark   = matrix[z][x];
        let h, color;
        if (finder) {
          h = H_FINDER;
          color = dark ? C.modDark : C.modLight;
        } else if (timing) {
          h = dark ? H_ACCENT : H_BASE;
          color = dark ? C.modDarkAlt : C.base;
        } else {
          h = dark ? H_DARK : H_BASE;
          color = dark ? ((x+z)%4===0 ? C.modDarkAlt : C.modDark) : C.base;
        }
        items.push({ x: wx, z: wz, h, color, size: finder ? 0.96 : 0.90 });
      }
    return items;
  }, [matrix, C]);

  return (
    <group>
      {/* backing slab */}
      <Box pos={[0,-0.06,0]} size={[GRID*TILE+0.12,0.12,GRID*TILE+0.12]} color={C.base} shadow={false} />

      {/* light tile grid */}
      {Array.from({length:GRID*GRID},(_,i)=>{
        const x=i%GRID, z=Math.floor(i/GRID);
        const wx=(x-(GRID-1)/2)*TILE, wz=(z-(GRID-1)/2)*TILE;
        return (
          <Box key={`t${i}`} pos={[wx,H_BASE*0.5,wz]}
               size={[TILE*0.93,H_BASE,TILE*0.93]}
               color={(x+z)%7===0 ? darken(C.base,0.05) : C.base} shadow={false} />
        );
      })}

      {/* raised dark modules */}
      {modules.filter(m=>m.h>H_BASE).map((m,i)=>(
        <Box key={`m${i}`} pos={[m.x,m.h*0.5,m.z]}
             size={[TILE*m.size,m.h,TILE*m.size]} color={m.color} />
      ))}

      {/* soil border */}
      {[
        [0,-0.09,-HALF-0.055,[GRID*TILE+0.2,0.09,0.10]],
        [0,-0.09, HALF+0.055,[GRID*TILE+0.2,0.09,0.10]],
        [-HALF-0.055,-0.09,0,[0.10,0.09,GRID*TILE]],
        [ HALF+0.055,-0.09,0,[0.10,0.09,GRID*TILE]],
      ].map(([x,y,z,s],i) => <Box key={`b${i}`} pos={[x,y,z]} size={s} color={C.soil} />)}

      <Box pos={[0,-0.18,0]} size={[GRID*TILE+0.16,0.12,GRID*TILE+0.16]} color={C.soilLight} />
      <Box pos={[0,-0.28,0]} size={[GRID*TILE+0.12,0.10,GRID*TILE+0.12]} color={C.soil} />

      {/* gold corner accents */}
      {[[-HALF-0.035,-HALF-0.035],[HALF+0.035,-HALF-0.035],
        [-HALF-0.035,HALF+0.035],[HALF+0.035,HALF+0.035]].map(([x,z],i)=>(
        <Box key={`c${i}`} pos={[x,0.018,z]} size={[0.13,0.055,0.13]} color={C.gold} />
      ))}
    </group>
  );
}

// ─── CENTRE FOCAL POINT: Coral Reef Formation ─────────────────────
// Sits at world origin [0,0,0] — vibrant coral reef
function CoralReefCentre({ C }) {
  const bubbleRefs = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    bubbleRefs.current.forEach((ref, i) => {
      if (ref) {
        const baseY = 0.1 + (i % 3) * 0.05;
        const cycle = (t * 0.5 + i * 0.2) % 2;
        ref.position.y = baseY + cycle * 0.3;
        ref.material.opacity = 0.5 + Math.sin(t * 3 + i) * 0.3;
      }
    });
  });

  const baseY = H_DARK;

  return (
    <group position={[0, baseY, 0]}>

      {/* ─── Central coral rock formation ──────────────────────────────── */}
      {[0,1,2,3].map(i => {
        const size = 0.5 - i * 0.08;
        return (
          <group key={i} position={[0, i * 0.12, 0]}>
            <Box pos={[0,0.25,0]} size={[size, 0.4, 0.12]} color={C.stone} />
            <Box pos={[0,0.48,0]} size={[size, 0.05, 0.14]} color={C.stoneLight} />
            {/* Coral clusters */}
            {(() => {
              const r = rng(2000 + i);
              const corals = [];
              for(let j=0; j<3-i; j++) {
                const x = (r()-0.5) * (size/2 - 0.05);
                corals.push(x);
              }
              return corals.map((px, j) => (
                <group key={j} position={[px, 0.53, 0.02]}>
                  <Cone pos={[0,0.03,0]} rTop={0} rBot={0.02} h={0.04} segs={5} color={C.coral} />
                  <Cone pos={[0,0.06,0]} rTop={0} rBot={0.012} h={0.03} segs={4} color={C.coralDark} />
                </group>
              ));
            })()}
          </group>
        );
      })}

      {/* ─── Water pool around reef ──────────────────────────────────── */}
      <group position={[0, 0.05, 0.2]}>
        <Box pos={[0,-0.02,0]} size={[0.45,0.04,0.45]} color={C.sand} />
        <Box pos={[0,0,0]} size={[0.4, 0.01, 0.4]} color={C.aqua} />
        {/* Bubbles */}
        {[0,1,2,3,4,5].map(i => {
          const a = (i/6)*Math.PI*2;
          const r = 0.15 + (i%3)*0.08;
          return (
            <mesh key={i} ref={el => { if(el) bubbleRefs.current[i] = el; }}
                  position={[Math.cos(a)*r, 0.1, Math.sin(a)*r]}>
              <sphereGeometry args={[0.015, 6, 6]} />
              <meshBasicMaterial color={C.waterLight} transparent opacity={0.5} toneMapped={false} />
            </mesh>
          );
        })}
      </group>

      {/* ─── Seaweed around reef ──────────────────────────────────────── */}
      {[0,1,2,3,4].map(i => {
        const a = (i/5)*Math.PI*2 + 0.3;
        const r = 0.4;
        return (
          <group key={i} position={[Math.cos(a)*r, 0.05, Math.sin(a)*r]}>
            <Box pos={[0,0.15,0]} size={[0.015,0.35,0.015]} color={C.seaweedDark} />
            {[0,1,2].map(j => (
              <Cone key={j} pos={[(j-1)*0.008,0.35+j*0.04,0]} rTop={0} rBot={0.008} h={0.04} segs={4} color={C.seaweed} />
            ))}
          </group>
        );
      })}

      {/* ─── Small fish swimming ──────────────────────────────────────── */}
      {[0,1,2].map(i => {
        const r = rng(5000 + i);
        const startX = (r()-0.5)*0.6;
        const startZ = (r()-0.5)*0.6;
        return (
          <group key={i} position={[startX, 0.15, startZ]}>
            <Box pos={[0,0,0]} size={[0.08,0.04,0.03]} color={C.teal} />
            <Cone pos={[0.06,0,0]} rTop={0} rBot={0.02} h={0.06} segs={4} color={C.tealDark} />
          </group>
        );
      })}

      {/* ─── Point light from reef ─────────────────────────────────────── */}
      <pointLight position={[0, 0.3, 0]} color={C.aquaLight} intensity={0.8} distance={2.0} />
    </group>
  );
}

// ─── Finder Landmark A: Coral Garden (top-left) ─────────────────────
function FinderCoralGarden({ C }) {
  const cx = (3 - (GRID-1)/2) * TILE;
  const cz = (3 - (GRID-1)/2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      {/* Rock base */}
      <Box pos={[0,0.02,0]} size={[0.18,0.04,0.18]} color={C.stone} />
      {/* Coral formations */}
      {[0,1,2,3].map(i => {
        const a = (i/4)*Math.PI*2;
        return (
          <group key={i} position={[Math.cos(a)*0.08, 0.04, Math.sin(a)*0.08]}>
            <Cone pos={[0,0.03,0]} rTop={0} rBot={0.02} h={0.05} segs={5} color={C.coral} />
            <Cone pos={[0,0.07,0]} rTop={0} rBot={0.012} h={0.04} segs={4} color={C.coralDark} />
          </group>
        );
      })}
      {/* Seaweed */}
      {[0,1].map(i => {
        const a = (i/2)*Math.PI + 0.5;
        return (
          <group key={i} position={[Math.cos(a)*0.1, 0.04, Math.sin(a)*0.1]}>
            <Box pos={[0,0.1,0]} size={[0.01,0.2,0.01]} color={C.seaweedDark} />
            <Cone pos={[0,0.22,0]} rTop={0} rBot={0.006} h={0.03} segs={4} color={C.seaweed} />
          </group>
        );
      })}
      <GlowPx pos={[0,0.12,0]} color={C.gold} size={0.015} />
      <pointLight position={[cx,0.3,cz]} color={C.gold} intensity={0.5} distance={0.9} />
    </group>
  );
}

// ─── Finder Landmark B: Shell Cluster (top-right) ─────────────────────
function FinderShellCluster({ C }) {
  const cx = (GRID-4 - (GRID-1)/2) * TILE;
  const cz = (3      - (GRID-1)/2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      {/* Sand base */}
      <Box pos={[0,0.02,0]} size={[0.16,0.04,0.16]} color={C.sand} />
      {/* Shells */}
      {[0,1,2,3,4,5].map(i => {
        const r = rng(7777);
        const dx = (r()-0.5)*0.1;
        const dz = (r()-0.5)*0.1;
        const color = i%2===0 ? C.white : C.coralLight;
        return (
          <group key={i} position={[dx, 0.05, dz]}>
            <Cone pos={[0,0.02,0]} rTop={0} rBot={0.015} h={0.025} segs={5} color={color} />
            <GlowPx pos={[0,0.05,0]} color={C.gold} size={0.006} />
          </group>
        );
      })}
      {/* Small coral */}
      <Cone pos={[0,0.04,0]} rTop={0} rBot={0.02} h={0.04} segs={5} color={C.coral} />
      <GlowPx pos={[0,0.09,0]} color={C.goldLight} size={0.018} />
      <pointLight position={[cx,0.3,cz]} color={C.gold} intensity={0.5} distance={0.8} />
    </group>
  );
}

// ─── Finder Landmark C: Sea Fan (bottom-left) ─────────────────────
function FinderSeaFan({ C }) {
  const cx = (3      - (GRID-1)/2) * TILE;
  const cz = (GRID-4 - (GRID-1)/2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      {/* Rock base */}
      <Box pos={[0,0.02,0]} size={[0.16,0.04,0.16]} color={C.stone} />
      {/* Sea fan - simplified using cones */}
      {[0,1,2,3,4,5,6,7].map(i => {
        const a = (i/8)*Math.PI*2;
        return (
          <Cone key={i} pos={[Math.cos(a)*0.06, 0.08, Math.sin(a)*0.06]} 
                 rTop={0} rBot={0.025} h={0.12} segs={4} color={C.coralLight} rot={[0.3,a,0]} />
        );
      })}
      {/* Center coral */}
      <Cone pos={[0,0.06,0]} rTop={0} rBot={0.02} h={0.06} segs={5} color={C.coral} />
      <GlowPx pos={[0,0.13,0]} color={C.gold} size={0.02} />
      <pointLight position={[cx,0.3,cz]} color={C.gold} intensity={0.6} distance={0.9} />
    </group>
  );
}

// ─── Dark-module surface decor ────────────────────────────────────
// Small corals, shells, seaweed
function DarkModuleDecor({ matrix, C }) {
  const items = useMemo(() => {
    const r = rng(9999);
    const out = [];
    for (let z = 0; z < GRID; z++)
      for (let x = 0; x < GRID; x++) {
        if (!matrix[z][x]) continue;
        if (isFinderZone(x,z)) continue;
        if (z===6||x===6) continue;
        // keep clear 3×3 around centre for reef
        const cx2 = Math.abs(x - (GRID-1)/2), cz2 = Math.abs(z - (GRID-1)/2);
        if (cx2 < 4 && cz2 < 4) continue;
        if (r() > 0.32) continue;
        const wx=(x-(GRID-1)/2)*TILE, wz=(z-(GRID-1)/2)*TILE;
        const kind = Math.floor(r()*3); // 0=coral, 1=shell, 2=seaweed
        out.push({ x:wx, z:wz, kind, seed:(x*31+z*17)|0 });
      }
    return items;
  }, [matrix, C]);

  return (
    <group>
      {items.map((it,i) => {
        const r2 = rng(it.seed*91);
        const y  = H_DARK;
        if (it.kind===0) {
          // coral
          return (
            <group key={i} position={[it.x, y, it.z]}>
              <Cone pos={[0,0.02,0]} rTop={0} rBot={0.012} h={0.03} segs={5} color={C.coral} />
              <Cone pos={[0,0.04,0]} rTop={0} rBot={0.008} h={0.025} segs={4} color={C.coralDark} />
            </group>
          );
        } else if (it.kind===1) {
          // shell
          const color = i%2===0 ? C.white : C.coralLight;
          return (
            <group key={i} position={[it.x, y, it.z]}>
              <Cone pos={[0,0.015,0]} rTop={0} rBot={0.01} h={0.02} segs={5} color={color} />
            </group>
          );
        } else {
          // seaweed
          return (
            <group key={i} position={[it.x, y, it.z]}>
              <Box pos={[0,0.02,0]} size={[0.008,0.04,0.008]} color={C.seaweedDark} />
              <Cone pos={[0,0.045,0]} rTop={0} rBot={0.006} h={0.03} segs={4} color={C.seaweed} />
            </group>
          );
        }
      })}
    </group>
  );
}

// ─── Bubbles / ocean particles ───────────────────────────────────
function OceanBubbles({ C }) {
  const group = useRef();
  const bubbles = useMemo(() => {
    const r = rng(8888);
    return Array.from({length:12}, (_,i) => ({
      base: [(r()-0.5)*2.5, 0.3+r()*0.8, (r()-0.5)*2.5],
      phase: r()*Math.PI*2,
      speed: 0.4+r()*0.6,
      color: i%2===0 ? C.waterLight : C.aquaLight,
      size: 0.012+r()*0.015,
    }));
  }, [C]);

  useFrame(({clock}) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.children.forEach((mesh,i) => {
      const b = bubbles[i];
      mesh.position.set(
        b.base[0] + Math.sin(t*b.speed+b.phase)*0.08,
        b.base[1] + Math.sin(t*b.speed*1.3+b.phase)*0.06,
        b.base[2] + Math.cos(t*b.speed+b.phase)*0.08
      );
      if (mesh.material) mesh.material.opacity = 0.5 + Math.sin(t*2+b.phase)*0.4;
    });
  });

  return (
    <group ref={group}>
      {bubbles.map((b,i) => (
        <mesh key={i} position={b.base}>
          <sphereGeometry args={[b.size, 6, 6]} />
          <meshBasicMaterial color={b.color} toneMapped={false} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Scene lighting ─────────────────────────────────────────────
function SceneLighting({ C }) {
  const oceanLight = useRef();
  useFrame(({clock}) => {
    if (oceanLight.current) {
      oceanLight.current.intensity = 1.0 + Math.sin(clock.elapsedTime*0.5)*0.15;
    }
  });

  return (
    <>
      <ambientLight intensity={0.9} color="#a8d8e0" />
      <directionalLight position={[-2,7,4]} intensity={2.0} color="#e0f7fa" castShadow
          shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[3,5,-4]} intensity={0.8} color="#7dd3fc" />
      <pointLight ref={oceanLight} position={[1, 3.0, 1]} color={C.aqua} intensity={1.2} distance={5.0} />
      <pointLight position={[0, 1.0, 0]} color={C.coralLight} intensity={0.5} distance={2.5} />
    </>
  );
}

// ─── Main scene ───────────────────────────────────────────────────
export default function CoralScene({ themeColors }) {
  const matrix = useMemo(buildMatrix, []);
  const C = useMemo(() => resolveColors(themeColors), [themeColors]);

  return (
    <group position={[0, ROOT_Y, 0]} rotation={[0, Math.PI/4, 0]}>
      <SceneLighting C={C} />
      <QRGround matrix={matrix} C={C} />
      <CoralReefCentre C={C} />
      <FinderCoralGarden C={C} />
      <FinderShellCluster C={C} />
      <FinderSeaFan C={C} />
      <DarkModuleDecor matrix={matrix} C={C} />
      <OceanBubbles C={C} />
    </group>
  );
}
