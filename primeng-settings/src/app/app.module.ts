import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {RouterModule} from '@angular/router';
import {NgxElectronModule} from 'ngx-electron';
import {FileService} from './fileService';
import {PrimeNgModule} from './primeng.module';
import {AppComponent} from './app.component';
import {AppRouters} from './app.routes';


@NgModule({
    imports: [
        NgxElectronModule,
        PrimeNgModule,
        BrowserModule,
        BrowserAnimationsModule,
        HttpClientModule,
        FormsModule,
        AppRouters
    ],
    declarations: [AppComponent],
    bootstrap: [AppComponent],
    providers: [FileService]
})

export class AppModule {
}
