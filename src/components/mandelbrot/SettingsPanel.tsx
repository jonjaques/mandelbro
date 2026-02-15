import { useCallback, useRef, useState } from "react";
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
import type { ColorScheme, ViewState } from "@/lib/mandelbrot/types";
import { COLOR_SCHEME_NAMES, getSwatchColors } from "@/lib/mandelbrot/colors";
import { autoIterations } from "@/lib/mandelbrot/compute";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  onReset: () => void;
}

const SCHEMES = Object.keys(COLOR_SCHEME_NAMES) as ColorScheme[];

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] uppercase tracking-widest text-white/40 font-medium">
      {children}
    </h3>
  );
}

function CoordinateRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setCopied(false), 1500);
  }, [value]);

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

function ColorSwatch({ scheme }: { scheme: ColorScheme }) {
  const colors = getSwatchColors(scheme);
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

function formatCoord(n: number): string {
  if (Math.abs(n) < 0.0001) return n.toExponential(6);
  return n.toPrecision(12);
}

function formatZoom(zoom: number): string {
  const magnification = 3.5 / zoom;
  if (magnification >= 1e6) return magnification.toExponential(2) + "x";
  if (magnification >= 1000)
    return Math.round(magnification).toLocaleString() + "x";
  return magnification.toFixed(1) + "x";
}

export function SettingsPanel({
  open,
  onOpenChange,
  view,
  onViewChange,
  onReset,
}: SettingsPanelProps) {
  const [shareCopied, setShareCopied] = useState(false);
  const shareTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    if (shareTimeout.current) clearTimeout(shareTimeout.current);
    shareTimeout.current = setTimeout(() => setShareCopied(false), 2000);
  }, []);

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
              <CoordinateRow label="Re" value={formatCoord(view.centerX)} />
              <CoordinateRow label="Im" value={formatCoord(view.centerY)} />
              <CoordinateRow label="Zoom" value={formatZoom(view.zoom)} />
              <CoordinateRow label="Iter" value={String(view.maxIter)} />
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Rendering */}
          <div className="space-y-4">
            <SectionHeader>Rendering</SectionHeader>

            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-medium text-white/80">
                  Max Iterations
                </label>
                <span className="font-mono text-xs text-white/60 tabular-nums">
                  {view.maxIter}
                  {isAuto && <span className="text-white/30 ml-1">(auto)</span>}
                </span>
              </div>
              <Slider
                value={[view.maxIter]}
                min={50}
                max={5000}
                step={50}
                onValueChange={([val]) =>
                  onViewChange({ ...view, maxIter: val })
                }
              />
              <div className="flex justify-between text-[10px] text-white/30">
                <span>50</span>
                <span>5000</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-white/80">
                Color Scheme
              </label>
              <Select
                value={view.colorScheme}
                onValueChange={(val: ColorScheme) =>
                  onViewChange({ ...view, colorScheme: val })
                }
              >
                <SelectTrigger className="bg-white/10 border-white/[0.08] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/90 backdrop-blur-md border-white/[0.08]">
                  {SCHEMES.map((scheme) => (
                    <SelectItem
                      key={scheme}
                      value={scheme}
                      className="text-white focus:bg-white/20 focus:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <ColorSwatch scheme={scheme} />
                        <span>{COLOR_SCHEME_NAMES[scheme]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Actions */}
          <div className="space-y-2">
            <SectionHeader>Actions</SectionHeader>
            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="outline"
                className="w-full border-white/[0.08] text-white/80 hover:bg-white/10 hover:text-white"
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
