/**
 * Obsidian sends in-window http(s) navigations from plugin BrowserWindows
 * to the system browser. Login OAuth must stay on http(s) inside Electron.
 */
export function isAllowedLoginNavigation(url: string): boolean {
  if (!url || url === "about:blank") return true;
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
