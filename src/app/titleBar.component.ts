import {Component} from '@angular/core';
import {UiService} from "./ui.service";

@Component({
    selector: 'titleBar',
    templateUrl: './titleBar.component.html',
    styleUrl: './titleBar.component.css'
})
export class TitleBarComponent {

    showLoading = false

    constructor(
        private uiService: UiService
    ) {
    }

    callRenderer(channel: string) {
        this.uiService.ipcInvoke(channel).then()
    }
}
