import {ChangeDetectorRef, Component, Inject, OnInit, ViewChild} from '@angular/core';
import {MenuItem, TreeNode} from 'primeng/api';
import {UiService} from './ui.service';
import {DOCUMENT} from '@angular/common';
import {ActivatedRoute, Router} from '@angular/router';
import {switchMap} from "rxjs";

@Component({
    selector: 'sideMenu',
    templateUrl: './sideMenu.component.html',
    styleUrl: './sideMenu.component.scss'
})

export class SideMenuComponent implements OnInit {

    activeProfile: any
    treeNodesData: TreeNode[];
    menuItems: MenuItem[] = [];
    menuName: string = '';

    @ViewChild('menubar') menuBar: any;

    constructor(
        private uiService: UiService,
        private route: ActivatedRoute,
        private router: Router,
        @Inject(DOCUMENT) private document: Document,
        private cdr: ChangeDetectorRef
    ) {
        this.route.params.subscribe({
            next: params => {
                this.menuName = this.getMenuName(params['menuId']);
            },
            error: error => {
                console.log(error)
            },
            complete: () => {
                console.log('Request complete');
            }
        });

        // this.route.params.subscribe(params => {
        //     this.menuName = this.getMenuName(params['menuId']);
        //     this.treeNodesData = this.uiService.loadSideMenuData(params['menuId']);
        //     this.loadMenuItemsFromTreeNodesData();
        // }, error => {
        //     console.log(error)
        //     //router.navigate(['']);
        // });
    }

    ngOnInit() {

        this.activeProfile = this.uiService.ipcSendSync('profiles:getActive')
        this.treeNodesData = this.activeProfile['sideMenuTreeNodes']
        this.loadMenuItemsFromTreeNodesData();

        this.uiService.themeChange.subscribe(theme => {
            this.uiService.toggleTheme(this.document, theme)
        })
        this.uiService.activeProfileChange.subscribe(activeProfile => {
            this.onActiveProfileUpdate(activeProfile)
        })

        //this.treeNodesData = this.uiService.loadSideMenuData('services');
        //this.loadMenuItemsFromTreeNodesData();

        // this.uiService.appNameChange.subscribe(appName => {
        //     this.appName = appName;
        // });
    }

    onActiveProfileUpdate(activeProfile: any) {
        this.activeProfile = activeProfile
        this.cdr.detectChanges()
    }

    getMenuName(menuId:string){
        switch (menuId){
            case 'servicesMenu': return 'Сервисы'
            case 'servicesMenu2': return 'servicesMenu2'
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
                // console.log(treeNode.data.value);
                this.uiService.ipcInvoke('load-url', treeNode.data.value, (treeNode.children.length > 0)).then()
            },
            // icon: (treeNode.data.icon) ? treeNode.data.icon : 'bx bx-circle-off',
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
