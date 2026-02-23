import {Component, ViewEncapsulation} from '@angular/core';
import {Router, RouterOutlet} from '@angular/router';
import {ElectronService} from 'ngx-electronyzer';
import './electron-api.d.ts';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent {
  constructor(
      private electronService: ElectronService,
      private router: Router
  ){
    // Setup IPC listeners
    if (window.electronAPI) {
      window.electronAPI.on('loadComponent', (link) => {
        this.router.navigate(['/' + link]).then();
      });
    } else if (this.electronService.isElectronApp) {
      this.electronService.ipcRenderer.on('loadComponent', (event, link) => {
        this.router.navigate(['/' + link]).then();
      });
    }
  }
}
