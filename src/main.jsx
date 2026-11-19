import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import Home from './Home.jsx';
import PWAStatus from './components/PWAStatus.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { AdminNotificationProvider } from './context/AdminNotificationContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <AdminNotificationProvider>
              <ToastProvider>
                <Home />
                <PWAStatus />
              </ToastProvider>
            </AdminNotificationProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
