import { enableProdMode } from '@angular/core';

import { AppModule } from './app/app.module';
import { APP_CONFIG } from './environments/environment';
import {platformBrowser} from "@angular/platform-browser";

if (APP_CONFIG.production) {
  enableProdMode();
}

platformBrowser().bootstrapModule(AppModule)
  .catch(err => console.log(err));
