import {NgModule} from '@angular/core';
import {CardModule} from 'primeng/card';
import {TabsModule} from 'primeng/tabs';
import {ButtonModule} from 'primeng/button';
import {TreeTableModule} from 'primeng/treetable';
import {TreeModule} from 'primeng/tree';
import {TableModule} from 'primeng/table';
import {ToggleButtonModule} from 'primeng/togglebutton';
import {SplitButtonModule} from 'primeng/splitbutton';
import {SplitterModule} from 'primeng/splitter';
import {ToastModule} from 'primeng/toast';
import {SelectModule} from 'primeng/select';
import {TooltipModule} from 'primeng/tooltip';
import {PanelModule} from 'primeng/panel';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import {StepsModule} from 'primeng/steps';
import {DialogService, DynamicDialogModule} from 'primeng/dynamicdialog';
import {DataViewModule} from 'primeng/dataview';
import {InputTextModule} from 'primeng/inputtext';
import {TextareaModule} from 'primeng/textarea';
import {ConfirmDialogModule} from 'primeng/confirmdialog';
import {DialogModule} from 'primeng/dialog';
import {MultiSelectModule} from 'primeng/multiselect';
import {ContextMenuModule} from 'primeng/contextmenu';
import {AvatarModule} from 'primeng/avatar';
import {PanelMenuModule} from 'primeng/panelmenu';
import {MenuModule} from 'primeng/menu';
import {RippleModule} from 'primeng/ripple';
import {SelectButtonModule} from "primeng/selectbutton";
import {BadgeModule} from 'primeng/badge';
import { CheckboxModule } from 'primeng/checkbox';
import {ProgressBarModule} from 'primeng/progressbar';
import {DragDropModule} from 'primeng/dragdrop';
@NgModule({
    imports: [
        TabsModule,
        ButtonModule,
        TreeTableModule,
        TreeModule,
        TableModule,
        ToggleButtonModule,
        SplitButtonModule,
        SplitterModule,
        ToastModule,
        SelectModule,
        TooltipModule,
        PanelModule,
        ProgressSpinnerModule,
        StepsModule,
        DynamicDialogModule,
        DataViewModule,
        InputTextModule,
        TextareaModule,
        ConfirmDialogModule,
        CardModule,
        DialogModule,
        MultiSelectModule,
        ContextMenuModule,
        PanelMenuModule,
        AvatarModule,
        MenuModule,
        RippleModule,
        BadgeModule,
        SelectButtonModule,
        CheckboxModule,
        ProgressBarModule,
        DragDropModule
    ],
    exports: [
        TabsModule,
        ButtonModule,
        TreeTableModule,
        TreeModule,
        TableModule,
        ToggleButtonModule,
        SplitButtonModule,
        SplitterModule,
        ToastModule,
        SelectModule,
        TooltipModule,
        PanelModule,
        ProgressSpinnerModule,
        StepsModule,
        DynamicDialogModule,
        DataViewModule,
        InputTextModule,
        TextareaModule,
        ConfirmDialogModule,
        CardModule,
        DialogModule,
        MultiSelectModule,
        ContextMenuModule,
        PanelMenuModule,
        AvatarModule,
        MenuModule,
        RippleModule,
        BadgeModule,
        SelectButtonModule,
        CheckboxModule,
        ProgressBarModule,
        DragDropModule
    ],
    providers: [DialogService]
})

export class PrimeNgModule {
}
