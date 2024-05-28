import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {RouterModule} from '@angular/router';
import {FileService} from './fileService';
import {PrimeNgModule} from './primeng.module';
import {SettingsComponent} from './settings.component';
import {AppRouters} from './app.routes';
import {MenuComponent} from './menu.component';
import {AppComponent} from './app.component';
import {SidebarComponent} from './sidebar.component';
import {NgOptimizedImage} from '@angular/common';
import {TitlebarComponent} from './titlebar.component';


@NgModule({
    imports: [
        PrimeNgModule,
        BrowserModule,
        BrowserAnimationsModule,
        HttpClientModule,
        FormsModule,
        AppRouters,
        NgOptimizedImage
    ],
    declarations: [AppComponent, SettingsComponent, MenuComponent, SidebarComponent, TitlebarComponent],
    bootstrap: [AppComponent],
    providers: [FileService]
})

export class AppModule {
}
