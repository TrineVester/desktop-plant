const { app, BrowserWindow, ipcMain } = require('electron');
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

function createWindow() {
  const win = new BrowserWindow({
    width: 280,
    height: 360,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('plant:getState', () => getUpdatedState());
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
