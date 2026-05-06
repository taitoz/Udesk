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
import {initUpdater, showUpdateDialog} from './updater.js'

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
    updateProfile, upsertPageAction, deletePageAction
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

// Surface palette hex values for titlebar overlay (light=50, dark=900)
const surfacePalettes = {
    slate:   { 50: '#f8fafc', 900: '#0f172a' },
    gray:    { 50: '#f9fafb', 900: '#111827' },
    zinc:    { 50: '#fafafa', 900: '#18181b' },
    neutral: { 50: '#fafafa', 900: '#171717' },
    stone:   { 50: '#fafaf9', 900: '#1c1917' },
    soho:    { 50: '#f4f4f4', 900: '#34343d' },
    viva:    { 50: '#f3f3f3', 900: '#262b2c' },
    ocean:   { 50: '#fbfcfc', 900: '#193030' }
}

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
let mainView

function createWindow() {
    if (mainWindow) return

    const winCfg = appCfg.window()

    const isDark = nativeTheme.themeSource === 'dark'
    const savedSurface = appCfg.get('surfaceColor', 'zinc')
    const surfacePal = surfacePalettes[savedSurface] || surfacePalettes.zinc
    const overlayColor = isDark ? surfacePal['900'] : surfacePal['50']
    mainWindow = new BrowserWindow({
        width: 1200, height: 720, minWidth: 1200, minHeight: 720,
        backgroundColor: overlayColor,
        titleBarStyle: "hidden",
        icon: appIcon,
        ...(process.platform === "linux" ? {icon: appIcon} : {}),
        trafficLightPosition: {x: 16, y: 16},
        titleBarOverlay: {
            symbolColor: isDark ? "#DADBE1" : "#333333",
            color: overlayColor,
            height: 32,
        },
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false,
        },
        ...winCfg.options(),
    });

    winCfg.assign(mainWindow);

    // Load Angular app directly in the BrowserWindow
    const url = `file://${__dirname}/dist/index.html`;
    mainWindow.loadURL(url)

    // Create mainView WebContentsView for external web content
    mainView = new WebContentsView()
    mainWindow.contentView.addChildView(mainView, 1)
    mainView.setBounds({x: 0, y: 0, width: 0, height: 0}) // Hidden until Angular tells us where
    mainView.webContents.on('context-menu', (event, params) => {
        Menu.buildFromTemplate(getMainViewMenu(mainView, params)).popup()
    });

    // WebHID support for external web content (e.g. device driver pages)
    const mainViewSession = mainView.webContents.session
    mainViewSession.on('select-hid-device', (event, details, callback) => {
        event.preventDefault()
        if (details.deviceList && details.deviceList.length > 0) {
            callback(details.deviceList[0].deviceId)
        } else {
            callback('')
        }
    })
    mainViewSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
        if (permission === 'hid') return true
        return true
    })
    mainViewSession.setDevicePermissionHandler((details) => {
        if (details.deviceType === 'hid' || details.deviceType === 'usb') return true
        return false
    })
    mainViewSession.on('select-usb-device', (event, details, callback) => {
        event.preventDefault()
        if (details.deviceList && details.deviceList.length > 0) {
            callback(details.deviceList[0].deviceId)
        } else {
            callback('')
        }
    })

    mainWindow.webContents.on('context-menu', (event, params) => {
        event.preventDefault()
        const template = [
            {
                label: 'Inspect Element',
                click: () => {
                    if (!mainWindow.webContents.isDevToolsOpened()) {
                        mainWindow.webContents.openDevTools({mode: 'detach'})
                    }
                    if (params?.x !== undefined && params?.y !== undefined) {
                        mainWindow.webContents.inspectElement(params.x, params.y)
                    }
                }
            },
            {
                type: 'separator'
            },
            {
                label: mainWindow.webContents.isDevToolsOpened() ? 'Close DevTools' : 'Open DevTools',
                click: () => {
                    if (mainWindow.webContents.isDevToolsOpened()) {
                        mainWindow.webContents.closeDevTools()
                    } else {
                        mainWindow.webContents.openDevTools({mode: 'detach'})
                    }
                }
            }
        ]
        Menu.buildFromTemplate(template).popup({window: mainWindow})
    })

    // Puppeteer
    pie.connect(app, puppeteerApp).then(async browser => {
        pie.getPage(browser, mainView).then(async _page => {
            page = _page
            const activeProfile = await getActiveProfile(true)
            let url = activeProfile['homeUrl']
            if (url) {
                await loadUrl(url)
            }
        })
    })

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        mainWindow = null
    })

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    // Loading indicator: send to Angular app in the main window
    //timeout 10 sec
    mainView.webContents.on('did-start-navigation', function () {
        mainWindow.webContents.send('showLoading', true);
        setTimeout(() => {
            mainWindow.webContents.send('showLoading', false);
        }, 10000);
    });

    mainView.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('showLoading', false);
    })
}

// mainView bounds are now controlled by Angular via IPC 'mainView:resize'

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async function () {
    //const icon = nativeImage.createFromPath()
    try {
        await initPageActions()
        //TODO to appCfg
        nativeTheme.themeSource = appCfg.get('theme', 'dark')
        //appLog.info(updater.buildId)
        loadTranslation(appCfg.get('lang', app.getLocale()))
        createWindow()
        initUpdater(mainWindow)

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
    appCfg.set('theme', nativeTheme.themeSource)
});

// =====================================================================================
ipcMain.on('online-status-changed', (event, status) => {
    console.log(status)
})

ipcMain.handle('back', () => {
    mainView.webContents.navigationHistory.goBack()
})
ipcMain.handle('forward', () => {
    mainView.webContents.navigationHistory.goForward()
})
ipcMain.handle('reload', () => {
    if (mainView.webContents.getURL().includes('primeng-ui')) return;
    mainView.webContents.reloadIgnoringCache()
})

ipcMain.handle('load-url', async (event, args) => {
    const url = args[0]
    const serviceId = args[2]
    if (url) {
        await loadUrl(url, serviceId)
    }
})

// mainView:resize - Angular tells us where to position the mainView WebContentsView
ipcMain.on('mainView:resize', (event, args) => {
    if (!mainView) return
    const bounds = args[0]
    mainView.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height)
    })
})
ipcMain.on('settings:toggleTheme', (event, args) => {
    const theme = args[0]
    nativeTheme.themeSource = theme
    if (mainWindow) {
        mainWindow.webContents.send('theme-toggle', theme)
        // Update titlebar overlay buttons to match theme
        const surfName = appCfg.get('surfaceColor', 'zinc')
        const sPal = surfacePalettes[surfName] || surfacePalettes.zinc
        mainWindow.setTitleBarOverlay({
            symbolColor: theme === 'dark' ? '#DADBE1' : '#333333',
            color: theme === 'dark' ? sPal['900'] : sPal['50'],
        })
    }
})
ipcMain.on('settings:getTheme', (event) => {
    event.returnValue = nativeTheme.themeSource
})
ipcMain.on('settings:getPrimaryColor', (event) => {
    event.returnValue = appCfg.get('primaryColor', 'emerald')
})
ipcMain.on('settings:setPrimaryColor', (event, args) => {
    appCfg.set('primaryColor', args[0])
})
ipcMain.on('settings:getSurfaceColor', (event) => {
    event.returnValue = appCfg.get('surfaceColor', 'zinc')
})
ipcMain.on('settings:getLang', (event) => {
    event.returnValue = appCfg.get('lang', 'en')
})
ipcMain.on('settings:setLang', (event, args) => {
    const newLang = args[0]
    appCfg.set('lang', newLang)
    loadTranslation(newLang)
    // Rebuild tray menu with new translations
    if (appTray) {
        const trayMenu = Menu.buildFromTemplate([{
            label: translate('Close'), click: () => {
                app.quit()
            }
        }])
        appTray.setContextMenu(trayMenu)
    }
})
ipcMain.on('settings:setSurfaceColor', (event, args) => {
    appCfg.set('surfaceColor', args[0])
    // Update titlebar overlay to match new surface color
    if (mainWindow) {
        const isDark = nativeTheme.themeSource === 'dark'
        const pal = surfacePalettes[args[0]] || surfacePalettes.zinc
        mainWindow.setTitleBarOverlay({
            color: isDark ? pal['900'] : pal['50'],
        })
    }
})

ipcMain.handle('pageActions:get', async () => {
    try {
        const actions = await getPageActions();
        // Ensure the data is serializable by converting it to a plain object
        return JSON.parse(JSON.stringify(actions));
    } catch (error) {
        console.error('Error getting page actions:', error);
        return [];
    }
})

ipcMain.on('pageAction:get', async (event, args) => {
    const url = args[0]
    event.returnValue = await getPageAction(url)
})


ipcMain.handle('profiles:get', async () => {
    try {
        const profiles = getProfiles();
        return JSON.parse(JSON.stringify(profiles));
    } catch (error) {
        console.error('Error getting profiles:', error);
        return [];
    }
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

ipcMain.handle('pageAction:update', async (event, args) => {
    const pageAction = args[0]
    await upsertPageAction(pageAction)
})

ipcMain.handle('pageAction:delete', async (event, args) => {
    const serviceId = args[0]
    await deletePageAction(serviceId)
})

ipcMain.handle('profile:update', async (event, args) => {
    const profile = args[0]
    console.log(profile)
    await updateProfile(profile)
    const activeProfile = await getActiveProfile()
    if (profile._id === activeProfile._id) {
        mainWindow.webContents.send('activeProfile:update', activeProfile)
        // mainWindow.setIcon(logoPath)
        // appTray.setImage(logoPath)
    }
})

ipcMain.handle('profiles:delete', async (event, args) => {
    const profileId = args[0]
    await deleteProfile(profileId)

    //TODO delete logo
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

ipcMain.handle('app:getInfo', async () => {
    try {
        const packageJsonPath = path.join(__dirname, 'package.json')
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

        // Get build date from app.asar file modification time if it exists, otherwise use current date
        let buildDate = new Date().toISOString()
        try {
            const asarPath = path.join(process.resourcesPath, 'app.asar')
            if (fs.existsSync(asarPath)) {
                const stats = fs.statSync(asarPath)
                buildDate = stats.mtime.toISOString()
            }
        } catch (err) {
            console.log('Could not get build date from asar:', err.message)
        }

        return {
            name: packageJson.productName || packageJson.name,
            description: packageJson.description,
            version: packageJson.version,
            buildDate: new Date(buildDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            repository: packageJson.author?.url || 'https://github.com/taitoz/uchet-desktop'
        }
    } catch (err) {
        console.error('Error getting app info:', err)
        return null
    }
})

ipcMain.handle('app:checkForUpdates', async () => {
    showUpdateDialog()
})

//TODO
// ? events to angular
//=====================================================================================
async function loadUrl(urlStr, serviceId) {
    try {
        const url = new URL(urlStr)
        // Clear HTTP cache before navigation so stale cached UIs don't load
        // This preserves localStorage/cookies (TrguiNG settings etc.)
        await mainView.webContents.session.clearCache()
        await page.goto(urlStr, {
            waitUntil: "domcontentloaded",
            // load
            // networkidle0
            // networkidle2
        })

        const pageAction = await getPageAction(url, serviceId)
        if (pageAction) {
            console.log(`[PageActions] Found page action for serviceId: ${serviceId}, domain: ${pageAction.domain}, ${pageAction.actions.length} actions`)
            await executePageActions(page, pageAction.actions)
        } else {
            console.log(`[PageActions] No page action found for serviceId: ${serviceId}, url: ${url.hostname}`)
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
    mainWindow.webContents.send('activeProfile:update', activeProfile)
}



// toggleSideMenu, loadPrimeComponent, toggleSettings removed
// Layout is now managed by Angular in the single renderer
