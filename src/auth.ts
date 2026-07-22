import { Platform } from "obsidian";

const LOGIN_URL = "https://mubu.com";
const SESSION_PARTITION = "persist:mubu-sync";

interface ElectronCookie {
  name: string;
  value: string;
}

interface ElectronCookies {
  get(filter: { url?: string; name?: string }): Promise<ElectronCookie[]>;
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
  remote?: { BrowserWindow?: ElectronBrowserWindowConstructor };
}

type VerifyToken = (token: string) => Promise<void>;

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
          if (!token || settled) return;
          await verifyToken(token);
          finish(token);
          if (!win.isDestroyed()) win.close();
        })
        .catch(error => {
          const message = error instanceof Error ? error.message : String(error);
          if (!/token|jwt|登录|认证|401|403/i.test(message)) {
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
  const cookies = await session.cookies.get({ url: LOGIN_URL, name: "Jwt-Token" });
  const token = cookies.find(cookie => cookie.name === "Jwt-Token")?.value.trim();
  return token || null;
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
