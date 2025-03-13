export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  // type hijinks to make TypeScript happy
  const result: Pick<T, K> = {} as unknown as Pick<T, K>;
  keys.forEach((key) => {
    result[key] = obj[key];
  });
  return result;
}
