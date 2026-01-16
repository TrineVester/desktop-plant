const { app, BrowserWindow, ipcMain } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const STATE_FILE = () => path.join(app.getPath('userData'), 'plant-state.json');

const DEFAULT_STATE = {
  growthStage: 0,
  wateredToday: false,
  fertilizedToday: false,
  lastCheckedDate: null,
  lastGrowthDried: false
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE())) {
      const raw = fs.readFileSync(STATE_FILE(), 'utf8');
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    }
  } catch {
    // fall through to default
  }
  return { ...DEFAULT_STATE };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE(), JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // ignore write failures
  }
}

function daysBetween(a, b) {
  const aDate = new Date(a + 'T00:00:00');
  const bDate = new Date(b + 'T00:00:00');
  const diff = bDate - aDate;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function applyDailyProgress(state) {
  const today = todayString();
  if (!state.lastCheckedDate) {
    state.lastCheckedDate = today;
    return state;
  }

  const missedDays = daysBetween(state.lastCheckedDate, today);
  if (missedDays === 0) {
    return state;
  }

  for (let i = 0; i < missedDays; i += 1) {
    if (state.wateredToday && state.fertilizedToday) {
      state.growthStage = Math.min(10, state.growthStage + 1);
      state.lastGrowthDried = false;
    } else {
      state.growthStage = Math.max(0, state.growthStage - 1);
      state.lastGrowthDried = true;
    }

    state.wateredToday = false;
    state.fertilizedToday = false;
  }

  state.lastCheckedDate = today;
  return state;
}

function getUpdatedState() {
  const state = loadState();
  const updated = applyDailyProgress(state);
  saveState(updated);
  return updated;
}

const DESKTOP_SCRIPT = `
param([string]$hwndStr)
$hwnd = [IntPtr]::new([int64]$hwndStr)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
  [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr childAfter, string lpszClass, string lpszWindow);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam, int fuFlags, int uTimeout, out IntPtr lpdwResult);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
}
"@
$GWL_STYLE = -16
$WS_CHILD = 0x40000000
$WS_POPUP = 0x80000000
$progman = [Win32]::FindWindow("Progman", $null)
$result = [IntPtr]::Zero
[Win32]::SendMessageTimeout($progman, 0x052C, [IntPtr]::Zero, [IntPtr]::Zero, 0, 1000, [ref]$result) | Out-Null
$script:workerw = [IntPtr]::Zero
[Win32]::EnumWindows({ param($hWnd, $lParam)
  $defView = [Win32]::FindWindowEx($hWnd, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
  if ($defView -ne [IntPtr]::Zero) {
    $script:workerw = [Win32]::FindWindowEx([IntPtr]::Zero, $hWnd, "WorkerW", $null)
  }
  return $true
}, [IntPtr]::Zero) | Out-Null
if ($script:workerw -ne [IntPtr]::Zero) {
  [Win32]::SetParent($hwnd, $script:workerw) | Out-Null
  $style = [Win32]::GetWindowLong($hwnd, $GWL_STYLE)
  $style = ($style -bor $WS_CHILD) -band (-bnot $WS_POPUP)
  [Win32]::SetWindowLong($hwnd, $GWL_STYLE, $style) | Out-Null
}
`;

function applyDesktopMode(win) {
  if (process.platform !== 'win32' || !win) {
    return;
  }
  win.setAlwaysOnTop(false);
  win.setVisibleOnAllWorkspaces(false);
  const handle = win.getNativeWindowHandle();
  const handleValue = handle.length === 8 ? handle.readBigInt64LE(0) : BigInt(handle.readInt32LE(0));
  execFile(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', DESKTOP_SCRIPT, handleValue.toString()],
    () => {}
  );
}

function createWindow() {
  const win = new BrowserWindow({
    width: 280,
    height: 360,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.once('did-finish-load', () => applyDesktopMode(win));
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('plant:getState', () => getUpdatedState());
  ipcMain.on('plant:move', (_event, position) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win || !position) {
      return;
    }
    const nextX = Number(position.x);
    const nextY = Number(position.y);
    if (Number.isFinite(nextX) && Number.isFinite(nextY)) {
      win.setPosition(Math.round(nextX), Math.round(nextY));
    }
  });
  ipcMain.handle('plant:water', () => {
    const state = getUpdatedState();
    state.wateredToday = true;
    saveState(state);
    return state;
  });
  ipcMain.handle('plant:fertilize', () => {
    const state = getUpdatedState();
    state.fertilizedToday = true;
    saveState(state);
    return state;
  });
  ipcMain.handle('plant:reset', () => {
    const state = { ...DEFAULT_STATE, lastCheckedDate: todayString() };
    saveState(state);
    return state;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep running on macOS, quit elsewhere.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
