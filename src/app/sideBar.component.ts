import {ChangeDetectorRef, Component, Inject, OnInit} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {UiService} from './ui.service';

@Component({
    selector: 'sideBar',
    templateUrl: './sideBar.component.html',
    styleUrl: './sideBar.component.css'
})
export class SideBarComponent implements OnInit {

    activeProfile: any
    logoCachePath: string

    constructor(
        private uiService: UiService,
        @Inject(DOCUMENT) private document: Document,
        private cdr: ChangeDetectorRef
    ) {
    }

    ngOnInit(): void {

        this.activeProfile = this.uiService.ipcSendSync('profiles:getActive')
        this.logoCachePath = this.uiService.getLogoCachePath()

        this.uiService.themeChange.subscribe(theme => {
            this.uiService.toggleTheme(this.document, theme)
        });
        this.uiService.activeProfileChange.subscribe(activeProfile => {
            this.onActiveProfileUpdate(activeProfile)
        })
    }

    openLink(url: string) {
        this.uiService.ipcInvoke('load-url', url).then()
    }

    getActiveProfileHomeUrl() {
        return this.activeProfile['homeUrl']
    }

    ipcSend(channel: string, data: string) {
        this.uiService.ipcSend(channel, data)
    }

    callRenderer(channel: string) {
        this.uiService.ipcInvoke(channel).then()
    }

    onActiveProfileUpdate(activeProfile: any) {
        this.activeProfile = activeProfile
        this.cdr.detectChanges()
    }
}
