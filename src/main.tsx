import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { PresenceProvider } from './lib/PresenceContext';
import { BadgeProvider } from './lib/BadgeContext';
import { AuthProvider } from './lib/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PresenceProvider>
          <BadgeProvider>
            <App />
          </BadgeProvider>
        </PresenceProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
