const {contextBridge, ipcRenderer} = require('electron/renderer')


contextBridge.exposeInMainWorld('electronAPI', {

    loadMenu: () => ipcRenderer.sendSync('sideMenuTreeNodes:get'),

    onThemeToggle: (callback) => ipcRenderer.on('theme-toggle', (_event, value) => callback(value)),
    // onThemeToggle: (value) => ipcRenderer.on("theme-toggle", (_event, value) => {
    //     alert("received data1" + value)
    // }),
    onSidebarToggle: (callback) => ipcRenderer.on('sidebar-toggle', (_event, value) => callback(value)),
    menubarToggle: () => ipcRenderer.invoke('menubar-toggle'),

    loadUrl: (url) => ipcRenderer.invoke('load-url', url),
    openSettings: () => ipcRenderer.invoke('settings-open'),
    goBack: () => ipcRenderer.invoke('win-back'),
    reload: () => ipcRenderer.invoke('win-reload'),
    minimize: () => ipcRenderer.invoke('win-minimize'),
    maximize: () => ipcRenderer.invoke('win-maximize'),
    close: () => ipcRenderer.invoke('win-close')
})

window.addEventListener('DOMContentLoaded', () => {

    /*document.getElementById('s1').addEventListener("click", function () {
        ipcRenderer.send('settings-open','')
    })*/

})
