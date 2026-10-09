import { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import BaleteScene        from "./BaleteScene";
import DiwataScene        from "./DiwataScene";
import SarimanokScene     from "./SarimanokScene";
import BahayKuboScene     from "./BahayKuboScene";
import MariaMakilingScene from "./MariaMakilingScene";
import CoralKingdomScene  from "./CoralKingdomScene";
import { themes } from "../utils/themes";

// ─── camera positions ─────────────────────────────────────────────
const CAM = {
  world: [1.2, 5.5, 7.5],
  qr:    [0,   0,   7],
};
const TARGET = [0, 0, 0];

// Transition duration (seconds) - same for both directions
const TRANSITION_TIME = 1.3;

const easeInOut = (t) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;

const smoothstep = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ─── TransitionRig ────────────────────────────────────────────────
//
//  Symmetric smooth transition for both directions:
//    world → qr: camera moves from angled to front-facing, world fades out, QR fades in
//    qr → world: everything reverses smoothly
//
function TransitionRig({ view, qrTexture, onTransitionComplete, children }) {
  const { camera, viewport } = useThree();

  // linear progress: 0 = world, 1 = qr
  const progress = useRef(view === "qr" ? 1.0 : 0.0);
  const pending  = useRef(false);

  const worldRef = useRef();
  const qrRef    = useRef();

  // detect view change → arm the animation
  const prevView = useRef(view);
  useEffect(() => {
    if (prevView.current !== view) {
      prevView.current = view;
      pending.current = true;
    }
  }, [view]);

  useEffect(() => {
    if (qrTexture) {
      qrTexture.colorSpace = THREE.SRGBColorSpace;
      qrTexture.needsUpdate = true;
    }
  }, [qrTexture]);

  useFrame((_, delta) => {
    const target = view === "qr" ? 1.0 : 0.0;
    const step = delta / TRANSITION_TIME;

    // Smoothly move progress toward target
    if (progress.current < target) {
      progress.current = Math.min(progress.current + step, target);
    } else if (progress.current > target) {
      progress.current = Math.max(progress.current - step, target);
    }

    const p = progress.current;
    const e = easeInOut(p);

    // ── camera: smooth direct transition ───────────────────────────
    camera.position.set(
      THREE.MathUtils.lerp(CAM.world[0], CAM.qr[0], e),
      THREE.MathUtils.lerp(CAM.world[1], CAM.qr[1], e),
      THREE.MathUtils.lerp(CAM.world[2], CAM.qr[2], e)
    );
    camera.lookAt(...TARGET);

    // ── 3-D world: fades out and sinks as we approach QR ─────────────
    if (worldRef.current) {
      worldRef.current.scale.setScalar(1 - e * 0.3);
      worldRef.current.position.y = -e * 1.1;
      worldRef.current.rotation.y = e * 0.4;
      worldRef.current.visible = e < 0.99;
    }

    // ── flat QR plane: fades in as we approach QR mode ───────────────
    if (qrRef.current) {
      const q = smoothstep(0.7, 1.0, p);
      const v = viewport.getCurrentViewport(camera, [0, 0, 0]);
      const size = Math.min(v.width, v.height) * 0.82;
      qrRef.current.visible = q > 0.003;
      qrRef.current.material.opacity = q;
      qrRef.current.scale.setScalar(size * (0.92 + 0.08 * q));
    }

    // ── completion ───────────────────────────────────────────────
    if (pending.current && progress.current === target) {
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
  balete:        BaleteScene,
  diwata:        DiwataScene,
  sarimanok:     SarimanokScene,
  bahayKubo:     BahayKuboScene,
  mariaMakiling: MariaMakilingScene,
  coralKingdom:  CoralKingdomScene,
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
