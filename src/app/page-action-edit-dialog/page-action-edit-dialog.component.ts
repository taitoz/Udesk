import {Component, OnInit, TemplateRef} from '@angular/core';
import {ButtonDirective} from "primeng/button";
import {FormsModule} from "@angular/forms";
import {InputTextModule} from "primeng/inputtext";
import {NgIf, NgStyle} from "@angular/common";
import {PrimeTemplate} from "primeng/api";
import {TableModule} from "primeng/table";
import {TooltipModule} from "primeng/tooltip";
import {DynamicDialogConfig, DynamicDialogRef} from "primeng/dynamicdialog";
import {DropdownModule} from "primeng/dropdown";

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
        DropdownModule
    ],
    templateUrl: './page-action-edit-dialog.component.html',
    styleUrl: './page-action-edit-dialog.component.scss'
})
export class PageActionEditDialogComponent implements OnInit {

    customHeader: TemplateRef<any> | undefined;
    editingPageAction: any
    showTable = true

    pageActions: {
        action: string;
        selector: string;
        value: string | null;
    }[]

    pageActionOptions: string[]

    constructor(public config: DynamicDialogConfig, public ref: DynamicDialogRef) {
    }

    ngOnInit(): void {
        this.customHeader = this.createCustomHeader();
        this.pageActions = this.config.data;

        this.pageActionOptions = [
            'waitElement',
            'typeToInput',
            'clickElement',
            'selectElement'
        ]
    }

    createCustomHeader(): TemplateRef<any> {
        // Create a template reference variable for the custom header
        // return this.customHeaderTemplate;
    }

    startPageActionEdit(pageAction: any) {
        this.editingPageAction = pageAction;
    }

    savePageActionKeyEdit() {
        // this.uiService.ipcInvoke('profile:update', this.editingProfile).then(() => {
        //     this.loadProfiles()
        // })
        this.editingPageAction = null;
    }

    cancelPageActionKeyEdit() {
        //this.loadPageActions()
        this.editingPageAction = null;
    }

    closeDialog() {
        if (this.editingPageAction != null) {
            if (confirm('You have unsaved changes. Are you sure you want to close?')) {
                this.ref.close(); // Close if user confirms
            }
        } else {
            this.ref.close(); // Close directly if no unsaved changes
        }
    }
}
