import { Notice, Platform } from "obsidian";
import { isAuthenticationMessage } from "./auth-state";
import { MubuApiError } from "./mubu-api";

const LOGIN_URL = "https://mubu.com";
const SESSION_PARTITION = "persist:mubu-sync";
const JWT_COOKIE_NAME = "Jwt-Token";

interface ElectronCookie {
  name: string;
  value: string;
}

interface ElectronCookies {
  get(filter: { url?: string; name?: string }): Promise<ElectronCookie[]>;
  remove(url: string, name: string): Promise<void>;
}

interface ElectronSession {
  cookies: ElectronCookies;
}

interface ElectronWebContents {
  session: ElectronSession;
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

/**
 * Removes the Mubu token from the plugin's dedicated Electron session.
 * This is intentionally separate from SecretStorage: the login window has
 * its own persistent cookie store and must be cleared on sign-out/re-login.
 */
export async function clearMubuLoginSession(): Promise<void> {
  const session = resolveSession();
  if (!session) return;

  try {
    await session.cookies.remove(LOGIN_URL, JWT_COOKIE_NAME);
  } catch (error) {
    console.warn("[Mubu Sync] Could not clear the Mubu login cookie", error);
  }
}

export async function loginToMubu(verifyToken: VerifyToken): Promise<string | null> {
  if (!Platform.isDesktop) {
    throw new Error("幕布自动登录目前仅支持 Obsidian 桌面版");
  }

  const BrowserWindow = resolveBrowserWindow();
  if (!BrowserWindow) {
    throw new Error("当前 Obsidian 无法打开幕布登录窗口，请使用手动 Token 模式");
  }

  return new Promise<string | null>((resolve, reject) => {
    const win = new BrowserWindow({
      width: 480,
      height: 720,
      title: "登录幕布",
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: SESSION_PARTITION
      }
    });

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
              await Promise.resolve(win.loadURL(LOGIN_URL));
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
      void win.loadURL(LOGIN_URL);
    } catch (error) {
      fail(error);
    }
  });
}

async function readJwtToken(session: ElectronSession): Promise<string | null> {
  const cookies = await session.cookies.get({ url: LOGIN_URL, name: JWT_COOKIE_NAME });
  const token = cookies.find(cookie => cookie.name === JWT_COOKIE_NAME)?.value.trim();
  return token || null;
}

async function clearJwtCookie(session: ElectronSession): Promise<void> {
  try {
    await session.cookies.remove(LOGIN_URL, JWT_COOKIE_NAME);
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
