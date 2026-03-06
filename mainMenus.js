import {app, clipboard, shell, dialog} from 'electron'
import {loadTranslation, translate} from './translations/i18n.js'


export function getMainViewMenu(window, params = {}) {
    const menu = []

    // Link options
    if (params.linkURL) {
        menu.push({
            label: 'Copy Link',
            click: () => clipboard.writeText(params.linkURL)
        })
        menu.push({
            label: 'Open Link in Browser',
            click: () => shell.openExternal(params.linkURL)
        })
        menu.push({type: 'separator'})
    }

    // Image options
    if (params.hasImageContents) {
        menu.push({
            label: 'Save Image As...',
            click: () => {
                const url = params.srcURL
                dialog.showSaveDialog(null, {
                    defaultPath: url.split('/').pop().split('?')[0] || 'image.png'
                }).then(result => {
                    if (!result.canceled) {
                        window.webContents.session.downloadURL(url)
                    }
                })
            }
        })
        menu.push({
            label: 'Copy Image',
            click: () => window.webContents.copyImageAt(params.x, params.y)
        })
        menu.push({
            label: 'Copy Image URL',
            click: () => clipboard.writeText(params.srcURL)
        })
        menu.push({type: 'separator'})
    }

    // Text editing options
    if (params.isEditable) {
        menu.push({label: 'Cut', role: 'cut', enabled: params.editFlags?.canCut})
        menu.push({label: 'Copy', role: 'copy', enabled: params.editFlags?.canCopy})
        menu.push({label: 'Paste', role: 'paste', enabled: params.editFlags?.canPaste})
        menu.push({label: 'Select All', role: 'selectAll'})
    } else {
        // Non-editable context
        if (params.selectionText) {
            menu.push({label: 'Copy', role: 'copy'})
        }
        menu.push({label: 'Select All', role: 'selectAll'})
        menu.push({label: 'Paste', role: 'paste'})
    }

    // Save page
    menu.push({type: 'separator'})
    menu.push({
        label: 'Save Page As...',
        accelerator: 'CmdOrCtrl+S',
        click: () => {
            dialog.showSaveDialog(null, {
                defaultPath: window.webContents.getTitle() + '.html',
                filters: [{name: 'Web Page', extensions: ['html', 'htm']}]
            }).then(result => {
                if (!result.canceled) {
                    window.webContents.savePage(result.filePath, 'HTMLComplete')
                }
            })
        }
    })

    // DevTools
    menu.push({type: 'separator'})
    menu.push({
        label: translate('DevTools'),
        click: () => window.webContents.openDevTools({mode: 'detach'})
    })

    return menu
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
