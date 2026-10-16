import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../context/AuthContext';
import { getFuncionarioTreinamentos, DEFAULT_PGR_TREINAMENTOS } from '../utils/pgrTreinamentos';

const CrachaModal = ({ isOpen, onClose, employee, brand, onEmployeeUpdated }) => {
  const [activeTab, setActiveTab] = useState('visualizar'); // 'visualizar' | 'treinamentos' | 'dados'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [treinamentos, setTreinamentos] = useState([]);
  const [novoTreinamentoNome, setNovoTreinamentoNome] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [cargo, setCargo] = useState('');
  const [matricula, setMatricula] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (employee) {
      setCargo(employee.cargo || 'Colaborador');
      setMatricula(employee.matricula || String(employee.id).slice(0, 5));
      setFotoUrl(employee.fotoUrl || '');
      setTreinamentos(getFuncionarioTreinamentos(employee));

      // Gera o QR Code com a URL pública de consulta
      const publicUrl = `${window.location.origin}/cracha/${employee.id}`;
      QRCode.toDataURL(publicUrl, {
        width: 260,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Erro ao gerar QR Code:', err));
    }
  }, [employee]);

  if (!isOpen || !employee) return null;

  const publicUrl = `${window.location.origin}/cracha/${employee.id}`;

  const handleToggleTreinamento = (id) => {
    setTreinamentos(prev => prev.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === 'realizado' ? 'pendente' : 'realizado';
        return {
          ...t,
          status: nextStatus,
          dataConclusao: nextStatus === 'realizado' && !t.dataConclusao ? new Date().toISOString().split('T')[0] : t.dataConclusao
        };
      }
      return t;
    }));
  };

  const handleDataChange = (id, data) => {
    setTreinamentos(prev => prev.map(t => t.id === id ? { ...t, dataConclusao: data } : t));
  };

  const handleAddTreinamento = () => {
    if (!novoTreinamentoNome.trim()) return;
    const novoItem = {
      id: `custom_${Date.now()}`,
      nome: novoTreinamentoNome.trim(),
      status: 'pendente',
      dataConclusao: ''
    };
    setTreinamentos(prev => [...prev, novoItem]);
    setNovoTreinamentoNome('');
  };

  const handleRemoveTreinamento = (id) => {
    setTreinamentos(prev => prev.filter(t => t.id !== id));
  };

  const handleSalvarTreinamentos = async () => {
    try {
      setIsSaving(true);
      await updateDoc(doc(db, 'efetivos', employee.id), {
        treinamentos
      });
      if (onEmployeeUpdated) {
        onEmployeeUpdated({ ...employee, treinamentos });
      }
      alert('Treinamentos salvos com sucesso!');
      setActiveTab('visualizar');
    } catch (err) {
      console.error('Erro ao salvar treinamentos:', err);
      alert('Erro ao salvar treinamentos: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSalvarDados = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const updates = {
        cargo: cargo.trim() || 'Colaborador',
        matricula: matricula.trim(),
        fotoUrl: fotoUrl.trim()
      };
      await updateDoc(doc(db, 'efetivos', employee.id), updates);
      if (onEmployeeUpdated) {
        onEmployeeUpdated({ ...employee, ...updates });
      }
      alert('Dados do crachá atualizados com sucesso!');
      setActiveTab('visualizar');
    } catch (err) {
      console.error('Erro ao atualizar dados:', err);
      alert('Erro ao atualizar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingPhoto(true);
      const filePath = `fotos_efetivos/${brand || 'geral'}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, filePath);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      setFotoUrl(downloadUrl);
      await updateDoc(doc(db, 'efetivos', employee.id), {
        fotoUrl: downloadUrl
      });

      if (onEmployeeUpdated) {
        onEmployeeUpdated({ ...employee, fotoUrl: downloadUrl });
      }
      alert('Foto 3x4 atualizada com sucesso!');
    } catch (err) {
      console.error('Erro ao enviar foto:', err);
      alert('Erro ao enviar foto: ' + err.message);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePrintCracha = () => {
    window.print();
  };

  const brandTitle = brand === 'autogeral' ? 'AUTO GERAL' : 'PERNAMBUCANA';
  const brandSubtitle = brand === 'autogeral' ? 'PEÇAS E SERVIÇOS' : 'PEÇAS, RETÍFICA E TORNEADORA';

  return (
    <div className="modal show cracha-modal-wrapper" style={{ zIndex: 1100 }}>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-form-card glass cracha-modal-card" style={{ maxWidth: '960px', width: '95vw', padding: 0, overflow: 'hidden' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--line)', background: 'rgba(255,255,255,0.03)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🪪</span> Crachá Funcional & Matriz PGR — {employee.nome}
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Padrão cartão PVC 54x86 mm com QR Code de atualização em tempo real</span>
          </div>
          <button className="close" onClick={onClose} style={{ fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        {/* Modal Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', padding: '12px 24px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--line)' }}>
          <button 
            type="button"
            className={`btn sm ${activeTab === 'visualizar' ? 'primary' : 'outline'}`}
            onClick={() => setActiveTab('visualizar')}
          >
            👁️ Visualizar Crachá (Frente / Verso)
          </button>
          <button 
            type="button"
            className={`btn sm ${activeTab === 'treinamentos' ? 'primary' : 'outline'}`}
            onClick={() => setActiveTab('treinamentos')}
          >
            🎓 Gerenciar Treinamentos ({treinamentos.filter(t => t.status === 'realizado').length}/{treinamentos.length})
          </button>
          <button 
            type="button"
            className={`btn sm ${activeTab === 'dados' ? 'primary' : 'outline'}`}
            onClick={() => setActiveTab('dados')}
          >
            ⚙️ Dados & Foto 3x4
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', maxHeight: '75vh', overflowY: 'auto' }}>
          
          {/* TAB 1: VISUALIZAR CRACHÁ (FRENTE E VERSO) */}
          {activeTab === 'visualizar' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button type="button" className="btn primary" onClick={handlePrintCracha}>
                    🖨️ Imprimir Crachá (PVC 54x86mm)
                  </button>
                  <button type="button" className="btn outline" onClick={handleCopyLink}>
                    {copiedLink ? '✓ Link Copiado!' : '🔗 Copiar Link QR Code'}
                  </button>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn ghost" style={{ textDecoration: 'none' }}>
                    ↗ Abrir Página Pública
                  </a>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Total de Treinamentos: <strong style={{ color: 'var(--green, #16a34a)' }}>{treinamentos.filter(t => t.status === 'realizado').length} realizados</strong> de {treinamentos.length}
                </div>
              </div>

              {/* Contêiner dos Crachás (Lado a Lado na Tela e na Impressão) */}
              <div className="cracha-preview-container" style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap', padding: '16px 0' }}>
                
                {/* ═══ FRENTE DO CRACHÁ ═══ */}
                <div className="cracha-card cracha-frente" style={{
                  width: '240px',
                  height: '380px',
                  background: '#ffffff',
                  color: '#1e293b',
                  borderRadius: '14px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative',
                  fontFamily: "'Inter', sans-serif"
                }}>
                  {/* Top Bar / Header */}
                  <div style={{ background: '#16325B', color: '#ffffff', padding: '10px 8px 6px', textAlign: 'center' }}>
                    <div style={{ fontWeight: '800', fontSize: '12px', letterSpacing: '0.8px', lineHeight: '1.2' }}>{brandTitle}</div>
                    <div style={{ fontSize: '8px', opacity: 0.9, letterSpacing: '0.3px', marginTop: '1px' }}>{brandSubtitle}</div>
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 10px 8px', justifyContent: 'space-between' }}>
                    
                    {/* Foto 3x4 */}
                    <div style={{
                      width: '80px',
                      height: '100px',
                      borderRadius: '6px',
                      border: '1.5px solid #94a3b8',
                      background: '#f1f5f9',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      {fotoUrl ? (
                        <img src={fotoUrl} alt={employee.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ textAlign: 'center', color: '#64748b' }}>
                          <span style={{ fontSize: '24px', display: 'block' }}>👤</span>
                          <span style={{ fontSize: '9px', fontWeight: 'bold' }}>FOTO 3x4</span>
                        </div>
                      )}
                    </div>

                    {/* Nome do Colaborador */}
                    <div style={{ textAlign: 'center', width: '100%', marginTop: '4px' }}>
                      <div style={{
                        fontWeight: '800',
                        fontSize: '11px',
                        color: '#0f172a',
                        textTransform: 'uppercase',
                        lineHeight: '1.2',
                        maxHeight: '26px',
                        overflow: 'hidden',
                        letterSpacing: '0.2px'
                      }}>
                        {employee.nome}
                      </div>
                    </div>

                    {/* Cargo em Destaque */}
                    <div style={{ width: '90%', textAlign: 'center', marginTop: '2px' }}>
                      <div style={{
                        background: '#2563EB',
                        color: '#ffffff',
                        fontWeight: '700',
                        fontSize: '10px',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {cargo || 'COLABORADOR'}
                      </div>
                    </div>

                    {/* QR Code */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px' }}>
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR Code Treinamentos" style={{ width: '90px', height: '90px', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ width: '90px', height: '90px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>
                          Gerando QR...
                        </div>
                      )}
                      <span style={{ fontSize: '7.5px', color: '#475569', textAlign: 'center', marginTop: '2px', lineHeight: '1.1', maxWidth: '170px' }}>
                        Aponte a câmera para ver e atualizar os treinamentos
                      </span>
                      <span style={{ fontSize: '8px', fontWeight: '700', color: '#1e293b', marginTop: '2px' }}>
                        Matrícula {matricula || '0001'}
                      </span>
                    </div>

                  </div>

                  {/* Bottom Bar */}
                  <div style={{ height: '8px', background: '#16325B' }}></div>
                </div>

                {/* ═══ VERSO DO CRACHÁ ═══ */}
                <div className="cracha-card cracha-verso" style={{
                  width: '240px',
                  height: '380px',
                  background: '#ffffff',
                  color: '#1e293b',
                  borderRadius: '14px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative',
                  fontFamily: "'Inter', sans-serif"
                }}>
                  {/* Top Bar / Header */}
                  <div style={{ background: '#16325B', color: '#ffffff', padding: '10px 8px 6px', textAlign: 'center' }}>
                    <div style={{ fontWeight: '800', fontSize: '11px', letterSpacing: '0.8px', lineHeight: '1.2' }}>TREINAMENTOS</div>
                    <div style={{ fontSize: '8px', opacity: 0.9, letterSpacing: '0.3px', marginTop: '1px' }}>conforme matriz do PGR</div>
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1, padding: '10px 12px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    
                    <div>
                      {/* Título Cargo e Situação */}
                      <div style={{
                        fontSize: '9.5px',
                        fontWeight: '800',
                        color: '#16325B',
                        marginBottom: '6px',
                        borderBottom: '1px solid #e2e8f0',
                        paddingBottom: '3px',
                        textTransform: 'uppercase'
                      }}>
                        {cargo || 'COLABORADOR'} · situação
                      </div>

                      {/* Lista de Treinamentos */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5px' }}>
                        {treinamentos.slice(0, 9).map((t, idx) => {
                          const isDone = t.status === 'realizado';
                          return (
                            <div 
                              key={t.id || idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '8px',
                                padding: '2px 4px',
                                borderRadius: '3px',
                                background: isDone ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                borderBottom: '1px solid #f1f5f9'
                              }}
                            >
                              <span style={{ 
                                fontWeight: '500', 
                                color: '#1e293b', 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                maxWidth: '175px' 
                              }}>
                                {t.nome}
                              </span>
                              <span style={{ 
                                fontWeight: '900', 
                                fontSize: '9px',
                                color: isDone ? '#16a34a' : '#d97706',
                                marginLeft: '4px'
                              }}>
                                {isDone ? '✔' : '…'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Rodapé explicativo */}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '4px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '6.5px', color: '#64748b', lineHeight: '1.2' }}>
                        <strong style={{ color: '#16a34a' }}>✔</strong> realizado &nbsp; 
                        <strong style={{ color: '#d97706' }}>…</strong> pendente. A situação é atualizada ao ler o QR code da frente.
                      </p>
                    </div>

                  </div>

                  {/* Bottom Bar */}
                  <div style={{ height: '8px', background: '#16325B' }}></div>
                </div>

              </div>

              {/* Dica de impressão */}
              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--muted)' }}>
                💡 Dica: Ao imprimir, use escala 100% e oriente para modo retrato ou use impressora de cartões PVC.
              </div>

            </div>
          )}

          {/* TAB 2: GERENCIAR TREINAMENTOS */}
          {activeTab === 'treinamentos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px' }}>Matriz de Treinamentos (PGR)</h4>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                    Marque os treinamentos que o colaborador já concluiu e defina a data de realização.
                  </p>
                </div>
                <button type="button" className="btn primary" onClick={handleSalvarTreinamentos} disabled={isSaving}>
                  {isSaving ? 'Salvando...' : '💾 Salvar Alterações'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {treinamentos.map((t) => {
                  const isDone = t.status === 'realizado';
                  return (
                    <div 
                      key={t.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '10px 14px', 
                        borderRadius: '8px', 
                        border: '1px solid var(--line)',
                        background: isDone ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '220px' }}>
                        <input 
                          type="checkbox" 
                          checked={isDone} 
                          onChange={() => handleToggleTreinamento(t.id)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong style={{ fontSize: '14px', color: isDone ? 'var(--green, #22c55e)' : 'inherit' }}>
                            {t.nome}
                          </strong>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            Status no crachá: {isDone ? '✔ Realizado' : '… Pendente'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--muted)' }}>Data Conclusão:</label>
                        <input 
                          type="date" 
                          value={t.dataConclusao || ''} 
                          onChange={(e) => handleDataChange(t.id, e.target.value)}
                          disabled={!isDone}
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '13px', opacity: isDone ? 1 : 0.4 }}
                        />
                        <button 
                          type="button" 
                          className="btn icon-only danger sm" 
                          title="Remover treinamento da matriz deste colaborador"
                          onClick={() => handleRemoveTreinamento(t.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Adicionar novo treinamento */}
              <div style={{ display: 'flex', gap: '8px', padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '10px', border: '1px dashed var(--line)' }}>
                <input 
                  type="text" 
                  placeholder="Nome de outro treinamento / norma (ex: NR-10 Segurança em Eletricidade)..."
                  value={novoTreinamentoNome}
                  onChange={(e) => setNovoTreinamentoNome(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTreinamento())}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}
                />
                <button type="button" className="btn outline" onClick={handleAddTreinamento}>
                  + Adicionar à Matriz
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DADOS DO CRACHÁ & FOTO 3X4 */}
          {activeTab === 'dados' && (
            <form onSubmit={handleSalvarDados}>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                
                {/* Upload Foto 3x4 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', minWidth: '160px' }}>
                  <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Foto 3x4 do Crachá</label>
                  <div style={{
                    width: '120px',
                    height: '150px',
                    borderRadius: '8px',
                    border: '2px dashed var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: 'rgba(0,0,0,0.02)',
                    position: 'relative'
                  }}>
                    {fotoUrl ? (
                      <img src={fotoUrl} alt={employee.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                        <span style={{ fontSize: '32px', display: 'block' }}>📸</span>
                        Sem foto
                      </div>
                    )}
                  </div>

                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleUploadFoto} 
                    style={{ display: 'none' }} 
                  />
                  
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      type="button" 
                      className="btn outline sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                    >
                      {isUploadingPhoto ? 'Enviando...' : '📷 Enviar Foto'}
                    </button>
                    {fotoUrl && (
                      <button 
                        type="button" 
                        className="btn ghost sm danger"
                        onClick={() => setFotoUrl('')}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>

                {/* Campos de texto */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '280px' }}>
                  <div className="form-group">
                    <label>Cargo / Função em Destaque *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: RETIFICADOR, MECÂNICO, TORNEIRO..."
                      value={cargo} 
                      onChange={e => setCargo(e.target.value)} 
                    />
                    <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                      Este cargo aparece no destaque azul da frente e no título do verso do crachá.
                    </small>
                  </div>

                  <div className="form-group">
                    <label>Número de Matrícula</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 0001"
                      value={matricula} 
                      onChange={e => setMatricula(e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>URL da Imagem (opcional / link direto)</label>
                    <input 
                      type="text" 
                      placeholder="https://..."
                      value={fotoUrl} 
                      onChange={e => setFotoUrl(e.target.value)} 
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button type="submit" className="btn primary" disabled={isSaving}>
                      {isSaving ? 'Salvando...' : 'Salvar Dados do Crachá'}
                    </button>
                  </div>
                </div>

              </div>
            </form>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.02)' }}>
          <button type="button" className="btn ghost" onClick={onClose}>Fechar</button>
        </div>

      </div>

      {/* ═══ ESTILOS DE IMPRESSÃO EXCLUSIVOS DO CRACHÁ (PVC 54x86 MM) ═══ */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .cracha-modal-wrapper,
          .cracha-preview-container,
          .cracha-preview-container * {
            visibility: visible !important;
          }
          .cracha-modal-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .modal-backdrop,
          .modal-header,
          .modal-footer,
          .btn,
          .cracha-modal-card > div:first-child,
          .cracha-modal-card > div:nth-child(2) {
            display: none !important;
          }
          .cracha-preview-container {
            display: flex !important;
            flex-direction: row !important;
            gap: 20mm !important;
            justifyContent: center !important;
            padding: 15mm 0 !important;
          }
          .cracha-card {
            width: 54mm !important;
            height: 86mm !important;
            border-radius: 3.18mm !important;
            border: 0.5px solid #cbd5e1 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

    </div>
  );
};

export default CrachaModal;
