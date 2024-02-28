//const { remote } = require('electron')

function addEvents() {
    //document.getElementById('drag-region').style.webkitAppRegion = "drag"
    // Make minimise/maximise/restore/close buttons work when they are clicked
    document.getElementById('back-button').addEventListener("click", () => {
        window.electronAPI.goBack();
        //remote.BrowserWindow.getFocusedWindow().minimize();
    });

    document.getElementById('reload-button').addEventListener("click", () => {
        window.electronAPI.reload();
        //remote.BrowserWindow.getFocusedWindow().minimize();
    });

    document.getElementById('min-button').addEventListener("click", () => {
        window.electronAPI.minimize();
        //remote.BrowserWindow.getFocusedWindow().minimize();
    });

    document.getElementById('max-button').addEventListener("click", () => {
        window.electronAPI.maximize();
        document.body.classList.add('maximized');
    });

    document.getElementById('restore-button').addEventListener("click", () => {
        window.electronAPI.maximize();
        document.body.classList.remove('maximized');
    });

    document.getElementById('close-button').addEventListener("click", () => {
        window.electronAPI.close();
    });
}

addEvents()

// Toggle maximise/restore buttons when maximisation/unmaximisation occurs
/*    toggleMaxRestoreButtons();
    win.on('maximize', toggleMaxRestoreButtons);
    win.on('unmaximize', toggleMaxRestoreButtons);

    function toggleMaxRestoreButtons() {
        if (win.isMaximized()) {
            document.body.classList.add('maximized');
        } else {
            document.body.classList.remove('maximized');
        }
    }*/
