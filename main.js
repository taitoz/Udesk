//handle setup events as quickly as possible
const setupEvents = require('./installers/setupEvents')
if (setupEvents.handleSquirrelEvent()) {
    // squirrel event handled and app will exit in 1000ms, so don't do anything else
    return;
}

// Module to control application life.
let path = require('path')
// Module to create native browser window.
const {BrowserView, BrowserWindow, ipcMain, Menu, nativeTheme,
    app, Tray, dialog} = require('electron')

const log = require('electron-log/main');
log.initialize()

const server = 'https://udesk-upd-srv.vercel.app'
//const url = `${server}/update/${process.platform}/${app.getVersion()}`
const url = `${server}/update/win32/${app.getVersion()}`
log.info(app.getVersion())

const updater = require('electron-simple-updater');
// updater.init({
//     url:'https://raw.githubusercontent.com/taitoz/UdeskUpdSrv/main/updates.json',
//     checkUpdateOnStart: true,
//     autoDownload: true,
//     disabled: false,
//     logger: {
//         info(...args) { log.info('update-log', 'info', ...args) },
//         warn(...args) { log.warn('update-log', 'warn', ...args) },
//         error(...args) { log.error('update-log', 'error', ...args)}
//     }
// });

updater.init('https://raw.githubusercontent.com/taitoz/UdeskUpdSrv/main/updates.json');

log.info(updater.buildId)

updater
    .on('checking-for-update', (event, releaseNotes, releaseName) => {
        log.info('checking-for-update')
})
    .on('update-not-available', () => {
        log.info('update-not-available')
})
    .on('update-available', (event, releaseNotes, releaseName) => {
        log.info('update-available')
})
    .on('update-downloaded', (event, releaseNotes, releaseName) => {
    const dialogOpts = {
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail:
            'A new version has been downloaded. Restart the application to apply the updates.'
    }

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) updater.quitAndInstall()
    })
})
.on('error', (message) => {
    log.error('There was a problem updating the application')
    log.error(message)
})


const ElectronPreferences = require('electron-preferences');
const prefOptions = require('./preferences/pref-options.js');
const preferences = new ElectronPreferences(prefOptions)

nativeTheme.themeSource = preferences.preferences?.theme?.theme ?? 'dark';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let sidebar
let titleBar
let mainView

let i18n = new (require('./translations/i18n'))
let sidebarWidth = 70
let titleBarHeight = 30

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('ignore-certificate-errors')

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1280,
        minHeight: 800,
        frame: false, // Use to linux
        //backgroundColor: '#3f4254',
        //show: false,
        icon: path.join(__dirname, 'assets/ico/logo.ico'),
        // webPreferences: {
        //   offscreen: true
        // }
        //titleBarStyle: 'hidden',
        //titleBarOverlay: false,
        webPreferences: {
            sandbox: false,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    titleBar = new BrowserView({
        webPreferences: {
            preload: path.join(__dirname, 'panels', 'panelsPreload.js')
        }
    })
    mainWindow.addBrowserView(titleBar)
    titleBar.setBounds({x: 0, y: 0, width: mainWindow.getBounds().width, height: titleBarHeight})
    titleBar.setAutoResize({width: true, height: false})

    sidebar = new BrowserView({
        webPreferences: {
            preload: path.join(__dirname, 'panels', 'panelsPreload.js')
        }
    })
    mainWindow.addBrowserView(sidebar)
    sidebar.setBounds({x: 0, y: titleBarHeight, width: sidebarWidth, height: mainWindow.getBounds().height})
    sidebar.setAutoResize({width: false, height: true})

    mainView = new BrowserView()
    mainWindow.addBrowserView(mainView)
    mainView.setAutoResize({width: true, height: true})
    mainView.setBounds({
        x: sidebarWidth,
        y: titleBarHeight,
        width: mainWindow.getBounds().width - sidebarWidth,
        height: mainWindow.getBounds().height - titleBarHeight
    })

    // and load the index.html of the app.
    //mainWindow.loadFile('index.html')
    //setTimeout(() => titleBar.webContents.loadFile(path.join(__dirname, 'panels', 'titlebar.html')), 0)
    titleBar.webContents.loadFile(path.join(__dirname, 'panels', 'titlebar.html'))
    //setTimeout(() => sidebar.webContents.loadFile(path.join(__dirname, 'panels', 'sidebar.html')), 0)
    sidebar.webContents.loadFile(path.join(__dirname, 'panels', 'sidebar.html'))
    //setTimeout(() => mainView.webContents.loadURL('https://uchet.kz/month/'), 1000)
    mainView.webContents.loadFile(`index.html`)
    //if (navigator.onLine) {mainWindow.loadURL(`https://uchet.kz`)} else {mainWindow.loadURL(`index.html`)}

    // Open the DevTools.
    //mainWindow.webContents.openDevTools()

    // catch resize event emitted on window
    mainWindow.on('resize', function () {
        //resizeMain()
    })

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })

    //TODO
    //require('./mainmenu')

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    mainView.webContents.on('did-start-navigation', function () {
        //mainView.hide()
        //mainView.setBounds({x: sidebarWidth, y: 0, width: 0, height: 0})
    })
    mainView.webContents.on('did-navigate', function () {
        //mainView.show()
        //mainView.setBounds({x: sidebarWidth, y: 0, width: mainWindow.getBounds().width - sidebarWidth, height: mainWindow.getBounds().height})
    })

}

function resizeMain() {
    // store window's new size in variable
    let newBounds = mainWindow.getBounds()
    // set BrowserView's bounds explicitly
    sidebar.setBounds({x: 0, y: titleBarHeight, width: sidebarWidth, height: newBounds.height})
    mainView.setBounds({
        x: sidebarWidth,
        y: titleBarHeight,
        width: newBounds.width - sidebarWidth,
        height: newBounds.height
    })
}

function get() {
    return mainView;
}

// Export the publicly available functions.
module.exports = {get};

app.whenReady().then(() => {
    //const icon = nativeImage.createFromPath()
    const tray = new Tray(path.join(__dirname, "assets", "ico", "logo.ico"))
    const trayMenu = Menu.buildFromTemplate([
        {
            label: i18n.__('Close'),
            click: () => {
                app.quit()
            }
        }
    ])
    tray.setContextMenu(trayMenu)
    tray.setToolTip('UDesk')
    tray.setTitle('UDesk')
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        //mainWindow.removeBrowserView(mainView)
        //mainWindow.removeBrowserView(sidebar)
        app.quit()
    }
})

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) createWindow()
})
// You can also put them in separate files and require them here
// =====================================================================================
preferences.on('save', preferences => {
    //console.log('Preferences were saved.', JSON.stringify(preferences, null, 4));
    nativeTheme.themeSource = preferences?.theme?.theme ?? 'system';
});
preferences.on('click', (key) => {
    if (key === 'do-action-on-main') {
        console.log('We are logging something in the main process because of a button click in the preferences window!');
    }
});
nativeTheme.on("updated", () => {
    titleBar.webContents.send('theme-toggle', nativeTheme.themeSource);
    sidebar.webContents.send('theme-toggle', nativeTheme.themeSource);
    // if (nativeTheme.shouldUseDarkColors) {
    //     console.log("Dark Theme Chosen by User");
    // } else {
    //     console.log("Light Theme Chosen by User");
    // }
});

// =====================================================================================
ipcMain.handle('win-back', () => {
    mainView.webContents.goBack()
})
ipcMain.handle('win-reload', () => {
    mainView.webContents.reload()
})
ipcMain.handle('win-close', () => {
    mainWindow.close()
})
ipcMain.handle('win-minimize', () => {
    mainWindow.minimize()
})
ipcMain.handle('win-maximize', () => {
    (mainWindow.isMaximized()) ? mainWindow.unmaximize() : mainWindow.maximize()
    resizeMain()
})
ipcMain.handle('settings-open', () => {
    preferences.show()
})

ipcMain.handle('load-url', (event, url) => {
    //console.log(url)
    //dialog.showErrorBox('loadService', arg)
    //event.reply('asynchronous-reply', 'pong')
    mainView.webContents.loadURL(url)
})

ipcMain.handle('sidebar-toggle', (event, arg) => {
    //TODO send to renderer
    sidebarWidth = sidebar.getBounds().width
    switch (sidebarWidth) {
        case 70:
            sidebarWidth = 260;
            break;
        case 260:
            sidebarWidth = 70
            break;
    }
    resizeMain()
})
