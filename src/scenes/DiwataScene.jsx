import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/*
 * DiwataScene – QR-as-World
 *
 * The scene IS a QR code in 3D:
 *   • The 25 × 25 module grid is the ground plane.
 *   • Dark (true) modules are raised terrain blocks – forest patches,
 *     stone mounds, water pools – using the theme palette.
 *   • Light (false) modules are lower ground or gaps.
 *   • The three finder-pattern corners become distinct landmark clusters
 *     (a tree, a shrine, a spring) so they read clearly from above.
 *   • Animated elements (fireflies, mist, lanterns) float above without
 *     obscuring the top-down silhouette.
 *
 * From the side → immersive diorama.
 * From directly above → recognisable QR structure.
 */

// ─── constants ────────────────────────────────────────────────────
const GRID   = 25;          // modules per side
const TILE   =  0.118;      // world-units per module
const HALF   = (GRID * TILE) / 2;
const ROOT_Y = -0.45;

// module heights
const H_BASE    = 0.022;   // light module (ground surface)
const H_DARK    = 0.072;   // generic dark module
const H_FINDER  = 0.095;   // finder-pattern module
const H_ACCENT  = 0.055;   // timing-strip module

// ─── material cache ───────────────────────────────────────────────
const _mc = new Map();
function mat(color, roughness = 0.82, extra = {}) {
  const k = `${color}|${roughness}|${JSON.stringify(extra)}`;
  if (!_mc.has(k))
    _mc.set(k, new THREE.MeshStandardMaterial({ color, roughness, flatShading: true, ...extra }));
  return _mc.get(k);
}

// ─── seeded PRNG ──────────────────────────────────────────────────
function rng(seed) {
  let v = seed >>> 0;
  return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; };
}

// ─── QR matrix builder ────────────────────────────────────────────
function inFinder(x, z, ox, oz) {
  return x >= ox && x < ox + 7 && z >= oz && z < oz + 7;
}
function finderBit(x, z, ox, oz) {
  const dx = x - ox, dz = z - oz;
  const edge = Math.min(dx, dz, 6 - dx, 6 - dz);
  if (edge === 0) return true;
  if (edge === 1) return false;
  return true; // 3×3 centre always dark
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

  // stamp finder patterns
  for (const [ox,oz] of [[0,0],[GRID-7,0],[0,GRID-7]])
    for (let z = oz; z < oz+7; z++)
      for (let x = ox; x < ox+7; x++)
        m[z][x] = finderBit(x, z, ox, oz);

  return m;
}

// ─── geometry helpers ─────────────────────────────────────────────
function Box({ pos, size, color, rot = [0,0,0], shadow = true }) {
  return (
    <mesh position={pos} scale={size} rotation={rot}
          material={mat(color)} castShadow={shadow} receiveShadow>
      <boxGeometry args={[1,1,1]} />
    </mesh>
  );
}

function Sphere({ pos, r, color, detail = 0, squash = [1,1,1] }) {
  return (
    <mesh position={pos} scale={[r*squash[0], r*squash[1], r*squash[2]]}
          material={mat(color)} castShadow receiveShadow>
      <icosahedronGeometry args={[1, detail]} />
    </mesh>
  );
}

// ─── theme-aware colour resolver ──────────────────────────────────
// `theme` shape: { dark, light, primary, secondary, accent }
function themeColors(theme = {}) {
  const dark    = theme.dark    || "#1a472a";
  const light   = theme.light   || "#fef3c7";
  const primary = theme.primary || "#2d5a27";
  const accent  = theme.accent  || "#fbbf24";

  return {
    modDark:     dark,
    modDarkAlt:  primary,
    modLight:    light,
    base:        lighten(light, 0.12),
    soil:        darken(dark, 0.35),
    soilLight:   darken(dark, 0.2),
    gold:        accent,
    leaf:        mixHex(primary, "#4a7c3f", 0.5),
    leafLight:   mixHex(primary, "#7db05e", 0.5),
    leafDark:    darken(primary, 0.2),
    trunk:       darken(dark, 0.25),
    stone:       "#858779",
    stoneLight:  "#aaa993",
    water:       theme.secondary || "#5eead4",
    waterLight:  lighten(theme.secondary || "#5eead4", 0.25),
  };
}

function lighten(hex, f) { return blendHex(hex, "#ffffff", f); }
function darken(hex, f)  { return blendHex(hex, "#000000", f); }
function mixHex(a, b, f) { return blendHex(a, b, f); }
function blendHex(a, b, f) {
  const ah = parseInt(a.replace("#",""), 16);
  const bh = parseInt(b.replace("#",""), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r = Math.round(ar + (br-ar)*f);
  const g = Math.round(ag + (bg-ag)*f);
  const bv = Math.round(ab + (bb-ab)*f);
  return `#${((r<<16)|(g<<8)|bv).toString(16).padStart(6,"0")}`;
}

// ─── QR ground (the main grid) ────────────────────────────────────
function QRGround({ matrix, C }) {
  const modules = useMemo(() => {
    const items = [];
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const wx = (x - (GRID-1)/2) * TILE;
        const wz = (z - (GRID-1)/2) * TILE;
        const finder = isFinderZone(x, z);
        const timing = (z === 6 || x === 6) && !finder;
        const dark   = matrix[z][x];

        let h, color;
        if (finder) {
          h = H_FINDER;
          // differentiate finder modules: outer ring vs centre
          const dx = Math.min(x,GRID-1-x) < 7 ? (x < 7 ? x : GRID-1-x) : x - (GRID-7);
          const dz = Math.min(z,GRID-1-z) < 7 ? (z < 7 ? z : GRID-1-z) : z - (GRID-7);
          // simpler: just use dark/light
          color = dark ? C.modDark : C.modLight;
        } else if (timing) {
          h = dark ? H_ACCENT : H_BASE;
          color = dark ? C.modDarkAlt : C.base;
        } else {
          h = dark ? H_DARK : H_BASE;
          color = dark ? ((x+z)%4===0 ? C.modDarkAlt : C.modDark) : C.base;
        }

        items.push({ x: wx, z: wz, h, color, size: finder ? 0.96 : 0.9 });
      }
    }
    return items;
  }, [matrix, C]);

  return (
    <group>
      {/* backing slab */}
      <Box pos={[0,-0.06,0]} size={[GRID*TILE+0.12, 0.12, GRID*TILE+0.12]} color={C.base} shadow={false} />

      {/* pale tile grid */}
      {Array.from({length:GRID*GRID},(_,i) => {
        const x = i % GRID, z = Math.floor(i / GRID);
        const wx = (x-(GRID-1)/2)*TILE, wz = (z-(GRID-1)/2)*TILE;
        return (
          <Box key={`t${i}`} pos={[wx,H_BASE*0.5,wz]}
               size={[TILE*0.93,H_BASE,TILE*0.93]}
               color={(x+z)%7===0 ? darken(C.base,0.06) : C.base} shadow={false} />
        );
      })}

      {/* raised dark modules */}
      {modules.filter(m=>m.h > H_BASE).map((m,i) => (
        <Box key={`m${i}`} pos={[m.x, m.h*0.5, m.z]}
             size={[TILE*m.size, m.h, TILE*m.size]} color={m.color} />
      ))}

      {/* soil border */}
      {[
        [0,-0.09,-HALF-0.055,[GRID*TILE+0.2,0.09,0.10]],
        [0,-0.09, HALF+0.055,[GRID*TILE+0.2,0.09,0.10]],
        [-HALF-0.055,-0.09,0,[0.10,0.09,GRID*TILE]],
        [ HALF+0.055,-0.09,0,[0.10,0.09,GRID*TILE]],
      ].map(([x,y,z,s],i) => <Box key={`b${i}`} pos={[x,y,z]} size={s} color={C.soil} />)}

      {/* earth layers */}
      <Box pos={[0,-0.18,0]} size={[GRID*TILE+0.16,0.12,GRID*TILE+0.16]} color={C.soilLight} />
      <Box pos={[0,-0.28,0]} size={[GRID*TILE+0.12,0.10,GRID*TILE+0.12]} color={C.soil} />

      {/* accent corner dots */}
      {[[-HALF-0.035,-HALF-0.035],[HALF+0.035,-HALF-0.035],
        [-HALF-0.035,HALF+0.035],[HALF+0.035,HALF+0.035]].map(([x,z],i) => (
        <Box key={`c${i}`} pos={[x,0.018,z]} size={[0.13,0.055,0.13]} color={C.gold} />
      ))}
    </group>
  );
}

// ─── Finder Landmark A – Balete tree (top-left corner) ────────────
// Occupies the 7×7 finder zone at grid [0,0]
function FinderTree({ C }) {
  // Centre of top-left finder = offset (3,3) in grid → world:
  const cx = (3 - (GRID-1)/2) * TILE;   // ≈ -1.30
  const cz = (3 - (GRID-1)/2) * TILE;

  const canopyBlocks = useMemo(() => {
    const r = rng(42);
    return Array.from({length:18},(_,i)=>{
      const angle = (i/18)*Math.PI*2 + r()*0.3;
      const radius = 0.25 + r()*0.18;
      const layer  = Math.floor(r()*3);
      return {
        pos: [Math.cos(angle)*radius, 0.35+layer*0.18+r()*0.08, Math.sin(angle)*radius],
        r:   0.12+r()*0.09,
        color: [C.leafDark,C.leaf,C.leafLight][i%3],
      };
    });
  }, [C]);

  return (
    <group position={[cx, H_FINDER, cz]}>
      {/* trunk */}
      <Box pos={[0,0.22,0]} size={[0.10,0.44,0.09]} color={C.trunk} />
      <Box pos={[0,0.14,0]} size={[0.14,0.12,0.13]} color={C.trunk} />
      {/* roots */}
      {[0,1,2,3].map(i=>{
        const a=(i/4)*Math.PI*2;
        return <Box key={i} pos={[Math.cos(a)*0.12,0.06,Math.sin(a)*0.10]}
                    size={[0.04,0.05,0.10]} rot={[0,a,0.4]} color={C.trunk} />;
      })}
      {/* canopy */}
      {canopyBlocks.map((b,i)=>(
        <Sphere key={i} pos={b.pos} r={b.r} color={b.color} squash={[1.1,0.75,1.05]} />
      ))}
      {/* glow hollow */}
      <mesh position={[0.06,0.22,0.06]}>
        <boxGeometry args={[0.03,0.07,0.02]} />
        <meshBasicMaterial color={C.gold} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ─── Finder Landmark B – Sacred shrine (top-right finder) ─────────
// Grid origin top-right = [GRID-7, 0] → centre [GRID-4, 3]
function FinderShrine({ C }) {
  const cx = (GRID-4 - (GRID-1)/2) * TILE;
  const cz = (3    - (GRID-1)/2) * TILE;

  return (
    <group position={[cx, H_FINDER, cz]}>
      {/* stepped base */}
      <Box pos={[0,0.04,0]}   size={[0.28,0.08,0.24]} color={C.stone} />
      <Box pos={[0,0.10,0]}   size={[0.20,0.06,0.17]} color={C.stoneLight} />
      {/* pillar body */}
      <Box pos={[0,0.21,0]}   size={[0.07,0.18,0.07]} color={C.stone} />
      {/* torii crossbeam */}
      <Box pos={[0,0.32,0]}   size={[0.24,0.025,0.04]} color={C.modDark} />
      <Box pos={[0,0.30,0]}   size={[0.19,0.025,0.04]} color={C.modDark} />
      {/* glow crystals */}
      <GlowPx pos={[0,0.39,0]}   color={C.gold}       size={0.032} />
      <GlowPx pos={[-0.05,0.35,0]} color={C.waterLight} size={0.022} />
      <GlowPx pos={[0.05,0.34,0]}  color={C.waterLight} size={0.022} />
      {/* small flowers around base */}
      {[0,1,2,3].map(i=>{
        const a=(i/4)*Math.PI*2;
        return <SmallFlower key={i} pos={[Math.cos(a)*0.14,0.05,Math.sin(a)*0.12]} color={C.gold} C={C} />;
      })}
    </group>
  );
}

// ─── Finder Landmark C – Spring pool (bottom-left finder) ─────────
// Grid origin [0, GRID-7] → centre [3, GRID-4]
function FinderSpring({ C }) {
  const cx = (3       - (GRID-1)/2) * TILE;
  const cz = (GRID-4  - (GRID-1)/2) * TILE;
  const waterRef = useRef();

  useFrame(({clock}) => {
    if (waterRef.current)
      waterRef.current.material.emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime*1.4)*0.12;
  });

  return (
    <group position={[cx, H_FINDER, cz]}>
      {/* stone basin */}
      <Box pos={[0,0.04,0]} size={[0.30,0.07,0.28]} color={C.stone} />
      <Box pos={[0,0.08,0]} size={[0.22,0.04,0.20]} color={C.stoneLight} />
      {/* water disc */}
      <mesh ref={waterRef} position={[0,0.11,0]} rotation={[-Math.PI/2,0,0]}>
        <circleGeometry args={[0.09,8]} />
        <meshStandardMaterial color={C.water} emissive={C.water}
          emissiveIntensity={0.3} roughness={0.2} flatShading />
      </mesh>
      {/* stepping stones */}
      {[[-0.13,-0.09],[0.12,-0.08],[-0.09,0.13],[0.14,0.11]].map(([dx,dz],i)=>(
        <Box key={i} pos={[dx,0.09,dz]} size={[0.045,0.03,0.040]} color={i%2?C.stoneLight:C.stone} />
      ))}
      <GlowPx pos={[0,0.18,0]} color={C.waterLight} size={0.028} />
      <pointLight position={[cx,0.3,cz]} color={C.waterLight} intensity={0.8} distance={1.2} />
    </group>
  );
}

// ─── small reusable atoms ─────────────────────────────────────────
function GlowPx({ pos, color, size=0.04 }) {
  const ref = useRef();
  useFrame(({clock})=>{ if(ref.current) ref.current.scale.setScalar(0.85+Math.sin(clock.elapsedTime*2.2+pos[0])*0.15); });
  return (
    <mesh ref={ref} position={pos}>
      <boxGeometry args={[size,size,size]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function SmallFlower({ pos, color, C }) {
  return (
    <group position={pos}>
      <Box pos={[0,0.04,0]} size={[0.012,0.07,0.012]} color={C.leaf} />
      {[0,1,2,3].map(i=>{
        const a=(i/4)*Math.PI*2;
        return <Box key={i} pos={[Math.cos(a)*0.018,0.08,Math.sin(a)*0.018]}
                    size={[0.022,0.016,0.022]} color={color} />;
      })}
      <Box pos={[0,0.092,0]} size={[0.014,0.014,0.014]} color={C.gold} />
    </group>
  );
}

// ─── ambient scatter (dark-module overlays) ───────────────────────
// Tiny mushrooms, flowers, and stones scattered on dark modules
// that are NOT in finder zones – adds depth without changing silhouette.
function DarkModuleDecor({ matrix, C }) {
  const items = useMemo(() => {
    const r = rng(5551);
    const out = [];
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (!matrix[z][x]) continue;
        if (isFinderZone(x,z)) continue;
        if (z===6||x===6) continue;
        if (r() > 0.25) continue; // only 25 % of dark modules get decor
        const wx = (x-(GRID-1)/2)*TILE;
        const wz = (z-(GRID-1)/2)*TILE;
        const kind = Math.floor(r()*3); // 0=mushroom, 1=flower, 2=stone
        out.push({ x:wx, z:wz, kind, seed: (x*31+z*17)|0 });
      }
    }
    return out;
  }, [matrix, C]);

  return (
    <group>
      {items.map((it,i)=>{
        const r2 = rng(it.seed*91);
        const y = H_DARK;
        if (it.kind===0) {
          // mini mushroom
          const h = 0.022+r2()*0.028;
          const capC = [C.gold, C.waterLight, "#a78bfa", "#f472b6"][i%4];
          return (
            <group key={i} position={[it.x,y,it.z]}>
              <Box pos={[0,h*0.5,0]} size={[0.018,h,0.018]} color="#e5ddc5" />
              <Box pos={[0,h,0]} size={[0.030,0.016,0.030]} color={capC} />
              <GlowPx pos={[0,h+0.022,0]} color={capC} size={0.012} />
            </group>
          );
        } else if (it.kind===1) {
          return <SmallFlower key={i} pos={[it.x,y,it.z]} color={[C.gold,"#f472b6","#a78bfa"][i%3]} C={C} />;
        } else {
          // pebble
          return <Box key={i} pos={[it.x,y+(0.012+r2()*0.010),it.z]}
                      size={[0.028+r2()*0.018,0.018+r2()*0.012,0.025+r2()*0.018]}
                      color={i%2?C.stoneLight:C.stone} rot={[0,r2()*Math.PI,0]} />;
        }
      })}
    </group>
  );
}

// ─── Fireflies ────────────────────────────────────────────────────
function Fireflies({ C }) {
  const group = useRef();
  const flies = useMemo(()=>{
    const r = rng(427);
    const colors = [C.gold, C.waterLight, "#a78bfa", "#f472b6", C.leafLight];
    return Array.from({length:40},(_,i)=>({
      base:[(r()-0.5)*GRID*TILE*0.9, 0.3+r()*1.4, (r()-0.5)*GRID*TILE*0.9],
      phase:r()*Math.PI*2, speed:0.3+r()*1.1,
      color:colors[i%colors.length], size:0.010+r()*0.025,
      amp:0.04+r()*0.10,
    }));
  }, [C]);

  useFrame(({clock})=>{
    if(!group.current) return;
    const t = clock.elapsedTime;
    group.current.children.forEach((m,i)=>{
      const f=flies[i];
      m.position.set(
        f.base[0]+Math.sin(t*f.speed+f.phase)*f.amp,
        f.base[1]+Math.sin(t*f.speed*1.3+f.phase)*f.amp*0.7,
        f.base[2]+Math.cos(t*f.speed+f.phase)*f.amp,
      );
      if(m.material) m.material.opacity=0.55+Math.sin(t*2+f.phase)*0.45;
    });
  });

  return (
    <group ref={group}>
      {flies.map((f,i)=>(
        <mesh key={i} position={f.base}>
          <boxGeometry args={[f.size,f.size,f.size]} />
          <meshBasicMaterial color={f.color} toneMapped={false} transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Mist ─────────────────────────────────────────────────────────
function Mist() {
  const group = useRef();
  const pts = useMemo(()=>{
    const r=rng(999);
    return Array.from({length:25},()=>({
      base:[(r()-0.5)*GRID*TILE,(r()-0.5)*GRID*TILE],
      phase:r()*Math.PI*2, speed:0.07+r()*0.18,
      size:0.12+r()*0.22, drift:(r()-0.5)*0.015,
    }));
  },[]);
  useFrame(({clock})=>{
    if(!group.current) return;
    const t=clock.elapsedTime;
    group.current.children.forEach((m,i)=>{
      const p=pts[i];
      m.position.set(
        p.base[0]+Math.sin(t*p.speed+p.phase)*0.18+t*p.drift,
        0.12+Math.sin(t*p.speed*0.7+p.phase)*0.10,
        p.base[1]+Math.cos(t*p.speed+p.phase)*0.18,
      );
      if(m.material) m.material.opacity=0.06+Math.sin(t*0.4+p.phase)*0.04;
    });
  });
  return (
    <group ref={group}>
      {pts.map((p,i)=>(
        <mesh key={i} position={[p.base[0],0.12,p.base[1]]}>
          <sphereGeometry args={[p.size,6,6]} />
          <meshBasicMaterial color="#e8f4f8" transparent opacity={0.08} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Scene lighting ───────────────────────────────────────────────
function Lighting({ C }) {
  const warm = useRef();
  useFrame(({clock})=>{
    if(warm.current) warm.current.intensity=1.0+Math.sin(clock.elapsedTime*0.8)*0.1;
  });
  return (
    <>
      <ambientLight intensity={0.95} color={lighten(C.leaf,0.5)} />
      <directionalLight position={[-3,6,4]} intensity={1.9} color="#fff0d0" castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[3,4,-3]} intensity={0.7} color={lighten(C.water,0.3)} />
      <pointLight ref={warm} position={[-0.4,2.2,-0.7]} intensity={1.0} color={C.gold} distance={4.5} />
      <pointLight position={[0.7,1.1,0.6]} intensity={0.45} color={C.waterLight} distance={3} />
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────
export default function DiwataScene({ themeColors: themeProp }) {
  const matrix = useMemo(buildMatrix, []);
  const C = useMemo(() => themeColors(themeProp), [themeProp]);

  return (
    <group position={[0, ROOT_Y, 0]} rotation={[0, Math.PI/4, 0]}>
      <Lighting C={C} />

      {/* Ground: the QR grid */}
      <QRGround matrix={matrix} C={C} />

      {/* Finder pattern landmarks */}
      <FinderTree   C={C} />
      <FinderShrine C={C} />
      <FinderSpring C={C} />

      {/* Dark-module surface decorations */}
      <DarkModuleDecor matrix={matrix} C={C} />

      {/* Atmosphere */}
      <Mist />
      <Fireflies C={C} />
    </group>
  );
}
