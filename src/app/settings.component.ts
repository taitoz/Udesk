import {ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {ConfirmationService, MessageService, SelectItem, TreeNode} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {UiService} from './ui.service';
import {DOCUMENT} from '@angular/common';
import {SelectButtonChangeEvent} from "primeng/selectbutton";
import {ActivatedRouteSnapshot, CanDeactivateFn, RouterStateSnapshot, UrlTree} from "@angular/router";
import {Observable} from "rxjs";


export const canDeactivateGuard: CanDeactivateFn<any> = (
    component: any,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState?: RouterStateSnapshot
): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree => {
    // Check if there are unsaved changes
    if (component.hasUnsavedChanges()) {
        return confirm('You have unsaved changes. Are you sure you want to leave?');
    }
    return true;
};

@Component({
    selector: 'settings',
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.scss',
    encapsulation: ViewEncapsulation.Emulated,
    providers: [MessageService, ConfirmationService]
})

export class SettingsComponent implements OnInit, OnDestroy {

    activeTabIndex = 0
    sideMenuTreeNodes: TreeNode[] | undefined
    cols: any[] | undefined
    selectedNode: TreeNode
    //selectedNodes: TreeNode[] | undefined
    editingTreeNode: any
    editingProfile: any

    pageActions: any[] | undefined

    ref: DynamicDialogRef | undefined
    theme = 'dark'
    themeOptions: any[] = [{label: 'Темная', value: 'dark'}, {label: 'Светлая', value: 'light'}]

    profiles: {
        _id: string;
        active: boolean;
        name: string;
        logo: string,
        homeUrl: string,
        lang: string,
        sideMenuTreeNodes: TreeNode[]
    }[]
    activeProfile: any
    logoCachePath: string
    showTable = true

    constructor(
        private uiService: UiService,
        private messageService: MessageService,
        public dialogService: DialogService,
        private confirmationService: ConfirmationService,
        @Inject(DOCUMENT) private document: Document,
        private cdr: ChangeDetectorRef
    ) {
    }

    ngOnInit() {

        this.logoCachePath = this.uiService.getLogoCachePath()
        this.loadProfiles()

        this.cols = [
            {header: 'Name', field: 'key'},
            {header: 'Link', field: 'value'}
        ];
    }

    ngOnDestroy(): void {
        if (this.ref) {
            this.ref.close()
        }
    }

    hasUnsavedChanges(): boolean {
        return (this.editingTreeNode)
    }

    startProfileKeyEdit(profile: any) {
        this.editingProfile = profile;

    }

    saveProfileKeyEdit(profileId: string, key:string, value: string) {
        this.uiService.ipcInvoke('profile:update', profileId, key, value).then(() => {
            this.loadProfiles()
        })
        this.editingProfile = null;
    }

    cancelProfileKeyEdit() {
        this.loadProfiles()
        this.editingProfile = null;
    }

    startTreeNodeEdit(row: any) {
        this.editingTreeNode = row;
    }

    saveTreeNodeEdit() {
        this.servicesMenuDataSave()
        this.editingTreeNode = null;
    }

    cancelTreeNodeEdit() {
        this.loadProfiles()
        this.editingTreeNode = null;
    }

    exportServicesTableData(profileId: string) {
        this.uiService.ipcInvoke('profile:export', profileId).then(result => {
            this.messageService.add(result)
        })
    }

    importServicesTableData(profileId: string) {
        this.uiService.ipcInvoke('profile:import', profileId).then(result => {
            this.loadProfiles()
            this.messageService.add(result)
        })
    }

    async setProfileLogo(profile: any) {
        await this.uiService.ipcInvoke('logoCache:set', profile.name).then(() => {
            this.refreshTable()
        })
    }

    refreshTable() {
        //angular change outside context fix
        this.showTable = false
        this.cdr.detectChanges()
        this.showTable = true
        this.cdr.detectChanges()
    }

    async addProfile() {
        await this.uiService.ipcInvoke('profiles:add').then(() => {
            this.loadProfiles()
        })
    }

    deleteProfile(profileId: string) {
        if (this.uiService.ipcSendSync('profiles:get').length === 1) {
            this.messageService.add({severity: 'info', summary: 'last profile cannot be deleted.'})
            return
        }
        this.confirmationService.confirm({
            header: 'Подтверждение',
            message: 'Удалить?',
            acceptLabel: 'Да',
            rejectLabel: 'Нет',
            icon: 'bx bx-exclamation-triangle',
            accept: async () => {
                // let index = this.profilesFlat.findIndex(item => item.name === profileName)
                // console.log(index)
                await this.uiService.ipcInvoke('profiles:delete', profileId).then(() => {
                    this.loadProfiles()
                    this.setActiveProfile(this.profiles[0].name)
                })
                //this.messageService.add({severity: 'success', summary: 'Deleted'});
            },
            reject: () => {
            }
        });
    }

    loadProfiles() {
        this.profiles = this.uiService.ipcSendSync('profiles:get')
        this.profiles.forEach(profile => {
            if (profile.active) {
                this.activeProfile = profile
                this.sideMenuTreeNodes = profile.sideMenuTreeNodes
            }
        })
        this.refreshTable()
    }

    setActiveProfile(profileId: string) {
        this.uiService.ipcInvoke('profiles:setActive', profileId).then(() => {
            this.loadProfiles()
            //this.refreshTable()
            //this.messageService.add({severity: 'success', summary: 'Profile selected', detail: profileId.toString()})
        })
    }


    onSelect(event: any) {
        if (event.node != null) {
            this.selectedNode = event.node
            this.pageActions = event.node.data.pageActions;
            // this.messageService.add({severity: 'info', summary: 'Node Selected', detail: this.selectedNode.data.key});
        }
    }

    servicesMenuDataSave() {
        this.sideMenuTreeNodes.forEach(node => this.removeTreeParent(node));
        //this.uiService.saveToSessionStorage(this.treeNodesData);
        this.uiService.ipcInvoke('profile:update', this.activeProfile._Id, 'sideMenuTreeNodes', this.sideMenuTreeNodes).then(() => {
            this.loadProfiles()
            //this.sideMenuTreeNodes = [...this.sideMenuTreeNodes];
            //this.messageService.add({severity: 'success', summary: 'Сохранено'});
        })
    }

    removeTreeParent(obj: TreeNode) {
        obj.parent = null;
        obj.children.forEach((item: TreeNode) => {
            // item.parent = null;
            try {
                this.removeTreeParent(item);
            } catch {
            }
        });
    }

    deleteNodeByData(data: any, nodes: TreeNode[]) {
        let i: number;
        for (i = 0; i < nodes.length; i++) {
            if (nodes[i].data === data) {
                nodes.splice(i, 1);
                return;
            }
            if (nodes[i].children) {
                this.deleteNodeByData(data, nodes[i].children);
            }
        }
    }

    deleteItem(selectedNode: TreeNode) {
        // console.log(this.servicesMenuData)
        if (this.sideMenuTreeNodes.length === 1 && selectedNode.parent === null) {
            this.messageService.add({severity: 'error', summary: 'Unable to delete last element'});
            return;
        }
        this.confirmationService.confirm({
            header: 'Подтверждение',
            message: 'Удалить?',
            acceptLabel: 'Да',
            rejectLabel: 'Нет',
            icon: 'bx bx-exclamation-triangle',
            accept: () => {
                // console.log(selectedNode)
                this.deleteNodeByData(selectedNode.data, this.sideMenuTreeNodes);
                this.sideMenuTreeNodes = [...this.sideMenuTreeNodes];
                this.servicesMenuDataSave()
                this.selectedNode = null
                //this.messageService.add({severity: 'success', summary: 'Deleted'});
            },
            reject: () => {
            }
        });

    }

    getNodeByData(data: any, nodes: TreeNode[]) {
        for (let node of nodes) {
            if (node.data === data) {
                return node;
            }
            if (node.children) {
                let matchedNode = this.getNodeByData(data, node.children);
                if (matchedNode) {
                    return matchedNode;
                }
            }
        }
    }

    newNode(id: any): TreeNode<any> {
        return {
            data: {id: id, key: 'key', value: 'value', pageActions: []},
            children: []
        };
    }

    addItem(selectedNodeData: any, asChild: boolean) {
        let node = this.getNodeByData(selectedNodeData, this.sideMenuTreeNodes);
        const newId = Date.now();
        if (asChild) {
            node.children.push(this.newNode(newId));
            node.expanded = true;
        } else {
            if (node.parent) {
                node.parent.children.push(this.newNode(newId));
            } else {
                this.sideMenuTreeNodes.push(this.newNode(newId));
            }
        }
        //this.selectedNode = newHeaderNode;
        this.sideMenuTreeNodes = [...this.sideMenuTreeNodes];
        this.servicesMenuDataSave()
        // this.messageService.add({severity: 'success', summary: this.selectedNode.data[key]});
    }

    toggleTheme(event: SelectButtonChangeEvent) {
        //this.theme = event.value
        this.uiService.toggleTheme(this.document, this.theme)
        this.uiService.ipcSend('settings:toggleTheme', this.theme)
        //this.electronService.ipcRenderer.send('settings:toggleTheme', theme);
    }

    showDialog() {
        /*    this.ref = this.dialogService.open(AppIndexComponent, {
              header: 'header',
              height: '90%',
              width: '90%',
              footer: 'footer',
              // contentStyle: {"max-height": "500px", "overflow": "auto"},
              baseZIndex: 10000
            });
            this.ref.onClose.subscribe((product: string) => {
              if (product) {
                this.messageService.add({severity: 'info', summary: 'Product Selected', detail: product});
              }
            });*/
    }

    onAppNameChange(newName: string) {

    }

}
