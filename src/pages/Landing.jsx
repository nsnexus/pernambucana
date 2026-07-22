import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ParticlesBg from '../components/ParticlesBg';
import '../styles/landing.css';

const Landing = () => {
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [whiteTheme, setWhiteTheme] = useState(() => {
    return localStorage.getItem('pernambucana.financeDashboard.theme.v1') === 'white';
  });
  
  const [modalOpen, setModalOpen] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState('/pernambucana');
  const [selectedBrand, setSelectedBrand] = useState('pernambucana'); // 'pernambucana' or 'autogeral'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('theme-white', whiteTheme);
    localStorage.setItem('pernambucana.financeDashboard.theme.v1', whiteTheme ? 'white' : 'black');
  }, [whiteTheme]);

  useEffect(() => {
    if (currentUser && justLoggedIn) {
      // Auto-redirect AltoGeral users to the dedicated module
      if (currentUser.sector === 'AltoGeral' && !currentUser.isAdmin) {
        navigate('/autogeral');
      } else {
        navigate(redirectTarget);
      }
    }
  }, [currentUser, navigate, redirectTarget, justLoggedIn]);

  const openLogin = (target, brand) => {
    setRedirectTarget(target);
    setSelectedBrand(brand);
    if (currentUser) {
      navigate(target);
    } else {
      setModalOpen(true);
      setErrorMsg('');
      setEmail('');
      setPassword('');
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      await login(email, password);
      setJustLoggedIn(true);
    } catch (err) {
      console.error(err);
      setErrorMsg('Login (e-mail) ou senha inválidos.');
      setSubmitting(false);
    }
  };

  return (
    <div className="portal-body" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <ParticlesBg whiteTheme={whiteTheme} />
      <div className="site-bg"></div>
      <div className="mesh mesh-one"></div>
      <div className="mesh mesh-two"></div>
      
      <header className="portal-header" style={{ padding: '20px', display: 'flex', justifyContent: 'flex-end', zIndex: 1 }}>
        <button 
          className="theme-btn" 
          onClick={() => setWhiteTheme(!whiteTheme)}
          type="button"
        >
          {whiteTheme ? 'Tema black' : 'Tema white'}
        </button>
      </header>

      <main className="portal-container" style={{ zIndex: 1, padding: '20px 0' }}>
        <div className="portal-cards-wrapper">
          {/* Card 1: Auto Geral */}
          <div className="portal-brand-card autogeral glass">
            <div className="portal-brand">
              <img src="/assets/logo-autogeral.jpg" alt="Auto Geral" className="portal-logo" style={{ background: '#000', padding: '0px', border: 'none' }} />
              <h2>Auto Geral</h2>
              <p>Módulo de Peças & Serviços</p>
              <span className="portal-badge" style={{ background: 'rgba(78, 226, 71, 0.15)', color: '#4ee247' }}>Alto Geral</span>
            </div>
            
            <div className="portal-brand-desc" style={{ color: 'var(--muted)', fontSize: '13px', margin: '20px 0', lineHeight: '1.5' }}>
              Gestão financeira de caixa, comissões de mecânicos e recebíveis de serviços à vista e a prazo.
            </div>
            
            <button className="portal-action-btn autogeral-btn" onClick={() => openLogin('/autogeral', 'autogeral')} style={{ width: '100%' }}>
              <div className="btn-icon-wrapper" style={{ color: '#4ee247' }}>⚡</div>
              <div className="btn-text-wrapper" style={{ textAlign: 'left' }}>
                <strong>Acessar Auto Geral</strong>
                <span>Entrar no painel financeiro Alto Geral</span>
              </div>
            </button>
          </div>

          {/* Card 2: Pernambucana */}
          <div className="portal-brand-card pernambucana glass">
            <div className="portal-brand">
              <img src="/assets/logo-pernambucana.jpg" alt="Pernambucana" className="portal-logo" />
              <h2>Pernambucana</h2>
              <p>Centro de Manutenção & Usinagem</p>
              <span className="portal-badge">Pernambucana</span>
            </div>
            
            <div className="portal-brand-desc" style={{ color: 'var(--muted)', fontSize: '13px', margin: '20px 0', lineHeight: '1.5' }}>
              Painel integrado para Retífica, Peças, Mecânica, Torneadora e Caldeiraria com rateio de despesas.
            </div>
            
            <button className="portal-action-btn" onClick={() => openLogin('/pernambucana', 'pernambucana')} style={{ width: '100%' }}>
              <div className="btn-icon-wrapper">📊</div>
              <div className="btn-text-wrapper" style={{ textAlign: 'left' }}>
                <strong>Acessar Pernambucana</strong>
                <span>Entrar no portal consolidado setorial</span>
              </div>
            </button>
          </div>
        </div>
      </main>

      <footer className="portal-footer" style={{ zIndex: 1, padding: '20px', textAlign: 'center' }}>
        <p>© 2026 NSNexus. Todos os direitos reservados.</p>
      </footer>

      {modalOpen && (
        <div className="modal show" aria-hidden="false" id="loginModal">
          <div className="modal-backdrop" onClick={() => setModalOpen(false)}></div>
          <form className="login-card" onSubmit={handleLoginSubmit} id="loginForm" style={{ zIndex: 10 }}>
            <button className="close" type="button" onClick={() => setModalOpen(false)}>×</button>
            <img 
              src={selectedBrand === 'autogeral' ? "/assets/logo-autogeral.jpg" : "/assets/logo-pernambucana.jpg"} 
              alt={selectedBrand === 'autogeral' ? "Auto Geral" : "Pernambucana"} 
              style={selectedBrand === 'autogeral' ? { background: '#000', padding: '4px', objectFit: 'contain', borderRadius: '14px' } : {}}
            />
            <span style={{ fontWeight: 'bold', color: selectedBrand === 'autogeral' ? '#4ee247' : selectedBrand === 'arquivos' ? '#00e5ff' : 'var(--blue)' }}>
              Acesso Restrito — {selectedBrand === 'autogeral' ? 'Auto Geral' : selectedBrand === 'arquivos' ? 'Gestão de Arquivos' : 'Pernambucana'}
            </span>
            <h2>Acesso ao Portal</h2>
            
            <label>
              Login (E-mail ou Usuário)
              <input 
                id="loginUser" 
                autoComplete="username" 
                placeholder="Digite seu login ou e-mail" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </label>
            
            <label>
              Senha
              <input 
                id="loginPass" 
                type="password" 
                autoComplete="current-password" 
                placeholder="Digite sua senha" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </label>
            
            {errorMsg && <p className="login-error" id="loginError">{errorMsg}</p>}
            
            <button className="portal-btn primary full" type="submit" disabled={submitting} style={selectedBrand === 'autogeral' ? { background: '#4ee247', color: '#000', fontWeight: 'bold' } : {}}>
              {submitting ? 'Verificando...' : 'Entrar no sistema'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Landing;
