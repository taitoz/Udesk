import {NgModule} from '@angular/core';
import {CardModule} from 'primeng/card';
import {TabViewModule} from 'primeng/tabview';
import {ButtonModule} from 'primeng/button';
import {TreeTableModule} from 'primeng/treetable';
import {TableModule} from 'primeng/table';
import {ToggleButtonModule} from 'primeng/togglebutton';
import {SplitButtonModule} from 'primeng/splitbutton';
import {ToastModule} from 'primeng/toast';
import {DropdownModule} from 'primeng/dropdown';
import {TooltipModule} from 'primeng/tooltip';
import {PanelModule} from 'primeng/panel';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import {StepsModule} from 'primeng/steps';
import {DialogService, DynamicDialogModule} from 'primeng/dynamicdialog';
import {DataViewModule} from 'primeng/dataview';
import {InputTextModule} from 'primeng/inputtext';
import {InputTextareaModule} from 'primeng/inputtextarea';
import {ConfirmDialogModule} from 'primeng/confirmdialog';
import {DialogModule} from 'primeng/dialog';
import {MultiSelectModule} from 'primeng/multiselect';
import {ContextMenuModule} from 'primeng/contextmenu';
import {PanelMenuModule} from 'primeng/panelmenu';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { RippleModule } from 'primeng/ripple';

@NgModule({
  exports: [
    // TabViewModule,
    ButtonModule,
    BadgeModule,
    RippleModule,
    // TreeTableModule,
    // TableModule,
    // ToggleButtonModule,
    // SplitButtonModule,
    // ToastModule,
    // DropdownModule,
    // TooltipModule,
    // PanelModule,
    // ProgressSpinnerModule,
    // StepsModule,
    // DynamicDialogModule,
    // DataViewModule,
    // InputTextModule,
    // InputTextareaModule,
    // ConfirmDialogModule,
    // CardModule,
    // DialogModule,
    // MultiSelectModule,
    // ContextMenuModule,
    PanelMenuModule,
    AvatarModule
  ],
  providers: [DialogService]
})

export class PrimeNgModule {
}
