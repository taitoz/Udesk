import {Component} from '@angular/core';
import {ElectronService} from 'ngx-electronyzer';

@Component({
  selector: 'app-titlebar',
  templateUrl: './titlebar.component.html',
  styleUrl: './titlebar.component.css'
})
export class TitlebarComponent {
  constructor(
      private electronService: ElectronService
  ) {
  }

  callRenderer(channel: string) {
    if (this.electronService.isElectronApp) {
      this.electronService.ipcRenderer.invoke(channel).then();
    }
    console.log(channel)
  }

}
