import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ currentPage, onPageChange, currentDept, onDeptChange, isCadastrosPage = false }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

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

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/assets/logo-pernambucana.jpg" alt="Pernambucana" />
        <div>
          <strong>Pernambucana</strong>
          <span>{isCadastrosPage ? 'Módulo de Cadastro' : 'Painel Financeiro'}</span>
        </div>
      </div>

      <div className="user-profile-summary" style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--line)', marginBottom: '16px' }}>
        <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Usuário</small>
        <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600, display: 'block', wordBreak: 'break-all' }}>{currentUser?.email}</span>
        <span className="badge" style={{ marginTop: '6px', display: 'inline-block', fontSize: '10px', background: 'rgba(31,182,255,0.15)', color: '#1fb6ff', padding: '2px 8px', borderRadius: '4px' }}>
          {DEPT_LABELS[currentUser?.sector] || 'Administrador'}
        </span>
      </div>

      <nav className="nav">
        {isCadastrosPage ? (
          <>
            <button className={`nav-link ${currentPage === 'servicos' ? 'active' : ''}`} onClick={() => onPageChange('servicos')}>
              <span>◇</span> Serviços Prestados
            </button>
            <button className={`nav-link ${currentPage === 'compras' ? 'active' : ''}`} onClick={() => onPageChange('compras')}>
              <span>◆</span> Compras e Almoxarifado
            </button>
            <button className={`nav-link ${currentPage === 'folha' ? 'active' : ''}`} onClick={() => onPageChange('folha')}>
              <span>▣</span> Folha de Pagamento
            </button>
            <button className={`nav-link ${currentPage === 'custosFixos' ? 'active' : ''}`} onClick={() => onPageChange('custosFixos')}>
              <span>◎</span> Custos Fixos
            </button>
            <div style={{ height: '1px', background: 'var(--line)', margin: '12px 0' }} />
            <Link to="/painel" className="nav-link">
              <span>📊</span> Voltar ao Painel
            </Link>
          </>
        ) : (
          <>
            <button className={`nav-link ${currentPage === 'geral' ? 'active' : ''}`} onClick={() => { onPageChange('geral'); }}>
              <span>◈</span> Visão geral
            </button>
            {['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria', 'AltoGeral'].map((d) => {
              // Oculta setores diferentes do setor do usuário se não for admin
              if (currentUser && !currentUser.isAdmin && currentUser.sector !== d) return null;
              return (
                <button
                  key={d}
                  className={`nav-link ${currentPage === 'setor' && currentDept === d ? 'active' : ''}`}
                  onClick={() => {
                    onDeptChange(d);
                    onPageChange('setor');
                  }}
                >
                  <span>{d === 'Mecanica' ? '⚙' : d === 'Peças' ? '▣' : d === 'Retifica' ? '◇' : d === 'Torneadora' ? '◎' : d === 'Caldeiraria' ? '▰' : '◉'}</span> {DEPT_LABELS[d]}
                </button>
              );
            })}
            <button className={`nav-link ${currentPage === 'despesas' ? 'active' : ''}`} onClick={() => onPageChange('despesas')}>
              <span>◆</span> Despesas
            </button>
            <button className={`nav-link ${currentPage === 'produtivos' ? 'active' : ''}`} onClick={() => onPageChange('produtivos')}>
              <span>★</span> Produtivos
            </button>
            <button className={`nav-link ${currentPage === 'detalhes' ? 'active' : ''}`} onClick={() => onPageChange('detalhes')}>
              <span>☰</span> Fechamento
            </button>
            <div style={{ height: '1px', background: 'var(--line)', margin: '12px 0' }} />
            <Link to="/cadastros" className="nav-link">
              <span>✏</span> Cadastrar Lançamentos
            </Link>
          </>
        )}
        <Link to="/" className="nav-link">
          <span>↗</span> Portal Inicial
        </Link>
      </nav>

      <button className="logout-btn" onClick={handleLogout} type="button">Sair</button>
      
      {!isCadastrosPage && (
        <div className="side-card muted-card" style={{ marginTop: 'auto' }}>
          <small>Áreas</small>
          <p>Mecânica, Peças, Retífica, Torneadora, Caldeiraria e Alto Geral com visão mensal e acumulada.</p>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
