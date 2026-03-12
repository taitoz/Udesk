import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {UiService} from './ui.service';

@Component({
    selector: 'sideBar',
    standalone: false,
    templateUrl: './sideBar.component.html',
    styleUrl: './sideBar.component.css'
})
export class SideBarComponent implements OnInit {

    profiles: any[] = []
    activeProfile: any
    settingsActive = false

    constructor(
        private uiService: UiService,
        private cdr: ChangeDetectorRef
    ) {
    }

    ngOnInit(): void {
        this.loadProfiles()

        this.uiService.activeProfileChange.subscribe(activeProfile => {
            this.activeProfile = activeProfile
            this.loadProfiles()
        })

        this.uiService.profilesListChange.subscribe(() => {
            this.loadProfiles()
        })

        this.uiService.settingsToggle.subscribe(show => {
            this.settingsActive = (show === null) ? !this.settingsActive : show
            this.cdr.detectChanges()
        })
    }

    async loadProfiles() {
        this.profiles = await this.uiService.ipcInvoke('profiles:get') || []
        this.profiles.sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt || 0).getTime()
            const dateB = new Date(b.createdAt || 0).getTime()
            return dateA - dateB
        })
        // Migrate old PNG logos
        this.profiles.forEach(p => {
            if (!p.logo || !p.logo.startsWith('bx ')) p.logo = 'bx bx-desktop'
        })
        this.activeProfile = this.profiles.find(p => p.active) || this.activeProfile
        this.cdr.detectChanges()
    }

    selectProfile(profile: any) {
        this.uiService.settingsToggle.emit(false)
        if (this.activeProfile?._id === profile._id) {
            // Already active — toggle sideMenu
            this.uiService.sideMenuToggle.emit('servicesMenu')
            return
        }
        // Different profile — just activate it, don't open sideMenu
        this.uiService.sideMenuToggle.emit(null)
        this.uiService.ipcInvoke('profiles:setActive', profile._id).then(() => {
            this.activeProfile = profile
            this.cdr.detectChanges()
        })
    }

    toggleSettings() {
        this.uiService.settingsToggle.emit(null);
    }
}
