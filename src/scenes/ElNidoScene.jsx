import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/*
 * ElNidoScene – QR-as-Lagoon
 *
 * Same architecture as DiwataScene / SarimanokScene:
 *   • 25×25 QR module grid is the ground plane.
 *   • Dark modules = raised limestone terrain.
 *   • Three finder corners = Beach Hut / Palm Tree / Shell Garden.
 *   • FOCAL POINT: towering cliff formation with turquoise lagoon at centre.
 *   • Seagulls + water shimmer for coastal atmosphere.
 */

// ─── constants ────────────────────────────────────────────────────
const GRID   = 25;
const TILE   = 0.118;
const HALF   = (GRID * TILE) / 2;
const ROOT_Y = -0.45;

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

// ─── QR matrix ───────────────────────────────────────────────────
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
  const r  = Math.round(ar+(br-ar)*f);
  const g  = Math.round(ag+(bg-ag)*f);
  const bv = Math.round(ab+(bb-ab)*f);
  return `#${((r<<16)|(g<<8)|bv).toString(16).padStart(6,"0")}`;
}

// ─── theme colour resolver ────────────────────────────────────────
function resolveColors(theme = {}) {
  const brown     = theme.primary   || "#8b7355";
  const turquoise = theme.secondary || "#0891b2";
  const gold      = theme.accent    || "#fbbf24";
  const light     = theme.light     || "#e0f7fa";

  return {
    modDark:        brown,
    modDarkAlt:     darken(brown, 0.15),
    modLight:       light,
    base:           lighten(light, 0.06),
    soil:           darken(brown, 0.45),
    soilLight:      darken(brown, 0.30),
    gold,
    goldLight:      lighten(gold, 0.25),
    cliff:          darken(brown, 0.50),
    cliffLight:     lighten(brown, 0.20),
    stone:          "#6b5a4e",
    stoneLight:     "#9e8a7a",
    brownDark:      darken(brown, 0.40),
    brownLight:     lighten(brown, 0.15),
    turquoise,
    turquoiseDark:  darken(turquoise, 0.25),
    turquoiseLight: lighten(turquoise, 0.30),
    sand:           "#f5deb3",
    sandDark:       darken("#f5deb3", 0.20),
    water:          "#4fc3f7",
    white:          "#f8f8f8",
    green:          "#22c55e",
    greenDark:      darken("#22c55e", 0.35),
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
          h = H_FINDER; color = dark ? C.modDark : C.modLight;
        } else if (timing) {
          h = dark ? H_ACCENT : H_BASE; color = dark ? C.modDarkAlt : C.base;
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
      <Box pos={[0,-0.06,0]} size={[GRID*TILE+0.12,0.12,GRID*TILE+0.12]} color={C.base} shadow={false} />

      {Array.from({length:GRID*GRID},(_,i)=>{
        const x=i%GRID, z=Math.floor(i/GRID);
        const wx=(x-(GRID-1)/2)*TILE, wz=(z-(GRID-1)/2)*TILE;
        return (
          <Box key={`t${i}`} pos={[wx,H_BASE*0.5,wz]}
               size={[TILE*0.93,H_BASE,TILE*0.93]}
               color={(x+z)%7===0 ? darken(C.base,0.05) : C.base} shadow={false} />
        );
      })}

      {modules.filter(m=>m.h>H_BASE).map((m,i)=>(
        <Box key={`m${i}`} pos={[m.x,m.h*0.5,m.z]}
             size={[TILE*m.size,m.h,TILE*m.size]} color={m.color} />
      ))}

      {[
        [0,-0.09,-HALF-0.055,[GRID*TILE+0.2,0.09,0.10]],
        [0,-0.09, HALF+0.055,[GRID*TILE+0.2,0.09,0.10]],
        [-HALF-0.055,-0.09,0,[0.10,0.09,GRID*TILE]],
        [ HALF+0.055,-0.09,0,[0.10,0.09,GRID*TILE]],
      ].map(([x,y,z,s],i) => <Box key={`b${i}`} pos={[x,y,z]} size={s} color={C.soil} />)}

      <Box pos={[0,-0.18,0]} size={[GRID*TILE+0.16,0.12,GRID*TILE+0.16]} color={C.soilLight} />
      <Box pos={[0,-0.28,0]} size={[GRID*TILE+0.12,0.10,GRID*TILE+0.12]} color={C.soil} />

      {[[-HALF-0.035,-HALF-0.035],[HALF+0.035,-HALF-0.035],
        [-HALF-0.035,HALF+0.035],[HALF+0.035,HALF+0.035]].map(([x,z],i)=>(
        <Box key={`c${i}`} pos={[x,0.018,z]} size={[0.13,0.055,0.13]} color={C.gold} />
      ))}
    </group>
  );
}

// ─── CENTRE FOCAL POINT: Cliff Lagoon ────────────────────────────
function CliffLagoonCentre({ C }) {
  const waterRef = useRef();

  // FIX: pre-compute all random data outside JSX with stable seeds
  const cliffPlants = useMemo(() => {
    return [0,1,2,3,4].map(i => {
      const r = rng(2000 + i * 97);
      const size = 0.65 - i * 0.12;
      const count = Math.max(1, 4 - i);
      const plants = Array.from({ length: count }, () => ({
        x: (r() - 0.5) * (size / 2 - 0.05),
      }));
      return { size, plants };
    });
  }, []);

  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.material.emissiveIntensity =
        0.25 + Math.sin(clock.elapsedTime * 1.6) * 0.12;
    }
  });

  const baseY = H_DARK;

  return (
    <group position={[0, baseY, 0]}>

      {/* ── Tiered cliff formation ─────────────────────────────── */}
      {cliffPlants.map(({ size, plants }, i) => (
        <group key={i} position={[0, i * 0.15, 0]}>
          {/* Back cliff face */}
          <Box pos={[0, 0.30, -0.08]} size={[size, 0.55, 0.12]} color={C.cliff} />
          {/* Cliff cap */}
          <Box pos={[0, 0.58, -0.06]} size={[size, 0.08, 0.16]} color={C.cliffLight} />
          {/* Side faces for depth */}
          <Box pos={[-size/2+0.03, 0.30, 0.04]} size={[0.06, 0.50, 0.22]} color={C.brownDark} />
          <Box pos={[ size/2-0.03, 0.30, 0.04]} size={[0.06, 0.50, 0.22]} color={C.brownDark} />
          {/* Vegetation on top */}
          {plants.map((p, j) => (
            <group key={j} position={[p.x, 0.62, -0.04]}>
              <Box pos={[0,0.04,0]} size={[0.015,0.08,0.015]} color={C.brownDark} />
              <Cone pos={[0,0.10,0]} rTop={0} rBot={0.012} h={0.04} segs={4} color={C.green} />
            </group>
          ))}
        </group>
      ))}

      {/* ── Turquoise lagoon ──────────────────────────────────── */}
      <group position={[0, 0.04, 0.18]}>
        {/* Water surface – animated emissive */}
        <mesh ref={waterRef} position={[0, 0.005, 0]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[0.44, 0.38, 1, 1]} />
          <meshStandardMaterial
            color={C.turquoise}
            emissive={C.turquoise}
            emissiveIntensity={0.25}
            roughness={0.15}
            flatShading
          />
        </mesh>
        {/* Sandy bottom ring */}
        <Box pos={[0,-0.015,0]} size={[0.44,0.03,0.38]} color={C.sand} />
        {/* Shallow-water highlight strips */}
        {[[-0.14,0.08],[0.14,0.08],[-0.14,-0.08],[0.14,-0.08]].map(([dx,dz],i)=>(
          <Box key={i} pos={[dx,0.012,dz]} size={[0.055,0.008,0.04]}
               color={C.turquoiseLight} shadow={false} />
        ))}
        <pointLight position={[0, 0.4, 0]} color={C.turquoiseLight} intensity={1.0} distance={2.2} />
      </group>

      {/* ── Palm tree beside lagoon ───────────────────────────── */}
      <group position={[0.30, 0.04, 0.30]}>
        {/* Trunk – slightly leaning */}
        <Box pos={[0,0.18,0]} size={[0.038,0.36,0.038]} rot={[0,0,0.08]} color={C.brownDark} />
        <Box pos={[0.02,0.40,0]} size={[0.030,0.14,0.030]} rot={[0,0,0.12]} color={C.brownDark} />
        {/* Fronds */}
        {[0,1,2,3,4,5].map(i => {
          const a = (i/6)*Math.PI*2;
          return (
            <group key={i} position={[0.03,0.53,0]} rotation={[0,a,0.22]}>
              <Box pos={[0,0,0.10]} size={[0.018,0.008,0.14]} color={C.green} />
              <Box pos={[0,0.006,0.21]} size={[0.012,0.006,0.08]} color={lighten(C.green,0.2)} />
            </group>
          );
        })}
        {/* Base sand mound */}
        <Box pos={[0,0.015,0]} size={[0.12,0.03,0.12]} color={C.sand} />
      </group>

      {/* ── Small bangka (boat) on lagoon ─────────────────────── */}
      <group position={[-0.12, 0.055, 0.20]}>
        <Box pos={[0,0,0]}     size={[0.18,0.030,0.07]}  color={C.brownLight} />
        <Box pos={[0,0.022,0]} size={[0.15,0.016,0.055]} color={C.brownDark} />
        {/* Outrigger */}
        <Box pos={[0,0.010,-0.07]} size={[0.12,0.010,0.012]} color={C.brownDark} />
        <Box pos={[0,0.002,-0.085]} size={[0.08,0.010,0.020]} color={C.brownLight} />
        {/* Mast */}
        <Box pos={[0.01,0.10,0]}  size={[0.008,0.14,0.008]} color={C.brownDark} />
        {/* Sail */}
        <Box pos={[0.01,0.155,0]} size={[0.075,0.065,0.006]}
             rot={[0.25,0,0]} color={C.white} />
      </group>

      {/* ── Rocky outcrops in water ───────────────────────────── */}
      {[[-0.16,0.02,0.09],[0.18,0.02,0.25],[-0.05,0.02,0.35]].map(([x,y,z],i)=>(
        <group key={i} position={[x,y,z]}>
          <Box pos={[0,0.02,0]} size={[0.04+i*0.01,0.04,0.035+i*0.008]} color={C.stone} />
          <Box pos={[0,0.042,0]} size={[0.025,0.020,0.022]} color={C.stoneLight} />
        </group>
      ))}
    </group>
  );
}

// ─── Finder A: Beach Hut (top-left) ──────────────────────────────
function FinderBeachHut({ C }) {
  const cx = (3 - (GRID-1)/2) * TILE;
  const cz = (3 - (GRID-1)/2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      {/* Stilts */}
      {[[-0.05,-0.05],[0.05,-0.05],[-0.05,0.05],[0.05,0.05]].map(([dx,dz],i)=>(
        <Box key={i} pos={[dx,0.04,dz]} size={[0.018,0.09,0.018]} color={C.brownDark} />
      ))}
      {/* Platform floor */}
      <Box pos={[0,0.085,0]} size={[0.18,0.018,0.16]} color={C.brownLight} />
      {/* Walls */}
      <Box pos={[0,0.135,0.08]}   size={[0.16,0.09,0.016]} color={C.brownLight} />
      <Box pos={[0,0.135,-0.08]}  size={[0.16,0.09,0.016]} color={C.brownLight} />
      <Box pos={[-0.08,0.135,0]}  size={[0.016,0.09,0.16]} color={C.sandDark} />
      <Box pos={[0.08,0.135,0]}   size={[0.016,0.09,0.16]} color={C.sandDark} />
      {/* Thatched roof */}
      <Cone pos={[0,0.225,0]} rTop={0.01} rBot={0.115} h={0.08} segs={6} color={C.brownDark} />
      <Cone pos={[0,0.240,0]} rTop={0}    rBot={0.08}  h={0.05} segs={6}
            color={lighten(C.brownDark, 0.15)} />
      {/* Door opening */}
      <Box pos={[0.04,0.115,0.089]} size={[0.035,0.06,0.012]} color={C.brownDark} />
      {/* Lantern */}
      <GlowPx pos={[0,0.29,0]} color={C.gold} size={0.016} />
      <pointLight position={[cx,0.35,cz]} color={C.gold} intensity={0.6} distance={1.0} />
    </group>
  );
}

// ─── Finder B: Palm Tree Cluster (top-right) ─────────────────────
function FinderPalmTree({ C }) {
  const cx = (GRID-4 - (GRID-1)/2) * TILE;
  const cz = (3      - (GRID-1)/2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      {/* Main tall palm */}
      <Box pos={[0,0.22,0]} size={[0.036,0.44,0.036]} rot={[0,0,0.06]} color={C.brownDark} />
      {/* Fronds */}
      {[0,1,2,3,4,5].map(i => {
        const a = (i/6)*Math.PI*2;
        return (
          <group key={i} position={[0.01,0.44,0]} rotation={[0,a,0.18]}>
            <Box pos={[0,0,0.10]} size={[0.018,0.007,0.14]} color={C.green} />
            <Box pos={[0,0.005,0.20]} size={[0.012,0.005,0.08]}
                 color={lighten(C.green,0.18)} />
          </group>
        );
      })}
      {/* Coconuts */}
      {[-0.015,0,0.015].map((dx,i)=>(
        <Box key={i} pos={[dx+0.01,0.41,0.015]} size={[0.022,0.022,0.022]}
             color={C.brownLight} />
      ))}
      {/* Smaller leaning palm */}
      <Box pos={[0.08,0.14,-0.06]} size={[0.026,0.28,0.026]} rot={[0.1,0,-0.2]} color={C.brownDark} />
      {[0,1,2,3].map(i => {
        const a = (i/4)*Math.PI*2;
        return (
          <group key={i} position={[0.10,0.28,-0.07]} rotation={[0,a,0.22]}>
            <Box pos={[0,0,0.07]} size={[0.014,0.006,0.09]} color={C.green} />
          </group>
        );
      })}
      {/* Sand base */}
      <Box pos={[0,0.018,0]} size={[0.20,0.036,0.18]} color={C.sand} />
      <GlowPx pos={[0,0.52,0]} color={C.goldLight} size={0.016} />
      <pointLight position={[cx,0.45,cz]} color={C.gold} intensity={0.5} distance={0.9} />
    </group>
  );
}

// ─── Finder C: Shell Garden (bottom-left) ────────────────────────
function FinderShellCollection({ C }) {
  const cx = (3      - (GRID-1)/2) * TILE;
  const cz = (GRID-4 - (GRID-1)/2) * TILE;

  // FIX: pre-compute shell positions with stable seeds, not inline rng
  const shells = useMemo(() => {
    const r = rng(7777);
    return Array.from({ length: 8 }, (_, i) => ({
      dx: (r() - 0.5) * 0.13,
      dz: (r() - 0.5) * 0.13,
      color: i % 3 === 0 ? C.white : i % 3 === 1 ? C.turquoiseLight : C.sand,
      scale: 0.016 + r() * 0.010,
    }));
  }, [C]);

  const starfish = useMemo(() => {
    const r = rng(3344);
    return Array.from({ length: 2 }, () => ({
      dx: (r() - 0.5) * 0.10,
      dz: (r() - 0.5) * 0.10,
    }));
  }, []);

  return (
    <group position={[cx, H_FINDER, cz]}>
      {/* Sand base */}
      <Box pos={[0,0.018,0]} size={[0.22,0.036,0.20]} color={C.sand} />
      <Box pos={[0,0.038,0]} size={[0.16,0.012,0.14]} color={C.sandDark} />

      {/* Shells */}
      {shells.map((s, i) => (
        <group key={i} position={[s.dx, 0.05, s.dz]}>
          <Cone pos={[0,s.scale,0]} rTop={0} rBot={s.scale} h={s.scale*1.4} segs={5} color={s.color} />
          {i % 3 === 0 && <GlowPx pos={[0,s.scale*2.5,0]} color={C.goldLight} size={0.007} />}
        </group>
      ))}

      {/* Starfish */}
      {starfish.map((s, i) => (
        <group key={i} position={[s.dx, 0.045, s.dz]}>
          {/* 5 arms as thin boxes radiating out */}
          {[0,1,2,3,4].map(j => {
            const a = (j/5)*Math.PI*2;
            return (
              <Box key={j}
                   pos={[Math.cos(a)*0.018, 0, Math.sin(a)*0.018]}
                   size={[0.030,0.008,0.010]}
                   rot={[0,a,0]}
                   color={C.turquoise} />
            );
          })}
          <GlowPx pos={[0,0.015,0]} color={C.gold} size={0.010} />
        </group>
      ))}

      <GlowPx pos={[0,0.10,0]} color={C.goldLight} size={0.018} />
      <pointLight position={[cx,0.28,cz]} color={C.turquoiseLight} intensity={0.7} distance={1.0} />
    </group>
  );
}

// ─── Dark-module surface decor ────────────────────────────────────
function DarkModuleDecor({ matrix, C }) {
  // FIX: pre-compute decor data with stable seeds outside useMemo closure
  const shellColors = [C.white, C.turquoiseLight, C.sand];

  const items = useMemo(() => {
    const r = rng(9999);
    const out = [];   // FIX: was 'return items' (undefined) – now 'return out'
    for (let z = 0; z < GRID; z++)
      for (let x = 0; x < GRID; x++) {
        if (!matrix[z][x]) continue;
        if (isFinderZone(x,z)) continue;
        if (z===6||x===6) continue;
        // clear area around centre focal point
        const cx2 = Math.abs(x - (GRID-1)/2), cz2 = Math.abs(z - (GRID-1)/2);
        if (cx2 < 5 && cz2 < 5) continue;
        if (r() > 0.28) continue;
        const wx = (x-(GRID-1)/2)*TILE;
        const wz = (z-(GRID-1)/2)*TILE;
        const kind = Math.floor(r()*3);
        const seed = (x*31+z*17)|0;
        out.push({ x:wx, z:wz, kind, seed });
      }
    return out;  // FIX: was incorrectly 'return items'
  }, [matrix, C]);

  return (
    <group>
      {items.map((it, i) => {
        const r2 = rng(it.seed * 91);
        const y  = H_DARK;
        if (it.kind === 0) {
          // shell
          const s = 0.013 + r2() * 0.010;
          return (
            <group key={i} position={[it.x, y, it.z]}>
              <Cone pos={[0,s,0]} rTop={0} rBot={s} h={s*1.4} segs={5}
                    color={shellColors[i%3]} />
            </group>
          );
        } else if (it.kind === 1) {
          // rock / pebble
          const s = 0.014 + r2() * 0.014;
          return (
            <Box key={i} pos={[it.x,y+s*0.5,it.z]}
                 size={[s*1.2,s,s*1.1]} rot={[0,r2()*Math.PI,0]}
                 color={i%2 ? C.stone : C.stoneLight} />
          );
        } else {
          // small coastal plant
          const h = 0.016 + r2() * 0.018;
          return (
            <group key={i} position={[it.x, y, it.z]}>
              <Box pos={[0,h*0.5,0]} size={[0.008,h,0.008]} color={C.brownDark} />
              <Cone pos={[0,h+0.012,0]} rTop={0} rBot={0.010} h={0.022} segs={4} color={C.green} />
            </group>
          );
        }
      })}
    </group>
  );
}

// ─── Seagulls ────────────────────────────────────────────────────
// FIX: seagulls animate via position ref on the group, no broken children[0] access
function Seagulls({ C }) {
  const group = useRef();

  // FIX: pre-compute bird data with stable seed
  const birds = useMemo(() => {
    const r = rng(8888);
    return Array.from({ length: 10 }, (_, i) => ({
      base: [(r()-0.5)*2.6, 0.7+r()*1.0, (r()-0.5)*2.6],
      phase:     r() * Math.PI * 2,
      speed:     0.35 + r() * 0.45,
      wingPhase: r() * Math.PI * 2,
      size:      0.022 + r() * 0.014,
    }));
  }, []);

  // FIX: use per-child refs stored in array rather than children[0]
  const wingRefs = useRef(birds.map(() => ({ left: null, right: null })));

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;

    birds.forEach((b, i) => {
      const child = group.current.children[i];
      if (!child) return;

      child.position.set(
        b.base[0] + Math.sin(t * b.speed + b.phase) * 0.15,
        b.base[1] + Math.sin(t * b.speed * 1.2 + b.phase) * 0.06,
        b.base[2] + Math.cos(t * b.speed + b.phase) * 0.15,
      );

      // Wing flap: rotate the left/right wing children
      const flapAngle = Math.sin(t * 7 + b.wingPhase) * 0.28;
      // children[1] = left wing box, children[2] = right wing box
      if (child.children[1]) child.children[1].rotation.z =  0.1 + flapAngle;
      if (child.children[2]) child.children[2].rotation.z = -0.1 - flapAngle;
    });
  });

  return (
    <group ref={group}>
      {birds.map((b, i) => (
        <group key={i} position={b.base}>
          {/* Body  [0] */}
          <mesh material={mat(C.white)} castShadow>
            <boxGeometry args={[b.size, b.size*0.4, b.size*0.6]} />
          </mesh>
          {/* Left wing  [1] */}
          <mesh position={[-b.size*0.7,0,0]} material={mat(C.white)} castShadow>
            <boxGeometry args={[b.size*1.0, b.size*0.15, b.size*0.45]} />
          </mesh>
          {/* Right wing [2] */}
          <mesh position={[b.size*0.7,0,0]} material={mat(C.white)} castShadow>
            <boxGeometry args={[b.size*1.0, b.size*0.15, b.size*0.45]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Water shimmer particles ──────────────────────────────────────
function WaterShimmer({ C }) {
  const group = useRef();
  const pts = useMemo(() => {
    const r = rng(5577);
    return Array.from({ length: 20 }, () => ({
      base: [(r()-0.5)*GRID*TILE*0.65, (r()-0.5)*GRID*TILE*0.65],
      phase: r()*Math.PI*2,
      speed: 0.06 + r()*0.10,
      size:  0.09 + r()*0.16,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.children.forEach((m, i) => {
      const p = pts[i];
      m.position.set(
        p.base[0] + Math.sin(t*p.speed + p.phase)*0.14,
        0.04 + Math.sin(t*p.speed*0.8 + p.phase)*0.04,
        p.base[1] + Math.cos(t*p.speed + p.phase)*0.14,
      );
      if (m.material) m.material.opacity = 0.05 + Math.sin(t*0.5+p.phase)*0.04;
    });
  });

  return (
    <group ref={group}>
      {pts.map((p, i) => (
        <mesh key={i} position={[p.base[0], 0.04, p.base[1]]}>
          <sphereGeometry args={[p.size, 6, 6]} />
          <meshBasicMaterial color={C.turquoiseLight} transparent opacity={0.06} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Lighting ─────────────────────────────────────────────────────
function SceneLighting({ C }) {
  const sunRef = useRef();
  useFrame(({ clock }) => {
    if (sunRef.current)
      sunRef.current.intensity = 1.6 + Math.sin(clock.elapsedTime * 0.4) * 0.14;
  });

  return (
    <>
      <ambientLight intensity={0.95} color="#dff4f8" />
      <directionalLight ref={sunRef} position={[-2,7,4]} intensity={1.6}
                        color="#fffde7" castShadow
                        shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[3,4,-3]} intensity={0.6} color={lighten(C.green,0.3)} />
      <pointLight position={[0,2.2,0]}    color={C.gold}           intensity={0.9} distance={4.5} />
      <pointLight position={[0,0.8,0.2]}  color={C.turquoiseLight} intensity={0.6} distance={2.5} />
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────
export default function ElNidoScene({ themeColors: themeProp }) {
  const matrix = useMemo(buildMatrix, []);
  const C      = useMemo(() => resolveColors(themeProp), [themeProp]);

  return (
    <group position={[0, ROOT_Y, 0]} rotation={[0, Math.PI/4, 0]}>
      <SceneLighting C={C} />
      <QRGround matrix={matrix} C={C} />
      <CliffLagoonCentre C={C} />
      <FinderBeachHut C={C} />
      <FinderPalmTree C={C} />
      <FinderShellCollection C={C} />
      <DarkModuleDecor matrix={matrix} C={C} />
      <WaterShimmer C={C} />
      <Seagulls C={C} />
    </group>
  );
}
