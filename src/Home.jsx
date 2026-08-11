import React, { useState, useEffect } from 'react';
import Header from './components/header.jsx';
import Footer from './components/footer.jsx';
import SettingsSidebar from './components/SettingsSidebar.jsx';
import AdminLayout from './components/adminLayout.jsx';
import { useAuth } from './context/AuthContext.jsx';

// Pages
import LandingPage from './pages/landing.jsx';
import Login from './pages/login.jsx';
import Register from './pages/register.jsx';
import ForgotPassword from './pages/recuperarContraseña.jsx';
import NearMeHome from './pages/Inicio.jsx';
import InteractiveMap from './pages/mapa.jsx';
import AwayFromHomePlanner from './pages/itinerario.jsx';
import HotelDetail from './pages/infoCards.jsx';
import Checkout from './pages/pago.jsx';
import BookingConfirmed from './pages/confirmacionPago.jsx';
import ResetPassword from './pages/resetContraseña.jsx';

//Admin Pages
import AdminDashboard from './pages/Admin/dashboard.jsx';
import AdminInventario from './pages/Admin/inventario.jsx';
import AdminPagos from './pages/Admin/pagosAdmin.jsx';
import AdminHoteles from './pages/Admin/registroHotel.jsx';
import AdminTransporte from './pages/Admin/registroTransporte.jsx';
import AdminResenas from './pages/Admin/resenas.jsx';
import AdminUsuarios from './pages/Admin/usuarios.jsx';
import AdminPerfil from './pages/Admin/adminPerfil.jsx';
import ConfiguracionesAdmin from './pages/Admin/configuracionesAdmin.jsx';
// NOTA: verifica el nombre real de este archivo — "notificacionesafmin.jsx" parece un typo
// de "notificacionesAdmin.jsx". Si el archivo en disco tiene otro nombre, el build va a fallar.
import NotificacionesAdmin from './pages/Admin/notificacionesafmin.jsx';


// Settings sub-pages
import UserProfile from './pages/perfil.jsx';
import PrivacySecurity from './pages/seguridad.jsx';
import UserNotifications from './pages/notificaciones.jsx';
import SavedTrips from './pages/favoritos.jsx';
import PaymentsBilling from './pages/historialPagos.jsx';
import AccountSettings from './pages/privacidad.jsx';

// Páginas cuyo currentPage corresponde a una vista de Admin.
// AdminLayout ya trae su propio header/nav, así que estas páginas
// no deben llevar el Header/Footer públicos encima.
const ADMIN_PAGES = [
  'admin-dashboard',
  'admin-inventario',
  'admin-pagos',
  'admin-hoteles',
  'admin-transporte',
  'admin-perfil',
  'admin-configuraciones',
  'admin-notificaciones',
  'admin-resenas',
  'admin-usuarios'
];

const PAYMENT_RESULT_KEY = 'travexperience_payment_result';

function Home() {
  const { user, isLoggedIn, handleSignOut: authSignOut, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState('landing');
  const [settingsTab, setSettingsTab] = useState('Personal Info');
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  // Sync window hash with router page
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (!hash) return;
      const [route] = hash.split('?');
      if (!route) return;

      if ([
        'landing', 'login', 'register', 'forgot-password', 'reset-password', 'inicio', 'mapa',
        'itinerario', 'hotel-detail', 'checkout', 'payment-success',
        ...ADMIN_PAGES,
      ].includes(route)) {
        setCurrentPage(route);
        if (route === 'payment-success') {
          try {
            const saved = sessionStorage.getItem(PAYMENT_RESULT_KEY);
            setPaymentResult(saved ? JSON.parse(saved) : null);
          } catch {
            setPaymentResult(null);
          }
        } else {
          setPaymentResult(null);
        }
      } else if (['personal-info', 'security', 'notifications', 'favorites', 'payments', 'privacy'].includes(route)) {
        setCurrentPage('settings');
        if (route !== 'payment-success') {
          setPaymentResult(null);
        }
        // Map hash to Settings tab name
        const tabMap = {
          'personal-info': 'Personal Info',
          'security': 'Security',
          'notifications': 'Notifications',
          'favorites': 'Favorites',
          'payments': 'Payments',
          'privacy': 'Privacy'
        };
        setSettingsTab(tabMap[hash]);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Run on mount

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (page, params = {}) => {
    if (page === 'settings') {
      const tab = params.tab || 'Personal Info';
      setSettingsTab(tab);
      const tabHash = tab.toLowerCase().replace(/\s+/g, '-');
      window.location.hash = `#${tabHash}`;
      setCurrentPage('settings');
    } else {
      if (params.hotel) {
        setSelectedHotel(params.hotel);
      }
      if (page === 'payment-success') {
        const payload = params.paymentResult || null;
        try {
          sessionStorage.setItem(PAYMENT_RESULT_KEY, JSON.stringify(payload));
        } catch {
          // no-op si el navegador no permite storage en este contexto.
        }
        setPaymentResult(payload);
      } else {
        try {
          sessionStorage.removeItem(PAYMENT_RESULT_KEY);
        } catch {
          // no-op
        }
      }
      if (params.paymentResult) {
        setPaymentResult(params.paymentResult);
      }
      const hash = params.token ? `#${page}?token=${encodeURIComponent(params.token)}` : `#${page}`;
      window.location.hash = hash;
      setCurrentPage(page);
    }
  };

  // Cada vez que cambia la página (o el tab de Settings), la vista debe empezar
  // arriba del todo. Sin esto, el scroll se quedaba en la posición de la
  // página anterior y la nueva pantalla aparecía "a medias" (empezando desde abajo).
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [currentPage, settingsTab]);

  const handleSignOut = () => {
    authSignOut();
    navigate('landing');
  };

  const isAdminPage = ADMIN_PAGES.includes(currentPage);

  // El registro público ya no ofrece la opción de crear cuentas de
  // administrador (ver register.jsx), así que las páginas de Admin solo
  // deben ser accesibles para sesiones cuyo rol realmente sea 'admin'
  // (dadas de alta por otro medio). Cualquier otro caso se manda a login.
  useEffect(() => {
    if (!isAdminPage || isLoading) return;
    if (!isLoggedIn || user?.role !== 'admin') {
      navigate('login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminPage, isLoading, isLoggedIn, user]);

  // Mientras se intenta restaurar la sesión (localStorage -> /auth/me),
  // evitamos parpadear entre el estado "invitado" y el "logueado".
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
      </div>
    );
  }

  // Determine if we should show standard header/footer
  const showHeader = !isAdminPage; // Admin pages use their own AdminLayout header
  const noFooterPages = ['mapa']; // fullscreen pages skip footer
  const showFooter = !isAdminPage && !noFooterPages.includes(currentPage);

  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return <LandingPage onNavigate={navigate} />;
      case 'login':
        return (
          <Login 
            onNavigate={navigate} 
            onLoginSuccess={(role) => navigate(role === 'admin' ? 'admin-dashboard' : 'inicio')} 
          />
        );
      case 'register':
        return (
          <Register 
            onNavigate={navigate} 
            onRegisterSuccess={() => navigate('inicio')} 
          />
        );
      case 'forgot-password':
        return <ForgotPassword onNavigate={navigate} />;
      case 'reset-password':
        return <ResetPassword onNavigate={navigate} />;
      case 'inicio':
        return <NearMeHome onNavigate={navigate} />;
      case 'mapa':
        return <InteractiveMap onNavigate={navigate} />;
      case 'itinerario':
        return <AwayFromHomePlanner onNavigate={navigate} />;
      case 'hotel-detail':
        return <HotelDetail onNavigate={navigate} hotel={selectedHotel} />;
      case 'checkout':
        return <Checkout onNavigate={navigate} hotel={selectedHotel} />;
      case 'payment-success':
        return <BookingConfirmed onNavigate={navigate} paymentResult={paymentResult} />;
      case 'admin-dashboard':
        return <AdminDashboard onNavigate={navigate} />;
      case 'admin-inventario':
        return <AdminInventario onNavigate={navigate} />;
      case 'admin-pagos':
        return <AdminPagos onNavigate={navigate} />;
      case 'admin-hoteles':
        return <AdminHoteles onNavigate={navigate} />;
      case 'admin-transporte':
        return <AdminTransporte onNavigate={navigate} />;
      case 'admin-resenas':
        return <AdminResenas onNavigate={navigate} />;
      case 'admin-usuarios':
        return <AdminUsuarios onNavigate={navigate} />;
      case 'admin-perfil':
        return <AdminPerfil onNavigate={navigate} />;
      case 'admin-configuraciones':
        return <ConfiguracionesAdmin onNavigate={navigate} />;
      case 'admin-notificaciones':
        return <NotificacionesAdmin onNavigate={navigate} />;
      case 'settings':
        return renderSettingsPage();
      default:
        return <LandingPage onNavigate={navigate} />;
    }
  };

  const renderSettingsPage = () => {
    const renderActiveTab = () => {
      switch (settingsTab) {
        case 'Personal Info':
          return <UserProfile onNavigate={navigate} isSettingsTab={true} />;
        case 'Security':
          return <PrivacySecurity onNavigate={navigate} isSettingsTab={true} />;
        case 'Notifications':
          return <UserNotifications onNavigate={navigate} isSettingsTab={true} />;
        case 'Favorites':
          return <SavedTrips onNavigate={navigate} isSettingsTab={true} />;
        case 'Payments':
          return <PaymentsBilling onNavigate={navigate} isSettingsTab={true} />;
        case 'Privacy':
          return <AccountSettings onNavigate={navigate} isSettingsTab={true} />;
        default:
          return <UserProfile onNavigate={navigate} isSettingsTab={true} />;
      }
    };

    return (
      <div className="bg-background text-on-background font-sans min-h-screen flex">
        <SettingsSidebar 
          currentTab={settingsTab} 
          onTabChange={(tab) => navigate('settings', { tab })} 
          onSignOut={handleSignOut}
        />
        <div className="flex-1 md:pl-64 lg:pl-72 pt-20">
          {renderActiveTab()}
        </div>
      </div>
    );
  };

  // Admin pages render their own AdminLayout without the public shell
  if (isAdminPage) {
    return (
      <div key={currentPage} className="animate-page-in">
        {renderPage()}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-on-background selection:bg-secondary-container antialiased">
      {showHeader && (
        <Header 
          isLoggedIn={isLoggedIn} 
          onNavigate={navigate} 
          currentPage={currentPage}
          currentTab={settingsTab}
          onSignOut={handleSignOut}
        />
      )}
      
      <div className="flex-grow">
        <div key={currentPage} className="animate-page-in">
          {renderPage()}
        </div>
      </div>

      {showFooter && <Footer />}
    </div>
  );
}

export default Home;