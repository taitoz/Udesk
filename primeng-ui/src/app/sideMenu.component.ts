import {Component, Inject, OnInit, ViewChild, ViewEncapsulation} from '@angular/core';
import {MenuItem, MessageService, TreeNode} from 'primeng/api';
import {FileService} from './fileService';
import {ElectronService} from 'ngx-electronyzer';
import {DOCUMENT} from '@angular/common';

@Component({
    selector: 'app-menu',
    templateUrl: './sideMenu.component.html',
    styleUrls: ['./sideMenu.component.scss'],
    encapsulation: ViewEncapsulation.Emulated,
    providers: [MessageService]
})

export class SideMenuComponent implements OnInit {

    treeNodesData: TreeNode[];
    menuItems: MenuItem[] = [];

    //public isLightTheme = true;
    @ViewChild('menubar') menuBar: any;

    constructor(
        private electronService: ElectronService,
        private fileService: FileService,
        private messageService: MessageService,
        @Inject(DOCUMENT) private document: Document
    ) {
        if (this.electronService.isElectronApp) {
            this.electronService.ipcRenderer.on('theme-toggle', (event, theme) => {
                this.toggleTheme(theme);
            });
        }
    }

    ngOnInit() {

        if (this.electronService.isElectronApp) {
            //this.electronService.shell.beep();
            this.treeNodesData = this.electronService.ipcRenderer.sendSync('sideBarMenu:get');
            this.loadMenuItemsFromTreeNodesData();
            console.log('treeNodesData loaded from electron');
        } else {
            this.fileService.loadTestData().subscribe(result => {
                this.treeNodesData = result;
                this.loadMenuItemsFromTreeNodesData();
                console.log('treeNodesData loaded from file');
            });
        }


    }
    loadMenuItemsFromTreeNodesData() {

        this.treeNodesData.forEach(treeNode => {
            this.menuItems.push(this.buildMenuItem(treeNode));
        });
        this.menuItems = [...this.menuItems];
    }
    buildMenuItem(treeNode: TreeNode): MenuItem {
        let menuItem = {
            label: treeNode.data.key,
            value: treeNode.data.value,
            command: () => {
                console.log(treeNode.data.value);
                if (this.electronService.isElectronApp) {
                    this.electronService.ipcRenderer.invoke('load-url', treeNode.data.value)
                }
            },
            // icon: (treeNode.data.icon) ? treeNode.data.icon : 'pi pi-circle-off',
            // badge: treeNode.data.id +' ',
            items: []
        };
        if (treeNode.children) {
            treeNode.children.forEach(innerTreeNode => {
                menuItem.items.push(this.buildMenuItem(innerTreeNode));
            });
        }
        return menuItem;
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
    toggleAll() {
        const expanded = !this.areAllItemsExpanded();
        this.menuItems = this.toggleAllRecursive(this.menuItems, expanded);
    }
    private toggleAllRecursive(items: MenuItem[], expanded: boolean): MenuItem[] {
        return items.map((menuItem) => {
            menuItem.expanded = expanded;
            if (menuItem.items) {
                menuItem.items = this.toggleAllRecursive(menuItem.items, expanded);
            }
            return menuItem;
        });
    }
    private areAllItemsExpanded(): boolean {
        return this.menuItems.every((menuItem) => menuItem.expanded);
    }
}
