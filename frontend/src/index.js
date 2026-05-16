import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
// StrictMode removed — it double-invokes effects in dev which breaks auth state
root.render(<App />);
