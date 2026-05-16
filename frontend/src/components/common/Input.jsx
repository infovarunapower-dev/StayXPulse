import React, { useState } from 'react';

const Input = React.forwardRef(({ label, error, type = 'text', ...props }, ref) => {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          ref={ref}
          type={isPassword ? (show ? 'text' : 'password') : type}
          className={`form-control${error ? ' error' : ''}`}
          style={isPassword ? { paddingRight: '44px' } : {}}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: '12px', top: '50%',
              transform: 'translateY(-50%)', background: 'none',
              border: 'none', cursor: 'pointer', color: 'var(--gray-400)',
              fontSize: '16px', padding: '2px',
            }}
            tabIndex={-1}
          >
            {show ? '🙈' : '👁'}
          </button>
        )}
      </div>
      {error && <div className="form-error">⚠ {error}</div>}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
