import {Component, Inject, OnInit} from '@angular/core';
import {ElectronService} from 'ngx-electronyzer';
import {MenuItem} from 'primeng/api';
import {DOCUMENT} from '@angular/common';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit {

  items: MenuItem[] | undefined;

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

  ngOnInit(): void {
    this.items = [
      {
        separator: true
      },
      {
        label: '',
        items: [
          {
            label: 'New',
            icon: 'pi pi-plus',
            shortcut: '⌘+N'
          },
          {
            label: 'Search',
            icon: 'pi pi-search',
            shortcut: '⌘+S'
          }
        ]
      },
      {
        label: '',
        items: [
          {
            label: 'Settings',
            icon: 'pi pi-cog',
            shortcut: '⌘+O'
          },
          {
            label: 'Messages',
            icon: 'pi pi-inbox',
            badge: '2'
          },
          {
            label: 'Logout',
            icon: 'pi pi-sign-out',
            shortcut: '⌘+Q'
          }
        ]
      },
      {
        separator: true
      }
    ];
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
