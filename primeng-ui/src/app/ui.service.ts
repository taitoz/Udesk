import {HttpClient} from '@angular/common/http';
import {EventEmitter, Injectable, Output} from '@angular/core';
import {Observable} from 'rxjs';
import {TreeNode} from 'primeng/api';
import {SessionStorageService} from 'angular-web-storage';

@Injectable()
export class UiService {

    @Output() appNameChange: EventEmitter<string> = new EventEmitter();

    constructor(private http: HttpClient, private sessionStorage: SessionStorageService) {
    }

    toggleTheme(){
        //TODO
    }

    loadSideMenuData(): Observable<TreeNode[]> {
        return new Observable<TreeNode[]>((observer) => {
            // const testData = this.sessionStorage.get('testData');
            // if (testData != null) {
            //     observer.next(testData);
            //     observer.complete();
            // } else {
                this.http.get<TreeNode[]>('assets/test.json').subscribe((response: TreeNode[]) => {
                        this.saveTestData(response);
                        observer.next(response);
                        observer.complete();
                    }
                );
            // }
        });
    }

    saveTestData(testData: TreeNode[]) {
        this.sessionStorage.set('testData', testData, 10, 'h');
    }
}
