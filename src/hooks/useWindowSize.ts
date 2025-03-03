import { useState, useLayoutEffect } from "react";

export default function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth || 0,
    height: window.innerHeight || 0,
  });

  useLayoutEffect(() => {
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return size;

  function handleResize() {
    setSize({ width: window.innerWidth, height: window.innerHeight });
  }
}
