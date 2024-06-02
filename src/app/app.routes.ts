import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {AppRoutesGuard} from './app.routes.guard';
import {SettingsComponent} from './settings.component';
import {SideMenuComponent} from './sideMenu.component';
import {SideBarComponent} from './sideBar.component';
import {TitleBarComponent} from './titleBar.component';
import {AppComponent} from "./app.component";

const routes: Routes = [

    {
        path: '', component: AppComponent,
        // loadChildren: './app-map.component',
    },
    // { path: 'map/:id/:subId', component: AppMapComponent},
    // { path: 'map', component: AppMapComponent, canActivate: [AppRoutesGuard], data: { isAdmin: false}},
    // { path: 'edit', component: MapEditComponent, canActivate: [AppRoutesGuard]},
    {path: 'settings', component: SettingsComponent},
    {path: 'titleBar', component: TitleBarComponent},
    {path: 'sideBar', component: SideBarComponent},
    {path: 'sideMenu/:menuId', component: SideMenuComponent},

    // otherwise redirect to index
    {path: '**', pathMatch: 'full', redirectTo: ''}

    /*  { path: '', component: LoginComponent, canActivate: [AuthGuard],
        children: [
          {path: 'map', component: AppMapComponent},
          {path: 'admin', component: AdminComponent},
        ]
      },
      { path: '**', component: LoginComponent }, // redirect when undefined route*/
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule],
    declarations: []
})
export class AppRouters {
}
