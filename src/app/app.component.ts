import {AfterViewChecked, Component, ElementRef, HostListener, Inject, NgZone, OnDestroy, OnInit, ViewChild, ViewEncapsulation} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {UiService} from './ui.service';
import {Subscription} from 'rxjs';
import './electron-api.d.ts';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit, OnDestroy, AfterViewChecked {

  sideMenuVisible = false;
  sideMenuId = 'servicesMenu';
  sideMenuWidth = 230;
  settingsVisible = false;
  sideBarWidth = 70;
  titleBarHeight = 34;

  private splitterDragging = false;
  private subscriptions: Subscription[] = [];
  private lastMainViewBounds = '';

  @ViewChild('mainViewPlaceholder') mainViewPlaceholder: ElementRef;

  constructor(
      private uiService: UiService,
      private zone: NgZone,
      @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit() {
    // Apply initial theme
    const currentTheme = this.uiService.ipcSendSync('settings:getTheme');
    this.uiService.toggleTheme(this.document, currentTheme || 'dark');

    this.subscriptions.push(
        this.uiService.themeChange.subscribe(theme => {
          this.uiService.toggleTheme(this.document, theme);
        }),
        this.uiService.sideMenuToggle.subscribe(menuId => {
          if (menuId && (!this.sideMenuVisible || this.sideMenuId !== menuId)) {
            this.sideMenuId = menuId;
            this.sideMenuVisible = true;
            this.settingsVisible = false;
          } else {
            this.sideMenuVisible = false;
          }
          setTimeout(() => this.updateMainViewBounds(), 0);
        }),
        this.uiService.settingsToggle.subscribe(show => {
          this.settingsVisible = (show === null) ? !this.settingsVisible : show;
          if (this.settingsVisible) {
            this.sideMenuVisible = false;
          }
          setTimeout(() => this.updateMainViewBounds(), 0);
        })
    );
  }

  ngAfterViewChecked() {
    this.updateMainViewBounds();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  onSplitterMouseDown(event: MouseEvent) {
    event.preventDefault();
    this.splitterDragging = true;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.splitterDragging) return;
    const newWidth = event.clientX - this.sideBarWidth;
    if (newWidth >= 120 && newWidth <= 500) {
      this.sideMenuWidth = newWidth;
      this.updateMainViewBounds();
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.splitterDragging = false;
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.updateMainViewBounds();
  }

  private updateMainViewBounds() {
    if (this.settingsVisible || !this.mainViewPlaceholder) {
      // Hide mainView when settings is shown
      const bounds = {x: 0, y: 0, width: 0, height: 0};
      const key = JSON.stringify(bounds);
      if (key !== this.lastMainViewBounds) {
        this.lastMainViewBounds = key;
        this.uiService.ipcSend('mainView:resize', bounds);
      }
      return;
    }

    const el = this.mainViewPlaceholder.nativeElement as HTMLElement;
    const rect = el.getBoundingClientRect();
    const bounds = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
    const key = JSON.stringify(bounds);
    if (key !== this.lastMainViewBounds) {
      this.lastMainViewBounds = key;
      this.uiService.ipcSend('mainView:resize', bounds);
    }
  }
}
