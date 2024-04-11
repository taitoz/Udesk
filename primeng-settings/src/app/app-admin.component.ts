import {Component, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {MessageService, SelectItem, TreeNode} from 'primeng-lts/api';
import {DialogService, DynamicDialogRef} from 'primeng-lts/dynamicdialog';

@Component({
  selector: 'app-admin',
  templateUrl: './app-admin.component.html',
  styleUrls: ['./app-admin.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  providers: [MessageService]
})

export class AdminComponent implements OnInit, OnDestroy {

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
              private httpClient: HttpClient,
              private messageService: MessageService,
              public dialogService: DialogService,
  ) {
  }

  ngOnInit() {
    this.loadTestData();

    this.nodeTypes = [
      {label: 'Заголовок', value: 'header'},
      {label: 'Карта', value: 'mapStyle'},
      {label: '3D объект', value: 'treeViewObject'}
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
      this.isNotHeaderNode = (event.node.data.type != 'header');
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
    if (this.selectedNode.data.type == 'mapStyle') {
      this.selectedNode = this.selectedNode.parent;
    }
    if (this.selectedNode.data.type == 'treeViewObject') {
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
    // this.appMapService.upsertMapListNode(obj).subscribe(result => {
      // console.log(result['modifiedCount']);
      // if (result['modifiedCount'] > 0 || result['upsertedCount'] > 0) {
      //   this.messageService.add({severity: 'success', summary: 'Сохранено'});
      //   this.loadMapList();
      // } else {
      //   this.messageService.add({severity: 'info', summary: 'Изменения не обнаружены'});
      // }
      this.treeNodesData = [...this.treeNodesData];
      this.messageService.add({severity: 'success', summary: 'Сохранено'});
    // });
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

  delete() {
    if (this.selectedNode == null) {
      this.messageService.add({severity: 'error', summary: 'Объект удаления не выбран'});
      return;
    }
    switch (this.selectedNode.data.type) {
      case 'header': {
        const id = this.selectedNode.data.id;
        // this.appMapService.deleteMapListNode(id).subscribe(result => {
        //   this.loadMapList();
          // this.messageService.add({severity: 'success', summary: 'Объект удален', detail: result['message']});
        //   this.messageService.add({severity: 'success', summary: 'Объект удален'});
        // });
        break;
      }
      case 'mapStyle': {
        const index = this.selectedNode.parent.children.indexOf(this.selectedNode);
        this.selectedNode.parent.children.splice(index, 1);
        // TODO
        if (this.selectedNode.parent.children.length == 0) {
          this.selectedNode = this.selectedNode.parent;
          this.delete();
        } else {
          this.upsertToDb(this.selectedNode.parent);
        }
        break;
      }
      case 'treeViewObject': {
        break;
      }
      default: {
        break;
      }
    }
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

  loadTestData() {
    this.httpClient.get<any>('assets/test.json')
      .toPromise()
      .then(nodes => {
        this.treeNodesData = nodes;
        // console.log(nodes)
      });
  }

}
