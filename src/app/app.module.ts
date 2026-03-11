import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {RouterModule} from '@angular/router';
import {UiService} from './ui.service';
import {PrimeNgModule} from './primeng.module';
import {SettingsComponent} from './settings.component';
import {AppRouters} from './app.routes';
import {SideMenuComponent} from './sideMenu.component';
import {AppComponent} from './app.component';
import {SideBarComponent} from './sideBar.component';
import {NgOptimizedImage} from '@angular/common';
import {TitleBarComponent} from './titleBar.component';
import {ToolbarModule} from "primeng/toolbar";
import {FileUploadModule} from "primeng/fileupload";
import {InputGroupModule} from "primeng/inputgroup";
import {TagModule} from "primeng/tag";
import {TreeModule} from 'primeng/tree';
import {SplitterModule} from 'primeng/splitter';
import {ConfirmationService, MessageService, TreeDragDropService} from 'primeng/api';
import {DialogService} from 'primeng/dynamicdialog';
import {providePrimeNG} from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import {FloatLabel, FloatLabelModule} from "primeng/floatlabel";
import {InputGroupAddon} from "primeng/inputgroupaddon";
import {InputTextModule} from "primeng/inputtext";


@NgModule({
    declarations: [AppComponent, SettingsComponent, SideMenuComponent, SideBarComponent, TitleBarComponent],
    bootstrap: [AppComponent],
    imports: [PrimeNgModule,
        BrowserModule,
        FormsModule,
        AppRouters,
        NgOptimizedImage,
        ReactiveFormsModule,
        ToolbarModule,
        FileUploadModule,
        InputGroupModule,
        FloatLabelModule,
        InputTextModule,
        TagModule,
        TreeModule,
        SplitterModule, FloatLabel, InputGroupAddon],
    providers: [
        UiService,
        provideHttpClient(withInterceptorsFromDi()),
        provideAnimationsAsync(),
        providePrimeNG({
            theme: {
                preset: Aura,
                options: {
                    darkModeSelector: '.app-dark'
                }
            }
        }),
        ConfirmationService,
        MessageService,
        DialogService,
        TreeDragDropService
    ]
})

export class AppModule {
}
