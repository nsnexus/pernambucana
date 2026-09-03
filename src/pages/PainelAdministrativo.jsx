import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../context/AuthContext';
import { IconEdit, IconTrash, IconEye, IconPlus, IconRefresh, IconShield, IconLeaf, IconBuilding, IconCalendar } from '../components/Icons';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc, where, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { extractHoleritesFromPDF, calcHorasExtras } from '../utils/pdfParser';
import { generatePdfFromContainer } from '../utils/pdfGenerator';
import { exportFolhaPGXlsx } from '../utils/holeriteExport';
import ReciboPrint from '../components/ReciboPrint';
import FolhaCompletaTable from '../components/FolhaCompletaTable';

function addYearToDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return '';
  const year = parseInt(parts[0], 10) + 1;
  return `${year}-${parts[1]}-${parts[2]}`;
}

const CATEGORIES = {
  'Segurança': ['Aso', 'Aso Demissional', 'Inspeções', 'Treinamento', 'Documento normativo', 'Nr-01', 'DSS', 'Campanhas', 'Acidente do Trabalho'],
  'Meio ambiente': ['Recolhimento de contaminado', 'Venda de sucatas', 'Documento normativo', 'Evidência do SAO', 'Evidência AVCB'],
  'Administração': ['Efetivo', 'Férias', 'Licença de Funcionamento', 'Advertências', 'Folha de pagamento'],
  'Pagamentos': ['Holerites'],
  'Acessos': ['Usuários']
};

// Setores que podem ser liberados por usuário na aba Acessos
const SETORES_ACESSO = ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria', 'AltoGeral'];
const SETOR_LABELS = { Mecanica: 'Mecânica', 'Peças': 'Peças', Retifica: 'Retífica', Torneadora: 'Torneadora', Caldeiraria: 'Caldeiraria', AltoGeral: 'Auto Geral' };

// Normaliza os anexos de um registro. Registros antigos guardam um único
// arquivo em fileUrl/filePath/fileName; os novos guardam a lista em `anexos`.
const normalizeAnexos = (arq) => {
  if (Array.isArray(arq?.anexos) && arq.anexos.length) return arq.anexos;
  if (arq?.fileUrl) return [{ url: arq.fileUrl, path: arq.filePath || null, name: arq.fileName || 'arquivo' }];
  return [];
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
    files: [],
    anexosExistentes: [],
    funcionarioId: '',
    dataVencimento: '',
    tipoAso: 'Admissional',
    dataExame: '',
    mesAnoRef: '',
    valor: ''
  });
  const [editingFileId, setEditingFileId] = useState(null);
  
  // Efetivo Form State
  const [efetivoForm, setEfetivoForm] = useState({ 
    nome: '', dataNascimento: '', cpf: '', endereco: '', telefone: '', pix: '', dataAdmissao: '', dataDemissional: '', status: 'Ativo' 
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

  // Holerites State
  const [holeritesParsed, setHoleritesParsed] = useState([]);
  const [holeriteMesAnoRef, setHoleriteMesAnoRef] = useState('');
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [isSavingHolerites, setIsSavingHolerites] = useState(false);
  const [expandedHoleriteIndex, setExpandedHoleriteIndex] = useState(null);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState(new Set());
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportHolerites, setExportHolerites] = useState(null);
  const exportContainerRef = useRef(null);
  const [previewHolerite, setPreviewHolerite] = useState(null);
  const [folhaCompletaHolerites, setFolhaCompletaHolerites] = useState(null);
  const [pdfAlertMsg, setPdfAlertMsg] = useState(null);
  const [holeritesHistory, setHoleritesHistory] = useState([]);
  const [histFilterNome, setHistFilterNome] = useState('');
  const [histFilterMes, setHistFilterMes] = useState('');
  const [manualHoleriteModalOpen, setManualHoleriteModalOpen] = useState(false);
  const emptyManualHolerite = { nome: '', cargo: '', salarioBase: '', totalVencimentosPdf: '', totalDescontosPdf: '', extraFolha: '' };
  const [manualHoleriteForm, setManualHoleriteForm] = useState(emptyManualHolerite);

  // Aba Acessos (só admin)
  const [usersList, setUsersList] = useState([]);
  const [savingUserEmail, setSavingUserEmail] = useState(null);

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
      setUsersList(arr);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    }
  };

  const salvarUsuario = async (u) => {
    setSavingUserEmail(u.email);
    try {
      await setDoc(doc(db, 'users', u.email), {
        email: u.email,
        isAdmin: !!u.isAdmin,
        isDocumentsOnly: !!u.isDocumentsOnly,
        allowedSectors: Array.isArray(u.allowedSectors) ? u.allowedSectors : [],
        sector: u.sector || (u.isAdmin ? 'all' : (u.allowedSectors?.[0] || 'all')),
      }, { merge: true });
      setPdfAlertMsg(`Acessos de ${u.email} salvos.`);
      setTimeout(() => setPdfAlertMsg(null), 3000);
    } catch (err) {
      setPdfAlertMsg('Erro ao salvar: ' + err.message);
    } finally {
      setSavingUserEmail(null);
    }
  };

  const atualizarUsuarioLocal = (email, patch) => {
    setUsersList(prev => prev.map(u => u.email === email ? { ...u, ...patch } : u));
  };

  const toggleSetorUsuario = (email, setor) => {
    setUsersList(prev => prev.map(u => {
      if (u.email !== email) return u;
      const atual = Array.isArray(u.allowedSectors) ? u.allowedSectors : [];
      const nova = atual.includes(setor) ? atual.filter(s => s !== setor) : [...atual, setor];
      return { ...u, allowedSectors: nova };
    }));
  };

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

      // 3. Fetch Holerites History
      const qHol = query(collection(db, 'holerites_extras'), where('brand', '==', brand));
      const snapHol = await getDocs(qHol);
      const arrHol = [];
      snapHol.forEach(d => arrHol.push({ id: d.id, ...d.data() }));
      setHoleritesHistory(arrHol);
    } catch (err) {
      console.error("Erro ao buscar dados do Firestore:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [brand]);

  useEffect(() => {
    if (currentUser?.isAdmin) fetchUsers();
  }, [currentUser?.isAdmin]);

  // Handle Tab Switch
  const handleCatSwitch = (cat) => {
    setActiveCat(cat);
    setActiveSub(CATEGORIES[cat][0]);
    setFilterName('');
    setFilterFunc('');
    setFilterDate('');
  };

  // ═══ PAGAMENTOS ACTIONS ═══

  // "Memória" do Extra Folha por colaborador: pega o último valor salvo
  // (mês/ano de referência mais recente) pra pré-preencher lançamentos novos.
  const getExtraFolhaMemoria = () => {
    const mapa = {};
    const ordenado = [...holeritesHistory].sort((a, b) => {
      const ka = a.mesAnoRef || '';
      const kb = b.mesAnoRef || '';
      if (ka !== kb) return kb.localeCompare(ka);
      return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
    });
    for (const rec of ordenado) {
      const chave = (rec.nome || '').trim().toLowerCase();
      if (!chave) continue;
      if (mapa[chave] == null && (Number(rec.extraFolha) || 0) > 0) {
        mapa[chave] = Number(rec.extraFolha);
      }
    }
    return mapa;
  };

  const buscarExtraMemoria = (mapa, nome) => {
    const chave = (nome || '').trim().toLowerCase();
    if (mapa[chave] != null) return mapa[chave];
    const parcial = Object.entries(mapa).find(([k]) => k.includes(chave) || chave.includes(k));
    return parcial ? parcial[1] : null;
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsParsingPdf(true);
    try {
      const { employees: data, mesAnoRef: detectedMesAnoRef } = await extractHoleritesFromPDF(file);
      if (data.length === 0) {
        setPdfAlertMsg("Nenhum funcionário foi encontrado. O arquivo foi lido, mas a estrutura (textos como 'Valor Líquido' e 'Nome do Funcionário') não foi reconhecida no padrão.");
      }
      // Prioriza o cargo/função que veio do próprio PDF (separado do nome);
      // só recorre ao cadastro de funcionários ou ao rótulo genérico se o
      // PDF não trouxer essa informação.
      const extraMemoria = getExtraFolhaMemoria();
      const enrichedData = data.map(hol => {
         const funcObj = efetivos.find(ef => hol.nome.toLowerCase().includes(ef.nome.toLowerCase()) || ef.nome.toLowerCase().includes(hol.nome.toLowerCase()));
         const jaTemExtra = (Number(hol.extraFolha) || 0) > 0;
         const extraPrev = jaTemExtra ? null : buscarExtraMemoria(extraMemoria, hol.nome);
         const extraFolha = extraPrev != null ? extraPrev : hol.extraFolha;
         // O parser calcula horas extras com extraFolha = 0. Recalcula agora que
         // o salário base do extra folha veio da memória do colaborador.
         const { horasEx50, horasEx100 } = calcHorasExtras(extraFolha, hol.h50, hol.h100);
         return {
           ...hol,
           cargo: hol.cargoPdf || funcObj?.cargo || 'Funcionário',
           extraFolha,
           horasEx50,
           horasEx100,
           extraFolhaPrefilled: extraPrev != null,
         };
      });
      setHoleritesParsed(enrichedData);
      // Detecta o mês/ano direto do "Folha Mensal <Mês> de <Ano>" do PDF,
      // pra evitar erro de digitação de quem está importando.
      if (detectedMesAnoRef) setHoleriteMesAnoRef(detectedMesAnoRef);
    } catch (err) {
      console.error(err);
      setPdfAlertMsg('Erro ao processar PDF: ' + err.message);
    } finally {
      setIsParsingPdf(false);
    }
  };

  const abrirHoleriteManual = () => {
    setManualHoleriteForm(emptyManualHolerite);
    setManualHoleriteModalOpen(true);
  };

  const adicionarHoleriteManual = () => {
    const f = manualHoleriteForm;
    if (!f.nome.trim()) { setPdfAlertMsg('Informe o nome do colaborador.'); return; }
    const salarioBase = Number(f.salarioBase) || 0;
    const totalVenc = Number(f.totalVencimentosPdf) || 0;
    const totalDesc = Number(f.totalDescontosPdf) || 0;
    const extraFolha = Number(f.extraFolha) || 0;
    const novo = {
      nome: f.nome.trim(),
      cargo: f.cargo.trim() || 'Funcionário',
      cargoPdf: f.cargo.trim() || '',
      salarioBase,
      totalVencimentosPdf: totalVenc,
      totalDescontosPdf: totalDesc,
      liquidoPdf: totalVenc - totalDesc,
      rubricas: [],
      oficial: {},
      extraFolha,
      comissao: 0,
      h50: 0, horasEx50: 0,
      h100: 0, horasEx100: 0,
      hDss: 0, dssHex: 0,
      faltas: 0, vale: 0,
      manual: true,
    };
    setHoleritesParsed(prev => [...prev, novo]);
    setManualHoleriteModalOpen(false);
    setPdfAlertMsg(null);
  };

  const handleHoleriteChange = (index, field, value) => {
    const updated = [...holeritesParsed];
    const item = { ...updated[index], [field]: value };
    if (field === 'extraFolha') item.extraFolhaPrefilled = false;

    // Auto-cálculo de Horas Extras 50% e 100% com base no Extra Folha (salário base extra folha)
    if (field === 'extraFolha' || field === 'h50' || field === 'h100') {
      const sal = field === 'extraFolha' ? value : item.extraFolha;
      const qtd50 = field === 'h50' ? value : item.h50;
      const qtd100 = field === 'h100' ? value : item.h100;

      const { horasEx50, horasEx100 } = calcHorasExtras(sal, qtd50, qtd100);
      item.horasEx50 = horasEx50;
      item.horasEx100 = horasEx100;
    }

    updated[index] = item;
    setHoleritesParsed(updated);
  };

  const handleSaveHolerites = async () => {
    if (isSavingHolerites) return;
    if (!holeriteMesAnoRef) {
      setPdfAlertMsg("Por favor, informe o Mês/Ano de Referência antes de salvar.");
      return;
    }
    setIsSavingHolerites(true);
    try {
      for (const hol of holeritesParsed) {
        const { id, extraFolhaPrefilled, ...fields } = hol;
        if (id) {
          // Veio da edição de um lançamento já salvo — atualiza em vez de duplicar
          await updateDoc(doc(db, 'holerites_extras', id), {
            ...fields,
            mesAnoRef: holeriteMesAnoRef,
            brand,
            updatedAt: serverTimestamp(),
          });
        } else {
          await addDoc(collection(db, 'holerites_extras'), {
            ...fields,
            mesAnoRef: holeriteMesAnoRef,
            brand,
            createdAt: serverTimestamp(),
          });
        }
      }
      setPdfAlertMsg('Dados salvos no histórico com sucesso!');
      fetchData();
      setHoleritesParsed([]);
      setHoleriteMesAnoRef('');
      setTimeout(() => setPdfAlertMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setPdfAlertMsg('Erro ao salvar holerites: ' + err.message);
    } finally {
      setIsSavingHolerites(false);
    }
  };

  // Carrega de volta na mesma tela de revisão todos os lançamentos salvos
  // de um mês/ano específico, para permitir edição e regravação (update em
  // vez de duplicar) — a mesma visão que aparece ao importar um PDF novo.
  const handleEditHoleriteBatch = (mesRef) => {
    const records = holeritesHistory.filter(h => h.mesAnoRef === mesRef);
    if (records.length === 0) return;
    setHoleritesParsed(records.map(h => ({ ...h })));
    setHoleriteMesAnoRef(mesRef);
    setPdfAlertMsg(null);
  };

  const handleEditSelectedHolerites = (records) => {
    if (records.length === 0) return;
    // Se todos são do mesmo mês/ano, usa esse como referência; senão deixa em branco
    const refs = [...new Set(records.map(h => h.mesAnoRef))];
    setHoleritesParsed(records.map(h => ({ ...h })));
    setHoleriteMesAnoRef(refs.length === 1 ? refs[0] : '');
    setPdfAlertMsg(null);
    setSelectedHistoryIds(new Set());
  };


  const handleCancelHoleriteEdit = () => {
    setHoleritesParsed([]);
    setHoleriteMesAnoRef('');
  };

  // Gera um PDF real (um recibo por página, no mesmo modelo do ReciboPrint)
  // renderizando os registros num container fora da tela e capturando com
  // html2canvas — usado tanto pelo download individual quanto pelo em massa.
  const handleDownloadPdf = async (records, filename) => {
    if (!records || records.length === 0) return;
    setIsExportingPdf(true);
    try {
      flushSync(() => setExportHolerites(records));
      await generatePdfFromContainer(exportContainerRef.current, filename);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar PDF: ' + err.message);
    } finally {
      setExportHolerites(null);
      setIsExportingPdf(false);
    }
  };

  const toggleHistorySelection = (id) => {
    setSelectedHistoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDeleteHolerite = async (h) => {
    if (!window.confirm(`Excluir o lançamento de ${h.nome} (${h.mesAnoRef})? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteDoc(doc(db, 'holerites_extras', h.id));
      setSelectedHistoryIds(prev => { const next = new Set(prev); next.delete(h.id); return next; });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const handleDeleteSelectedHolerites = async (records) => {
    if (records.length === 0) return;
    if (!window.confirm(`Excluir ${records.length} lançamento(s) selecionado(s)? Essa ação não pode ser desfeita.`)) return;
    try {
      for (const h of records) {
        await deleteDoc(doc(db, 'holerites_extras', h.id));
      }
      setSelectedHistoryIds(new Set());
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir: ' + err.message);
    }
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
      setEfetivoForm({ nome: '', dataNascimento: '', cpf: '', endereco: '', telefone: '', pix: '', dataAdmissao: '', dataDemissional: '', status: 'Ativo' });
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
      dataDemissional: ef.dataDemissional || '',
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
    const picked = Array.from(e.target.files || []);
    if (picked.length) {
      setFileForm(prev => ({ ...prev, files: [...prev.files, ...picked] }));
    }
    e.target.value = '';
  };

  const removeNovoAnexo = (idx) => {
    setFileForm(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== idx) }));
  };

  const removeAnexoExistente = (idx) => {
    setFileForm(prev => ({ ...prev, anexosExistentes: prev.anexosExistentes.filter((_, i) => i !== idx) }));
  };

  const handleEditFile = (arq) => {
    setEditingFileId(arq.id);
    setFileForm({
      titulo: arq.titulo || '',
      categoria: arq.categoria,
      subcategoria: arq.subcategoria,
      files: [],
      anexosExistentes: normalizeAnexos(arq),
      funcionarioId: arq.funcionarioId || '',
      dataVencimento: arq.dataVencimento || '',
      tipoAso: arq.tipoAso || (arq.subcategoria === 'Aso Demissional' ? 'Demissional' : 'Admissional'),
      dataExame: arq.dataExame || '',
      mesAnoRef: arq.mesAnoRef || '',
      valor: arq.valor != null ? String(arq.valor) : ''
    });
    setFileModalOpen(true);
  };

  const handleSaveFile = async (e) => {
    e.preventDefault();

    const isAso = ['Aso', 'Aso Demissional'].includes(fileForm.subcategoria);
    const isInspecao = fileForm.subcategoria === 'Inspeções';
    const isVendaSucata = fileForm.subcategoria === 'Venda de sucatas';
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
    } else if (isVendaSucata) {
      if (!fileForm.mesAnoRef) {
        alert("Informe o Mês/Ano de Referência da venda.");
        return;
      }
      if (fileForm.valor === '' || isNaN(Number(fileForm.valor)) || Number(fileForm.valor) < 0) {
        alert("Informe um valor apurado válido.");
        return;
      }
      calculatedTitle = fileForm.titulo || `Venda de sucatas - ${fileForm.mesAnoRef}`;
    } else {
      if (!fileForm.titulo) {
        alert("Preencha o título.");
        return;
      }
    }

    const totalAnexos = (fileForm.anexosExistentes?.length || 0) + (fileForm.files?.length || 0);
    if (!editingFileId && totalAnexos === 0) {
      alert("Selecione ao menos um arquivo para cadastrar.");
      return;
    }
    if (editingFileId && totalAnexos === 0) {
      alert("O registro precisa de ao menos um anexo.");
      return;
    }

    try {
      setIsUploading(true);

      // Sobe cada arquivo novo selecionado e monta a lista final de anexos
      const subPath = fileForm.subcategoria ? `/${fileForm.subcategoria}` : '';
      const novosAnexos = [];
      for (const file of (fileForm.files || [])) {
        const filePath = `arquivos_v2/${brand}/${fileForm.categoria}${subPath}/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, filePath);
        const snapshot = await uploadBytes(fileRef, file);
        const url = await getDownloadURL(snapshot.ref);
        novosAnexos.push({ url, path: filePath, name: file.name });
      }

      const anexos = [...(fileForm.anexosExistentes || []), ...novosAnexos];
      const primeiro = anexos[0] || null;

      const actualTipoAso = isAso ? (fileForm.subcategoria === 'Aso Demissional' ? 'Demissional' : fileForm.tipoAso) : null;

      const commonData = {
        titulo: calculatedTitle,
        funcionarioId: fileForm.funcionarioId || null,
        tipoAso: actualTipoAso,
        dataExame: isAso ? (fileForm.dataExame || null) : null,
        dataVencimento: isAso ? (fileForm.dataVencimento || null) : null,
        mesAnoRef: (isInspecao || isVendaSucata) ? (fileForm.mesAnoRef || null) : null,
        valor: isVendaSucata ? (Number(fileForm.valor) || 0) : null,
        anexos,
        // Espelha o primeiro anexo nos campos legados (compatibilidade)
        fileUrl: primeiro?.url || null,
        filePath: primeiro?.path || null,
        fileName: primeiro?.name || null,
      };

      if (editingFileId) {
        await updateDoc(doc(db, 'arquivos', editingFileId), commonData);
        alert('Arquivo atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'arquivos'), {
          ...commonData,
          categoria: fileForm.categoria,
          subcategoria: fileForm.subcategoria,
          brand,
          uploadedBy: currentUser?.email || 'Desconhecido',
          createdAt: serverTimestamp()
        });
        alert('Arquivo cadastrado com sucesso!');
      }

      setFileModalOpen(false);
      setFileForm({
        titulo: '', categoria: activeCat, subcategoria: activeSub, files: [], anexosExistentes: [], funcionarioId: '',
        dataVencimento: '', tipoAso: 'Admissional', dataExame: '', mesAnoRef: '', valor: ''
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
      const paths = normalizeAnexos(arquivo).map(a => a.path).filter(Boolean);
      for (const p of paths) {
        await deleteObject(ref(storage, p)).catch(() => console.warn("Anexo não encontrado no storage:", p));
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
  const isPagamentosTab = activeCat === 'Pagamentos' && activeSub === 'Holerites';
  const isAcessosTab = activeCat === 'Acessos' && currentUser?.isAdmin;
  
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
      if (a.subcategoria === 'Venda de sucatas') {
        // Filtra pelo mês/ano de referência da venda, não pela data de upload
        if ((a.mesAnoRef || '') !== filterDate) return false;
      } else {
        if (!a.createdAt) return false;
        const dateObj = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        if (`${yyyy}-${mm}` !== filterDate) return false;
      }
    }
    
    return true;
  });

  // Venda de sucatas: valor apurado por mês + total no ano selecionado
  const vendaSucataStats = (() => {
    if (activeSub !== 'Venda de sucatas') return null;
    const registros = arquivos.filter(a => a.categoria === activeCat && a.subcategoria === 'Venda de sucatas');
    const anos = [...new Set(registros.map(r => (r.mesAnoRef || '').slice(0, 4)).filter(Boolean))].sort().reverse();
    const ano = (filterDate && filterDate.slice(0, 4)) || anos[0] || String(new Date().getFullYear());
    const porMes = Array.from({ length: 12 }, () => 0);
    let total = 0;
    registros.forEach(r => {
      if ((r.mesAnoRef || '').slice(0, 4) !== ano) return;
      const mesIdx = Number((r.mesAnoRef || '').slice(5, 7)) - 1;
      const v = Number(r.valor) || 0;
      if (mesIdx >= 0 && mesIdx < 12) porMes[mesIdx] += v;
      total += v;
    });
    return { ano, anos, porMes, total, max: Math.max(1, ...porMes) };
  })();

  const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const renderAnexoLinks = (arq, sizeClass = '') => {
    const list = normalizeAnexos(arq);
    if (!list.length) return <span style={{ color: 'var(--muted)' }}>—</span>;
    if (list.length === 1) {
      return (
        <a href={list[0].url} target="_blank" rel="noopener noreferrer" className={`btn icon-only ${sizeClass}`} title={list[0].name || 'Visualizar'}>
          <IconEye />
        </a>
      );
    }
    return (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {list.map((a, i) => (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn outline sm"
            style={{ padding: '2px 8px', fontSize: '12px' }}
            title={a.name || `Anexo ${i + 1}`}
          >
            👁️ {i + 1}
          </a>
        ))}
      </div>
    );
  };

  const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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
          {Object.keys(CATEGORIES).filter(cat => cat !== 'Acessos' || currentUser?.isAdmin).map(cat => (
            <button key={cat} className={`tab-btn ${activeCat === cat ? 'active' : ''}`} onClick={() => handleCatSwitch(cat)}>
              {cat === 'Segurança' ? '🛡️ Segurança' : cat === 'Meio ambiente' ? '🌱 Meio Ambiente' : cat === 'Administração' ? '🏢 Administração' : cat === 'Pagamentos' ? '💸 Pagamentos' : '🔑 Acessos'}
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
        ) : isAcessosTab ? (
          <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
            <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3>Controle de Acessos</h3>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  Defina o que cada e-mail pode visualizar. <strong>Admin</strong> vê tudo; <strong>Só documentos</strong> restringe ao painel administrativo (sem financeiro); os setores marcados definem quais dados aparecem nos painéis.
                </p>
              </div>
              <button className="btn outline sm" onClick={fetchUsers}>↻ Atualizar</button>
            </div>

            {pdfAlertMsg && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', color: '#16a34a', marginBottom: '12px', fontSize: '13px' }}>{pdfAlertMsg}</div>
            )}

            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>E-mail</th>
                    <th style={{ textAlign: 'center' }}>Admin</th>
                    <th style={{ textAlign: 'center' }}>Só documentos</th>
                    <th>Setores liberados</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px' }}>Nenhum usuário encontrado.</td></tr>
                  )}
                  {usersList.map(u => (
                    <tr key={u.email}>
                      <td><strong>{u.email}</strong>{u.criadoAutomaticamente && <span style={{ color: 'var(--muted)', fontSize: '11px' }}> (auto)</span>}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!u.isAdmin} onChange={e => atualizarUsuarioLocal(u.email, { isAdmin: e.target.checked })} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!u.isDocumentsOnly} onChange={e => atualizarUsuarioLocal(u.email, { isDocumentsOnly: e.target.checked })} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {SETORES_ACESSO.map(setor => (
                            <label key={setor} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', opacity: u.isAdmin ? 0.5 : 1 }}>
                              <input
                                type="checkbox"
                                disabled={u.isAdmin}
                                checked={Array.isArray(u.allowedSectors) && u.allowedSectors.includes(setor)}
                                onChange={() => toggleSetorUsuario(u.email, setor)}
                              />
                              {SETOR_LABELS[setor]}
                            </label>
                          ))}
                        </div>
                        {u.isAdmin && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Admin já vê todos os setores.</span>}
                      </td>
                      <td>
                        <button className="btn primary sm" disabled={savingUserEmail === u.email} onClick={() => salvarUsuario(u)}>
                          {savingUserEmail === u.email ? 'Salvando...' : 'Salvar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : isEfetivoTab ? (
          // --- TABELA EFETIVO ---
          <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
            <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3>Gestão de Efetivo (Funcionários)</h3>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Gerencie a lista de funcionários da {brand === 'autogeral' ? 'Auto Geral' : 'Pernambucana'}.</p>
              </div>
              <button className="btn primary sm" onClick={() => {
                setEfetivoForm({ nome: '', dataNascimento: '', cpf: '', endereco: '', telefone: '', pix: '', dataAdmissao: '', dataDemissional: '', status: 'Ativo' });
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
                    <th>Demissão</th>
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
                    <tr><td colSpan="10" style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>Nenhum funcionário encontrado.</td></tr>
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
                        <td>{ef.dataDemissional ? ef.dataDemissional.split('-').reverse().join('/') : '-'}</td>
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
                setFileForm({ titulo: '', categoria: 'Segurança', subcategoria: 'Aso', files: [], anexosExistentes: [], funcionarioId: '', dataVencimento: '', tipoAso: 'Admissional', dataExame: '', mesAnoRef: '', valor: '' });
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
                    const admissionalFiles = funcArquivos.filter(a => a.tipoAso === 'Admissional' || a.titulo?.toLowerCase().includes('admissional'))
                      .sort((a, b) => {
                        const dateA = a.dataExame || (a.createdAt?.toDate ? a.createdAt.toDate().toISOString() : '');
                        const dateB = b.dataExame || (b.createdAt?.toDate ? b.createdAt.toDate().toISOString() : '');
                        return dateB.localeCompare(dateA);
                      });
                    const admissional = admissionalFiles[0];
                    const periodicos = funcArquivos.filter(a => a.tipoAso === 'Periódico' || a.titulo?.toLowerCase().includes('periódico') || a.titulo?.toLowerCase().includes('periodico'))
                      .sort((a, b) => {
                        const dateA = a.dataExame || (a.createdAt?.toDate ? a.createdAt.toDate().toISOString() : '');
                        const dateB = b.dataExame || (b.createdAt?.toDate ? b.createdAt.toDate().toISOString() : '');
                        return dateB.localeCompare(dateA);
                      });
                    const latestPeriodico = periodicos[0];
                    const isDesligado = ef.status === 'Desligado';

                    const renderAsoCell = (arq, allFiles = [], titleType = '') => {
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px' }}>
                              {exDate ? `Exame: ${exDate.toLocaleDateString('pt-BR')}` : ''}
                              {vDate ? ` (Venc: ${vDate.toLocaleDateString('pt-BR')})` : ''}
                            </span>
                            {statusBadge && (
                              <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', background: statusBadge.bg, color: statusBadge.color, fontWeight: 'bold' }}>
                                {statusBadge.text}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {renderAnexoLinks(arq, 'sm')}
                            <button className="btn icon-only edit sm" title="Editar ASO" onClick={() => handleEditFile(arq)}>
                              <IconEdit />
                            </button>
                            <button className="btn icon-only danger sm" title="Excluir ASO" onClick={() => handleDeleteFile(arq)}>
                              <IconTrash />
                            </button>
                            {allFiles.length > 1 && (
                              <button 
                                className="btn outline sm" 
                                style={{ fontSize: '10px', padding: '2px 6px', marginLeft: '4px' }} 
                                onClick={() => { setHistoryFunc({ ef, typeName: `ASO ${titleType}`, files: allFiles }); setHistoryModalOpen(true); }}
                                title="Ver histórico completo de ASOs deste colaborador"
                              >
                                📋 Histórico ({allFiles.length})
                              </button>
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
                        <td>{renderAsoCell(admissional, admissionalFiles, 'Admissional')}</td>
                        <td>{renderAsoCell(latestPeriodico, periodicos, 'Periódico')}</td>
                        <td>
                          <button 
                            className="btn primary sm" 
                            onClick={() => {
                              setEditingFileId(null);
                              setFileForm({ titulo: '', categoria: 'Segurança', subcategoria: 'Aso', files: [], anexosExistentes: [], funcionarioId: ef.id, dataVencimento: '', tipoAso: 'Periódico', dataExame: '', mesAnoRef: '', valor: '' });
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
        ) : isPagamentosTab ? (
           <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
              {(() => {
                const isEditMode = holeritesParsed.length > 0 && holeritesParsed.some(h => h.id);
                return (
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h3>Gestão de Holerites Extras {isEditMode && <span style={{ color: '#ca8a04', fontSize: '13px', fontWeight: 'normal' }}>(editando lançamentos de {holeriteMesAnoRef})</span>}</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Importe o PDF da folha para preencher valores por fora dos lançamentos.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="month" value={holeriteMesAnoRef} onChange={e => setHoleriteMesAnoRef(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)' }} title="Mês/Ano Ref." />
                    <label className="btn outline sm" style={{ margin: 0, cursor: 'pointer' }}>
                        {isParsingPdf ? 'Processando...' : '📄 Importar PDF'}
                        <input type="file" accept="application/pdf" onChange={handlePdfUpload} onClick={(e) => { e.target.value = null; }} style={{ display: 'none' }} disabled={isParsingPdf} />
                    </label>
                    <button className="btn outline sm" onClick={abrirHoleriteManual} title="Adicionar um colaborador sem holerite no PDF">
                        ➕ Manual
                    </button>
                    {holeritesParsed.length > 0 && (
                      <button
                        className="btn outline sm"
                        title="Mostra a planilha completa (holerite oficial + lançamentos manuais) na tela"
                        onClick={() => setFolhaCompletaHolerites(holeritesParsed)}
                      >
                        📋 Ver Planilha Completa
                      </button>
                    )}
                    {holeritesParsed.length > 0 && (
                      <button
                        className="btn outline sm"
                        title="Baixa uma planilha com todas as colunas do holerite oficial + lançamentos manuais, pra conferência"
                        onClick={() => exportFolhaPGXlsx(holeritesParsed, holeriteMesAnoRef, `Folha_de_PG_${holeriteMesAnoRef || 'sem-data'}.xlsx`)}
                      >
                        📊 Baixar XLSX
                      </button>
                    )}
                    {holeritesParsed.length > 0 && (
                      <button className="btn outline sm" onClick={handleCancelHoleriteEdit} disabled={isSavingHolerites}>
                        Cancelar
                      </button>
                    )}
                    <button className="btn primary sm" onClick={handleSaveHolerites} disabled={holeritesParsed.length === 0 || isSavingHolerites}>
                        {isSavingHolerites ? 'Salvando...' : (isEditMode ? '💾 Salvar Alterações' : '💾 Salvar')}
                    </button>
                </div>
              </div>
                );
              })()}

              {holeritesParsed.length > 0 ? (
                <div className="table-wrap" style={{ overflowX: 'auto', paddingBottom: '20px' }}>
                  <table style={{ minWidth: '1600px' }}>
                    <thead>
                      <tr>
                        <th rowSpan="2" style={{ position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 2 }}>Funcionário</th>
                        <th rowSpan="2"></th>
                        <th rowSpan="2">Salário Base (PDF)</th>
                        <th rowSpan="2">Líquido (PDF)</th>
                        <th colSpan="8" style={{ textAlign: 'center', background: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04' }}>Pagamento Extra Folha (Preenchimento Manual)</th>
                        <th colSpan="2" style={{ textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>Descontos Manuais</th>
                        <th rowSpan="2" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>Líquido a Receber (Final)</th>
                      </tr>
                      <tr>
                        <th style={{ background: 'rgba(234, 179, 8, 0.05)' }}>Extra Folha</th>
                        <th style={{ background: 'rgba(234, 179, 8, 0.05)' }}>Comissão</th>
                        <th style={{ background: 'rgba(234, 179, 8, 0.05)' }}>H 50%</th>
                        <th style={{ background: 'rgba(234, 179, 8, 0.05)' }}>Horas Ex 50%</th>
                        <th style={{ background: 'rgba(234, 179, 8, 0.05)' }}>H 100%</th>
                        <th style={{ background: 'rgba(234, 179, 8, 0.05)' }}>Horas Ex 100%</th>
                        <th style={{ background: 'rgba(234, 179, 8, 0.05)' }}>H DSS</th>
                        <th style={{ background: 'rgba(234, 179, 8, 0.05)' }}>DSS HEX</th>
                        <th style={{ background: 'rgba(239, 68, 68, 0.05)' }}>Faltas</th>
                        <th style={{ background: 'rgba(239, 68, 68, 0.05)' }}>Vale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holeritesParsed.map((hol, index) => {
                          // h50/h100/hDss são quantidade de horas, não dinheiro — só horasEx50/horasEx100/dssHex entram na soma
                          const prov = (Number(hol.extraFolha)||0) + (Number(hol.comissao)||0) + (Number(hol.horasEx50)||0) + (Number(hol.horasEx100)||0) + (Number(hol.dssHex)||0);
                          const desc = (Number(hol.faltas)||0) + (Number(hol.vale)||0);
                          const finalLiquido = prov - desc;
                          
                          const renderInput = (field) => (
                              <input type="number" step="0.01" value={hol[field] === 0 ? '' : hol[field]} placeholder="0,00" onChange={e => handleHoleriteChange(index, field, e.target.value)} style={{ width: '80px', padding: '4px', border: '1px solid var(--line)', borderRadius: '4px' }} />
                          );

                          const isExpanded = expandedHoleriteIndex === index;
                          const rubricas = hol.rubricas || [];

                          return (
                              <React.Fragment key={index}>
                              <tr>
                                <td style={{ position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 1 }}><strong>{hol.nome}</strong></td>
                                <td>
                                  {rubricas.length > 0 && (
                                    <button
                                      type="button"
                                      className="btn outline sm"
                                      style={{ padding: '2px 8px', fontSize: '12px' }}
                                      onClick={() => setExpandedHoleriteIndex(isExpanded ? null : index)}
                                      title="Ver detalhamento de todas as rubricas do PDF"
                                    >
                                      {isExpanded ? '▲' : '▼'} Detalhes
                                    </button>
                                  )}
                                </td>
                                <td>R$ {hol.salarioBase?.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                                <td>R$ {hol.liquidoPdf?.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                                <td>
                                  {renderInput('extraFolha')}
                                  {hol.extraFolhaPrefilled && (
                                    <div
                                      style={{ fontSize: '10px', color: '#ca8a04', marginTop: '2px', whiteSpace: 'nowrap' }}
                                      title="Valor trazido do último lançamento salvo deste colaborador. Edite se precisar."
                                    >
                                      ↺ mês anterior
                                    </div>
                                  )}
                                </td>
                                <td>{renderInput('comissao')}</td>
                                <td>{renderInput('h50')}</td>
                                <td>{renderInput('horasEx50')}</td>
                                <td>{renderInput('h100')}</td>
                                <td>{renderInput('horasEx100')}</td>
                                <td>{renderInput('hDss')}</td>
                                <td>{renderInput('dssHex')}</td>
                                <td>{renderInput('faltas')}</td>
                                <td>{renderInput('vale')}</td>
                                <td style={{ fontWeight: 'bold', color: '#16a34a' }}>R$ {finalLiquido.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan="14" style={{ background: 'rgba(0,0,0,0.02)', padding: '12px 20px' }}>
                                    <strong style={{ fontSize: '13px' }}>Detalhamento oficial do PDF — {hol.nome}</strong>
                                    <table style={{ marginTop: '8px', width: 'auto', minWidth: '400px' }}>
                                      <thead>
                                        <tr>
                                          <th style={{ textAlign: 'left' }}>Rubrica</th>
                                          <th style={{ textAlign: 'left' }}>Tipo</th>
                                          <th style={{ textAlign: 'right' }}>Valor</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {rubricas.map((r, ri) => (
                                          <tr key={ri}>
                                            <td>{r.descricao}</td>
                                            <td style={{ color: r.tipo === 'desconto' ? '#dc2626' : '#16a34a' }}>{r.tipo}</td>
                                            <td style={{ textAlign: 'right' }}>R$ {r.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                              </React.Fragment>
                          );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {holeritesHistory.length > 0 && (() => {
                 const mesesDisponiveis = [...new Set(holeritesHistory.map(h => h.mesAnoRef).filter(Boolean))].sort().reverse();
                 const historicoFiltrado = holeritesHistory.filter(h => {
                   if (histFilterNome && !(h.nome || '').toLowerCase().includes(histFilterNome.toLowerCase())) return false;
                   if (histFilterMes && h.mesAnoRef !== histFilterMes) return false;
                   return true;
                 });
                 const visibleHistory = [...historicoFiltrado]
                   .sort((a, b) => (b.createdAt?.toMillis()||0) - (a.createdAt?.toMillis()||0))
                   .slice(0, 100);
                 const allVisibleSelected = visibleHistory.length > 0 && visibleHistory.every(h => selectedHistoryIds.has(h.id));
                 const selectedRecords = visibleHistory.filter(h => selectedHistoryIds.has(h.id));
                 const totalBrutoFiltrado = historicoFiltrado.reduce((s, h) => {
                   const av = (Number(h.extraFolha) || 0) + (Number(h.comissao) || 0) + (Number(h.horasEx50) || 0) + (Number(h.horasEx100) || 0) + (Number(h.dssHex) || 0) - (Number(h.faltas) || 0) - (Number(h.vale) || 0);
                   const dep = (Number(h.totalVencimentosPdf) || 0) - (Number(h.totalDescontosPdf) || 0);
                   return s + av + dep;
                 }, 0);

                 return (
                 <div style={{ marginTop: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4>Histórico Salvo</h4>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn primary sm"
                          disabled={selectedRecords.length === 0 || isExportingPdf}
                          onClick={() => handleDownloadPdf(selectedRecords, `Recibos_Selecionados_${selectedRecords.length}.pdf`)}
                        >
                          {isExportingPdf ? 'Gerando PDF...' : `⬇️ Baixar Selecionados (${selectedRecords.length})`}
                        </button>
                        <button
                          className="btn outline sm"
                          disabled={selectedRecords.length === 0}
                          title="Mostra a planilha completa dos selecionados na tela"
                          onClick={() => setFolhaCompletaHolerites(selectedRecords)}
                        >
                          📋 Ver Completo ({selectedRecords.length})
                        </button>
                        <button
                          className="btn outline sm"
                          disabled={selectedRecords.length === 0}
                          title="Baixa uma planilha com todas as colunas do holerite oficial + lançamentos manuais dos selecionados"
                          onClick={() => exportFolhaPGXlsx(selectedRecords, selectedRecords[0]?.mesAnoRef, `Folha_de_PG_Selecionados_${selectedRecords.length}.xlsx`)}
                        >
                          📊 XLSX Selecionados ({selectedRecords.length})
                        </button>
                        <button
                          className="btn outline sm"
                          disabled={selectedRecords.length === 0}
                          onClick={() => handleEditSelectedHolerites(selectedRecords)}
                        >
                          ✏️ Editar Selecionados ({selectedRecords.length})
                        </button>
                        <button
                          className="btn warning sm"
                          disabled={selectedRecords.length === 0}
                          onClick={() => handleDeleteSelectedHolerites(selectedRecords)}
                        >
                          🗑️ Excluir Selecionados ({selectedRecords.length})
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Filtrar por colaborador..."
                        value={histFilterNome}
                        onChange={e => setHistFilterNome(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '220px' }}
                      />
                      <select
                        value={histFilterMes}
                        onChange={e => setHistFilterMes(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', minWidth: '160px' }}
                      >
                        <option value="">Todos os meses</option>
                        {mesesDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {(histFilterNome || histFilterMes) && (
                        <button className="btn ghost sm" onClick={() => { setHistFilterNome(''); setHistFilterMes(''); }}>Limpar</button>
                      )}
                      <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        {historicoFiltrado.length} registro(s) · Salário Bruto total: <strong>R$ {totalBrutoFiltrado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </span>
                    </div>

                    <div className="table-wrap" style={{ marginTop: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>
                                      <input
                                        type="checkbox"
                                        checked={allVisibleSelected}
                                        onChange={() => setSelectedHistoryIds(prev => {
                                          const next = new Set(prev);
                                          if (allVisibleSelected) visibleHistory.forEach(h => next.delete(h.id));
                                          else visibleHistory.forEach(h => next.add(h.id));
                                          return next;
                                        })}
                                      />
                                    </th>
                                    <th>Mês/Ano Ref.</th>
                                    <th>Funcionário</th>
                                    <th>Salário Base</th>
                                    <th>Total (Contracheque)</th>
                                    <th>Valor Desconto</th>
                                    <th>Comissão</th>
                                    <th>Salário à Vista</th>
                                    <th>Valor Depósito</th>
                                    <th>Salário Bruto</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleHistory.length === 0 && (
                                    <tr><td colSpan="11" style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>Nenhum registro para o filtro atual.</td></tr>
                                )}
                                {visibleHistory.map(h => {
                                    const brl = v => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                                    const salarioAvista = (Number(h.extraFolha) || 0) + (Number(h.comissao) || 0) + (Number(h.horasEx50) || 0) + (Number(h.horasEx100) || 0) + (Number(h.dssHex) || 0) - (Number(h.faltas) || 0) - (Number(h.vale) || 0);
                                    const valorDeposito = (Number(h.totalVencimentosPdf) || 0) - (Number(h.totalDescontosPdf) || 0);
                                    const salarioBruto = salarioAvista + valorDeposito;
                                    return (
                                    <tr key={h.id}>
                                        <td><input type="checkbox" checked={selectedHistoryIds.has(h.id)} onChange={() => toggleHistorySelection(h.id)} /></td>
                                        <td>{h.mesAnoRef}</td>
                                        <td><strong>{h.nome}</strong></td>
                                        <td>{brl(h.salarioBase)}</td>
                                        <td>{brl(h.totalVencimentosPdf)}</td>
                                        <td>{brl(h.totalDescontosPdf)}</td>
                                        <td>{brl(h.comissao)}</td>
                                        <td>{brl(salarioAvista)}</td>
                                        <td>{brl(valorDeposito)}</td>
                                        <td>{brl(salarioBruto)}</td>
                                        <td style={{ display: 'flex', gap: '6px' }}>
                                          <button
                                            type="button"
                                            className="btn outline sm"
                                            style={{ padding: '2px 8px', fontSize: '12px' }}
                                            onClick={() => setPreviewHolerite(h)}
                                          >
                                            👁️ Exibir
                                          </button>
                                          <button
                                            type="button"
                                            className="btn outline sm"
                                            style={{ padding: '2px 8px', fontSize: '12px' }}
                                            disabled={isExportingPdf}
                                            onClick={() => handleDownloadPdf([h], `Recibo_${h.nome}_${h.mesAnoRef}.pdf`)}
                                          >
                                            ⬇️ Baixar
                                          </button>
                                          <button
                                            type="button"
                                            className="btn outline sm"
                                            style={{ padding: '2px 8px', fontSize: '12px' }}
                                            title="Editar apenas este funcionário"
                                            onClick={() => handleEditSelectedHolerites([h])}
                                          >
                                            ✏️ Editar
                                          </button>
                                          <button
                                            type="button"
                                            className="btn outline sm"
                                            style={{ padding: '2px 8px', fontSize: '12px', color: '#dc2626', borderColor: '#dc2626' }}
                                            onClick={() => handleDeleteHolerite(h)}
                                          >
                                            🗑️ Excluir
                                          </button>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                 </div>
                 );
              })()}
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
                  titulo: '', categoria: activeCat, subcategoria: activeSub, files: [], anexosExistentes: [], funcionarioId: '',
                  dataVencimento: '', tipoAso: activeSub === 'Aso Demissional' ? 'Demissional' : 'Admissional', dataExame: '', mesAnoRef: '', valor: ''
                });
                setFileModalOpen(true);
              }}><IconPlus /> Novo Arquivo</button>
            </div>

            {vendaSucataStats && (
              <div className="glass" style={{ padding: '16px', borderRadius: '12px', marginBottom: '16px', background: 'rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ margin: 0 }}>Valor apurado — {vendaSucataStats.ano}</h4>
                  <strong style={{ fontSize: '18px', color: 'var(--green, #16a34a)' }}>Total no ano: {brl(vendaSucataStats.total)}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px', marginTop: '16px' }}>
                  {vendaSucataStats.porMes.map((v, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{v ? brl(v).replace('R$', '').trim() : ''}</span>
                      <div
                        title={`${MESES_CURTOS[i]}: ${brl(v)}`}
                        style={{
                          width: '100%',
                          height: `${Math.round((v / vendaSucataStats.max) * 100)}%`,
                          minHeight: v ? '3px' : '0',
                          background: 'var(--green, #16a34a)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height .2s',
                        }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{MESES_CURTOS[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="filters-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Filtrar por título/nome..." value={filterName} onChange={e => setFilterName(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }} />
              {['Aso', 'Aso Demissional', 'Advertências', 'Folha de pagamento', 'Acidente do Trabalho'].includes(activeSub) && (
                <select value={filterFunc} onChange={e => setFilterFunc(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }}>
                  <option value="">Todos os Funcionários</option>
                  {efetivos.map(ef => <option key={ef.id} value={ef.id}>{ef.nome}</option>)}
                </select>
              )}
              {['Folha de pagamento', 'Advertências', 'Inspeções', 'Acidente do Trabalho', 'Venda de sucatas'].includes(activeSub) && (
                <input type="month" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', flex: 1, minWidth: '200px' }} />
              )}
            </div>

            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    {activeSub === 'Inspeções' ? <th>Mês/Ano Ref.</th> : <th>Título</th>}
                    {activeSub === 'Venda de sucatas' && <th>Mês Ref.</th>}
                    {activeSub === 'Venda de sucatas' && <th>Valor Apurado</th>}
                    {['Aso', 'Aso Demissional', 'Advertências', 'Folha de pagamento', 'Acidente do Trabalho'].includes(activeSub) && <th>Funcionário Vinculado</th>}
                    {activeSub === 'Aso Demissional' && <th>Data do Exame</th>}
                    <th>Enviado por</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArquivos.length === 0 ? (
                    <tr><td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>Nenhum arquivo encontrado para {activeSub}.</td></tr>
                  ) : [...filteredArquivos].sort((a, b) => {
                    if (activeSub === 'Venda de sucatas') return (b.mesAnoRef || '').localeCompare(a.mesAnoRef || '');
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
                        {activeSub === 'Venda de sucatas' && (
                          <td>{arq.mesAnoRef ? arq.mesAnoRef.split('-').reverse().join('/') : '-'}</td>
                        )}
                        {activeSub === 'Venda de sucatas' && (
                          <td><strong>{brl(arq.valor)}</strong></td>
                        )}
                        {['Aso', 'Aso Demissional', 'Advertências', 'Folha de pagamento', 'Acidente do Trabalho'].includes(activeSub) && (
                          <td>{func ? func.nome : <span style={{ color: 'var(--muted)' }}>Não vinculado</span>}</td>
                        )}
                        {activeSub === 'Aso Demissional' && (
                          <td>{arq.dataExame ? new Date(arq.dataExame + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                        )}
                        <td>{arq.uploadedBy}</td>
                        <td>{arq.createdAt?.toDate ? new Date(arq.createdAt.toDate()).toLocaleDateString() : 'Recente'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {renderAnexoLinks(arq)}
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
                  <label>Data Demissional</label>
                  <input type="date" value={efetivoForm.dataDemissional || ''} onChange={e => setEfetivoForm({...efetivoForm, dataDemissional: e.target.value})} />
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
      <ReciboPrint holerites={holeritesParsed} mesAnoRef={holeriteMesAnoRef} />

      {/* Container fora da tela usado só para gerar o PDF de download (individual ou em massa) do Histórico Salvo */}
      <div ref={exportContainerRef} className="pdf-export-target" style={{ position: 'fixed', top: 0, left: '-99999px', zIndex: -1 }}>
        {exportHolerites && <ReciboPrint holerites={exportHolerites} mesAnoRef="" />}
      </div>

      {/* ═══ MODAL HOLERITE MANUAL ═══ */}
      {manualHoleriteModalOpen && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setManualHoleriteModalOpen(false)}></div>
          <form
            className="modal-form-card glass"
            style={{ zIndex: 10 }}
            onSubmit={(e) => { e.preventDefault(); adicionarHoleriteManual(); }}
          >
            <div className="modal-header">
              <h3>Novo Holerite Manual</h3>
              <button className="close" type="button" onClick={() => setManualHoleriteModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: 0 }}>
                Para colaboradores que não vêm no PDF da folha. Depois de adicionar, preencha Extra Folha, comissão e horas na tabela e salve normalmente.
              </p>
              <div className="form-group">
                <label>Colaborador *</label>
                <input
                  type="text"
                  required
                  list="efetivos-datalist"
                  value={manualHoleriteForm.nome}
                  onChange={e => {
                    const nome = e.target.value;
                    const ef = efetivos.find(x => x.nome === nome);
                    setManualHoleriteForm(prev => ({ ...prev, nome, cargo: ef?.cargo || prev.cargo }));
                  }}
                />
                <datalist id="efetivos-datalist">
                  {efetivos.map(ef => <option key={ef.id} value={ef.nome} />)}
                </datalist>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Cargo / Função</label>
                  <input type="text" value={manualHoleriteForm.cargo} onChange={e => setManualHoleriteForm(prev => ({ ...prev, cargo: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Salário Base</label>
                  <input type="number" step="0.01" value={manualHoleriteForm.salarioBase} onFocus={e => e.target.select()} onChange={e => setManualHoleriteForm(prev => ({ ...prev, salarioBase: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Total (Contracheque)</label>
                  <input type="number" step="0.01" value={manualHoleriteForm.totalVencimentosPdf} onFocus={e => e.target.select()} onChange={e => setManualHoleriteForm(prev => ({ ...prev, totalVencimentosPdf: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Valor Desconto</label>
                  <input type="number" step="0.01" value={manualHoleriteForm.totalDescontosPdf} onFocus={e => e.target.select()} onChange={e => setManualHoleriteForm(prev => ({ ...prev, totalDescontosPdf: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Extra Folha (opcional)</label>
                  <input type="number" step="0.01" value={manualHoleriteForm.extraFolha} onFocus={e => e.target.select()} onChange={e => setManualHoleriteForm(prev => ({ ...prev, extraFolha: e.target.value }))} />
                </div>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Valor Depósito = Total − Desconto = <strong>R$ {((Number(manualHoleriteForm.totalVencimentosPdf) || 0) - (Number(manualHoleriteForm.totalDescontosPdf) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" type="button" onClick={() => setManualHoleriteModalOpen(false)}>Cancelar</button>
              <button className="btn primary" type="submit">Adicionar à lista</button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ MODAL EXIBIR RECIBO ═══ */}
      {previewHolerite && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setPreviewHolerite(null)}></div>
          <div className="modal-form-card glass" style={{ zIndex: 10, maxWidth: '880px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>Recibo — {previewHolerite.nome}</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn outline sm"
                  disabled={isExportingPdf}
                  onClick={() => handleDownloadPdf([previewHolerite], `Recibo_${previewHolerite.nome}_${previewHolerite.mesAnoRef}.pdf`)}
                >
                  {isExportingPdf ? 'Gerando PDF...' : '⬇️ Baixar PDF'}
                </button>
                <button className="close" type="button" onClick={() => setPreviewHolerite(null)}>×</button>
              </div>
            </div>
            <div className="modal-body recibo-preview-modal" style={{ display: 'flex', justifyContent: 'center' }}>
              <ReciboPrint holerites={[previewHolerite]} mesAnoRef="" />
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL PLANILHA COMPLETA (holerite oficial + manual, colunas da "Folha de PG") ═══ */}
      {folhaCompletaHolerites && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setFolhaCompletaHolerites(null)}></div>
          <div className="modal-form-card glass" style={{ zIndex: 10, maxWidth: '95vw', width: '1400px', maxHeight: '92vh' }}>
            <div className="modal-header">
              <h3>Planilha Completa ({folhaCompletaHolerites.length})</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn outline sm"
                  onClick={() => exportFolhaPGXlsx(folhaCompletaHolerites, folhaCompletaHolerites[0]?.mesAnoRef, `Folha_de_PG_${folhaCompletaHolerites[0]?.mesAnoRef || 'sem-data'}.xlsx`)}
                >
                  📊 Baixar XLSX
                </button>
                <button className="close" type="button" onClick={() => setFolhaCompletaHolerites(null)}>×</button>
              </div>
            </div>
            <div className="modal-body">
              <FolhaCompletaTable holerites={folhaCompletaHolerites} />
            </div>
          </div>
        </div>
      )}

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
              ) : fileForm.subcategoria === 'Venda de sucatas' ? (
                <>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Mês/Ano de Referência *</label>
                      <input
                        type="month"
                        required
                        value={fileForm.mesAnoRef || ''}
                        onChange={e => setFileForm({ ...fileForm, mesAnoRef: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Valor Apurado (R$) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        placeholder="0,00"
                        value={fileForm.valor}
                        onChange={e => setFileForm({ ...fileForm, valor: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Título / Observação (opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: Venda de sucata metálica"
                      value={fileForm.titulo}
                      onChange={e => setFileForm({ ...fileForm, titulo: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Título do Documento *</label>
                    <input type="text" required placeholder="Ex: Treinamento de Integração" value={fileForm.titulo} onChange={e => setFileForm({...fileForm, titulo: e.target.value})} />
                  </div>
                  
                  {['Advertências', 'Folha de pagamento', 'Acidente do Trabalho'].includes(fileForm.subcategoria) && (
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
                <label>Anexos (PDF, Imagem, etc) — pode selecionar vários</label>

                {fileForm.anexosExistentes.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
                    {fileForm.anexosExistentes.map((a, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px' }}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer">📎 {a.name || `Anexo ${i + 1}`}</a>
                        <button type="button" className="btn ghost sm" style={{ padding: '0 6px', color: '#dc2626' }} onClick={() => removeAnexoExistente(i)}>remover</button>
                      </li>
                    ))}
                  </ul>
                )}

                {fileForm.files.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
                    {fileForm.files.map((f, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px' }}>
                        <span>⬆️ {f.name}</span>
                        <button type="button" className="btn ghost sm" style={{ padding: '0 6px', color: '#dc2626' }} onClick={() => removeNovoAnexo(i)}>remover</button>
                      </li>
                    ))}
                  </ul>
                )}

                <input type="file" multiple onChange={handleFileChange} />
                {!editingFileId && fileForm.anexosExistentes.length + fileForm.files.length === 0 && (
                  <small style={{ color: 'var(--muted)' }}>Selecione ao menos um arquivo.</small>
                )}
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

      {/* ═══ MODAL DETALHES E HISTÓRICO DE ASO ═══ */}
      {historyModalOpen && historyFunc && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setHistoryModalOpen(false)}></div>
          <div className="modal-form-card glass" style={{ zIndex: 10, maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h3>Detalhes — {historyFunc.typeName} ({historyFunc.ef.nome})</h3>
              <button className="close" type="button" onClick={() => setHistoryModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="table-wrap">
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Data Exame</th>
                      <th>Vencimento</th>
                      <th>Enviado Por</th>
                      <th>Data do Envio</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyFunc.files.map(file => {
                      const exDate = file.dataExame ? new Date(file.dataExame + 'T00:00:00') : null;
                      const vDate = file.dataVencimento ? new Date(file.dataVencimento + 'T00:00:00') : null;
                      const uploadDate = file.createdAt?.toDate ? new Date(file.createdAt.toDate()) : null;
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
                            <span style={{ fontSize: '12px', fontWeight: '500' }}>
                              {file.uploadedBy || file.createdBy || 'Sistema'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                              {uploadDate ? uploadDate.toLocaleDateString('pt-BR') + ' ' + uploadDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Recente'}
                            </span>
                          </td>
                          <td>
                            {statusObj ? (
                              <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', background: statusObj.bg, color: statusObj.color, fontWeight: 'bold' }}>
                                {statusObj.text}
                              </span>
                            ) : '-'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {renderAnexoLinks(file, 'sm')}
                              <button className="btn icon-only edit sm" title="Editar Documento/Datas" onClick={() => { setHistoryModalOpen(false); handleEditFile(file); }}>
                                <IconEdit />
                              </button>
                              <button className="btn icon-only danger sm" title="Excluir Documento" onClick={() => { handleDeleteFile(file); setHistoryModalOpen(false); }}>
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

      {/* ═══ LOADING MODAL PARA PDF ═══ */}
      {isParsingPdf && (
        <div className="modal show" style={{ zIndex: 9999 }}>
          <div className="modal-backdrop"></div>
          <div className="modal-form-card glass" style={{ textAlign: 'center', padding: '40px', maxWidth: '400px' }}>
            <div className="spinner" style={{ border: '4px solid rgba(0,0,0,0.1)', borderLeftColor: 'var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
            <h3 style={{ marginBottom: '8px' }}>Processando Holerites...</h3>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Lendo o arquivo PDF e extraindo os dados. Por favor, aguarde.</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}

      {/* ═══ ALERT MODAL CUSTOMIZADO ═══ */}
      {pdfAlertMsg && (
        <div className="modal show" style={{ zIndex: 10000 }}>
          <div className="modal-backdrop" onClick={() => setPdfAlertMsg(null)}></div>
          <div className="modal-form-card glass" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Aviso do Sistema</h3>
              <button className="close" onClick={() => setPdfAlertMsg(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px', fontSize: '14px', lineHeight: '1.6' }}>
              <p>{pdfAlertMsg}</p>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
              <button className="btn primary" onClick={() => setPdfAlertMsg(null)} style={{ width: '100%' }}>Entendi</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PainelAdministrativo;
