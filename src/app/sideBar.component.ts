import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {UiService} from './ui.service';

@Component({
    selector: 'sideBar',
    standalone: false,
    templateUrl: './sideBar.component.html',
    styleUrl: './sideBar.component.css'
})
export class SideBarComponent implements OnInit {

    activeProfile: any
    logoCachePath: string

    constructor(
        private uiService: UiService,
        private cdr: ChangeDetectorRef
    ) {
    }

    ngOnInit(): void {
        this.activeProfile = this.uiService.ipcSendSync('profiles:getActive')
        this.logoCachePath = this.uiService.getLogoCachePath()

        this.uiService.activeProfileChange.subscribe(activeProfile => {
            this.onActiveProfileUpdate(activeProfile)
        })
    }

    openLink(url: string) {
        this.uiService.settingsToggle.emit(false);
        this.uiService.sideMenuToggle.emit(null);
        this.uiService.ipcInvoke('load-url', url, false).then()
    }

    getActiveProfileHomeUrl() {
        return this.activeProfile['homeUrl']
    }

    toggleSideMenu(menuId: string) {
        this.uiService.settingsToggle.emit(false);
        this.uiService.sideMenuToggle.emit(menuId);
    }

    toggleSettings() {
        this.uiService.settingsToggle.emit(null);
    }

    callRenderer(channel: string) {
        this.uiService.settingsToggle.emit(false);
        this.uiService.ipcInvoke(channel).then()
    }

    onActiveProfileUpdate(activeProfile: any) {
        this.activeProfile = activeProfile
        this.cdr.detectChanges()
    }

    getLogoPath(profile: any){
        return  this.uiService.getLogoPath(profile)
    }
}
