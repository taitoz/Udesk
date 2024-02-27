const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
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
