import { useState, useLayoutEffect } from "react";
import { useDebounce } from "./useDebounce";

export default function useWindowSize(
  pixelRatio = window.devicePixelRatio,
  onResize?: () => void,
  onResizeDebounce = 250,
) {
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

  if (onResize) {
    const debouncedOnResize = useDebounce(onResize, onResizeDebounce);
    useLayoutEffect(() => {
      window.addEventListener("resize", debouncedOnResize);
      return () => window.removeEventListener("resize", debouncedOnResize);
    }, []);
  }

  function updateSize() {
    setSize([window.innerWidth * ratio, window.innerHeight * ratio]);
  }

  return size;
}
