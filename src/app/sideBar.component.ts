import {Component, Inject, OnInit} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {UiService} from './ui.service';

@Component({
    selector: 'sideBar',
    templateUrl: './sideBar.component.html',
    styleUrl: './sideBar.component.css'
})
export class SideBarComponent implements OnInit {

    appLogoPath: string;

    constructor(
        private uiService: UiService,
        @Inject(DOCUMENT) private document: Document
    ) {
    }

    ngOnInit(): void {
        this.appLogoPath = this.uiService.getAppLogoPath();

        this.uiService.themeChange.subscribe(theme => {
            this.uiService.toggleTheme(this.document, theme)
        })
    }

    openLink(url:string){
        this.uiService.ipcInvoke('load-url', url)
    }

    getActiveProfileHomeUrl() {
        return this.uiService.getActiveProfileKey('homeUrl')
    }

    ipcSend(channel:string, data:string){
        this.uiService.ipcSend(channel, data)
    }
    callRenderer(channel: string) {
        this.uiService.ipcInvoke(channel)
    }

    loadLogo() {
        // this.uiService
    }
}
