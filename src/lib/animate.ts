// Inspired by https://gist.github.com/addyosmani/5434533
// This fn is specialized to draw each row of the canvas
// as fast as possible, while also yielding to the event loop
// to prevent the browser from locking up.
export function limitLoop(
  fn: (py: number) => void,
  maxHeight: number,
  targetFps = 60,
  onDone?: () => void,
) {
  let py = 0;
  let done = false;
  let then = window.performance.now();

  const interval = 1000 / targetFps;

  loop(then);

  return stop;

  function stop() {
    done = true;
    if (onDone) {
      onDone();
    }
  }

  function loop(time: DOMHighResTimeStamp) {
    if (done) {
      return;
    }

    requestAnimationFrame(loop);

    const now = time;
    const delta = now - then;

    if (delta > interval) {
      // Update time
      then = now - (delta % interval);

      // Call the fn as many times as possible within the interval
      let elapsed = 0;
      // We need to call the fn at least once
      do {
        fn(py);
        py++;
        elapsed = window.performance.now() - now;
        if (py >= maxHeight) {
          return stop();
        }
      } while (elapsed < interval);
    }
  }
}
