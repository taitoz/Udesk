import {ChangeDetectorRef, Component, Inject, OnInit} from '@angular/core';
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
        @Inject(DOCUMENT) private document: Document,
        private cdr: ChangeDetectorRef
    ) {
    }

    ngOnInit(): void {
        this.appLogoPath = this.uiService.ipcSendSync('sideBar:logo:get')

        this.uiService.themeChange.subscribe(theme => {
            this.uiService.toggleTheme(this.document, theme)
        });
        this.uiService.logoChange.subscribe(logoPath => {
            this.logoUpdate(logoPath)
        })
    }

    openLink(url: string) {
        this.uiService.ipcInvoke('load-url', url).then()
    }

    getActiveProfileHomeUrl() {
        const activeProfile = this.uiService.ipcSendSync('profiles:getActive')
        return activeProfile['homeUrl']
    }

    ipcSend(channel: string, data: string) {
        this.uiService.ipcSend(channel, data)
    }

    callRenderer(channel: string) {
        this.uiService.ipcInvoke(channel).then()
    }

    logoUpdate(logoPath: string) {
        this.appLogoPath = logoPath
        this.cdr.detectChanges()
    }
}
