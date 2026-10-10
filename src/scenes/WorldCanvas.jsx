import { useRef, useEffect, useMemo } from "react";
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
  qr:      [0,   5.45, 0],
};
const WORLD_TARGET = [0, 0, 0];
const QR_TARGET = [0, -0.32, 0];
const QR_SIZE = 3.12;
const QR_BED_DEPTH = 0.08;
const QR_FRAME_WIDTH = 0.16;
const QR_FIELD_SCALE = 0.9;

// Transition durations (seconds)
const TRANSITION_DURATION = 1.8;

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
function TransitionRig({
  view,
  qrTexture,
  useLandscapeModules,
  onTransitionComplete,
  children,
}) {
  const { camera } = useThree();

  // One phase drives camera movement, world alignment, flattening and QR reveal.
  const phase   = useRef(view === "qr" ? 1.0 : 0.0);
  const pending = useRef(false);
  const worldRef = useRef();
  const qrRef = useRef();
  const qrMaterialRef = useRef();
  const qrFieldRef = useRef();
  const qrFrameRef = useRef();
  const qrFrameMaterials = useMemo(() => [
    new THREE.MeshBasicMaterial({
      color: "#795438",
      transparent: true,
      opacity: 0,
      toneMapped: false,
    }),
    new THREE.MeshBasicMaterial({
      color: "#347C3B",
      transparent: true,
      opacity: 0,
      toneMapped: false,
    }),
    new THREE.MeshBasicMaterial({
      color: "#D0EAC0",
      transparent: true,
      opacity: 0,
      toneMapped: false,
    }),
  ], []);
  const qrBedGeometry = useMemo(() => {
    const geometry = new THREE.BoxGeometry(QR_SIZE, QR_BED_DEPTH, QR_SIZE);
    geometry.groups.forEach((group, index) => {
      group.materialIndex = index === 2 ? 0 : 1;
    });
    return geometry;
  }, []);
  const qrBedMaterials = useMemo(() => [
    new THREE.MeshBasicMaterial({
      map: qrTexture,
      transparent: true,
      opacity: 0,
      toneMapped: false,
      depthWrite: false,
    }),
    new THREE.MeshBasicMaterial({
      color: "#795438",
      transparent: true,
      opacity: 0,
      toneMapped: false,
    }),
  ], [qrTexture]);

  useEffect(() => () => {
    qrFrameMaterials.forEach((material) => material.dispose());
    qrBedGeometry.dispose();
    qrBedMaterials.forEach((material) => material.dispose());
  }, [qrBedGeometry, qrBedMaterials, qrFrameMaterials]);

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

    if (goingToQR && ph < 1.0) {
      phase.current = Math.min(ph + delta / TRANSITION_DURATION, 1.0);
    } else if (goingToWorld && ph > 0) {
      phase.current = Math.max(ph - delta / TRANSITION_DURATION, 0.0);
    }

    const p = phase.current;
    const eased = easeInOut(p);

    camera.position.set(
      THREE.MathUtils.lerp(CAM.world[0], CAM.qr[0], eased),
      THREE.MathUtils.lerp(CAM.world[1], CAM.qr[1], eased),
      THREE.MathUtils.lerp(CAM.world[2], CAM.qr[2], eased)
    );
    const target = WORLD_TARGET.map((value, index) =>
      THREE.MathUtils.lerp(value, QR_TARGET[index], eased)
    );
    camera.up.set(0, Math.cos(eased * Math.PI / 2), -Math.sin(eased * Math.PI / 2));
    camera.lookAt(...target);

    if (worldRef.current) {
      worldRef.current.userData.transitionProgress = p;
      worldRef.current.userData.isQRView = p >= 0.95;
      worldRef.current.rotation.y = -Math.PI / 4 * eased;
      worldRef.current.scale.y = 1 - eased * 0.9;
      worldRef.current.position.y = QR_TARGET[1] * eased;
    }

    const qrOpacity = smoothstep(0.38, 0.88, eased);
    if (qrRef.current) {
      qrRef.current.visible = qrOpacity > 0.001;
    }
    if (qrMaterialRef.current) {
      qrMaterialRef.current.opacity = qrOpacity;
    }
    if (useLandscapeModules) {
      qrBedMaterials.forEach((material) => {
        material.opacity = qrOpacity;
      });
      qrFrameMaterials.forEach((material) => {
        material.opacity = qrOpacity;
      });
      if (qrFrameRef.current) {
        qrFrameRef.current.visible = qrOpacity > 0.001;
      }
    }
    if (worldRef.current) {
      worldRef.current.userData.qrProgress = eased;
    }

    const atRest = goingToQR ? p >= 1.0 : p <= 0.0;
    if (pending.current && atRest) {
      pending.current = false;
      onTransitionComplete?.();
    }
  });

  return (
    <>
      <group ref={worldRef}>
        {children}
      </group>
      {qrTexture && useLandscapeModules && (
        <group
          ref={qrFieldRef}
          position={[0, QR_TARGET[1] * (1 - QR_FIELD_SCALE), 0]}
          scale={QR_FIELD_SCALE}
        >
          <group ref={qrFrameRef} visible={false}>
            <mesh
              position={[0, QR_TARGET[1] - 0.06, 0]}
              material={qrFrameMaterials[0]}
            >
              <boxGeometry args={[QR_SIZE + 0.36, 0.12, QR_SIZE + 0.36]} />
            </mesh>
            {[
              [-QR_SIZE / 2 - 0.1, 0, [QR_FRAME_WIDTH, 0.04, QR_SIZE + 0.36]],
              [QR_SIZE / 2 + 0.1, 0, [QR_FRAME_WIDTH, 0.04, QR_SIZE + 0.36]],
              [0, -QR_SIZE / 2 - 0.1, [QR_SIZE + 0.36, 0.04, QR_FRAME_WIDTH]],
              [0, QR_SIZE / 2 + 0.1, [QR_SIZE + 0.36, 0.04, QR_FRAME_WIDTH]],
            ].map(([x, z, size], index) => (
              <mesh
                key={`berm-${index}`}
                position={[x, QR_TARGET[1] + 0.005, z]}
                material={qrFrameMaterials[1]}
              >
                <boxGeometry args={size} />
              </mesh>
            ))}
            {[
              [-QR_SIZE / 2 - 0.01, 0, [0.02, 0.018, QR_SIZE + 0.02]],
              [QR_SIZE / 2 + 0.01, 0, [0.02, 0.018, QR_SIZE + 0.02]],
              [0, -QR_SIZE / 2 - 0.01, [QR_SIZE + 0.02, 0.018, 0.02]],
              [0, QR_SIZE / 2 + 0.01, [QR_SIZE + 0.02, 0.018, 0.02]],
            ].map(([x, z, size], index) => (
              <mesh
                key={`channel-${index}`}
                position={[x, QR_TARGET[1] + 0.005, z]}
                material={qrFrameMaterials[2]}
              >
                <boxGeometry args={size} />
              </mesh>
            ))}
          </group>
          <mesh
            ref={qrRef}
            geometry={qrBedGeometry}
            material={qrBedMaterials}
            position={[0, QR_TARGET[1] - QR_BED_DEPTH / 2 + 0.025, 0]}
            renderOrder={1000}
            visible={false}
          />
        </group>
      )}
      {qrTexture && !useLandscapeModules && (
        <mesh
          ref={qrRef}
          position={[0, QR_TARGET[1] + 0.025, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={1000}
          visible={false}
        >
          <planeGeometry args={[QR_SIZE, QR_SIZE]} />
          <meshBasicMaterial
            ref={qrMaterialRef}
            map={qrTexture}
            transparent
            opacity={0}
            toneMapped={false}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      )}
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
  qrModules,
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
          useLandscapeModules={selectedTheme === "balete"}
          onTransitionComplete={onTransitionComplete}
        >
          <SceneComponent
            view={view}
            themeColors={theme.colors}
            qrModules={selectedTheme === "balete" ? qrModules : null}
          />
        </TransitionRig>

        <OrbitControls enabled={false} enablePan={false} enableZoom={false} target={WORLD_TARGET} />
      </Canvas>
    </div>
  );
}
