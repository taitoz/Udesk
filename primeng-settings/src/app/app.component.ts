import {Component, Inject, NgZone, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {ConfirmationService, MessageService, SelectItem, TreeNode} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {FileService} from './fileService';
import { ElectronService } from 'ngx-electronyzer';
import {DOCUMENT} from '@angular/common';
import {nativeTheme} from 'electron';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    encapsulation: ViewEncapsulation.Emulated,
    providers: [MessageService, ConfirmationService]
})

export class AppComponent implements OnInit, OnDestroy {

    activeIndex = 0;
    treeNodesData: TreeNode[];
    cols: any[];
    //selectedNode: TreeNode;
    selectedNodes: TreeNode[];

    unSavedEdits = false;
    isNotHeaderNode = true;

    nodeTypes: SelectItem[];
    selectedNodeType: string;

    ref: DynamicDialogRef;
    public isLightTheme = true;

    constructor(
        private electronService: ElectronService,
        private ngZone: NgZone,
        private fileService: FileService,
        private messageService: MessageService,
        public dialogService: DialogService,
        private confirmationService: ConfirmationService,
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
            this.treeNodesData = this.electronService.ipcRenderer.sendSync('sideBarMenu:get')
            console.log('menu loaded from electron');
        } else {
            this.fileService.loadTestData().subscribe(result => {
                this.treeNodesData = result;
                console.log('menu loaded from file');
            });
        }

        this.nodeTypes = [
            {label: 'L1', value: 'L1'},
            {label: 'L2', value: 'L2'},
            {label: 'L3', value: 'L3'}
        ];

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

    getNodeTypeLabel(value: string): string {
        const nodeType = this.nodeTypes.find(i => i.value === value);
        if (nodeType) {
            return nodeType.label;
        }
        return value;
    }

    onSelect(event) {
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
        this.fileService.saveTestData(this.treeNodesData);

        if (this.electronService.isElectronApp) {
            this.electronService.ipcRenderer.send('sideBarMenu:set', this.treeNodesData);
        }

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
            icon: 'pi pi-exclamation-triangle',
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

    onThemeSwitchChange() {
        this.isLightTheme = !this.isLightTheme;

        document.body.setAttribute(
            'data-theme',
            this.isLightTheme ? 'light' : 'dark'
        );
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

    toggleTheme() {
        let theme = 'light';
        const head = this.document.getElementsByTagName('head')[0];
        let themeLink = this.document.getElementById(
            'client-theme'
        ) as HTMLLinkElement;
        if (themeLink) {
            if (themeLink.href.includes('Light')) {
                themeLink.href = 'assets/primeThemeDark.css'
                theme = 'dark'
            } else {
                themeLink.href = 'assets/primeThemeLight.css'
                theme = 'light'
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
