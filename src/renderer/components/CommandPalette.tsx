import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { JSX } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  filterCommands,
  type StudioCommand,
  type StudioCommandId
} from "@features/workflows/command-registry";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onRunCommand: (commandId: StudioCommandId) => void;
}

function nextIndex(current: number, delta: number, length: number): number {
  if (length === 0) return 0;
  return (current + delta + length) % length;
}

export function CommandPalette({ open, onClose, onRunCommand }: CommandPaletteProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const commands = useMemo(() => filterCommands(query), [query]);

  const closePalette = useCallback((): void => {
    setQuery("");
    setActiveIndex(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        closePalette();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => nextIndex(current, 1, commands.length));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => nextIndex(current, -1, commands.length));
      }
      if (event.key === "Enter") {
        const command = commands[activeIndex];
        if (command) {
          event.preventDefault();
          onRunCommand(command.id);
          closePalette();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, commands, closePalette, onRunCommand, open]);

  const runCommand = (command: StudioCommand): void => {
    onRunCommand(command.id);
    closePalette();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && closePalette()}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="fixed left-1/2 top-20 z-50 w-[calc(100vw-3rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-graphite-900/95 shadow-soft-glow"
                initial={reduceMotion ? false : { opacity: 0, y: -18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
              >
                <Dialog.Title className="sr-only">Command palette</Dialog.Title>
                <div className="border-b border-white/10 px-4 py-3">
                  <input
                    autoFocus
                    className="w-full bg-transparent text-base text-white outline-none placeholder:text-slate-500"
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    placeholder="Search commands"
                    value={query}
                  />
                </div>
                <div className="p-2">
                  {commands.map((command, index) => (
                    <button
                      aria-current={index === activeIndex}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                        index === activeIndex
                          ? "bg-forge-blue/12 text-white"
                          : "text-slate-200 hover:bg-white/8"
                      }`}
                      key={command.id}
                      onClick={() => runCommand(command)}
                      type="button"
                    >
                      <span>
                        <span className="block">{command.label}</span>
                        <span className="block text-xs text-slate-500">{command.description}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-500">
                        {command.placeholder ? "Soon" : command.section}
                      </span>
                    </button>
                  ))}
                  {commands.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-slate-500">
                      No matching commands.
                    </p>
                  ) : null}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
