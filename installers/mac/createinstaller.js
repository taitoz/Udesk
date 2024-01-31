const createDMG = require('electron-installer-dmg');
const path = require('path')
const rootPath = path.join('./')
const outPath = path.join(rootPath, 'release-builds')

async function buildDMG() {
    await createDMG({
        appPath: path.join(outPath,'release-builds','uchet-desktop-darwin-x64', 'uchet-desktop.app'),
        name: 'Uchet Desktop',
        title: 'Uchet Desktop',
        background: '',
        icon: path.join(rootPath, 'assets', 'icons', 'mac','32.icns'),
        overwrite: true,
        debug: true,
        out: path.join(outPath, 'mac-installer')
    });
  }

  buildDMG();