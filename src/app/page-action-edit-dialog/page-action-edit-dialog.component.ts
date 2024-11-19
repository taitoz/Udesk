import {Component, HostListener, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {Button, ButtonDirective} from "primeng/button";
import {FormsModule} from "@angular/forms";
import {InputTextModule} from "primeng/inputtext";
import {NgIf, NgStyle, NgTemplateOutlet} from "@angular/common";
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
    private shouldClose = false;

    pageActions: {
        action: string;
        selector: string;
        value: string | null;
    }[]

    pageActionOptions: string[]

    @ViewChild('customHeaderTemplate') customHeaderTemplate!: TemplateRef<any>;
    constructor(public config: DynamicDialogConfig, public ref: DynamicDialogRef) {}

    ngOnInit(): void {
        this.pageActions = this.config.data;

        this.pageActionOptions = [
            'waitElement',
            'typeToInput',
            'clickElement',
            'selectElement'
        ]
    }

    @HostListener('document:keydown', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            event.preventDefault();
            //this.closeDialog();
        }
    }

    startPageActionEdit(pageAction: any) {
        this.editingPageAction = pageAction
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
            this.shouldClose = confirm('You have unsaved changes. Are you sure you want to close?');
        } else {
            this.shouldClose = true;  // Если нет несохраненных изменений, сразу закрываем
        }

        // Если флаг разрешает, закрываем диалог
        if (this.shouldClose) {
            this.ref.close();  // Закрываем диалог
        }
    }
}
