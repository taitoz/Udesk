import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {RouterModule} from '@angular/router';

import {AppComponent} from './app.component';
import {NodeService} from './nodeservice';
import {PrimeNgModule} from './primeng.module';
import {AdminComponent} from './app-admin.component';
import {AppRouters} from './app.routes';



@NgModule({
    imports: [
        PrimeNgModule,
        BrowserModule,
        BrowserAnimationsModule,
        HttpClientModule,
        FormsModule,
        AppRouters
    ],
    declarations: [AppComponent, AdminComponent],
    bootstrap: [AppComponent],
    providers: [NodeService]
})

export class AppModule {
}
