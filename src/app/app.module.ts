import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
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


@NgModule({
    imports: [
        PrimeNgModule,
        BrowserModule,
        BrowserAnimationsModule,
        HttpClientModule,
        FormsModule,
        AppRouters,
        NgOptimizedImage,
        ReactiveFormsModule,
        ToolbarModule,
        FileUploadModule
    ],
    declarations: [AppComponent, SettingsComponent, SideMenuComponent, SideBarComponent, TitleBarComponent],
    bootstrap: [AppComponent],
    providers: [UiService]
})

export class AppModule {
}
