import {AfterViewInit, ChangeDetectorRef, Component, Inject, Input, OnChanges, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {MenuItem, TreeNode} from 'primeng/api';
import {UiService} from './ui.service';

@Component({
    selector: 'sideMenu',
    standalone: false,
    templateUrl: './sideMenu.component.html',
    styleUrl: './sideMenu.component.scss'
})

export class SideMenuComponent implements OnInit, OnChanges, AfterViewInit {

    @Input() menuId: string = 'servicesMenu';

    activeProfile: any
    treeNodesData: TreeNode[];
    menuItems: MenuItem[] = [];
    menuName: string = '';

    @ViewChild('menubar') menuBar: any;

    constructor(
        private uiService: UiService,
        private cdr: ChangeDetectorRef,
        @Inject(DOCUMENT) private document: Document
    ) {
    }

    ngAfterViewInit() {
        // Inject style override after PrimeNG renders
        if (!this.document.getElementById('compact-menu-styles')) {
            const style = this.document.createElement('style');
            style.id = 'compact-menu-styles';
            style.textContent = `
                .p-panelmenu { gap: 0 !important; }
                .p-panelmenu-panel { border: none !important; padding: 0 !important; border-radius: 0 !important; background: transparent !important; }
                .p-panelmenu-header-content { border-radius: 0 !important; background: transparent !important; border-top: 1px solid var(--p-content-border-color) !important; border-bottom: none !important; }
                .p-panelmenu-header-link { padding: 0.6rem 0.5rem !important; }
                .p-panelmenu-item-link { padding: 0.6rem 0.5rem !important; }
                .p-panelmenu-item-content { border-radius: 0 !important; border-top: 1px solid var(--p-content-border-color) !important; border-bottom: none !important; }
                .p-panelmenu-submenu { padding-left: 0.75rem !important; }
                .p-panelmenu-content ul { margin: 0 !important; padding-left: 0.75rem !important; list-style: none !important; }
                .p-panelmenu ul { margin: 0 !important; }
            `;
            this.document.head.appendChild(style);
        }
    }

    ngOnInit() {
        this.activeProfile = this.uiService.ipcSendSync('profiles:getActive')
        this.treeNodesData = this.activeProfile['sideMenuTreeNodes']
        this.menuName = this.getMenuName(this.menuId);
        this.loadMenuItemsFromTreeNodesData();

        this.uiService.activeProfileChange.subscribe(activeProfile => {
            this.onActiveProfileUpdate(activeProfile)
        })
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['menuId'] && !changes['menuId'].firstChange) {
            this.menuName = this.getMenuName(this.menuId);
            this.menuItems = [];
            this.loadMenuItemsFromTreeNodesData();
        }
    }

    onActiveProfileUpdate(activeProfile: any) {
        this.activeProfile = activeProfile
        this.cdr.detectChanges()
    }

    getMenuName(menuId:string){
        switch (menuId){
            case 'servicesMenu': return 'Services'
            case 'servicesMenu2': return 'Services Menu 2'
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
                this.uiService.settingsToggle.emit(false);
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
