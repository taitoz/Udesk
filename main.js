import {
    BrowserView, BrowserWindow, ipcMain, Menu, nativeTheme,
    app, Tray, dialog, screen, globalShortcut
} from 'electron'


import path, {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import fs from 'fs';

// Localization
import {loadTranslation, translate} from './translations/i18n.js'
import {getMenu} from "./mainmenu.js";

// App logs
import appLog from 'electron-log'
//%USERPROFILE%\AppData\Roaming\electron-gzk-bot\logs\
appLog.transports.file.fileName = Date.now() + ".log"
Object.assign(console, appLog.functions);

// App config
const singleInstanceLock = app.requestSingleInstanceLock()
import cfg from 'electron-cfg';

let appConfig
let profiles = cfg.create('profiles.json')
let activeProfile
loadProfile()

// App updater
import updater from 'electron-simple-updater';
import {initUpdater} from "./src/updater.js";

appLog.info(updater.buildId)
initUpdater();

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

    const winCfg = cfg.window();

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 1280,
        minHeight: 850,
        frame: false, // Use to linux
        //backgroundColor: '#3f4254',
        //show: false,
        icon: getProfileLogoPath(),
        // webPreferences: {
        //   offscreen: true
        // }
        //titleBarStyle: 'hidden',
        //titleBarOverlay: false,
        webPreferences: {
            // sandbox: false,
            // preload: path.join(__dirname, 'preload.js')
        },
        ...winCfg.options(),
    })
    winCfg.assign(mainWindow);

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

    //mainWindow.loadFile('index.html')
    //mainView.webContents.loadFile(`index.html`).then()
    //setTimeout(() => mainView.webContents.loadURL('https://uchet.kz/'), 1000)
    //if (navigator.onLine) {mainWindow.loadURL(`https://uchet.kz`)} else {mainWindow.loadURL(`index.html`)}
    if (activeProfile['homeUrl']) {
        mainView.webContents.loadURL(activeProfile['homeUrl']).then()
    } else {
        openSettings()
    }

    // DevTools.
    //mainWindow.webContents.openDevTools({mode: 'detach'});
    //settingsView.webContents.openDevTools({mode: 'detach'});
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
            // const ret = globalShortcut.register('CommandOrControl+R', () => {
            //     app.relaunch();
            //     app.exit();
            // })
            // if (!ret) {
            //     console.log('registration failed')
            // }
            const tray = new Tray(getProfileLogoPath())
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
    event.returnValue = getProfileLogoPath()
})

ipcMain.on('sideBar:logo:set', (event, profileName) => {
    console.log(profileName)
    dialog.showOpenDialog(BrowserWindow.getFocusedWindow(),{
        title: "",
        properties: ['openFile'],
        filters: [
            { name: 'Images', extensions: ['jpg', 'png', 'gif'] }
        ]
    }).then(function (response) {
        if (!response.canceled) {
            // handle fully qualified file name
            console.log(response.filePaths[0]);
            console.log(response.filePaths[0].split("/").pop());
        } else {
            console.log("no file selected");
        }
    });
    //event.returnValue =
})

ipcMain.on('sideMenu:toggle', (event, menuId) => {
    sideMenuWidth = sideMenu.getBounds().width
    switch (sideMenuWidth) {
        case 0:
            sideMenuWidth = 230
            loadPrimeComponent(sideMenu, 'sideMenu/' + menuId);
            break;
        case 230:
            sideMenuWidth = 0
            break;
    }
    resizeMain()
})
ipcMain.on('settings:toggleTheme', (event, theme) => {
    nativeTheme.themeSource = theme
    appConfig.set('theme', theme)
})
ipcMain.on('services:set', (event, sideBarMenu) => {
    appConfig.set('servicesMenu', sideBarMenu)
    loadPrimeComponent(sideMenu, 'sideMenu/services')
})
ipcMain.on('services:get', (event) => {
    event.returnValue = appConfig.get('servicesMenu')
})
ipcMain.on('web1c:set', (event, sideBarMenu) => {
    appConfig.set('web1cMenu', sideBarMenu)
    loadPrimeComponent(sideMenu, 'sideMenu/web1c')
})
ipcMain.on('web1c:get', (event) => {
    event.returnValue = appConfig.get('web1cMenu')
})
ipcMain.on('profiles:get', (event) => {
    event.returnValue = getProfiles()
})
ipcMain.on('profiles:set', (event, profilesArr) => {
    profiles.set("profiles", profilesArr)
})
ipcMain.on('profiles:getActive', (event) => {
    event.returnValue = profiles.get('active', 'default')
})
ipcMain.on('profiles:setActive', (event, profileName) => {
    loadProfile(profileName)
    //app.relaunch()
    //app.exit()
})

// =====================================================================================
function loadPrimeComponent(browserView, component) {
    const url = `file://${__dirname}/dist/index.html`;
    browserView.webContents.loadURL(url).then(() => {
        browserView.webContents.send('loadComponent', component);
    })
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

// https://github.com/electron/electron/blob/main/docs/api/app.md#appgetpathname
function getProfileLogoPath() {
    const logoName = activeProfile['logo']
    const profileName = activeProfile['name']
    const logoPath = path.join(app.getPath('userData'), 'profiles', logoName + '-' + profileName + '.png')
    if (!fs.existsSync(logoPath)) {
        fs.cpSync(
            path.join(__dirname, 'assets', `logo48.png`),
            logoPath
        )
    }
    return logoPath
}

function setProfileLogo(newLogoPath, profileName){
    let profileList = getProfiles()
    const profile = profileList.find(p => p.name === profileName)
    profile['logo'] = newLogoPath
}

function loadProfile(profileName) {

    // profiles.observe('active', () => {
    // })

    if (!profiles.has('profiles')) {
        profiles.set('profiles', [])
    }
    let profileList = getProfiles()


    if (!profileName) {
        profileName = profiles.get('active', 'default')
    } else {
        profiles.set('active', profileName)
    }
    activeProfile = profileList.find(p => p.name === profileName)

    if (!profiles.has('active') || !activeProfile) {
        profileList.push(loadDefaultFromFile('profile-default.json'))
        profiles.set("profiles", profileList)
        profiles.set('active', 'default')
        activeProfile = profileList.find(p => p.name === 'default')
    }

    // C:\Users\user\AppData\Roaming\Udesk\settings.json
    // /home/developer/.config/Udesk/settings.json
    let appConfigPath = app.getPath('userData') + '/profiles/settings-' + profileName + '.json'
    appConfig = cfg.create(appConfigPath)
    initSettings();

    nativeTheme.themeSource = appConfig.get('theme', 'dark')
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
