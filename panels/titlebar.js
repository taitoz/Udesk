function addEvents() {
    //document.getElementById('drag-region').style.webkitAppRegion = "drag"
    document.getElementById('back-button').addEventListener("click", () => {
        window.electronAPI.goBack();
    });

    document.getElementById('reload-button').addEventListener("click", () => {
        window.electronAPI.reload();
    });

    document.getElementById('min-button').addEventListener("click", () => {
        window.electronAPI.minimize();
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

window.electronAPI.onThemeToggle((value) => {
    document.querySelector("body").classList.toggle("light")
})
