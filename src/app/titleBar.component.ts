import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {UiService} from "./ui.service";

@Component({
    selector: 'titleBar',
    standalone: false,
    templateUrl: './titleBar.component.html',
    styleUrl: './titleBar.component.css'
})
export class TitleBarComponent implements OnInit{

    showLoading = false

    constructor(
        private uiService: UiService,
        private cdr: ChangeDetectorRef
    ) {
    }

    ngOnInit() {
        this.uiService.showLoading.subscribe(show => {
            this.showLoading = show
            this.cdr.detectChanges()
        })
    }

    toggleSideMenu(event: Event) {
        this.addClickAnimation(event)
        this.uiService.settingsToggle.emit(false)
        this.uiService.sideMenuToggle.emit('servicesMenu')
    }

    callRenderer(channel: string, event: Event) {
        this.addClickAnimation(event)
        this.uiService.ipcInvoke(channel).then()
    }

    private addClickAnimation(event: Event) {
        const target = event.currentTarget as HTMLElement
        target.classList.add('clicked')
        setTimeout(() => {
            target.classList.remove('clicked')
        }, 600)
    }
}
