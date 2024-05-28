import {Component, Inject} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {ElectronService} from 'ngx-electronyzer';

@Component({
  selector: 'app-titlebar',
  templateUrl: './titlebar.component.html',
  styleUrl: './titlebar.component.css'
})
export class TitlebarComponent {
  constructor(
      private electronService: ElectronService,
      @Inject(DOCUMENT) private document: Document
  ) {
    if (this.electronService.isElectronApp) {
      this.electronService.ipcRenderer.on('theme-toggle', (event, theme) => {
        this.toggleTheme(theme);
      });
    }
  }

  callRenderer(channel: string) {
    if (this.electronService.isElectronApp) {
      this.electronService.ipcRenderer.invoke(channel).then();
    }
    console.log(channel)
  }

  toggleTheme(theme) {
    const head = this.document.getElementsByTagName('head')[0];
    let themeLink = this.document.getElementById('client-theme') as HTMLLinkElement;

    if (themeLink === null) {
      const style = this.document.createElement('link');
      style.id = 'client-theme';
      style.rel = 'stylesheet';
      style.type = 'text/css';
      style.href = 'assets/primeThemeLight.css';
      head.appendChild(style);
      themeLink = style;
    }
    if (theme === 'dark') {
      themeLink.href = 'assets/primeThemeDark.css';
    } else {
      themeLink.href = 'assets/primeThemeLight.css';
    }
  }
}
