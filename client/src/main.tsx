import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;
(window as any).global = window;
(window as any).process = { 
  env: { NODE_ENV: 'development' },
  version: '',
  nextTick: (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0),
  listeners: () => [],
  on: () => {},
  removeListener: () => {}
};

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <App />
)
