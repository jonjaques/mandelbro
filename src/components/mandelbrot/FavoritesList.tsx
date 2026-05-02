import { useCallback, useRef, useState } from "react";
import { MapPin, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Favorite } from "@/lib/mandelbrot/favorites";
import { formatMagnification } from "@/lib/mandelbrot/format";
import { COLOR_SCHEME_NAMES, getSwatchColors } from "@/lib/mandelbrot/colors";

interface FavoritesListProps {
  presets: Favorite[];
  userFavorites: Favorite[];
  onNavigate: (favorite: Favorite) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

function MiniSwatch({ scheme }: { scheme: Favorite["colorScheme"] }) {
  const colors = getSwatchColors(scheme);
  return (
    <div className="flex shrink-0 gap-px">
      {colors.map((color, i) => (
        <div
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

function FavoriteItem({
  favorite,
  onNavigate,
  onRemove,
  onRename,
}: {
  favorite: Favorite;
  onNavigate: (favorite: Favorite) => void;
  onRemove?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(favorite.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = useCallback(() => {
    setEditName(favorite.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [favorite.name]);

  const handleConfirmEdit = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== favorite.name) {
      onRename?.(favorite.id, trimmed);
    }
    setEditing(false);
  }, [editName, favorite.id, favorite.name, onRename]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setEditName(favorite.name);
  }, [favorite.name]);

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:border-white/6 hover:bg-white/4">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        onClick={() => {
          onNavigate(favorite);
        }}
      >
        <MapPin className="mt-0.5 size-3.5 shrink-0 text-white/35" />
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                ref={inputRef}
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmEdit();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="h-6 border-white/8 bg-white/10 px-1.5 py-0 text-xs text-white"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-5 shrink-0 text-green-400 hover:text-green-300"
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmEdit();
                }}
              >
                <Check className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-5 shrink-0 text-white/40 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="block truncate text-[13px] leading-5 text-white/85">
                  {favorite.name}
                </span>
                {favorite.isPreset && (
                  <span className="rounded-full border border-white/8 bg-white/4 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-white/35">
                    Preset
                  </span>
                )}
              </div>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-4 text-white/35">
                <MiniSwatch scheme={favorite.colorScheme} />
                <span>{COLOR_SCHEME_NAMES[favorite.colorScheme]}</span>
                <span className="text-white/20">•</span>
                <span className="font-mono tabular-nums">
                  {formatMagnification(favorite.zoom)}
                </span>
              </span>
            </>
          )}
        </div>
      </button>

      {!editing && !favorite.isPreset && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onRename && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-white/30 hover:bg-white/10 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                handleStartEdit();
              }}
            >
              <Pencil className="size-3" />
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-white/30 hover:bg-white/10 hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(favorite.id);
              }}
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-1 pb-1">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">
        {label}
      </p>
      <span className="rounded-full border border-white/8 bg-white/4 px-1.5 py-0.5 text-[10px] text-white/35">
        {count}
      </span>
    </div>
  );
}

export function FavoritesList({
  presets,
  userFavorites,
  onNavigate,
  onRemove,
  onRename,
}: FavoritesListProps) {
  return (
    <div className="space-y-3">
      {userFavorites.length > 0 && (
        <div className="space-y-1">
          <GroupHeader label="Saved" count={userFavorites.length} />
          {userFavorites.map((fav) => (
            <FavoriteItem
              key={fav.id}
              favorite={fav}
              onNavigate={onNavigate}
              onRemove={onRemove}
              onRename={onRename}
            />
          ))}
        </div>
      )}

      <div className="space-y-1">
        <GroupHeader label="Points of Interest" count={presets.length} />
        {presets.map((fav) => (
          <FavoriteItem key={fav.id} favorite={fav} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}
