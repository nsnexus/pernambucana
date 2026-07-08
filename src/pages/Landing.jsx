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
  const [redirectTarget, setRedirectTarget] = useState('/painel');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('theme-white', whiteTheme);
    localStorage.setItem('pernambucana.financeDashboard.theme.v1', whiteTheme ? 'white' : 'black');
  }, [whiteTheme]);

  useEffect(() => {
    if (currentUser) {
      // Auto-redirect AltoGeral users to the dedicated module
      if (currentUser.sector === 'AltoGeral' && !currentUser.isAdmin) {
        navigate('/autogeral');
      } else {
        navigate(redirectTarget);
      }
    }
  }, [currentUser, navigate, redirectTarget]);

  const openLogin = (target) => {
    setRedirectTarget(target);
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

      <main className="portal-container" style={{ zIndex: 1 }}>
        <div className="portal-card glass">
          <div className="portal-brand">
            <img src="/assets/logo-pernambucana.jpg" alt="Pernambucana Centro de Manutenção" className="portal-logo" />
            <h2>Pernambucana</h2>
            <p>Centro de Manutenção & Usinagem</p>
            <span className="portal-badge">Gestão Financeira</span>
          </div>
          
          <div className="portal-divider"></div>
          
          <div className="portal-actions">
            <h3>Selecione a área de acesso</h3>
            
            <button className="portal-action-btn" onClick={() => openLogin('/painel')}>
              <div className="btn-icon-wrapper">◈</div>
              <div className="btn-text-wrapper">
                <strong>Painel Financeiro</strong>
                <span>Visualizar KPIs, gráficos e relatórios consolidados da operação.</span>
              </div>
            </button>
            
            <button className="portal-action-btn" onClick={() => openLogin('/cadastros')}>
              <div className="btn-icon-wrapper">✏</div>
              <div className="btn-text-wrapper">
                <strong>Painel de Cadastro</strong>
                <span>Lançar serviços prestados, compras, despesas, folha e custos.</span>
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
            <img src="/assets/logo-pernambucana.jpg" alt="Pernambucana Centro de Manutenção" />
            <span>Acesso restrito</span>
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
            
            <button className="btn primary full" type="submit" disabled={submitting}>
              {submitting ? 'Verificando...' : 'Entrar no sistema'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Landing;
