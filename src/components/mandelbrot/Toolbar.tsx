import {
  Settings,
  RotateCcw,
  Maximize,
  Minimize,
  Share2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColorScheme } from "@/lib/mandelbrot/types";
import { getBrandColors } from "@/lib/mandelbrot/colors";

interface ToolbarProps {
  onSettingsToggle: () => void;
  onReset: () => void;
  colorScheme: ColorScheme;
}

export function Toolbar({
  onSettingsToggle,
  onReset,
  colorScheme,
}: ToolbarProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brand = useMemo(() => getBrandColors(colorScheme), [colorScheme]);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }, []);

  const handleShare = useCallback(() => {
    void navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    copyTimeout.current = setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    };
  }, []);

  const btnClass =
    "text-white/70 hover:text-white hover:bg-white/10 rounded-none first:rounded-t-lg last:rounded-b-lg";

  return (
    <>
      {/* Brand mark */}
      <div className="fixed top-4 left-4 z-40 pointer-events-none select-none glass rounded-lg px-3 py-2">
        <div
          className="relative"
          style={{
            filter: `drop-shadow(0 0 6px ${brand.glow}) drop-shadow(0 0 14px ${brand.glow})`,
          }}
        >
          <h1
            className="text-2xl leading-none uppercase bg-clip-text text-transparent"
            style={{
              fontFamily: "'Macula', sans-serif",
              fontWeight: 500,
              backgroundImage: brand.gradient,
            }}
          >
            mandelbro
          </h1>
        </div>
      </div>

      {/* Toolbar */}
      <div className="fixed top-4 right-4 z-50 glass rounded-lg flex flex-col">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onClick={onSettingsToggle}
            >
              <Settings className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Settings</TooltipContent>
        </Tooltip>

        <div className="h-px bg-white/10" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onClick={handleShare}
            >
              {copied ? (
                <Check className="size-4 text-green-400" />
              ) : (
                <Share2 className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {copied ? "Copied!" : "Share URL"}
          </TooltipContent>
        </Tooltip>

        <div className="h-px bg-white/10" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onClick={onReset}
            >
              <RotateCcw className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Reset View</TooltipContent>
        </Tooltip>

        <div className="h-px bg-white/10" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize className="size-4" />
              ) : (
                <Maximize className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}
