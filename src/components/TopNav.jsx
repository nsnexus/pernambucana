import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TopNav = ({ currentPage, onPageChange, currentDept, onDeptChange, isCadastrosPage = false, isAutoGeral = false, whiteTheme, setWhiteTheme, isPernambucana = false }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [sectorOpen, setSectorOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Erro ao deslogar:', err);
    }
  };

  const DEPT_LABELS = {
    Mecanica: 'Mecânica',
    Peças: 'Peças',
    Retifica: 'Retífica',
    Torneadora: 'Torneadora',
    Caldeiraria: 'Caldeiraria',
    AltoGeral: 'Alto Geral'
  };

  const allowedDepts = ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria', 'AltoGeral'].filter(d => {
    if (currentUser && !currentUser.isAdmin && currentUser.allowedSectors && !currentUser.allowedSectors.includes(d)) return false;
    return true;
  });

  const handleDeptClick = (d) => {
    onDeptChange(d);
    onPageChange('setor');
    setSectorOpen(false);
    setMobileOpen(false);
  };

  const navLink = (page, label) => (
    <button
      key={page}
      className={`topnav-link ${currentPage === page ? 'active' : ''}`}
      onClick={() => { onPageChange(page); setMobileOpen(false); }}
    >
      {label}
    </button>
  );

  return (
    <header className="topnav">
      <div className="topnav-inner">
        {/* Left: Brand */}
        <Link to="/" className="topnav-brand">
          <img 
            src={isAutoGeral ? "/assets/logo-autogeral.jpg" : "/assets/logo-pernambucana.jpg"} 
            alt={isAutoGeral ? "Auto Geral" : "Pernambucana"} 
            style={isAutoGeral ? { background: '#000', padding: '0px', objectFit: 'contain' } : {}}
          />
          <div>
            <strong>{isAutoGeral ? 'Auto Geral' : 'Pernambucana'}</strong>
            <span>{isAutoGeral ? 'Peças e Serviços' : isCadastrosPage ? 'Cadastros' : 'Financeiro'}</span>
          </div>
        </Link>

        {/* Hamburger for mobile */}
        <button className="topnav-hamburger" onClick={() => setMobileOpen(!mobileOpen)} type="button" aria-label="Menu">
          <span /><span /><span />
        </button>

        {/* Center: Navigation */}
        <nav className={`topnav-links ${mobileOpen ? 'open' : ''}`}>
          {isAutoGeral ? (
            <>
              <div className="topnav-divider" />
              <Link to="/" className="topnav-link" onClick={() => setMobileOpen(false)}>↗ Portal</Link>
            </>
          ) : isPernambucana ? (
            <>
              {currentUser?.isAdmin && navLink('dashboard', 'Dashboard')}
              {navLink('servicos', 'Serviços')}
              {navLink('compras', 'Compras')}
              {navLink('boletos', 'Boletos')}
              {navLink('recebiveis', 'Recebíveis')}
              <div className="topnav-divider" />
              <Link to="/" className="topnav-link" onClick={() => setMobileOpen(false)}>↗ Portal</Link>
            </>
          ) : isCadastrosPage ? (
            <>
              {navLink('servicos', 'Serviços')}
              {navLink('compras', 'Compras')}
              {navLink('folha', 'Folha')}
              {navLink('custosFixos', 'Custos Fixos')}
              <div className="topnav-divider" />
              <Link to="/painel" className="topnav-link" onClick={() => setMobileOpen(false)}>📊 Painel</Link>
            </>
          ) : (
            <>
              {navLink('geral', 'Visão Geral')}
              {navLink('setor', 'Por Setor')}
              {navLink('despesas', 'Despesas')}
              {navLink('produtivos', 'Produtivos')}
              {navLink('detalhes', 'Fechamento')}
              <div className="topnav-divider" />
              <Link to="/cadastros" className="topnav-link" onClick={() => setMobileOpen(false)}>✏️ Cadastros</Link>
            </>
          )}
        </nav>

        {/* Right: User + Theme Toggle + Logout */}
        <div className="topnav-right">
          <div className="topnav-user">
            <div className="topnav-avatar">
              {(currentUser?.email || 'U')[0].toUpperCase()}
            </div>
            <span className="topnav-email">{currentUser?.email}</span>
          </div>

          <button 
            className="topnav-theme-toggle" 
            onClick={() => setWhiteTheme(!whiteTheme)}
            title={whiteTheme ? 'Alternar para Tema Escuro' : 'Alternar para Tema Claro'}
            type="button"
          >
            {whiteTheme ? '🌙' : '☀️'}
          </button>

          <button className="topnav-logout" onClick={handleLogout} type="button">Sair</button>
        </div>
      </div>
    </header>
  );
};

export default TopNav;
