import { useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { useClipboardFeedback } from "@/hooks/use-clipboard-feedback";
import { Copy, Check, Share2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ANTIALIAS_MODES,
  COLOR_SCHEMES,
  type AntialiasMode,
  type AntialiasSamples,
  type ColorScheme,
  type ViewState,
} from "@/lib/mandelbrot/types";
import { COLOR_SCHEME_NAMES, getSwatchColors } from "@/lib/mandelbrot/colors";
import {
  autoIterations,
  resolveAntialiasSamples,
} from "@/lib/mandelbrot/compute";
import { formatCoord, formatZoom } from "@/lib/mandelbrot/format";
import type { Favorite } from "@/lib/mandelbrot/favorites";
import { FavoritesList } from "./FavoritesList";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getShareUrl: () => string;
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  onReset: () => void;
  presets: Favorite[];
  userFavorites: Favorite[];
  onNavigateToFavorite: (favorite: Favorite) => void;
  onRemoveFavorite: (id: string) => void;
  onRenameFavorite: (id: string, name: string) => void;
  wideGamut: boolean;
  wideGamutSupported: boolean;
  onWideGamutChange: (enabled: boolean) => void;
}

const SCHEMES = COLOR_SCHEMES;

function getAntialiasLabel(mode: AntialiasMode, zoom: number): string {
  if (mode === "auto") {
    return `Auto (${resolveAntialiasSamples(mode, zoom)} samples)`;
  }

  return mode === 1 ? "Off" : `${mode} samples`;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] uppercase tracking-widest text-white/40 font-medium">
      {children}
    </h3>
  );
}

function CoordinateRow({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useClipboardFeedback(1500);

  const handleCopy = useCallback(() => {
    copy(value);
    trackEvent("coordinates_copy", { label });
  }, [copy, value, label]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center justify-between gap-2 group w-full px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors text-left"
    >
      <span className="text-[11px] uppercase tracking-wider text-white/40 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono text-xs text-white/80 tabular-nums truncate">
          {value}
        </span>
        {copied ? (
          <Check className="size-3 text-green-400 shrink-0" />
        ) : (
          <Copy className="size-3 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </div>
    </button>
  );
}

function ColorSwatch({
  scheme,
  wideGamut,
}: {
  scheme: ColorScheme;
  wideGamut: boolean;
}) {
  const colors = getSwatchColors(scheme, wideGamut);
  return (
    <div className="flex gap-0.5">
      {colors.map((color, i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export function SettingsPanel({
  open,
  onOpenChange,
  getShareUrl,
  view,
  onViewChange,
  onReset,
  presets,
  userFavorites,
  onNavigateToFavorite,
  onRemoveFavorite,
  onRenameFavorite,
  wideGamut,
  wideGamutSupported,
  onWideGamutChange,
}: SettingsPanelProps) {
  const { copied: shareCopied, copy: copyShare } = useClipboardFeedback();

  const handleShare = useCallback(() => {
    copyShare(getShareUrl());
    trackEvent("share_url_copy");
  }, [copyShare, getShareUrl]);

  const isAuto = view.maxIter === autoIterations(view.zoom);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="glass text-white w-72 sm:w-80">
        <SheetHeader>
          <SheetTitle className="text-white">Settings</SheetTitle>
          <SheetDescription className="text-white/50">
            Adjust rendering parameters
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4 overflow-y-auto">
          {/* Position */}
          <div className="space-y-2">
            <SectionHeader>Position</SectionHeader>
            <div className="flex flex-col -mx-2">
              <CoordinateRow
                label="Re"
                value={formatCoord(view.centerX, view.centerXHp)}
              />
              <CoordinateRow
                label="Im"
                value={formatCoord(view.centerY, view.centerYHp)}
              />
              <CoordinateRow label="Zoom" value={formatZoom(view.zoom)} />
              <CoordinateRow label="Iter" value={String(view.maxIter)} />
            </div>
          </div>

          <div className="h-px bg-white/6" />

          {/* Favorites */}
          <div className="space-y-2">
            <SectionHeader>Favorites</SectionHeader>
            <FavoritesList
              presets={presets}
              userFavorites={userFavorites}
              onNavigate={onNavigateToFavorite}
              onRemove={onRemoveFavorite}
              onRename={onRenameFavorite}
            />
          </div>

          <div className="h-px bg-white/6" />

          {/* Rendering */}
          <div className="space-y-4">
            <SectionHeader>Rendering</SectionHeader>

            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium text-white/80">
                  Max Iterations
                </p>
                <span className="font-mono text-xs text-white/60 tabular-nums">
                  {view.maxIter}
                  {isAuto && <span className="text-white/30 ml-1">(auto)</span>}
                </span>
              </div>
              <Slider
                value={[view.maxIter]}
                min={50}
                max={10000}
                step={50}
                onValueCommit={([val]) => {
                  if (val === undefined) return;
                  trackEvent("iterations_change", { value: val });
                }}
                onValueChange={([val]) => {
                  if (val === undefined) return;
                  onViewChange({ ...view, maxIter: val });
                }}
              />
              <div className="flex justify-between text-[10px] text-white/30">
                <span>50</span>
                <span>10000</span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-white/80">Color Scheme</p>
              <Select
                value={view.colorScheme}
                onValueChange={(val: ColorScheme) => {
                  trackEvent("color_scheme_change", { scheme: val });
                  onViewChange({ ...view, colorScheme: val });
                }}
              >
                <SelectTrigger className="bg-white/10 border-white/8 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/90 backdrop-blur-md border-white/8">
                  {SCHEMES.map((scheme) => (
                    <SelectItem
                      key={scheme}
                      value={scheme}
                      className="text-white focus:bg-white/20 focus:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <ColorSwatch scheme={scheme} wideGamut={wideGamut} />
                        <span>{COLOR_SCHEME_NAMES[scheme]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-white/80">
                  Anti-Aliasing
                </p>
                <span className="font-mono text-xs text-white/60 tabular-nums">
                  {getAntialiasLabel(view.antialias, view.zoom)}
                </span>
              </div>
              <Select
                value={String(view.antialias)}
                onValueChange={(value) => {
                  trackEvent("antialias_change", { mode: value });
                  onViewChange({
                    ...view,
                    antialias:
                      value === "auto"
                        ? "auto"
                        : (Number(value) as AntialiasSamples),
                  });
                }}
              >
                <SelectTrigger className="bg-white/10 border-white/8 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/90 backdrop-blur-md border-white/8">
                  {ANTIALIAS_MODES.map((mode) => (
                    <SelectItem
                      key={String(mode)}
                      value={String(mode)}
                      className="text-white focus:bg-white/20 focus:text-white"
                    >
                      {mode === "auto"
                        ? "Auto"
                        : mode === 1
                          ? "Off"
                          : `${mode} samples`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="h-px bg-white/6" />

          {/* Display */}
          <div className="space-y-4">
            <SectionHeader>Display</SectionHeader>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white/80">
                    Wide Gamut
                  </p>
                  {wideGamutSupported && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border border-white/10 text-white/60">
                      P3
                    </span>
                  )}
                </div>
                <Switch
                  checked={wideGamut}
                  onCheckedChange={onWideGamutChange}
                  disabled={!wideGamutSupported}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-fuchsia-500 data-[state=checked]:to-cyan-500"
                />
              </div>
              {!wideGamutSupported && (
                <p className="text-[11px] text-white/30">
                  Not available on this display
                </p>
              )}
              {wideGamutSupported && (
                <p className="text-[11px] text-white/30">
                  Renders in the display-p3 color space for more vivid colors
                </p>
              )}
            </div>
          </div>

          <div className="h-px bg-white/6" />

          {/* Actions */}
          <div className="space-y-2">
            <SectionHeader>Actions</SectionHeader>
            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="outline"
                className="w-full border-white/8 text-white/80 hover:bg-white/10 hover:text-white"
                onClick={handleShare}
              >
                {shareCopied ? (
                  <Check className="size-4 mr-2 text-green-400" />
                ) : (
                  <Share2 className="size-4 mr-2" />
                )}
                {shareCopied ? "Copied!" : "Share View URL"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-white/50 hover:text-white hover:bg-white/10"
                onClick={onReset}
              >
                Reset to Default
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
