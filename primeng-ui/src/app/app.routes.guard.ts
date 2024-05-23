import {Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {Observable} from 'rxjs';

// import {SessionStorageService} from 'angular-web-storage';

@Injectable({providedIn: 'root'})
export class AppRoutesGuard implements CanActivate {

  constructor(
      private router: Router,
      // private sessionStorage: SessionStorageService
  ) {
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree> {
        throw new Error('Method not implemented.');
    }

  //canActivate() {
    /*const isAuthenticated = this.sessionStorage.get('isAuthenticated');
    if (isAuthenticated) {
      return true; // Allow access if the user is authenticated
    } else {
      this.router.navigate(['/']); // Redirect to index if not authenticated
      return false; // Prevent access to the route
    }*/
  //}

  // canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {

  // const isAdmin = route.data.isAdmin;
  //
  // let currentAppUser: User = this.sessionStorage.get('user') as User
  // if (currentAppUser != null && (currentAppUser.group == 0) == isAdmin) {
  //   return true;
  // } else {
  //   // not logged in so redirect to login page
  //   this.router.navigate(['']);
  //   return false;
  // }
  // return true;
  // }

}
