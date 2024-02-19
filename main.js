//handle setup events as quickly as possible
const setupEvents = require('./installers/setupEvents')
if (setupEvents.handleSquirrelEvent()) {
    // squirrel event handled and app will exit in 1000ms, so don't do anything else
    return;
}

// Module to control application life.
let path = require('path')
// Module to create native browser window.
const {BrowserView, BrowserWindow, ipcMain, Menu, nativeImage, app, Tray, dialog,nativeTheme} = require('electron')

const ElectronPreferences = require('electron-preferences');
const prefOptions = require('./preferences/pref-options.js');
const preferences = new ElectronPreferences(prefOptions)

const { setupTitlebar, attachTitlebarToWindow } = require('custom-electron-titlebar/main')

// setup the titlebar main process
setupTitlebar();


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let sidebar
let mainView

let i18n = new (require('./translations/i18n'))
let sidebarWidth = 70

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('ignore-certificate-errors')

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        minWidth: 1024,
        minHeight: 768,
        useContentSize: true,
        //backgroundColor: '#3f4254',
        //show: false,
        icon: path.join(__dirname, 'assets/icons/48.ico'),
        // webPreferences: {
        //   offscreen: true
        // }
        titleBarStyle: 'hidden',
        titleBarOverlay: true,
        webPreferences: {
            sandbox: false,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    sidebar = new BrowserView({
        webPreferences: {
            preload: path.join(__dirname, 'sidebar', 'sidebarPreload.js')
        }
    })
    mainWindow.addBrowserView(sidebar)
    sidebar.setBounds({x: 0, y: 0, width: sidebarWidth, height: mainWindow.getBounds().height})
    sidebar.setAutoResize({width: true, height: false})

    mainView = new BrowserView()
    mainWindow.addBrowserView(mainView)
    sidebar.setAutoResize({width: true, height: false})
    mainView.setBounds({
        x: sidebarWidth,
        y: 0,
        width: mainWindow.getBounds().width - sidebarWidth,
        height: mainWindow.getBounds().height
    })

    // and load the index.html of the app.
    //mainWindow.loadFile('index.html')
    setTimeout(() => sidebar.webContents.loadFile(path.join(__dirname, 'sidebar','sidebar.html')), 1000)
    //setTimeout(() => mainView.webContents.loadURL('https://uchet.kz/month/'), 1000)
    //if (navigator.onLine) {mainWindow.loadURL(`https://uchet.kz`)} else {mainWindow.loadURL(`index.html`)}

    // Open the DevTools.
    //mainWindow.webContents.openDevTools()

    // catch resize event emitted on window
    mainWindow.on('resize', function () {
        resizeMain()
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

    /* const menu = Menu.buildFromTemplate(exampleMenuTemplate)
	Menu.setApplicationMenu(menu) */

    // Attach listeners
    attachTitlebarToWindow(mainWindow)

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

function resizeMain () {
    // store window's new size in variable
    let newBounds = mainWindow.getBounds()
    // set BrowserView's bounds explicitly
    sidebar.setBounds({x: 0, y: 0, width: sidebarWidth, height: newBounds.height})
    mainView.setBounds({x: sidebarWidth, y: 0, width: newBounds.width - sidebarWidth, height: newBounds.height})
}

function get() {
    return mainView;
}
// Export the publicly available functions.
module.exports = {get};

app.whenReady().then(() => {
    //const icon = nativeImage.createFromPath()
    const tray = new Tray(path.join(__dirname, "assets", "icons", "24.ico"))
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
    if (mainWindow === null) {
        createWindow()
    }
})

// =====================================================================================
// You can also put them in separate files and require them here.

ipcMain.handle('dark-mode:toggle', () => {
    if (nativeTheme.shouldUseDarkColors) {
        nativeTheme.themeSource = 'light'
    } else {
        nativeTheme.themeSource = 'dark'
    }
    return nativeTheme.shouldUseDarkColors
})

ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system'
})

ipcMain.handle('settings-open', () => {
    preferences.show();
})

ipcMain.handle('load-url', (event, url) => {
    //console.log(url) // prints "ping" in the Node console
    //dialog.showErrorBox('loadService', arg)
    //event.reply('asynchronous-reply', 'pong')
    mainView.webContents.loadURL(url)
})

ipcMain.handle('sidebar-toggle', (event, arg) => {
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
