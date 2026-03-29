import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SaveFavoriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
}

export function SaveFavoriteDialog({
  open,
  onOpenChange,
  onSave,
}: SaveFavoriteDialogProps) {
  const [name, setName] = useState("");

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) setName("");
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    handleOpenChange(false);
  }, [name, onSave, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass text-white border-white/8 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Save Favorite</DialogTitle>
          <DialogDescription className="text-white/50">
            Give this view a name to find it later.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder="e.g. Beautiful spiral"
          className="bg-white/10 border-white/8 text-white placeholder:text-white/30"
        />
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-white/50 hover:text-white hover:bg-white/10"
            onClick={() => {
              handleOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            className="bg-white/15 text-white hover:bg-white/25 border border-white/10"
            disabled={!name.trim()}
            onClick={handleSave}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
