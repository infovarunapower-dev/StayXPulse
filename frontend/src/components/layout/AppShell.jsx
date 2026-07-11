import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../common/ThemeToggle';
import useNewOrderAlert from '../../hooks/useNewOrderAlert';
import sunverMark from '../../assets/sunver-mark.png';
import './AppShell.css';

const SuperAdminMenu = [
  { section: 'Overview', items: [
    { to: '/admin/dashboard',      icon: '📊', label: 'Dashboard'       },
    { to: '/admin/summary',        icon: '📈', label: 'Overall Summary' },
  ]},
  { section: 'Hotels', items: [
    { to: '/admin/hotels',         icon: '🏨', label: 'Hotel List'      },
    { to: '/admin/paid-hotels',    icon: '✅', label: 'Paid Hotels'     },
    { to: '/admin/payments',       icon: '💳', label: 'Payment History' },
  ]},
  { section: 'Settings', items: [
    { to: '/admin/plans',          icon: '💎', label: 'Manage Plans'    },
    { to: '/admin/reminders',      icon: '🔔', label: 'Email Reminders' },
    { to: '/admin/email-settings', icon: '📧', label: 'Email Settings'  },
  ]},
];

const HotelAdminMenu = [
  { section: 'Manage', items: [
    { to: '/hotel/dashboard',        icon: '🏠', label: 'Dashboard'         },
    { to: '/hotel/qr',               icon: '📱', label: 'QR Management'     },
    { to: '/hotel/food',             icon: '🍽', label: 'Food Management'   },
  ]},
  { section: 'Operations', items: [
    { to: '/hotel/service-requests', icon: '🛎', label: 'Service Requests'  },
    { to: '/hotel/food-orders',      icon: '🍛', label: 'Food Orders'       },
  ]},
  { section: 'Insights', items: [
    { to: '/hotel/analytics',        icon: '📈', label: 'Analytics'         },
  ]},
  { section: 'Account', items: [
    { to: '/hotel/subscription',     icon: '🧾', label: 'Subscription'      },
  ]},
];

const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menus    = user?.role === 'superadmin' ? SuperAdminMenu : HotelAdminMenu;
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  // Chime + toast + desktop notification when a new order/request lands
  useNewOrderAlert(user?.role === 'hoteladmin');

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="shell">
      {sidebarOpen && <div className="shell-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`shell-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="shell-logo">
          <div className="shell-logo-icon">S</div>
          <div>
            <div className="shell-logo-text">StayXPulse</div>
            <div className="shell-logo-sub">
              by <img src={sunverMark} alt="" className="shell-logo-sub-mark" /> <strong>SUNVER</strong> Coresynergy
            </div>
          </div>
        </div>

        <nav className="shell-nav">
          {menus.map(section => (
            <div className="nav-section" key={section.section}>
              <div className="nav-section-label">{section.section}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <a className="shell-apk-btn" href="/stayxpulse.apk" download="StayXPulse.apk">
          <span className="shell-apk-icon">🤖</span>
          <span>
            <span className="shell-apk-title">Get the Android App</span>
            <span className="shell-apk-sub">Download APK</span>
          </span>
        </a>

        <div className="shell-sidebar-footer">
          <div className="shell-user">
            <div className="shell-avatar">{initials}</div>
            <div className="shell-user-info">
              <div className="shell-user-name">{user?.name}</div>
              <div className="shell-user-role">{user?.role === 'superadmin' ? 'Super Admin' : 'Hotel Admin'}</div>
            </div>
          </div>
          <button className="shell-logout-btn" onClick={handleLogout} title="Sign out">⏻</button>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-header">
          <button className="shell-menu-btn" onClick={() => setSidebarOpen(s => !s)}>☰</button>
          <div className="shell-header-info">
            {user?.hotel && (
              <span className="shell-hotel-badge">
                {user.hotel.logoUrl && <img src={`http://localhost:5000${user.hotel.logoUrl}`} alt="logo" className="shell-hotel-logo" />}
                {user.hotel.hotelName}
              </span>
            )}
            {user?.role === 'superadmin' && (
              <span className="shell-role-pill">Super Admin</span>
            )}
          </div>
          <div className="shell-header-right">
            {user?.role === 'hoteladmin' && (
              <button className="shell-upgrade-btn" onClick={() => navigate('/hotel/upgrade')}>
                ⬆ Upgrade Plan
              </button>
            )}
            <ThemeToggle />
            <div className="shell-avatar shell-avatar-sm">{initials}</div>
          </div>
        </header>

        <main className="shell-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
