import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PainelAdministrativo from '../pages/PainelAdministrativo';
import ParticlesBg from './ParticlesBg';

const AdminGateway = ({ children, brand }) => {
  const { currentUser } = useAuth();
  const [choice, setChoice] = useState(null); // 'financeiro', 'administrativo', or null

  if (!currentUser?.isAdmin) {
    return children;
  }

  if (currentUser?.isDocumentsOnly) {
    return <PainelAdministrativo brand={brand} onBackToGateway={() => {}} />;
  }

  if (choice === 'financeiro') {
    return React.cloneElement(children, { onBackToGateway: () => setChoice(null) });
  }

  if (choice === 'administrativo') {
    return <PainelAdministrativo brand={brand} onBackToGateway={() => setChoice(null)} />;
  }

  const isAutoGeral = brand === 'autogeral';
  const logo = isAutoGeral ? '/assets/logo-autogeral.jpg' : '/assets/logo-pernambucana.jpg';

  return (
    <div className="portal-body" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <ParticlesBg whiteTheme={false} />
      <div className="site-bg"></div>
      
      <div className="login-card glass" style={{ textAlign: 'center', zIndex: 10, maxWidth: '440px', width: '100%', position: 'relative' }}>
        <button className="close" onClick={() => window.location.href = '/'} style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '24px', cursor: 'pointer' }}>×</button>
        <img 
          src={logo} 
          alt={brand} 
          style={{ height: '70px', marginBottom: '24px', borderRadius: isAutoGeral ? '14px' : '0', objectFit: 'contain', background: isAutoGeral ? '#000' : 'transparent', padding: isAutoGeral ? '4px' : '0' }} 
        />
        <h2 style={{ color: 'var(--text, #111)', marginBottom: '8px', fontSize: '24px' }}>Acesso Administrativo</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '32px', fontSize: '15px' }}>
          Selecione qual módulo da <strong>{isAutoGeral ? 'Auto Geral' : 'Pernambucana'}</strong> você deseja acessar:
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button 
            className="btn primary" 
            style={{ padding: '16px', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', background: isAutoGeral ? '#4ee247' : '', color: isAutoGeral ? '#000' : '', transition: 'all 0.2s', transform: 'scale(1)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            onClick={() => setChoice('financeiro')}
          >
            <span style={{ fontSize: '20px' }}>📊</span> Painel Financeiro
          </button>
          
          <button 
            className="btn ghost" 
            style={{ padding: '16px', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', background: 'rgba(0, 229, 255, 0.1)', color: '#00b8d4', border: '1px solid rgba(0, 229, 255, 0.3)', transition: 'all 0.2s', transform: 'scale(1)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.background = 'rgba(0, 229, 255, 0.15)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)' }}
            onClick={() => setChoice('administrativo')}
          >
            <span style={{ fontSize: '20px' }}>📁</span> Painel Administrativo
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminGateway;
