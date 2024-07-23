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

    toggleTheme(document: Document, theme: string){

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

    loadProfiles(){
        if (this.electronService.isElectronApp) {
            //this.electronService.shell.beep();
            return this.electronService.ipcRenderer.sendSync('profiles:get');
        }
    }

    addProfile(profileJson:any){
        return this.electronService.ipcRenderer.sendSync('profiles:add', profileJson);
    }

    deleteProfile(profileName:any){
        return this.electronService.ipcRenderer.sendSync('profiles:delete', profileName);
    }

    loadSideMenuData(menuId: string): TreeNode[] {
        if (this.electronService.isElectronApp) {
            //this.electronService.shell.beep();
            return this.electronService.ipcRenderer.sendSync(menuId+':get');
        } else {
                //TODO fix
                // const testData = this.sessionStorage.get('testData');
                // if (testData != null) {
                //     observer.next(testData);
                //     observer.complete();
                // } else {
                this.http.get<TreeNode[]>('assets/'+menuId+'.json').subscribe((response: TreeNode[]) => {
                        //this.saveToSessionStorage(response);
                    return response
                    }
                );
                // }
        }
    }

    saveToSessionStorage(testData: TreeNode[]) {
        this.sessionStorage.set('testData', testData, 10, 'h');
    }

    getAppLogoPath(){
        if (this.electronService.isElectronApp) {
             return '../assets/logo48.png'
         } else {
            return '/assets/image.svg'
         }
    }
}
