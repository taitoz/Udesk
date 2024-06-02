import {Component, Inject, OnInit, ViewChild} from '@angular/core';
import {MenuItem, TreeNode} from 'primeng/api';
import {UiService} from './ui.service';
import {DOCUMENT} from '@angular/common';

@Component({
    selector: 'sideMenu',
    templateUrl: './sideMenu.component.html',
    styleUrl: './sideMenu.component.scss'
})

export class SideMenuComponent implements OnInit {

    treeNodesData: TreeNode[];
    menuItems: MenuItem[] = [];
    appName: string = 'desk';

    @ViewChild('menubar') menuBar: any;

    constructor(
        private uiService: UiService,
        @Inject(DOCUMENT) private document: Document
    ) {
    }

    ngOnInit() {

        this.uiService.themeChange.subscribe(theme => {
            this.uiService.toggleTheme(this.document, theme)
        })

        this.treeNodesData = this.uiService.loadSideMenuData();
        this.loadMenuItemsFromTreeNodesData();

        // this.uiService.appNameChange.subscribe(appName => {
        //     this.appName = appName;
        // });
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
                // console.log(treeNode.data.value);
                this.uiService.ipcInvoke('load-url', treeNode.data.value)
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
