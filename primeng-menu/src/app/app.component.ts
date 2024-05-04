import {Component, Inject, OnInit, ViewEncapsulation} from '@angular/core';
import {MenuItem, MessageService, TreeNode} from 'primeng/api';
import {FileService} from './fileService';
import {ElectronService} from 'ngx-electronyzer';
import {DOCUMENT} from '@angular/common';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    encapsulation: ViewEncapsulation.Emulated,
    providers: [MessageService]
})

export class AppComponent implements OnInit {

    treeNodesData: TreeNode[];
    items: MenuItem[] = [];

    public isLightTheme = true;

    constructor(
        private electronService: ElectronService,
        private fileService: FileService,
        private messageService: MessageService,
        @Inject(DOCUMENT) private document: Document
    ) {
        // if (this.electronService.isElectronApp) {
        //     this.electronService.ipcRenderer.on('asynchronous-reply', (event, arg) => {
        //         this.ngZone.run(() => {
        //             console.log(`Asynchronous message reply: ${arg}`);
        //         });
        //     });
        // }
    }

    ngOnInit() {

        if (this.electronService.isElectronApp) {
            //this.electronService.shell.beep();
            this.treeNodesData = this.electronService.ipcRenderer.sendSync('sideBarMenu:get');
            console.log('treeNodesData loaded from electron');
        } else {
            this.fileService.loadTestData().subscribe(result => {
                this.treeNodesData = result;
                console.log('treeNodesData loaded from file');
            });
        }
        this.loadMenuItemsFromTreeNodesData();

    }

    loadMenuItemsFromTreeNodesData() {

        this.treeNodesData.forEach(treeNode => {
            let menuItem = {
                label: treeNode.data.key,
                icon: treeNode.data.icon,
                items: []
            };
            if (treeNode.children) {
                treeNode.children.forEach(innerTreeNode => {
                    let innerMenuItem = {
                        label: innerTreeNode.data.key,
                        icon: innerTreeNode.data.icon,
                        items: []
                    };
                    menuItem.items.push(innerMenuItem);
                });
            }
            this.items.push(menuItem);
        });
    }

    onThemeSwitchChange() {
        this.isLightTheme = !this.isLightTheme;

        document.body.setAttribute(
            'data-theme',
            this.isLightTheme ? 'light' : 'dark'
        );
    }

    toggleTheme() {
        let theme = 'light';
        const head = this.document.getElementsByTagName('head')[0];
        let themeLink = this.document.getElementById(
            'client-theme'
        ) as HTMLLinkElement;
        if (themeLink) {
            if (themeLink.href.includes('Light')) {
                themeLink.href = 'assets/primeThemeDark.css';
                theme = 'dark';
            } else {
                themeLink.href = 'assets/primeThemeLight.css';
                theme = 'light';
            }
        } else {
            const style = this.document.createElement('link');
            style.id = 'client-theme';
            style.rel = 'stylesheet';
            style.type = 'text/css';
            style.href = 'assets/primeThemeLight.css';
            head.appendChild(style);
        }

        this.electronService.ipcRenderer.send('settings:toggleTheme', theme);
    }
}
