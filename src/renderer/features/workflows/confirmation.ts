export type ConfirmFn = (message: string) => boolean;

export function confirmDestructiveAction(message: string, confirmFn: ConfirmFn): boolean {
  return confirmFn(message);
}

export async function runDestructiveAction<T>(
  message: string,
  confirmFn: ConfirmFn,
  action: () => Promise<T>
): Promise<T | null> {
  if (!confirmDestructiveAction(message, confirmFn)) {
    return null;
  }

  return action();
}
