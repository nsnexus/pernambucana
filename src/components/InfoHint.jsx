import React from 'react';

// Ícone de ajuda para campos de formulário. Ao passar o mouse (ou tocar),
// mostra o texto de orientação. Usa o title nativo + um tooltip estilizado.
const InfoHint = ({ text }) => {
  if (!text) return null;
  return (
    <span
      className="info-hint"
      tabIndex={0}
      role="img"
      aria-label={text}
      title={text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '15px',
        height: '15px',
        marginLeft: '6px',
        borderRadius: '50%',
        background: 'var(--line, #d1d5db)',
        color: 'var(--text, #111)',
        fontSize: '10px',
        fontWeight: 'bold',
        fontStyle: 'normal',
        cursor: 'help',
        userSelect: 'none',
        verticalAlign: 'middle',
      }}
    >
      i
    </span>
  );
};

export default InfoHint;
