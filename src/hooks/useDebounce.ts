/* eslint-disable @typescript-eslint/no-explicit-any */

export function useDebounce(func: (...args: any[]) => void, delay: number) {
  let timeoutId: number;

  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}
