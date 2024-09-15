import updater from "electron-simple-updater";
import appLog from "electron-log";
import {dialog} from "electron";

//const server = 'https://udesk-upd-srv.vercel.app'

export function initUpdater() {
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
}
