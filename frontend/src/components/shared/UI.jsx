import React, { useState } from 'react';
import './UI.css';

// ── Page Header ───────────────────────────────────────────────────────────────
export const PageHeader = ({ title, subtitle, action }) => (
  <div className="page-header">
    <div>
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-sub">{subtitle}</p>}
    </div>
    {action && <div className="page-header-action">{action}</div>}
  </div>
);

// ── Stat Card ─────────────────────────────────────────────────────────────────
export const StatCard = ({ icon, label, value, change, changeType = 'up', color = 'blue' }) => (
  <div className="stat-card">
    <div className={`stat-icon icon-${color}`}>{icon}</div>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    {change && <div className={`stat-change ${changeType}`}>{changeType === 'up' ? '↑' : '↓'} {change}</div>}
  </div>
);

// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE_MAP = {
  active:    'badge-success',
  trial:     'badge-warning',
  expired:   'badge-danger',
  suspended: 'badge-gray',
  pending:   'badge-warning',
  completed: 'badge-success',
  paid:      'badge-success',
};
export const Badge = ({ status, label }) => (
  <span className={`badge ${BADGE_MAP[status] || 'badge-gray'}`}>
    {label || status}
  </span>
);

// ── Card ──────────────────────────────────────────────────────────────────────
export const Card = ({ children, style, className = '' }) => (
  <div className={`card ${className}`} style={style}>{children}</div>
);

export const CardHeader = ({ title, action }) => (
  <div className="card-header">
    <div className="card-title">{title}</div>
    {action && <div>{action}</div>}
  </div>
);

// ── Table ─────────────────────────────────────────────────────────────────────
export const Table = ({ columns, data, emptyMessage = 'No records found' }) => (
  <div className="table-wrap">
    <table>
      <thead>
        <tr>{columns.map(c => <th key={c.key || c.label}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {data.length === 0
          ? <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>{emptyMessage}</td></tr>
          : data.map((row, i) => (
              <tr key={row._id || i}>
                {columns.map(c => <td key={c.key || c.label}>{c.render ? c.render(row) : row[c.key]}</td>)}
              </tr>
            ))
        }
      </tbody>
    </table>
  </div>
);

// ── Modal ─────────────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, width = 500 }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

// ── Confirm Dialog ────────────────────────────────────────────────────────────
export const ConfirmDialog = ({ open, onClose, onConfirm, title, message, danger }) => (
  <Modal open={open} onClose={onClose} title={title} width={400}>
    <p style={{ fontSize: '14px', color: 'var(--gray-600)', marginBottom: '24px' }}>{message}</p>
    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button className={`btn ${danger ? 'btn-danger' : 'btn-brand'}`} onClick={() => { onConfirm(); onClose(); }}>
        Confirm
      </button>
    </div>
  </Modal>
);

// ── Filter Bar ────────────────────────────────────────────────────────────────
export const FilterBar = ({ filters, active, onChange }) => (
  <div className="filter-bar">
    {filters.map(f => (
      <button
        key={f.value}
        className={`filter-btn ${active === f.value ? 'active' : ''}`}
        onClick={() => onChange(f.value)}
      >
        {f.label}
      </button>
    ))}
  </div>
);

// ── Spinner ───────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 40 }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
    <div style={{
      width: size, height: size,
      border: '3px solid var(--gray-200)',
      borderTopColor: 'var(--brand)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  </div>
);

// ── Empty State ───────────────────────────────────────────────────────────────
export const EmptyState = ({ icon = '📭', title, subtitle }) => (
  <div className="empty-state">
    <div className="empty-icon">{icon}</div>
    <div className="empty-title">{title}</div>
    {subtitle && <div className="empty-sub">{subtitle}</div>}
  </div>
);

// ── Bar Chart (pure CSS/HTML) ─────────────────────────────────────────────────
export const BarChart = ({ data, color = 'var(--brand)', height = 140 }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bar-chart" style={{ height }}>
      {data.map((d, i) => (
        <div className="bar-col" key={i}>
          <div className="bar-val">{d.label2 || ''}</div>
          <div className="bar-body" style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
            <div className="bar-fill" style={{ height: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <div className="bar-x">{d.label}</div>
        </div>
      ))}
    </div>
  );
};

// ── Btn ───────────────────────────────────────────────────────────────────────
export const Btn = ({ children, onClick, variant = 'brand', size = 'md', disabled, loading, style, type = 'button' }) => (
  <button
    type={type}
    className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''}`}
    onClick={onClick}
    disabled={disabled || loading}
    style={style}
  >
    {loading ? <><span className="spinner-sm" /> Loading…</> : children}
  </button>
);
