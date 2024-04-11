import {NgModule} from '@angular/core';
import {CardModule} from 'primeng-lts/card';
import {TabViewModule} from 'primeng-lts/tabview';
import {ButtonModule} from 'primeng-lts/button';
import {TreeTableModule} from 'primeng-lts/treetable';
import {TableModule} from 'primeng-lts/table';
import {ToggleButtonModule} from 'primeng-lts/togglebutton';
import {SplitButtonModule} from 'primeng-lts/splitbutton';
import {ToastModule} from 'primeng-lts/toast';
import {DropdownModule} from 'primeng-lts/dropdown';
import {TooltipModule} from 'primeng-lts/tooltip';
import {PanelModule} from 'primeng-lts/panel';
import {ProgressSpinnerModule} from 'primeng-lts/progressspinner';
import {StepsModule} from 'primeng-lts/steps';
import {DialogService, DynamicDialogModule} from 'primeng-lts/dynamicdialog';
import {DataViewModule} from 'primeng-lts/dataview';
import {InputTextModule} from 'primeng-lts/inputtext';
import {InputTextareaModule} from 'primeng-lts/inputtextarea';
import {ConfirmDialogModule} from 'primeng-lts/confirmdialog';
import {DialogModule} from 'primeng-lts/dialog';
import {MultiSelectModule} from 'primeng-lts/multiselect';
import {ContextMenuModule} from 'primeng-lts/contextmenu';

@NgModule({
  exports: [
    TabViewModule,
    ButtonModule,
    TreeTableModule,
    TableModule,
    ToggleButtonModule,
    SplitButtonModule,
    ToastModule,
    DropdownModule,
    TooltipModule,
    PanelModule,
    ProgressSpinnerModule,
    StepsModule,
    DynamicDialogModule,
    DataViewModule,
    InputTextModule,
    InputTextareaModule,
    ConfirmDialogModule,
    CardModule,
    DialogModule,
    MultiSelectModule,
    ContextMenuModule,
  ],
  providers: [DialogService]
})

export class PrimeNgModule {
}
