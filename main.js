//handle setup events as quickly as possible
const setupEvents = require('./installers/setupEvents')
if (setupEvents.handleSquirrelEvent()) {
    // squirrel event handled and app will exit in 1000ms, so don't do anything else
    return;
}

// Module to control application life.
let path = require('path')
// Module to create native browser window.
const {BrowserView, BrowserWindow, appTray, Menu, nativeImage, app, Tray} = require('electron')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let sidebar
let mainView

let i18n = new (require('./translations/i18n'))

app.disableHardwareAcceleration()

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        titleBarStyle: 'hidden-inset',
        width: 1520,
        height: 850,
        minWidth: 1520,
        minHeight: 850,
        useContentSize: true,
        //backgroundColor: '#312450',
        //show: false,
        icon: path.join(__dirname, 'assets/icons/48.ico'),
        // webPreferences: {
        //   offscreen: true
        // }
    })

    // and load the index.html of the app.
    //mainWindow.loadURL(`https://uchet.kz/`)
    //mainWindow.loadFile('index.html')
    //setTimeout(() => mainWindow.loadURL(`https://uchet.kz`), 1000)
    //if (navigator.onLine) {mainWindow.loadURL(`https://uchet.kz`)} else {mainWindow.loadURL(`index.html`)}

    const sidebarWidth = 240
    sidebar = new BrowserView()
    mainWindow.addBrowserView(sidebar)
    sidebar.setBounds({x: 0, y: 0, width: sidebarWidth, height: mainWindow.getBounds().height})
    sidebar.setAutoResize({width: true, height: false});
    sidebar.webContents.loadFile('sidebar.html')

    mainView = new BrowserView()
    mainWindow.addBrowserView(mainView)
    sidebar.setAutoResize({width: true, height: false});
    mainView.setBounds({
        x: 300,
        y: 0,
        width: mainWindow.getBounds().width - sidebarWidth,
        height: mainWindow.getBounds().height
    })
    mainView.webContents.loadURL('https://uchet.kz/month/')

    // catch resize event emitted on window
    mainWindow.on('resize', function () {

        // store window's new size in variable
        let newBounds = mainWindow.getBounds()

        // set BrowserView's bounds explicitly
        sidebar.setBounds({x: 0, y: 0, width: sidebarWidth, height: newBounds.height})
        mainView.setBounds({x: sidebarWidth, y: 0, width: newBounds.width - sidebarWidth, height: newBounds.height})
    })

    // Open the DevTools.
    //mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })

    require('./mainmenu')

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })


}

function get() {
    return mainWindow;
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
    tray.setToolTip('Uchet Desktop')
    tray.setTitle('Uchet Desktop')
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.