import {Component, ViewEncapsulation} from '@angular/core';
import {Router, RouterOutlet} from '@angular/router';
import {ElectronService} from 'ngx-electronyzer';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent {
  constructor(
      private electronService: ElectronService,
      private router: Router
  ){
    if (this.electronService.isElectronApp) {
      this.electronService.ipcRenderer.on('loadComponent', (event, link) => {
        //console.log(link)
        this.router.navigate(['/' + link]).then();
      });
    }
  }
}
