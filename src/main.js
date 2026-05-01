const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  globalShortcut, Notification, ipcMain, screen, powerMonitor,
  clipboard, shell, dialog
} = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('./store');

const APP_NAME = 'OptiRest';

let onboardingWindow = null;
let mainWindow = null;
let settingsWindow = null;
let statisticsWindow = null;
let countdownWindows = [];
let tray = null;
let breakTimer = null;
let trayTooltipTimer = null;
let nextBreakAt = null;
let missedBreaks = 0;
let isBreakActive = false;
let isPaused = false;
let store;

class OptiRest {
  constructor() {
    store = new Store();
    this.ensureBackgroundsDir();
    this.setupApp();
    this.setupIpcHandlers();
  }

  ensureBackgroundsDir() {
    const dir = path.join(app.getPath('userData'), 'backgrounds');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  setupApp() {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) { app.quit(); return; }

    app.whenReady().then(() => {
      const onboarding = store.get('onboarding');
      if (!onboarding || !onboarding.completed) {
        this.showOnboarding();
      } else {
        this.startMainApp();
      }

      powerMonitor.on('resume', () => {
        if (!isPaused) this.startBreakTimer();
      });
      powerMonitor.on('suspend', () => {
        if (breakTimer) clearTimeout(breakTimer);
      });
    });

    app.on('second-instance', () => {
      if (settingsWindow) {
        if (settingsWindow.isMinimized()) settingsWindow.restore();
        settingsWindow.focus();
      }
    });

    app.on('window-all-closed', (e) => e.preventDefault());
    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
      if (trayTooltipTimer) clearInterval(trayTooltipTimer);
    });
    app.on('activate', () => { if (!tray) this.createTray(); });
  }

  startMainApp() {
    this.createTray();
    this.registerShortcuts();
    this.startBreakTimer();
    this.setupAutoStart();
    this.startTrayTooltipUpdater();

    powerMonitor.on('resume', () => {
      if (!isPaused) this.startBreakTimer();
    });
    powerMonitor.on('suspend', () => {
      if (breakTimer) clearTimeout(breakTimer);
    });
  }

  showOnboarding() {
    onboardingWindow = new BrowserWindow({
      width: 540,
      height: 620,
      resizable: false,
      center: true,
      frame: false,
      titleBarStyle: 'hiddenInset',
      title: `Welcome to ${APP_NAME}`,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    onboardingWindow.loadFile(path.join(__dirname, 'renderer/onboarding.html'));

    onboardingWindow.on('closed', () => {
      onboardingWindow = null;
      // If closed without completing, start app anyway
      if (!store.get('onboarding')?.completed) {
        store.set('onboarding', { completed: true });
      }
      this.startMainApp();
    });
  }

  setupAutoStart() {
    const settings = store.get('settings');
    if (app.isPackaged) {
      try {
        app.setLoginItemSettings({
          openAtLogin: settings.autoStart,
          openAsHidden: true,
          path: app.getPath('exe')
        });
      } catch (error) {
        console.log('Unable to set auto-start:', error.message);
      }
    }
  }

  // ── IPC ───────────────────────────────────────────────────────────────────

  setupIpcHandlers() {
    ipcMain.handle('get-onboarding-status', () => store.get('onboarding'));

    ipcMain.handle('complete-onboarding', (event, { autoStart, breakInterval }) => {
      // Save chosen settings
      const settings = store.get('settings');
      if (breakInterval) settings.breakInterval = breakInterval;
      if (autoStart !== undefined) settings.autoStart = autoStart;
      store.set('settings', settings);
      store.set('onboarding', { completed: true });

      // Apply autostart
      if (app.isPackaged) {
        try {
          app.setLoginItemSettings({ openAtLogin: autoStart, openAsHidden: true });
        } catch (e) {}
      }

      // Close onboarding, launch main app
      if (onboardingWindow && !onboardingWindow.isDestroyed()) {
        onboardingWindow.destroy();
      }
      this.startMainApp();
      return true;
    });

    ipcMain.handle('get-settings', () => store.get('settings'));

    ipcMain.handle('save-settings', (event, newSettings) => {
      store.set('settings', newSettings);
      this.setupAutoStart();
      this.startBreakTimer();
      return true;
    });

    ipcMain.handle('get-statistics', () => store.get('statistics'));

    // ── Background images ─────────────────────────────────────────────────

    ipcMain.handle('upload-background-images', async (event, filePaths) => {
      const dir = this.ensureBackgroundsDir();
      const settings = store.get('settings');
      const existing = settings.backgroundImages || [];
      const slots = 5 - existing.length;

      if (slots <= 0) return { error: 'Max 5 images already uploaded' };

      const toAdd = filePaths.slice(0, slots);
      const added = [];

      for (const src of toAdd) {
        try {
          const ext = path.extname(src).toLowerCase();
          const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
          if (!allowed.includes(ext)) continue;

          const fname = `bg_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
          const dest = path.join(dir, fname);
          fs.copyFileSync(src, dest);
          added.push(fname);
        } catch (e) {
          console.error('Failed to copy image:', e);
        }
      }

      settings.backgroundImages = [...existing, ...added];
      store.set('settings', settings);
      return { added, all: settings.backgroundImages };
    });

    ipcMain.handle('remove-background-image', (event, fname) => {
      const dir = this.ensureBackgroundsDir();
      const settings = store.get('settings');
      const filePath = path.join(dir, fname);

      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}

      settings.backgroundImages = (settings.backgroundImages || []).filter(f => f !== fname);
      store.set('settings', settings);
      return settings.backgroundImages;
    });

    ipcMain.handle('get-background-images', () => {
      const dir = this.ensureBackgroundsDir();
      const settings = store.get('settings');
      const images = (settings.backgroundImages || []).filter(fname => {
        return fs.existsSync(path.join(dir, fname));
      });
      // Return file:// URLs safe for renderer
      return images.map(fname => ({
        fname,
        url: `file://${path.join(dir, fname).replace(/\\/g, '/')}`
      }));
    });

    // ── Sharing ───────────────────────────────────────────────────────────

    ipcMain.handle('open-external', (event, url) => {
      // Validate URL scheme before opening
      if (typeof url === 'string' && /^https?:\/\//.test(url)) {
        shell.openExternal(url);
        return true;
      }
      return false;
    });

    ipcMain.handle('copy-to-clipboard', (event, text) => {
      clipboard.writeText(String(text));
      return true;
    });

    ipcMain.handle('capture-statistics', async () => {
      if (!statisticsWindow || statisticsWindow.isDestroyed()) return null;
      try {
        const image = await statisticsWindow.webContents.capturePage();
        const dest  = path.join(app.getPath('downloads'), `optirest-stats-${Date.now()}.png`);
        fs.writeFileSync(dest, image.toPNG());
        return dest;
      } catch (e) {
        console.error('Screenshot failed:', e);
        return null;
      }
    });

    // ── Break IPC ─────────────────────────────────────────────────────────

    ipcMain.on('countdown-complete', () => {
      const settings = store.get('settings');
      if (settings.soundEnabled) this.playSound();

      const stats = store.get('statistics');
      stats.completedBreaks++;
      stats.totalBreaks++;
      store.set('statistics', stats);
      store.incrementDailyStat('completed');

      missedBreaks = 0;
      this.updateTrayIcon();
      this.showNotification('Break completed! Your eyes are refreshed. 👁️');
      this.closeAllCountdownWindows();
    });

    ipcMain.on('postpone-break', () => this.postponeBreak());
    ipcMain.on('skip-break', () => this.skipBreak());
  }

  // ── Timer ─────────────────────────────────────────────────────────────────

  startBreakTimer() {
    if (breakTimer) clearTimeout(breakTimer);
    const settings = store.get('settings');
    const intervalMs = settings.breakInterval * 60 * 1000;
    nextBreakAt = new Date(Date.now() + intervalMs);
    this.scheduleNext(nextBreakAt);
  }

  scheduleNext(targetDate) {
    if (breakTimer) clearTimeout(breakTimer);
    const delay = Math.max(0, targetDate - Date.now());

    breakTimer = setTimeout(() => {
      if (!isPaused && this.isWithinWorkingHours()) {
        this.startBreak();
      } else {
        const retryAt = new Date(Date.now() + 60 * 1000);
        nextBreakAt = retryAt;
        this.scheduleNext(retryAt);
      }
    }, delay);
  }

  isWithinWorkingHours() {
    const settings = store.get('settings');
    if (!settings.workingHoursEnabled) return true;
    const now = new Date();
    const hhmm = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = settings.workingHoursStart.split(':').map(Number);
    const [eh, em] = settings.workingHoursEnd.split(':').map(Number);
    return hhmm >= (sh * 60 + sm) && hhmm <= (eh * 60 + em);
  }

  // ── Tray tooltip ──────────────────────────────────────────────────────────

  startTrayTooltipUpdater() {
    this.updateTrayTooltip();
    trayTooltipTimer = setInterval(() => this.updateTrayTooltip(), 30 * 1000);
  }

  updateTrayTooltip() {
    if (!tray) return;
    if (isPaused) { tray.setToolTip(`${APP_NAME} — paused`); return; }
    if (!nextBreakAt) { tray.setToolTip(APP_NAME); return; }
    const minsLeft = Math.max(0, Math.ceil((nextBreakAt - Date.now()) / 60000));
    const label = minsLeft <= 1 ? 'break soon!' : `next break in ${minsLeft}m`;
    tray.setToolTip(`${APP_NAME} — ${label}`);
  }

  // ── Tray icons ────────────────────────────────────────────────────────────

  getTrayIconPath(red = false) {
    const base = red ? 'tray-icon-red' : 'tray-icon';
    if (process.platform === 'win32') {
      return path.join(__dirname, `assets/icons/${base}.ico`);
    }
    return path.join(__dirname, `assets/icons/${base}.png`);
  }

  loadTrayIcon(red = false) {
    const iconPath = this.getTrayIconPath(red);
    let icon = nativeImage.createFromPath(iconPath);

    if (icon.isEmpty() && process.platform === 'win32') {
      icon = nativeImage.createFromPath(
        path.join(__dirname, `assets/icons/${red ? 'tray-icon-red' : 'tray-icon'}.png`)
      );
    }
    if (icon.isEmpty()) {
      icon = nativeImage.createFromDataURL(
        `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`
      );
    }
    const size = process.platform === 'darwin' ? 22 : 16;
    const { width } = icon.getSize();
    if (width !== size) icon = icon.resize({ width: size, height: size });
    return icon;
  }

  createTray() {
    try {
      tray = new Tray(this.loadTrayIcon(false));
      this.updateContextMenu();
      if (process.platform === 'darwin') {
        tray.on('double-click', () => this.startBreak());
      }
    } catch (error) {
      console.error('Error creating tray:', error);
    }
  }

  updateTrayIcon() {
    try { tray.setImage(this.loadTrayIcon(missedBreaks >= 3)); }
    catch (error) { console.error('Error updating tray icon:', error); }
  }

  updateContextMenu() {
    const minsLeft = nextBreakAt
      ? Math.max(0, Math.ceil((nextBreakAt - Date.now()) / 60000))
      : null;
    const statusLabel = isPaused
      ? 'Status: Paused'
      : minsLeft !== null
        ? `Next break in ${minsLeft <= 1 ? '<1' : minsLeft}m`
        : 'Starting…';

    const contextMenu = Menu.buildFromTemplate([
      { label: statusLabel, enabled: false },
      { type: 'separator' },
      { label: 'Take Break Now', click: () => this.startBreak(), accelerator: 'CommandOrControl+Shift+B' },
      { label: isPaused ? 'Resume Breaks' : 'Pause Breaks', click: () => this.togglePause() },
      { type: 'separator' },
      { label: 'Settings', click: () => this.openSettings() },
      { label: 'Statistics', click: () => this.openStatistics() },
      { type: 'separator' },
      { label: 'About', click: () => this.showAbout() },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); }, accelerator: 'CommandOrControl+Q' }
    ]);
    tray.setContextMenu(contextMenu);
  }

  // ── Shortcuts ─────────────────────────────────────────────────────────────

  registerShortcuts() {
    globalShortcut.register('CommandOrControl+Shift+P', () => {
      if (isBreakActive) this.postponeBreak();
    });
    globalShortcut.register('CommandOrControl+Shift+K', () => {
      if (isBreakActive) this.skipBreak();
    });
    globalShortcut.register('CommandOrControl+Shift+B', () => this.startBreak());
  }

  // ── Break lifecycle ───────────────────────────────────────────────────────

  startBreak() {
    if (isBreakActive) return;
    isBreakActive = true;
    this.startBreakTimer();

    const settings = store.get('settings');
    this.showNotification('Time for a 20-second eye break! 👀');
    this.createCountdownWindows(settings);
    store.updateStatistic('lastBreakTime', new Date().toISOString());
  }

  createCountdownWindows(settings) {
    const displays = screen.getAllDisplays();
    this.closeAllCountdownWindows();

    // Build background config to send to renderer
    const bgConfig = this.buildBackgroundConfig(settings);

    displays.forEach((display, index) => {
      const { bounds } = display;
      const win = new BrowserWindow({
        x: bounds.x, y: bounds.y,
        width: bounds.width, height: bounds.height,
        fullscreen: true, alwaysOnTop: true,
        frame: false, transparent: true,
        skipTaskbar: true, focusable: true, show: false,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false
        }
      });

      win.loadFile(path.join(__dirname, 'renderer/countdown.html'));

      win.once('ready-to-show', () => {
        win.show();
        win.webContents.send('start-countdown', {
          duration: settings.breakDuration,
          message: settings.reminderMessage
        });
        win.webContents.send('background-config', bgConfig);
      });

      win.on('closed', () => {
        const i = countdownWindows.indexOf(win);
        if (i > -1) countdownWindows.splice(i, 1);
        if (countdownWindows.length === 0) isBreakActive = false;
      });

      countdownWindows.push(win);
      if (index === 0) mainWindow = win;
    });
  }

  buildBackgroundConfig(settings) {
    const mode = settings.backgroundMode || 'default';

    if (mode === 'gradient') {
      return {
        mode: 'gradient',
        gradientStart: settings.gradientStart || '#0a0e27',
        gradientEnd: settings.gradientEnd || '#0d2137',
        gradientAngle: settings.gradientAngle != null ? settings.gradientAngle : 135
      };
    }

    if (mode === 'images' && settings.backgroundImages && settings.backgroundImages.length > 0) {
      const dir = this.ensureBackgroundsDir();
      const urls = settings.backgroundImages
        .filter(fname => fs.existsSync(path.join(dir, fname)))
        .map(fname => `file://${path.join(dir, fname).replace(/\\/g, '/')}`);

      if (urls.length > 0) {
        return { mode: 'images', urls };
      }
    }

    return { mode: 'default' };
  }

  closeAllCountdownWindows() {
    countdownWindows.forEach(win => { if (!win.isDestroyed()) win.close(); });
    countdownWindows = [];
    isBreakActive = false;
  }

  postponeBreak() {
    this.closeAllCountdownWindows();
    const settings = store.get('settings');
    const postponeMs = settings.postponeDuration * 60 * 1000;
    if (breakTimer) clearTimeout(breakTimer);
    nextBreakAt = new Date(Date.now() + postponeMs);
    this.scheduleNext(nextBreakAt);
    this.updateTrayTooltip();
    this.updateContextMenu();
    this.showNotification(`Break postponed ${settings.postponeDuration}m. Don't forget! 🕐`);
  }

  skipBreak() {
    this.closeAllCountdownWindows();
    missedBreaks++;
    const stats = store.get('statistics');
    stats.skippedBreaks++;
    stats.totalBreaks++;
    store.set('statistics', stats);
    store.incrementDailyStat('skipped');
    this.updateTrayIcon();
    this.showNotification('Break skipped. Remember to rest your eyes! 👁️');
  }

  togglePause() {
    isPaused = !isPaused;
    if (isPaused) { if (breakTimer) clearTimeout(breakTimer); nextBreakAt = null; }
    else { this.startBreakTimer(); }
    this.updateContextMenu();
    this.updateTrayTooltip();
    this.showNotification(isPaused ? 'Breaks paused' : 'Breaks resumed');
  }

  // ── Windows ───────────────────────────────────────────────────────────────

  openSettings() {
    if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.focus(); return; }
    settingsWindow = new BrowserWindow({
      width: 560, height: 720, resizable: false,
      title: `${APP_NAME} — Settings`,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
    });
    settingsWindow.loadFile(path.join(__dirname, 'renderer/settings.html'));
    settingsWindow.on('closed', () => { settingsWindow = null; });
  }

  openStatistics() {
    if (statisticsWindow && !statisticsWindow.isDestroyed()) { statisticsWindow.focus(); return; }
    statisticsWindow = new BrowserWindow({
      width: 640, height: 540, resizable: false,
      title: `${APP_NAME} — Statistics`,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
    });
    statisticsWindow.loadFile(path.join(__dirname, 'renderer/statistics.html'));
    statisticsWindow.on('closed', () => { statisticsWindow = null; });
  }

  showAbout() {
    const detail = `Version 1.0.0\n\nProtects your vision with the 20-20-20 rule.\n\nMade with ❤️ by Saurabh Mukhekar\nhttps://www.blogsaays.com`;

    if (process.platform === 'darwin') {
      const iconPath = path.join(__dirname, 'assets/icons/app-icon.icns');
      const icon = nativeImage.createFromPath(iconPath);
      app.setAboutPanelOptions({
        applicationName: APP_NAME,
        applicationVersion: '1.0.0',
        version: '',
        copyright: `Made with ❤️ by Saurabh Mukhekar\nhttps://www.blogsaays.com\n\nProtects your vision with the 20-20-20 rule.`,
        ...(icon.isEmpty() ? {} : { iconPath })
      });
      app.showAboutPanel();
      return;
    }

    const iconExt = process.platform === 'win32' ? 'ico' : 'png';
    const iconPath = path.join(__dirname, `assets/icons/app-icon.${iconExt}`);
    const icon = nativeImage.createFromPath(iconPath);
    dialog.showMessageBox({
      type: 'info',
      title: `About ${APP_NAME}`,
      message: APP_NAME,
      detail,
      buttons: ['OK'],
      ...(icon.isEmpty() ? {} : { icon })
    });
  }

  // ── Notifications & Sound ─────────────────────────────────────────────────

  showNotification(message) {
    new Notification({ title: APP_NAME, body: message, silent: false }).show();
  }

  playSound() {
    const soundPath = path.join(__dirname, 'assets/sounds/complete.mp3');
    try {
      if (process.platform === 'darwin') {
        require('child_process').exec(`afplay "${soundPath}"`, (err) => { if (err) this.systemBeep(); });
      } else if (process.platform === 'win32') {
        require('child_process').exec(
          `powershell -c (New-Object Media.SoundPlayer "${soundPath}").PlaySync()`,
          (err) => { if (err) this.systemBeep(); }
        );
      } else {
        require('child_process').exec(
          `paplay "${soundPath}" || aplay "${soundPath}" || ffplay -nodisp -autoexit "${soundPath}"`,
          (err) => { if (err) this.systemBeep(); }
        );
      }
    } catch { this.systemBeep(); }
  }

  systemBeep() {
    if (process.platform === 'darwin') {
      require('child_process').exec('afplay /System/Library/Sounds/Glass.aiff');
    } else {
      shell.beep();
    }
  }
}

new OptiRest();
