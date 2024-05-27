import {Component, Inject, OnInit} from '@angular/core';
import {ElectronService} from 'ngx-electronyzer';
import {DOCUMENT} from '@angular/common';

@Component({
    selector: 'app-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit {

    constructor(
        private electronService: ElectronService,
        @Inject(DOCUMENT) private document: Document
    ) {
        if (this.electronService.isElectronApp) {
            this.electronService.ipcRenderer.on('theme-toggle', (event, theme) => {
                this.toggleTheme(theme);
            });
        }
    }

    ngOnInit(): void {
    }

    callRenderer(channel: string) {
        if (this.electronService.isElectronApp) {
            this.electronService.ipcRenderer.invoke(channel).then();
        }
        console.log(channel)
    }

    toggleTheme(theme) {
        const head = this.document.getElementsByTagName('head')[0];
        let themeLink = this.document.getElementById('client-theme') as HTMLLinkElement;

        if (themeLink === null) {
            const style = this.document.createElement('link');
            style.id = 'client-theme';
            style.rel = 'stylesheet';
            style.type = 'text/css';
            style.href = 'assets/primeThemeLight.css';
            head.appendChild(style);
            themeLink = style;
        }
        if (theme === 'dark') {
            themeLink.href = 'assets/primeThemeDark.css';
        } else {
            themeLink.href = 'assets/primeThemeLight.css';
        }
    }
}
