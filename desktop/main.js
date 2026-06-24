const { app, BrowserWindow, globalShortcut, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
let win;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Chips Gestion Pro',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadURL('https://refait-total.vercel.app');

  win.on('closed', () => { win = null; });
  win.on('page-title-updated', (e) => e.preventDefault());
}

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdates();
  globalShortcut.register('CommandOrControl+R', () => {
    if (win) win.webContents.reload();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

autoUpdater.on('update-available', (info) => {
  if (win) {
    win.webContents.executeJavaScript(`
      if (confirm('Une mise à jour est disponible (v${info.version}). Télécharger maintenant ?')) true;
      else false;
    `).then((download) => {
      if (download) autoUpdater.downloadUpdate();
    });
  }
});

autoUpdater.on('update-downloaded', () => {
  if (win) {
    win.webContents.executeJavaScript(`
      confirm('Mise à jour téléchargée. Redémarrer pour installer ?');
    `).then((restart) => {
      if (restart) autoUpdater.quitAndInstall(false, true);
    });
  }
});
