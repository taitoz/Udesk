/**
 * The preload script runs before. It has access to web APIs
 * as well as Electron's renderer process modules and some
 * polyfilled Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose IPC API to renderer process via contextBridge
// This provides a secure way to communicate with main process
contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, ...args) => {
        ipcRenderer.send(channel, ...args);
    },
    sendSync: (channel, ...args) => {
        return ipcRenderer.sendSync(channel, ...args);
    },
    invoke: (channel, ...args) => {
        return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel, callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => {
            ipcRenderer.removeListener(channel, subscription);
        };
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type])
    }

})