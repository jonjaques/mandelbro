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
    <div className="flex gap-px shrink-0">
      {colors.map((color, i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full"
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
    <div className="group flex items-center gap-2 rounded-md hover:bg-white/5 transition-colors px-2 py-1.5">
      <button
        type="button"
        className="flex-1 min-w-0 flex items-center gap-2 text-left"
        onClick={() => {
          onNavigate(favorite);
        }}
      >
        <MapPin className="size-3.5 text-white/40 shrink-0" />
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
                className="h-6 text-xs bg-white/10 border-white/8 text-white px-1.5 py-0"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-5 text-green-400 hover:text-green-300 shrink-0"
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
                className="size-5 text-white/40 hover:text-white shrink-0"
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
              <span className="text-xs text-white/80 block truncate">
                {favorite.name}
              </span>
              <span className="text-[10px] text-white/30 flex items-center gap-1.5">
                <MiniSwatch scheme={favorite.colorScheme} />
                {COLOR_SCHEME_NAMES[favorite.colorScheme]}
                {" · "}
                {formatMagnification(favorite.zoom)}
              </span>
            </>
          )}
        </div>
      </button>

      {!editing && !favorite.isPreset && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {onRename && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-white/30 hover:text-white hover:bg-white/10"
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
              className="size-6 text-white/30 hover:text-red-400 hover:bg-white/10"
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
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-white/30 px-2">
            Saved
          </p>
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

      <div className="space-y-0.5">
        <p className="text-[10px] uppercase tracking-wider text-white/30 px-2">
          Points of Interest
        </p>
        {presets.map((fav) => (
          <FavoriteItem key={fav.id} favorite={fav} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}
