# UDesk - Universal Desktop Interface

## Overview

UDesk is an Electron-based desktop application that provides **universal access to multiple local and web interfaces with automation capabilities in a single unified UI**. It combines the power of browser automation (Puppeteer) with a modern Angular interface to create a centralized control center for managing and automating interactions across various web applications and local services.

**What makes UDesk unique**: UDesk combines automation capabilities with a full-featured desktop interface, allowing users to not just automate tasks but also manage multiple interfaces, create custom workflows, and control everything from a single, persistent desktop application. The application supports **multiple monitors** and can be compiled for **Windows and Linux (x86/x64)** platforms. ARM architecture support is also possible through Electron's ARM builds (ARM64 for Linux and Windows on ARM).

## Key Concept

Instead of juggling multiple browser tabs, applications, and interfaces, UDesk brings everything into one streamlined desktop application where you can:
- Access multiple web interfaces from a single window
- Automate repetitive tasks across different platforms
- Manage local and remote services through a unified interface
- Create custom workflows and page actions
- Control everything from one central dashboard

## Features

- **Unified Interface**: Single Angular-based UI for accessing multiple web/local interfaces
- **Browser Automation**: Built-in Puppeteer integration for automating web interactions
- **Electron Desktop App**: Cross-platform desktop application (Windows x86/x64, Linux x86/x64, ARM64 support available)
- **Multi-Monitor Support**: Full support for multiple display configurations
- **Page Actions**: Customizable automation scripts for different interfaces
- **Session Management**: Persistent sessions and configurations
- **Modern UI**: Built with Angular 21 and PrimeNG for a responsive, modern interface
- **Auto-Updates**: Built-in update mechanism for seamless updates

## Technology Stack

- **Frontend**: Angular 21, PrimeNG 21, RxJS
- **Desktop**: Electron 33
- **Automation**: Puppeteer, puppeteer-in-electron
- **Build**: Webpack, electron-builder
- **Language**: TypeScript 5.9

## Installation

### Requirements
- Node.js: v20.11.1+ or v22+
- npm: 10.0.0+

### Development Setup

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm start

# Build for production
npm run build:prod

# Run electron app locally
npm run electron:local
```

### Building Distribution

```bash
# Build for current platform
npm run dist

# Build for Windows
npm run dist-win
```

Output will be in `release-builds/` directory.

## Project Structure

- `/src` - Angular application source code
- `/assets` - Static assets and resources
- `/translations` - i18n translation files
- `main.js` - Electron main process
- `mainDb.js` - Database management
- `mainPageActions.js` - Page action handlers
- `mainMenus.js` - Application menus

## Configuration

Application data is stored in the user's data directory:
- Session data and configurations
- Database files (NeDB)
- User preferences

## Development

```bash
# Start Angular dev server
npm run ng:serve

# Start Electron in dev mode
npm run electron:serve

# Build TypeScript for Electron
npm run electron:serve-tsc
```

## License

See LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
