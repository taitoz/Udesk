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
import {getMenu} from "./mainMenu.js";

// App logs
import appLog from 'electron-log'
//%USERPROFILE%\AppData\Roaming\electron-gzk-bot\logs\
appLog.transports.file.fileName = Date.now() + ".log"
Object.assign(console, appLog.functions);

// App config
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('ignore-certificate-errors')
app.commandLine.appendSwitch('--disable-background-timer-throttling')
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('--disable-renderer-backgrounding')
const singleInstanceLock = app.requestSingleInstanceLock()
import cfg from 'electron-cfg';

let appConfig
let profileJson = cfg.create('profiles.json')
loadAppCfgFromProfile()

// App updater
import {initUpdater} from "./updater.js";
import updater from 'electron-simple-updater';
//appLog.info(updater.buildId)
initUpdater();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let appTray
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
    let url = getProfileKey(0, 'homeUrl')
    if (url) {
        mainView.webContents.loadURL(url).then()
    } else {
        openSettings()
    }

    // DevTools.
    // mainWindow.webContents.openDevTools({mode: 'detach'});
    settingsView.webContents.openDevTools({mode: 'detach'});
    // sideBar.webContents.openDevTools({mode: 'detach'});
    // sideMenu.webContents.openDevTools({mode: 'detach'});

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
            appTray = new Tray(getProfileLogoPath())
            const trayMenu = Menu.buildFromTemplate([
                {
                    label: translate('Close'),
                    click: () => {
                        app.quit()
                    }
                }
            ])
            appTray.setContextMenu(trayMenu)
            appTray.setToolTip('UDesk')
            appTray.setTitle('UDesk')
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

ipcMain.handle('load-url', (event, args) => {
    //dialog.showErrorBox('loadService', arg)
    sideMenuWidth = 0
    try {
        new URL(args[0])
    } catch (err) {
        return
    }
    mainView.webContents.loadURL(args[0])
        .catch(error => {
            console.log(error.code)
        })
})

ipcMain.handle('open:settings', () => {
    sideMenuWidth = 0
    openSettings();
})
ipcMain.on('sideMenu:toggle', (event, args) => {
    sideMenuWidth = sideMenu.getBounds().width
    switch (sideMenuWidth) {
        case 0:
            sideMenuWidth = 230
            loadPrimeComponent(sideMenu, 'sideMenu/' + args[0]);
            break;
        case 230:
            sideMenuWidth = 0
            break;
    }
    resizeMain()
})
ipcMain.on('settings:toggleTheme', (event, args) => {
    nativeTheme.themeSource = args[0]
    appConfig.set('theme', args[0])
})

ipcMain.on('sideBar:logo:get', (event, args) => {
    event.returnValue = getProfileLogoPath(args[0])
})
ipcMain.handle('sideBar:logo:set', async (event, args) => {
    await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
        title: "",
        properties: ['openFile'],
        filters: [
            {name: 'Images', extensions: ['jpg', 'png', 'gif']}
        ]
    }).then(function (response) {
        if (!response.canceled) {
            setProfileLogo(response.filePaths[0], args[0])
        } else {
            //console.log("no file selected");
        }
    })
})

ipcMain.on('sideBarMenu:get', (event, args) => {
    event.returnValue = appConfig.get(args[0])
})
ipcMain.on('sideBarMenu:set', (event, args) => {
    appConfig.set('servicesMenu', args[0])
    loadPrimeComponent(sideMenu, 'sideMenu/services')
})

ipcMain.on('profiles:get', (event) => {
    event.returnValue = getProfiles()
})
ipcMain.handle('profiles:setActive', async (event, args) => {
    await setActiveProfile(args[0])
    //app.relaunch()
    //app.exit()
})
ipcMain.on('profiles:add', () => {
    addProfile().then()
})
ipcMain.on('profiles:delete', (event, args) => {
    let profileList = getProfiles()
    let index = profileList.findIndex(p => p.id === args[0])
    if (index !== -1) profileList.splice(index, 1)
    let appConfigPath = app.getPath('userData') + '/settings/profile-id-' + args[0] + '.json'
    fs.rmSync(appConfigPath)
    profileJson.set("profiles", profileList)
})
ipcMain.on('profiles:getProfileKey', (event, args) => {
    event.returnValue = getProfileKey(args[0], args[1])
})
ipcMain.handle('profiles:setProfileKey', async (event, args) => {
    let profileList = getProfiles()
    //const profileListCopy = structuredClone(profileList)
    const profile = profileList.find(p => p.id === args[0])
    profile.data.forEach(data => {
        if (data.key === args[1]) {
            data.value = args[2]
        }
    })
    profileJson.set("profiles", profileList)
    return profileList
})

ipcMain.on('file:export', (event, args) => {
    dialog.showSaveDialog({
        defaultPath: args[1],
        filters: [
            {name: 'JSON', extensions: ['json']}
        ]
    }).then(result => {
        if (!result.canceled) {
            const filePath = result.filePath;
            fs.writeFileSync(filePath, args[0], 'utf-8');
        }
    });
})
ipcMain.handle('file:import', async (event, args) => {
    dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            {name: 'JSON Files', extensions: ['json']}
        ]
    }).then(result => {
        if (!result.canceled) {
            const filePath = result.filePaths[0]; // Get the selected file path

            try {
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const jsonData = JSON.parse(fileContent);
                loadAppCfgFromProfile(args[0])
                appConfig.set('servicesMenu', jsonData)
                // console.log(jsonData)
                return jsonData

            } catch (error) {
                console.error('Error reading or parsing JSON file:', error);
            }
        }
    });
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

// https://github.com/electron/electron/blob/main/docs/api/app.md#appgetpathname
function getProfileLogoPath(profileId) {
    let logoName
    if (!profileId) {
        logoName = getProfileKey(0, 'logo')
    } else {
        logoName = getProfileKey(profileId, 'logo')
    }

    const logoPath = path.join(app.getPath('userData'), 'settings', 'logo', logoName)
    if (!fs.existsSync(logoPath)) {
        fs.cpSync(
            path.join(__dirname, 'assets', `logo48b.png`),
            logoPath
        )
    }
    return logoPath
}

function updateAppLogo(logoPath) {
    sideBar.webContents.send('logo-update', logoPath)
    mainWindow.setIcon(logoPath)
    appTray.setImage(logoPath)
}

function setProfileLogo(newLogoPath, profileId) {
    let profileList = getProfiles()
    let index = profileList.findIndex(p => p.id === profileId)
    const logoName = (newLogoPath.includes('/'))
        ? newLogoPath.split("/").pop()
        : newLogoPath.split("\\").pop()
    const logoPath = path.join(app.getPath('userData'), 'settings', 'logo', logoName)
    fs.cpSync(newLogoPath, logoPath)
    profileList[index].data.forEach(data => {
        if (data.key === 'logo') {
            data.value = logoName
        }
    })
    profileJson.set("profiles", profileList)
    if (index === 0) {
        updateAppLogo(logoPath);
    }
}

function getProfileKey(profileId, keyName) {
    let profileList = getProfiles()
    if (profileId === 0) {
        return profileList[profileId].data.find(p => p.key === keyName).value
    } else {
        let index = profileList.findIndex(p => p.id === profileId)
        return profileList[index].data.find(p => p.key === keyName).value
    }
}

function getProfiles() {
    return profileJson.get("profiles")
}

function setActiveProfile(profileId) {
    let profileList = getProfiles()
    let index = profileList.findIndex(p => p.id === profileId)
    if (index !== -1) {
        profileList.unshift(...profileList.splice(index, 1))
        profileJson.set("profiles", profileList)
        loadAppCfgFromProfile(profileId)
        updateAppLogo(getProfileLogoPath(profileId))
    }
}

async function addProfile() {

    let profileList = getProfiles()
    const newFromFile = loadDefaultFromFile('profile-default.json')
    if (profileList.length >= 1) {
        newFromFile.id = Date.now()
        // let date = new Date(newFromFile.id).toISOString().slice(0, 19).replace('T', ' ')
        let newName = "New Profile " + newFromFile.id
        profileList.forEach(profile => {
            if (getProfileKey(profile.id, 'name') === newName) {
                newName += '_'
            }
        })
        newFromFile.data.find(p => p.key === 'name').value = newName
    }
    profileList.push(newFromFile)
    profileJson.set("profiles", profileList)

    appConfig = loadAppConfigFromProfile(newFromFile.id)
    if (!appConfig.has('servicesMenu')) {
        appConfig.set('servicesMenu', loadDefaultFromFile('services-default.json'))
    }
    if (!appConfig.has('web1cMenu')) {
        appConfig.set('web1cMenu', loadDefaultFromFile('web1c.json'))
    }
    if (!appConfig.has('theme')) {
        appConfig.set('theme', 'dark')
    }
}

function loadAppCfgFromProfile() {

    // profiles.observe('active', () => {
    // })
    if (!profileJson.has('profiles')) {
        profileJson.set('profiles', [])
        addProfile().then()
    }
    let profileList = getProfiles()
    appConfig = loadAppConfigFromProfile(profileList[0].id)

    nativeTheme.themeSource = appConfig.get('theme', 'dark')
}

function loadAppConfigFromProfile(profileId) {
    // C:\Users\user\AppData\Roaming\Udesk\settings.json
    // /home/developer/.config/Udesk/settings.json
    let appConfigPath = app.getPath('userData') + '/settings/profile-id-' + profileId + '.json'
    return cfg.create(appConfigPath)
}

