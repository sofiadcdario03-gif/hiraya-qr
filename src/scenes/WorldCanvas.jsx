import { useRef, useEffect, useLayoutEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import BaleteScene from "./BaleteScene";
import DiwataScene from "./DiwataScene";
import SarimanokScene from "./SarimanokScene";
import BahayKuboScene from "./BahayKuboScene";
import MariaMakilingScene from "./MariaMakilingScene";
import CoralKingdomScene from "./CoralKingdomScene";

const CAMERA_POSITIONS = {
  world: [0, 4, 7],
  qr: [0, 0, 7],
};
const CAMERA_TARGET = [0, 0, 0];
const TRANSITION_SECONDS = 1.25;

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const smoothstep = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// --------------------------------------------------
// ONE COORDINATED TRANSITION
//
// `linear` moves 0 -> 1 (world -> qr) or back at a constant
// rate, so reversing mid-flight is seamless. `e` is the eased
// value that drives every part of the animation.
// --------------------------------------------------

function TransitionRig({
  view,
  qrTexture,
  onTransitionComplete,
  environment,
  children,
}) {
  const { camera, viewport } = useThree();

  const linear = useRef(view === "qr" ? 1 : 0);
  const pending = useRef(false);
  const lastFade = useRef(-1);

  const envRef = useRef();
  const worldRef = useRef();
  const qrRef = useRef();
  const envMaterials = useRef([]);

  // A view change arms the completion callback
  const previousView = useRef(view);
  useEffect(() => {
    if (previousView.current !== view) {
      previousView.current = view;
      pending.current = true;
    }
  }, [view]);

  // Cache cube materials so we can fade them
  useLayoutEffect(() => {
    const list = [];
    envRef.current?.traverse((obj) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) =>
        list.push({
          material: m,
          opacity: m.opacity,
          transparent: m.transparent,
        })
      );
    });
    envMaterials.current = list;
  }, []);

  // QR texture must be sRGB and unlit to keep exact colors
  useEffect(() => {
    if (qrTexture) {
      qrTexture.colorSpace = THREE.SRGBColorSpace;
      qrTexture.needsUpdate = true;
    }
  }, [qrTexture]);

  useFrame((_, delta) => {
    const target = view === "qr" ? 1 : 0;
    const step = delta / TRANSITION_SECONDS;

    if (linear.current < target) {
      linear.current = Math.min(linear.current + step, target);
    } else if (linear.current > target) {
      linear.current = Math.max(linear.current - step, target);
    }

    const e = easeInOutCubic(linear.current);

    // ---- Camera: angled -> front-facing
    const from = CAMERA_POSITIONS.world;
    const to = CAMERA_POSITIONS.qr;
    camera.position.set(
      THREE.MathUtils.lerp(from[0], to[0], e),
      THREE.MathUtils.lerp(from[1], to[1], e),
      THREE.MathUtils.lerp(from[2], to[2], e)
    );
    camera.lookAt(...CAMERA_TARGET);

    // ---- Cube: slide down and fade out
    if (envRef.current) {
      envRef.current.position.y = -e * 1.2;
      envRef.current.visible = e < 0.995;

      if (Math.abs(lastFade.current - e) > 0.0005) {
        lastFade.current = e;
        const k = 1 - e;
        envMaterials.current.forEach((entry) => {
          entry.material.transparent = k < 1 || entry.transparent;
          entry.material.opacity = entry.opacity * k;
        });
      }
    }

    // ---- World: shrink, sink and turn away
    if (worldRef.current) {
      worldRef.current.scale.setScalar(1 - e * 0.4);
      worldRef.current.position.y = -e * 1.5;
      worldRef.current.rotation.y = e * 0.6;
      worldRef.current.visible = e < 0.995;
    }

    // ---- QR: fades in only once the camera is nearly in place
    if (qrRef.current) {
      const q = smoothstep(0.7, 1, e);
      const v = viewport.getCurrentViewport(camera, [0, 0, 0]);
      const size = Math.min(v.width, v.height) * 0.82;

      qrRef.current.visible = q > 0.003;
      qrRef.current.material.opacity = q;
      qrRef.current.scale.setScalar(size * (0.94 + 0.06 * q));
    }

    // ---- Completion callback (fires once per toggle)
    if (pending.current && linear.current === target) {
      pending.current = false;
      onTransitionComplete?.();
    }
  });

  return (
    <>
      <group ref={envRef}>{environment}</group>
      <group ref={worldRef}>{children}</group>

      {/* Camera looks down -z at the origin, so a plane at z=0 faces it */}
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

// --------------------------------------------------
// CUBE ENVIRONMENT (unchanged)
// --------------------------------------------------

function CubeEnvironment() {
  const trimMaterial = { color: "#b18a50", roughness: 0.48, metalness: 0.48 };
  const woodMaterial = { color: "#4a3025", roughness: 0.85 };

  const width = 4.8;
  const depth = 4.4;
  const floorY = -1.3;

  return (
    <group>
      {/* Floor removed for floating island look */}

      <pointLight
        position={[0, 1.8, -0.8]}
        color="#c2d8a0"
        intensity={0.65}
        distance={5}
      />
    </group>
  );
}

function BoxBeam({ position, size, material }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial {...material} />
    </mesh>
  );
}

function FloorTrim({ width, depth, y, material }) {
  const inset = 0.06;
  const thickness = 0.025;

  return (
    <group>
      <BoxBeam position={[0, y, -depth / 2 + inset]} size={[width - inset * 2, thickness, thickness]} material={material} />
      <BoxBeam position={[0, y, depth / 2 - inset]} size={[width - inset * 2, thickness, thickness]} material={material} />
      <BoxBeam position={[-width / 2 + inset, y, 0]} size={[thickness, thickness, depth - inset * 2]} material={material} />
      <BoxBeam position={[width / 2 - inset, y, 0]} size={[thickness, thickness, depth - inset * 2]} material={material} />
    </group>
  );
}

// --------------------------------------------------
// THEME SELECTOR
// --------------------------------------------------

const sceneComponents = {
  balete: BaleteScene,
  diwata: DiwataScene,
  sarimanok: SarimanokScene,
  bahayKubo: BahayKuboScene,
  mariaMakiling: MariaMakilingScene,
  coralKingdom: CoralKingdomScene,
};

// --------------------------------------------------
// WORLD CANVAS
// --------------------------------------------------

export default function WorldCanvas({
  view,
  qrTexture,
  isTransitioning,
  onTransitionComplete,
  selectedTheme,
}) {
  const SceneComponent = sceneComponents[selectedTheme] || BaleteScene;

  // NOTE: no more `if (view === 'qr') return null;`
  return (
    <div className="world-canvas">
      <Canvas
        shadows
        camera={{
          position: CAMERA_POSITIONS[view] || CAMERA_POSITIONS.world,
          fov: 38,
          near: 0.1,
          far: 100,
        }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.65} color="#c3dfcf" />
        <hemisphereLight args={["#e4f1df", "#30241c", 1.0]} />

        <directionalLight
          position={[-4, 8, 5]}
          intensity={2}
          color="#ffe2b1"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
          shadow-bias={-0.0003}
        />

        <directionalLight position={[5, 4, -4]} intensity={0.8} color="#a0e5d1" />

        <TransitionRig
          view={view}
          qrTexture={qrTexture}
          onTransitionComplete={onTransitionComplete}
          environment={<CubeEnvironment />}
        >
          {/* Scenes always get view="world"; the rig owns the transition */}
          <SceneComponent
            view="world"
            qrTexture={qrTexture}
            isTransitioning={false}
          />
        </TransitionRig>

        <OrbitControls
          enabled={false}
          enablePan={false}
          enableZoom={false}
          target={CAMERA_TARGET}
        />
      </Canvas>
    </div>
  );
}