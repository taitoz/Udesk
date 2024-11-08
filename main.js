import {
    app,
    BrowserWindow,
    dialog,
    globalShortcut,
    ipcMain,
    Menu,
    nativeImage,
    nativeTheme,
    Tray,
    WebContentsView
} from 'electron'

import path, {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'fs';

// Localization
import {loadTranslation, translate} from './translations/i18n.js'
import {getMainViewMenu} from "./mainMenus.js";

// App logs
import appLog from 'electron-log'
import cfg from 'electron-cfg';

// App updater

// Puppeteer
import pie from 'puppeteer-in-electron'
import puppeteer from 'puppeteer-extra'
import {executePageActions} from "./mainPageActions.js";
import {
    addDefaultPageActions,
    addProfileFromDefault,
    deleteProfile,
    getActiveProfile, getPageAction, getPageActions,
    getProfile,
    getProfiles,
    importProfile,
    setActiveProfile,
    updateProfile
} from "./mainDb.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

let appCfg = cfg.create('config.json')

let puppeteerApp = puppeteer
await pie.initialize(app)
let page

//TODO to appCfg
const appIcon = nativeImage.createFromPath(
    path.join(__dirname, 'assets', `Udesk_logo.png`)
)

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let appTray
let sideBar
let sideMenu
let titleBar
let mainView
let settingsView

//TODO to appCfg
let sideBarWidth = 70
let sideMenuWidth = 0
let titleBarHeight = 34

function createWindow() {
    if (mainWindow) return

    const winCfg = appCfg.window()

    mainWindow = new BrowserWindow({
        width: 1200, height: 720, minWidth: 1200, minHeight: 720,
        backgroundColor: "#1c1c1c",
        titleBarStyle: "hidden",
        icon: appIcon,
        ...(process.platform === "linux" ? {icon: appIcon} : {}),
        trafficLightPosition: {x: 16, y: 16},
        titleBarOverlay: {
            symbolColor: "#DADBE1",
            color: "#1e1e1e",
            height: 32,
        },
        webPreferences: {
            //preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
        },
        ...winCfg.options(),
        //show: false,
    });

    winCfg.assign(mainWindow);

    titleBar = new WebContentsView({webPreferences: {nodeIntegration: true, contextIsolation: false}})
    mainWindow.contentView.addChildView(titleBar, 0)
    titleBar.setBounds({x: 0, y: 0, width: mainWindow.getBounds().width, height: titleBarHeight})
    loadPrimeComponent(titleBar, 'titleBar')
    // titleBar.webContents.on('context-menu', (event) => {
    //     event.preventDefault()
    //     Menu.buildFromTemplate(getMainViewMenu(titleBar)).popup()
    // })
    titleBar.webContents.openDevTools({mode: 'detach'});

    sideBar = new WebContentsView({webPreferences: {nodeIntegration: true, contextIsolation: false}})
    mainWindow.contentView.addChildView(sideBar, 1)
    sideBar.setBounds({x: 0, y: titleBarHeight, width: sideBarWidth, height: mainWindow.getBounds().height})
    loadPrimeComponent(sideBar, 'sideBar')
    sideBar.webContents.on('context-menu', () => {
        Menu.buildFromTemplate(getMainViewMenu(sideBar)).popup()
    })

    sideMenu = new WebContentsView({webPreferences: {nodeIntegration: true, contextIsolation: false}})
    mainWindow.contentView.addChildView(sideMenu, 2)
    sideMenu.setBounds({
        x: sideBarWidth, y: titleBarHeight, width: sideMenuWidth, height: mainWindow.getBounds().height
    })
    sideMenu.webContents.on('context-menu', () => {
        Menu.buildFromTemplate(getMainViewMenu(sideMenu)).popup()
    })

    mainView = new WebContentsView()
    mainWindow.contentView.addChildView(mainView, 3)
    mainView.setBounds({
        x: (sideBarWidth + sideMenuWidth),
        y: titleBarHeight,
        width: mainWindow.getBounds().width - (sideBarWidth + sideMenuWidth),
        height: mainWindow.getBounds().height - titleBarHeight
    })
    mainView.webContents.on('context-menu', () => {
        Menu.buildFromTemplate(getMainViewMenu(mainView)).popup()
    })
    mainView.webContents.on('input-event', (event, input) => {
        //event.preventDefault();
        if (input.type === 'rawKeyDown' && input.key === 'F5') {
            mainView.webContents.reload()
        }
    })

    settingsView = new WebContentsView({webPreferences: {nodeIntegration: true, contextIsolation: false}})
    settingsView.setBounds({
        x: (sideBarWidth + sideMenuWidth),
        y: titleBarHeight,
        width: mainWindow.getBounds().width - (sideBarWidth + sideMenuWidth),
        height: mainWindow.getBounds().height
    })
    settingsView.webContents.on('context-menu', () => {
        Menu.buildFromTemplate(getMainViewMenu(settingsView)).popup({window: settingsView.webContents})
    })

    //mainWindow.loadFile('index.html')
    //mainView.webContents.loadFile(`index.html`).then()
    //setTimeout(() => mainView.webContents.loadURL('https://uchet.kz/'), 1000)
    //if (navigator.onLine) {mainWindow.loadURL(`https://uchet.kz`)} else {mainWindow.loadURL(`index.html`)}

    // Puppeteer
    pie.connect(app, puppeteerApp).then(async browser => {
        pie.getPage(browser, mainView).then(async _page => {
            page = _page
            const activeProfile = await getActiveProfile(true)
            let url = activeProfile['homeUrl']
            if (url) {
                await loadUrl(url)
            } else {
                toggleSettings()
            }
        })
    })

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

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    mainView.webContents.on('did-start-navigation', function () {
        //mainView.hide()
        //TODO progress showLoading
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
    titleBar.setBounds({x: 0, y: 0, width: newBounds.width, height: titleBarHeight})
    sideBar.setBounds({x: 0, y: titleBarHeight, width: sideBarWidth, height: newBounds.height})

    sideMenu.setBounds({
        x: sideBarWidth, y: titleBarHeight, width: sideMenuWidth, height: newBounds.height
    })

    mainView.setBounds({
        x: (sideBarWidth + sideMenuWidth),
        y: titleBarHeight,
        width: newBounds.width - (sideBarWidth + sideMenuWidth),
        height: newBounds.height
    })

    if (mainWindow.contentView.children.includes(settingsView)) {
        settingsView.setBounds({
            x: (sideBarWidth + sideMenuWidth),
            y: titleBarHeight,
            width: newBounds.width - (sideBarWidth + sideMenuWidth),
            height: newBounds.height
        })
    }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async function () {
    //const icon = nativeImage.createFromPath()
    try {
        initLogoCache()
        await initPageActions()
        //TODO to appCfg
        nativeTheme.themeSource = appCfg.get('theme', 'dark')
        //appLog.info(updater.buildId)
        //TODO initUpdater();
        loadTranslation(app.getLocale())
        createWindow()

        // const ret = globalShortcut.register('CommandOrControl+R', () => {
        //     app.relaunch();
        //     app.exit();
        // })
        // if (!ret) {
        //     console.log('registration failed')
        // }
        appTray = new Tray(appIcon)
        const trayMenu = Menu.buildFromTemplate([{
            label: translate('Close'), click: () => {
                app.quit()
            }
        }])

        const showContextMenu = async () => {
            //const contextMenu = await updateSystemTray();
            appTray.popUpContextMenu(trayMenu);
        };

        //TODO to appCfg
        appTray.setToolTip("UDesk");

        if (process.platform !== "darwin") {
            appTray.addListener("click", () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore()
                    mainWindow.focus()
                }
                //this.createMainWindow();
            });

            appTray.addListener("right-click", showContextMenu);
        } else {
            appTray.addListener("click", showContextMenu);
            appTray.addListener("right-click", showContextMenu);
        }
    } catch (error) {
        console.error(error)
    }
    //mainWindow.setMenu(Menu.buildFromTemplate(getMenu(mainWindow, app.getLocale())))
})


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
    appCfg.set('theme', nativeTheme.themeSource)
    // if (nativeTheme.shouldUseDarkColors) {
    //     console.log("Dark Theme Chosen by User");
    // } else {
    //     console.log("Light Theme Chosen by User");
    // }
});

// =====================================================================================
ipcMain.handle('back', () => {
    mainView.webContents.navigationHistory.goBack()
})
ipcMain.handle('reload', () => {
    if (mainView.webContents.getURL().includes('primeng-ui')) return;
    mainView.webContents.reload()
})

ipcMain.handle('load-url', async (event, args) => {
    //dialog.showErrorBox('loadService', arg)
    const url = args[0]
    const hasChildren = args[1]
    if (mainWindow.contentView.children.includes(settingsView)) {
        mainWindow.contentView.removeChildView(settingsView)
    }

    if (!hasChildren) {
        toggleSideMenu()
    }
    if (url) {
        await loadUrl(url)
    }
})

ipcMain.handle('open:settings', () => {
    toggleSideMenu()
    toggleSettings()
})

ipcMain.on('sideMenu:toggle', (event, args) => {
    toggleSideMenu(args);
})
ipcMain.on('settings:toggleTheme', (event, args) => {
    nativeTheme.themeSource = args[0]
})


ipcMain.on('profile:logo:getCachePath', async (event) => {
    event.returnValue = appCfg.get('logoCachePath')
})
ipcMain.handle('profile:logo:set', async () => {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
        title: "", properties: ['openFile'], filters: [{name: 'Images', extensions: ['jpg', 'png', 'gif']}]
    })
    if (!result.canceled) {
        const newLogoPath = result.filePaths[0]
        result['logoName'] = (newLogoPath.includes('/')) ? newLogoPath.split("/").pop() : newLogoPath.split("\\").pop()
        const logoCachePath = appCfg.get('logoCachePath') + result['logoName']
        fs.cpSync(newLogoPath, logoCachePath)
    } else {
        //console.log("no file selected");
    }
    return result['logoName']
})

ipcMain.on('profiles:get', async (event) => {
    event.returnValue = getProfiles()
})
ipcMain.on('profiles:getActive', async (event) => {
    event.returnValue = await getActiveProfile()
})

ipcMain.handle('profiles:setActive', async (event, args) => {
    const profileId = args[0]
    await setActiveProfile(profileId)
    await activeProfileUpdate()
    //app.relaunch()
    //app.exit()
})

ipcMain.handle('profile:update', async (event, args) => {
    const profile = args[0]
    await updateProfile(profile)
    const activeProfile = await getActiveProfile()
    if (profile._id === activeProfile._id) {
        sideBar.webContents.send('activeProfile:update', activeProfile)
        // mainWindow.setIcon(logoPath)
        // appTray.setImage(logoPath)
    }
})

ipcMain.handle('profiles:delete', async (event, args) => {
    const profileId = args[0]
    await deleteProfile(profileId)
    // TODO delete logo
    // let appConfigPath = app.getPath('userData') + '/settings/profile-id-' + profile.name + '.json'
    // fs.rmSync(appConfigPath)
})
ipcMain.handle('profiles:add', async () => {
    const updatedProfile = await addProfileFromDefault()
    await setActiveProfile(updatedProfile._id)
    await activeProfileUpdate()
})

ipcMain.handle('profile:import', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'], filters: [{name: 'JSON Files', extensions: ['json']}]
    })
    if (!result.canceled) {
        const filePath = result.filePaths[0];
        const importResultMessage = await importProfile(filePath)
        await activeProfileUpdate()
        return importResultMessage
    }
});

ipcMain.handle('profile:export', async (event, args) => {
    try {
        const profileId = args[0]
        const profile = await getProfile(profileId)
        const result = await dialog.showSaveDialog({
            defaultPath: profile.name + '.json', filters: [{name: 'JSON', extensions: ['json']}]
        })
        if (!result.canceled) {
            delete profile['_id']
            fs.writeFileSync(result.filePath, JSON.stringify(profile), 'utf-8')
            return {severity: 'success', summary: 'profile exported to ' + result.filePath}
        }
    } catch (err) {
        console.error('Error exporting file:', err)
        return {severity: 'error', summary: err.message}
    }

})

//TODO add pageActions Edit
//lang nestdb, lang setting
//drag and drop reordering to services tree table
//? events to angular
// =====================================================================================
async function loadUrl(urlStr) {
    try {
        const url = new URL(urlStr)
        await page.goto(urlStr, {
            waitUntil: "networkidle0",
        })

        const pageAction = await getPageAction(url)
        if (pageAction) {
            await executePageActions(page, pageAction.actions)
        }
    } catch (error) {
        if (error.code !== 'ERR_ABORTED') console.error(error.message)
    }

    // page.setUserAgent(
    //     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    // )
    // mainView.webContents.loadURL(url).catch(error => {
    //     if (error.code === 'ERR_ABORTED') return;
    //     throw error
    // })

    // mainView.webContents.loadURL(args[0]).catch(error => {
    //     if (error.code === 'ERR_ABORTED') return;
    //     throw error;
    // });
    // mainView.webContents.on('dom-ready', () => {
    // mainView.webContents.executeJavaScript(`
    //     const event = new KeyboardEvent('keydown', { key: 'Tab' });
    //     document.activeElement.dispatchEvent(event);
    // `);
    // mainView.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' })
    // mainView.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'a' })
    // if (elementExists) {
    //     mainView.webContents.executeJavaScript(`document.querySelector('#app-wrapper > div > div.application > div > ul > form > div:nth-child(1) > div > div > div > input').value = 'test';`).then();
    // }
    // })
}

async function initPageActions() {
    const allPageActions = getPageActions()
    if (allPageActions.length === 0) {
        await addDefaultPageActions()
    }
}

async function activeProfileUpdate() {
    const activeProfile = await getActiveProfile()
    sideBar.webContents.send('activeProfile:update', activeProfile)
}

function initLogoCache() {
    appCfg.set('logoCachePath', path.join(app.getPath('userData'), 'LogoCache'))
    copyFromAssets('Udesk_logo.png')
    copyFromAssets('logo48b.png')
    //TODO appLogo from appCfg
    const appLogoPath = appCfg.get('logoCachePath') + `Udesk_logo.png`
}

function copyFromAssets(logoName) {
    const logoPath = path.join(appCfg.get('logoCachePath'), logoName)
    if (!fs.existsSync(logoPath)) {
        fs.cpSync(path.join(__dirname, 'assets', logoName), logoPath)
    }
}


function toggleSideMenu(args) {
    sideMenuWidth = sideMenu.getBounds().width
    if (args) {
        switch (sideMenuWidth) {
            case 0:
                sideMenuWidth = 230
                loadPrimeComponent(sideMenu, 'sideMenu/' + args[0]);
                break;
            case 230:
                sideMenuWidth = 0
                break;
        }
    } else {
        sideMenuWidth = 0
    }
    resizeMain()
}

function loadPrimeComponent(browserView, component) {
    const url = `file://${__dirname}/dist/index.html`;
    browserView.webContents.loadURL(url).then(() => {
        browserView.webContents.send('loadComponent', component);
    })
}

function toggleSettings() {
    if (!mainWindow.contentView.children.includes(settingsView)) {
        mainWindow.contentView.addChildView(settingsView, 4);
        loadPrimeComponent(settingsView, 'settings')
        resizeMain()
    } else {
        mainWindow.contentView.removeChildView(settingsView)
    }
}
