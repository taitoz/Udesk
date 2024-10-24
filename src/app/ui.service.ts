import { HttpClient } from '@angular/common/http';
import {EventEmitter, Injectable, Output} from '@angular/core';
import {TreeNode} from 'primeng/api';
import {SessionStorageService} from 'angular-web-storage';
import {ElectronService} from "ngx-electronyzer";

@Injectable()
export class UiService {

    @Output() themeChange: EventEmitter<string> = new EventEmitter();
    @Output() activeProfileChange: EventEmitter<string> = new EventEmitter();

    constructor(
        private http: HttpClient,
        private sessionStorage: SessionStorageService,
        private electronService: ElectronService
    ) {
        if (this.electronService.isElectronApp) {
            this.electronService.ipcRenderer.on('theme-toggle', (event, theme) => {
                this.themeChange.emit(theme)
            })
            this.electronService.ipcRenderer.on('activeProfile:update', (event, activeProfile) => {
                this.activeProfileChange.emit(activeProfile)
            })
        }
    }

    //awaits return value
    ipcSendSync(channel: string, ...args: any[]) {
        if (this.electronService.isElectronApp) {
            return this.electronService.ipcRenderer.sendSync(channel, args);
        }
    }

    //async void
    ipcSend(channel: string, ...args: any[]) {
        if (this.electronService.isElectronApp) {
            this.electronService.ipcRenderer.send(channel, args);
        }
    }

    //return Promise
    async ipcInvoke(channel: string, ...args: any[]) {
        if (this.electronService.isElectronApp) {
            return this.electronService.ipcRenderer.invoke(channel, args);
        }
    }

    getLogoCachePath() : string {
        return this.ipcSendSync('logoCache:getPath')
    }

    toggleTheme(document: Document, theme: string) {

        const head = document.getElementsByTagName('head')[0];
        let themeLink = document.getElementById('client-theme') as HTMLLinkElement;

        if (themeLink === null) {
            const style = document.createElement('link');
            style.id = 'client-theme';
            style.rel = 'stylesheet';
            style.type = 'text/css';
            style.href = 'assets/primeThemeDark.css';
            head.appendChild(style);
            themeLink = style;
        }
        switch (theme) {
            case 'dark': {
                themeLink.href = 'assets/primeThemeDark.css';
                break
            }
            case 'light': {
                themeLink.href = 'assets/primeThemeLight.css';
                break
            }
        }
    }

    saveToSessionStorage(testData: TreeNode[]) {
        this.sessionStorage.set('testData', testData, 10, 'h');
    }

}
