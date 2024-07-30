import {
    BrowserView, BrowserWindow, ipcMain, Menu, nativeTheme,
    app, Tray, dialog, screen, globalShortcut
} from 'electron'


import path, {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import fs from 'fs';

import {loadTranslation, translate} from './translations/i18n.js'
import {getMenu} from "./mainmenu.js";

import appLog from 'electron-log'
//%USERPROFILE%\AppData\Roaming\electron-gzk-bot\logs\
appLog.transports.file.fileName = Date.now() + ".log"
Object.assign(console, appLog.functions);

import cfg from 'electron-cfg';

let appConfig
let profiles = cfg.create('profiles.json')
let activeProfile
loadProfile()

const singleInstanceLock = app.requestSingleInstanceLock()

//const server = 'https://udesk-upd-srv.vercel.app'
/*
import updater from 'electron-simple-updater';
appLog.info(updater.buildId)
updater
    .init({
        url: 'https://raw.githubusercontent.com/taitoz/UdeskUpdSrv/main/updates.json',
        checkUpdateOnStart: true,
        autoDownload: true,
        disabled: false,
        logger: {
            info(...args) {
                appLog.info('update-log', 'info', ...args)
            },
            warn(...args) {
                appLog.warn('update-log', 'warn', ...args)
            },
            error(...args) {
                appLog.error('update-log', 'error', ...args)
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
        appLog.error('There was a problem updating the application')
        appLog.error(message)
    })
*/
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let sideBar
let sideMenu
let titleBar
let mainView
let settingsView

let sideBarWidth = 70
let sideMenuWidth = 0
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
        icon: getLogoPath(),
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

    mainView = new BrowserView()
    mainWindow.addBrowserView(mainView)
    mainView.setAutoResize({width: true, height: true})
    mainView.setBounds({
        x: (sideBarWidth + sideMenuWidth),
        y: titleBarHeight,
        width: mainWindow.getBounds().width - (sideBarWidth + sideMenuWidth),
        height: mainWindow.getBounds().height - titleBarHeight
    })

    settingsView = new BrowserView({webPreferences: {nodeIntegration: true, contextIsolation: false}})
    settingsView.setAutoResize({width: true, height: true})
    settingsView.setBounds({
        x: (sideBarWidth + sideMenuWidth),
        y: titleBarHeight,
        width: mainWindow.getBounds().width - (sideBarWidth + sideMenuWidth),
        height: mainWindow.getBounds().height - titleBarHeight
    })

    // and load the index.html.bak of the app.
    //mainWindow.loadFile('index.html.bak')
    //mainView.webContents.loadFile(`index.html.bak`).then()
    //setTimeout(() => mainView.webContents.loadURL('https://uchet.kz/'), 1000)
    //if (navigator.onLine) {mainWindow.loadURL(`https://uchet.kz`)} else {mainWindow.loadURL(`index.html`)}
    if (activeProfile['homeUrl']) {
        mainView.webContents.loadURL(activeProfile['homeUrl']).then()
    } else {
        openSettings()
    }

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

    settingsView.setBounds({
        x: (sideBarWidth + sideMenuWidth),
        y: titleBarHeight,
        width: newBounds.width - (sideBarWidth + sideMenuWidth),
        height: newBounds.height
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
if (!singleInstanceLock) {
    app.quit()
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })

    app.on('ready', function () {
        loadTranslation(app.getLocale())
        //const icon = nativeImage.createFromPath()
        try {
            const ret = globalShortcut.register('CommandOrControl+R', () => {
                app.relaunch();
                app.exit();
            })
            if (!ret) {
                console.log('registration failed')
            }
            const tray = new Tray(getLogoPath())
            const trayMenu = Menu.buildFromTemplate([
                {
                    label: translate('Close'),
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
        createWindow()
        //mainWindow.setMenu(Menu.buildFromTemplate(getMenu(mainWindow, app.getLocale())))
    })
}

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        //mainWindow.removeBrowserView(mainView)
        //mainWindow.removeBrowserView(sidebar)
        app.quit()
    }
    globalShortcut.unregisterAll()
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
    openSettings();
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

ipcMain.on('sideBar:logo:get', (event) => {
    event.returnValue = getLogoPath();
})

ipcMain.on('sideMenu:toggle', (event, menuId) => {
    sideMenuWidth = sideMenu.getBounds().width
    switch (sideMenuWidth) {
        case 0:
            sideMenuWidth = 230;
            loadPrimeComponent(sideMenu, 'sideMenu/' + menuId);
            break;
        case 230:
            sideMenuWidth = 0
            break;
    }
    resizeMain()
})

ipcMain.on('settings:toggleTheme', (event, theme) => {
    nativeTheme.themeSource = theme;
    appConfig.set('theme', theme);
})
ipcMain.on('services:set', (event, sideBarMenu) => {
    appConfig.set('servicesMenu', sideBarMenu);
    loadPrimeComponent(sideMenu, 'sideMenu/services');
})
ipcMain.on('services:get', (event) => {
    event.returnValue = appConfig.get('servicesMenu');
})
ipcMain.on('web1c:set', (event, sideBarMenu) => {
    appConfig.set('web1cMenu', sideBarMenu);
    loadPrimeComponent(sideMenu, 'sideMenu/web1c');
})
ipcMain.on('web1c:get', (event) => {
    event.returnValue = appConfig.get('web1cMenu');
})

ipcMain.on('profiles:get', (event) => {
    event.returnValue = getProfiles();
})

ipcMain.on('profiles:add', (event, profileJson) => {
    addProfile(profileJson.name, profileJson);
})

ipcMain.on('profiles:delete', (event, profileName) => {
    deleteProfile(profileName);
})

// =====================================================================================
function loadPrimeComponent(browserView, component) {
    const url = `file://${__dirname}/dist/index.html`;
    browserView.webContents.loadURL(url).then(() => {
        browserView.webContents.send('loadComponent', component);
    })
}

function initSettings() {
    if (!appConfig.has('servicesMenu')) {
        appConfig.set('servicesMenu', loadDefaultFromFile('services.json'))
    }
    if (!appConfig.has('web1cMenu')) {
        appConfig.set('web1cMenu', loadDefaultFromFile('web1c.json'))
    }
    if (!appConfig.has('theme')) {
        appConfig.set('theme', 'dark')
    }
}

function openSettings() {
    loadPrimeComponent(settingsView, 'settings');
    let views = mainWindow.getBrowserViews()
    if (views.indexOf(settingsView) === -1) {
        mainWindow.addBrowserView(settingsView)
    } else {
        mainWindow.removeBrowserView(settingsView)
    }
}

function loadDefaultFromFile(fileName) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', fileName), 'utf8'))
}

function getProfiles() {
    return profiles.get("profiles")
}

function addProfile(profileName, profileJson) {
    let profilesArr = getProfiles()
    if (!profilesArr.find(p => p.name === profileName)) {
        if (profileJson) {
            profilesArr.push(profileJson)
        } else {
            profilesArr.push(loadDefaultFromFile('profile-default.json'))
        }
        profiles.set("profiles", profilesArr)
    }
}

function deleteProfile(profileName) {
    let profilesArr = getProfiles().find(p => p.name !== profileName)
    profiles.set("profiles", profilesArr)
}

// https://github.com/electron/electron/blob/main/docs/api/app.md#appgetpathname
function getLogoPath() {
    const logoName = activeProfile['logo']
    const profileName = activeProfile['name']
    const logoPath = path.join(app.getPath('userData'), 'profiles', logoName + '-' + profileName + '.png')
    if (!fs.existsSync(logoPath)) {
        fs.cpSync(
            path.join(__dirname, 'assets', `logo48b.png`),
            logoPath
        )
    }
    return logoPath
}

function loadProfile() {
    //https://github.com/de-luca/electron-json-config
    //https://github.com/megahertz/electron-cfg
    //https://github.com/sindresorhus/electron-store

    //ipcMain.on('profiles:getSideBarIcon' => activeProfile['sideBarIcon']
    //ipcMain.on('profiles:add' ipcMain.on('profiles:delete'
    //ipcMain.on('profiles:setActive' => restart
    profiles.observe('active', () => {
    })

    if (!profiles.has('profiles')) {
        profiles.set('profiles', [])
        //add profiles vertical table
    }
    const profileName = profiles.get('active', 'default');
    activeProfile = getProfiles().find(p => p.name === profileName);

    if (!profiles.has('active') || !activeProfile) {
        addProfile('default')
        profiles.set('active', 'default')
        activeProfile = getProfiles().find(p => p.name === 'default');
    }

    // C:\Users\user\AppData\Roaming\Udesk\settings.json  // /home/developer/.config/Udesk/settings.json
    let appUserDataPath = app.getPath('userData');
    appConfig = cfg.create(appUserDataPath + '/profiles/settings-' + profileName + '.json')
    initSettings();

    nativeTheme.themeSource = appConfig.get('theme', 'dark');
}
