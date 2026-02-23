// Type definitions for window.electronAPI
// This provides TypeScript support for the Electron IPC bridge

declare global {
    interface Window {
        electronAPI?: {
            send: (channel: string, ...args: any[]) => void;
            sendSync: (channel: string, ...args: any[]) => any;
            invoke: (channel: string, ...args: any[]) => Promise<any>;
            on: (channel: string, callback: (...args: any[]) => void) => () => void;
        };
    }
}

export {};
