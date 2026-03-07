import {
  Settings,
  RotateCcw,
  Maximize,
  Minimize,
  Share2,
  Check,
  SquareCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCallback, useEffect, useRef, useState } from "react";

interface ToolbarProps {
  onSettingsToggle: () => void;
  onReset: () => void;
}

const SOURCE_CODE_URL = "https://github.com/jonjaques/mandelbro";

export function Toolbar({ onSettingsToggle, onReset }: ToolbarProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          <Button asChild variant="ghost" size="icon" className={btnClass}>
            <a
              href={SOURCE_CODE_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="View source code on GitHub"
            >
              <SquareCode className="size-4" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">View Source</TooltipContent>
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
  );
}
