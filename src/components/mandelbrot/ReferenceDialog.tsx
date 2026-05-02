/**
 * Controlled Dialog: shadcn composition + scrollable body pattern
 * (https://ui.shadcn.com/docs/components/dialog#scrollable-content).
 */
import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REFERENCE_SECTIONS } from "@/lib/mandelbrot/references";
import { referencesHrefWithExplorerFragment } from "@/lib/mandelbrot/references-return";

interface ReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReferenceDialog({ open, onOpenChange }: ReferenceDialogProps) {
  const fullReferencesHref = useMemo(() => {
    if (!open || typeof window === "undefined") {
      return "/references";
    }
    const fragment = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : "";
    return referencesHrefWithExplorerFragment(fragment);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass text-white border-white/8 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-white">Reference</DialogTitle>
          <DialogDescription className="text-white/60">
            Algorithms and publications this explorer builds on. External sites
            open in a new tab.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 max-h-[min(60vh,calc(100dvh-14rem))] overflow-y-auto overscroll-contain px-4">
          <ul className="flex flex-col gap-8">
            {REFERENCE_SECTIONS.map((section) => (
              <li key={section.heading}>
                <h3 className="mb-2 text-sm font-semibold tracking-wide text-white">
                  {section.heading}
                </h3>
                <p className="mb-3 text-sm leading-relaxed text-white/70">
                  {section.summary}
                </p>
                <ul className="flex flex-col gap-2 border-l border-white/15 pl-3">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-sky-300/90 underline decoration-sky-500/40 underline-offset-2 transition-colors hover:text-sky-200 hover:decoration-sky-300/70"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className="mt-8 border-t border-white/10 pt-4">
            <a
              href={fullReferencesHref}
              className="text-sm text-white/50 underline underline-offset-2 transition-colors hover:text-white/70"
            >
              View full references page
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
