import {Component, OnInit} from '@angular/core';
import {DynamicDialogRef} from 'primeng/dynamicdialog';
import allIcons from '../assets/boxicons.json';

interface BoxIcon {
    name: string;
    class: string;
    type: string;
}

@Component({
    selector: 'icon-picker',
    standalone: false,
    template: `
        <div class="icon-picker">
            <div class="icon-picker-search">
                <span class="p-input-icon-left w-full">
                    <input pInputText type="text" [placeholder]="'iconPicker.searchIcons' | translate"
                           [(ngModel)]="searchText" (input)="filterIcons()"
                           class="w-full" autofocus/>
                </span>
                <div class="icon-picker-tabs">
                    <button type="button" class="tab-btn" [class.active]="activeTab === 'all'" (click)="setTab('all')">All ({{allIcons.length}})</button>
                    <button type="button" class="tab-btn" [class.active]="activeTab === 'regular'" (click)="setTab('regular')">Regular</button>
                    <button type="button" class="tab-btn" [class.active]="activeTab === 'solid'" (click)="setTab('solid')">Solid</button>
                    <button type="button" class="tab-btn" [class.active]="activeTab === 'logos'" (click)="setTab('logos')">Logos</button>
                </div>
            </div>
            <div class="icon-picker-count">{{filteredIcons.length}} icons</div>
            <div class="icon-picker-grid">
                @for (icon of filteredIcons; track icon.class) {
                    <button type="button" class="icon-cell"
                            [class.selected]="selectedIcon === icon.class"
                            [title]="icon.name + ' (' + icon.type + ')'"
                            (click)="selectIcon(icon)">
                        <i [class]="icon.class + ' bx-sm'"></i>
                    </button>
                }
            </div>
        </div>
    `,
    styles: [`
        .icon-picker {
            display: flex;
            flex-direction: column;
            height: 60vh;
        }
        .icon-picker-search {
            flex-shrink: 0;
            margin-bottom: 0.5rem;
        }
        .icon-picker-tabs {
            display: flex;
            gap: 4px;
            margin-top: 0.5rem;
        }
        .tab-btn {
            padding: 4px 12px;
            border: 1px solid var(--p-content-border-color);
            background: transparent;
            color: var(--p-text-color);
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
        }
        .tab-btn.active {
            background: var(--p-primary-color);
            color: #fff;
            border-color: var(--p-primary-color);
        }
        .icon-picker-count {
            flex-shrink: 0;
            font-size: 0.8rem;
            color: var(--p-text-muted-color);
            margin-bottom: 0.25rem;
        }
        .icon-picker-grid {
            flex: 1;
            overflow-y: auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
            gap: 4px;
            align-content: start;
        }
        .icon-cell {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 42px;
            height: 42px;
            border: 1px solid transparent;
            border-radius: 6px;
            background: transparent;
            color: var(--p-text-color);
            cursor: pointer;
            transition: background-color 0.15s, border-color 0.15s;
        }
        .icon-cell:hover {
            background: var(--p-content-hover-background);
            border-color: var(--p-content-border-color);
        }
        .icon-cell.selected {
            background: var(--p-primary-color);
            color: #fff;
            border-color: var(--p-primary-color);
        }
    `]
})
export class IconPickerComponent implements OnInit {
    allIcons: BoxIcon[] = allIcons;
    filteredIcons: BoxIcon[] = [];
    searchText = '';
    activeTab = 'all';
    selectedIcon = '';

    constructor(private dialogRef: DynamicDialogRef) {}

    ngOnInit() {
        this.filterIcons();
    }

    setTab(tab: string) {
        this.activeTab = tab;
        this.filterIcons();
    }

    filterIcons() {
        let icons = this.allIcons;
        if (this.activeTab !== 'all') {
            icons = icons.filter(i => i.type === this.activeTab);
        }
        if (this.searchText.trim()) {
            const q = this.searchText.trim().toLowerCase();
            icons = icons.filter(i => i.name.includes(q));
        }
        this.filteredIcons = icons;
    }

    selectIcon(icon: BoxIcon) {
        this.selectedIcon = icon.class;
        this.dialogRef.close(icon.class);
    }
}
