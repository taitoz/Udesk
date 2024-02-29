const {contextBridge, ipcRenderer} = require('electron/renderer')


contextBridge.exposeInMainWorld('electronAPI', {

    onThemeToggle: (callback) => ipcRenderer.on('theme-toggle', (_event, value) => callback(value)),
    // onThemeToggle: (value) => ipcRenderer.on("theme-toggle", (_event, value) => {
    //     alert("received data1" + value)
    // }),

    loadUrl: (url) => ipcRenderer.invoke('load-url', url),
    sidebarToggle: () => ipcRenderer.invoke('sidebar-toggle'),
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
