import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {UiService} from "./ui.service";

@Component({
    selector: 'titleBar',
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

    callRenderer(channel: string) {
        this.uiService.ipcInvoke(channel).then()
    }
}
