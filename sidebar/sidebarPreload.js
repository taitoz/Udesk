const {ipcRenderer} = require('electron')

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('s1').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://uchet.kz/lp/5prichin/')
    })
    document.getElementById('s2').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://buh.uchet.kz/')
    })
    document.getElementById('s3').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://ukassa.kz/')
    })
    document.getElementById('s4').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://edo.uchet.kz/')
    })
    document.getElementById('s5').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://profitraining.kz/')
    })
    document.getElementById('s6').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://pk.uchet.kz/')
    })
    document.getElementById('s7').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://pob.uchet.kz/')
    })
    document.getElementById('s8').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://dashboard.uchet.kz/')
    })
    document.getElementById('s9').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://audit.uchet.kz/')
    })
    document.getElementById('s10').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://uchet.kz/fran/our-fran.html')
    })
    document.getElementById('s11').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://ab.uchet.kz/')
    })
    document.getElementById('s12').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://uchet.kz/hrassistant/')
    })
    document.getElementById('s13').addEventListener("click", function () {
        ipcRenderer.send('loadService','https://uchet.kz/pages/partners/')
    })
})