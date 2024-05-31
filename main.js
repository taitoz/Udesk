//handle setup events as quickly as possible
// const setupEvents = require('./installers/setupEvents')
// if (setupEvents.handleSquirrelEvent()) {
// squirrel event handled and app will exit in 1000ms, so don't do anything else
//     return;
// }
const fs = require('fs')
// Module to control application life.
let path = require('path')
// Module to create native browser window.
const {
    BrowserView, BrowserWindow, ipcMain, Menu, nativeTheme,
    app, Tray, dialog, screen
} = require('electron')

const log = require('electron-log/main');
log.initialize()

//const server = 'https://udesk-upd-srv.vercel.app'

const updater = require('electron-simple-updater');
log.info(updater.buildId)
updater
    .init({
        url: 'https://raw.githubusercontent.com/taitoz/UdeskUpdSrv/main/updates.json',
        checkUpdateOnStart: true,
        autoDownload: true,
        disabled: false,
        logger: {
            info(...args) {
                log.info('update-log', 'info', ...args)
            },
            warn(...args) {
                log.warn('update-log', 'warn', ...args)
            },
            error(...args) {
                log.error('update-log', 'error', ...args)
            }
        }
    })
    .on('update-available', (event, releaseNotes, releaseName) => {
        const dialogOpts = {
            type: 'info',
            buttons: ['Ok'],
            title: 'Обновление',
            message: 'Доступно обновление, скачивание продолжится в фоновом режиме ' +
                'не закрывайте приложение до окончания загрузки',
            detail: process.platform === 'win32' ? releaseNotes : releaseName
        }
        dialog.showMessageBox(dialogOpts).then()
    })
    .on('update-downloaded', (event, releaseNotes, releaseName) => {
        const dialogOpts = {
            type: 'info',
            buttons: ['Обновить сейчас', 'Позже'],
            title: 'Обновление',
            message: process.platform === 'win32' ? releaseNotes : releaseName,
            detail: 'Новая версия готова к установке.'
        }
        dialog.showMessageBox(dialogOpts).then((returnValue) => {
            if (returnValue.response === 0) updater.quitAndInstall()
        })
    })
    .on('error', (message) => {
        log.error('There was a problem updating the application')
        log.error(message)
    })

const settings = require('electron-settings');
initSettings()

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let sideBar
let sideMenu
let titleBar
let mainView

let i18n = new (require('./translations/i18n'))
let sideBarWidth = 70
let sideMenuWidth = 230
let titleBarHeight = 32

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('ignore-certificate-errors')


function createWindow() {

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 1280,
        minHeight: 850,
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
            // sandbox: false,
            // preload: path.join(__dirname, 'preload.js')
        }
    })

    titleBar = new BrowserView({webPreferences: {nodeIntegration: true, contextIsolation: false}})
    mainWindow.addBrowserView(titleBar)
    titleBar.setBounds({x: 0, y: 0, width: mainWindow.getBounds().width, height: titleBarHeight})
    titleBar.setAutoResize({width: true, height: false})
    loadPrimeComponent(titleBar, 'titleBar')

    sideBar = new BrowserView({webPreferences: {nodeIntegration: true, contextIsolation: false}})
    mainWindow.addBrowserView(sideBar)
    sideBar.setBounds({x: 0, y: titleBarHeight, width: sideBarWidth, height: mainWindow.getBounds().height})
    sideBar.setAutoResize({width: false, height: true})
    loadPrimeComponent(sideBar, 'sideBar')

    sideMenu = new BrowserView({webPreferences: {nodeIntegration: true, contextIsolation: false}})
    mainWindow.addBrowserView(sideMenu)
    sideMenu.setBounds({
        x: sideBarWidth,
        y: titleBarHeight,
        width: sideMenuWidth,
        height: mainWindow.getBounds().height
    })
    sideMenu.setAutoResize({width: false, height: true})
    loadPrimeComponent(sideMenu, 'sideMenu');

    mainView = new BrowserView({webPreferences: {nodeIntegration: true, contextIsolation: false}})
    mainWindow.addBrowserView(mainView)
    mainView.setAutoResize({width: true, height: true})
    mainView.setBounds({
        x: (sideBarWidth + sideMenuWidth),
        y: titleBarHeight,
        width: mainWindow.getBounds().width - (sideBarWidth + sideMenuWidth),
        height: mainWindow.getBounds().height - titleBarHeight
    })

    // and load the index.html of the app.
    //mainWindow.loadFile('index.html')
    //setTimeout(() => mainView.webContents.loadURL('https://uchet.kz/'), 1000)
    //mainView.webContents.loadFile(`index.html`).then()
    // mainView.webContents.loadFile(path.join(__dirname, 'primeng-ui', 'dist', 'index.html')).then(() => {
    //     mainView.webContents.send('loadComponent', 'sidebar');
    // })
    loadPrimeComponent(mainView, 'settings');
    //if (navigator.onLine) {mainWindow.loadURL(`https://uchet.kz`)} else {mainWindow.loadURL(`index.html`)}

    // Open the DevTools.
    //mainWindow.webContents.openDevTools({mode: 'detach'});
    //mainView.webContents.openDevTools({mode: 'detach'});
    //sideBar.webContents.openDevTools({mode: 'detach'});
    //sideMenu.webContents.openDevTools({mode: 'detach'});

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
    //TODO store window's new size in settings
    let newBounds = mainWindow.getBounds()
    // set BrowserView's bounds explicitly
    // sideBar.setBounds({
    //     x: 0,
    //     y: titleBarHeight,
    //     width: sidebarWidth,
    //     height: newBounds.height
    // })

    sideMenu.setBounds({
        x: sideBarWidth,
        y: titleBarHeight,
        width: sideMenuWidth,
        height: newBounds.height
    })

    mainView.setBounds({
        x: (sideBarWidth + sideMenuWidth),
        y: titleBarHeight,
        width: newBounds.width - (sideBarWidth + sideMenuWidth),
        height: newBounds.height
    })
}

function loadPrimeComponent(browserView, component) {
    const url = `file://${__dirname}/primeng-ui/dist/index.html`;
    browserView.webContents.loadURL(url).then(() => {
        browserView.webContents.send('loadComponent', component);
    })
}

function get() {
    return mainView;
}

// Export the publicly available functions.
module.exports = {get};

app.whenReady().then(() => {
    //const icon = nativeImage.createFromPath()
    try {
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
    } catch (error) {
        console.log(error)
    }
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
nativeTheme.on("updated", () => {
    titleBar.webContents.send('theme-toggle', nativeTheme.themeSource);
    sideBar.webContents.send('theme-toggle', nativeTheme.themeSource);
    sideMenu.webContents.send('theme-toggle', nativeTheme.themeSource);
    // if (nativeTheme.shouldUseDarkColors) {
    //     console.log("Dark Theme Chosen by User");
    // } else {
    //     console.log("Light Theme Chosen by User");
    // }
});

// =====================================================================================
ipcMain.handle('back', () => {
    mainView.webContents.goBack()
})
ipcMain.handle('reload', () => {
    if (mainView.webContents.getURL().includes('primeng-ui')) return;
    mainView.webContents.reload()
})
ipcMain.handle('close', () => {
    mainWindow.close()
})
ipcMain.handle('minimize', () => {
    mainWindow.minimize()
})
ipcMain.handle('maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
    } else {
        mainWindow.maximize()
        let cursor = screen.getCursorScreenPoint()
        const currentScreen = screen.getDisplayNearestPoint({x: cursor.x, y: cursor.y})
        mainWindow.setBounds({
            width: currentScreen.workAreaSize.width,
            height: currentScreen.workAreaSize.height
        })
    }
    resizeMain()
})
ipcMain.handle('open:settings', () => {
    loadPrimeComponent(mainView, 'settings');
})

ipcMain.handle('load-url', (event, url) => {
    //dialog.showErrorBox('loadService', arg)
    try {
        new URL(url)
    } catch (err) {
        return
    }
    mainView.webContents.loadURL(url).catch(error => {
        console.log(error.code)
    })
})

ipcMain.handle('menubar-toggle', (event, arg) => {
    sideMenuWidth = sideMenu.getBounds().width
    switch (sideMenuWidth) {
        case 0:
            sideMenuWidth = 230;
            break;
        case 230:
            sideMenuWidth = 0
            break;
    }
    resizeMain()
})

ipcMain.on('settings:toggleTheme', (event, theme) => {
    //console.log(theme)
    nativeTheme.themeSource = theme;
})
ipcMain.on('sideBarMenu:set', (event, sideBarMenu) => {
    settings.setSync('sideBarMenu', sideBarMenu);
    loadPrimeComponent(sideMenu, 'sideMenu');
})
ipcMain.on('sideBarMenu:get', (event) => {
    event.returnValue = settings.getSync('sideBarMenu');
})

function initSettings() {
    //file path /home/developer/.config/Udesk/settings.json
    if (!settings.hasSync('sideBarMenu')) {
        fs.readFile(path.join(__dirname, 'primeng-ui', 'dist', 'assets', 'test.json'),
            'utf8', (err, data) => {
                settings.setSync('sideBarMenu', JSON.parse(data))
            });
    }
    if (!settings.hasSync('theme')) {
        settings.setSync('theme', 'dark')
    }
    nativeTheme.themeSource = settings.getSync('theme') ?? 'dark';
    //console.log()
}
