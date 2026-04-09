import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PresenceProvider } from './lib/PresenceContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PresenceProvider>
      <App />
    </PresenceProvider>
  </StrictMode>,
);
