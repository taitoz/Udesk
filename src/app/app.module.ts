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
import {ConfirmationService, MessageService} from 'primeng/api';
import {providePrimeNG} from 'primeng/config';
import Aura from '@primeuix/themes/aura';


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
        TagModule], 
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
        MessageService
    ]
})

export class AppModule {
}
