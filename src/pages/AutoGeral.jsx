import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAutoGeral } from '../context/AutoGeralContext';
import TopNav from '../components/TopNav';
import ProgressModal from '../components/ProgressModal';
import { IconPrinter, IconEdit, IconTrash, IconPlus, IconSearch, IconExcel, IconCheck } from '../components/Icons';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import '../styles/autogeral.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

const AutoGeral = ({ onBackToGateway }) => {
  const { currentUser } = useAuth();
  const {
    servicos, compras, boletos, recebiveis, loading, caixa, MONTHS,
    addServico, updateServico, deleteServico,
    addCompra, updateCompra, deleteCompra,
    addBoleto, updateBoleto, deleteBoleto,
    toggleRecebivel, deleteRecebivel,
    importServicosFromExcel, importComprasFromExcel, importBoletosFromExcel,
    consolidado, rawQueriesActive, enableRawQueries
  } = useAutoGeral();

  // Theme
  const [whiteTheme, setWhiteTheme] = useState(() =>
    localStorage.getItem('pernambucana.financeDashboard.theme.v1') === 'white'
  );
  useEffect(() => {
    document.body.classList.toggle('theme-white', whiteTheme);
    localStorage.setItem('pernambucana.financeDashboard.theme.v1', whiteTheme ? 'white' : 'black');
  }, [whiteTheme]);

  // Today's date string
  const hoje = new Date().toISOString().split('T')[0];

  // Tabs
  const [activeTab, setActiveTab] = useState(() => {
    return currentUser?.isAdmin ? 'dashboard' : 'servicos';
  });

  useEffect(() => {
    if (activeTab !== 'dashboard' && enableRawQueries) {
      enableRawQueries();
    }
  }, [activeTab, enableRawQueries]);

  // Filters
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [dayFilter, setDayFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const triggerToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 2600); };

  // Submission & Progress modal states
  const isSubmittingRef = useRef(false);
  const [isSavingServico, setIsSavingServico] = useState(false);
  const [isSavingCompra, setIsSavingCompra] = useState(false);
  const [isSavingBoleto, setIsSavingBoleto] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingGrid, setIsSavingGrid] = useState(false);
  const [progressModal, setProgressModal] = useState({ open: false, title: '', current: 0, total: 0, message: '', subMessage: '' });

  // Modals
  const [servicoModal, setServicoModal] = useState(false);
  const [servicoEditId, setServicoEditId] = useState(null);
  const [servicoForm, setServicoForm] = useState({
    data: '', formaCompra: 'Pix', nomeCliente: '', descricaoMaterial: '',
    numOS: '', valorOS: 0, valorServicos: 0, valorPecas: 0, valorMaterial: 0,
    mecanico: '', ano: new Date().getFullYear(), numParcelas: 0
  });

  const [compraModal, setCompraModal] = useState(false);
  const [compraEditId, setCompraEditId] = useState(null);
  const [compraForm, setCompraForm] = useState({
    data: '', formaCompra: 'Pix', nomeCliente: '', descricaoMaterial: '',
    numOS: '', valorOS: 0, valorPeca: 0, fornecedor: '', numPedido: '', categoria: 'Oficina'
  });

  const [boletoModal, setBoletoModal] = useState(false);
  const [boletoEditId, setBoletoEditId] = useState(null);
  const [boletoForm, setBoletoForm] = useState({
    nomeFornecedor: '', descricaoMaterial: '', numOS: '', valorBoleto: 0,
    valorOS: 0, nomeCliente: '', dataVencimento: '', mesVencimento: '',
    qtdBoletos: 1, datasVencimento: []
  });

  const [importModal, setImportModal] = useState(false);
  const [importType, setImportType] = useState('servicos');
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [parsedImportItems, setParsedImportItems] = useState([]);

  // Duplicate check modal state
  const [duplicateModal, setDuplicateModal] = useState(false);
  const [duplicateTab, setDuplicateTab] = useState('servicos');
  const [selectedDuplicates, setSelectedDuplicates] = useState([]);

  // Grid/Excel Edit Mode
  const [gridEditMode, setGridEditMode] = useState(false);
  const [gridChanges, setGridChanges] = useState({});

  const handleGridCellChange = (itemId, field, value) => {
    setGridChanges(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const saveGridChanges = async () => {
    const changedIds = Object.keys(gridChanges);
    if (changedIds.length === 0 || isSubmittingRef.current) {
      setGridEditMode(false);
      return;
    }
    isSubmittingRef.current = true;
    setIsSavingGrid(true);
    setProgressModal({
      open: true,
      title: 'Salvando Edições em Linha',
      current: 0,
      total: changedIds.length,
      message: 'Iniciando atualização de linhas...',
      subMessage: 'Gravando dados no banco. Por favor, aguarde.'
    });
    try {
      for (let i = 0; i < changedIds.length; i++) {
        const id = changedIds[i];
        const changes = gridChanges[id];

        setProgressModal({
          open: true,
          title: 'Salvando Edições em Linha',
          current: i + 1,
          total: changedIds.length,
          message: `Atualizando item ${i + 1} de ${changedIds.length}...`,
          subMessage: 'Gravando dados no banco. Por favor, aguarde.'
        });
        
        // Clean numeric inputs
        if ('valorOS' in changes) changes.valorOS = parseFloat(changes.valorOS) || 0;
        if ('valorServicos' in changes) changes.valorServicos = parseFloat(changes.valorServicos) || 0;
        if ('valorPecas' in changes) changes.valorPecas = parseFloat(changes.valorPecas) || 0;
        if ('valorMaterial' in changes) changes.valorMaterial = parseFloat(changes.valorMaterial) || 0;
        if ('valorPeca' in changes) changes.valorPeca = parseFloat(changes.valorPeca) || 0;
        if ('valorBoleto' in changes) changes.valorBoleto = parseFloat(changes.valorBoleto) || 0;
        if ('numParcelas' in changes) changes.numParcelas = parseInt(changes.numParcelas) || 0;
        if ('ano' in changes) changes.ano = parseInt(changes.ano) || new Date().getFullYear();

        if (activeTab === 'servicos') {
          await updateServico(id, changes);
        } else if (activeTab === 'compras') {
          await updateCompra(id, changes);
        } else if (activeTab === 'boletos') {
          await updateBoleto(id, changes);
        }
      }
      
      setGridChanges({});
      setGridEditMode(false);
      triggerToast('Alterações salvas com sucesso.');
    } catch (err) {
      alert('Erro ao salvar alterações: ' + err.message);
    } finally {
      setIsSavingGrid(false);
      isSubmittingRef.current = false;
      setProgressModal(prev => ({ ...prev, open: false }));
    }
  };

  const discardGridChanges = () => {
    setGridChanges({});
    setGridEditMode(false);
    triggerToast('Alterações descartadas.');
  };

  // Money formatter
  const fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  // Date formatter
  const formatDateBR = (dateStr) => {
    if (!dateStr) return '-';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const getMonthName = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const monthIndex = parseInt(parts[1], 10) - 1;
      return MONTHS[monthIndex]?.toLowerCase() || '-';
    }
    return '-';
  };

  // Get duplicate groups for AutoGeral (using AutoGeral specific key fields)
  const getDuplicateGroups = useMemo(() => {
    const getServicosDuplicates = () => {
      const groups = {};
      servicos.forEach(s => {
        const clienteNorm = String(s.nomeCliente || '').trim().toLowerCase();
        const valorNorm = parseFloat(s.valorOS) || 0;
        const refNorm = String(s.numOS ? s.numOS : (s.descricaoMaterial || '')).trim().toLowerCase();
        const key = `${s.data || ''}|${clienteNorm}|${valorNorm}|${refNorm}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
      });
      return Object.values(groups).filter(g => g.length > 1);
    };

    const getComprasDuplicates = () => {
      const groups = {};
      compras.forEach(c => {
        const fornecedorNorm = String(c.fornecedor || '').trim().toLowerCase();
        const valorNorm = parseFloat(c.valorPeca) || 0;
        const descNorm = String(c.descricao || '').trim().toLowerCase();
        const key = `${c.data || ''}|${fornecedorNorm}|${valorNorm}|${descNorm}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
      });
      return Object.values(groups).filter(g => g.length > 1);
    };

    const getBoletosDuplicates = () => {
      const groups = {};
      boletos.forEach(b => {
        const fornecedorNorm = String(b.fornecedor || '').trim().toLowerCase();
        const valorNorm = parseFloat(b.valorBoleto) || 0;
        const descNorm = String(b.descricao || '').trim().toLowerCase();
        const key = `${b.dataVencimento || ''}|${fornecedorNorm}|${valorNorm}|${descNorm}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(b);
      });
      return Object.values(groups).filter(g => g.length > 1);
    };

    return {
      servicos: getServicosDuplicates(),
      compras: getComprasDuplicates(),
      boletos: getBoletosDuplicates()
    };
  }, [servicos, compras, boletos]);

  // Pre-select duplicates when modal opens or active sub-tab switches
  useEffect(() => {
    if (!duplicateModal) {
      setSelectedDuplicates([]);
      return;
    }
    const groups = getDuplicateGroups[duplicateTab] || [];
    const toSelect = [];
    groups.forEach(group => {
      const sortedGroup = [...group].sort((a, b) => {
        const dateA = a.criadoEm ? new Date(a.criadoEm) : new Date(0);
        const dateB = b.criadoEm ? new Date(b.criadoEm) : new Date(0);
        return dateA - dateB;
      });
      for (let i = 1; i < sortedGroup.length; i++) {
        toSelect.push(sortedGroup[i].id);
      }
    });
    setSelectedDuplicates(toSelect);
  }, [duplicateTab, duplicateModal]);

  const handleDeleteSelectedDuplicates = async () => {
    if (selectedDuplicates.length === 0) return;
    if (!window.confirm(`Tem certeza que deseja excluir os ${selectedDuplicates.length} registros duplicados selecionados? Esta ação é irreversível.`)) return;

    try {
      if (duplicateTab === 'servicos') {
        await Promise.all(selectedDuplicates.map(id => deleteServico(id)));
      } else if (duplicateTab === 'compras') {
        await Promise.all(selectedDuplicates.map(id => deleteCompra(id)));
      } else if (duplicateTab === 'boletos') {
        await Promise.all(selectedDuplicates.map(id => deleteBoleto(id)));
      }
      triggerToast(`${selectedDuplicates.length} registros excluídos com sucesso.`);
      setSelectedDuplicates([]);
    } catch (error) {
      console.error("Erro ao excluir duplicados:", error);
      alert("Ocorreu um erro ao excluir alguns registros. Por favor, tente novamente.");
    }
  };

  // Reset pagination and filters on tab change
  useEffect(() => {
    setCurrentPage(1);
    setGridEditMode(false);
    setGridChanges({});
    setDayFilter('all');
  }, [activeTab]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [monthFilter, yearFilter, dayFilter, searchQuery, statusFilter]);

  // Extract years dynamically from data
  const yearsList = useMemo(() => {
    const years = new Set();
    servicos.forEach(s => s.data && years.add(s.data.split('-')[0]));
    compras.forEach(c => c.data && years.add(c.data.split('-')[0]));
    boletos.forEach(b => b.dataVencimento && years.add(b.dataVencimento.split('-')[0]));
    recebiveis.forEach(r => r.dataVencimento && years.add(r.dataVencimento.split('-')[0]));
    
    // Fallback current and previous year
    years.add(String(new Date().getFullYear()));
    years.add(String(new Date().getFullYear() - 1));
    
    return Array.from(years).filter(Boolean).sort((a, b) => b - a);
  }, [servicos, compras, boletos, recebiveis]);

  // Recalculate Caixa stats dynamically based on month and year filters
  const dashboardStats = useMemo(() => {
    if (!rawQueriesActive) {
      let totalServicos = 0;
      let totalServicoVista = 0;
      let totalRecebido = 0;
      let totalPendente = 0;
      let totalVencido = 0;
      let totalBoletos = 0;
      let totalCompras = 0;
      let entradas = 0;
      let saidas = 0;
      let saldo = 0;
      let recebiveisVencidos = 0;
      let recebiveisPendentes = 0;
      let recebiveisRecebidos = 0;

      consolidado.forEach(docData => {
        const docY = docData.ano;
        const docM = docData.mesNum;
        const matchMonth = monthFilter === 'all' || String(docM) === monthFilter;
        const matchYear = yearFilter === 'all' || String(docY) === yearFilter;
        
        if (matchMonth && matchYear) {
          totalServicos += (docData.totalServicos || 0);
          totalServicoVista += (docData.totalServicoVista || 0);
          totalRecebido += (docData.totalRecebido || 0);
          totalPendente += (docData.totalPendente || 0);
          totalVencido += (docData.totalVencido || 0);
          totalBoletos += (docData.totalBoletos || 0);
          totalCompras += (docData.totalCompras || 0);
          entradas += (docData.entradas || 0);
          saidas += (docData.saidas || 0);
          saldo += (docData.saldo || 0);
          recebiveisVencidos += (docData.recebiveisVencidosCount || 0);
          recebiveisPendentes += (docData.recebiveisPendentesCount || 0);
          recebiveisRecebidos += (docData.recebiveisRecebidosCount || 0);
        }
      });

      return {
        totalServicos,
        totalServicoVista,
        totalRecebido,
        totalPendente,
        totalVencido,
        totalBoletos,
        totalCompras,
        entradas,
        saidas,
        saldo,
        recebiveisVencidos,
        recebiveisPendentes,
        recebiveisRecebidos,
        sFiltered: [],
        bFiltered: [],
        rFiltered: [],
        cFiltered: []
      };
    }

    const filterByMonthYear = (item, dateField) => {
      const dateStr = item[dateField];
      if (!dateStr) return false;
      const y = dateStr.split('-')[0];
      const m = parseInt(dateStr.split('-')[1], 10);
      
      const matchMonth = monthFilter === 'all' || String(m) === monthFilter;
      const matchYear = yearFilter === 'all' || String(y) === yearFilter;
      return matchMonth && matchYear;
    };

    const sFiltered = servicos.filter(s => filterByMonthYear(s, 'data'));
    const cFiltered = compras.filter(c => filterByMonthYear(c, 'data'));
    const bFiltered = boletos.filter(b => filterByMonthYear(b, 'dataVencimento'));
    
    const rFiltered = recebiveis.filter(r => {
      if (r.status === 'Recebido') {
        const fieldName = r.dataRecebimento ? 'dataRecebimento' : 'dataVencimento';
        return filterByMonthYear(r, fieldName);
      } else {
        return filterByMonthYear(r, 'dataVencimento');
      }
    });

    const totalServicos = sFiltered.reduce((sum, s) => sum + (parseFloat(s.valorOS) || 0), 0);
    
    const servicosVista = sFiltered.filter(s => {
      const forma = String(s.formaCompra || '').toLowerCase();
      return !forma.includes('prazo');
    });
    const totalServicoVista = servicosVista.reduce((sum, s) => sum + (parseFloat(s.valorOS) || 0), 0);

    const recebiveisRecebidos = rFiltered.filter(r => r.status === 'Recebido');
    const totalRecebido = recebiveisRecebidos.reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);

    const recebivelPendentes = rFiltered.filter(r => r.status === 'Pendente');
    const totalPendente = recebivelPendentes.reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);

    const hojeStr = new Date().toISOString().split('T')[0];
    const recebiveisVencidos = recebivelPendentes.filter(r => r.dataVencimento < hojeStr);
    const totalVencido = recebiveisVencidos.reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);

    const totalBoletos = bFiltered.reduce((sum, b) => sum + (parseFloat(b.valorBoleto) || 0), 0);
    const totalCompras = cFiltered.reduce((sum, c) => sum + (parseFloat(c.valorPeca) || 0), 0);

    const entradas = totalServicoVista + totalRecebido;
    const saidas = totalBoletos;
    const saldo = entradas - saidas;

    return {
      totalServicos,
      totalServicoVista,
      totalRecebido,
      totalPendente,
      totalVencido,
      totalBoletos,
      totalCompras,
      entradas,
      saidas,
      saldo,
      recebiveisVencidos: recebiveisVencidos.length,
      recebiveisPendentes: recebivelPendentes.length,
      recebiveisRecebidos: recebiveisRecebidos.length,
      sFiltered,
      bFiltered,
      rFiltered,
      cFiltered
    };
  }, [servicos, compras, boletos, recebiveis, monthFilter, yearFilter, rawQueriesActive, consolidado]);

  // ── FILTERING ──
  const filterList = (list, extraFilter) => {
    return list.filter(item => {
      const dateStr = item.data || item.dataVencimento;
      const yNum = dateStr ? dateStr.split('-')[0] : '';
      const mNum = item.mesNum || (dateStr ? parseInt(dateStr.split('-')[1], 10) : null);
      const dNum = dateStr ? parseInt(dateStr.split('-')[2], 10) : null;
      
      const matchMonth = monthFilter === 'all' || String(mNum) === monthFilter;
      const matchYear = yearFilter === 'all' || String(yNum) === yearFilter;
      const matchDay = dayFilter === 'all' || String(dNum) === dayFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || Object.values(item).join(' ').toLowerCase().includes(q);
      const extra = extraFilter ? extraFilter(item) : true;
      return matchMonth && matchYear && matchDay && matchSearch && extra;
    });
  };

  const filteredServicos = useMemo(() => filterList(servicos), [servicos, monthFilter, yearFilter, dayFilter, searchQuery]);
  const filteredCompras = useMemo(() => filterList(compras), [compras, monthFilter, yearFilter, dayFilter, searchQuery]);
  const filteredBoletos = useMemo(() => filterList(boletos), [boletos, monthFilter, yearFilter, dayFilter, searchQuery]);
  const filteredRecebiveis = useMemo(() => filterList(recebiveis, (item) => {
    if (statusFilter === 'all') return true;
    const isVencido = item.status === 'Pendente' && item.dataVencimento < hoje;
    if (statusFilter === 'Pendente') {
      return item.status === 'Pendente' && !isVencido;
    }
    if (statusFilter === 'Vencido') {
      return isVencido;
    }
    return item.status === statusFilter;
  }), [recebiveis, monthFilter, yearFilter, dayFilter, searchQuery, statusFilter, hoje]);

  // Pagination helper
  const paginate = (list) => {
    if (gridEditMode) {
      return { paginated: list, totalPages: 1, page: 1, total: list.length };
    }
    const totalPages = Math.ceil(list.length / itemsPerPage) || 1;
    const page = Math.min(currentPage, totalPages);
    const paginated = list.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    return { paginated, totalPages, page, total: list.length };
  };

  // ── SERVIÇO ACTIONS ──
  const openAddServico = () => {
    setServicoEditId(null);
    setServicoForm({
      data: new Date().toISOString().split('T')[0], formaCompra: 'Pix',
      nomeCliente: '', descricaoMaterial: '', numOS: '', valorOS: 0,
      valorServicos: 0, valorPecas: 0, valorMaterial: 0,
      mecanico: '', ano: new Date().getFullYear(), numParcelas: 0
    });
    setServicoModal(true);
  };

  const openEditServico = (item) => {
    setServicoEditId(item.id);
    setServicoForm({
      data: item.data || '', formaCompra: item.formaCompra || 'Pix',
      nomeCliente: item.nomeCliente || '', descricaoMaterial: item.descricaoMaterial || '',
      numOS: item.numOS || '', valorOS: item.valorOS || 0,
      valorServicos: item.valorServicos || 0, valorPecas: item.valorPecas || 0,
      valorMaterial: item.valorMaterial || 0, mecanico: item.mecanico || '',
      ano: item.ano || new Date().getFullYear(), numParcelas: item.numParcelas || 0
    });
    setServicoModal(true);
  };

  const handleServicoSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSavingServico(true);
    setProgressModal({
      open: true,
      title: servicoEditId ? 'Atualizando Serviço' : 'Cadastrando Serviço',
      current: 0,
      total: 0,
      message: 'Gravando dados do serviço...',
      subMessage: 'Por favor, aguarde a gravação no banco de dados.'
    });
    try {
      if (servicoEditId) {
        await updateServico(servicoEditId, servicoForm);
        triggerToast('Serviço atualizado.');
      } else {
        await addServico(servicoForm);
        triggerToast('Serviço cadastrado' + (String(servicoForm.formaCompra).toLowerCase().includes('prazo') && servicoForm.numParcelas > 0 ? ` com ${servicoForm.numParcelas} recebíveis gerados.` : '.'));
      }
      setServicoModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSavingServico(false);
      isSubmittingRef.current = false;
      setProgressModal(prev => ({ ...prev, open: false }));
    }
  };

  // ── COMPRA ACTIONS ──
  const openAddCompra = () => {
    setCompraEditId(null);
    setCompraForm({
      data: new Date().toISOString().split('T')[0], formaCompra: 'Pix',
      nomeCliente: '', descricaoMaterial: '', numOS: '', valorOS: 0,
      valorPeca: 0, fornecedor: '', numPedido: '', categoria: 'Oficina'
    });
    setCompraModal(true);
  };

  const openEditCompra = (item) => {
    setCompraEditId(item.id);
    setCompraForm({
      data: item.data || '', formaCompra: item.formaCompra || 'Pix',
      nomeCliente: item.nomeCliente || '', descricaoMaterial: item.descricaoMaterial || '',
      numOS: item.numOS || '', valorOS: item.valorOS || 0,
      valorPeca: item.valorPeca || 0, fornecedor: item.fornecedor || '',
      numPedido: item.numPedido || '', categoria: item.categoria || 'Oficina'
    });
    setCompraModal(true);
  };

  const handleCompraSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSavingCompra(true);
    setProgressModal({
      open: true,
      title: compraEditId ? 'Atualizando Compra' : 'Registrando Compra',
      current: 0,
      total: 0,
      message: 'Gravando dados da compra...',
      subMessage: 'Por favor, aguarde a gravação no banco de dados.'
    });
    try {
      if (compraEditId) {
        await updateCompra(compraEditId, compraForm);
        triggerToast('Compra atualizada.');
      } else {
        await addCompra(compraForm);
        triggerToast('Compra registrada.');
      }
      setCompraModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSavingCompra(false);
      isSubmittingRef.current = false;
      setProgressModal(prev => ({ ...prev, open: false }));
    }
  };

  // ── BOLETO ACTIONS ──
  const openAddBoleto = () => {
    setBoletoEditId(null);
    const hoje = new Date().toISOString().split('T')[0];
    setBoletoForm({
      nomeFornecedor: '', descricaoMaterial: '', numOS: '', valorBoleto: 0,
      valorOS: 0, nomeCliente: '', dataVencimento: hoje, mesVencimento: '',
      qtdBoletos: 1, datasVencimento: [hoje]
    });
    setBoletoModal(true);
  };

  const openEditBoleto = (item) => {
    setBoletoEditId(item.id);
    const itemVenc = item.dataVencimento || '';
    setBoletoForm({
      nomeFornecedor: item.nomeFornecedor || '', descricaoMaterial: item.descricaoMaterial || '',
      numOS: item.numOS || '', valorBoleto: item.valorBoleto || 0, valorOS: item.valorOS || 0,
      nomeCliente: item.nomeCliente || '', dataVencimento: itemVenc,
      mesVencimento: item.mesVencimento || '',
      qtdBoletos: 1, datasVencimento: [itemVenc]
    });
    setBoletoModal(true);
  };

  const handleBoletoSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSavingBoleto(true);
    setProgressModal({
      open: true,
      title: boletoEditId ? 'Atualizando Boleto' : 'Registrando Boleto',
      current: 0,
      total: 0,
      message: 'Gravando dados do boleto...',
      subMessage: 'Por favor, aguarde a gravação no banco de dados.'
    });
    try {
      if (boletoEditId) {
        const payload = { ...boletoForm };
        delete payload.qtdBoletos;
        delete payload.datasVencimento;
        await updateBoleto(boletoEditId, payload);
        triggerToast('Boleto atualizado.');
      } else {
        const count = Math.max(1, parseInt(boletoForm.qtdBoletos) || 1);
        const dates = boletoForm.datasVencimento || [];
        for (let i = 0; i < count; i++) {
          const venc = dates[i] || boletoForm.dataVencimento || '';
          let mes = boletoForm.mesVencimento;
          if (!mes && venc) {
            const mIdx = new Date(venc + 'T12:00:00').getMonth();
            if (!isNaN(mIdx)) mes = MONTHS[mIdx]?.toLowerCase();
          }
          const payload = {
            ...boletoForm,
            dataVencimento: venc,
            mesVencimento: mes || boletoForm.mesVencimento
          };
          delete payload.qtdBoletos;
          delete payload.datasVencimento;
          await addBoleto(payload);
        }
        triggerToast(`${count} ${count > 1 ? 'boletos registrados' : 'boleto registrado'}.`);
      }
      setBoletoModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSavingBoleto(false);
      isSubmittingRef.current = false;
      setProgressModal(prev => ({ ...prev, open: false }));
    }
  };

  // ── EXCEL IMPORT ──
  const parseExcelNumber = (v) => {
    let s = String(v ?? '').trim();
    if (!s || s === '-') return 0;
    s = s.replace(/R\$/gi, '').replace(/\s/g, '');
    if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
    return parseFloat(s) || 0;
  };

  const parseExcelDate = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return '';
    // Match standard DD/MM/YYYY or MM/DD/YYYY or DD.MM.YYYY formats
    const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (m) {
      const p1 = parseInt(m[1], 10);
      const p2 = parseInt(m[2], 10);
      const year = m[3];
      if (p1 > 12) {
        // If first part is > 12, it must be Day (DD/MM/YYYY)
        return `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      } else if (p2 > 12) {
        // If second part is > 12, it must be Day (MM/DD/YYYY)
        return `${year}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
      } else {
        // Default to DD/MM/YYYY for ambiguous cases, but standardizing on Year-Month-Day
        return `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }
    }
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  };

  const cleanCell = (v) => {
    let s = String(v ?? '').trim();
    return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
  };

  const handleImportParse = (text, type = importType) => {
    setImportText(text);
    if (!text.trim()) { setImportPreview(null); setParsedImportItems([]); return; }

    const lines = text.split(/\r?\n/).map(l => l.split('\t')).filter(cols => cols.length > 1 || (cols.length === 1 && cols[0].trim() !== ''));
    let startIndex = 0;
    const firstRowHasHeaders = lines[0] && lines[0].some(cell => {
      const c = String(cell || '').trim().toLowerCase();
      return ['data', 'mês', 'mes', 'forma', 'cliente', 'material', 'fornecedor', 'valor', 'boleto', 'vencimento'].includes(c);
    });
    if (firstRowHasHeaders) startIndex = 1;

    if (lines.length <= startIndex) {
      setImportPreview(<span style={{ color: 'var(--red)' }}>Nenhum dado válido encontrado.</span>);
      setParsedImportItems([]);
      return;
    }

    const parsedList = [];
    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i];
      if (cols.length === 1 && cols[0].trim() === '') continue;

      if (type === 'servicos') {
        while (cols.length < 14) cols.push('');
        parsedList.push({
          data: parseExcelDate(cols[0]),
          formaCompra: cleanCell(cols[3]) || 'Pix',
          nomeCliente: cleanCell(cols[4]),
          descricaoMaterial: cleanCell(cols[5]),
          numOS: cleanCell(cols[6]),
          valorOS: parseExcelNumber(cols[7]),
          valorServicos: parseExcelNumber(cols[8]),
          valorPecas: parseExcelNumber(cols[9]),
          valorMaterial: parseExcelNumber(cols[10]),
          mecanico: cleanCell(cols[11]),
          ano: parseInt(cleanCell(cols[12])) || new Date().getFullYear(),
          numParcelas: parseInt(cleanCell(cols[13])) || 0
        });
      } else if (type === 'compras') {
        while (cols.length < 12) cols.push('');
        parsedList.push({
          data: parseExcelDate(cols[0]),
          formaCompra: cleanCell(cols[3]) || 'Pix',
          nomeCliente: cleanCell(cols[4]),
          descricaoMaterial: cleanCell(cols[5]),
          numOS: cleanCell(cols[6]),
          valorOS: parseExcelNumber(cols[7]),
          valorPeca: parseExcelNumber(cols[8]),
          fornecedor: cleanCell(cols[9]),
          numPedido: cleanCell(cols[10]),
          categoria: cleanCell(cols[11]) || 'Oficina'
        });
      } else if (type === 'boletos') {
        while (cols.length < 9) cols.push('');
        parsedList.push({
          nomeFornecedor: cleanCell(cols[1]),
          descricaoMaterial: cleanCell(cols[2]),
          valorBoleto: parseExcelNumber(cols[3]),
          valorOS: parseExcelNumber(cols[4]),
          nomeCliente: cleanCell(cols[5]),
          dataVencimento: parseExcelDate(cols[6]),
          mesVencimento: cleanCell(cols[7]) || '',
          numOS: cleanCell(cols[8]) || ''
        });
      }
    }

    setParsedImportItems(parsedList);
    const typeLabel = type === 'servicos' ? 'Serviços' : type === 'compras' ? 'Compras' : 'Boletos';
    setImportPreview(
      <div style={{ color: 'var(--green)', textAlign: 'left' }}>
        <strong>✔ Formato:</strong> {typeLabel}<br/>
        <strong>📊 Registros:</strong> {parsedList.length} linhas prontas para importar.<br/>
        <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>Clique em "Confirmar Importação" para salvar no Firebase.</small>
      </div>
    );
  };

  const openImportModal = () => {
    const defaultType = ['servicos', 'compras', 'boletos'].includes(activeTab) ? activeTab : 'servicos';
    setImportType(defaultType);
    setImportText('');
    setImportPreview(null);
    setParsedImportItems([]);
    setImportModal(true);
  };

  const confirmImport = async () => {
    if (parsedImportItems.length === 0 || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsImporting(true);
    setProgressModal({
      open: true,
      title: 'Importando Planilha Auto Geral',
      current: 0,
      total: parsedImportItems.length,
      message: 'Iniciando gravação no banco de dados...',
      subMessage: 'Gravando lançamentos no banco de dados. Não feche a página para evitar duplicidades.'
    });
    try {
      let count = 0;
      if (importType === 'servicos') count = await importServicosFromExcel(parsedImportItems);
      else if (importType === 'compras') count = await importComprasFromExcel(parsedImportItems);
      else if (importType === 'boletos') count = await importBoletosFromExcel(parsedImportItems);
      triggerToast(`${count} registros importados com sucesso.`);
      setImportModal(false);
      setImportText('');
      setImportPreview(null);
      setParsedImportItems([]);
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      setIsImporting(false);
      isSubmittingRef.current = false;
      setProgressModal(prev => ({ ...prev, open: false }));
    }
  };

  // ── CHART HELPERS ──
  const getChartColors = () => ({
    axis: whiteTheme ? '#526276' : '#b9c6d7',
    grid: whiteTheme ? 'rgba(9,33,51,.08)' : 'rgba(255,255,255,.05)',
    legend: whiteTheme ? '#203449' : '#dfeaf7',
    labelColor: whiteTheme ? '#102033' : '#ffffff'
  });

  const barOptions = (hideLegend = true) => {
    const colors = getChartColors();
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: !hideLegend, position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', color: colors.legend, font: { family: 'Inter', weight: '600', size: 11 } } },
        tooltip: {
          backgroundColor: whiteTheme ? 'rgba(255,255,255,.98)' : 'rgba(13,34,51,.98)',
          titleColor: whiteTheme ? '#092133' : '#fff', bodyColor: whiteTheme ? '#092133' : '#fff',
          borderColor: colors.grid, borderWidth: 1, padding: 10, cornerRadius: 8,
          callbacks: { label: (ctx) => `${ctx.dataset.label || ''}: ${fmtMoney.format(ctx.raw)}` }
        },
        datalabels: {
          display: true, color: colors.labelColor, font: { family: 'Inter', weight: 'bold', size: 9 },
          formatter: (v) => !v ? '' : v >= 1000 ? `R$ ${(v/1000).toFixed(0)}k` : `R$ ${v.toFixed(0)}`
        }
      },
      scales: {
        x: { grid: { color: colors.grid, drawBorder: false }, ticks: { color: colors.axis, font: { size: 9 } } },
        y: { grid: { color: colors.grid, drawBorder: false }, ticks: { color: colors.axis, font: { size: 9 } } }
      }
    };
  };

  const pieOptions = () => {
    const colors = getChartColors();
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', color: colors.legend, font: { family: 'Inter', weight: '600', size: 10 } } },
        tooltip: {
          backgroundColor: whiteTheme ? 'rgba(255,255,255,.98)' : 'rgba(13,34,51,.98)',
          titleColor: whiteTheme ? '#092133' : '#fff', bodyColor: whiteTheme ? '#092133' : '#fff',
          callbacks: { label: (ctx) => `${ctx.label}: ${fmtMoney.format(ctx.raw)}` }
        },
        datalabels: {
          display: true, color: '#fff', font: { family: 'Inter', weight: 'bold', size: 10 },
          formatter: (v, ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            return total ? ((v / total) * 100).toFixed(0) + '%' : '';
          }
        }
      }
    };
  };

  // ── CHART DATA ──
  const chartCaixaMensal = useMemo(() => {
    if (!rawQueriesActive) {
      const months = Array.from({ length: 12 }, (_, i) => i + 1);
      const dataEntradas = months.map(n => {
        const docsForMonth = consolidado.filter(d => parseInt(d.mesNum, 10) === n && (yearFilter === 'all' || String(d.ano) === yearFilter));
        return docsForMonth.reduce((sum, d) => sum + (d.entradas || 0), 0);
      });
      const dataSaidas = months.map(n => {
        const docsForMonth = consolidado.filter(d => parseInt(d.mesNum, 10) === n && (yearFilter === 'all' || String(d.ano) === yearFilter));
        return docsForMonth.reduce((sum, d) => sum + (d.saidas || 0), 0);
      });
      return {
        labels: months.map(n => MONTHS[n - 1].slice(0, 3)),
        datasets: [
          { label: 'Entradas', data: dataEntradas, backgroundColor: 'rgba(78,226,71,.8)', borderRadius: 8 },
          { label: 'Saídas', data: dataSaidas, backgroundColor: 'rgba(244,63,94,.8)', borderRadius: 8 }
        ]
      };
    }

    // Filter arrays by selected year for the monthly overview chart
    const sForYear = servicos.filter(s => {
      const y = s.data ? s.data.split('-')[0] : '';
      return yearFilter === 'all' || y === yearFilter;
    });
    const bForYear = boletos.filter(b => {
      const y = b.dataVencimento ? b.dataVencimento.split('-')[0] : '';
      return yearFilter === 'all' || y === yearFilter;
    });
    const rForYear = recebiveis.filter(r => {
      const dateStr = r.dataRecebimento || r.dataVencimento || '';
      const y = dateStr ? dateStr.split('-')[0] : '';
      return yearFilter === 'all' || y === yearFilter;
    });

    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const dataEntradas = months.map(n => {
      const sv = sForYear.filter(s => {
        const m = s.data ? parseInt(s.data.split('-')[1], 10) : null;
        return m === n && !String(s.formaCompra || '').toLowerCase().includes('prazo');
      });
      const recM = rForYear.filter(r => {
        const m = (r.dataRecebimento || r.dataVencimento || '').split('-')[1];
        return r.status === 'Recebido' && parseInt(m, 10) === n;
      });
      return sv.reduce((s, x) => s + (parseFloat(x.valorOS) || 0), 0) + recM.reduce((s, x) => s + (parseFloat(x.valorParcela) || 0), 0);
    });

    const dataSaidas = months.map(n => {
      const bm = bForYear.filter(b => {
        const m = b.dataVencimento ? parseInt(b.dataVencimento.split('-')[1], 10) : null;
        return m === n;
      });
      return bm.reduce((s, x) => s + (parseFloat(x.valorBoleto) || 0), 0);
    });

    return {
      labels: months.map(n => MONTHS[n - 1].slice(0, 3)),
      datasets: [
        { label: 'Entradas', data: dataEntradas, backgroundColor: 'rgba(78,226,71,.8)', borderRadius: 8 },
        { label: 'Saídas', data: dataSaidas, backgroundColor: 'rgba(244,63,94,.8)', borderRadius: 8 }
      ]
    };
  }, [servicos, boletos, recebiveis, yearFilter, consolidado, rawQueriesActive]);

  const chartFormaPgto = useMemo(() => {
    if (!rawQueriesActive) {
      let pix = 0, cartao = 0, prazo = 0;
      consolidado.forEach(docData => {
        const docY = docData.ano;
        const docM = docData.mesNum;
        const matchMonth = monthFilter === 'all' || String(docM) === monthFilter;
        const matchYear = yearFilter === 'all' || String(docY) === yearFilter;
        if (matchMonth && matchYear) {
          const f = docData.formaPgto || {};
          pix += (f.pix || 0);
          cartao += (f.cartao || 0);
          prazo += (f.prazo || 0);
        }
      });
      return {
        labels: ['Pix', 'Cartão', 'À Prazo'],
        datasets: [{ data: [pix, cartao, prazo], backgroundColor: ['rgba(78,226,71,.85)', 'rgba(59,130,246,.85)', 'rgba(245,158,11,.85)'], borderWidth: 0 }]
      };
    }

    const sFiltered = dashboardStats.sFiltered;
    const pix = sFiltered.filter(s => String(s.formaCompra || '').toLowerCase().includes('pix')).reduce((sum, s) => sum + (parseFloat(s.valorOS) || 0), 0);
    const cartao = sFiltered.filter(s => String(s.formaCompra || '').toLowerCase().includes('cart')).reduce((sum, s) => sum + (parseFloat(s.valorOS) || 0), 0);
    const prazo = sFiltered.filter(s => String(s.formaCompra || '').toLowerCase().includes('prazo')).reduce((sum, s) => sum + (parseFloat(s.valorOS) || 0), 0);
    return {
      labels: ['Pix', 'Cartão', 'À Prazo'],
      datasets: [{ data: [pix, cartao, prazo], backgroundColor: ['rgba(78,226,71,.85)', 'rgba(59,130,246,.85)', 'rgba(245,158,11,.85)'], borderWidth: 0 }]
    };
  }, [dashboardStats, consolidado, monthFilter, yearFilter, rawQueriesActive]);

  const chartRecebiveisStatus = useMemo(() => {
    if (!rawQueriesActive) {
      let pendente = 0, recebido = 0;
      consolidado.forEach(docData => {
        const docY = docData.ano;
        const docM = docData.mesNum;
        const matchMonth = monthFilter === 'all' || String(docM) === monthFilter;
        const matchYear = yearFilter === 'all' || String(docY) === yearFilter;
        if (matchMonth && matchYear) {
          const status = docData.recebiveisStatus || {};
          pendente += (status.pendente || 0);
          recebido += (status.recebido || 0);
        }
      });
      return {
        labels: ['Pendente', 'Recebido'],
        datasets: [{ data: [pendente, recebido], backgroundColor: ['rgba(245,158,11,.85)', 'rgba(78,226,71,.85)'], borderWidth: 0 }]
      };
    }

    const rFiltered = dashboardStats.rFiltered;
    const pendente = rFiltered.filter(r => r.status === 'Pendente').reduce((s, r) => s + (parseFloat(r.valorParcela) || 0), 0);
    const recebido = rFiltered.filter(r => r.status === 'Recebido').reduce((s, r) => s + (parseFloat(r.valorParcela) || 0), 0);
    return {
      labels: ['Pendente', 'Recebido'],
      datasets: [{ data: [pendente, recebido], backgroundColor: ['rgba(245,158,11,.85)', 'rgba(78,226,71,.85)'], borderWidth: 0 }]
    };
  }, [dashboardStats, consolidado, monthFilter, yearFilter, rawQueriesActive]);

  const chartMecanicos = useMemo(() => {
    if (!rawQueriesActive) {
      const grouped = {};
      consolidado.forEach(docData => {
        const docY = docData.ano;
        const docM = docData.mesNum;
        const matchMonth = monthFilter === 'all' || String(docM) === monthFilter;
        const matchYear = yearFilter === 'all' || String(docY) === yearFilter;
        if (matchMonth && matchYear) {
          const mecs = docData.mecanicos || {};
          Object.entries(mecs).forEach(([name, val]) => {
            grouped[name] = (grouped[name] || 0) + val;
          });
        }
      });
      const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 8);
      return {
        labels: sorted.map(s => s[0]),
        datasets: [{ label: 'Faturamento', data: sorted.map(s => s[1]), backgroundColor: 'rgba(78,226,71,.8)', borderRadius: 8 }]
      };
    }

    const sFiltered = dashboardStats.sFiltered;
    const grouped = {};
    sFiltered.forEach(s => {
      const name = s.mecanico || 'Não informado';
      grouped[name] = (grouped[name] || 0) + (parseFloat(s.valorOS) || 0);
    });
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      labels: sorted.map(s => s[0]),
      datasets: [{ label: 'Faturamento', data: sorted.map(s => s[1]), backgroundColor: 'rgba(78,226,71,.8)', borderRadius: 8 }]
    };
  }, [dashboardStats, consolidado, monthFilter, yearFilter, rawQueriesActive]);

  // ── RENDER HELPERS ──
  const renderPagination = (p) => (
    <div className="pagination">
      <span className="pagination-info">{p.total} registros • Página {p.page} de {p.totalPages}</span>
      <div className="pagination-controls">
        <button className="btn-page" disabled={p.page <= 1} onClick={() => setCurrentPage(p.page - 1)}>← Anterior</button>
        <button className="btn-page" disabled={p.page >= p.totalPages} onClick={() => setCurrentPage(p.page + 1)}>Próximo →</button>
      </div>
    </div>
  );

  const renderFilters = (showStatus = false) => (
    <div className="ag-filters glass" style={{ padding: '14px 20px', borderRadius: '14px' }}>
      <label>
        Ano
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="all">Todos</option>
          {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <label>
        Mês
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          <option value="all">Todos</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </label>
      <label>
        Dia
        <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
          <option value="all">Todos</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
          ))}
        </select>
      </label>
      {showStatus && (
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="Pendente">A Vencer</option>
            <option value="Vencido">Vencidos</option>
            <option value="Recebido">Recebidos</option>
          </select>
        </label>
      )}
      <label className="search-field">
        Busca
        <input type="search" placeholder="Buscar por OS, cliente, mecânico..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginLeft: 'auto', flexWrap: 'wrap' }}>
        {['servicos', 'compras', 'boletos', 'recebiveis'].includes(activeTab) && (
          <button 
            className="btn outline sm" 
            type="button"
            onClick={() => window.print()}
            title={activeTab === 'compras' ? "Imprimir todas as compras filtradas" : activeTab === 'servicos' ? "Imprimir todos os serviços filtrados" : activeTab === 'boletos' ? "Imprimir todos os boletos filtrados" : "Imprimir todos os recebíveis filtrados"}
          >
            <IconPrinter /> Imprimir
          </button>
        )}
        {['servicos', 'compras', 'boletos'].includes(activeTab) && (
          <button 
            className={`btn outline sm ${gridEditMode ? 'active' : ''}`}
            type="button"
            onClick={() => {
              if (gridEditMode && Object.keys(gridChanges).length > 0) {
                if (!window.confirm('Descartar alterações pendentes?')) return;
              }
              setGridChanges({});
              setGridEditMode(!gridEditMode);
            }} 
          >
            {gridEditMode ? <><IconCheck /> Sair do Modo Planilha</> : <><IconEdit /> Modo Planilha</>}
          </button>
        )}
        <button className="btn outline sm" onClick={openImportModal}><IconExcel /> Importar Excel</button>
        {['servicos', 'compras', 'boletos'].includes(activeTab) && currentUser?.isAdmin && (
          <button 
            className="btn warning sm" 
            onClick={() => setDuplicateModal(true)} 
            title="Checar dados duplicados nas planilhas"
          >
            <IconSearch /> Checar Duplicados
          </button>
        )}
        <button className="btn primary sm" onClick={() => {
          if (activeTab === 'servicos') openAddServico();
          else if (activeTab === 'compras') openAddCompra();
          else if (activeTab === 'boletos') openAddBoleto();
        }}><IconPlus /> Novo</button>
      </div>
    </div>
  );


  if (loading) {
    return (
      <div className="painel-layout" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: 'var(--muted)' }}>
          Carregando dados do Alto Geral...
        </div>
      </div>
    );
  }

  return (
    <div className="painel-layout" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopNav
        currentPage={activeTab}
        onPageChange={(page) => { setActiveTab(page); setCurrentPage(1); }}
        isCadastrosPage={false}
        whiteTheme={whiteTheme}
        setWhiteTheme={setWhiteTheme}
        isAutoGeral={true}
        onBackToGateway={onBackToGateway}
      />

      <main className="main">
        {/* ═══ DASHBOARD ═══ */}
        {activeTab === 'dashboard' && currentUser?.isAdmin && (
          <div>
            <div className="ag-section-header">
              <div>
                <div className="badge" style={{ marginBottom: '6px' }}>Auto Geral</div>
                <h1>Painel Financeiro — Alto Geral</h1>
                <p>Visão consolidada do caixa, recebíveis e despesas do setor.</p>
              </div>
            </div>

            {/* Filtros do Dashboard */}
            <div className="ag-filters glass" style={{ padding: '14px 20px', borderRadius: '14px', marginBottom: '24px' }}>
              <label>
                Ano
                <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                  <option value="all">Todos</option>
                  {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label>
                Mês
                <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
                  <option value="all">Todos os Meses</option>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </label>
            </div>

            {/* Caixa Hero */}
            <div className="ag-caixa-hero">
              <div className={`ag-caixa-card glass ${dashboardStats.saldo >= 0 ? 'positive' : 'negative'}`}>
                <div className="caixa-label">Saldo do Caixa</div>
                <span className="caixa-value">{fmtMoney.format(dashboardStats.saldo)}</span>
                <div className="caixa-sub">Entradas efetivas − Saídas</div>
                <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div className="ag-caixa-card glass positive">
                <div className="caixa-label">Entradas Efetivas</div>
                <span className="caixa-value">{fmtMoney.format(dashboardStats.entradas)}</span>
                <div className="caixa-sub">À vista + Recebíveis recebidos</div>
                <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
              </div>
              <div className="ag-caixa-card glass negative">
                <div className="caixa-label">Saídas (Boletos)</div>
                <span className="caixa-value">{fmtMoney.format(dashboardStats.saidas)}</span>
                <div className="caixa-sub">{dashboardStats.bFiltered.length} boletos</div>
                <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
              </div>
            </div>

            {/* KPIs */}
            <div className="ag-kpis">
              <div className="ag-kpi glass">
                <div className="kpi-label">Total Serviços</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.totalServicos)}</span>
                <span className="kpi-sub">{dashboardStats.sFiltered.length} lançamentos</span>
                <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              </div>
              <div className="ag-kpi glass accent-yellow">
                <div className="kpi-label">À Vista Recebido</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.totalServicoVista)}</span>
                <span className="kpi-sub">Pix + Cartão</span>
                <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <div className="ag-kpi glass accent-blue">
                <div className="kpi-label">Recebíveis Pendentes</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.totalPendente)}</span>
                <span className="kpi-sub">{dashboardStats.recebiveisPendentes} parcelas</span>
                <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div className="ag-kpi glass accent-green">
                <div className="kpi-label">Recebíveis Recebidos</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.totalRecebido)}</span>
                <span className="kpi-sub">{dashboardStats.recebiveisRecebidos} parcelas</span>
                <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div className="ag-kpi glass accent-red">
                <div className="kpi-label">Recebíveis Vencidos</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.totalVencido)}</span>
                <span className="kpi-sub">{dashboardStats.recebiveisVencidos} parcelas atrasadas</span>
                <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="ag-kpi glass">
                <div className="kpi-label">Total Compras</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.totalCompras)}</span>
                <span className="kpi-sub">{dashboardStats.cFiltered.length} registros</span>
                <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </div>
            </div>

            {/* Charts */}
            <div className="ag-charts-grid">
              <div className="ag-chart-card glass" style={{ gridColumn: 'span 2' }}>
                <h3>Entradas vs Saídas por Mês</h3>
                <div style={{ height: '260px', position: 'relative' }}>
                  <Bar data={chartCaixaMensal} options={barOptions(false)} />
                </div>
              </div>
              <div className="ag-chart-card glass">
                <h3>Forma de Pagamento</h3>
                <div style={{ height: '260px', position: 'relative' }}>
                  <Pie data={chartFormaPgto} options={pieOptions()} />
                </div>
              </div>
              <div className="ag-chart-card glass">
                <h3>Recebíveis por Status</h3>
                <div style={{ height: '260px', position: 'relative' }}>
                  <Pie data={chartRecebiveisStatus} options={pieOptions()} />
                </div>
              </div>
              <div className="ag-chart-card glass" style={{ gridColumn: 'span 2' }}>
                <h3>Top Mecânicos (Faturamento)</h3>
                <div style={{ height: '260px', position: 'relative' }}>
                  <Bar data={chartMecanicos} options={{ ...barOptions(), indexAxis: 'y' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ SERVIÇOS ═══ */}
        {activeTab === 'servicos' && (() => {
          const p = paginate(filteredServicos);
          return (
            <div>
              <div className="ag-section-header">
                <div>
                  <h1>Serviços Prestados</h1>
                  <p>Relatório de serviços do setor Alto Geral. Serviços à prazo geram recebíveis automaticamente.</p>
                </div>
              </div>
              {renderFilters()}

              {/* Tabela exclusiva para impressão — exibe todos os itens filtrados e o valor total */}
              <div className="print-only-container">
                <div className="print-header">
                  <h2>Auto Geral — Relatório de Serviços</h2>
                  <p>
                    <strong>Filtros Ativos:</strong>{' '}
                    {yearFilter !== 'all' ? `Ano: ${yearFilter}` : 'Todos os Anos'}
                    {monthFilter !== 'all' ? ` | Mês: ${MONTHS[parseInt(monthFilter) - 1]}` : ''}
                    {dayFilter !== 'all' ? ` | Dia: ${dayFilter}` : ''}
                    {searchQuery ? ` | Busca: "${searchQuery}"` : ''}
                  </p>
                  <p>
                    <strong>Registros:</strong> {filteredServicos.length} |{' '}
                    <strong>Valor Total:</strong> {fmtMoney.format(filteredServicos.reduce((sum, s) => sum + (parseFloat(s.valorOS) || 0), 0))}
                  </p>
                </div>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Forma</th>
                      <th>Cliente</th>
                      <th>Material/Serviço</th>
                      <th>OS</th>
                      <th>Valor OS</th>
                      <th>Serviços</th>
                      <th>Peças</th>
                      <th>Material</th>
                      <th>Mecânico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServicos.map(item => (
                      <tr key={item.id}>
                        <td>{formatDateBR(item.data)}</td>
                        <td>{item.formaCompra || '-'}</td>
                        <td>{item.nomeCliente || '-'}</td>
                        <td>{item.descricaoMaterial || '-'}</td>
                        <td>{item.numOS || '-'}</td>
                        <td className="text-right">{fmtMoney.format(item.valorOS)}</td>
                        <td className="text-right">{fmtMoney.format(item.valorServicos)}</td>
                        <td className="text-right">{fmtMoney.format(item.valorPecas)}</td>
                        <td className="text-right">{fmtMoney.format(item.valorMaterial)}</td>
                        <td>{item.mecanico || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table className="compact-table">
                    <thead>
                      <tr>
                        <th>Data</th><th>Forma</th><th>Cliente</th><th>Material/Serviço</th>
                        <th>OS</th><th>Valor OS</th><th>Serviços</th><th>Peças</th>
                        <th>Material</th><th>Mecânico</th><th>Parcelas</th><th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.paginated.map(item => {
                        const hasChanges = !!gridChanges[item.id];
                        const rowData = { ...item, ...(gridChanges[item.id] || {}) };
                        return (
                          <tr key={item.id} className={hasChanges ? 'grid-changed-row' : ''}>
                            <td>
                              {gridEditMode ? (
                                <input type="date" value={rowData.data || ''} onChange={e => handleGridCellChange(item.id, 'data', e.target.value)} className="ag-grid-input" />
                              ) : (
                                formatDateBR(item.data)
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <select value={rowData.formaCompra || 'Pix'} onChange={e => handleGridCellChange(item.id, 'formaCompra', e.target.value)} className="ag-grid-input">
                                  <option value="Pix">Pix</option>
                                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                                  <option value="Cartão de Débito">Cartão de Débito</option>
                                  <option value="Dinheiro">Dinheiro</option>
                                  <option value="à Prazo">à Prazo</option>
                                </select>
                              ) : (
                                <span className={`table-badge ${String(item.formaCompra || '').toLowerCase().includes('prazo') ? 'prazo' : 'vista'}`}>{item.formaCompra}</span>
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.nomeCliente || ''} onChange={e => handleGridCellChange(item.id, 'nomeCliente', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.nomeCliente || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.descricaoMaterial || ''} onChange={e => handleGridCellChange(item.id, 'descricaoMaterial', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.descricaoMaterial || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.numOS || ''} onChange={e => handleGridCellChange(item.id, 'numOS', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.numOS || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.valorOS || 0} onChange={e => handleGridCellChange(item.id, 'valorOS', e.target.value)} className="ag-grid-input" style={{ fontWeight: 'bold' }} />
                              ) : (
                                <strong>{fmtMoney.format(item.valorOS)}</strong>
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.valorServicos || 0} onChange={e => handleGridCellChange(item.id, 'valorServicos', e.target.value)} className="ag-grid-input" />
                              ) : (
                                fmtMoney.format(item.valorServicos)
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.valorPecas || 0} onChange={e => handleGridCellChange(item.id, 'valorPecas', e.target.value)} className="ag-grid-input" />
                              ) : (
                                fmtMoney.format(item.valorPecas)
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.valorMaterial || 0} onChange={e => handleGridCellChange(item.id, 'valorMaterial', e.target.value)} className="ag-grid-input" />
                              ) : (
                                fmtMoney.format(item.valorMaterial)
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.mecanico || ''} onChange={e => handleGridCellChange(item.id, 'mecanico', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.mecanico || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" value={rowData.numParcelas || 0} onChange={e => handleGridCellChange(item.id, 'numParcelas', e.target.value)} className="ag-grid-input" disabled={!String(rowData.formaCompra || '').toLowerCase().includes('prazo')} />
                              ) : (
                                item.numParcelas || '-'
                              )}
                            </td>
                            <td>
                              <div className="ag-table-actions">
                                {!gridEditMode && (
                                  <button className="btn icon-only edit" title="Editar Serviço" onClick={() => openEditServico(item)}>
                                    <IconEdit />
                                  </button>
                                )}
                                {hasChanges && <span style={{ color: 'var(--yellow)', fontSize: '11px', fontWeight: 'bold', padding: '4px 6px' }}>Editado</span>}
                                <button className="btn icon-only danger" title="Excluir Serviço" onClick={() => { if (window.confirm('Excluir serviço e seus recebíveis?')) deleteServico(item.id).then(() => triggerToast('Excluído.')); }}>
                                  <IconTrash />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {p.paginated.length === 0 && (
                        <tr><td colSpan="12" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>Nenhum serviço encontrado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {renderPagination(p)}
              </section>
            </div>
          );
        })()}

        {/* ═══ COMPRAS ═══ */}
        {activeTab === 'compras' && (() => {
          const p = paginate(filteredCompras);
          return (
            <div>
              <div className="ag-section-header">
                <div>
                  <h1>Relatório de Compras</h1>
                  <p>Detalhamento dos gastos do setor Alto Geral. Estes gastos alimentam o relatório de Boletos a Pagar.</p>
                </div>
              </div>
              {renderFilters()}

              {/* Tabela exclusiva para impressão — exibe todos os itens filtrados e o valor total */}
              <div className="print-only-container">
                <div className="print-header">
                  <h2>Auto Geral — Relatório de Compras</h2>
                  <p>
                    <strong>Filtros Ativos:</strong>{' '}
                    {yearFilter !== 'all' ? `Ano: ${yearFilter}` : 'Todos os Anos'}
                    {monthFilter !== 'all' ? ` | Mês: ${MONTHS[parseInt(monthFilter) - 1]}` : ''}
                    {dayFilter !== 'all' ? ` | Dia: ${dayFilter}` : ''}
                    {searchQuery ? ` | Busca: "${searchQuery}"` : ''}
                  </p>
                  <p>
                    <strong>Registros:</strong> {filteredCompras.length} |{' '}
                    <strong>Valor Total:</strong> {fmtMoney.format(filteredCompras.reduce((sum, c) => sum + (parseFloat(c.valorPeca) || 0), 0))}
                  </p>
                </div>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Forma</th>
                      <th>Cliente</th>
                      <th>Descrição Material</th>
                      <th>OS</th>
                      <th>Valor OS</th>
                      <th>Valor Peça</th>
                      <th>Fornecedor</th>
                      <th>Nº Pedido</th>
                      <th>Categoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompras.map(item => (
                      <tr key={item.id}>
                        <td>{formatDateBR(item.data)}</td>
                        <td>{item.formaCompra || '-'}</td>
                        <td>{item.nomeCliente || '-'}</td>
                        <td>{item.descricaoMaterial || '-'}</td>
                        <td>{item.numOS || '-'}</td>
                        <td className="text-right">{fmtMoney.format(item.valorOS)}</td>
                        <td className="text-right">{fmtMoney.format(item.valorPeca)}</td>
                        <td>{item.fornecedor || '-'}</td>
                        <td>{item.numPedido || '-'}</td>
                        <td>{item.categoria || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table className="compact-table">
                    <thead>
                      <tr>
                        <th>Data</th><th>Forma</th><th>Cliente</th><th>Descrição Material</th>
                        <th>OS</th><th>Valor OS</th><th>Valor Peça</th><th>Fornecedor</th>
                        <th>Nº Pedido</th><th>Categoria</th><th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.paginated.map(item => {
                        const hasChanges = !!gridChanges[item.id];
                        const rowData = { ...item, ...(gridChanges[item.id] || {}) };
                        return (
                          <tr key={item.id} className={hasChanges ? 'grid-changed-row' : ''}>
                            <td>
                              {gridEditMode ? (
                                <input type="date" value={rowData.data || ''} onChange={e => handleGridCellChange(item.id, 'data', e.target.value)} className="ag-grid-input" />
                              ) : (
                                formatDateBR(item.data)
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <select value={rowData.formaCompra || 'Pix'} onChange={e => handleGridCellChange(item.id, 'formaCompra', e.target.value)} className="ag-grid-input">
                                  <option value="Pix">Pix</option>
                                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                                  <option value="Cartão de Débito">Cartão de Débito</option>
                                  <option value="Dinheiro">Dinheiro</option>
                                  <option value="à Prazo">à Prazo</option>
                                </select>
                              ) : (
                                <span className={`table-badge ${String(item.formaCompra || '').toLowerCase().includes('prazo') ? 'prazo' : 'vista'}`}>{item.formaCompra}</span>
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.nomeCliente || ''} onChange={e => handleGridCellChange(item.id, 'nomeCliente', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.nomeCliente || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.descricaoMaterial || ''} onChange={e => handleGridCellChange(item.id, 'descricaoMaterial', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.descricaoMaterial || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.numOS || ''} onChange={e => handleGridCellChange(item.id, 'numOS', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.numOS || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.valorOS || 0} onChange={e => handleGridCellChange(item.id, 'valorOS', e.target.value)} className="ag-grid-input" />
                              ) : (
                                fmtMoney.format(item.valorOS)
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.valorPeca || 0} onChange={e => handleGridCellChange(item.id, 'valorPeca', e.target.value)} className="ag-grid-input" style={{ fontWeight: 'bold' }} />
                              ) : (
                                <strong>{fmtMoney.format(item.valorPeca)}</strong>
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.fornecedor || ''} onChange={e => handleGridCellChange(item.id, 'fornecedor', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.fornecedor || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.numPedido || ''} onChange={e => handleGridCellChange(item.id, 'numPedido', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.numPedido || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <select value={rowData.categoria || 'Oficina'} onChange={e => handleGridCellChange(item.id, 'categoria', e.target.value)} className="ag-grid-input">
                                  <option value="Oficina">Oficina</option>
                                  <option value="Cliente">Cliente</option>
                                </select>
                              ) : (
                                item.categoria || '-'
                              )}
                            </td>
                            <td>
                              <div className="ag-table-actions">
                                {!gridEditMode && (
                                  <button className="btn icon-only edit" title="Editar Compra" onClick={() => openEditCompra(item)}>
                                    <IconEdit />
                                  </button>
                                )}
                                {hasChanges && <span style={{ color: 'var(--yellow)', fontSize: '11px', fontWeight: 'bold', padding: '4px 6px' }}>Editado</span>}
                                <button className="btn icon-only danger" title="Excluir Compra" onClick={() => { if (window.confirm('Excluir compra?')) deleteCompra(item.id).then(() => triggerToast('Excluído.')); }}>
                                  <IconTrash />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {p.paginated.length === 0 && (
                        <tr><td colSpan="11" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>Nenhuma compra encontrada.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {renderPagination(p)}
              </section>
            </div>
          );
        })()}

        {/* ═══ BOLETOS ═══ */}
        {activeTab === 'boletos' && (() => {
          const p = paginate(filteredBoletos);
          return (
            <div>
              <div className="ag-section-header">
                <div>
                  <h1>Boletos a Pagar</h1>
                  <p>Todos os boletos são contabilizados como saída do caixa.</p>
                </div>
              </div>
              {renderFilters()}

              {/* Tabela exclusiva para impressão — exibe todos os itens filtrados e o valor total */}
              <div className="print-only-container">
                <div className="print-header">
                  <h2>Auto Geral — Relatório de Boletos a Pagar</h2>
                  <p>
                    <strong>Filtros Ativos:</strong>{' '}
                    {yearFilter !== 'all' ? `Ano: ${yearFilter}` : 'Todos os Anos'}
                    {monthFilter !== 'all' ? ` | Mês: ${MONTHS[parseInt(monthFilter) - 1]}` : ''}
                    {dayFilter !== 'all' ? ` | Dia: ${dayFilter}` : ''}
                    {searchQuery ? ` | Busca: "${searchQuery}"` : ''}
                  </p>
                  <p>
                    <strong>Registros:</strong> {filteredBoletos.length} |{' '}
                    <strong>Total a Pagar:</strong> {fmtMoney.format(filteredBoletos.reduce((sum, b) => sum + (parseFloat(b.valorBoleto) || 0), 0))}
                  </p>
                </div>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Fornecedor</th>
                      <th>Descrição Material</th>
                      <th>Nº OS</th>
                      <th>Valor Boleto</th>
                      <th>Valor OS</th>
                      <th>Cliente</th>
                      <th>Vencimento</th>
                      <th>Mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBoletos.map(item => (
                      <tr key={item.id}>
                        <td>{item.nomeFornecedor || '-'}</td>
                        <td>{item.descricaoMaterial || '-'}</td>
                        <td>{item.numOS || '-'}</td>
                        <td className="text-right">{fmtMoney.format(item.valorBoleto)}</td>
                        <td className="text-right">{fmtMoney.format(item.valorOS)}</td>
                        <td>{item.nomeCliente || '-'}</td>
                        <td>{formatDateBR(item.dataVencimento)}</td>
                        <td>{getMonthName(item.dataVencimento) !== '-' ? getMonthName(item.dataVencimento) : (item.mesVencimento || '-')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table className="compact-table">
                    <thead>
                      <tr>
                        <th>Fornecedor</th><th>Descrição Material</th><th>Nº OS</th><th>Valor Boleto</th>
                        <th>Valor OS</th><th>Cliente</th><th>Vencimento</th><th>Mês</th><th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.paginated.map(item => {
                        const hasChanges = !!gridChanges[item.id];
                        const rowData = { ...item, ...(gridChanges[item.id] || {}) };
                        return (
                          <tr key={item.id} className={hasChanges ? 'grid-changed-row' : ''}>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.nomeFornecedor || ''} onChange={e => handleGridCellChange(item.id, 'nomeFornecedor', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.nomeFornecedor || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.descricaoMaterial || ''} onChange={e => handleGridCellChange(item.id, 'descricaoMaterial', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.descricaoMaterial || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.numOS || ''} onChange={e => handleGridCellChange(item.id, 'numOS', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.numOS || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.valorBoleto || 0} onChange={e => handleGridCellChange(item.id, 'valorBoleto', e.target.value)} className="ag-grid-input" style={{ fontWeight: 'bold' }} />
                              ) : (
                                <strong>{fmtMoney.format(item.valorBoleto)}</strong>
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.valorOS || 0} onChange={e => handleGridCellChange(item.id, 'valorOS', e.target.value)} className="ag-grid-input" />
                              ) : (
                                fmtMoney.format(item.valorOS)
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.nomeCliente || ''} onChange={e => handleGridCellChange(item.id, 'nomeCliente', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.nomeCliente || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="date" value={rowData.dataVencimento || ''} onChange={e => handleGridCellChange(item.id, 'dataVencimento', e.target.value)} className="ag-grid-input" />
                              ) : (
                                formatDateBR(item.dataVencimento)
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <select value={rowData.mesVencimento || ''} onChange={e => handleGridCellChange(item.id, 'mesVencimento', e.target.value)} className="ag-grid-input">
                                  <option value=""></option>
                                  {MONTHS.map(m => <option key={m} value={m.toLowerCase()}>{m}</option>)}
                                </select>
                              ) : (
                                getMonthName(item.dataVencimento) !== '-' ? getMonthName(item.dataVencimento) : (item.mesVencimento || '-')
                              )}
                            </td>
                            <td>
                              <div className="ag-table-actions">
                                {!gridEditMode && (
                                  <button className="btn icon-only edit" title="Editar Boleto" onClick={() => openEditBoleto(item)}>
                                    <IconEdit />
                                  </button>
                                )}
                                {hasChanges && <span style={{ color: 'var(--yellow)', fontSize: '11px', fontWeight: 'bold', padding: '4px 6px' }}>Editado</span>}
                                <button className="btn icon-only danger" title="Excluir Boleto" onClick={() => { if (window.confirm('Excluir boleto?')) deleteBoleto(item.id).then(() => triggerToast('Excluído.')); }}>
                                  <IconTrash />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {p.paginated.length === 0 && (
                        <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>Nenhum boleto encontrado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {renderPagination(p)}
              </section>
            </div>
          );
        })()}

        {/* ═══ RECEBÍVEIS ═══ */}
        {activeTab === 'recebiveis' && (() => {
          const p = paginate(filteredRecebiveis);
          return (
            <div>
              <div className="ag-section-header">
                <div>
                  <h1>Recebíveis</h1>
                  <p>Parcelas geradas automaticamente de serviços à prazo. Marque como "Recebido" para contabilizar no caixa.</p>
                </div>
              </div>
              {renderFilters(true)}

              {/* Resumo rápido */}
              <div className="ag-kpis" style={{ marginTop: '20px' }}>
                <div className="ag-kpi glass accent-yellow">
                  <div className="kpi-label">Pendentes</div>
                  <span className="kpi-value">{fmtMoney.format(caixa.totalPendente)}</span>
                  <span className="kpi-sub">{caixa.recebiveisPendentes} parcelas</span>
                  <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div className="ag-kpi glass">
                  <div className="kpi-label">Recebidos</div>
                  <span className="kpi-value">{fmtMoney.format(caixa.totalRecebido)}</span>
                  <span className="kpi-sub">{caixa.recebiveisRecebidos} parcelas</span>
                  <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div className="ag-kpi glass accent-red">
                  <div className="kpi-label">Vencidos</div>
                  <span className="kpi-value">{fmtMoney.format(caixa.totalVencido)}</span>
                  <span className="kpi-sub">{caixa.recebiveisVencidos} parcelas atrasadas</span>
                  <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
              </div>

              {/* Tabela exclusiva para impressão — exibe todos os itens filtrados e o valor total */}
              <div className="print-only-container">
                <div className="print-header">
                  <h2>Auto Geral — Relatório de Recebíveis</h2>
                  <p>
                    <strong>Filtros Ativos:</strong>{' '}
                    {yearFilter !== 'all' ? `Ano: ${yearFilter}` : 'Todos os Anos'}
                    {monthFilter !== 'all' ? ` | Mês: ${MONTHS[parseInt(monthFilter) - 1]}` : ''}
                    {dayFilter !== 'all' ? ` | Dia: ${dayFilter}` : ''}
                    {searchQuery ? ` | Busca: "${searchQuery}"` : ''}
                  </p>
                  <p>
                    <strong>Registros:</strong> {filteredRecebiveis.length} |{' '}
                    <strong>Total Recebido:</strong> {fmtMoney.format(filteredRecebiveis.filter(r => r.status === 'Recebido').reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0))} |{' '}
                    <strong>Total Pendente:</strong> {fmtMoney.format(filteredRecebiveis.filter(r => r.status === 'Pendente').reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0))} |{' '}
                    <strong>Total Geral:</strong> {fmtMoney.format(filteredRecebiveis.reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0))}
                  </p>
                </div>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>OS</th>
                      <th>Cliente</th>
                      <th>Descrição</th>
                      <th>Mecânico</th>
                      <th>Parcela</th>
                      <th>Valor Parcela</th>
                      <th>Vencimento</th>
                      <th>Status</th>
                      <th>Recebido Em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecebiveis.map(item => {
                      const isVencido = item.status === 'Pendente' && item.dataVencimento < hoje;
                      return (
                        <tr key={item.id}>
                          <td>{item.numOS || '-'}</td>
                          <td>{item.nomeCliente || '-'}</td>
                          <td>{item.descricao || '-'}</td>
                          <td>{item.mecanico || '-'}</td>
                          <td>{item.parcela}/{item.totalParcelas}</td>
                          <td className="text-right">{fmtMoney.format(item.valorParcela)}</td>
                          <td>{formatDateBR(item.dataVencimento)}</td>
                          <td>{isVencido ? 'Vencido' : item.status}</td>
                          <td>{formatDateBR(item.dataRecebimento)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table className="compact-table">
                    <thead>
                      <tr>
                        <th>OS</th><th>Cliente</th><th>Descrição</th><th>Mecânico</th>
                        <th>Parcela</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Recebido em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.paginated.map(item => {
                        const isVencido = item.status === 'Pendente' && item.dataVencimento < hoje;
                        return (
                          <tr key={item.id} style={isVencido ? { background: 'rgba(244,63,94,.06)' } : {}}>
                            <td>{item.numOS || '-'}</td>
                            <td>{item.nomeCliente || '-'}</td>
                            <td>{item.descricao || '-'}</td>
                            <td>{item.mecanico || '-'}</td>
                            <td><strong>{item.parcela}/{item.totalParcelas}</strong></td>
                            <td><strong>{fmtMoney.format(item.valorParcela)}</strong></td>
                            <td style={isVencido ? { color: 'var(--red)', fontWeight: 800 } : {}}>{formatDateBR(item.dataVencimento)}</td>
                            <td>
                              <button
                                className={`status-badge ${isVencido ? 'vencido' : item.status === 'Recebido' ? 'recebido' : 'pendente'}`}
                                onClick={() => {
                                  const newStatus = item.status === 'Recebido' ? 'Pendente' : 'Recebido';
                                  toggleRecebivel(item.id, newStatus).then(() => triggerToast(`Parcela marcada como ${newStatus}.`));
                                }}
                                title="Clique para alternar status"
                              >
                                {isVencido ? '⚠ Vencido' : item.status === 'Recebido' ? '✓ Recebido' : '◌ Pendente'}
                              </button>
                            </td>
                            <td>{formatDateBR(item.dataRecebimento)}</td>
                          </tr>
                        );
                      })}
                      {p.paginated.length === 0 && (
                        <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>Nenhum recebível encontrado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {renderPagination(p)}
              </section>
            </div>
          );
        })()}

      </main>

      {/* ═══ MODALS ═══ */}

      {/* Serviço Modal */}
      {servicoModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setServicoModal(false)} />
          <form className="modal-form-card glass" onSubmit={handleServicoSubmit} style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>{servicoEditId ? 'Editar Serviço' : 'Novo Serviço'}</h3>
              <button className="close" type="button" onClick={() => setServicoModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <Field label="Data" type="date" value={servicoForm.data} onChange={e => setServicoForm({...servicoForm, data: e.target.value})} />
                <Field label="Forma de Compra" value={servicoForm.formaCompra} onChange={e => setServicoForm({...servicoForm, formaCompra: e.target.value})} options={['Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'à Prazo']} />
                <Field label="Nome do Cliente" value={servicoForm.nomeCliente} onChange={e => setServicoForm({...servicoForm, nomeCliente: e.target.value})} />
                <Field label="Descrição do Material" value={servicoForm.descricaoMaterial} onChange={e => setServicoForm({...servicoForm, descricaoMaterial: e.target.value})} />
                <Field label="Nº da OS" value={servicoForm.numOS} onChange={e => setServicoForm({...servicoForm, numOS: e.target.value})} />
                <Field label="Valor da OS" type="number" step="0.01" value={servicoForm.valorOS} onChange={e => setServicoForm({...servicoForm, valorOS: parseFloat(e.target.value) || 0})} />
                <Field label="Valor Serviços" type="number" step="0.01" value={servicoForm.valorServicos} onChange={e => setServicoForm({...servicoForm, valorServicos: parseFloat(e.target.value) || 0})} />
                <Field label="Valor Peças" type="number" step="0.01" value={servicoForm.valorPecas} onChange={e => setServicoForm({...servicoForm, valorPecas: parseFloat(e.target.value) || 0})} />
                <Field label="Valor Material" type="number" step="0.01" value={servicoForm.valorMaterial} onChange={e => setServicoForm({...servicoForm, valorMaterial: parseFloat(e.target.value) || 0})} />
                <Field label="Mecânico" value={servicoForm.mecanico} onChange={e => setServicoForm({...servicoForm, mecanico: e.target.value})} />
                <Field label="Ano" type="number" value={servicoForm.ano} onChange={e => setServicoForm({...servicoForm, ano: parseInt(e.target.value) || 2026})} />
                <Field label="Nº Parcelas (0 = à vista)" type="number" value={servicoForm.numParcelas} onChange={e => setServicoForm({...servicoForm, numParcelas: parseInt(e.target.value) || 0})} />
              </div>
              {String(servicoForm.formaCompra).toLowerCase().includes('prazo') && servicoForm.numParcelas > 0 && (
                <div className="restricted-info" style={{ marginTop: '16px' }}>
                  ℹ️ Ao salvar, serão gerados <strong>{servicoForm.numParcelas} recebíveis</strong> de <strong>{fmtMoney.format((servicoForm.valorOS || 0) / (servicoForm.numParcelas || 1))}</strong> cada, com vencimentos a cada 30 dias.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn ghost" type="button" disabled={isSavingServico} onClick={() => setServicoModal(false)}>Cancelar</button>
              <button className="btn primary" type="submit" disabled={isSavingServico}>
                {isSavingServico ? <><span className="btn-spinner"></span> Salvando...</> : (servicoEditId ? 'Salvar' : 'Cadastrar')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Compra Modal */}
      {compraModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => !isSavingCompra && setCompraModal(false)} />
          <form className="modal-form-card glass" onSubmit={handleCompraSubmit} style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>{compraEditId ? 'Editar Compra' : 'Nova Compra'}</h3>
              <button className="close" type="button" disabled={isSavingCompra} onClick={() => setCompraModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <Field label="Data" type="date" value={compraForm.data} onChange={e => setCompraForm({...compraForm, data: e.target.value})} />
                <Field label="Forma de Compra" value={compraForm.formaCompra} onChange={e => setCompraForm({...compraForm, formaCompra: e.target.value})} options={['Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'à Prazo']} />
                <Field label="Nome do Cliente" value={compraForm.nomeCliente} onChange={e => setCompraForm({...compraForm, nomeCliente: e.target.value})} />
                <Field label="Descrição do Material" value={compraForm.descricaoMaterial} onChange={e => setCompraForm({...compraForm, descricaoMaterial: e.target.value})} />
                <Field label="Nº da OS" value={compraForm.numOS} onChange={e => setCompraForm({...compraForm, numOS: e.target.value})} />
                <Field label="Valor da OS" type="number" step="0.01" value={compraForm.valorOS} onChange={e => setCompraForm({...compraForm, valorOS: parseFloat(e.target.value) || 0})} />
                <Field label="Valor da Peça" type="number" step="0.01" value={compraForm.valorPeca} onChange={e => setCompraForm({...compraForm, valorPeca: parseFloat(e.target.value) || 0})} />
                <Field label="Fornecedor" value={compraForm.fornecedor} onChange={e => setCompraForm({...compraForm, fornecedor: e.target.value})} />
                <Field label="Nº do Pedido" value={compraForm.numPedido} onChange={e => setCompraForm({...compraForm, numPedido: e.target.value})} />
                <Field label="Categoria" value={compraForm.categoria} onChange={e => setCompraForm({...compraForm, categoria: e.target.value})} options={['Oficina', 'Cliente']} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" type="button" disabled={isSavingCompra} onClick={() => setCompraModal(false)}>Cancelar</button>
              <button className="btn primary" type="submit" disabled={isSavingCompra}>
                {isSavingCompra ? <><span className="btn-spinner"></span> Salvando...</> : (compraEditId ? 'Salvar' : 'Cadastrar')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Boleto Modal */}
      {boletoModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => !isSavingBoleto && setBoletoModal(false)} />
          <form className="modal-form-card glass" onSubmit={handleBoletoSubmit} style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>{boletoEditId ? 'Editar Boleto' : 'Novo Boleto'}</h3>
              <button className="close" type="button" disabled={isSavingBoleto} onClick={() => setBoletoModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                {!boletoEditId && (
                  <Field 
                    label="Quantidade de Boletos" 
                    type="number" 
                    min="1" 
                    max="24" 
                    value={boletoForm.qtdBoletos || 1} 
                    onChange={e => {
                      const num = Math.max(1, parseInt(e.target.value) || 1);
                      setBoletoForm(prev => {
                        const currentDates = [...(prev.datasVencimento || [])];
                        while (currentDates.length < num) {
                          currentDates.push(prev.dataVencimento || '');
                        }
                        return {
                          ...prev,
                          qtdBoletos: num,
                          datasVencimento: currentDates.slice(0, num)
                        };
                      });
                    }} 
                  />
                )}
                <Field label="Nome do Fornecedor" value={boletoForm.nomeFornecedor} onChange={e => setBoletoForm({...boletoForm, nomeFornecedor: e.target.value})} />
                <Field label="Descrição do Material" value={boletoForm.descricaoMaterial} onChange={e => setBoletoForm({...boletoForm, descricaoMaterial: e.target.value})} />
                <Field label="Nº da OS" value={boletoForm.numOS} onChange={e => setBoletoForm({...boletoForm, numOS: e.target.value})} />
                <Field label="Valor do Boleto" type="number" step="0.01" value={boletoForm.valorBoleto} onChange={e => setBoletoForm({...boletoForm, valorBoleto: parseFloat(e.target.value) || 0})} />
                <Field label="Valor da OS" type="number" step="0.01" value={boletoForm.valorOS} onChange={e => setBoletoForm({...boletoForm, valorOS: parseFloat(e.target.value) || 0})} />
                <Field label="Nome do Cliente" value={boletoForm.nomeCliente} onChange={e => setBoletoForm({...boletoForm, nomeCliente: e.target.value})} />
                
                {(boletoForm.qtdBoletos || 1) <= 1 ? (
                  <Field 
                    label="Data de Vencimento" 
                    type="date" 
                    value={boletoForm.dataVencimento} 
                    onChange={e => {
                      const v = e.target.value;
                      setBoletoForm(prev => ({
                        ...prev,
                        dataVencimento: v,
                        datasVencimento: [v, ...(prev.datasVencimento || []).slice(1)]
                      }));
                    }} 
                  />
                ) : (
                  <div style={{ gridColumn: '1 / -1', marginBottom: '10px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'block', color: 'var(--text)' }}>
                      Vencimentos dos {boletoForm.qtdBoletos} Boletos
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                      {Array.from({ length: boletoForm.qtdBoletos }).map((_, idx) => (
                        <div key={idx}>
                          <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>Vencimento {idx + 1}º Boleto</label>
                          <input 
                            type="date" 
                            className="ag-input"
                            style={{ width: '100%' }}
                            required 
                            value={(boletoForm.datasVencimento && boletoForm.datasVencimento[idx]) || ''} 
                            onChange={e => {
                              const val = e.target.value;
                              setBoletoForm(prev => {
                                const arr = [...(prev.datasVencimento || [])];
                                arr[idx] = val;
                                return {
                                  ...prev,
                                  dataVencimento: arr[0] || val,
                                  datasVencimento: arr
                                };
                              });
                            }} 
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Field label="Mês Vencimento" value={boletoForm.mesVencimento} onChange={e => setBoletoForm({...boletoForm, mesVencimento: e.target.value})} options={['', ...MONTHS.map(m => ({ value: m.toLowerCase(), label: m }))]} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" type="button" disabled={isSavingBoleto} onClick={() => setBoletoModal(false)}>Cancelar</button>
              <button className="btn primary" type="submit" disabled={isSavingBoleto}>
                {isSavingBoleto ? <><span className="btn-spinner"></span> Salvando...</> : (boletoEditId ? 'Salvar' : 'Cadastrar')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => !isImporting && setImportModal(false)} />
          <div className="modal-form-card glass" style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>Importar do Excel (Ctrl+V)</h3>
              <button className="close" type="button" disabled={isImporting} onClick={() => setImportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="ag-import-type-selector">
                {['servicos', 'compras', 'boletos'].map(t => (
                  <button key={t} className={`ag-import-type-btn ${importType === t ? 'active' : ''}`}
                    disabled={isImporting}
                    onClick={() => { setImportType(t); handleImportParse(importText, t); }}>
                    {t === 'servicos' ? '🔧 Serviços' : t === 'compras' ? '🛒 Compras' : '📄 Boletos'}
                  </button>
                ))}
              </div>
              <textarea
                className="ag-import-area"
                placeholder="Cole aqui os dados copiados do Excel (Ctrl+V)..."
                value={importText}
                disabled={isImporting}
                onChange={(e) => handleImportParse(e.target.value, importType)}
              />
              {importPreview && <div style={{ marginTop: '16px' }}>{importPreview}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn ghost" type="button" disabled={isImporting} onClick={() => setImportModal(false)}>Cancelar</button>
              <button className="btn primary" disabled={isImporting || parsedImportItems.length === 0} onClick={confirmImport}>
                {isImporting ? <><span className="btn-spinner"></span> Importando...</> : `Confirmar Importação (${parsedImportItems.length} registros)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Mode Floating Sticky Bar */}
      {Object.keys(gridChanges).length > 0 && (
        <div className="ag-sticky-bar glass" style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 999, display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 24px',
          borderRadius: '16px', border: '1px solid var(--yellow)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          background: 'rgba(13,34,51,0.95)', backdropFilter: 'blur(12px)'
        }}>
          <span style={{ color: 'var(--yellow)', fontWeight: 'bold', fontSize: '13px' }}>
            ⚠️ Existem {Object.keys(gridChanges).length} linhas com alterações não salvas.
          </span>
          <button className="btn primary" style={{ height: '36px', padding: '0 16px' }} disabled={isSavingGrid} onClick={saveGridChanges}>
            {isSavingGrid ? <><span className="btn-spinner"></span> Salvando...</> : 'Salvar Alterações'}
          </button>
          <button className="btn ghost" style={{ height: '36px', padding: '0 16px', color: 'var(--red)', borderColor: 'rgba(244,63,94,0.3)' }} disabled={isSavingGrid} onClick={discardGridChanges}>Descartar</button>
        </div>
      )}

      {/* Duplicate Checker Modal */}
      {duplicateModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setDuplicateModal(false)}></div>
          <div className="modal-form-card glass" style={{ zIndex: 10, width: 'min(900px, 95vw)', maxHeight: '85vh' }}>
            <div className="modal-header">
              <h3>🔍 Detector de Dados Duplicados (AutoGeral)</h3>
              <button className="close" type="button" onClick={() => setDuplicateModal(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>
                <strong>Atenção:</strong> A exclusão de registros duplicados é permanente. Ao excluir um serviço, todos os recebíveis associados a ele também serão excluídos automaticamente.
              </div>

              {/* Tab Selector Inside Modal */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
                {[
                  { key: 'servicos', label: `🔧 Serviços (${getDuplicateGroups.servicos.length} grupos)` },
                  { key: 'compras', label: `🛒 Compras (${getDuplicateGroups.compras.length} grupos)` },
                  { key: 'boletos', label: `📄 Boletos (${getDuplicateGroups.boletos.length} grupos)` }
                ].map(t => (
                  <button
                    key={t.key}
                    type="button"
                    className={`btn ${duplicateTab === t.key ? 'primary' : 'ghost'}`}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                    onClick={() => setDuplicateTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Duplicate List */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
                {(getDuplicateGroups[duplicateTab] || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
                    Nenhum registro duplicado encontrado para esta categoria.
                  </div>
                ) : (
                  (getDuplicateGroups[duplicateTab] || []).map((group, gIdx) => {
                    const first = group[0];
                    let headerText = '';
                    if (duplicateTab === 'servicos') {
                      headerText = `${first.nomeCliente || 'Sem Cliente'} - ${first.data ? first.data.split('-').reverse().join('/') : ''} (${fmtMoney.format(first.valorOS)})`;
                    } else if (duplicateTab === 'compras') {
                      headerText = `${first.fornecedor || 'Sem Fornecedor'} - ${first.data ? first.data.split('-').reverse().join('/') : ''} (${fmtMoney.format(first.valorPeca)})`;
                    } else {
                      headerText = `${first.nomeFornecedor || 'Sem Fornecedor'} - ${first.dataVencimento ? first.dataVencimento.split('-').reverse().join('/') : ''} (${fmtMoney.format(first.valorBoleto)})`;
                    }

                    const sortedGroup = [...group].sort((a, b) => {
                      const dateA = a.criadoEm ? new Date(a.criadoEm) : new Date(0);
                      const dateB = b.criadoEm ? new Date(b.criadoEm) : new Date(0);
                      return dateA - dateB;
                    });

                    return (
                      <div key={gIdx} className="glass" style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid var(--line)', paddingBottom: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Grupo #{gIdx + 1}: {headerText}</span>
                          <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--muted)' }}>{sortedGroup.length} ocorrências</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {sortedGroup.map((item, itemIdx) => {
                            const isSelected = selectedDuplicates.includes(item.id);
                            const createdDate = item.criadoEm ? new Date(item.criadoEm).toLocaleString('pt-BR') : 'Desconhecida';
                            const createdBy = item.criadoPor || 'Desconhecido';
                            
                            let detail = '';
                            if (duplicateTab === 'servicos') {
                              detail = `OS: ${item.numOS || 'Sem OS'} | Desc: ${item.descricaoMaterial || 'Sem descrição'} | Mecânico: ${item.mecanico || 'N/A'}`;
                            } else if (duplicateTab === 'compras') {
                              detail = `OS: ${item.numOS || 'Sem OS'} | Desc: ${item.descricaoMaterial || 'Sem descrição'} | Categoria: ${item.categoria || 'N/A'}`;
                            } else {
                              detail = `Nº OS: ${item.numOS || 'Sem OS'} | Desc: ${item.descricaoMaterial || 'Sem descrição'} | Cliente: ${item.nomeCliente || 'N/A'}`;
                            }

                            return (
                              <label
                                key={item.id}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '6px', background: isSelected ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255,255,255,0.01)', border: isSelected ? '1px dashed rgba(239, 68, 68, 0.3)' : '1px solid transparent', cursor: 'pointer' }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedDuplicates(prev => [...prev, item.id]);
                                    } else {
                                      setSelectedDuplicates(prev => prev.filter(id => id !== item.id));
                                    }
                                  }}
                                />
                                <div style={{ flex: 1, fontSize: '13px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: '500' }}>{itemIdx === 0 ? '🟢 Manter' : '🔴 Excluir (Duplicata)'}</span>
                                    <span style={{ color: 'var(--muted)', fontSize: '11px' }}>Criado em {createdDate} por {createdBy}</span>
                                  </div>
                                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{detail}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn ghost" type="button" onClick={() => setDuplicateModal(false)}>Fechar</button>
              <button 
                className="btn" 
                style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
                disabled={selectedDuplicates.length === 0} 
                onClick={handleDeleteSelectedDuplicates}
              >
                🗑️ Excluir Selecionados ({selectedDuplicates.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Process & Progress Modal */}
      <ProgressModal
        isOpen={progressModal.open}
        title={progressModal.title}
        current={progressModal.current}
        total={progressModal.total}
        message={progressModal.message}
        subMessage={progressModal.subMessage}
      />

      {/* Toast */}
      {toastMessage && <div className="toast show" id="toast">{toastMessage}</div>}
    </div>
  );
};

// ── FORM FIELD ──
const Field = ({ label, type = 'text', value, onChange, options, readOnly, step }) => (
  <div className="form-group">
    <label>{label}</label>
    {options ? (
      <select value={value} onChange={onChange} disabled={readOnly}>
        {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
    ) : (
      <input 
        type={type} 
        value={type === 'number' && value === 0 ? '' : value} 
        onChange={onChange} 
        readOnly={readOnly} 
        step={step} 
        onFocus={(e) => {
          if (type === 'number') {
            e.target.select();
          }
        }}
      />
    )}
  </div>
);

export default AutoGeral;
