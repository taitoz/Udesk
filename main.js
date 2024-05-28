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
    app, Tray, dialog
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
let sidebar
let menubar
let titleBar
let mainView

let i18n = new (require('./translations/i18n'))
let sidebarWidth = 70
let menubarWidth = 230
let titleBarHeight = 34

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

    titleBar = new BrowserView({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            //preload: path.join(__dirname, 'panels', 'panelsPreload.js')
        }
    })
    mainWindow.addBrowserView(titleBar)
    titleBar.setBounds({x: 0, y: 0, width: mainWindow.getBounds().width, height: titleBarHeight})
    titleBar.setAutoResize({width: true, height: false})
    //titleBar.webContents.loadFile(path.join(__dirname, 'panels', 'titlebar.html')).then()
    titleBar.webContents.loadFile(path.join(__dirname, 'primeng-ui', 'dist', 'index.html')).then(() => {
        titleBar.webContents.send('loadComponent', 'titlebar');
    })

    sidebar = new BrowserView({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            //preload: path.join(__dirname, 'panels', 'panelsPreload.js')
        }
    })
    mainWindow.addBrowserView(sidebar)
    sidebar.setBounds({x: 0, y: titleBarHeight, width: sidebarWidth, height: mainWindow.getBounds().height})
    sidebar.setAutoResize({width: true, height: true})
    // sidebar.webContents.loadFile(path.join(__dirname, 'panels', 'sidebar.html')).then()
    sidebar.webContents.loadFile(path.join(__dirname, 'primeng-ui', 'dist', 'index.html')).then(() => {
        sidebar.webContents.send('loadComponent', 'sidebar');
    })

    menubar = new BrowserView({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            //preload: path.join(__dirname, 'panels', 'panelsPreload.js')
        }
    })
    mainWindow.addBrowserView(menubar)
    menubar.setBounds({x: sidebarWidth, y: titleBarHeight, width: menubarWidth, height: mainWindow.getBounds().height})
    menubar.setAutoResize({width: true, height: true})
    loadMenubar();

    mainView = new BrowserView({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    mainWindow.addBrowserView(mainView)
    mainView.setAutoResize({width: true, height: true})
    mainView.setBounds({
        x: (sidebarWidth + menubarWidth),
        y: titleBarHeight,
        width: mainWindow.getBounds().width - (sidebarWidth + menubarWidth),
        height: mainWindow.getBounds().height - titleBarHeight
    })

    // and load the index.html of the app.
    //mainWindow.loadFile('index.html')
    //setTimeout(() => mainView.webContents.loadURL('https://uchet.kz/month/'), 1000)
    //mainView.webContents.loadFile(`index.html`).then()
    mainView.webContents.loadFile(path.join(__dirname, 'primeng-ui', 'dist', 'index.html')).then(() => {
        mainView.webContents.send('loadComponent', '');
    })
    //if (navigator.onLine) {mainWindow.loadURL(`https://uchet.kz`)} else {mainWindow.loadURL(`index.html`)}

    // Open the DevTools.
    //mainWindow.webContents.openDevTools({mode: 'detach'});
    //mainView.webContents.openDevTools({ mode: 'detach' });
    sidebar.webContents.openDevTools({mode: 'detach'});
    //menubar.webContents.openDevTools({mode: 'detach'});

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
    sidebar.setBounds({
        x: 0,
        y: titleBarHeight,
        width: sidebarWidth,
        height: newBounds.height
    })
    menubar.setBounds({
        x: sidebarWidth,
        y: titleBarHeight,
        width: menubarWidth,
        height: newBounds.height
    })

    mainView.setBounds({
        x: (sidebarWidth + menubarWidth),
        y: titleBarHeight,
        width: newBounds.width - (sidebarWidth + menubarWidth),
        height: newBounds.height
    })
}

function loadMenubar(){
    const url = `file://${__dirname}/primeng-ui/dist/index.html`;
    menubar.webContents.loadURL(url).then(() => {
        menubar.webContents.send('loadComponent', 'menu');
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
nativeTheme.on("updated", () => {
    titleBar.webContents.send('theme-toggle', nativeTheme.themeSource);
    sidebar.webContents.send('theme-toggle', nativeTheme.themeSource);
    menubar.webContents.send('theme-toggle', nativeTheme.themeSource);
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
    if (mainView.webContents.getURL().includes('settings')) return;
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
    mainView.webContents.loadFile(path.join(__dirname, 'primeng-ui', 'dist', 'index.html')).then()
})

ipcMain.handle('load-url', (event, url) => {
    //console.log(url)
    //dialog.showErrorBox('loadService', arg)
    //event.reply('asynchronous-reply', 'pong')
    mainView.webContents.loadURL(url).then()
})

ipcMain.handle('menubar-toggle', (event, arg) => {
    menubarWidth = menubar.getBounds().width
    switch (menubarWidth) {
        case 0:
            menubarWidth = 230;
            break;
        case 230:
            menubarWidth = 0
            break;
    }
    //sidebar.webContents.send('sidebar-toggle');
    resizeMain()
})

ipcMain.on('settings:toggleTheme', (event, theme) => {
    //console.log(theme)
    nativeTheme.themeSource = theme;
})
ipcMain.on('sideBarMenu:set', (event, sideBarMenu) => {
    settings.setSync('sideBarMenu', sideBarMenu);
    loadMenubar();
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
