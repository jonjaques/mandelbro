import { useCallback, useEffect, useState } from "react";
import type { Favorite } from "@/lib/mandelbrot/favorites";
import { PRESET_FAVORITES } from "@/lib/mandelbrot/favorites";

const STORAGE_KEY = "mandelbro-favorites";

function loadUserFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Favorite[];
  } catch {
    return [];
  }
}

function saveUserFavorites(favorites: Favorite[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function useFavorites() {
  const [userFavorites, setUserFavorites] =
    useState<Favorite[]>(loadUserFavorites);

  useEffect(() => {
    saveUserFavorites(userFavorites);
  }, [userFavorites]);

  const addFavorite = useCallback((favorite: Favorite) => {
    setUserFavorites((prev) => [...prev, favorite]);
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setUserFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const renameFavorite = useCallback((id: string, name: string) => {
    setUserFavorites((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name } : f)),
    );
  }, []);

  return {
    presets: PRESET_FAVORITES,
    userFavorites,
    addFavorite,
    removeFavorite,
    renameFavorite,
  };
}
