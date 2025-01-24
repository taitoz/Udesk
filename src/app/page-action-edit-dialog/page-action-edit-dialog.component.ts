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

    editingPageAction: any = null;
    showTable = true;
    domain: string;
    pageActions: {
        _id: string;
        action: string;
        selector: string;
        value: string | null;
    }[];

    pageActionOptions: string[];

    @ViewChild('customHeaderTemplate') customHeaderTemplate!: TemplateRef<any>;

    constructor(
        public config: DynamicDialogConfig,
        public ref: DynamicDialogRef,
        private uiService: UiService
    ) {
    }

    ngOnInit(): void {
        this.domain = this.config.data.domain;
        // Make a deep copy of the actions array and ensure each action has an _id
        this.pageActions = JSON.parse(JSON.stringify(this.config.data.actions)).map(action => ({
            ...action,
            _id: action._id || `pa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }));

        this.pageActionOptions = [
            'waitElement',
            'typeToInput',
            'clickElement',
            'selectElement'
        ];
    }

    startPageActionEdit(pageAction: any) {
        // Make a deep copy of the page action for editing
        this.editingPageAction = JSON.parse(JSON.stringify(pageAction));
    }

    async savePageActionKeyEdit() {
        if (!this.editingPageAction) return;

        console.log('Saving page action:', this.editingPageAction);

        // Update the local pageActions array with the edited value
        const index = this.pageActions.findIndex(pa => pa._id === this.editingPageAction._id);
        if (index !== -1) {
            this.pageActions[index] = { ...this.editingPageAction };
        }

        // Save the entire updated pageActions array
        const fullPageAction = {
            domain: this.domain,
            actions: this.pageActions.map(({ _id, ...rest }) => rest) // Remove temporary _ids before saving
        };

        try {
            await this.uiService.ipcInvoke('pageAction:update', fullPageAction);
            console.log('Page action saved successfully:', fullPageAction);
            // Return the updated data to parent
            this.ref.close(fullPageAction);
        } catch (error) {
            console.error('Failed to save page action:', error);
        }

        this.editingPageAction = null;
    }

    cancelPageActionKeyEdit() {
        this.editingPageAction = null;
    }

    closeDialog() {
        if (this.editingPageAction != null) {
            if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
                return;
            }
        }
        // Return the updated data even when closing
        this.ref.close({ domain: this.domain, actions: this.pageActions });
    }
}
