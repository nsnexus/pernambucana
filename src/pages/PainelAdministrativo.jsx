import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../context/AuthContext';
import { IconEdit, IconTrash, IconEye, IconPlus, IconRefresh, IconShield, IconLeaf, IconBuilding, IconCalendar } from '../components/Icons';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc, where, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

function addYearToDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return '';
  const year = parseInt(parts[0], 10) + 1;
  return `${year}-${parts[1]}-${parts[2]}`;
}

const CATEGORIES = {
  'Segurança': ['Aso', 'Aso Demissional', 'Inspeções', 'Treinamento', 'Documento normativo', 'Nr-01', 'DSS', 'Campanhas'],
  'Meio ambiente': ['Recolhimento de contaminado', 'Venda de sucatas', 'Documento normativo', 'Evidência do SAO', 'Evidência AVCB'],
  'Administração': ['Efetivo', 'Férias', 'Licença de Funcionamento', 'Advertências', 'Folha de pagamento']
};

const PainelAdministrativo = ({ brand, onBackToGateway }) => {
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
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyFunc, setHistoryFunc] = useState(null);

  // File Form State
  const [fileForm, setFileForm] = useState({ 
    titulo: '', 
    categoria: activeCat, 
    subcategoria: activeSub, 
    file: null, 
    funcionarioId: '', 
    dataVencimento: '',
    tipoAso: 'Admissional',
    dataExame: '',
    mesAnoRef: ''
  });
  const [editingFileId, setEditingFileId] = useState(null);
  
  // Efetivo Form State
  const [efetivoForm, setEfetivoForm] = useState({ 
    nome: '', dataNascimento: '', cpf: '', endereco: '', telefone: '', pix: '', dataAdmissao: '', status: 'Ativo' 
  });
  const [editingEfetivoId, setEditingEfetivoId] = useState(null);

  // Ferias Form State
  const [feriasForm, setFeriasForm] = useState({ efetivoId: '', status: 'Programada', dataInicio: '', dataFim: '' });
  const [feriasModalOpen, setFeriasModalOpen] = useState(false);

  // Filters State
  const [filterName, setFilterName] = useState('');
  const [filterFunc, setFilterFunc] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [statusFilterEfetivo, setStatusFilterEfetivo] = useState('Todos');

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

      // 2. Fetch Efetivos (Funcionários)
      const qEf = query(collection(db, 'efetivos'), where('brand', '==', brand));
      const snapEf = await getDocs(qEf);
      const arrEf = [];
      snapEf.forEach(d => arrEf.push({ id: d.id, ...d.data() }));
      
      arrEf.sort((a, b) => a.nome.localeCompare(b.nome));
      setEfetivos(arrEf);
    } catch (err) {
      console.error("Erro ao buscar dados do Firestore:", err);
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
          ...efetivoForm,
          status: efetivoForm.status || 'Ativo'
        });
        alert('Funcionário atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'efetivos'), {
          ...efetivoForm,
          status: efetivoForm.status || 'Ativo',
          dataBaseFerias: efetivoForm.dataAdmissao || '',
          brand,
          createdBy: currentUser?.email,
          createdAt: serverTimestamp()
        });
        alert('Funcionário cadastrado com sucesso!');
      }
      setEfetivoForm({ nome: '', dataNascimento: '', cpf: '', endereco: '', telefone: '', pix: '', dataAdmissao: '', status: 'Ativo' });
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
      pix: ef.pix || '',
      dataAdmissao: ef.dataAdmissao || '',
      status: ef.status || 'Ativo'
    });
    setEditingEfetivoId(ef.id);
    setEfetivoModalOpen(true);
  };

  const handleSaveFerias = async (e) => {
    e.preventDefault();
    try {
      if (!feriasForm.dataInicio || !feriasForm.dataFim) {
        alert("Preencha as datas de início e fim das férias.");
        return;
      }
      const updateData = {
        feriasInicio: feriasForm.dataInicio,
        feriasFim: feriasForm.dataFim,
        feriasStatus: feriasForm.status
      };
      if (feriasForm.status === 'Gozada') {
        updateData.dataBaseFerias = feriasForm.dataFim;
      }
      await updateDoc(doc(db, 'efetivos', feriasForm.efetivoId), updateData);
      
      setFeriasModalOpen(false);
      fetchData();
      alert('Férias registradas com sucesso!');
    } catch (err) {
      console.error("Erro ao registrar férias:", err);
      alert("Erro ao registrar férias.");
    }
  };

  // ═══ FILE ACTIONS ═══
  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFileForm({ ...fileForm, file: e.target.files[0] });
    }
  };

  const handleEditFile = (arq) => {
    setEditingFileId(arq.id);
    setFileForm({
      titulo: arq.titulo || '',
      categoria: arq.categoria,
      subcategoria: arq.subcategoria,
      file: null,
      funcionarioId: arq.funcionarioId || '',
      dataVencimento: arq.dataVencimento || '',
      tipoAso: arq.tipoAso || (arq.subcategoria === 'Aso Demissional' ? 'Demissional' : 'Admissional'),
      dataExame: arq.dataExame || '',
      mesAnoRef: arq.mesAnoRef || ''
    });
    setFileModalOpen(true);
  };

  const handleSaveFile = async (e) => {
    e.preventDefault();

    const isAso = ['Aso', 'Aso Demissional'].includes(fileForm.subcategoria);
    const isInspecao = fileForm.subcategoria === 'Inspeções';
    let calculatedTitle = fileForm.titulo;

    if (isAso) {
      if (!fileForm.funcionarioId) {
        alert("Selecione um funcionário para vincular o ASO.");
        return;
      }
      const funcObj = efetivos.find(ef => ef.id === fileForm.funcionarioId);
      const funcName = funcObj ? funcObj.nome : '';
      const actualTipoAso = fileForm.subcategoria === 'Aso Demissional' ? 'Demissional' : fileForm.tipoAso;
      calculatedTitle = `ASO ${actualTipoAso} - ${funcName}`;

      if (actualTipoAso === 'Demissional' && funcObj && funcObj.status !== 'Desligado') {
        const confirmDesligar = window.confirm(`Você está cadastrando um ASO Demissional para o colaborador "${funcName}". Deseja alterar o status do colaborador para "Desligado"?`);
        if (confirmDesligar) {
          try {
            await updateDoc(doc(db, 'efetivos', funcObj.id), { status: 'Desligado' });
          } catch (err) {
            console.error("Erro ao atualizar status do colaborador:", err);
          }
        }
      }
    } else if (isInspecao) {
      if (!fileForm.mesAnoRef) {
        alert("Informe o Mês/Ano de Referência da inspeção.");
        return;
      }
      calculatedTitle = `Inspeção - ${fileForm.mesAnoRef}`;
    } else {
      if (!fileForm.titulo) {
        alert("Preencha o título.");
        return;
      }
    }

    if (!editingFileId && !fileForm.file) {
      alert("Selecione um arquivo para cadastrar.");
      return;
    }

    try {
      setIsUploading(true);
      let newFileUrl = null;
      let newFilePath = null;
      let newFileName = null;

      if (fileForm.file) {
        const file = fileForm.file;
        const subPath = fileForm.subcategoria ? `/${fileForm.subcategoria}` : '';
        newFilePath = `arquivos_v2/${brand}/${fileForm.categoria}${subPath}/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, newFilePath);
        const snapshot = await uploadBytes(fileRef, file);
        newFileUrl = await getDownloadURL(snapshot.ref);
        newFileName = file.name;
      }

      const actualTipoAso = isAso ? (fileForm.subcategoria === 'Aso Demissional' ? 'Demissional' : fileForm.tipoAso) : null;

      if (editingFileId) {
        const updateData = {
          titulo: calculatedTitle,
          funcionarioId: fileForm.funcionarioId || null,
          tipoAso: actualTipoAso,
          dataExame: isAso ? (fileForm.dataExame || null) : null,
          dataVencimento: isAso ? (fileForm.dataVencimento || null) : null,
          mesAnoRef: isInspecao ? (fileForm.mesAnoRef || null) : null
        };
        
        if (newFileUrl) {
          updateData.fileUrl = newFileUrl;
          updateData.filePath = newFilePath;
          updateData.fileName = newFileName;
        }

        await updateDoc(doc(db, 'arquivos', editingFileId), updateData);
        alert('Arquivo atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'arquivos'), {
          titulo: calculatedTitle,
          categoria: fileForm.categoria,
          subcategoria: fileForm.subcategoria,
          fileName: newFileName,
          filePath: newFilePath,
          fileUrl: newFileUrl,
          funcionarioId: fileForm.funcionarioId || null,
          tipoAso: actualTipoAso,
          dataExame: isAso ? (fileForm.dataExame || null) : null,
          dataVencimento: isAso ? (fileForm.dataVencimento || null) : null,
          mesAnoRef: isInspecao ? (fileForm.mesAnoRef || null) : null,
          brand,
          uploadedBy: currentUser?.email || 'Desconhecido',
          createdAt: serverTimestamp()
        });
        alert('Arquivo cadastrado com sucesso!');
      }

      setFileModalOpen(false);
      setFileForm({ 
        titulo: '', categoria: activeCat, subcategoria: activeSub, file: null, funcionarioId: '', 
        dataVencimento: '', tipoAso: 'Admissional', dataExame: '', mesAnoRef: '' 
      });
      setEditingFileId(null);
      fetchData();
    } catch (error) {
      console.error("Erro ao salvar arquivo:", error);
      alert('Erro ao salvar o arquivo.');
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
  const isFeriasTab = activeCat === 'Administração' && activeSub === 'Férias';
  
  const filteredFerias = efetivos.filter(ef => {
    if (filterName && !ef.nome?.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterDate) {
      const baseDate = ef.dataBaseFerias ? new Date(ef.dataBaseFerias + 'T00:00:00') : null;
      if (!baseDate) return false;
      const limitDate = new Date(baseDate);
      limitDate.setFullYear(limitDate.getFullYear() + 2);
      const yyyy = limitDate.getFullYear();
      const mm = String(limitDate.getMonth() + 1).padStart(2, '0');
      if (`${yyyy}-${mm}` !== filterDate) return false;
    }
    return true;
  });

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
      <header className="topnav">
        <div className="topnav-inner">
          <Link to="/" className="topnav-brand">
            <img 
              src={brand === 'autogeral' ? '/assets/logo-autogeral.jpg' : '/assets/logo-pernambucana.jpg'} 
              alt={brand} 
              style={{ height: '36px', borderRadius: brand === 'autogeral' ? '8px' : '0', background: brand === 'autogeral' ? '#000' : 'transparent' }} 
            />
            <div>
              <strong>{brand === 'autogeral' ? 'Auto Geral' : 'Pernambucana'}</strong>
              <span>Gestão de Arquivos</span>
            </div>
          </Link>

          <div className="topnav-right">
            {!currentUser?.isDocumentsOnly && onBackToGateway && (
              <button 
                className="btn outline sm" 
                onClick={onBackToGateway}
                title="Alternar entre Painel Financeiro e Administrativo"
                type="button"
              >
                <IconRefresh /> Trocar Painel
              </button>
            )}

            <Link to="/" className="topnav-link">↗ Portal</Link>

            <button className="topnav-logout" onClick={handleLogout} type="button">
              Sair
            </button>
          </div>
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
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Gerencie a lista de funcionários da {brand === 'autogeral' ? 'Auto Geral' : 'Pernambucana'}.</p>
              </div>
              <button className="btn primary sm" onClick={() => {
                setEfetivoForm({ nome: '', dataNascimento: '', cpf: '', endereco: '', telefone: '', pix: '', dataAdmissao: '', status: 'Ativo' });
                setEditingEfetivoId(null);
                setEfetivoModalOpen(true);
              }}><IconPlus /> Novo Funcionário</button>
            </div>

            <div className="filters-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Buscar funcionário por nome..." value={filterName} onChange={e => setFilterName(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }} />
              <select value={statusFilterEfetivo} onChange={e => setStatusFilterEfetivo(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', minWidth: '160px' }}>
                <option value="Todos">Todos os Status</option>
                <option value="Ativo">Ativos</option>
                <option value="Desligado">Desligados</option>
              </select>
            </div>
            
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Status</th>
                    <th>CPF</th>
                    <th>Nascimento</th>
                    <th>Admissão</th>
                    <th>Telefone</th>
                    <th>Chave PIX</th>
                    <th>Endereço</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {efetivos.filter(ef => {
                    if (filterName && !ef.nome?.toLowerCase().includes(filterName.toLowerCase())) return false;
                    if (statusFilterEfetivo !== 'Todos' && (ef.status || 'Ativo') !== statusFilterEfetivo) return false;
                    return true;
                  }).length === 0 ? (
                    <tr><td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>Nenhum funcionário encontrado.</td></tr>
                  ) : efetivos.filter(ef => {
                    if (filterName && !ef.nome?.toLowerCase().includes(filterName.toLowerCase())) return false;
                    if (statusFilterEfetivo !== 'Todos' && (ef.status || 'Ativo') !== statusFilterEfetivo) return false;
                    return true;
                  }).map(ef => {
                    const isDesligado = ef.status === 'Desligado';
                    return (
                      <tr key={ef.id} style={isDesligado ? { opacity: 0.7 } : {}}>
                        <td><strong>{ef.nome}</strong></td>
                        <td>
                          <span style={{ 
                            padding: '3px 8px', 
                            borderRadius: '4px', 
                            fontSize: '11px', 
                            fontWeight: 'bold',
                            background: isDesligado ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: isDesligado ? '#ef4444' : '#22c55e'
                          }}>
                            {ef.status || 'Ativo'}
                          </span>
                        </td>
                        <td>{ef.cpf || '-'}</td>
                        <td>{ef.dataNascimento ? ef.dataNascimento.split('-').reverse().join('/') : '-'}</td>
                        <td>{ef.dataAdmissao ? ef.dataAdmissao.split('-').reverse().join('/') : '-'}</td>
                        <td>{ef.telefone || '-'}</td>
                        <td>{ef.pix || '-'}</td>
                        <td>{ef.endereco || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn icon-only edit" title="Editar Funcionário" onClick={() => handleEditEfetivo(ef)}>
                              <IconEdit />
                            </button>
                            <button className="btn icon-only danger" title="Excluir Funcionário" onClick={() => handleDeleteEfetivo(ef.id, ef.nome)}>
                              <IconTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : activeCat === 'Segurança' && activeSub === 'Aso' ? (
          // --- TABELA CONSOLIDADA DE ASO POR FUNCIONÁRIO ---
          <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
            <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3>Gestão de ASO (Atestado de Saúde Ocupacional)</h3>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Acompanhe os ASOs Admissional e Periódico de todos os colaboradores.</p>
              </div>
              <button className="btn primary sm" onClick={() => {
                setEditingFileId(null);
                setFileForm({ titulo: '', categoria: 'Segurança', subcategoria: 'Aso', file: null, funcionarioId: '', dataVencimento: '', tipoAso: 'Admissional', dataExame: '', mesAnoRef: '' });
                setFileModalOpen(true);
              }}><IconPlus /> Novo ASO</button>
            </div>

            <div className="filters-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Filtrar por nome do colaborador..." value={filterName} onChange={e => setFilterName(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }} />
              <select value={statusFilterEfetivo} onChange={e => setStatusFilterEfetivo(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', minWidth: '160px' }}>
                <option value="Todos">Todos os Colaboradores</option>
                <option value="Ativo">Apenas Ativos</option>
                <option value="Desligado">Apenas Desligados</option>
              </select>
            </div>

            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Funcionário</th>
                    <th>ASO Admissional</th>
                    <th>ASO Periódico (Mais Recente)</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {efetivos.filter(ef => {
                    if (filterName && !ef.nome?.toLowerCase().includes(filterName.toLowerCase())) return false;
                    if (statusFilterEfetivo !== 'Todos' && (ef.status || 'Ativo') !== statusFilterEfetivo) return false;
                    return true;
                  }).length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>Nenhum funcionário encontrado.</td></tr>
                  ) : efetivos.filter(ef => {
                    if (filterName && !ef.nome?.toLowerCase().includes(filterName.toLowerCase())) return false;
                    if (statusFilterEfetivo !== 'Todos' && (ef.status || 'Ativo') !== statusFilterEfetivo) return false;
                    return true;
                  }).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(ef => {
                    const funcArquivos = arquivos.filter(a => a.funcionarioId === ef.id);
                    const admissional = funcArquivos.find(a => a.tipoAso === 'Admissional' || a.titulo?.toLowerCase().includes('admissional'));
                    const periodicos = funcArquivos.filter(a => a.tipoAso === 'Periódico' || a.titulo?.toLowerCase().includes('periódico') || a.titulo?.toLowerCase().includes('periodico'))
                      .sort((a, b) => {
                        const dateA = a.dataExame || (a.createdAt?.toDate ? a.createdAt.toDate().toISOString() : '');
                        const dateB = b.dataExame || (b.createdAt?.toDate ? b.createdAt.toDate().toISOString() : '');
                        return dateB.localeCompare(dateA);
                      });
                    const latestPeriodico = periodicos[0];
                    const isDesligado = ef.status === 'Desligado';

                    const renderAsoCell = (arq) => {
                      if (!arq) return <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Não cadastrado</span>;
                      const exDate = arq.dataExame ? new Date(arq.dataExame + 'T00:00:00') : null;
                      const vDate = arq.dataVencimento ? new Date(arq.dataVencimento + 'T00:00:00') : null;
                      let statusBadge = null;
                      if (vDate) {
                        const diffTime = vDate - new Date();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays < 0) {
                          statusBadge = { color: 'var(--red)', bg: 'rgba(244, 63, 94, 0.1)', text: 'Vencido' };
                        } else if (diffDays <= 30) {
                          statusBadge = { color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', text: `Faltam ${diffDays}d` };
                        } else {
                          statusBadge = { color: 'var(--green)', bg: 'rgba(34, 197, 94, 0.1)', text: 'No prazo' };
                        }
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px' }}>
                              {exDate ? `Exame: ${exDate.toLocaleDateString('pt-BR')}` : ''}
                              {vDate ? ` (Venc: ${vDate.toLocaleDateString('pt-BR')})` : ''}
                            </span>
                            {statusBadge && (
                              <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', background: statusBadge.bg, color: statusBadge.color, fontWeight: 'bold' }}>
                                {statusBadge.text}
                              </span>
                            )}
                            {arq.fileUrl && (
                              <a href={arq.fileUrl} target="_blank" rel="noopener noreferrer" className="btn icon-only sm" title="Visualizar Documento">
                                <IconEye />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <tr key={ef.id} style={isDesligado ? { opacity: 0.7 } : {}}>
                        <td>
                          <strong>{ef.nome}</strong>
                          <span style={{ 
                            marginLeft: '8px',
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '10px', 
                            fontWeight: 'bold',
                            background: isDesligado ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: isDesligado ? '#ef4444' : '#22c55e'
                          }}>
                            {ef.status || 'Ativo'}
                          </span>
                        </td>
                        <td>{renderAsoCell(admissional)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {renderAsoCell(latestPeriodico)}
                            {periodicos.length > 1 && (
                              <button 
                                className="btn outline sm" 
                                style={{ fontSize: '11px', padding: '2px 8px', whiteSpace: 'nowrap' }} 
                                onClick={() => { setHistoryFunc({ ef, files: periodicos }); setHistoryModalOpen(true); }}
                              >
                                Ver Histórico ({periodicos.length})
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <button 
                            className="btn primary sm" 
                            onClick={() => {
                              setEditingFileId(null);
                              setFileForm({ titulo: '', categoria: 'Segurança', subcategoria: 'Aso', file: null, funcionarioId: ef.id, dataVencimento: '', tipoAso: 'Periódico', dataExame: '', mesAnoRef: '' });
                              setFileModalOpen(true);
                            }}
                          >
                            <IconPlus /> Lançar ASO
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : isFeriasTab ? (
          // --- TABELA DE FÉRIAS ---
          <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
            <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3>Controle de Férias</h3>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Acompanhe o vencimento de férias e registre os descansos gozados.</p>
              </div>
            </div>

            <div className="filters-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Buscar funcionário..." value={filterName} onChange={e => setFilterName(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }} />
              <input type="month" placeholder="Mês/Ano do Vencimento" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }} title="Filtrar por Mês/Ano de Vencimento Limite" />
            </div>

            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Data Base (Admissão / Férias)</th>
                    <th>Período de Férias (Início — Fim)</th>
                    <th>Vencimento Limite (2 anos)</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFerias.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>Nenhum funcionário encontrado.</td></tr>
                  ) : filteredFerias.map(ef => {
                    const rawBase = ef.dataBaseFerias || ef.dataAdmissao;
                    const baseDate = rawBase ? new Date(rawBase + 'T00:00:00') : null;
                    let feriasLabel = '-';
                    let feriasStatus = null;
                    if (baseDate) {
                      const limitDate = new Date(baseDate);
                      limitDate.setFullYear(limitDate.getFullYear() + 2);
                      const now = new Date();
                      const diffTime = limitDate - now;
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      
                      if (diffDays < 0) {
                        feriasStatus = { color: 'var(--red)', bg: 'rgba(244, 63, 94, 0.1)', text: 'Vencidas' };
                      } else if (diffDays <= 60) {
                        feriasStatus = { color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', text: `Faltam ${diffDays}d` };
                      } else {
                        feriasStatus = { color: 'var(--green)', bg: 'rgba(34, 197, 94, 0.1)', text: 'Ok' };
                      }
                      
                      feriasLabel = (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{limitDate.toLocaleDateString('pt-BR')}</span>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', background: feriasStatus.bg, color: feriasStatus.color, fontWeight: 'bold' }}>{feriasStatus.text}</span>
                        </div>
                      );
                    }

                    const feriasPeriodo = (ef.feriasInicio && ef.feriasFim) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{new Date(ef.feriasInicio + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(ef.feriasFim + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        <span style={{ 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontSize: '10px', 
                          fontWeight: 'bold',
                          background: ef.feriasStatus === 'Gozada' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                          color: ef.feriasStatus === 'Gozada' ? '#22c55e' : '#eab308'
                        }}>
                          {ef.feriasStatus || 'Programada'}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Não lançado</span>
                    );

                    return (
                      <tr key={ef.id}>
                        <td><strong>{ef.nome}</strong></td>
                        <td>{baseDate ? baseDate.toLocaleDateString('pt-BR') : '-'}</td>
                        <td>{feriasPeriodo}</td>
                        <td>{feriasLabel}</td>
                        <td>
                          <button className="btn warning sm" onClick={() => { setFeriasForm({ efetivoId: ef.id, status: ef.feriasStatus || 'Programada', dataInicio: ef.feriasInicio || '', dataFim: ef.feriasFim || '' }); setFeriasModalOpen(true); }}>
                            <IconCalendar /> Lançar Férias
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          // --- TABELA ARQUIVOS PADRÃO / INSPEÇÕES / ASO DEMISSIONAL ---
          <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
            <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3>{activeSub}</h3>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Arquivos e documentos da categoria {activeCat}.</p>
              </div>
              <button className="btn primary sm" onClick={() => {
                setEditingFileId(null);
                setFileForm({ 
                  titulo: '', categoria: activeCat, subcategoria: activeSub, file: null, funcionarioId: '', 
                  dataVencimento: '', tipoAso: activeSub === 'Aso Demissional' ? 'Demissional' : 'Admissional', dataExame: '', mesAnoRef: '' 
                });
                setFileModalOpen(true);
              }}><IconPlus /> Novo Arquivo</button>
            </div>

            <div className="filters-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Filtrar por título/nome..." value={filterName} onChange={e => setFilterName(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }} />
              {['Aso', 'Aso Demissional', 'Advertências', 'Folha de pagamento'].includes(activeSub) && (
                <select value={filterFunc} onChange={e => setFilterFunc(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }}>
                  <option value="">Todos os Funcionários</option>
                  {efetivos.map(ef => <option key={ef.id} value={ef.id}>{ef.nome}</option>)}
                </select>
              )}
              {['Folha de pagamento', 'Advertências', 'Inspeções'].includes(activeSub) && (
                <input type="month" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }} />
              )}
            </div>

            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    {activeSub === 'Inspeções' ? <th>Mês/Ano Ref.</th> : <th>Título</th>}
                    {['Aso', 'Aso Demissional', 'Advertências', 'Folha de pagamento'].includes(activeSub) && <th>Funcionário Vinculado</th>}
                    {activeSub === 'Aso Demissional' && <th>Data do Exame</th>}
                    <th>Enviado por</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArquivos.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>Nenhum arquivo encontrado para {activeSub}.</td></tr>
                  ) : [...filteredArquivos].sort((a, b) => {
                    const funcA = a.funcionarioId ? efetivos.find(e => e.id === a.funcionarioId) : null;
                    const funcB = b.funcionarioId ? efetivos.find(e => e.id === b.funcionarioId) : null;
                    const nameA = funcA ? funcA.nome : (a.titulo || '');
                    const nameB = funcB ? funcB.nome : (b.titulo || '');
                    return nameA.localeCompare(nameB);
                  }).map(arq => {
                    const func = arq.funcionarioId ? efetivos.find(e => e.id === arq.funcionarioId) : null;
                    return (
                      <tr key={arq.id}>
                        <td><strong>{activeSub === 'Inspeções' ? (arq.mesAnoRef || arq.titulo) : arq.titulo}</strong></td>
                        {['Aso', 'Aso Demissional', 'Advertências', 'Folha de pagamento'].includes(activeSub) && (
                          <td>{func ? func.nome : <span style={{ color: 'var(--muted)' }}>Não vinculado</span>}</td>
                        )}
                        {activeSub === 'Aso Demissional' && (
                          <td>{arq.dataExame ? new Date(arq.dataExame + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                        )}
                        <td>{arq.uploadedBy}</td>
                        <td>{arq.createdAt?.toDate ? new Date(arq.createdAt.toDate()).toLocaleDateString() : 'Recente'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <a href={arq.fileUrl} target="_blank" rel="noopener noreferrer" className="btn icon-only" title="Visualizar Documento">
                              <IconEye />
                            </a>
                            <button className="btn icon-only edit" title="Editar Documento" onClick={() => handleEditFile(arq)}>
                              <IconEdit />
                            </button>
                            <button className="btn icon-only danger" title="Excluir Documento" onClick={() => handleDeleteFile(arq)}>
                              <IconTrash />
                            </button>
                          </div>
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
              <h3>{editingEfetivoId ? 'Editar Funcionário' : 'Novo Funcionário (Efetivo)'}</h3>
              <button className="close" type="button" onClick={() => setEfetivoModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nome Completo *</label>
                <input type="text" required value={efetivoForm.nome} onChange={e => setEfetivoForm({...efetivoForm, nome: e.target.value})} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Status do Colaborador *</label>
                  <select value={efetivoForm.status || 'Ativo'} onChange={e => setEfetivoForm({ ...efetivoForm, status: e.target.value })}>
                    <option value="Ativo">Ativo</option>
                    <option value="Desligado">Desligado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Data de Admissão *</label>
                  <input type="date" required value={efetivoForm.dataAdmissao || ''} onChange={e => setEfetivoForm({...efetivoForm, dataAdmissao: e.target.value})} />
                </div>
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
              <button className="btn primary" type="submit">{editingEfetivoId ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ MODAL ARQUIVO (DINÂMICO PARA ASO, INSPEÇÕES E DEMAIS) ═══ */}
      {fileModalOpen && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => { setFileModalOpen(false); setEditingFileId(null); }}></div>
          <form className="modal-form-card glass" onSubmit={handleSaveFile} style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>{editingFileId ? 'Editar Arquivo:' : 'Novo Arquivo:'} {fileForm.subcategoria}</h3>
              <button className="close" type="button" onClick={() => { setFileModalOpen(false); setEditingFileId(null); }}>×</button>
            </div>
            <div className="modal-body">
              {['Aso', 'Aso Demissional'].includes(fileForm.subcategoria) ? (
                <>
                  <div className="form-group">
                    <label>Tipo de ASO *</label>
                    <select 
                      value={fileForm.subcategoria === 'Aso Demissional' ? 'Demissional' : fileForm.tipoAso} 
                      disabled={fileForm.subcategoria === 'Aso Demissional'}
                      onChange={e => setFileForm({ ...fileForm, tipoAso: e.target.value })}
                    >
                      <option value="Admissional">Admissional</option>
                      <option value="Periódico">Periódico</option>
                      <option value="Demissional">Demissional</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Funcionário *</label>
                    <select required value={fileForm.funcionarioId} onChange={e => setFileForm({ ...fileForm, funcionarioId: e.target.value })}>
                      <option value="">-- Selecione o Funcionário --</option>
                      {efetivos.map(ef => (
                        <option key={ef.id} value={ef.id}>
                          {ef.nome} {ef.status === 'Desligado' ? '(Desligado)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Data do Exame *</label>
                      <input 
                        type="date" 
                        required 
                        value={fileForm.dataExame || ''} 
                        onChange={e => {
                          const d = e.target.value;
                          setFileForm(prev => ({ 
                            ...prev, 
                            dataExame: d, 
                            dataVencimento: d ? addYearToDate(d) : prev.dataVencimento 
                          }));
                        }} 
                      />
                    </div>
                    {fileForm.tipoAso !== 'Demissional' && fileForm.subcategoria !== 'Aso Demissional' && (
                      <div className="form-group">
                        <label>Data de Vencimento do ASO *</label>
                        <input 
                          type="date" 
                          required 
                          value={fileForm.dataVencimento || ''} 
                          onChange={e => setFileForm({ ...fileForm, dataVencimento: e.target.value })} 
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : fileForm.subcategoria === 'Inspeções' ? (
                <div className="form-group">
                  <label>Mês/Ano de Referência *</label>
                  <input 
                    type="month" 
                    required 
                    value={fileForm.mesAnoRef || ''} 
                    onChange={e => setFileForm({ ...fileForm, mesAnoRef: e.target.value })} 
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Título do Documento *</label>
                    <input type="text" required placeholder="Ex: Treinamento de Integração" value={fileForm.titulo} onChange={e => setFileForm({...fileForm, titulo: e.target.value})} />
                  </div>
                  
                  {['Advertências', 'Folha de pagamento'].includes(fileForm.subcategoria) && (
                    <div className="form-group">
                      <label>Vincular a Funcionário (Opcional)</label>
                      <select value={fileForm.funcionarioId} onChange={e => setFileForm({...fileForm, funcionarioId: e.target.value})}>
                        <option value="">-- Não vincular --</option>
                        {efetivos.map(ef => <option key={ef.id} value={ef.id}>{ef.nome}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Selecione o Arquivo (PDF, Imagem, etc) {!editingFileId ? '*' : '(Opcional se quiser manter o atual)'}</label>
                <input type="file" required={!editingFileId} onChange={handleFileChange} />
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

      {/* ═══ MODAL HISTÓRICO DE ASO PERIÓDICO ═══ */}
      {historyModalOpen && historyFunc && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setHistoryModalOpen(false)}></div>
          <div className="modal-form-card glass" style={{ zIndex: 10, maxWidth: '650px' }}>
            <div className="modal-header">
              <h3>Histórico de ASOs Periódicos — {historyFunc.ef.nome}</h3>
              <button className="close" type="button" onClick={() => setHistoryModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="table-wrap">
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Data do Exame</th>
                      <th>Data Vencimento</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyFunc.files.map(file => {
                      const exDate = file.dataExame ? new Date(file.dataExame + 'T00:00:00') : null;
                      const vDate = file.dataVencimento ? new Date(file.dataVencimento + 'T00:00:00') : null;
                      let statusObj = null;
                      if (vDate) {
                        const diffTime = vDate - new Date();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays < 0) statusObj = { color: 'var(--red)', bg: 'rgba(244, 63, 94, 0.1)', text: 'Vencido' };
                        else if (diffDays <= 30) statusObj = { color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', text: `Faltam ${diffDays}d` };
                        else statusObj = { color: 'var(--green)', bg: 'rgba(34, 197, 94, 0.1)', text: 'No prazo' };
                      }
                      return (
                        <tr key={file.id}>
                          <td>{exDate ? exDate.toLocaleDateString('pt-BR') : '-'}</td>
                          <td>{vDate ? vDate.toLocaleDateString('pt-BR') : '-'}</td>
                          <td>
                            {statusObj ? (
                              <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', background: statusObj.bg, color: statusObj.color, fontWeight: 'bold' }}>
                                {statusObj.text}
                              </span>
                            ) : '-'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {file.fileUrl && (
                                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="btn icon-only sm" title="Visualizar Documento">
                                  <IconEye />
                                </a>
                              )}
                              <button className="btn icon-only edit sm" title="Editar" onClick={() => { setHistoryModalOpen(false); handleEditFile(file); }}>
                                <IconEdit />
                              </button>
                              <button className="btn icon-only danger sm" title="Excluir" onClick={() => { handleDeleteFile(file); setHistoryModalOpen(false); }}>
                                <IconTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" type="button" onClick={() => setHistoryModalOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL FERIAS ═══ */}
      {feriasModalOpen && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setFeriasModalOpen(false)}></div>
          <form className="modal-form-card glass" onSubmit={handleSaveFerias} style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>Registrar Férias</h3>
              <button className="close" type="button" onClick={() => setFeriasModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Status das Férias</label>
                <select value={feriasForm.status} onChange={e => setFeriasForm({...feriasForm, status: e.target.value})}>
                  <option value="Programada">Programada (Apenas aviso)</option>
                  <option value="Gozada">Férias Gozadas (Concluída)</option>
                </select>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                  Nota: Marcar como <strong>Gozada</strong> redefinirá a contagem do prazo limite de 2 anos a partir da data informada abaixo.
                </p>
              </div>
              <div className="form-grid" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label>Data de Início das Férias *</label>
                  <input type="date" required value={feriasForm.dataInicio || ''} onChange={e => setFeriasForm({...feriasForm, dataInicio: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Data de Término das Férias *</label>
                  <input type="date" required value={feriasForm.dataFim || ''} onChange={e => setFeriasForm({...feriasForm, dataFim: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" type="button" onClick={() => setFeriasModalOpen(false)}>Cancelar</button>
              <button className="btn primary" type="submit">Salvar Férias</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PainelAdministrativo;
