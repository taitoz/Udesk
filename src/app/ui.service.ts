import { HttpClient } from '@angular/common/http';
import {EventEmitter, Injectable, Output} from '@angular/core';
import {TreeNode} from 'primeng/api';
import {SessionStorageService} from 'angular-web-storage';
import {ElectronService} from "ngx-electronyzer";
import './electron-api.d.ts';

@Injectable()
export class UiService {

    @Output() showLoading = new EventEmitter<boolean>();
    @Output() themeChange: EventEmitter<string> = new EventEmitter();
    @Output() activeProfileChange: EventEmitter<string> = new EventEmitter();
    @Output() profilesListChange: EventEmitter<void> = new EventEmitter();

    // Layout events (single-renderer architecture)
    @Output() sideMenuToggle = new EventEmitter<string>();  // menuId or null to close
    @Output() settingsToggle = new EventEmitter<boolean>();
    @Output() mainViewResize = new EventEmitter<{x: number, y: number, width: number, height: number}>();

    constructor(
        private http: HttpClient,
        private sessionStorage: SessionStorageService,
        private electronService: ElectronService
    ) {
        if (this.isElectron()) {
            // Use window.electronAPI if available (contextIsolation: true), otherwise fall back to ipcRenderer
            if (window.electronAPI) {
                window.electronAPI.on('showLoading', (show: boolean) => {
                    this.showLoading.emit(show)
                })
                window.electronAPI.on('theme-toggle', (theme: string) => {
                    this.themeChange.emit(theme)
                })
                window.electronAPI.on('activeProfile:update', (activeProfile: string) => {
                    this.activeProfileChange.emit(activeProfile)
                })
            } else if (this.electronService.isElectronApp) {
                this.electronService.ipcRenderer.on('showLoading', (event: any, show: boolean) => {
                    this.showLoading.emit(show)
                })
                this.electronService.ipcRenderer.on('theme-toggle', (event: any, theme: string) => {
                    this.themeChange.emit(theme)
                })
                this.electronService.ipcRenderer.on('activeProfile:update', (event: any, activeProfile: string) => {
                    this.activeProfileChange.emit(activeProfile)
                })
            }
        }

    }

    private isElectron(): boolean {
        return window.electronAPI !== undefined || this.electronService.isElectronApp;
    }

    //awaits return value
    ipcSendSync(channel: string, ...args: any[]) {
        if (window.electronAPI) {
            return window.electronAPI.sendSync(channel, args);
        } else if (this.electronService.isElectronApp) {
            return this.electronService.ipcRenderer.sendSync(channel, args);
        }
    }

    //async void
    ipcSend(channel: string, ...args: any[]) {
        if (window.electronAPI) {
            window.electronAPI.send(channel, args);
        } else if (this.electronService.isElectronApp) {
            this.electronService.ipcRenderer.send(channel, args);
        }
    }

    //return Promise
    async ipcInvoke(channel: string, ...args: any[]) {
        if (window.electronAPI) {
            return window.electronAPI.invoke(channel, args);
        } else if (this.electronService.isElectronApp) {
            return this.electronService.ipcRenderer.invoke(channel, args);
        }
    }

    toggleTheme(document: Document, theme: string) {
        if (theme === 'dark') {
            document.documentElement.classList.add('app-dark');
        } else {
            document.documentElement.classList.remove('app-dark');
        }
    }

    saveToSessionStorage(testData: TreeNode[]) {
        this.sessionStorage.set('testData', testData, 10, 'h');
    }

}
