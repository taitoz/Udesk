import {Component} from '@angular/core';
import {ElectronService} from 'ngx-electronyzer';

@Component({
  selector: 'app-titleBar',
  templateUrl: './titleBar.component.html',
  styleUrl: './titleBar.component.css'
})
export class TitleBarComponent {
  constructor(
      private electronService: ElectronService
  ) {
  }

  callRenderer(channel: string) {
    if (this.electronService.isElectronApp) {
      this.electronService.ipcRenderer.invoke(channel).then();
    }
  }

}
