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
const T_WORLD_TO_QR  = 2.5;   // continuous world → topdown → QR transformation
const T_QR_TO_WORLD  = 2.0;   // reverse: QR → world

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
//    Tap → camera smoothly animates to top-down view (T_WORLD_TO_QR s)
//    During animation, the world scene transforms into QR pattern
//    No pause, no separate QR plane - continuous transformation
//    onTransitionComplete fires when fully at QR view
//
//  view = "qr":
//    Tap → reverse: QR transforms back to world, camera returns
//    onTransitionComplete fires when back at world
//
function TransitionRig({ view, onTransitionComplete, children }) {
  const { camera } = useThree();

  // Single phase 0→1 for continuous animation:
  //   0.0 = world (resting)
  //   0.0→1.0 = world → topdown + QR transformation
  //   1.0 = QR (resting)
  const phase   = useRef(view === "qr" ? 1.0 : 0.0);
  const pending = useRef(false);
  const worldRef = useRef();

  // detect view change → arm the animation
  const prevView = useRef(view);
  useEffect(() => {
    if (prevView.current !== view) {
      prevView.current = view;
      pending.current = true;
    }
  }, [view]);

  useFrame((_, delta) => {
    const goingToQR   = view === "qr";
    const goingToWorld = view === "world";
    const ph = phase.current;

    // ── advance phase ────────────────────────────────────────────
    if (goingToQR && ph < 1.0) {
      phase.current = Math.min(ph + delta / T_WORLD_TO_QR, 1.0);
    } else if (goingToWorld && ph > 0) {
      phase.current = Math.max(ph - delta / T_QR_TO_WORLD, 0.0);
    }

    const p = phase.current;

    // ── camera: world → topdown throughout animation ─────────────
    const e = goingToQR ? easeInOut(p) : easeInOut(1 - p);
    camera.position.x = THREE.MathUtils.lerp(CAM.world[0], CAM.topdown[0], e);
    camera.position.y = THREE.MathUtils.lerp(CAM.world[1], CAM.topdown[1], e);
    camera.position.z = THREE.MathUtils.lerp(CAM.world[2], CAM.topdown[2], e);
    camera.lookAt(...TARGET);

    // ── world scene: pass transition progress to children ─────────
    if (worldRef.current) {
      worldRef.current.userData.transitionProgress = p;
      worldRef.current.userData.isQRView = goingToQR && p >= 0.95;
    }

    // ── completion ───────────────────────────────────────────────
    const atRest = goingToQR ? p >= 1.0 : p <= 0.0;
    if (pending.current && atRest) {
      pending.current = false;
      onTransitionComplete?.();
    }
  });

  return <group ref={worldRef}>{children}</group>;
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
          onTransitionComplete={onTransitionComplete}
        >
          <SceneComponent
            view={view}
            themeColors={theme.colors}
          />
        </TransitionRig>

        <OrbitControls enabled={false} enablePan={false} enableZoom={false} target={TARGET} />
      </Canvas>
    </div>
  );
}
