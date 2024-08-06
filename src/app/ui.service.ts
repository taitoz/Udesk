import {HttpClient} from '@angular/common/http';
import {EventEmitter, Injectable, Output} from '@angular/core';
import {TreeNode} from 'primeng/api';
import {SessionStorageService} from 'angular-web-storage';
import {ElectronService} from "ngx-electronyzer";

@Injectable()
export class UiService {

    @Output() themeChange: EventEmitter<string> = new EventEmitter();

    constructor(
        private http: HttpClient,
        private sessionStorage: SessionStorageService,
        private electronService: ElectronService
    ) {
        if (this.electronService.isElectronApp) {
            this.electronService.ipcRenderer.on('theme-toggle', (event, theme) => {
                this.themeChange.emit(theme)
            });
        }
    }

    ipcSend(channel: string, data?: any) {
        if (this.electronService.isElectronApp) {
            this.electronService.ipcRenderer.send(channel, data);
        }
        //console.log(channel)
    }

    ipcInvoke(channel: string, data?: any) {
        if (this.electronService.isElectronApp) {
            this.electronService.ipcRenderer.invoke(channel, data).then();
        }
        //console.log(channel)
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

    loadProfiles() {
        if (this.electronService.isElectronApp) {
            //this.electronService.shell.beep();
            return this.electronService.ipcRenderer.sendSync('profiles:get');
        } else {
            return [
                {
                    "name": "default",
                    "logo": "logo48b",
                    "lang": "ru",
                    "homeUrl": "localhost"
                },
                {
                    "name": "1",
                    "logo": "logo48b",
                    "lang": "ru",
                    "homeUrl": "http://test"
                }
            ]
        }
    }

    addProfile(profileJson: any) {
        if (this.electronService.isElectronApp) {
            return this.electronService.ipcRenderer.sendSync('profiles:add', profileJson);
        }
    }

    deleteProfile(profileName: any) {
        if (this.electronService.isElectronApp) {
            return this.electronService.ipcRenderer.sendSync('profiles:delete', profileName);
        }
    }

    loadSideMenuData(menuId: string): TreeNode[] {
        if (this.electronService.isElectronApp) {
            //this.electronService.shell.beep();
            return this.electronService.ipcRenderer.sendSync(menuId + ':get');
        } else {
            return [
                {
                    "data": {
                        "id": 1,
                        "key": "Test1",
                        "value": "https://test1/",
                        "icon": "bx bx-home-alt"
                    },
                    "children": [],
                    "parent": null,
                    "expanded": true
                },
                {
                    "data": {
                        "id": 2,
                        "key": "Test2",
                        "value": "https://test2/",
                        "icon": "bx bx-film"
                    },
                    "children": [],
                    "parent": null,
                    "expanded": true
                }
            ]
        }
    }

    saveToSessionStorage(testData: TreeNode[]) {
        this.sessionStorage.set('testData', testData, 10, 'h');
    }

    getAppLogoPath() {
        if (this.electronService.isElectronApp) {
            return this.electronService.ipcRenderer.sendSync('sideBar:logo:get');
        } else {
            return '/assets/image.svg'
        }
    }
}
