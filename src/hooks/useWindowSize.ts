import { useState, useLayoutEffect } from "react";

export default function useWindowSize(pixelRatio = window.devicePixelRatio) {
  const ratio = Math.round(pixelRatio) || 1;
  const [size, setSize] = useState([
    window.innerWidth * ratio,
    window.innerHeight * ratio,
  ]);

  useLayoutEffect(() => {
    window.addEventListener("resize", updateSize);
    updateSize();
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  function updateSize() {
    setSize([window.innerWidth * ratio, window.innerHeight * ratio]);
  }

  return size;
}
