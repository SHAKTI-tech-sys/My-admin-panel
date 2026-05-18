import { Buffer } from 'buffer';
import * as processPolyfill from 'process';

if (typeof window !== 'undefined') {
  (window as any).global = window;
  (window as any).globalThis = window;
  (window as any).Buffer = Buffer;
  
  // Ensure process.nextTick is available as it's heavily used by simple-peer
  const browserProcess = {
    ...processPolyfill,
    nextTick: (fn: any, ...args: any[]) => {
      if (typeof fn !== 'function') {
        throw new TypeError('process.nextTick() expects a function');
      }
      setTimeout(() => fn.apply(null, args), 0);
    },
    browser: true,
    env: { ...processPolyfill.env },
    listeners: () => [],
    on: () => {},
    once: () => {},
    off: () => {},
    removeListener: () => {},
    emit: () => {},
    cwd: () => '/',
  };

  (window as any).process = browserProcess;
}
