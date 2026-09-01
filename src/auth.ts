import { Notice, Platform } from "obsidian";
import { isAuthenticationMessage } from "./auth-state";
import { isAllowedLoginNavigation } from "./login-navigation";
import { MubuApiError } from "./mubu-api";

const LOGIN_URL = "https://mubu.com";
const LOGIN_PAGE_URL = "https://mubu.com/login";
const SESSION_PARTITION = "persist:mubu-sync";
const JWT_COOKIE_NAME = "Jwt-Token";

interface ElectronCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
}

interface ElectronCookies {
  get(filter: { url?: string; name?: string }): Promise<ElectronCookie[]>;
  remove(url: string, name: string): Promise<void>;
}

interface ElectronSession {
  cookies: ElectronCookies;
  clearStorageData?(options?: Record<string, unknown>): Promise<void>;
}

interface ElectronWillNavigateEvent {
  preventDefault(): void;
}

interface ElectronWebContents {
  session: ElectronSession;
  setWindowOpenHandler(handler: (details: { url: string }) => {
    action: "allow" | "deny";
    overrideBrowserWindowOptions?: Record<string, unknown>;
  }): void;
  removeAllListeners(event: "will-navigate"): void;
  on(event: "will-navigate", listener: (event: ElectronWillNavigateEvent, url: string) => void): void;
  on(event: "did-create-window", listener: (child: ElectronBrowserWindow) => void): void;
}

interface ElectronBrowserWindow {
  webContents: ElectronWebContents;
  loadURL(url: string): Promise<void> | void;
  close(): void;
  isDestroyed(): boolean;
  on(event: "closed", listener: () => void): void;
}

interface ElectronBrowserWindowConstructor {
  new(options: Record<string, unknown>): ElectronBrowserWindow;
}

interface ElectronModule {
  BrowserWindow?: ElectronBrowserWindowConstructor;
  session?: ElectronSessionModule;
  remote?: {
    BrowserWindow?: ElectronBrowserWindowConstructor;
    session?: ElectronSessionModule;
  };
}

interface ElectronSessionModule {
  fromPartition(partition: string): ElectronSession;
}

type VerifyToken = (token: string) => Promise<void>;

const LOGIN_WINDOW_PREFERENCES = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  partition: SESSION_PARTITION
};

function isJwtCookie(cookie: ElectronCookie): boolean {
  return cookie.name.toLowerCase() === JWT_COOKIE_NAME.toLowerCase();
}

function cookieUrl(cookie: ElectronCookie): string {
  const domain = (cookie.domain || "mubu.com").replace(/^\./, "");
  const path = cookie.path || "/";
  const protocol = cookie.secure === false ? "http" : "https";
  return `${protocol}://${domain}${path}`;
}

/**
 * Wipes the plugin's dedicated Electron partition. Jwt-Token alone is not
 * enough: Mubu also keeps session cookies that would silently re-login the
 * previous account on the next sign-in window.
 */
export async function clearMubuLoginSession(): Promise<void> {
  const session = resolveSession();
  if (!session) return;
  await clearMubuSessionData(session);
}

export async function loginToMubu(verifyToken: VerifyToken): Promise<string | null> {
  if (!Platform.isDesktop) {
    throw new Error("幕布自动登录目前仅支持 Obsidian 桌面版");
  }

  const BrowserWindow = resolveBrowserWindow();
  if (!BrowserWindow) {
    throw new Error("当前 Obsidian 无法打开幕布登录窗口，请使用手动 Token 模式");
  }

  const win = new BrowserWindow({
    width: 480,
    height: 720,
    title: "登录幕布",
    show: true,
    autoHideMenuBar: true,
    webPreferences: LOGIN_WINDOW_PREFERENCES
  });

  reclaimLoginWindow(win);
  await clearMubuSessionData(win.webContents.session);
  if (win.isDestroyed()) return null;

  return new Promise<string | null>((resolve, reject) => {
    let settled = false;
    let checking = false;
    let rejectedToken = "";

    const finish = (token: string | null): void => {
      if (settled) return;
      settled = true;
      window.clearInterval(timer);
      resolve(token);
    };

    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      window.clearInterval(timer);
      reject(error);
    };

    const timer = window.setInterval(() => {
      if (checking || settled || win.isDestroyed()) return;
      checking = true;

      void readJwtToken(win.webContents.session)
        .then(async token => {
          if (!token || settled || token === rejectedToken) return;
          try {
            await verifyToken(token);
            finish(token);
            if (!win.isDestroyed()) win.close();
          } catch (error) {
            if (!isExpiredMubuLogin(error)) throw error;

            // A persistent login window can retain an expired Jwt-Token for
            // weeks. Evict it instead of treating it as a fatal login error,
            // then leave the window open for the user to sign in again.
            rejectedToken = token;
            await clearJwtCookie(win.webContents.session);
            if (!win.isDestroyed()) {
              new Notice("幕布登录已过期，请在窗口中重新登录");
              await Promise.resolve(win.loadURL(LOGIN_PAGE_URL));
            }
          }
        })
        .catch(error => {
          if (!isExpiredMubuLogin(error)) {
            fail(error);
            if (!win.isDestroyed()) win.close();
          }
        })
        .finally(() => {
          checking = false;
        });
    }, 1_000);

    win.on("closed", () => finish(null));

    try {
      void win.loadURL(LOGIN_PAGE_URL);
    } catch (error) {
      fail(error);
    }
  });
}

function reclaimLoginWindow(win: ElectronBrowserWindow): void {
  // Obsidian's main process marks every WebContents as secured: will-navigate
  // and window.open for http(s) are diverted to shell.openExternal. Mubu's
  // login button assigns location.href to /login, so the JWT lands in Chrome
  // unless this window is reclaimed first.
  const contents = win.webContents;

  try {
    contents.removeAllListeners("will-navigate");
  } catch (error) {
    console.warn("[Mubu Sync] Could not detach Obsidian navigation handlers", error);
  }

  try {
    contents.setWindowOpenHandler(({ url }) => {
      if (!isAllowedLoginNavigation(url)) return { action: "deny" };
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 760,
          title: "登录幕布",
          autoHideMenuBar: true,
          webPreferences: LOGIN_WINDOW_PREFERENCES
        }
      };
    });
  } catch (error) {
    console.warn("[Mubu Sync] Could not keep Mubu login popups in-app", error);
  }

  try {
    contents.on("will-navigate", (event, url) => {
      if (isAllowedLoginNavigation(url)) return;
      event.preventDefault();
    });
  } catch (error) {
    console.warn("[Mubu Sync] Could not allow in-window Mubu login navigation", error);
  }

  try {
    contents.on("did-create-window", child => {
      reclaimLoginWindow(child);
    });
  } catch (error) {
    console.warn("[Mubu Sync] Could not reclaim Mubu login child windows", error);
  }
}

async function readJwtToken(session: ElectronSession): Promise<string | null> {
  const cookies = await session.cookies.get({});
  const token = cookies.find(isJwtCookie)?.value.trim();
  return token || null;
}

async function clearMubuSessionData(session: ElectronSession): Promise<void> {
  try {
    if (session.clearStorageData) {
      await session.clearStorageData();
    }
  } catch (error) {
    console.warn("[Mubu Sync] Could not clear Mubu login storage", error);
  }

  try {
    const cookies = await session.cookies.get({});
    await Promise.all(cookies.map(cookie => session.cookies.remove(cookieUrl(cookie), cookie.name)));
  } catch (error) {
    console.warn("[Mubu Sync] Could not clear Mubu login cookies", error);
  }
}

async function clearJwtCookie(session: ElectronSession): Promise<void> {
  try {
    const cookies = await session.cookies.get({});
    const targets = cookies.filter(isJwtCookie);
    if (targets.length === 0) {
      await session.cookies.remove(LOGIN_URL, JWT_COOKIE_NAME);
      return;
    }
    await Promise.all(targets.map(cookie => session.cookies.remove(cookieUrl(cookie), cookie.name)));
  } catch (error) {
    console.warn("[Mubu Sync] Could not clear expired Mubu login cookie", error);
  }
}

function isExpiredMubuLogin(error: unknown): boolean {
  return error instanceof MubuApiError
    ? error.isAuthenticationError
    : isAuthenticationMessage(error instanceof Error ? error.message : String(error));
}

function resolveBrowserWindow(): ElectronBrowserWindowConstructor | null {
  const requireFn = (window as unknown as { require?: (id: string) => unknown }).require;
  if (!requireFn) return null;

  try {
    const electron = requireFn("electron") as ElectronModule;
    if (electron.remote?.BrowserWindow) return electron.remote.BrowserWindow;
    if (electron.BrowserWindow) return electron.BrowserWindow;
  } catch {
    // Try @electron/remote below.
  }

  try {
    const remote = requireFn("@electron/remote") as { BrowserWindow?: ElectronBrowserWindowConstructor };
    return remote.BrowserWindow ?? null;
  } catch {
    return null;
  }
}

function resolveSession(): ElectronSession | null {
  const requireFn = (window as unknown as { require?: (id: string) => unknown }).require;
  if (!requireFn) return null;

  try {
    const electron = requireFn("electron") as ElectronModule;
    const sessionModule = electron.remote?.session ?? electron.session;
    if (sessionModule) return sessionModule.fromPartition(SESSION_PARTITION);
  } catch {
    // Try @electron/remote below.
  }

  try {
    const remote = requireFn("@electron/remote") as { session?: ElectronSessionModule };
    return remote.session?.fromPartition(SESSION_PARTITION) ?? null;
  } catch {
    return null;
  }
}
