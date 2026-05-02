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
import { cn } from "@/lib/utils";
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

function SectionHeader({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
        {children}
      </h3>
      {meta}
    </div>
  );
}

function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/8 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CoordinateTile({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useClipboardFeedback(1500);

  const handleCopy = useCallback(() => {
    copy(value);
    trackEvent("coordinates_copy", { label });
  }, [copy, value, label]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group flex min-h-20 w-full flex-col justify-between rounded-lg border border-white/8 bg-white/3 px-3 py-2.5 text-left transition-colors hover:bg-white/6"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-white/45">
          {label}
        </span>
        {copied ? (
          <Check className="size-3.5 shrink-0 text-green-400" />
        ) : (
          <Copy className="size-3.5 shrink-0 text-white/25 opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
      <span className="block break-all font-mono text-[13px] leading-5 text-white/85 tabular-nums">
        {value}
      </span>
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
          className="h-3 w-3 rounded-sm"
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
      <SheetContent
        side="right"
        className="glass w-88 border-white/10 p-0 text-white sm:w-[24rem]"
      >
        <SheetHeader className="gap-2 border-b border-white/8 px-5 py-4 text-left">
          <SheetTitle className="text-white">Settings</SheetTitle>
          <SheetDescription className="text-white/50">
            Adjust rendering parameters
          </SheetDescription>
          <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-white/55">
            <span className="rounded-full border border-white/8 bg-white/4 px-2 py-1 font-mono tabular-nums">
              {formatZoom(view.zoom)}
            </span>
            <span className="rounded-full border border-white/8 bg-white/4 px-2 py-1">
              {COLOR_SCHEME_NAMES[view.colorScheme]}
            </span>
            <span className="rounded-full border border-white/8 bg-white/4 px-2 py-1">
              {getAntialiasLabel(view.antialias, view.zoom)}
            </span>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <SectionHeader
              meta={
                <span className="text-[11px] text-white/30">Tap to copy</span>
              }
            >
              Position
            </SectionHeader>
            <SectionCard className="grid grid-cols-2 gap-2 p-2">
              <CoordinateTile
                label="Re"
                value={formatCoord(view.centerX, view.centerXHp)}
              />
              <CoordinateTile
                label="Im"
                value={formatCoord(view.centerY, view.centerYHp)}
              />
              <CoordinateTile label="Zoom" value={formatZoom(view.zoom)} />
              <CoordinateTile label="Iter" value={String(view.maxIter)} />
            </SectionCard>
          </div>

          <div className="space-y-2">
            <SectionHeader
              meta={
                <span className="text-[11px] text-white/30">
                  {userFavorites.length + presets.length} total
                </span>
              }
            >
              Favorites
            </SectionHeader>
            <SectionCard className="p-2">
              <FavoritesList
                presets={presets}
                userFavorites={userFavorites}
                onNavigate={onNavigateToFavorite}
                onRemove={onRemoveFavorite}
                onRename={onRenameFavorite}
              />
            </SectionCard>
          </div>

          <div className="space-y-2">
            <SectionHeader>Rendering</SectionHeader>
            <SectionCard className="space-y-4 p-3">
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-white/85">
                    Max Iterations
                  </p>
                  <span className="font-mono text-xs text-white/60 tabular-nums">
                    {view.maxIter}
                    {isAuto && (
                      <span className="ml-1 text-white/30">(auto)</span>
                    )}
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

              <div className="grid gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white/85">
                      Color Scheme
                    </p>
                    <ColorSwatch
                      scheme={view.colorScheme}
                      wideGamut={wideGamut}
                    />
                  </div>
                  <Select
                    value={view.colorScheme}
                    onValueChange={(val: ColorScheme) => {
                      trackEvent("color_scheme_change", { scheme: val });
                      onViewChange({ ...view, colorScheme: val });
                    }}
                  >
                    <SelectTrigger className="border-white/8 bg-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/8 bg-black/90 backdrop-blur-md">
                      {SCHEMES.map((scheme) => (
                        <SelectItem
                          key={scheme}
                          value={scheme}
                          className="text-white focus:bg-white/20 focus:text-white"
                        >
                          <div className="flex items-center gap-2">
                            <ColorSwatch
                              scheme={scheme}
                              wideGamut={wideGamut}
                            />
                            <span>{COLOR_SCHEME_NAMES[scheme]}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-white/85">
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
                    <SelectTrigger className="border-white/8 bg-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/8 bg-black/90 backdrop-blur-md">
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
            </SectionCard>
          </div>

          <div className="space-y-2">
            <SectionHeader>Display</SectionHeader>
            <SectionCard className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white/85">
                      Wide Gamut
                    </p>
                    {wideGamutSupported && (
                      <span className="rounded-full border border-white/10 bg-linear-to-r from-fuchsia-500/20 to-cyan-500/20 px-1.5 py-0.5 font-mono text-[10px] text-white/60">
                        P3
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] leading-4 text-white/35">
                    {wideGamutSupported
                      ? "Render in display-p3 for more vivid colors."
                      : "Not available on this display."}
                  </p>
                </div>
                <Switch
                  checked={wideGamut}
                  onCheckedChange={onWideGamutChange}
                  disabled={!wideGamutSupported}
                  className="data-[state=checked]:bg-linear-to-r data-[state=checked]:from-fuchsia-500 data-[state=checked]:to-cyan-500"
                />
              </div>
            </SectionCard>
          </div>

          <div className="space-y-2">
            <SectionHeader>Actions</SectionHeader>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="border-white/8 text-white/80 hover:bg-white/10 hover:text-white"
                onClick={handleShare}
              >
                {shareCopied ? (
                  <Check className="mr-2 size-4 text-green-400" />
                ) : (
                  <Share2 className="mr-2 size-4" />
                )}
                {shareCopied ? "Copied" : "Share URL"}
              </Button>
              <Button
                variant="ghost"
                className="text-white/55 hover:bg-white/10 hover:text-white"
                onClick={onReset}
              >
                Reset View
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
