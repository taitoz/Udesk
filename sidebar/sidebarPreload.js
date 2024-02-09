const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
    loadUrl: (url) => ipcRenderer.invoke('load-url', url),
    sidebarToggle: () => ipcRenderer.invoke('sidebar-toggle'),
    openSettings: () => ipcRenderer.invoke('settings-open')
})

window.addEventListener('DOMContentLoaded', () => {

    /*document.getElementById('s1').addEventListener("click", function () {
        ipcRenderer.send('settings-open','')
    })*/

    /*
    s0 https://uchet.kz/month/
    s1 https://uchet.kz/lp/5prichin/
    s2 https://buh.uchet.kz/
    s3 https://ukassa.kz/
    s4 https://edo.uchet.kz/
    s5 https://profitraining.kz/
    s6 https://pk.uchet.kz/
    s7 https://pob.uchet.kz/
    s8 https://dashboard.uchet.kz/
    s9 https://audit.uchet.kz/
    s10 https://uchet.kz/fran/our-fran.html
    s11 https://ab.uchet.kz/
    s12 https://uchet.kz/hrassistant/
    s13 https://uchet.kz/pages/partners/
     */

})
