import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REFERENCE_SECTIONS } from "@/lib/mandelbrot/references";

interface ReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReferenceDialog({ open, onOpenChange }: ReferenceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="glass flex max-h-[min(85vh,calc(100dvh-2rem))] max-w-[calc(100%-2rem)] flex-col gap-0 border-white/8 p-0 text-white sm:max-w-xl"
      >
        <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5 text-left">
          <DialogTitle className="text-lg text-white">Reference</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-white/60">
            Algorithms and publications this explorer builds on. External sites
            open in a new tab.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
