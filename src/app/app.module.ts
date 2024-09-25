import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
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


@NgModule({ declarations: [AppComponent, SettingsComponent, SideMenuComponent, SideBarComponent, TitleBarComponent],
    bootstrap: [AppComponent], imports: [PrimeNgModule,
        BrowserModule,
        BrowserAnimationsModule,
        FormsModule,
        AppRouters,
        NgOptimizedImage,
        ReactiveFormsModule,
        ToolbarModule,
        FileUploadModule,
        InputGroupModule,
        TagModule], providers: [UiService, provideHttpClient(withInterceptorsFromDi())] })

export class AppModule {
}
