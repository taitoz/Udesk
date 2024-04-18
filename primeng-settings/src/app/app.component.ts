import {Component, NgZone, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {MessageService, SelectItem, TreeNode} from 'primeng-lts/api';
import {DialogService, DynamicDialogRef} from 'primeng-lts/dynamicdialog';
import {FileService} from './fileService';
import {ElectronService} from 'ngx-electron';

declare var ipcRenderer: any;

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    encapsulation: ViewEncapsulation.Emulated,
    providers: [MessageService]
})

export class AppComponent implements OnInit, OnDestroy {

    activeIndex = 0;
    treeNodesData: TreeNode[];
    cols: any[];
    selectedNode: TreeNode;
    selectedNodes: TreeNode[];

    unSavedEdits = false;
    isNotHeaderNode = true;

    nodeTypes: SelectItem[];
    selectedNodeType: string;

    ref: DynamicDialogRef;

    constructor(
        private electronService: ElectronService,
        private ngZone: NgZone,
        private fileService: FileService,
        private messageService: MessageService,
        public dialogService: DialogService,
    ) {
        if (this.electronService.isElectronApp) {
            this.electronService.ipcRenderer.on('asynchronous-reply', (event, arg) => {
                this.ngZone.run(() => {
                    console.log(`Asynchronous message reply: ${arg}`);
                });
            });
        }
    }

    ngOnInit() {

        this.fileService.loadTestData().subscribe(result => {
            this.treeNodesData = result;
            // console.log(result);
        });
        // this.loadTestData();

        this.nodeTypes = [
            {label: 'L1', value: 'L1'},
            {label: 'L2', value: 'L2'},
            {label: 'L3', value: 'L3'}
        ];

        this.cols = [
            {field: 'key', header: 'Название', editable: true, width: 300},
            {field: 'value', header: 'Значение', editable: true, width: 500},
            {field: 'type', header: 'Тип', editable: false, width: 200},
            {field: 'id', header: 'id', editable: false, width: 200},
            // {width: 100}
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

    onSelect(event) {
        if (event.node != null) {
            this.selectedNode = event.node;
            this.selectedNodeType = event.node.data.type;
            this.isNotHeaderNode = (event.node.data.type !== 'header');
            // this.messageService.add({severity: 'info', summary: 'Node Selected', detail: this.selectedNode.data.key});
        }
    }

    onTypeSelect(event) {
        this.selectedNode.data.type = event.value;
    }

    nodeSave() {
        if (this.selectedNode == null) {
            this.messageService.add({severity: 'error', summary: 'Объект сохранения не выбран'});
        }
        if (this.selectedNode.data.type === 'mapStyle') {
            this.selectedNode = this.selectedNode.parent;
        }
        if (this.selectedNode.data.type === 'treeViewObject') {
            this.selectedNode = this.selectedNode.parent.parent;
        }

        this.upsertToDb(this.selectedNode);
        // this.edit = !this.edit;
        this.unSavedEdits = false;
        // let txt = this.edit ? 'Enabled' : 'Disabled';
        // this.messageService.add({severity: 'success', summary: 'Success', detail: txt});
    }

    upsertToDb(obj: TreeNode) {
        this.removeTreeParent(obj);
        this.fileService.saveTestData(this.treeNodesData);

        if (this.electronService.isElectronApp) {
            this.electronService.ipcRenderer.send('save-data', this.treeNodesData);
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

    delete(selectedNode: TreeNode) {
        console.log(selectedNode);
        var i;
        for (i = 0; i < this.treeNodesData.length; i++) {
            if (this.treeNodesData[i].data === selectedNode) {
                this.treeNodesData.splice(i,1);
            }

        }

        // if (this.selectedNode == null) {
        //     this.messageService.add({severity: 'error', summary: 'Объект удаления не выбран'});
        //     return;
        // }
        // switch (this.selectedNode.data.type) {
        //     case 'mapStyle': {
        //         const index = this.selectedNode.parent.children.indexOf(this.selectedNode);
        //         this.selectedNode.parent.children.splice(index, 1);
        //         // TODO
        //         if (this.selectedNode.parent.children.length === 0) {
        //             this.selectedNode = this.selectedNode.parent;
        //             //this.delete();
        //         } else {
        //             this.upsertToDb(this.selectedNode.parent);
        //         }
        //         break;
        //     }
        // }
        this.treeNodesData = [...this.treeNodesData];
    }

    addHeaderItem() {
        this.unSavedEdits = true;
        const newMapStyleNode = {
            data: {id: 0, key: 'Название', value: 'mapStyleID', type: 'mapStyle'},
            children: []
        };
        const newId = this.treeNodesData[this.treeNodesData.length - 1].data.id + 1;
        const newHeaderNode = {
            data: {id: newId, key: 'Название', value: 'Описание', type: 'header'},
            children: []
        };

        newHeaderNode.children.push(newMapStyleNode);
        this.treeNodesData.push(newHeaderNode);
        this.selectedNode = newHeaderNode;

        this.treeNodesData = [...this.treeNodesData];
        // this.messageService.add({severity: 'success', summary: this.selectedNode.data[key]});
    }

    addMapStyleItem() {
        const newMapStyleNode = {
            data: {id: 0, key: 'Название', value: 'mapStyleID', type: 'mapStyle'},
            children: []
        };
        // this.selectedNode.parent.children.push(newMapStyleNode);
        this.selectedNode.children.push(newMapStyleNode);
        // this.selectedNode = newHeaderNode;
        this.treeNodesData = [...this.treeNodesData];
        // this.messageService.add({severity: 'success', summary: this.selectedNode.data[key]});
    }

    addTreeViewObject() {

    }

}
