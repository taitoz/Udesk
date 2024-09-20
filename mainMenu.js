import {app} from 'electron'
import {loadTranslation, translate} from './translations/i18n.js'

export function getMainViewMenu(window) {
    //loadTranslation(locale)
    const template = [
        {
            label: translate('DevTools'),
            accelerator: 'F12',
            click: () => {
                window.webContents.openDevTools({mode: 'detach'});
            }
        }
        // {
        //   role: 'help', label: translate('Help'),
        //   submenu: [
        //     {
        //       label: translate('Learn more'),
        //       click () { require('electron').shell.openExternal('https://github.com/crilleengvall/electron-tutorial-app') }
        //     }
        //   ]
        // }
    ]
    return template
}

export function getMainWindowMenu(window, locale) {
    loadTranslation(locale)
    const template = [
        {
            label: translate('View'),
            submenu: [
                {
                    role: 'resetzoom', label: translate('Actual size')
                },
                {
                    role: 'zoomin', label: translate('Zoom in')
                },
                {
                    role: 'zoomout', label: translate('Zoom out')
                },
                {
                    type: 'separator'
                },
                {
                    role: 'togglefullscreen', label: translate('Toggle fullscreen')
                }
            ]
        },
        {
            role: 'window', label: translate('Window'),
            submenu: [
                {
                    role: 'minimize', label: translate('Minimize')
                },
                {
                    role: 'close', label: translate('Close')
                }
            ]
        },
        {type: 'separator'},
        {
            label: translate('GoBack'),
            click: () => {
                window.webContents.goBack();
            }
        },
        {
            label: translate('GoForward'),
            //icon: nativeImage.createFromPath('./assets/icons/24.ico'),
            click: () => {
                window.webContents.goForward();
            }
        },
        {type: 'separator'},
        {
            label: translate('DevTools'),
            accelerator: 'F12',
            click: () => {
                window.webContents.openDevTools({mode: 'detach'});
            }
        }
        // {
        //   role: 'help', label: translate('Help'),
        //   submenu: [
        //     {
        //       label: translate('Learn more'),
        //       click () { require('electron').shell.openExternal('https://github.com/crilleengvall/electron-tutorial-app') }
        //     }
        //   ]
        // }
    ]

    if (process.platform === 'darwin') {
        const name = app.getName()
        template.unshift({
            label: name,
            submenu: [
                {
                    role: 'about', label: translate('About') + " " + app.getName()
                },
                {
                    type: 'separator'
                },
                {
                    role: 'services', label: translate('Services'),
                    submenu: []
                },
                {
                    type: 'separator'
                },
                {
                    role: 'hide', label: translate('Hide') + " " + app.getName()
                },
                {
                    role: 'hideothers', label: translate('Hide others')
                },
                {
                    role: 'unhide', label: translate('Unhide')
                },
                {
                    type: 'separator'
                },
                {
                    role: 'quit', label: translate('Quit') + " " + app.getName()
                }
            ]
        })
        template[1].submenu.push(
            {
                type: 'separator'
            },
            {
                label: translate('Speech'),
                submenu: [
                    {
                        role: 'startspeaking', label: translate('Start speaking')
                    },
                    {
                        role: 'stopspeaking', label: translate('Stop speaking')
                    }
                ]
            }
        )
        template[3].submenu = [
            {
                label: translate('Close'),
                accelerator: 'CmdOrCtrl+W',
                role: 'close'
            },
            {
                label: translate('Minimize'),
                accelerator: 'CmdOrCtrl+M',
                role: 'minimize'
            },
            {
                label: translate('Zoom'),
                role: 'zoom'
            },
            {
                type: 'separator'
            },
            {
                label: translate('Bring all to front'),
                role: 'front'
            }
        ]
    }
    return template
}
