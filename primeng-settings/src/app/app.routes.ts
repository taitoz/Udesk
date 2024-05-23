import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {AppRoutesGuard} from './app.routes.guard';
import {SettingsComponent} from './settings.component';
import {MenuComponent} from './menu.component';

const routes: Routes = [

  {
    path: '', component: SettingsComponent,
    // loadChildren: './app-map.component',
  },
  // { path: 'map/:id/:subId', component: AppMapComponent},
  // { path: 'map', component: AppMapComponent, canActivate: [AppRoutesGuard], data: { isAdmin: false}},
  // { path: 'edit', component: MapEditComponent, canActivate: [AppRoutesGuard]},
   { path: 'menu', component: MenuComponent},

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
