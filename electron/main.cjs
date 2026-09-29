// CommonJS on purpose: package.json sets "type": "module", so this file needs the .cjs extension.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// `npm run electron:dev` runs unpackaged against the Vite dev server; release builds load the bundled files.
const DEV_SERVER_URL = 'http://localhost:3000';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    // public/ is copied into dist/ by Vite, and only dist/ is packaged
    icon: path.join(__dirname, '../dist/pwa-512x512.png'),
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    win.loadURL(DEV_SERVER_URL);
  }

  // Open external links in the user's default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
