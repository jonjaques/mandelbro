import queryString from "query-string";
import { type StateStorage } from "zustand/middleware";

export const hashStorage: StateStorage = {
  getItem: (key): string => {
    const searchParams = new URLSearchParams(location.hash.slice(1));
    const storedValue = searchParams.get(key) ?? "";
    return JSON.parse(storedValue);
  },
  setItem: (key, newValue): void => {
    const searchParams = new URLSearchParams(location.hash.slice(1));
    searchParams.set(key, JSON.stringify(newValue));
    location.hash = searchParams.toString();
  },
  removeItem: (key): void => {
    const searchParams = new URLSearchParams(location.hash.slice(1));
    searchParams.delete(key);
    location.hash = searchParams.toString();
  },
};

export const urlStorage: StateStorage = {
  // eslint-disable-next-line
  getItem: (): any => {
    const search = queryString.parse(location.search, {
      parseBooleans: true,
      parseNumbers: true,
    });
    return Object.keys(search).length !== 0
      ? { state: search, version: 0 }
      : null;
  },
  // eslint-disable-next-line
  setItem: (_, newValue: any): void => {
    const newSearch = queryString.stringify(newValue.state);
    history.replaceState(null, "", `?${newSearch}`);
  },
  removeItem: (): void => {},
};
