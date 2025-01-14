import {Component, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {Button, ButtonDirective} from "primeng/button";
import {FormsModule} from "@angular/forms";
import {InputTextModule} from "primeng/inputtext";
import {NgIf, NgStyle, NgTemplateOutlet} from "@angular/common";
import {PrimeTemplate} from "primeng/api";
import {TableModule} from "primeng/table";
import {TooltipModule} from "primeng/tooltip";
import {DynamicDialogConfig, DynamicDialogRef} from "primeng/dynamicdialog";
import {DropdownModule} from "primeng/dropdown";
import {UiService} from "../ui.service";

@Component({
    selector: 'app-page-action-edit-dialog',
    standalone: true,
    imports: [
        ButtonDirective,
        FormsModule,
        InputTextModule,
        NgIf,
        PrimeTemplate,
        TableModule,
        TooltipModule,
        NgStyle,
        DropdownModule,
        NgTemplateOutlet,
        Button
    ],
    templateUrl: './page-action-edit-dialog.component.html',
    styleUrl: './page-action-edit-dialog.component.scss'
})
export class PageActionEditDialogComponent implements OnInit {

    editingPageAction: any
    showTable = true

    pageActions: {
        action: string;
        selector: string;
        value: string | null;
    }[]

    pageActionOptions: string[]

    @ViewChild('customHeaderTemplate') customHeaderTemplate!: TemplateRef<any>;

    constructor(
        public config: DynamicDialogConfig,
        public ref: DynamicDialogRef,
        private uiService: UiService
    ) {
    }

    ngOnInit(): void {
        // Make a deep copy of the data to avoid reference issues
        this.pageActions = JSON.parse(JSON.stringify(this.config.data));

        this.pageActionOptions = [
            'waitElement',
            'typeToInput',
            'clickElement',
            'selectElement'
        ]
    }

    startPageActionEdit(pageAction: any) {
        // Make a copy of the page action for editing
        this.editingPageAction = { ...pageAction };
    }

    async savePageActionKeyEdit() {
        await this.uiService.ipcInvoke('pageAction:update', this.editingPageAction);
        // Update the local pageActions array with the edited value
        const index = this.pageActions.findIndex(pa => pa.selector === this.editingPageAction.selector);
        if (index !== -1) {
            this.pageActions[index] = { ...this.editingPageAction };
        }
        // Return the updated data to parent
        this.ref.close(this.pageActions);
        this.editingPageAction = null;
    }

    cancelPageActionKeyEdit() {
        //this.loadPageActions()
        this.editingPageAction = null;
    }

    closeDialog() {
        if (this.editingPageAction != null) {
            if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
                return;
            }
        }
        // Return the updated data even when closing
        this.ref.close(this.pageActions);
    }
}
