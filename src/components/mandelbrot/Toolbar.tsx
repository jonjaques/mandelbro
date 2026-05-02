import {
  Settings,
  RotateCcw,
  Maximize,
  Minimize,
  Share2,
  Check,
  SquareCode,
  Star,
  GitCompare,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCallback, useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { useClipboardFeedback } from "@/hooks/use-clipboard-feedback";
import {
  SOURCE_CODE_URL,
  getCompareUrl,
  isPreviewDeployment,
} from "@/lib/site-config";

interface ToolbarProps {
  onSettingsToggle: () => void;
  onReset: () => void;
  onSaveFavorite: () => void;
  onReferenceOpen: () => void;
  getShareUrl: () => string;
}

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

function getActiveFullscreenElement(doc: FullscreenDocument): Element | null {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function isStandaloneApp(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as StandaloneNavigator).standalone === true
  );
}

export function Toolbar({
  onSettingsToggle,
  onReset,
  onSaveFavorite,
  onReferenceOpen,
  getShareUrl,
}: ToolbarProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [supportsFullscreen, setSupportsFullscreen] = useState(false);
  const { copied, copy } = useClipboardFeedback();

  useEffect(() => {
    const doc = document as FullscreenDocument;
    const root = document.documentElement as FullscreenElement;
    const standaloneMedia = window.matchMedia("(display-mode: standalone)");
    const fullscreenMedia = window.matchMedia("(display-mode: fullscreen)");

    const handleChange = () => {
      const fullscreenEnabled =
        doc.fullscreenEnabled ||
        doc.webkitFullscreenEnabled === true ||
        typeof root.webkitRequestFullscreen === "function";

      setIsFullscreen(getActiveFullscreenElement(doc) !== null);
      setIsStandalone(isStandaloneApp());
      setSupportsFullscreen(fullscreenEnabled);
    };

    handleChange();
    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);
    standaloneMedia.addEventListener("change", handleChange);
    fullscreenMedia.addEventListener("change", handleChange);
    window.addEventListener("pageshow", handleChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange);
      standaloneMedia.removeEventListener("change", handleChange);
      fullscreenMedia.removeEventListener("change", handleChange);
      window.removeEventListener("pageshow", handleChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument;
    const root = document.documentElement as FullscreenElement;
    const activeFullscreenElement = getActiveFullscreenElement(doc);

    if (activeFullscreenElement) {
      trackEvent("fullscreen_toggle", { state: "exit" });
      if (typeof doc.exitFullscreen === "function") {
        await doc.exitFullscreen();
        return;
      }
      if (typeof doc.webkitExitFullscreen === "function") {
        await doc.webkitExitFullscreen();
      }
      return;
    }

    trackEvent("fullscreen_toggle", { state: "enter" });

    if (typeof root.requestFullscreen === "function") {
      await root.requestFullscreen();
      return;
    }

    if (typeof root.webkitRequestFullscreen === "function") {
      await root.webkitRequestFullscreen();
      return;
    }

    if (!isStandaloneApp()) {
      window.alert(
        "Fullscreen is not available in iPhone Safari. Add Mandelbro to your Home Screen for a native full-screen experience.",
      );
    }
  }, []);

  const handleShare = useCallback(() => {
    copy(getShareUrl());
    trackEvent("share_url_copy");
  }, [copy, getShareUrl]);

  const btnClass =
    "text-white/70 hover:text-white hover:bg-white/10 rounded-none first:rounded-t-lg last:rounded-b-lg";
  const fullscreenLabel = isStandalone
    ? "Installed app already fills the screen"
    : supportsFullscreen
      ? isFullscreen
        ? "Exit Fullscreen"
        : "Fullscreen"
      : "Use Add to Home Screen on iPhone";

  return (
    <div
      className="fixed z-50 glass rounded-lg flex flex-col"
      style={{
        top: "calc(1rem + max(var(--safe-area-top), var(--titlebar-area-height)))",
        right:
          "calc(1rem + max(var(--safe-area-right), var(--titlebar-safe-right)))",
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={btnClass}
            onClick={() => {
              trackEvent("settings_open");
              onSettingsToggle();
            }}
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
            onClick={onSaveFavorite}
          >
            <Star className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Save Favorite</TooltipContent>
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
            onClick={() => {
              trackEvent("reference_open");
              onReferenceOpen();
            }}
            aria-label="Open reference and prior art"
          >
            <BookOpen className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Reference</TooltipContent>
      </Tooltip>

      <div className="h-px bg-white/10" />

      {isPreviewDeployment() && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={btnClass}
                aria-label="Compare this view against production"
                onClick={() => {
                  const url = getCompareUrl();
                  if (url) window.open(url, "_blank", "noreferrer");
                }}
              >
                <GitCompare className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Compare with Production</TooltipContent>
          </Tooltip>

          <div className="h-px bg-white/10" />
        </>
      )}

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
            onClick={() => {
              void toggleFullscreen();
            }}
            aria-label={fullscreenLabel}
          >
            {isFullscreen ? (
              <Minimize className="size-4" />
            ) : (
              <Maximize className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{fullscreenLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}
