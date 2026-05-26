import { shell } from "electron";

export function getValidatedExternalUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const isLocalHttp =
      url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    const isHttps = url.protocol === "https:";
    return isHttps || isLocalHttp ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isAllowedAppNavigation(targetUrl: string, currentUrl: string): boolean {
  const isDevServer =
    targetUrl.startsWith("http://localhost:") ||
    targetUrl.startsWith("http://127.0.0.1:") ||
    targetUrl.startsWith("http://[::1]:");

  return targetUrl === currentUrl || targetUrl.startsWith("file://") || isDevServer;
}

export async function openValidatedExternalUrl(rawUrl: string): Promise<void> {
  const url = getValidatedExternalUrl(rawUrl);

  if (url) {
    await shell.openExternal(url);
  }
}
