import React from 'react';
import './AuthLayout.css';

const AuthLayout = ({ children }) => (
  <div className="auth-shell">
    {/* Left brand panel */}
    <div className="auth-panel">
      <div className="auth-panel-inner">
        <div className="auth-brand">
          <div className="auth-brand-icon">S</div>
          <div>
            <div className="auth-brand-name">StayXPulse</div>
            <div className="auth-brand-tagline">Smart Hotel Management</div>
          </div>
        </div>
        <div className="auth-panel-headline">
          Run your hotel smarter — from QR menus to real-time orders.
        </div>
        <div className="auth-features">
          {[
            { icon: '📱', text: 'QR-based room service & food ordering' },
            { icon: '🍽', text: 'Digital menu with real-time availability' },
            { icon: '📊', text: 'Orders, requests & analytics dashboard' },
            { icon: '💳', text: 'Simple subscription plans, cancel anytime' },
          ].map((f) => (
            <div className="auth-feature-item" key={f.text}>
              <span className="auth-feature-icon">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="auth-panel-circles">
        <div className="circle c1" />
        <div className="circle c2" />
        <div className="circle c3" />
      </div>
    </div>

    {/* Right form area */}
    <div className="auth-form-area">
      <div className="auth-card">{children}</div>
    </div>
  </div>
);

export default AuthLayout;
