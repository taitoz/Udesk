import updater from "electron-simple-updater";
import appLog from "electron-log";
import {dialog} from "electron";

//const server = 'https://udesk-upd-srv.vercel.app'

export { updater }

// Reference to mainWindow, set via initUpdater(win)
let mainWindow = null

export function initUpdater(win) {
    mainWindow = win
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
        .on('update-available', () => {
            appLog.info('update-log', 'Update available, downloading...')
            notifyRenderer(true)
        })
        .on('update-downloaded', () => {
            appLog.info('update-log', 'Update downloaded and ready to install')
            notifyRenderer(true)
        })
        .on('error', (message) => {
            appLog.error('There was a problem updating the application')
            appLog.error(message)
        })
}

function notifyRenderer(updateAvailable) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app:updateAvailable', updateAvailable)
    }
}

export function showUpdateDialog() {
    const currentState = updater.state

    if (currentState === 'update-downloaded') {
        const dialogOpts = {
            type: 'info',
            buttons: ['Install now', 'Later'],
            title: 'Update Ready',
            message: 'A new version has been downloaded.',
            detail: 'Restart the application to apply the update.'
        }
        dialog.showMessageBox(dialogOpts).then((returnValue) => {
            if (returnValue.response === 0) updater.quitAndInstall()
        })
        return
    }

    if (currentState === 'update-downloading') {
        dialog.showMessageBox({
            type: 'info',
            buttons: ['Ok'],
            title: 'Update',
            message: 'Update is downloading...',
            detail: 'Please wait, do not close the application.'
        })
        return
    }

    // Trigger a manual check
    updater.checkForUpdates()

    // Listen for result
    const onAvailable = () => {
        cleanup()
        notifyRenderer(true)
        dialog.showMessageBox({
            type: 'info',
            buttons: ['Ok'],
            title: 'Update',
            message: 'Update available, downloading in background...',
            detail: 'Do not close the application until download is complete.'
        })
    }

    const onNotAvailable = () => {
        cleanup()
        dialog.showMessageBox({
            type: 'info',
            buttons: ['Ok'],
            title: 'Update',
            message: 'You are up to date.',
            detail: `Current version: ${require('./package.json').version}`
        })
    }

    const onError = (err) => {
        cleanup()
        dialog.showMessageBox({
            type: 'error',
            buttons: ['Ok'],
            title: 'Update Check Failed',
            message: 'Could not check for updates.',
            detail: String(err)
        })
    }

    function cleanup() {
        updater.removeListener('update-available', onAvailable)
        updater.removeListener('update-not-available', onNotAvailable)
        updater.removeListener('error', onError)
    }

    updater.once('update-available', onAvailable)
    updater.once('update-not-available', onNotAvailable)
    updater.once('error', onError)

    // Timeout fallback
    setTimeout(() => {
        cleanup()
    }, 15000)
}
