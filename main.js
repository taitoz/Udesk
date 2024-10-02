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
import {addResponseHandlers} from "./mainPageActions.js";

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

let appConfig
let profileJson = cfg.create('profiles.json')
loadActiveProfile()

let puppeteerApp = puppeteer
await pie.initialize(app)
let page


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

let sideBarWidth = 70
let sideMenuWidth = 0
let titleBarHeight = 32

function createWindow() {
    if (mainWindow) return

    const winCfg = cfg.window()

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
    titleBar.webContents.on('context-menu', (event) => {
        event.preventDefault()
        Menu.buildFromTemplate(getMainViewMenu(titleBar)).popup()
    })

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
        pie.getPage(browser, mainView).then(_page => {
            page = _page
            let url = getProfileKey(0, 'homeUrl')
            if (url) {
                _page.goto(url)
                // page.setUserAgent(
                //     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
                // )
                // mainView.webContents.loadURL(url).catch(error => {
                //     if (error.code === 'ERR_ABORTED') return;
                //     throw error
                // })
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
app.on('ready', function () {
    //const icon = nativeImage.createFromPath()
    try {
        //appLog.info(updater.buildId)
        //initUpdater();
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
        console.log(error)
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

ipcMain.handle('load-url', (event, args) => {
    //dialog.showErrorBox('loadService', arg)
    if (mainWindow.contentView.children.includes(settingsView)) {
        mainWindow.contentView.removeChildView(settingsView)
    }
    if (args[1]) {
        toggleSideMenu()
    }
    if (args[0]) {
        try {
            new URL(args[0])
        } catch (err) {
            return
        }
        //TODO pageActions to file
        let pageActions = {
            term: 'kibana-elk-services.vlife.kz/app/login', actions: [{
                action: 'typeToInput',
                selector: '#app-wrapper > div > div.application > div > ul > form > div:nth-child(1) > div > div > div > input',
                value: 'k.pak',
            }, {
                action: 'typeToInput',
                selector: '#app-wrapper > div > div.application > div > ul > form > div:nth-child(2) > div > div > div > input',
                value: 'M6VmO89JpQzANE2409',
            }, {
                action: 'clickElement',
                selector: '#app-wrapper > div > div.application > div > ul > form > div:nth-child(3) > div > button'
            }]
        }
        let pageActions2 = {
            term: '192.168.1.1/index.html', actions: [// {
                //     action: 'waitElement',
                //     selector: 'input.textfield:nth-child(2)'
                // },
                {
                    action: 'typeToInput', selector: 'input.textfield:nth-child(2)', value: 'admin',
                }, {
                    action: 'typeToInput', selector: 'input.textfield:nth-child(5)', value: 'admin',
                }, {
                    action: 'clickElement', selector: '#btnSignIn'
                }]
        }
        addResponseHandlers(page, pageActions)
        page.goto(args[0])
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
    appConfig.set('theme', args[0])
})

ipcMain.on('sideBar:logo:get', (event, args) => {
    event.returnValue = getProfileLogoPath(args[0])
})
ipcMain.handle('sideBar:logo:set', async (event, args) => {
    await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
        title: "", properties: ['openFile'], filters: [{name: 'Images', extensions: ['jpg', 'png', 'gif']}]
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

ipcMain.handle('file:export', async (event, args) => {
    try {
        const profileName = getProfileKey(args[0], 'name')
        const result = await dialog.showSaveDialog({

            defaultPath: profileName + '.json', filters: [{name: 'JSON', extensions: ['json']}]
        })
        if (!result.canceled) {
            let appConfigPath = app.getPath('userData') + '/settings/profile-id-' + args[0] + '.json'
            const fileContent = fs.readFileSync(appConfigPath, 'utf-8')
            fs.writeFileSync(result.filePath, fileContent, 'utf-8')
            return {severity: 'success', summary: 'profile exported to ' + result.filePath}
        }
    } catch (err) {
        console.error('Error exporting file:', err)
        return {severity: 'error', summary: err.message}
    }

})
ipcMain.handle('file:import', async () => {
    try {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'], filters: [{name: 'JSON Files', extensions: ['json']}]
        })
        if (!result.canceled) {
            const filePath = result.filePaths[0];
            addProfile(filePath).then()
            return {severity: 'success', summary: 'profile imported from ' + result.filePaths[0]}
        }
    } catch (err) {
        console.error('Error reading or parsing JSON file:', err)
        return {severity: 'error', summary: err.message}
    }
});

// =====================================================================================
async function addProfile(filePath) {

    let profileList = getProfiles()
    let newProfile = loadFromFile(path.join(__dirname, 'assets', 'profile-default.json'))
    const defaultProfileName = 'Default Profile'
    let newProfileName = defaultProfileName
    if (filePath) {
        const fileName = (filePath.includes('/')) ? filePath.split("/").pop() : filePath.split("\\").pop()
        newProfileName = fileName.split(".").shift()
        let index = profileList.findIndex(p => getProfileKey(p.id, 'name') === newProfileName)
        if (index === -1) {
            newProfile.id = Date.now()
            profileList.push(newProfile)
        } else {
            newProfile.id = profileList[index].id
            profileList[index] = newProfile
        }
        let appConfigPath = app.getPath('userData') + '/settings/profile-id-' + newProfile.id + '.json'
        fs.cpSync(filePath, appConfigPath)
    } else {
        let i = 1
        while (profileList.findIndex(p => getProfileKey(p.id, 'name') === newProfileName) !== -1) {
            newProfileName = defaultProfileName + ' ' + i;
            i++;
        }
        // let date = new Date(newFromFile.id).toISOString().slice(0, 19).replace('T', ' ')
        newProfile.id = Date.now()
        let appConfig = loadAppConfigFromProfile(newProfile.id)
        appConfig.set('servicesMenu', loadFromFile(path.join(__dirname, 'assets', 'services-default.json')))
        appConfig.set('web1cMenu', loadFromFile(path.join(__dirname, 'assets', 'web1c.json')))
        appConfig.set('theme', 'dark')
        profileList.push(newProfile)
    }

    newProfile.data.find(p => p.key === 'name').value = newProfileName
    profileJson.set("profiles", profileList)
    //refresh table
    setActiveProfile(newProfile.id)
}

function loadAppConfigFromProfile(profileId) {
    // C:\Users\user\AppData\Roaming\Udesk\settings.json
    // /home/developer/.config/Udesk/settings.json
    let appConfigPath = app.getPath('userData') + '/settings/profile-id-' + profileId + '.json'
    return cfg.create(appConfigPath)
}

function loadActiveProfile() {

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

function loadFromFile(filePath) {
    // add validation
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(fileContent)
    } catch (e) {
        return {severity: 'error', message: e.message}
    }
}

function setActiveProfile(profileId) {
    let profileList = getProfiles()
    let index = profileList.findIndex(p => p.id === profileId)
    if (index !== -1) {
        profileList.unshift(...profileList.splice(index, 1))
        profileJson.set("profiles", profileList)
        loadActiveProfile()
        updateAppLogo(getProfileLogoPath(profileId))
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
        fs.cpSync(path.join(__dirname, 'assets', `logo48b.png`), logoPath)
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
    const logoName = (newLogoPath.includes('/')) ? newLogoPath.split("/").pop() : newLogoPath.split("\\").pop()
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
