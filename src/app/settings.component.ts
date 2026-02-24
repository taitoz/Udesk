import {ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {ConfirmationService, MessageService, TreeNode} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {UiService} from './ui.service';
import {DOCUMENT} from '@angular/common';
import {SelectButtonChangeEvent} from "primeng/selectbutton";
import path from "node:path";
import {PageActionEditDialogComponent} from "./page-action-edit-dialog/page-action-edit-dialog.component";

@Component({
    selector: 'settings',
    standalone: false,
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.scss',
    encapsulation: ViewEncapsulation.Emulated,
    providers: [MessageService, ConfirmationService]
})

export class SettingsComponent implements OnInit, OnDestroy {

    activeTabIndex = '0'
    sideMenuTreeNodes: TreeNode[] | undefined
    cols: any[] | undefined
    selectedNode: TreeNode
    //selectedNodes: TreeNode[] | undefined
    editingTreeNode: any
    editingProfile: any

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
    showTable = true

    pageActions: {
        _id: string;
        domain: string;
        actions: any[]
    }[]

    constructor(
        private uiService: UiService,
        private messageService: MessageService,
        public dialogService: DialogService,
        private confirmationService: ConfirmationService,
        @Inject(DOCUMENT) private document: Document,
        private cdr: ChangeDetectorRef
    ) {
    }

    async ngOnInit() {
        // Get current theme for the toggle button state
        const currentTheme = this.uiService.ipcSendSync('settings:getTheme')
        this.theme = currentTheme || 'dark'

        await this.loadProfiles()
        await this.loadPageActions()

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

    async loadPageActions() {
        this.pageActions = await this.uiService.ipcInvoke('pageActions:get')
        this.refreshTable()
    }

    async loadProfiles() {
        this.profiles = await this.uiService.ipcInvoke('profiles:get')
        this.profiles.forEach(profile => {
            if (profile.active) {
                this.activeProfile = profile
                this.sideMenuTreeNodes = profile.sideMenuTreeNodes
            }
        })
        this.refreshTable()
    }

    startProfileKeyEdit(profile: any) {
        profile.sideMenuTreeNodes.forEach((node: TreeNode<any>) => this.removeTreeParent(node));
        //delete profile['_id']
        this.editingProfile = profile;
    }

    saveProfileKeyEdit() {
        this.uiService.ipcInvoke('profile:update', this.editingProfile).then(() => {
            this.loadProfiles()
        })
        this.editingProfile = null;
    }

    async setProfileLogo() {
        this.editingProfile.logo = await this.uiService.ipcInvoke('profile:logo:set');
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

    exportProfile(profileId: string) {
        this.uiService.ipcInvoke('profile:export', profileId).then(result => {
            this.messageService.add(result)
        })
    }

    importProfile() {
        this.uiService.ipcInvoke('profile:import').then(result => {
            this.loadProfiles()
            this.messageService.add(result)
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
        if (this.profiles.length === 1) {
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
                    this.setActiveProfile(this.profiles[0]._id)
                })
                //this.messageService.add({severity: 'success', summary: 'Deleted'});
            },
            reject: () => {
            }
        });
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
            // this.messageService.add({severity: 'info', summary: 'Node Selected', detail: this.selectedNode.data.key});
        }
    }

    servicesMenuDataSave() {
        this.sideMenuTreeNodes.forEach(node => this.removeTreeParent(node));
        //this.uiService.saveToSessionStorage(this.treeNodesData);
        this.activeProfile.sideMenuTreeNodes = this.sideMenuTreeNodes;
        this.uiService.ipcInvoke('profile:update', this.activeProfile).then(() => {
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
        this.uiService.toggleTheme(this.document, this.theme)
        this.uiService.ipcSend('settings:toggleTheme', this.theme)
    }

    getLogoPath(profile: any) {
        return this.uiService.getLogoPath(profile)
    }

    showPageActionsDialog(rowDataUrl: string) {
        const domain = new URL(rowDataUrl).hostname;
        let pageActions = this.pageActions.find(pa => pa.domain === domain);

        if (!pageActions) {
            pageActions = {
                _id: `pa_${Date.now()}`,
                domain: domain,
                actions: []
            }
        }

        this.ref = this.dialogService.open(PageActionEditDialogComponent, {
            header: 'Edit page action',
            height: '100%',
            width: '100%',
            closeOnEscape: false,
            showHeader: false,
            baseZIndex: 10000,
            data: {
                domain: domain,
                actions: pageActions.actions
            }
        });

        this.ref.onClose.subscribe((result) => {
            if (result) {
                // Update the local pageActions with the returned data
                const index = this.pageActions.findIndex(pa => pa.domain === result.domain);
                if (index !== -1) {
                    this.pageActions[index].actions = result.actions;
                } else {
                    this.pageActions.push({
                        _id: `pa_${Date.now()}`,
                        domain: result.domain,
                        actions: result.actions
                    });
                }
                // Save the updated page actions
                this.loadPageActions();
            }
        });
    }

    onAppNameChange(newName: string) {

    }

}
