import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import useRendererStore from "../stores/renderer";
import { DataTexture, RGBAFormat } from "three";
import { renderMandelbrotImageData } from "../lib/render";
import { MapControls, OrbitControls } from "@react-three/drei";

interface Props {
  width: number;
  height: number;
}

function createMandelbrotTexture(width: number, height: number) {
  const texture = new DataTexture(
    renderMandelbrotImageData(width, height), // Must be Uint8Array, not Uint8ClampedArray
    width,
    height,
    RGBAFormat,
  );
  texture.needsUpdate = true;
  return texture;
}

function MandelbrotPlane({ width, height }: { width: number; height: number }) {
  const texture = useMemo(
    () => createMandelbrotTexture(width, height),
    [width, height],
  );

  return (
    <mesh>
      <planeGeometry args={[width, height]} /> {/* Normalized plane [-1,1] */}
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

export default function FancyRenderer(props: Props) {
  const { width, height } = props;
  const renderDone = useRendererStore((state) => state.renderDone);

  return (
    <Canvas orthographic camera={{ zoom: 1, position: [0, 0, 10] }}>
      <OrbitControls
        enableRotate={false}
        onStart={(e) => console.log("start", e)}
        onEnd={(e) => console.log("end", e)}
      />
      {/* <CameraSync /> */}
      <MandelbrotPlane width={width} height={height} />
    </Canvas>
  );
}

function CameraSync() {
  const { camera } = useThree();
  // const setViewport = useYourZustandStore((s) => s.setViewport); // your action
  const last = useRef({ cx: 0, cy: 0, zoom: 0 });

  useFrame(() => {
    const zoom = camera.zoom;
    const scale = 3 / zoom;
    const cx = camera.position.x * scale;
    const cy = camera.position.y * scale;

    const hasChanged =
      Math.abs(cx - last.current.cx) > 1e-6 ||
      Math.abs(cy - last.current.cy) > 1e-6 ||
      Math.abs(zoom - last.current.zoom) > 1e-3;

    if (hasChanged) {
      last.current = { cx, cy, zoom };
      console.log("camera changed", camera.position, zoom);
      // Debounce or throttle this to avoid URL spam and expensive re-renders
      // setViewport({ cx, cy, zoom });
    }
  });

  return null;
}
