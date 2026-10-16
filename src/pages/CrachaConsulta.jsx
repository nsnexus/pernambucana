import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { getFuncionarioTreinamentos } from '../utils/pgrTreinamentos';

const CrachaConsulta = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('todos'); // 'todos' | 'realizados' | 'pendentes'
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    if (!id) {
      setError('ID de funcionário não informado.');
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'efetivos', id), (docSnap) => {
      setLoading(false);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEmployee({ id: docSnap.id, ...data });
        setError(null);
      } else {
        setError('Colaborador não encontrado ou crachá inativo no sistema.');
      }
    }, (err) => {
      console.error('Erro ao buscar dados do crachá:', err);
      setError('Erro ao carregar dados do colaborador.');
      setLoading(false);
    });

    return () => unsub();
  }, [id]);

  const handleQuickToggle = async (treinamentoId) => {
    if (!currentUser) return; // apenas usuários logados no sistema podem atualizar pelo celular
    try {
      setUpdatingId(treinamentoId);
      const currentList = getFuncionarioTreinamentos(employee);
      const updatedList = currentList.map(t => {
        if (t.id === treinamentoId) {
          const nextStatus = t.status === 'realizado' ? 'pendente' : 'realizado';
          return {
            ...t,
            status: nextStatus,
            dataConclusao: nextStatus === 'realizado' ? new Date().toISOString().split('T')[0] : ''
          };
        }
        return t;
      });

      await updateDoc(doc(db, 'efetivos', employee.id), {
        treinamentos: updatedList
      });
    } catch (err) {
      console.error('Erro ao atualizar treinamento:', err);
      alert('Erro ao atualizar: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '16px', fontSize: '14px', color: '#94a3b8' }}>Consultando matriz de treinamentos...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#ffffff', padding: '24px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', margin: '0 0 8px' }}>Consulta Não Disponível</h2>
        <p style={{ color: '#94a3b8', maxWidth: '360px', fontSize: '14px', margin: '0 0 24px' }}>{error || 'Não foi possível localizar este registro.'}</p>
        <Link to="/" style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' }}>
          Voltar ao Início
        </Link>
      </div>
    );
  }

  const brand = employee.brand || 'pernambucana';
  const brandTitle = brand === 'autogeral' ? 'AUTO GERAL' : 'PERNAMBUCANA';
  const brandSubtitle = brand === 'autogeral' ? 'PEÇAS E SERVIÇOS' : 'PEÇAS, RETÍFICA E TORNEADORA';
  const logoSrc = brand === 'autogeral' ? '/assets/logo-autogeral.jpg' : '/assets/logo-pernambucana.jpg';

  const treinamentos = getFuncionarioTreinamentos(employee);
  const realizados = treinamentos.filter(t => t.status === 'realizado');
  const percentual = treinamentos.length > 0 ? Math.round((realizados.length / treinamentos.length) * 100) : 0;

  const filteredTreinamentos = treinamentos.filter(t => {
    if (filter === 'realizados') return t.status === 'realizado';
    if (filter === 'pendentes') return t.status !== 'realizado';
    return true;
  });

  const isDesligado = employee.status === 'Desligado';

  return (
    <div style={{ minHeight: '100vh', background: '#090d16', color: '#f8fafc', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', paddingBottom: '40px' }}>
      
      {/* Top Header */}
      <header style={{ background: '#16325B', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <img 
          src={logoSrc} 
          alt={brandTitle} 
          style={{ height: '36px', borderRadius: brand === 'autogeral' ? '6px' : '0', marginBottom: '6px' }} 
        />
        <h1 style={{ margin: 0, fontSize: '15px', fontWeight: '800', letterSpacing: '0.8px', color: '#ffffff' }}>
          {brandTitle}
        </h1>
        <span style={{ fontSize: '11px', opacity: 0.85, color: '#e2e8f0' }}>{brandSubtitle}</span>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '540px', margin: '0 auto', padding: '20px 16px' }}>
        
        {/* Card do Colaborador */}
        <section style={{
          background: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '20px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            
            {/* Foto 3x4 */}
            <div style={{
              width: '76px',
              height: '95px',
              borderRadius: '8px',
              border: '2px solid #3b82f6',
              overflow: 'hidden',
              background: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {employee.fotoUrl ? (
                <img src={employee.fotoUrl} alt={employee.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '32px' }}>👤</span>
              )}
            </div>

            {/* Identificação */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  background: isDesligado ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                  color: isDesligado ? '#ef4444' : '#22c55e'
                }}>
                  ● {isDesligado ? 'Desligado' : 'Ativo'}
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Matrícula: {employee.matricula || String(employee.id).slice(0, 5)}
                </span>
              </div>

              <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '800', color: '#ffffff', lineHeight: '1.2' }}>
                {employee.nome}
              </h2>

              <div style={{
                display: 'inline-block',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.4px'
              }}>
                {employee.cargo || 'Colaborador'}
              </div>

              {employee.dataAdmissao && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                  Admissão: {employee.dataAdmissao.split('-').reverse().join('/')}
                </div>
              )}
            </div>

          </div>

          {/* Barra de Progresso PGR */}
          <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>Conformidade Matriz PGR:</span>
              <strong style={{ fontSize: '14px', color: percentual === 100 ? '#22c55e' : '#38bdf8' }}>
                {realizados.length} de {treinamentos.length} ({percentual}%)
              </strong>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${percentual}%`,
                height: '100%',
                background: percentual === 100 ? '#22c55e' : 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                borderRadius: '4px',
                transition: 'width 0.4s ease'
              }}></div>
            </div>
          </div>
        </section>

        {/* Seção Treinamentos PGR */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📋</span> Matriz de Treinamentos
            </h3>
            
            {/* Filtros rápidos */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '2px' }}>
              <button 
                type="button"
                onClick={() => setFilter('todos')}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: filter === 'todos' ? '#2563eb' : 'transparent',
                  color: '#ffffff',
                  fontWeight: filter === 'todos' ? '700' : '400'
                }}
              >
                Todos ({treinamentos.length})
              </button>
              <button 
                type="button"
                onClick={() => setFilter('realizados')}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: filter === 'realizados' ? '#16a34a' : 'transparent',
                  color: '#ffffff',
                  fontWeight: filter === 'realizados' ? '700' : '400'
                }}
              >
                ✔ Realizados ({realizados.length})
              </button>
              <button 
                type="button"
                onClick={() => setFilter('pendentes')}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: filter === 'pendentes' ? '#d97706' : 'transparent',
                  color: '#ffffff',
                  fontWeight: filter === 'pendentes' ? '700' : '400'
                }}
              >
                … Pendentes ({treinamentos.length - realizados.length})
              </button>
            </div>
          </div>

          {/* Lista de Treinamentos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredTreinamentos.map((t) => {
              const isDone = t.status === 'realizado';
              return (
                <div 
                  key={t.id}
                  style={{
                    background: isDone ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                    border: `1px solid ${isDone ? 'rgba(34, 197, 94, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: '900', 
                        color: isDone ? '#22c55e' : '#f59e0b' 
                      }}>
                        {isDone ? '✔' : '…'}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#f8fafc' }}>
                        {t.nome}
                      </strong>
                    </div>

                    {isDone && t.dataConclusao && (
                      <div style={{ fontSize: '11px', color: '#86efac', marginTop: '3px', marginLeft: '22px' }}>
                        Concluído em: {t.dataConclusao.split('-').reverse().join('/')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: isDone ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: isDone ? '#4ade80' : '#fbbf24',
                      whiteSpace: 'nowrap'
                    }}>
                      {isDone ? 'Realizado' : 'Pendente'}
                    </span>

                    {/* Botão de atualização rápida disponível caso um supervisor logado esteja escaneando */}
                    {currentUser && (
                      <button
                        type="button"
                        onClick={() => handleQuickToggle(t.id)}
                        disabled={updatingId === t.id}
                        title={isDone ? 'Marcar como pendente' : 'Marcar como realizado'}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          color: '#ffffff',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        {updatingId === t.id ? '...' : (isDone ? 'Desfazer' : 'Concluir')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTreinamentos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
              Nenhum treinamento nesta categoria.
            </div>
          )}
        </section>

        {/* Rodapé institucional */}
        <footer style={{ textAlign: 'center', marginTop: '32px', fontSize: '11px', color: '#64748b' }}>
          Documento digital verificado via QR Code · Atualização em tempo real conforme matriz de Segurança e Saúde Ocupacional (PGR).
        </footer>

      </main>

    </div>
  );
};

export default CrachaConsulta;
