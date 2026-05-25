import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import type { JSX } from "react";
import { useEffect } from "react";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const COMMANDS = [
  "New project",
  "Search story bible",
  "Draft chapter",
  "Open model routes",
  "Show cost ledger"
];

export function CommandPalette({ open, onClose }: CommandPaletteProps): JSX.Element {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="fixed left-1/2 top-20 z-50 w-[calc(100vw-3rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-graphite-900/95 shadow-soft-glow"
                initial={{ opacity: 0, y: -18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <Dialog.Title className="sr-only">Command palette</Dialog.Title>
                <div className="border-b border-white/10 px-4 py-3">
                  <input
                    autoFocus
                    className="w-full bg-transparent text-base text-white outline-none placeholder:text-slate-500"
                    placeholder="Search commands"
                  />
                </div>
                <div className="p-2">
                  {COMMANDS.map((command) => (
                    <button
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/8"
                      key={command}
                      type="button"
                    >
                      <span>{command}</span>
                      <span className="text-xs text-slate-500">Soon</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
