import {ChangeDetectorRef, Component, Inject, OnInit} from '@angular/core';
import {DOCUMENT} from '@angular/common';
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
        @Inject(DOCUMENT) private document: Document,
        private cdr: ChangeDetectorRef
    ) {
    }

    ngOnInit() {
        // Apply initial theme
        const currentTheme = this.uiService.ipcSendSync('settings:getTheme')
        this.uiService.toggleTheme(this.document, currentTheme)

        this.uiService.showLoading.subscribe(show => {
            this.showLoading = show
            this.cdr.detectChanges()
        })

        this.uiService.themeChange.subscribe(theme => {
            this.uiService.toggleTheme(this.document, theme)
        })
    }

    callRenderer(channel: string) {
        this.uiService.ipcInvoke(channel).then()
    }
}
