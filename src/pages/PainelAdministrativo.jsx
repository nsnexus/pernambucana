import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../context/AuthContext';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc, where, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const CATEGORIES = {
  'Segurança': ['Aso', 'Treinamento', 'Documento normativo', 'Nr-01', 'DSS', 'Campanhas'],
  'Meio ambiente': ['Recolhimento de contaminado', 'Venda de sucatas', 'Documento normativo', 'Evidência do SAO', 'Evidencia AVCB'],
  'Administração': ['Efetivo', 'Licença de Funcionamento', 'Advertências', 'Folha de pagamento']
};

const PainelAdministrativo = ({ brand, onBackToGateway }) => {
  const { currentUser } = useAuth();
  
  const [activeCat, setActiveCat] = useState('Segurança');
  const [activeSub, setActiveSub] = useState(CATEGORIES['Segurança'][0]);
  
  // Data State
  const [arquivos, setArquivos] = useState([]);
  const [efetivos, setEfetivos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [efetivoModalOpen, setEfetivoModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // File Form State
  const [fileForm, setFileForm] = useState({ titulo: '', categoria: activeCat, subcategoria: activeSub, file: null, funcionarioId: '' });
  
  // Efetivo Form State
  const [efetivoForm, setEfetivoForm] = useState({ nome: '', dataNascimento: '', cpf: '', endereco: '', telefone: '', pix: '' });
  const [editingEfetivoId, setEditingEfetivoId] = useState(null);

  // Filters State
  const [filterName, setFilterName] = useState('');
  const [filterFunc, setFilterFunc] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Arquivos
      const qArq = query(collection(db, 'arquivos'), where('brand', '==', brand));
      const snapArq = await getDocs(qArq);
      const arrArq = [];
      snapArq.forEach(d => arrArq.push({ id: d.id, ...d.data() }));
      
      // Ordenar por data (mais recentes primeiro)
      arrArq.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setArquivos(arrArq);

      // 2. Fetch Efetivos
      const qEf = query(collection(db, 'efetivos'), where('brand', '==', brand));
      const snapEf = await getDocs(qEf);
      const arrEf = [];
      snapEf.forEach(d => arrEf.push({ id: d.id, ...d.data() }));
      
      arrEf.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setEfetivos(arrEf);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [brand]);

  // Handle Tab Switch
  const handleCatSwitch = (cat) => {
    setActiveCat(cat);
    setActiveSub(CATEGORIES[cat][0]);
    setFilterName('');
    setFilterFunc('');
    setFilterDate('');
  };

  // ═══ EFETIVO ACTIONS ═══
  const handleSaveEfetivo = async (e) => {
    e.preventDefault();
    try {
      if (editingEfetivoId) {
        await updateDoc(doc(db, 'efetivos', editingEfetivoId), {
          ...efetivoForm
        });
        alert('Funcionário atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'efetivos'), {
          ...efetivoForm,
          brand,
          createdBy: currentUser?.email,
          createdAt: serverTimestamp()
        });
        alert('Funcionário cadastrado com sucesso!');
      }
      setEfetivoForm({ nome: '', dataNascimento: '', cpf: '', endereco: '', telefone: '', pix: '' });
      setEditingEfetivoId(null);
      setEfetivoModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Erro ao salvar efetivo:", err);
      alert("Erro ao salvar funcionário.");
    }
  };

  const handleDeleteEfetivo = async (id, nome) => {
    if (!window.confirm(`Tem certeza que deseja excluir o funcionário ${nome}?`)) return;
    try {
      await deleteDoc(doc(db, 'efetivos', id));
      fetchData();
    } catch (err) {
      console.error("Erro:", err);
    }
  };

  const handleEditEfetivo = (ef) => {
    setEfetivoForm({
      nome: ef.nome || '',
      dataNascimento: ef.dataNascimento || '',
      cpf: ef.cpf || '',
      endereco: ef.endereco || '',
      telefone: ef.telefone || '',
      pix: ef.pix || ''
    });
    setEditingEfetivoId(ef.id);
    setEfetivoModalOpen(true);
  };

  // ═══ FILE ACTIONS ═══
  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFileForm({ ...fileForm, file: e.target.files[0] });
    }
  };

  const handleSaveFile = async (e) => {
    e.preventDefault();
    if (!fileForm.titulo || !fileForm.file) {
      alert("Preencha o título e selecione um arquivo.");
      return;
    }

    try {
      setIsUploading(true);
      const file = fileForm.file;
      const subPath = fileForm.subcategoria ? `/${fileForm.subcategoria}` : '';
      const filePath = `arquivos_v2/${brand}/${fileForm.categoria}${subPath}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, filePath);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, 'arquivos'), {
        titulo: fileForm.titulo,
        categoria: fileForm.categoria,
        subcategoria: fileForm.subcategoria,
        fileName: file.name,
        filePath: filePath,
        fileUrl: downloadURL,
        funcionarioId: fileForm.funcionarioId || null,
        brand,
        uploadedBy: currentUser?.email || 'Desconhecido',
        createdAt: serverTimestamp()
      });

      setFileModalOpen(false);
      setFileForm({ titulo: '', categoria: activeCat, subcategoria: activeSub, file: null, funcionarioId: '' });
      fetchData();
      alert('Arquivo cadastrado com sucesso!');
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      alert('Erro ao enviar o arquivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (arquivo) => {
    if (!window.confirm(`Tem certeza que deseja excluir o arquivo: ${arquivo.titulo}?`)) return;
    try {
      if (arquivo.filePath) {
        const fileRef = ref(storage, arquivo.filePath);
        await deleteObject(fileRef).catch(err => console.warn("Arquivo não encontrado no storage, mas será removido do banco."));
      }
      await deleteDoc(doc(db, 'arquivos', arquivo.id));
      fetchData();
    } catch (err) {
      console.error("Erro:", err);
    }
  };

  // ═══ RENDERERS ═══
  const isEfetivoTab = activeCat === 'Administração' && activeSub === 'Efetivo';
  
  const filteredArquivos = arquivos.filter(a => {
    if (a.categoria !== activeCat || a.subcategoria !== activeSub) return false;
    
    if (filterName && !a.titulo?.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterFunc && a.funcionarioId !== filterFunc) return false;
    if (filterDate) {
      if (!a.createdAt) return false;
      const dateObj = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      if (`${yyyy}-${mm}` !== filterDate) return false;
    }
    
    return true;
  });

  return (
    <div className="painel-layout" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Fake TopNav just for back button and structure, or we can build a simple header */}
      <header className="portal-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', background: 'var(--card)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src={brand === 'autogeral' ? '/assets/logo-autogeral.jpg' : '/assets/logo-pernambucana.jpg'} alt={brand} style={{ height: '40px', borderRadius: brand === 'autogeral' ? '8px' : '0', background: brand === 'autogeral' ? '#000' : 'transparent' }} />
          <h2 style={{ fontSize: '18px', margin: 0 }}>Painel Administrativo & Gestão de Arquivos</h2>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn ghost" onClick={onBackToGateway} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            🔄 Trocar Painel
          </button>
        </div>
      </header>

      <main className="main" style={{ padding: '24px' }}>
        
        {/* TAB NAVIGATION MAIN */}
        <div className="tab-nav" style={{ marginBottom: '0' }}>
          {Object.keys(CATEGORIES).map(cat => (
            <button key={cat} className={`tab-btn ${activeCat === cat ? 'active' : ''}`} onClick={() => handleCatSwitch(cat)}>
              {cat === 'Segurança' ? '🛡️ Segurança' : cat === 'Meio ambiente' ? '🌱 Meio Ambiente' : '🏢 Administração'}
            </button>
          ))}
        </div>

        {/* SUB NAVIGATION */}
        <div className="ag-filters glass" style={{ borderRadius: '0 0 16px 16px', padding: '12px 20px', marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {CATEGORIES[activeCat].map(sub => (
            <button 
              key={sub} 
              className={`btn ${activeSub === sub ? 'primary' : 'ghost'}`}
              style={activeSub === sub ? { fontWeight: 'bold', transform: 'scale(1.05)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } : {}}
              onClick={() => setActiveSub(sub)}
            >
              {sub}
            </button>
          ))}
        </div>

        {/* CONTENT AREA */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Carregando dados...</div>
        ) : isEfetivoTab ? (
          // --- TABELA EFETIVO ---
          <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
            <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3>Gestão de Efetivo (Funcionários)</h3>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Gerencie a lista de funcionários ativos da {brand === 'autogeral' ? 'Auto Geral' : 'Pernambucana'}.</p>
              </div>
              <button className="btn primary" onClick={() => {
                setEfetivoForm({ nome: '', dataNascimento: '', cpf: '', endereco: '', telefone: '', pix: '' });
                setEditingEfetivoId(null);
                setEfetivoModalOpen(true);
              }}>+ Novo Funcionário</button>
            </div>
            
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>Nascimento</th>
                    <th>Telefone</th>
                    <th>Chave PIX</th>
                    <th>Endereço</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {efetivos.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>Nenhum funcionário cadastrado.</td></tr>
                  ) : efetivos.map(ef => (
                    <tr key={ef.id}>
                      <td><strong>{ef.nome}</strong></td>
                      <td>{ef.cpf}</td>
                      <td>{ef.dataNascimento ? ef.dataNascimento.split('-').reverse().join('/') : '-'}</td>
                      <td>{ef.telefone}</td>
                      <td>{ef.pix}</td>
                      <td>{ef.endereco}</td>
                      <td>
                        <button className="btn mini" style={{ marginRight: '6px' }} onClick={() => handleEditEfetivo(ef)}>Editar</button>
                        <button className="btn mini bad" onClick={() => handleDeleteEfetivo(ef.id, ef.nome)}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          // --- TABELA ARQUIVOS ---
          <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
            <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3>{activeSub}</h3>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Arquivos e documentos da categoria {activeCat}.</p>
              </div>
              <button className="btn primary" onClick={() => {
                setFileForm({ ...fileForm, categoria: activeCat, subcategoria: activeSub, file: null });
                setFileModalOpen(true);
              }}>+ Novo Arquivo</button>
            </div>

            <div className="filters-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Filtrar por título/nome..." value={filterName} onChange={e => setFilterName(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }} />
              {['Aso', 'Advertências', 'Folha de pagamento'].includes(activeSub) && (
                <select value={filterFunc} onChange={e => setFilterFunc(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }}>
                  <option value="">Todos os Funcionários</option>
                  {efetivos.map(ef => <option key={ef.id} value={ef.id}>{ef.nome}</option>)}
                </select>
              )}
              {['Folha de pagamento', 'Advertências'].includes(activeSub) && (
                <input type="month" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }} />
              )}
            </div>


            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Título</th>
                    {['Aso', 'Advertências', 'Folha de pagamento'].includes(activeSub) && <th>Funcionário Vinculado</th>}
                    <th>Enviado por</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArquivos.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>Nenhum arquivo encontrado para {activeSub}.</td></tr>
                  ) : filteredArquivos.map(arq => {
                    const func = arq.funcionarioId ? efetivos.find(e => e.id === arq.funcionarioId) : null;
                    return (
                      <tr key={arq.id}>
                        <td><strong>{arq.titulo}</strong></td>
                        {['Aso', 'Advertências', 'Folha de pagamento'].includes(activeSub) && (
                          <td>{func ? func.nome : <span style={{ color: 'var(--muted)' }}>Não vinculado</span>}</td>
                        )}
                        <td>{arq.uploadedBy}</td>
                        <td>{arq.createdAt?.toDate ? new Date(arq.createdAt.toDate()).toLocaleDateString() : 'Recente'}</td>
                        <td>
                          <a href={arq.fileUrl} target="_blank" rel="noopener noreferrer" className="btn mini ghost" style={{ marginRight: '6px', textDecoration: 'none', display: 'inline-block' }}>Visualizar</a>
                          <button className="btn mini bad" onClick={() => handleDeleteFile(arq)}>Excluir</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* ═══ MODAL EFETIVO ═══ */}
      {efetivoModalOpen && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setEfetivoModalOpen(false)}></div>
          <form className="modal-form-card glass" onSubmit={handleSaveEfetivo} style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>Novo Funcionário (Efetivo)</h3>
              <button className="close" type="button" onClick={() => setEfetivoModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nome Completo *</label>
                <input type="text" required value={efetivoForm.nome} onChange={e => setEfetivoForm({...efetivoForm, nome: e.target.value})} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Data de Nascimento</label>
                  <input type="date" value={efetivoForm.dataNascimento} onChange={e => setEfetivoForm({...efetivoForm, dataNascimento: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>CPF</label>
                  <input type="text" placeholder="000.000.000-00" value={efetivoForm.cpf} onChange={e => setEfetivoForm({...efetivoForm, cpf: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Telefone / WhatsApp</label>
                  <input type="text" value={efetivoForm.telefone} onChange={e => setEfetivoForm({...efetivoForm, telefone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Chave PIX</label>
                  <input type="text" value={efetivoForm.pix} onChange={e => setEfetivoForm({...efetivoForm, pix: e.target.value})} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Endereço Completo</label>
                <input type="text" value={efetivoForm.endereco} onChange={e => setEfetivoForm({...efetivoForm, endereco: e.target.value})} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" type="button" onClick={() => setEfetivoModalOpen(false)}>Cancelar</button>
              <button className="btn primary" type="submit">Cadastrar</button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ MODAL ARQUIVO ═══ */}
      {fileModalOpen && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setFileModalOpen(false)}></div>
          <form className="modal-form-card glass" onSubmit={handleSaveFile} style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>Novo Arquivo: {fileForm.subcategoria}</h3>
              <button className="close" type="button" onClick={() => setFileModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Título do Documento *</label>
                <input type="text" required placeholder="Ex: ASO Retorno ao Trabalho" value={fileForm.titulo} onChange={e => setFileForm({...fileForm, titulo: e.target.value})} />
              </div>
              
              {['Aso', 'Advertências', 'Folha de pagamento'].includes(fileForm.subcategoria) && (
                <div className="form-group">
                  <label>Vincular a Funcionário (Opcional)</label>
                  <select value={fileForm.funcionarioId} onChange={e => setFileForm({...fileForm, funcionarioId: e.target.value})}>
                    <option value="">-- Não vincular --</option>
                    {efetivos.map(ef => <option key={ef.id} value={ef.id}>{ef.nome}</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Selecione o Arquivo (PDF, Imagem, etc) *</label>
                <input type="file" required onChange={handleFileChange} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" type="button" onClick={() => setFileModalOpen(false)}>Cancelar</button>
              <button className="btn primary" type="submit" disabled={isUploading}>
                {isUploading ? 'Enviando...' : 'Salvar Arquivo'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PainelAdministrativo;
