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

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  onReset: () => void;
}

const SCHEMES = Object.keys(COLOR_SCHEME_NAMES) as ColorScheme[];

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

export function SettingsPanel({
  open,
  onOpenChange,
  view,
  onViewChange,
  onReset,
}: SettingsPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-black/80 backdrop-blur-md border-white/10 text-white w-72"
      >
        <SheetHeader>
          <SheetTitle className="text-white">Settings</SheetTitle>
          <SheetDescription className="text-white/60">
            Adjust rendering parameters
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 py-6 px-1">
          <div className="space-y-3">
            <label className="text-sm font-medium text-white/80">
              Max Iterations: {view.maxIter}
            </label>
            <Slider
              value={[view.maxIter]}
              min={50}
              max={5000}
              step={50}
              onValueChange={([val]) =>
                onViewChange({ ...view, maxIter: val })
              }
            />
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
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/90 backdrop-blur-md border-white/20">
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

          <Button
            variant="outline"
            className="mt-4 border-white/20 text-white hover:bg-white/10"
            onClick={onReset}
          >
            Reset to Default
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
