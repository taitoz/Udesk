import {ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {ConfirmationService, MessageService, SelectItem, TreeNode} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {UiService} from './ui.service';
import {ElectronService} from 'ngx-electronyzer';
import {DOCUMENT} from '@angular/common';
import {SelectButtonChangeEvent} from "primeng/selectbutton";

@Component({
    selector: 'settings',
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.scss',
    encapsulation: ViewEncapsulation.Emulated,
    providers: [MessageService, ConfirmationService]
})

export class SettingsComponent implements OnInit, OnDestroy {

    activeIndex = 0;
    treeNodesData: TreeNode[] | undefined;
    cols: any[] | undefined;
    //selectedNode: TreeNode;
    selectedNodes: TreeNode[] | undefined;

    unSavedEdits = false;
    isNotHeaderNode = true;

    nodeTypes: SelectItem[] | undefined;
    selectedNodeType: string | undefined;

    ref: DynamicDialogRef | undefined;
    theme = 'dark';
    themeOptions: any[] = [{label: 'Темная', value: 'dark'}, {label: 'Светлая', value: 'light'}];

    profiles: { id: number; data: { key: string, value: string }[] }[]
    profilesFlat: { name: string; id: number; key: string; value: string; }[] = []
    showTable = true

    constructor(
        private electronService: ElectronService,
        private uiService: UiService,
        private messageService: MessageService,
        public dialogService: DialogService,
        private confirmationService: ConfirmationService,
        @Inject(DOCUMENT) private document: Document,
        private cdr: ChangeDetectorRef
    ) {
    }

    ngOnInit() {

        this.treeNodesData = this.uiService.loadSideMenuData('services');
        this.loadProfiles();

        // this.nodeTypes = [
        //     {label: 'L1', value: 'L1'},
        //     {label: 'L2', value: 'L2'},
        //     {label: 'L3', value: 'L3'}
        // ];

        this.cols = [
            {field: 'key', header: 'Name', editable: true, width: 300},
            {field: 'value', header: 'Link', editable: true, width: 300},
            //{field: 'type', header: 'Type', editable: false, width: 200},
            {field: 'id', header: 'id', editable: false, width: 300},
            //{width: 100}
        ];
    }

    ngOnDestroy(): void {
        if (this.ref) {
            this.ref.close();
        }
    }

    canDeactivate(): boolean {
        if (this.unSavedEdits) {
            return confirm('You have unsaved changes. Are you sure you want to leave?');
        }
        return true;
    }

    setProfileLogo(profile: any): void {
        return this.uiService.setAppLogoPath(profile.name);
    }

    getProfileLogo(profile: any) {
        return this.uiService.getAppLogoPath(profile.name)
    }

    refreshTable() {
        //angular change outside context fix
        this.showTable = false;
        this.cdr.detectChanges();
        this.showTable = true;
        this.cdr.detectChanges();
    }

    testEvt(event: any){
        console.log(event)
    }

    addProfile() {
        this.uiService.addProfile()
        this.loadProfiles()
    }

    deleteProfile(profileId: number) {
        if (this.profiles.length === 1) {
            this.messageService.add({severity: 'info', summary: 'last profile cannot be deleted.'});
            return
        }
        this.uiService.deleteProfile(profileId)
        this.loadProfiles()
    }

    loadProfiles() {
        this.profiles = this.uiService.loadProfiles()
        this.profilesFlat = []
        this.profiles.forEach(((profile: { id: number; data: { key: string, value: string }[] }) => {
                let profileName = profile.data.find(p => p.key === 'name').value
                profile.data.forEach(data => {
                    this.profilesFlat.push({name: profileName, id: profile.id, key: data.key, value: data.value})
                })
            })
        )
        this.refreshTable()
    }

    setActiveProfile(profileId: number) {
        this.uiService.setActiveProfile(profileId)
        this.treeNodesData = this.uiService.loadSideMenuData('services');
        this.loadProfiles()

        this.messageService.add({severity: 'info', summary: 'Profile selected', detail: profileId.toString()});
    }

    getNodeTypeLabel(value: string): string {
        // const nodeType = this.nodeTypes.find(i => i.value === value);
        // if (nodeType) {
        //     return nodeType.label;
        // }
        return value;
    }

    onSelect(event: { node: { data: { type: string | undefined; }; } | null; }) {
        if (event.node != null) {
            //this.selectedNode = event.node;
            this.selectedNodeType = event.node.data.type;
            this.isNotHeaderNode = (event.node.data.type !== 'header');
            // this.messageService.add({severity: 'info', summary: 'Node Selected', detail: this.selectedNode.data.key});
        }
    }

    onTypeSelect(event) {
        //this.selectedNode.data.type = event.value;
    }


    nodeSave() {
        this.treeNodesData.forEach(node => this.removeTreeParent(node));
        //this.uiService.saveToSessionStorage(this.treeNodesData);
        this.uiService.ipcSend('services:set', this.treeNodesData)
        // if (this.electronService.isElectronApp) {
        //     this.electronService.ipcRenderer.send('sideBarMenu:set', this.treeNodesData);
        // }

        this.treeNodesData = [...this.treeNodesData];
        this.messageService.add({severity: 'success', summary: 'Сохранено'});
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
        let i;
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

    delete(selectedNodeData: any) {
        if (this.treeNodesData.length === 1) {
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
                this.deleteNodeByData(selectedNodeData, this.treeNodesData);
                this.treeNodesData = [...this.treeNodesData];
                this.messageService.add({severity: 'success', summary: 'Deleted'});
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
            data: {id: id, key: 'key', value: 'value', type: 'type'},
            children: []
        };
    }

    addItem(selectedNodeData: any, asChild: boolean) {
        //this.unSavedEdits = true;
        let node = this.getNodeByData(selectedNodeData, this.treeNodesData);
        //console.log(node);
        const newId = Date.now();
        if (asChild) {
            node.children.push(this.newNode(newId));
            node.expanded = true;
        } else {
            if (node.parent) {
                node.parent.children.push(this.newNode(newId));
            } else {
                this.treeNodesData.push(this.newNode(newId));
            }
        }
        //this.selectedNode = newHeaderNode;
        this.treeNodesData = [...this.treeNodesData];
        // this.messageService.add({severity: 'success', summary: this.selectedNode.data[key]});
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

    toggleTheme(event: SelectButtonChangeEvent) {
        //this.theme = event.value
        this.uiService.toggleTheme(this.document, this.theme)
        this.uiService.ipcSend('settings:toggleTheme', this.theme)
        //this.electronService.ipcRenderer.send('settings:toggleTheme', theme);
    }

    protected readonly Object = Object;
}
