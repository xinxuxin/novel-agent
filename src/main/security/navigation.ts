import { shell } from "electron";

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["https:", "http:"]);

export function getValidatedExternalUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isAllowedAppNavigation(targetUrl: string, currentUrl: string): boolean {
  const isDevServer =
    targetUrl.startsWith("http://localhost:") || targetUrl.startsWith("http://127.0.0.1:");

  return targetUrl === currentUrl || targetUrl.startsWith("file://") || isDevServer;
}

export async function openValidatedExternalUrl(rawUrl: string): Promise<void> {
  const url = getValidatedExternalUrl(rawUrl);

  if (url) {
    await shell.openExternal(url);
  }
}
