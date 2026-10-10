import { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import DiwataScene        from "./DiwataScene";
import MayonScene         from "./MayonScene";
import BahayKuboScene     from "./BahayKuboScene";
import BanaueRiceTerraces from "./BanaueRiceTerraces";
import ParolScene         from "./ParolScene";
import ElNidoScene        from "./ElNidoScene";
import { themes } from "../utils/themes";

// ─── camera positions ─────────────────────────────────────────────
const CAM = {
  world:   [1.2, 5.5, 7.5],
  topdown: [0,   8.8, 0.001],   // true top-down (tiny z prevents gimbal flip)
  qr:      [0,   0,   7],
};
const TARGET = [0, 0, 0];

// Transition durations (seconds)
const T_WORLD_TO_TOP = 1.4;   // angled → top-down sweep
const T_PAUSE_TOP    = 0.75;  // hold at top to reveal QR pattern
const T_TOP_TO_QR    = 0.9;   // top-down → flat QR slide
const T_QR_TO_WORLD  = 1.3;   // reverse: QR → world

const easeOut  = (t) => 1 - Math.pow(1 - t, 3);
const easeIn   = (t) => t * t * t;
const easeInOut = (t) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;

const smoothstep = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ─── TransitionRig ────────────────────────────────────────────────
//
//  view = "world":
//    Tap → camera arcs up to top-down (easeOut, T_WORLD_TO_TOP s),
//    pauses T_PAUSE_TOP s while the QR pattern is visible in the scene,
//    then automatically slides to the flat QR plane (easeIn, T_TOP_TO_QR s).
//    No second tap needed. onTransitionComplete fires when QR is fully visible.
//
//  view = "qr":
//    Tap → everything reverses: QR fades, camera returns to world angle.
//    onTransitionComplete fires when back at world.
//
function TransitionRig({ view, qrTexture, onTransitionComplete, children }) {
  const { camera, viewport } = useThree();

  // phase tracks the continuous internal animation:
  //   0.0  = world (resting)
  //   0.0→1.0 = sweep world→topdown  (phase A, T_WORLD_TO_TOP s)
  //   1.0  = pause at topdown        (phase B, T_PAUSE_TOP s)
  //   1.0→2.0 = slide topdown→qr    (phase C, T_TOP_TO_QR s)
  //   2.0  = QR (resting)
  //
  // Going back reverses: 2.0→0.0 in T_QR_TO_WORLD s (no topdown pause on return).

  const phase     = useRef(view === "qr" ? 2.0 : 0.0);
  const pauseAcc  = useRef(0);       // accumulator for the topdown pause
  const inPause   = useRef(false);
  const pending   = useRef(false);   // fires completion once per toggle

  const worldRef  = useRef();
  const qrRef     = useRef();

  // detect view change → arm the animation
  const prevView  = useRef(view);
  useEffect(() => {
    if (prevView.current !== view) {
      prevView.current = view;
      pending.current  = true;
      inPause.current  = false;
      pauseAcc.current = 0;
    }
  }, [view]);

  useEffect(() => {
    if (qrTexture) {
      qrTexture.colorSpace = THREE.SRGBColorSpace;
      qrTexture.needsUpdate = true;
    }
  }, [qrTexture]);

  useFrame((_, delta) => {
    const goingToQR   = view === "qr";
    const goingToWorld = view === "world";
    const ph = phase.current;

    // ── advance phase ────────────────────────────────────────────
    if (goingToQR) {
      if (ph < 1.0) {
        // Phase A: world → topdown
        phase.current = Math.min(ph + delta / T_WORLD_TO_TOP, 1.0);
      } else if (ph >= 1.0 && ph < 2.0) {
        // Phase B: pause at topdown, then phase C: topdown → qr
        if (!inPause.current) {
          inPause.current  = true;
          pauseAcc.current = 0;
        }
        if (pauseAcc.current < T_PAUSE_TOP) {
          pauseAcc.current += delta;
        } else {
          // Phase C kicks in
          inPause.current = false;
          phase.current = Math.min(ph + delta / T_TOP_TO_QR, 2.0);
        }
      }
    } else {
      // Going back to world — smooth single arc, skip topdown pause
      if (ph > 0) {
        phase.current = Math.max(ph - delta / T_QR_TO_WORLD, 0.0);
      }
    }

    const p = phase.current;

    // ── camera ───────────────────────────────────────────────────
    let cx, cy, cz;
    if (p <= 1.0) {
      // world → topdown
      const t = goingToQR ? easeOut(p) : easeOut(1 - p);  // always ease out arriving
      const e = goingToQR ? easeOut(p) : 1 - easeIn(1 - p);
      cx = THREE.MathUtils.lerp(CAM.world[0], CAM.topdown[0], e);
      cy = THREE.MathUtils.lerp(CAM.world[1], CAM.topdown[1], e);
      cz = THREE.MathUtils.lerp(CAM.world[2], CAM.topdown[2], e);
    } else {
      // topdown → qr  (p goes 1→2)
      const e = easeInOut((p - 1.0));
      cx = THREE.MathUtils.lerp(CAM.topdown[0], CAM.qr[0], e);
      cy = THREE.MathUtils.lerp(CAM.topdown[1], CAM.qr[1], e);
      cz = THREE.MathUtils.lerp(CAM.topdown[2], CAM.qr[2], e);
    }
    camera.position.set(cx, cy, cz);
    camera.lookAt(...TARGET);

    // ── 3-D world: sinks + fades only during phase C ─────────────
    if (worldRef.current) {
      // Only fade during the topdown→qr leg (p 1→2)
      const fadeT = smoothstep(1.0, 2.0, p);
      const eF    = easeInOut(fadeT);
      worldRef.current.scale.setScalar(1 - eF * 0.3);
      worldRef.current.position.y = -eF * 1.1;
      worldRef.current.rotation.y = eF * 0.4;
      worldRef.current.visible    = eF < 0.99;
    }

    // ── flat QR plane: fades in during phase C ───────────────────
    if (qrRef.current) {
      const q    = smoothstep(1.55, 2.0, p);   // starts fading after topdown pause
      const v    = viewport.getCurrentViewport(camera, [0, 0, 0]);
      const size = Math.min(v.width, v.height) * 0.82;
      qrRef.current.visible          = q > 0.003;
      qrRef.current.material.opacity = q;
      qrRef.current.scale.setScalar(size * (0.92 + 0.08 * q));
    }

    // ── completion ───────────────────────────────────────────────
    const atRest = goingToQR ? p >= 2.0 : p <= 0.0;
    if (pending.current && atRest) {
      pending.current = false;
      onTransitionComplete?.();
    }
  });

  return (
    <>
      <group ref={worldRef}>{children}</group>

      {/* Flat QR plane – faces camera at z=0 */}
      <mesh ref={qrRef} position={[0, 0, 0.5]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={qrTexture}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

// ─── scene registry ───────────────────────────────────────────────
const sceneComponents = {
  balete:        BanaueRiceTerraces,
  diwata:        DiwataScene,
  coral:         MayonScene,
  bahayKubo:     BahayKuboScene,
  coralKingdom:  ParolScene,
  elnido:        ElNidoScene,
};

// ─── WorldCanvas ─────────────────────────────────────────────────
export default function WorldCanvas({
  view,
  qrTexture,
  isTransitioning,
  onTransitionComplete,
  selectedTheme,
}) {
  const SceneComponent = sceneComponents[selectedTheme] || DiwataScene;
  const theme          = themes[selectedTheme] || themes.diwata;

  return (
    <div className="world-canvas">
      <Canvas
        shadows
        camera={{ position: CAM.world, fov: 36, near: 0.1, far: 100 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.60} color="#c3dfcf" />
        <hemisphereLight args={["#e4f1df", "#30241c", 0.9]} />
        <directionalLight
          position={[-4, 8, 5]} intensity={1.9} color="#ffe2b1" castShadow
          shadow-mapSize-width={1024} shadow-mapSize-height={1024}
          shadow-camera-near={0.5} shadow-camera-far={20}
          shadow-camera-left={-5} shadow-camera-right={5}
          shadow-camera-top={5}   shadow-camera-bottom={-5}
          shadow-bias={-0.0003}
        />
        <directionalLight position={[5, 4, -4]} intensity={0.7} color="#a0e5d1" />

        <TransitionRig
          view={view}
          qrTexture={qrTexture}
          onTransitionComplete={onTransitionComplete}
        >
          <SceneComponent
            view="world"
            qrTexture={qrTexture}
            isTransitioning={false}
            themeColors={theme.colors}
          />
        </TransitionRig>

        <OrbitControls enabled={false} enablePan={false} enableZoom={false} target={TARGET} />
      </Canvas>
    </div>
  );
}
