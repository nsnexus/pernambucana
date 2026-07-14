import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import TopNav from '../components/TopNav';
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

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DEPARTMENTS = ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria'];
const DEPT_LABELS = {
  Mecanica: 'Mecânica',
  Peças: 'Peças',
  Retifica: 'Retífica',
  Torneadora: 'Torneadora',
  Caldeiraria: 'Caldeiraria'
};

// Date format parser (YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY, etc.)
function parseYearMonth(dateStr) {
  if (!dateStr) return { year: '', month: 0, day: 0 };
  const s = String(dateStr).trim();
  
  let m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (m) {
    return { year: m[1], month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
  }
  
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (m) {
    const p1 = parseInt(m[1], 10);
    const p2 = parseInt(m[2], 10);
    const year = m[3];
    if (p1 > 12) {
      return { year, month: p2, day: p1 };
    } else if (p2 > 12) {
      return { year, month: p1, day: p2 };
    } else {
      return { year, month: p2, day: p1 };
    }
  }
  return { year: '', month: 0, day: 0 };
}

// Normalized split parser for boletos
function parseBoletoSectors(setorStr) {
  if (!setorStr) return ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria'];
  const s = String(setorStr).trim().toLowerCase();
  
  if (s === 'todos' || s === '5x') {
    return ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria'];
  }
  
  const parts = s.split(/[,;]/).map(x => x.trim()).filter(Boolean);
  const secs = [];
  parts.forEach(p => {
    if (p === 'm' || p.includes('mecan')) secs.push('Mecanica');
    else if (p === 'c' || p.includes('calde')) secs.push('Caldeiraria');
    else if (p === 't' || p.includes('torne')) secs.push('Torneadora');
    else if (p === 'p' || p.includes('pec')) secs.push('Peças');
    else if (p === 'r' || p.includes('retif')) secs.push('Retifica');
  });
  
  return secs.length > 0 ? secs : ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria'];
}

// Normalized split parser for compras
function parseCompraSectors(setorStr) {
  if (!setorStr) return ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria'];
  const s = String(setorStr).trim().toLowerCase();
  
  if (s === 'todos' || s === '5x') {
    return ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria'];
  }
  
  const parts = s.split(/[,;]/).map(x => x.trim()).filter(Boolean);
  const secs = [];
  parts.forEach(p => {
    if (p === 'm' || p.includes('mecan')) secs.push('Mecanica');
    else if (p === 'c' || p.includes('calde')) secs.push('Caldeiraria');
    else if (p === 't' || p.includes('torne')) secs.push('Torneadora');
    else if (p === 'p' || p.includes('pec')) secs.push('Peças');
    else if (p === 'r' || p.includes('retif')) secs.push('Retifica');
  });
  
  return secs.length > 0 ? secs : ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria'];
}

const Pernambucana = () => {
  const { currentUser } = useAuth();
  const {
    allServicos: rawServicos, allCompras: rawCompras, allBoletos: rawBoletos, allRecebiveis: rawRecebiveis, loading,
    addServico, updateServico, deleteServico,
    addCompra, updateCompra, deleteCompra,
    addBoleto, updateBoleto, deleteBoleto,
    toggleRecebivel, normalizeSector, enableRawQueries
  } = useData();

  useEffect(() => {
    if (enableRawQueries) {
      enableRawQueries();
    }
  }, [enableRawQueries]);

  // Filter out any AltoGeral / external data from Pernambucana context
  const allServicos = useMemo(() => rawServicos.filter(s => normalizeSector(s.setor).toLowerCase() !== 'altogeral'), [rawServicos, normalizeSector]);
  const allCompras = useMemo(() => rawCompras.filter(c => {
    const secs = c.setores && c.setores.length > 0 ? c.setores : parseCompraSectors(c.setor);
    return secs.some(s => normalizeSector(s).toLowerCase() !== 'altogeral');
  }), [rawCompras, normalizeSector]);
  const allBoletos = useMemo(() => rawBoletos.filter(b => {
    const secs = b.setores && b.setores.length > 0 ? b.setores : parseBoletoSectors(b.setor);
    return secs.some(s => normalizeSector(s).toLowerCase() !== 'altogeral');
  }), [rawBoletos, normalizeSector]);
  const allRecebiveis = useMemo(() => rawRecebiveis.filter(r => normalizeSector(r.setor).toLowerCase() !== 'altogeral'), [rawRecebiveis, normalizeSector]);

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

  // Active Tab
  const [activeTab, setActiveTab] = useState(() => {
    return currentUser?.isAdmin ? 'dashboard' : 'servicos';
  });

  // Filters
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [dayFilter, setDayFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all'); // Sector filter for the dashboard and lists

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Bulk selection states
  const [selectedServicos, setSelectedServicos] = useState([]);
  const [selectedCompras, setSelectedCompras] = useState([]);
  const [selectedBoletos, setSelectedBoletos] = useState([]);

  // Reset selections on tab/filter changes to avoid deleting wrong/hidden items
  useEffect(() => {
    setSelectedServicos([]);
    setSelectedCompras([]);
    setSelectedBoletos([]);
  }, [activeTab, monthFilter, yearFilter, dayFilter, searchQuery, statusFilter, deptFilter]);


  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const triggerToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 2600); };

  // Modals state
  const [servicoModal, setServicoModal] = useState(false);
  const [servicoEditId, setServicoEditId] = useState(null);
  const [servicoForm, setServicoForm] = useState({
    data: '', pagamento: 'À vista', cliente: '', descricao: '',
    os: '', valorTotal: 0, valorUnitario: 0, valorServicos: 0, valorPecas: 0,
    material: 0, produtivo: '', valorProdutivo: 0, desconto: 0,
    tipoServico: 'Serviços', setor: 'Mecanica', numParcelas: 0
  });

  const [compraModal, setCompraModal] = useState(false);
  const [compraEditId, setCompraEditId] = useState(null);
  const [compraForm, setCompraForm] = useState({
    data: '', formaCompra: 'À vista', solicitante: '', descricao: '',
    numOS: '', valorOS: 0, valorProduto: 0, fornecedor: '',
    numPedido: '', categoria: 'Almoxarifado', setor: 'Mecanica', numParcelas: 0,
    setores: []
  });

  const [boletoModal, setBoletoModal] = useState(false);
  const [boletoEditId, setBoletoEditId] = useState(null);
  const [boletoForm, setBoletoForm] = useState({
    dataVencimento: '', fornecedor: '', descricao: '', valorBoleto: 0,
    setor: 'Todos', status: 'Pago', dataPagamento: '', setores: []
  });

  // Excel paste import modal
  const [importModal, setImportModal] = useState(false);
  const [importType, setImportType] = useState('servicos');
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [parsedImportItems, setParsedImportItems] = useState([]);

  // Duplicate check modal state
  const [duplicateModal, setDuplicateModal] = useState(false);
  const [duplicateTab, setDuplicateTab] = useState('servicos');
  const [selectedDuplicates, setSelectedDuplicates] = useState([]);

  // Spreadsheet view mode (Excel style direct grid edit)
  const [gridEditMode, setGridEditMode] = useState(false);
  const [gridChanges, setGridChanges] = useState({});

  // Reset filters and page on tab switcher click
  useEffect(() => {
    setCurrentPage(1);
    setGridEditMode(false);
    setGridChanges({});
    setDayFilter('all');
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [monthFilter, yearFilter, dayFilter, searchQuery, statusFilter, deptFilter]);

  // Sync sector for non-admin on mount/login
  useEffect(() => {
    if (currentUser && !currentUser.isAdmin) {
      const allowed = currentUser.allowedSectors || [];
      if (allowed.length > 0 && !allowed.includes(deptFilter)) {
        setDeptFilter(allowed[0]);
      }
    }
  }, [currentUser, deptFilter]);

  // Format currency
  const fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  // Get duplicate groups for each tab
  const getDuplicateGroups = useMemo(() => {
    const getServicosDuplicates = () => {
      const groups = {};
      allServicos.forEach(s => {
        const clienteNorm = String(s.cliente || '').trim().toLowerCase();
        const valorNorm = parseFloat(s.valorTotal) || 0;
        const refNorm = String(s.os ? s.os : (s.descricao || '')).trim().toLowerCase();
        const key = `${s.data || ''}|${clienteNorm}|${valorNorm}|${refNorm}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
      });
      return Object.values(groups).filter(g => g.length > 1);
    };

    const getComprasDuplicates = () => {
      const groups = {};
      allCompras.forEach(c => {
        const fornecedorNorm = String(c.fornecedor || '').trim().toLowerCase();
        const valorNorm = parseFloat(c.valorProduto) || 0;
        const descNorm = String(c.descricao || '').trim().toLowerCase();
        const key = `${c.data || ''}|${fornecedorNorm}|${valorNorm}|${descNorm}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
      });
      return Object.values(groups).filter(g => g.length > 1);
    };

    const getBoletosDuplicates = () => {
      const groups = {};
      allBoletos.forEach(b => {
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
  }, [allServicos, allCompras, allBoletos]);

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

  // Generate dynamic years dropdown options
  const yearsList = useMemo(() => {
    const years = new Set();
    allServicos.forEach(s => { const { year } = parseYearMonth(s.data); if (year) years.add(year); });
    allCompras.forEach(c => { const { year } = parseYearMonth(c.data); if (year) years.add(year); });
    allBoletos.forEach(b => { const { year } = parseYearMonth(b.dataVencimento); if (year) years.add(year); });
    allRecebiveis.forEach(r => { const { year } = parseYearMonth(r.dataVencimento); if (year) years.add(year); });
    years.add(String(new Date().getFullYear()));
    years.add(String(new Date().getFullYear() - 1));
    return Array.from(years).filter(Boolean).sort((a, b) => b - a);
  }, [allServicos, allCompras, allBoletos, allRecebiveis]);

  // ── DASHBOARD CALCULATIONS ──
  const dashboardStats = useMemo(() => {
    const filterByMonthYear = (item, dateField) => {
      const dateStr = item[dateField];
      if (!dateStr) return false;
      const { year: y, month: m } = parseYearMonth(dateStr);
      
      const matchMonth = monthFilter === 'all' || String(m) === monthFilter;
      const matchYear = yearFilter === 'all' || String(y) === yearFilter;
      return matchMonth && matchYear;
    };

    // Filter root items by month and year
    const sFiltered = allServicos.filter(s => filterByMonthYear(s, 'data'));
    const cFiltered = allCompras.filter(c => filterByMonthYear(c, 'data'));
    const bFiltered = allBoletos.filter(b => filterByMonthYear(b, 'dataVencimento'));
    const rFiltered = allRecebiveis.filter(r => {
      const field = r.status === 'Recebido' ? 'dataRecebimento' : 'dataVencimento';
      return filterByMonthYear(r, field);
    });

    // 1. SERVICES REVENUE
    const totalServicos = sFiltered
      .filter(s => deptFilter === 'all' || normalizeSector(s.setor) === deptFilter)
      .reduce((sum, s) => sum + (parseFloat(s.valorTotal) || 0), 0);

    // 2. ENTRADAS À VISTA
    const totalServicoVista = sFiltered
      .filter(s => deptFilter === 'all' || normalizeSector(s.setor) === deptFilter)
      .filter(s => !String(s.pagamento || '').toLowerCase().includes('prazo'))
      .reduce((sum, s) => sum + (parseFloat(s.valorTotal) || 0), 0);

    // 3. ENTRADAS A PRAZO (RECEBIDOS)
    const recebiveisRecebidosList = rFiltered
      .filter(r => deptFilter === 'all' || normalizeSector(r.setor) === deptFilter)
      .filter(r => r.status === 'Recebido');
    const totalRecebido = recebiveisRecebidosList.reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);

    // 4. RECEBÍVEIS PENDENTES
    const recebiveisPendentesList = rFiltered
      .filter(r => deptFilter === 'all' || normalizeSector(r.setor) === deptFilter)
      .filter(r => r.status === 'Pendente');
    const totalPendente = recebiveisPendentesList.reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);

    // 5. RECEBÍVEIS VENCIDOS
    const hojeStr = new Date().toISOString().split('T')[0];
    const recebiveisVencidosList = recebiveisPendentesList.filter(r => r.dataVencimento < hojeStr);
    const totalVencido = recebiveisVencidosList.reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);

    // 6. COMPRAS (internal detail, doesn't reduce cash flow - SPLIT PROPORTIONAL TO FILTERED SECTOR)
    let totalCompras = 0;
    const splitComprasList = [];
    cFiltered.forEach(c => {
      const secs = c.setores && c.setores.length > 0 ? c.setores : parseCompraSectors(c.setor);
      const valSplit = (parseFloat(c.valorProduto) || 0) / secs.length;
      if (deptFilter === 'all') {
        totalCompras += parseFloat(c.valorProduto) || 0;
        splitComprasList.push({ ...c, valorSplit: parseFloat(c.valorProduto) || 0 });
      } else if (secs.includes(deptFilter)) {
        totalCompras += valSplit;
        splitComprasList.push({ ...c, valorSplit: valSplit });
      }
    });

    // 6.1 COMPRAS À VISTA / PIX / CARTÃO (Outflows - SPLIT PROPORTIONAL TO FILTERED SECTOR)
    let totalComprasVista = 0;
    cFiltered
      .filter(c => !String(c.formaCompra || '').toLowerCase().includes('prazo'))
      .forEach(c => {
        const secs = c.setores && c.setores.length > 0 ? c.setores : parseCompraSectors(c.setor);
        const valSplit = (parseFloat(c.valorProduto) || 0) / secs.length;
        if (deptFilter === 'all') {
          totalComprasVista += parseFloat(c.valorProduto) || 0;
        } else if (secs.includes(deptFilter)) {
          totalComprasVista += valSplit;
        }
      });

    // 7. SAÍDAS (BOLETOS A PAGAR - SPLIT PROPORTIONAL TO FILTERED SECTOR)
    let totalBoletos = 0;
    const splitBoletosList = [];
    
    bFiltered.forEach(b => {
      // Resolve multi-sectors
      const secs = b.setores && b.setores.length > 0 ? b.setores : parseBoletoSectors(b.setor);
      const valSplit = (parseFloat(b.valorBoleto) || 0) / secs.length;
      
      if (deptFilter === 'all') {
        totalBoletos += parseFloat(b.valorBoleto) || 0;
        splitBoletosList.push({ ...b, valorSplit: parseFloat(b.valorBoleto) || 0 });
      } else if (secs.includes(deptFilter)) {
        totalBoletos += valSplit;
        splitBoletosList.push({ ...b, valorSplit: valSplit });
      }
    });

    const entradas = totalServicoVista + totalRecebido;
    const saidas = totalBoletos + totalComprasVista;
    const saldo = entradas - saidas;

    return {
      totalServicos,
      totalServicoVista,
      totalRecebido,
      totalPendente,
      totalVencido,
      totalBoletos,
      totalCompras,
      totalComprasVista,
      entradas,
      saidas,
      saldo,
      recebiveisVencidos: recebiveisVencidosList.length,
      recebiveisPendentes: recebiveisPendentesList.length,
      recebiveisRecebidos: recebiveisRecebidosList.length,
      sFiltered,
      cFiltered,
      bFiltered,
      rFiltered,
      splitBoletosList,
      splitComprasList
    };
  }, [allServicos, allCompras, allBoletos, allRecebiveis, monthFilter, yearFilter, deptFilter]);

  // ── GRID FILTERING FOR PAGES ──
  const filterList = (list, extraFilter) => {
    return list.filter(item => {
      // Perms sector lock check
      const sec = normalizeSector(item.setor);
      if (currentUser && !currentUser.isAdmin && currentUser.allowedSectors && !currentUser.allowedSectors.includes(sec)) {
        // For items with multiple sectors, check if any allowed sector is in the list
        if (item.setores) {
          const allowedMatch = item.setores.some(s => currentUser.allowedSectors.includes(s));
          if (!allowedMatch) return false;
        } else {
          return false;
        }
      }

      // Department dropdown filter
      if (deptFilter !== 'all') {
        if (item.setores) {
          if (!item.setores.includes(deptFilter)) return false;
        } else if (sec !== deptFilter) {
          return false;
        }
      }

      const dateStr = item.data || item.dataVencimento;
      const { year: yNum, month: mNum, day: dNum } = parseYearMonth(dateStr);
      
      const matchMonth = monthFilter === 'all' || String(mNum) === monthFilter;
      const matchYear = yearFilter === 'all' || String(yNum) === yearFilter;
      const matchDay = dayFilter === 'all' || String(dNum) === dayFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || Object.values(item).join(' ').toLowerCase().includes(q);
      const extra = extraFilter ? extraFilter(item) : true;
      return matchMonth && matchYear && matchDay && matchSearch && extra;
    });
  };

  const filteredServicos = useMemo(() => filterList(allServicos), [allServicos, monthFilter, yearFilter, dayFilter, searchQuery, deptFilter, currentUser]);
  const filteredCompras = useMemo(() => filterList(allCompras), [allCompras, monthFilter, yearFilter, dayFilter, searchQuery, deptFilter, currentUser]);
  const filteredBoletos = useMemo(() => filterList(allBoletos), [allBoletos, monthFilter, yearFilter, dayFilter, searchQuery, deptFilter, currentUser]);
  
  const filteredRecebiveis = useMemo(() => filterList(allRecebiveis, (item) => {
    if (statusFilter === 'all') return true;
    const isVencido = item.status === 'Pendente' && item.dataVencimento < hoje;
    if (statusFilter === 'Pendente') {
      return item.status === 'Pendente' && !isVencido;
    }
    if (statusFilter === 'Vencido') {
      return isVencido;
    }
    return item.status === statusFilter;
  }), [allRecebiveis, monthFilter, yearFilter, dayFilter, searchQuery, statusFilter, deptFilter, hoje, currentUser]);

  // ── PAGINATION HELPER ──
  const paginate = (list) => {
    if (gridEditMode) return { paginated: list, totalPages: 1, page: 1, total: list.length };
    const totalPages = Math.ceil(list.length / itemsPerPage) || 1;
    const page = Math.min(currentPage, totalPages);
    const start = (page - 1) * itemsPerPage;
    const paginated = list.slice(start, start + itemsPerPage);
    return { paginated, totalPages, page, total: list.length };
  };

  // ── FORM CRUD ACTIONS ──
  const openAddServico = () => {
    setServicoEditId(null);
    setServicoForm({
      data: hoje, pagamento: 'À vista', cliente: '', descricao: '',
      os: '', valorTotal: 0, valorUnitario: 0, valorServicos: 0, valorPecas: 0,
      material: 0, produtivo: '', valorProdutivo: 0, desconto: 0,
      tipoServico: 'Serviços', setor: deptFilter !== 'all' ? deptFilter : 'Mecanica', numParcelas: 0
    });
    setServicoModal(true);
  };

  const openEditServico = (item) => {
    setServicoEditId(item.id);
    setServicoForm({
      data: item.data || '', pagamento: item.pagamento || 'À vista',
      cliente: item.cliente || '', descricao: item.descricao || '',
      os: item.os || '', valorTotal: item.valorTotal || 0,
      valorUnitario: item.valorUnitario || 0, valorServicos: item.valorServicos || 0,
      valorPecas: item.valorPecas || 0, material: item.material || 0,
      produtivo: item.produtivo || '', valorProdutivo: item.valorProdutivo || 0,
      desconto: item.desconto || 0, tipoServico: item.tipoServico || 'Serviços',
      setor: item.setor || 'Mecanica', numParcelas: item.numParcelas || 0
    });
    setServicoModal(true);
  };

  const handleServicoSubmit = async (e) => {
    e.preventDefault();
    try {
      if (servicoEditId) {
        await updateServico(servicoEditId, servicoForm);
        triggerToast('Serviço atualizado.');
      } else {
        await addServico(servicoForm);
        triggerToast('Serviço adicionado.');
      }
      setServicoModal(false);
    } catch (err) { alert(err.message); }
  };

  const openAddCompra = () => {
    setCompraEditId(null);
    setCompraForm({
      data: hoje, formaCompra: 'À vista', solicitante: '', descricao: '',
      numOS: '', valorOS: 0, valorProduto: 0, fornecedor: '',
      numPedido: '', categoria: 'Almoxarifado', setor: deptFilter !== 'all' ? deptFilter : 'Mecanica', numParcelas: 0,
      setores: deptFilter !== 'all' ? [deptFilter] : ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria']
    });
    setCompraModal(true);
  };

  const openEditCompra = (item) => {
    setCompraEditId(item.id);
    setCompraForm({
      data: item.data || '', formaCompra: item.formaCompra || 'À vista',
      solicitante: item.solicitante || '', descricao: item.descricao || '',
      numOS: item.numOS || '', valorOS: item.valorOS || 0,
      valorProduto: item.valorProduto || 0, fornecedor: item.fornecedor || '',
      numPedido: item.numPedido || '', categoria: item.categoria || 'Almoxarifado',
      setor: item.setor || 'Mecanica', numParcelas: item.numParcelas || 0,
      setores: item.setores || parseCompraSectors(item.setor)
    });
    setCompraModal(true);
  };

  const handleCompraSubmit = async (e) => {
    e.preventDefault();
    try {
      let sectorLabel = 'Todos';
      if (compraForm.setores.length === 1) {
        sectorLabel = compraForm.setores[0];
      } else if (compraForm.setores.length < 5) {
        sectorLabel = compraForm.setores.map(s => {
          if (s === 'Mecanica') return 'M';
          if (s === 'Retifica') return 'R';
          if (s === 'Peças') return 'P';
          if (s === 'Torneadora') return 'T';
          if (s === 'Caldeiraria') return 'C';
          return s.charAt(0).toUpperCase();
        }).join(',');
      }
      const dataPayload = { 
        ...compraForm, 
        setor: sectorLabel 
      };

      if (compraEditId) {
        await updateCompra(compraEditId, dataPayload);
        triggerToast('Compra atualizada.');
      } else {
        await addCompra(dataPayload);
        triggerToast('Compra adicionada.');
      }
      setCompraModal(false);
    } catch (err) { alert(err.message); }
  };

  const openAddBoleto = () => {
    setBoletoEditId(null);
    setBoletoForm({
      dataVencimento: hoje, fornecedor: '', descricao: '', valorBoleto: 0,
      setor: 'Todos', status: 'Pago', dataPagamento: hoje, setores: ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria']
    });
    setBoletoModal(true);
  };

  const openEditBoleto = (item) => {
    setBoletoEditId(item.id);
    setBoletoForm({
      dataVencimento: item.dataVencimento || '', fornecedor: item.fornecedor || '',
      descricao: item.descricao || '', valorBoleto: item.valorBoleto || 0,
      setor: item.setor || 'Todos', status: 'Pago',
      dataPagamento: item.dataPagamento || item.dataVencimento || hoje, setores: item.setores || parseBoletoSectors(item.setor)
    });
    setBoletoModal(true);
  };

  const handleBoletoSubmit = async (e) => {
    e.preventDefault();
    try {
      let sectorLabel = 'Todos';
      if (boletoForm.setores.length === 1) {
        sectorLabel = boletoForm.setores[0].charAt(0).toUpperCase();
      } else if (boletoForm.setores.length < 5) {
        sectorLabel = boletoForm.setores.map(s => {
          if (s === 'Mecanica') return 'M';
          if (s === 'Retifica') return 'R';
          if (s === 'Peças') return 'P';
          if (s === 'Torneadora') return 'T';
          if (s === 'Caldeiraria') return 'C';
          return s.charAt(0).toUpperCase();
        }).join(',');
      }
      const dataPayload = { 
        ...boletoForm, 
        setor: sectorLabel,
        status: 'Pago',
        dataPagamento: boletoForm.dataVencimento
      };

      if (boletoEditId) {
        await updateBoleto(boletoEditId, dataPayload);
        triggerToast('Boleto atualizado.');
      } else {
        await addBoleto(dataPayload);
        triggerToast('Boleto adicionado.');
      }
      setBoletoModal(false);
    } catch (err) { alert(err.message); }
  };

  // ── SPREADSHEET IN-LINE DIRECT GRID SAVING ──
  const handleGridCellChange = (id, field, value) => {
    setGridChanges(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value
      }
    }));
  };

  const saveGridChanges = async () => {
    const list = Object.entries(gridChanges);
    if (list.length === 0) return;
    try {
      for (const [id, changes] of list) {
        if ('valorTotal' in changes) changes.valorTotal = parseFloat(changes.valorTotal) || 0;
        if ('valorUnitario' in changes) changes.valorUnitario = parseFloat(changes.valorUnitario) || 0;
        if ('valorOS' in changes) changes.valorOS = parseFloat(changes.valorOS) || 0;
        if ('valorProduto' in changes) changes.valorProduto = parseFloat(changes.valorProduto) || 0;
        if ('valorBoleto' in changes) changes.valorBoleto = parseFloat(changes.valorBoleto) || 0;

        if ('setor' in changes) {
          if (activeTab === 'boletos') {
            changes.setores = parseBoletoSectors(changes.setor);
          } else if (activeTab === 'compras') {
            changes.setores = parseCompraSectors(changes.setor);
          }
        }

        if (activeTab === 'servicos') await updateServico(id, changes);
        else if (activeTab === 'compras') await updateCompra(id, changes);
        else if (activeTab === 'boletos') await updateBoleto(id, changes);
      }
      triggerToast('Alterações salvas com sucesso.');
      setGridEditMode(false);
      setGridChanges({});
    } catch (err) { alert('Erro: ' + err.message); }
  };

  // Bulk deletes
  const handleDeleteSelectedServicos = async () => {
    if (!window.confirm(`Excluir ${selectedServicos.length} serviços selecionados?`)) return;
    try {
      for (const id of selectedServicos) {
        await deleteServico(id);
      }
      setSelectedServicos([]);
      triggerToast('Registros excluídos com sucesso.');
    } catch (err) { alert('Erro ao excluir: ' + err.message); }
  };

  const handleDeleteSelectedCompras = async () => {
    if (!window.confirm(`Excluir ${selectedCompras.length} compras selecionadas?`)) return;
    try {
      for (const id of selectedCompras) {
        await deleteCompra(id);
      }
      setSelectedCompras([]);
      triggerToast('Registros excluídos com sucesso.');
    } catch (err) { alert('Erro ao excluir: ' + err.message); }
  };

  const handleDeleteSelectedBoletos = async () => {
    if (!window.confirm(`Excluir ${selectedBoletos.length} boletos selecionados?`)) return;
    try {
      for (const id of selectedBoletos) {
        await deleteBoleto(id);
      }
      setSelectedBoletos([]);
      triggerToast('Registros excluídos com sucesso.');
    } catch (err) { alert('Erro ao excluir: ' + err.message); }
  };

  // ── EXCEL PASTE PARSE LOGIC ──
  const parseExcelNumber = (v) => {
    let s = String(v ?? '').trim();
    if (!s || s === '-') return 0;
    s = s.replace(/R\$/gi, '').replace(/\s/g, '');
    if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const parseExcelDate = (v) => {
    let s = String(v ?? '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (m) {
      const p1 = parseInt(m[1], 10);
      const p2 = parseInt(m[2], 10);
      const year = m[3];
      if (p1 > 12) {
        return `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      } else if (p2 > 12) {
        return `${year}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
      } else {
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
    
    const norm = (str) => String(str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const firstRowHasHeaders = lines[0] && lines[0].some(cell => {
      const c = norm(cell);
      return ['data', 'mes', 'forma', 'cliente', 'material', 'fornecedor', 'valor', 'boleto', 'vencimento', 'lancamento', 'setor', 'os'].includes(c);
    });

    let headerMap = {};
    if (firstRowHasHeaders) {
      lines[0].forEach((cell, idx) => {
        headerMap[norm(cell)] = idx;
      });
      startIndex = 1;
    }

    if (lines.length <= startIndex) {
      setImportPreview(<span style={{ color: 'var(--red)' }}>Nenhum dado válido encontrado.</span>);
      setParsedImportItems([]);
      return;
    }

    const parsedList = [];
    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i];
      if (cols.length === 1 && cols[0].trim() === '') continue;

      const getVal = (headerNames, fallbackIndex) => {
        for (const name of headerNames) {
          const normName = norm(name);
          if (headerMap[normName] !== undefined) {
            return cols[headerMap[normName]];
          }
        }
        if (fallbackIndex !== undefined && fallbackIndex < cols.length) {
          return cols[fallbackIndex];
        }
        return '';
      };

      if (type === 'servicos') {
        let dataVal = '';
        let mesVal = '';
        let setorVal = '';
        let pagamentoVal = '';
        let clienteVal = '';
        let descricaoVal = '';
        let osVal = '';
        let qtdVal = 1;
        let unitVal = 0;
        let totalVal = 0;
        let descontoVal = 0;
        let produtivoVal = '';
        let valorProdutivoVal = 0;
        let materialVal = 0;
        let tipoServicoVal = 'Serviços';

        if (firstRowHasHeaders) {
          dataVal = getVal(['data']);
          mesVal = getVal(['mes']);
          setorVal = getVal(['setor', 'lancamento', 'departamento']);
          pagamentoVal = getVal(['pagamento', 'forma de compra', 'forma compra', 'forma']);
          clienteVal = getVal(['cliente', 'nome do cliente', 'nome cliente']);
          descricaoVal = getVal(['descricao', 'descricao do material', 'descricao material', 'material/servico']);
          osVal = getVal(['os', 'nº da os', 'no da os', 'num os', 'nº os', 'no os', 'numero os']);
          qtdVal = parseExcelNumber(getVal(['qtd', 'quantidade'])) || 1;
          unitVal = parseExcelNumber(getVal(['valor unit.', 'valor unitario', 'valor unit']));
          totalVal = parseExcelNumber(getVal(['valor total', 'valor da os', 'valor os', 'total', 'valor']));
          descontoVal = parseExcelNumber(getVal(['desconto']));
          produtivoVal = getVal(['produtivo', 'mecanico']);
          valorProdutivoVal = parseExcelNumber(getVal(['comissao', 'valor produtivo']));
          materialVal = parseExcelNumber(getVal(['material', 'valor material']));
          tipoServicoVal = getVal(['tipo de servico', 'tipo servico']) || 'Serviços';
        } else {
          const count = cols.length;
          if (count === 12) {
            dataVal = cols[0];
            mesVal = cols[1];
            setorVal = cols[2];
            pagamentoVal = cols[3];
            clienteVal = cols[4];
            descricaoVal = cols[5];
            osVal = cols[6];
            totalVal = parseExcelNumber(cols[7]);
            unitVal = totalVal;
            materialVal = parseExcelNumber(cols[10]);
            produtivoVal = cols[11];
            tipoServicoVal = setorVal || 'Torneadora';
          } else if (count === 14) {
            dataVal = cols[0];
            setorVal = cols[1];
            clienteVal = cols[2];
            descricaoVal = cols[3];
            tipoServicoVal = cols[4];
            qtdVal = parseExcelNumber(cols[5]) || 1;
            osVal = cols[6];
            unitVal = parseExcelNumber(cols[7]);
            totalVal = parseExcelNumber(cols[8]);
            descontoVal = parseExcelNumber(cols[9]);
            pagamentoVal = cols[10];
            produtivoVal = cols[11];
            valorProdutivoVal = parseExcelNumber(cols[12]);
            materialVal = parseExcelNumber(cols[13]);
          } else if (count === 15) {
            dataVal = cols[0];
            mesVal = cols[1];
            setorVal = cols[2];
            clienteVal = cols[3];
            descricaoVal = cols[4];
            tipoServicoVal = cols[5];
            qtdVal = parseExcelNumber(cols[6]) || 1;
            osVal = cols[7];
            unitVal = parseExcelNumber(cols[8]);
            totalVal = parseExcelNumber(cols[9]);
            descontoVal = parseExcelNumber(cols[10]);
            pagamentoVal = cols[11];
            produtivoVal = cols[12];
            valorProdutivoVal = parseExcelNumber(cols[13]);
            materialVal = parseExcelNumber(cols[14]);
          } else {
            while (cols.length < 16) cols.push('');
            dataVal = cols[0];
            mesVal = cols[1];
            setorVal = cols[2];
            pagamentoVal = cols[3];
            clienteVal = cols[5];
            descricaoVal = cols[6];
            qtdVal = parseExcelNumber(cols[7]) || 1;
            osVal = cols[8];
            unitVal = parseExcelNumber(cols[9]);
            totalVal = parseExcelNumber(cols[10]);
            produtivoVal = cols[11];
            valorProdutivoVal = parseExcelNumber(cols[12]);
            descontoVal = parseExcelNumber(cols[13]);
            materialVal = parseExcelNumber(cols[14]);
            tipoServicoVal = cols[15];
          }
        }

        const isPrazo = norm(pagamentoVal).includes('prazo');

        parsedList.push({
          data: parseExcelDate(dataVal),
          mes: mesVal || getDateInfo(parseExcelDate(dataVal)).mesName,
          setor: normalizeSector(setorVal) || 'Retifica',
          pagamento: isPrazo ? 'À prazo' : 'À vista',
          cliente: cleanCell(clienteVal) || 'Cliente Importado',
          descricao: cleanCell(descricaoVal),
          qtd: qtdVal,
          os: cleanCell(osVal),
          valorUnitario: unitVal || (totalVal / qtdVal) || 0,
          valorTotal: totalVal || (unitVal * qtdVal) || 0,
          produtivo: cleanCell(produtivoVal),
          valorProdutivo: valorProdutivoVal || 0,
          desconto: descontoVal || 0,
          material: materialVal || 0,
          tipoServico: cleanCell(tipoServicoVal) || 'Serviços',
          numParcelas: isPrazo ? 1 : 0
        });
      } else if (type === 'compras') {
        let dataVal = '';
        let mesVal = '';
        let setorVal = '';
        let formaVal = '';
        let solicitanteVal = '';
        let descricaoVal = '';
        let numOSVal = '';
        let valorOSVal = 0;
        let valorProdutoVal = 0;
        let fornecedorVal = '';
        let numPedidoVal = '';
        let categoriaVal = 'Almoxarifado';

        if (firstRowHasHeaders) {
          dataVal = getVal(['data']);
          mesVal = getVal(['mes']);
          setorVal = getVal(['setor', 'lancamento']);
          formaVal = getVal(['forma', 'forma de compra', 'forma compra', 'pagamento']);
          solicitanteVal = getVal(['solicitante']);
          descricaoVal = getVal(['descricao', 'descricao do material', 'descricao material']);
          numOSVal = getVal(['os', 'nº da os', 'no da os', 'num os', 'nº os', 'no os', 'numero os']);
          valorOSVal = parseExcelNumber(getVal(['valor os', 'valor da os']));
          valorProdutoVal = parseExcelNumber(getVal(['valor produto', 'valor', 'valor peca', 'valor unitario']));
          fornecedorVal = getVal(['fornecedor']);
          numPedidoVal = getVal(['nº pedido', 'no pedido', 'num pedido', 'numero pedido']);
          categoriaVal = getVal(['categoria']) || 'Almoxarifado';
        } else {
          while (cols.length < 12) cols.push('');
          dataVal = cols[0];
          mesVal = cols[1];
          setorVal = cols[2];
          formaVal = cols[3];
          solicitanteVal = cols[4];
          descricaoVal = cols[5];
          numOSVal = cols[6];
          valorOSVal = parseExcelNumber(cols[7]);
          valorProdutoVal = parseExcelNumber(cols[8]);
          fornecedorVal = cols[9];
          numPedidoVal = cols[10];
          categoriaVal = cols[11];
        }

        const isPrazo = norm(formaVal).includes('prazo');
        const secsNormalized = parseCompraSectors(setorVal);

        parsedList.push({
          data: parseExcelDate(dataVal),
          mes: mesVal || getDateInfo(parseExcelDate(dataVal)).mesName,
          setor: setorVal || 'Todos',
          setores: secsNormalized,
          formaCompra: isPrazo ? 'À prazo' : 'À vista',
          solicitante: cleanCell(solicitanteVal),
          descricao: cleanCell(descricaoVal) || 'Compra Importada',
          numOS: cleanCell(numOSVal),
          valorOS: valorOSVal || 0,
          valorProduto: valorProdutoVal || 0,
          fornecedor: cleanCell(fornecedorVal),
          numPedido: cleanCell(numPedidoVal),
          categoria: cleanCell(categoriaVal) || 'Almoxarifado',
          numParcelas: isPrazo ? 1 : 0
        });
      } else if (type === 'boletos') {
        let mesVencVal = '';
        let dataVencVal = '';
        let fornecedorVal = '';
        let valorBoletoVal = 0;
        let setorVal = 'Todos';

        if (firstRowHasHeaders) {
          mesVencVal = getVal(['mes', 'mes vencimento', 'mesvencimento']);
          dataVencVal = getVal(['data', 'data vencimento', 'datavencimento', 'vencimento']);
          fornecedorVal = getVal(['fornecedor', 'nome fornecedor']);
          valorBoletoVal = parseExcelNumber(getVal(['valor', 'valor boleto', 'valorboleto']));
          setorVal = getVal(['setor', 'setores', 'lancamento']);
        } else {
          while (cols.length < 5) cols.push('');
          mesVencVal = cols[0];
          dataVencVal = cols[1];
          fornecedorVal = cols[2];
          valorBoletoVal = parseExcelNumber(cols[3]);
          setorVal = cols[4];
        }

        const secsNormalized = parseBoletoSectors(setorVal);

        parsedList.push({
          mesVencimento: cleanCell(mesVencVal),
          dataVencimento: parseExcelDate(dataVencVal),
          fornecedor: cleanCell(fornecedorVal),
          valorBoleto: valorBoletoVal || 0,
          setor: setorVal || 'Todos',
          setores: secsNormalized,
          status: 'Pago',
          dataPagamento: parseExcelDate(dataVencVal)
        });
      }
    }

    setParsedImportItems(parsedList);
    const typeLabel = type === 'servicos' ? 'Serviços' : type === 'compras' ? 'Compras' : 'Boletos';
    setImportPreview(
      <div style={{ color: 'var(--green)', textAlign: 'left' }}>
        <strong>✔ Formato Identificado:</strong> {typeLabel}<br/>
        <strong>📊 Registros Encontrados:</strong> {parsedList.length} linhas de dados.<br/>
        <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>Clique no botão abaixo para salvar permanentemente no banco.</small>
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
    if (parsedImportItems.length === 0) return;
    try {
      let count = 0;
      for (const item of parsedImportItems) {
        if (currentUser && !currentUser.isAdmin) {
          if (importType !== 'boletos') item.setor = currentUser.sector;
        }

        if (importType === 'servicos') {
          await addServico(item);
        } else if (importType === 'compras') {
          await addCompra(item);
        } else if (importType === 'boletos') {
          await addBoleto(item);
        }
        count++;
      }
      triggerToast(`${count} registros importados com sucesso.`);
      setImportModal(false);
      setImportText('');
      setImportPreview(null);
      setParsedImportItems([]);
    } catch (err) { alert('Erro na importação: ' + err.message); }
  };

  // ── CHARTS SETUP ──
  const barChartData = useMemo(() => {
    const revenueByDept = { Mecanica: 0, Peças: 0, Retifica: 0, Torneadora: 0, Caldeiraria: 0 };
    const comprasByDept = { Mecanica: 0, Peças: 0, Retifica: 0, Torneadora: 0, Caldeiraria: 0 };

    dashboardStats.sFiltered.forEach(s => {
      const sec = normalizeSector(s.setor);
      if (revenueByDept[sec] !== undefined) revenueByDept[sec] += (parseFloat(s.valorTotal) || 0);
    });

    dashboardStats.cFiltered.forEach(c => {
      const secs = c.setores && c.setores.length > 0 ? c.setores : parseCompraSectors(c.setor);
      const valSplit = (parseFloat(c.valorProduto) || 0) / secs.length;
      secs.forEach(s => {
        const sec = normalizeSector(s);
        if (comprasByDept[sec] !== undefined) comprasByDept[sec] += valSplit;
      });
    });

    const labels = DEPARTMENTS.map(d => DEPT_LABELS[d]);
    return {
      labels,
      datasets: [
        { label: 'Serviços (Receita)', data: DEPARTMENTS.map(d => revenueByDept[d]), backgroundColor: 'rgba(31, 182, 255, 0.85)', borderRadius: 6 },
        { label: 'Compras (Custos Internos)', data: DEPARTMENTS.map(d => comprasByDept[d]), backgroundColor: 'rgba(236, 177, 31, 0.75)', borderRadius: 6 }
      ]
    };
  }, [dashboardStats]);

  const commissionChartData = useMemo(() => {
    const grouped = {};
    dashboardStats.sFiltered.forEach(s => {
      const name = s.produtivo || 'Não informado';
      const val = parseFloat(s.valorProdutivo) || 0;
      if (val > 0) {
        grouped[name] = (grouped[name] || 0) + val;
      }
    });
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      labels: sorted.map(s => s[0]),
      datasets: [{ label: 'Comissão', data: sorted.map(s => s[1]), backgroundColor: 'rgba(31,182,255,0.7)', borderRadius: 8 }]
    };
  }, [dashboardStats]);

  const serviceTypeChartData = useMemo(() => {
    const grouped = {};
    dashboardStats.sFiltered.forEach(s => {
      let type = s.tipoServico || s.descricao || 'Outros';
      type = type.trim();
      type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
      const val = parseFloat(s.valorTotal) || 0;
      if (val > 0) {
        grouped[type] = (grouped[type] || 0) + val;
      }
    });
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      labels: sorted.map(x => x[0]),
      datasets: [{ label: 'Faturamento', data: sorted.map(x => x[1]), backgroundColor: 'rgba(31, 182, 255, 0.75)', borderRadius: 8 }]
    };
  }, [dashboardStats]);

  const despesasPieData = useMemo(() => {
    const categorized = {};
    dashboardStats.splitBoletosList.forEach(b => {
      const cat = b.fornecedor || 'Diversos';
      categorized[cat] = (categorized[cat] || 0) + (parseFloat(b.valorSplit) || 0);
    });
    const sorted = Object.entries(categorized).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const sumOthers = Object.entries(categorized).sort((a, b) => b[1] - a[1]).slice(5).reduce((sum, x) => sum + x[1], 0);
    if (sumOthers > 0) {
      sorted.push(['Outros fornecedores', sumOthers]);
    }
    return {
      labels: sorted.map(s => s[0]),
      datasets: [{
        data: sorted.map(s => s[1]),
        backgroundColor: [
          'rgba(31, 182, 255, 0.85)',
          'rgba(236, 177, 31, 0.8)',
          'rgba(244, 63, 94, 0.8)',
          'rgba(14, 165, 233, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(156, 163, 175, 0.8)'
        ],
        borderWidth: 0
      }]
    };
  }, [dashboardStats]);

  const chartCaixaMensal = useMemo(() => {
    const sForYear = allServicos.filter(s => {
      const y = s.data ? s.data.split('-')[0] : '';
      const sectorMatch = deptFilter === 'all' || normalizeSector(s.setor) === deptFilter;
      return (yearFilter === 'all' || y === yearFilter) && sectorMatch;
    });

    const bForYear = [];
    allBoletos.forEach(b => {
      const y = b.dataVencimento ? b.dataVencimento.split('-')[0] : '';
      if (yearFilter !== 'all' && y !== yearFilter) return;

      const secs = b.setores && b.setores.length > 0 ? b.setores : parseBoletoSectors(b.setor);
      const valSplit = (parseFloat(b.valorBoleto) || 0) / secs.length;

      if (deptFilter === 'all') {
        bForYear.push({ ...b, valorSplit: parseFloat(b.valorBoleto) || 0 });
      } else if (secs.includes(deptFilter)) {
        bForYear.push({ ...b, valorSplit: valSplit });
      }
    });

    const rForYear = allRecebiveis.filter(r => {
      const dateStr = r.dataRecebimento || r.dataVencimento || '';
      const y = dateStr ? dateStr.split('-')[0] : '';
      const sectorMatch = deptFilter === 'all' || normalizeSector(r.setor) === deptFilter;
      return (yearFilter === 'all' || y === yearFilter) && sectorMatch;
    });

    const cForYear = allCompras.filter(c => {
      const y = c.data ? c.data.split('-')[0] : '';
      const sectorMatch = deptFilter === 'all' || normalizeSector(c.setor) === deptFilter;
      const isVista = !String(c.formaCompra || '').toLowerCase().includes('prazo');
      return (yearFilter === 'all' || y === yearFilter) && sectorMatch && isVista;
    });

    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const dataEntradas = months.map(n => {
      const sv = sForYear.filter(s => {
        const m = s.data ? parseInt(s.data.split('-')[1], 10) : null;
        return m === n && !String(s.pagamento || '').toLowerCase().includes('prazo');
      });
      const recM = rForYear.filter(r => {
        const m = (r.dataRecebimento || r.dataVencimento || '').split('-')[1];
        return r.status === 'Recebido' && parseInt(m, 10) === n;
      });
      return sv.reduce((sum, x) => sum + (parseFloat(x.valorTotal) || 0), 0) + recM.reduce((sum, x) => sum + (parseFloat(x.valorParcela) || 0), 0);
    });

    const dataSaidas = months.map(n => {
      const bm = bForYear.filter(b => {
        const m = b.dataVencimento ? parseInt(b.dataVencimento.split('-')[1], 10) : null;
        return m === n;
      });
      const cm = cForYear.filter(c => {
        const m = c.data ? parseInt(c.data.split('-')[1], 10) : null;
        return m === n;
      });
      return bm.reduce((sum, x) => sum + (parseFloat(x.valorSplit) || 0), 0) + cm.reduce((sum, x) => sum + (parseFloat(x.valorProduto) || 0), 0);
    });

    return {
      labels: months.map(n => MONTHS[n - 1].slice(0, 3)),
      datasets: [
        { label: 'Entradas', data: dataEntradas, backgroundColor: 'rgba(78,226,71,.8)', borderRadius: 8 },
        { label: 'Saídas', data: dataSaidas, backgroundColor: 'rgba(244,63,94,.8)', borderRadius: 8 }
      ]
    };
  }, [allServicos, allBoletos, allRecebiveis, allCompras, yearFilter, deptFilter]);

  const chartFormaPgto = useMemo(() => {
    const sFiltered = dashboardStats.sFiltered;
    const vista = sFiltered.filter(s => !String(s.pagamento || '').toLowerCase().includes('prazo')).reduce((sum, s) => sum + (parseFloat(s.valorTotal) || 0), 0);
    const prazo = sFiltered.filter(s => String(s.pagamento || '').toLowerCase().includes('prazo')).reduce((sum, s) => sum + (parseFloat(s.valorTotal) || 0), 0);
    return {
      labels: ['À Vista', 'À Prazo'],
      datasets: [{ data: [vista, prazo], backgroundColor: ['rgba(78,226,71,.85)', 'rgba(245,158,11,.85)'], borderWidth: 0 }]
    };
  }, [dashboardStats]);

  const chartRecebiveisStatus = useMemo(() => {
    const rFiltered = dashboardStats.rFiltered;
    const pendente = rFiltered.filter(r => r.status === 'Pendente').reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);
    const recebido = rFiltered.filter(r => r.status === 'Recebido').reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);
    return {
      labels: ['Pendente', 'Recebido'],
      datasets: [{ data: [pendente, recebido], backgroundColor: ['rgba(245,158,11,.85)', 'rgba(78,226,71,.85)'], borderWidth: 0 }]
    };
  }, [dashboardStats]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', color: whiteTheme ? '#102033' : '#ffffff', font: { weight: 'bold' } } },
      datalabels: {
        display: true,
        color: whiteTheme ? '#102033' : '#ffffff',
        font: { family: 'Inter', weight: 'bold', size: 9 },
        formatter: (v) => !v ? '' : v >= 1000 ? `R$ ${(v/1000).toFixed(0)}k` : `R$ ${v.toFixed(0)}`
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${fmtMoney.format(ctx.raw)}`
        }
      }
    },
    scales: {
      x: { grid: { color: 'transparent' }, ticks: { color: whiteTheme ? '#526276' : '#b9c6d7' } },
      y: { grid: { color: whiteTheme ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.05)' }, ticks: { color: whiteTheme ? '#526276' : '#b9c6d7' } }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', color: whiteTheme ? '#102033' : '#ffffff', font: { size: 11 } } },
      datalabels: {
        formatter: (value, ctx) => {
          const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
          return sum ? `${Math.round(value / sum * 100)}%` : '0%';
        },
        color: '#fff',
        font: { weight: 'bold', size: 11 }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `Valor: ${fmtMoney.format(ctx.raw)}`
        }
      }
    }
  };

  // ── PAGINATION RENDERER ──
  const renderPagination = (p) => {
    if (gridEditMode) return null;
    return (
      <div className="pagination">
        <span className="pagination-info">
          {p.total} registros • Página {p.page} de {p.totalPages}
        </span>
        <div className="pagination-controls">
          <button 
            className="btn-page" 
            disabled={p.page <= 1} 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          >
            ← Anterior
          </button>
          <button 
            className="btn-page" 
            disabled={p.page >= p.totalPages} 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, p.totalPages))}
          >
            Próximo →
          </button>
        </div>
      </div>
    );
  };

  // ── FILTER BAR RENDERING ──
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

      {/* Sector filter */}
      <label>
        Setor
        <select 
          value={deptFilter} 
          onChange={(e) => setDeptFilter(e.target.value)}
          disabled={currentUser && !currentUser.isAdmin && currentUser.allowedSectors && currentUser.allowedSectors.length <= 1}
        >
          {currentUser?.isAdmin && <option value="all">Todos os Setores</option>}
          {!currentUser?.isAdmin && currentUser?.allowedSectors && currentUser.allowedSectors.length > 1 && <option value="all">Meus Setores</option>}
          {DEPARTMENTS.map(d => {
            if (currentUser && !currentUser.isAdmin && currentUser.allowedSectors && !currentUser.allowedSectors.includes(d)) return null;
            return <option key={d} value={d}>{DEPT_LABELS[d]}</option>;
          })}
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
        <input type="search" placeholder="Buscar por OS, cliente, fornecedor..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </label>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        {['servicos', 'compras', 'boletos', 'recebiveis'].includes(activeTab) && (
          <button 
            className="btn" 
            type="button"
            onClick={() => window.print()}
            style={{ height: '38px', backgroundColor: '#1fb6ff', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            title={activeTab === 'compras' ? "Imprimir todas as compras filtradas" : activeTab === 'servicos' ? "Imprimir todos os serviços filtrados" : activeTab === 'boletos' ? "Imprimir todos os boletos filtrados" : "Imprimir todos os recebíveis filtrados"}
          >
            🖨️ Imprimir
          </button>
        )}
        {activeTab === 'servicos' && selectedServicos.length > 0 && (
          <button className="btn" onClick={handleDeleteSelectedServicos} style={{ background: '#f43f5e', color: '#fff' }}>
            🗑 Excluir Selecionados ({selectedServicos.length})
          </button>
        )}
        {activeTab === 'compras' && selectedCompras.length > 0 && (
          <button className="btn" onClick={handleDeleteSelectedCompras} style={{ background: '#f43f5e', color: '#fff' }}>
            🗑 Excluir Selecionados ({selectedCompras.length})
          </button>
        )}
        {activeTab === 'boletos' && selectedBoletos.length > 0 && (
          <button className="btn" onClick={handleDeleteSelectedBoletos} style={{ background: '#f43f5e', color: '#fff' }}>
            🗑 Excluir Selecionados ({selectedBoletos.length})
          </button>
        )}
        {['servicos', 'compras', 'boletos'].includes(activeTab) && (
          <button 
            className="btn ghost-light" 
            onClick={() => setGridEditMode(!gridEditMode)}
            title="Ativar modo de edição rápida similar ao Excel"
          >
            {gridEditMode ? '✓ Sair Edição' : '✏ Edição Rápida'}
          </button>
        )}
        {['servicos', 'compras', 'boletos'].includes(activeTab) && (
          <button className="btn primary" onClick={openImportModal} title="Importar dados copiados do Excel">Importar Excel</button>
        )}
        {['servicos', 'compras', 'boletos'].includes(activeTab) && currentUser?.isAdmin && (
          <button 
            className="btn" 
            onClick={() => setDuplicateModal(true)} 
            title="Checar dados duplicados nas planilhas"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            🔍 Checar Duplicados
          </button>
        )}
        {activeTab === 'servicos' && <button className="btn" onClick={openAddServico}>+ Novo</button>}
        {activeTab === 'compras' && <button className="btn" onClick={openAddCompra}>+ Novo</button>}
        {activeTab === 'boletos' && <button className="btn" onClick={openAddBoleto}>+ Novo</button>}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="painel-layout" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: 'var(--muted)' }}>
          Carregando dados da Pernambucana...
        </div>
      </div>
    );
  }

  return (
    <div className="painel-layout" style={{ minHeight: '100vh', background: 'var(--bg)', '--green': '#1fb6ff' }}>
      <TopNav 
        currentPage={activeTab} 
        onPageChange={setActiveTab}
        isCadastrosPage={false}
        isPernambucana={true}
        whiteTheme={whiteTheme}
        setWhiteTheme={setWhiteTheme}
      />

      <main className="main">
        {/* Toast Notification */}
        {toastMessage && <div className="toast">{toastMessage}</div>}

        {/* ═══ DASHBOARD TAB ═══ */}
        {activeTab === 'dashboard' && currentUser?.isAdmin && (
          <div>
            <div className="ag-section-header">
              <div>
                <span className="portal-badge" style={{ background: 'rgba(31, 182, 255, 0.15)', color: '#1fb6ff' }}>Consolidado</span>
                <h1>Painel Financeiro — Pernambucana</h1>
                <p>Fluxo de caixa, rateio de boletos por setor e comissão de produtivos.</p>
              </div>
            </div>

            {renderFilters()}

            {/* KPI Cards */}
            <div className="ag-kpis" style={{ marginTop: '20px' }}>
              <div className="ag-kpi glass accent-blue">
                <div className="kpi-label">Saldo do Caixa</div>
                <span className="kpi-value" style={dashboardStats.saldo < 0 ? { color: 'var(--red)' } : {}}>{fmtMoney.format(dashboardStats.saldo)}</span>
                <span className="kpi-sub">Entradas efetivas - Saídas</span>
                <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div className="ag-kpi glass accent-green">
                <div className="kpi-label">Entradas Efetivas</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.entradas)}</span>
                <span className="kpi-sub">À vista + Recebíveis recebidos</span>
                <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
              </div>
              <div className="ag-kpi glass accent-red">
                <div className="kpi-label">Saídas Efetivas</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.saidas)}</span>
                <span className="kpi-sub">Boletos + Compras à Vista</span>
                <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
              </div>
            </div>

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

            {/* Fluxo Financeiro Geral */}
            <div className="ag-charts-grid" style={{ marginTop: '20px' }}>
              <div className="ag-chart-card glass" style={{ gridColumn: 'span 2' }}>
                <h3>Entradas vs Saídas por Mês</h3>
                <div style={{ height: '260px', position: 'relative' }}>
                  <Bar data={chartCaixaMensal} options={barOptions} />
                </div>
              </div>
              <div className="ag-chart-card glass">
                <h3>Forma de Pagamento</h3>
                <div style={{ height: '260px', position: 'relative' }}>
                  <Pie data={chartFormaPgto} options={pieOptions} />
                </div>
              </div>
              <div className="ag-chart-card glass">
                <h3>Recebíveis por Status</h3>
                <div style={{ height: '260px', position: 'relative' }}>
                  <Pie data={chartRecebiveisStatus} options={pieOptions} />
                </div>
              </div>
            </div>

            {/* Divisor Gráficos Detalhados */}
            <h2 style={{ margin: '30px 0 15px 0', fontSize: '18px', fontWeight: '800', color: 'var(--text)', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Gráficos Detalhados
            </h2>

            <div className="ag-charts-grid">
              <div className="ag-chart-card glass">
                <h3>Receita vs Custos por Setor</h3>
                <div style={{ height: '260px', position: 'relative' }}>
                  <Bar data={barChartData} options={barOptions} />
                </div>
              </div>
              <div className="ag-chart-card glass">
                <h3>Despesas com Boletos (Fornecedores)</h3>
                <div style={{ height: '260px', position: 'relative' }}>
                  <Pie data={despesasPieData} options={pieOptions} />
                </div>
              </div>
              <div className="ag-chart-card glass">
                <h3>Comissão de Produtivos</h3>
                <div style={{ height: '260px', position: 'relative' }}>
                  <Bar data={commissionChartData} options={{ ...barOptions, indexAxis: 'y' }} />
                </div>
              </div>
              <div className="ag-chart-card glass">
                <h3>Faturamento por Tipo de Serviço</h3>
                <div style={{ height: '260px', position: 'relative' }}>
                  <Bar data={serviceTypeChartData} options={{ ...barOptions, indexAxis: 'y' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ SERVIÇOS TAB ═══ */}
        {activeTab === 'servicos' && (() => {
          const p = paginate(filteredServicos);
          return (
            <div>
              <div className="ag-section-header">
                <div>
                  <h1>Serviços Setoriais</h1>
                  <p>Retífica, Peças, Mecânica, Torneadora e Caldeiraria.</p>
                </div>
              </div>
              {renderFilters()}

              {gridEditMode && (
                <div className="grid-save-bar glass">
                  <span>Modo edição de planilha ativo. Modifique os valores abaixo.</span>
                  <button className="btn" onClick={saveGridChanges}>Salvar Alterações</button>
                </div>
              )}

              {/* Tabela exclusiva para impressão — exibe todos os itens filtrados e o valor total */}
              <div className="print-only-container">
                <div className="print-header">
                  <h2>Pernambucana — Relatório de Serviços</h2>
                  <p>
                    <strong>Filtros Ativos:</strong>{' '}
                    {yearFilter !== 'all' ? `Ano: ${yearFilter}` : 'Todos os Anos'}
                    {monthFilter !== 'all' ? ` | Mês: ${MONTHS[parseInt(monthFilter) - 1]}` : ''}
                    {dayFilter !== 'all' ? ` | Dia: ${dayFilter}` : ''}
                    {deptFilter !== 'all' ? ` | Setor: ${DEPT_LABELS[deptFilter] || deptFilter}` : ''}
                    {searchQuery ? ` | Busca: "${searchQuery}"` : ''}
                  </p>
                  <p>
                    <strong>Registros:</strong> {filteredServicos.length} |{' '}
                    <strong>Valor Total:</strong> {fmtMoney.format(filteredServicos.reduce((sum, s) => sum + (parseFloat(s.valorTotal) || 0), 0))}
                  </p>
                </div>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Setor</th>
                      <th>Cliente</th>
                      <th>Descrição</th>
                      <th>Tipo de Serviço</th>
                      <th>OS</th>
                      <th>Valor Total</th>
                      <th>Forma Pgto.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServicos.map(item => (
                      <tr key={item.id}>
                        <td>{item.data || '-'}</td>
                        <td>{DEPT_LABELS[item.setor] || item.setor || '-'}</td>
                        <td>{item.cliente || '-'}</td>
                        <td>{item.descricao || '-'}</td>
                        <td>{item.tipoServico || '-'}</td>
                        <td>{item.os || '-'}</td>
                        <td className="text-right">{fmtMoney.format(item.valorTotal)}</td>
                        <td>{item.pagamento || '-'}</td>
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
                        <th style={{ width: '40px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={p.paginated.length > 0 && selectedServicos.length === p.paginated.length} 
                            onChange={() => {
                              if (selectedServicos.length === p.paginated.length) {
                                setSelectedServicos([]);
                              } else {
                                setSelectedServicos(p.paginated.map(item => item.id));
                              }
                            }}
                          />
                        </th>
                        <th>Data</th><th>Setor</th><th>Cliente</th><th>Descrição</th>
                        <th>Tipo de Serviço</th><th>Qtd</th><th>OS</th><th>Valor Unit.</th>
                        <th>Valor Total</th><th>Desconto</th><th>Pagamento</th><th>Produtivo</th>
                        <th>Comissão</th><th>Material</th><th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.paginated.map(item => {
                        const hasChanges = !!gridChanges[item.id];
                        const rowData = { ...item, ...(gridChanges[item.id] || {}) };
                        return (
                          <tr key={item.id} className={hasChanges ? 'grid-changed-row' : ''}>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={selectedServicos.includes(item.id)} 
                                onChange={() => {
                                  setSelectedServicos(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]);
                                }}
                              />
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="date" value={rowData.data || ''} onChange={e => handleGridCellChange(item.id, 'data', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.data || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <select value={rowData.setor || 'Mecanica'} onChange={e => handleGridCellChange(item.id, 'setor', e.target.value)} className="ag-grid-input">
                                  {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
                                </select>
                              ) : (
                                DEPT_LABELS[item.setor] || item.setor
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.cliente || ''} onChange={e => handleGridCellChange(item.id, 'cliente', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.cliente || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.descricao || ''} onChange={e => handleGridCellChange(item.id, 'descricao', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.descricao || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.tipoServico || ''} onChange={e => handleGridCellChange(item.id, 'tipoServico', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.tipoServico || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" value={rowData.qtd || 1} onChange={e => {
                                  const newQtd = parseInt(e.target.value) || 1;
                                  const uVal = parseFloat(rowData.valorUnitario) || 0;
                                  handleGridCellChange(item.id, 'qtd', newQtd);
                                  handleGridCellChange(item.id, 'valorTotal', newQtd * uVal);
                                }} className="ag-grid-input" style={{ width: '60px' }} />
                              ) : (
                                item.qtd || 1
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.os || ''} onChange={e => handleGridCellChange(item.id, 'os', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.os || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.valorUnitario || 0} onChange={e => {
                                  const newUnit = parseFloat(e.target.value) || 0;
                                  const qVal = parseInt(rowData.qtd) || 1;
                                  handleGridCellChange(item.id, 'valorUnitario', newUnit);
                                  handleGridCellChange(item.id, 'valorTotal', qVal * newUnit);
                                }} className="ag-grid-input" />
                              ) : (
                                fmtMoney.format(item.valorUnitario || 0)
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.valorTotal || 0} onChange={e => handleGridCellChange(item.id, 'valorTotal', e.target.value)} className="ag-grid-input" style={{ fontWeight: 'bold' }} />
                              ) : (
                                <strong>{fmtMoney.format(item.valorTotal)}</strong>
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.desconto || 0} onChange={e => handleGridCellChange(item.id, 'desconto', e.target.value)} className="ag-grid-input" />
                              ) : (
                                fmtMoney.format(item.desconto || 0)
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <select value={rowData.pagamento || 'À vista'} onChange={e => handleGridCellChange(item.id, 'pagamento', e.target.value)} className="ag-grid-input">
                                  <option value="À vista">À vista</option>
                                  <option value="Pix">Pix</option>
                                  <option value="Dinheiro">Dinheiro</option>
                                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                                  <option value="Cartão de Débito">Cartão de Débito</option>
                                  <option value="À prazo">À prazo</option>
                                </select>
                              ) : (
                                item.pagamento || 'À vista'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.produtivo || ''} onChange={e => handleGridCellChange(item.id, 'produtivo', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.produtivo || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.valorProdutivo || 0} onChange={e => handleGridCellChange(item.id, 'valorProdutivo', e.target.value)} className="ag-grid-input" />
                              ) : (
                                fmtMoney.format(parseFloat(item.valorProdutivo) || 0)
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="number" step="0.01" value={rowData.material || 0} onChange={e => handleGridCellChange(item.id, 'material', e.target.value)} className="ag-grid-input" />
                              ) : (
                                fmtMoney.format(parseFloat(item.material) || 0)
                              )}
                            </td>
                            <td>
                              <div className="ag-table-actions">
                                {!gridEditMode && <button onClick={() => openEditServico(item)}>Editar</button>}
                                {hasChanges && <span style={{ color: 'var(--yellow)', fontSize: '11px', fontWeight: 'bold', padding: '4px 6px' }}>Editado</span>}
                                <button className="delete" onClick={() => { if (window.confirm('Excluir serviço?')) deleteServico(item.id).then(() => triggerToast('Excluído.')); }}>Excluir</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {p.paginated.length === 0 && (
                        <tr><td colSpan="16" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>Nenhum serviço encontrado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {renderPagination(p)}
              </section>
            </div>
          );
        })()}

        {/* ═══ COMPRAS TAB ═══ */}
        {activeTab === 'compras' && (() => {
          const p = paginate(filteredCompras);
          return (
            <div>
              <div className="ag-section-header">
                <div>
                  <h1>Compras de Peças (Detalhamento)</h1>
                  <p>Peças e materiais comprados para a oficina ou cliente (Não deduz do Caixa).</p>
                </div>
              </div>
              {renderFilters()}

              {gridEditMode && (
                <div className="grid-save-bar glass">
                  <span>Modo edição de planilha ativo. Modifique os valores abaixo.</span>
                  <button className="btn" onClick={saveGridChanges}>Salvar Alterações</button>
                </div>
              )}

              {/* Tabela exclusiva para impressão — exibe todos os itens filtrados e o valor total */}
              <div className="print-only-container">
                <div className="print-header">
                  <h2>Pernambucana — Relatório de Compras</h2>
                  <p>
                    <strong>Filtros Ativos:</strong>{' '}
                    {yearFilter !== 'all' ? `Ano: ${yearFilter}` : 'Todos os Anos'}
                    {monthFilter !== 'all' ? ` | Mês: ${MONTHS[parseInt(monthFilter) - 1]}` : ''}
                    {dayFilter !== 'all' ? ` | Dia: ${dayFilter}` : ''}
                    {deptFilter !== 'all' ? ` | Setor: ${DEPT_LABELS[deptFilter] || deptFilter}` : ''}
                    {searchQuery ? ` | Busca: "${searchQuery}"` : ''}
                  </p>
                  <p>
                    <strong>Registros:</strong> {filteredCompras.length} |{' '}
                    <strong>Valor Total:</strong> {fmtMoney.format(filteredCompras.reduce((sum, c) => sum + (parseFloat(c.valorProduto) || 0), 0))}
                  </p>
                </div>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Setor</th>
                      <th>Fornecedor</th>
                      <th>Descrição Material</th>
                      <th>Nº OS</th>
                      <th>Valor Produto</th>
                      <th>Solicitante</th>
                      <th>Forma Compra</th>
                      <th>Categoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompras.map(item => (
                      <tr key={item.id}>
                        <td>{item.data || '-'}</td>
                        <td>{DEPT_LABELS[item.setor] || item.setor || '-'}</td>
                        <td>{item.fornecedor || '-'}</td>
                        <td>{item.descricao || '-'}</td>
                        <td>{item.numOS || '-'}</td>
                        <td className="text-right">{fmtMoney.format(item.valorProduto)}</td>
                        <td>{item.solicitante || '-'}</td>
                        <td>{item.formaCompra || '-'}</td>
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
                        <th style={{ width: '40px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={p.paginated.length > 0 && selectedCompras.length === p.paginated.length} 
                            onChange={() => {
                              if (selectedCompras.length === p.paginated.length) {
                                setSelectedCompras([]);
                              } else {
                                setSelectedCompras(p.paginated.map(item => item.id));
                              }
                            }}
                          />
                        </th>
                        <th>Data</th><th>Setor</th><th>Fornecedor</th><th>Descrição Material</th>
                        <th>Nº OS</th><th>Valor Produto</th><th>Solicitante</th><th>Forma Compra</th>
                        <th>Categoria</th><th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.paginated.map(item => {
                        const hasChanges = !!gridChanges[item.id];
                        const rowData = { ...item, ...(gridChanges[item.id] || {}) };
                        return (
                          <tr key={item.id} className={hasChanges ? 'grid-changed-row' : ''}>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={selectedCompras.includes(item.id)} 
                                onChange={() => {
                                  setSelectedCompras(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]);
                                }}
                              />
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="date" value={rowData.data || ''} onChange={e => handleGridCellChange(item.id, 'data', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.data || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" placeholder="Ex: M,T ou Todos" value={rowData.setor || ''} onChange={e => handleGridCellChange(item.id, 'setor', e.target.value)} className="ag-grid-input" />
                              ) : (
                                DEPT_LABELS[item.setor] || item.setor
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
                                <input type="text" value={rowData.descricao || ''} onChange={e => handleGridCellChange(item.id, 'descricao', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.descricao || '-'
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
                                <input type="number" step="0.01" value={rowData.valorProduto || 0} onChange={e => handleGridCellChange(item.id, 'valorProduto', e.target.value)} className="ag-grid-input" style={{ fontWeight: 'bold' }} />
                              ) : (
                                <strong>{fmtMoney.format(item.valorProduto)}</strong>
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.solicitante || ''} onChange={e => handleGridCellChange(item.id, 'solicitante', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.solicitante || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <select value={rowData.formaCompra || 'À vista'} onChange={e => handleGridCellChange(item.id, 'formaCompra', e.target.value)} className="ag-grid-input">
                                  <option value="À vista">À vista</option>
                                  <option value="Pix">Pix</option>
                                  <option value="Dinheiro">Dinheiro</option>
                                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                                  <option value="Cartão de Débito">Cartão de Débito</option>
                                  <option value="À prazo">À prazo</option>
                                </select>
                              ) : (
                                item.formaCompra || 'À vista'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="text" value={rowData.categoria || ''} onChange={e => handleGridCellChange(item.id, 'categoria', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.categoria || '-'
                              )}
                            </td>
                            <td>
                              <div className="ag-table-actions">
                                {!gridEditMode && <button onClick={() => openEditCompra(item)}>Editar</button>}
                                {hasChanges && <span style={{ color: 'var(--yellow)', fontSize: '11px', fontWeight: 'bold', padding: '4px 6px' }}>Editado</span>}
                                <button className="delete" onClick={() => { if (window.confirm('Excluir compra?')) deleteCompra(item.id).then(() => triggerToast('Excluído.')); }}>Excluir</button>
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

        {/* ═══ BOLETOS TAB ═══ */}
        {activeTab === 'boletos' && (() => {
          const p = paginate(filteredBoletos);
          return (
            <div>
              <div className="ag-section-header">
                <div>
                  <h1>Boletos a Pagar (Contas Compartilhadas/Setoriais)</h1>
                  <p>Despesas deduzidas do caixa. Lançamentos com múltiplos setores dividem a despesa automaticamente.</p>
                </div>
              </div>
              {renderFilters()}

              {gridEditMode && (
                <div className="grid-save-bar glass">
                  <span>Modo edição de planilha ativo. Modifique os valores abaixo.</span>
                  <button className="btn" onClick={saveGridChanges}>Salvar Alterações</button>
                </div>
              )}

              {/* Tabela exclusiva para impressão — exibe todos os itens filtrados e o valor total */}
              <div className="print-only-container">
                <div className="print-header">
                  <h2>Pernambucana — Relatório de Boletos a Pagar</h2>
                  <p>
                    <strong>Filtros Ativos:</strong>{' '}
                    {yearFilter !== 'all' ? `Ano: ${yearFilter}` : 'Todos os Anos'}
                    {monthFilter !== 'all' ? ` | Mês: ${MONTHS[parseInt(monthFilter) - 1]}` : ''}
                    {dayFilter !== 'all' ? ` | Dia: ${dayFilter}` : ''}
                    {deptFilter !== 'all' ? ` | Setor: ${DEPT_LABELS[deptFilter] || deptFilter}` : ''}
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
                      <th>Vencimento</th>
                      <th>Fornecedor</th>
                      <th>Descrição</th>
                      <th>Valor Total</th>
                      <th>Setor(es)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBoletos.map(item => (
                      <tr key={item.id}>
                        <td>{item.dataVencimento || '-'}</td>
                        <td>{item.fornecedor || '-'}</td>
                        <td>{item.descricao || '-'}</td>
                        <td className="text-right">{fmtMoney.format(item.valorBoleto)}</td>
                        <td>{item.setor || 'Todos'}</td>
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
                        <th style={{ width: '40px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={p.paginated.length > 0 && selectedBoletos.length === p.paginated.length} 
                            onChange={() => {
                              if (selectedBoletos.length === p.paginated.length) {
                                setSelectedBoletos([]);
                              } else {
                                setSelectedBoletos(p.paginated.map(item => item.id));
                              }
                            }}
                          />
                        </th>
                        <th>Vencimento</th><th>Fornecedor</th><th>Descrição</th><th>Valor Total</th>
                        <th>Setor(es)</th><th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.paginated.map(item => {
                        const hasChanges = !!gridChanges[item.id];
                        const rowData = { ...item, ...(gridChanges[item.id] || {}) };
                        return (
                          <tr key={item.id} className={hasChanges ? 'grid-changed-row' : ''}>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={selectedBoletos.includes(item.id)} 
                                onChange={() => {
                                  setSelectedBoletos(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]);
                                }}
                              />
                            </td>
                            <td>
                              {gridEditMode ? (
                                <input type="date" value={rowData.dataVencimento || ''} onChange={e => handleGridCellChange(item.id, 'dataVencimento', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.dataVencimento || '-'
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
                                <input type="text" value={rowData.descricao || ''} onChange={e => handleGridCellChange(item.id, 'descricao', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.descricao || '-'
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
                                <input type="text" placeholder="Ex: M,T ou Todos" value={rowData.setor || ''} onChange={e => handleGridCellChange(item.id, 'setor', e.target.value)} className="ag-grid-input" />
                              ) : (
                                <span className="portal-badge" style={{ background: 'rgba(31, 182, 255, 0.12)', color: '#1fb6ff', fontSize: '10px' }}>
                                  {item.setor || 'Todos'}
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="ag-table-actions">
                                {!gridEditMode && <button onClick={() => openEditBoleto(item)}>Editar</button>}
                                {hasChanges && <span style={{ color: 'var(--yellow)', fontSize: '11px', fontWeight: 'bold', padding: '4px 6px' }}>Editado</span>}
                                <button className="delete" onClick={() => { if (window.confirm('Excluir boleto?')) deleteBoleto(item.id).then(() => triggerToast('Excluído.')); }}>Excluir</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {p.paginated.length === 0 && (
                        <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>Nenhum boleto encontrado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {renderPagination(p)}
              </section>
            </div>
          );
        })()}

        {/* ═══ RECEBÍVEIS TAB ═══ */}
        {activeTab === 'recebiveis' && (() => {
          const p = paginate(filteredRecebiveis);
          return (
            <div>
              <div className="ag-section-header">
                <div>
                  <h1>Contas a Receber (Recebíveis)</h1>
                  <p>Parcelas geradas automaticamente de faturamentos "À Prazo". Clique no status para alternar recebimento.</p>
                </div>
              </div>
              {renderFilters(true)}

              {(() => {
                const rFiltered = filteredRecebiveis;
                const pendente = rFiltered.filter(r => r.status === 'Pendente').reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);
                const pendenteCount = rFiltered.filter(r => r.status === 'Pendente').length;
                const recebido = rFiltered.filter(r => r.status === 'Recebido').reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);
                const recebidoCount = rFiltered.filter(r => r.status === 'Recebido').length;
                const hojeStr = new Date().toISOString().split('T')[0];
                const vencido = rFiltered.filter(r => r.status === 'Pendente' && r.dataVencimento < hojeStr).reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);
                const vencidoCount = rFiltered.filter(r => r.status === 'Pendente' && r.dataVencimento < hojeStr).length;

                return (
                  <div className="ag-kpis" style={{ marginTop: '20px' }}>
                    <div className="ag-kpi glass accent-yellow">
                      <div className="kpi-label">Pendentes</div>
                      <span className="kpi-value">{fmtMoney.format(pendente)}</span>
                      <span className="kpi-sub">{pendenteCount} parcelas</span>
                      <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div className="ag-kpi glass">
                      <div className="kpi-label">Recebidos</div>
                      <span className="kpi-value">{fmtMoney.format(recebido)}</span>
                      <span className="kpi-sub">{recebidoCount} parcelas</span>
                      <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <div className="ag-kpi glass accent-red">
                      <div className="kpi-label">Vencidos</div>
                      <span className="kpi-value">{fmtMoney.format(vencido)}</span>
                      <span className="kpi-sub">{vencidoCount} parcelas atrasadas</span>
                      <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                  </div>
                );
              })()}

              {/* Tabela exclusiva para impressão — exibe todos os itens filtrados e o valor total */}
              <div className="print-only-container">
                <div className="print-header">
                  <h2>Pernambucana — Relatório de Recebíveis</h2>
                  <p>
                    <strong>Filtros Ativos:</strong>{' '}
                    {yearFilter !== 'all' ? `Ano: ${yearFilter}` : 'Todos os Anos'}
                    {monthFilter !== 'all' ? ` | Mês: ${MONTHS[parseInt(monthFilter) - 1]}` : ''}
                    {dayFilter !== 'all' ? ` | Dia: ${dayFilter}` : ''}
                    {deptFilter !== 'all' ? ` | Setor: ${DEPT_LABELS[deptFilter] || deptFilter}` : ''}
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
                      <th>Setor</th>
                      <th>Cliente</th>
                      <th>Descrição</th>
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
                          <td>{item.os || '-'}</td>
                          <td>{DEPT_LABELS[item.setor] || item.setor || '-'}</td>
                          <td>{item.cliente || '-'}</td>
                          <td>{item.descricao || '-'}</td>
                          <td>{item.parcela}/{item.totalParcelas}</td>
                          <td className="text-right">{fmtMoney.format(item.valorParcela)}</td>
                          <td>{item.dataVencimento || '-'}</td>
                          <td>{isVencido ? 'Vencido' : item.status}</td>
                          <td>{item.dataRecebimento || '-'}</td>
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
                        <th>OS</th><th>Setor</th><th>Cliente</th><th>Descrição</th>
                        <th>Parcela</th><th>Valor Parcela</th><th>Vencimento</th><th>Status</th><th>Recebido Em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.paginated.map(item => {
                        const isVencido = item.status === 'Pendente' && item.dataVencimento < hoje;
                        return (
                          <tr key={item.id} style={isVencido ? { background: 'rgba(244,63,94,.06)' } : {}}>
                            <td>{item.os || '-'}</td>
                            <td>{DEPT_LABELS[item.setor] || item.setor}</td>
                            <td>{item.cliente || '-'}</td>
                            <td>{item.descricao || '-'}</td>
                            <td><strong>{item.parcela}/{item.totalParcelas}</strong></td>
                            <td><strong>{fmtMoney.format(item.valorParcela)}</strong></td>
                            <td style={isVencido ? { color: 'var(--red)', fontWeight: 800 } : {}}>{item.dataVencimento}</td>
                            <td>
                              <button
                                className={`status-badge ${isVencido ? 'vencido' : item.status === 'Recebido' ? 'recebido' : 'pendente'}`}
                                onClick={() => {
                                  const newStatus = item.status === 'Recebido' ? 'Pendente' : 'Recebido';
                                  toggleRecebivel(item.id, newStatus).then(() => triggerToast(`Status da parcela atualizado.`));
                                }}
                                title="Clique para alternar status de pagamento"
                              >
                                {isVencido ? '⚠ Vencido' : item.status === 'Recebido' ? '✓ Recebido' : '◌ Pendente'}
                              </button>
                            </td>
                            <td>{item.dataRecebimento || '-'}</td>
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

      {/* ═══ MODALS DEFINITIONS ═══ */}

      {/* Serviços Modal */}
      {servicoModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setServicoModal(false)}></div>
          <form className="modal-form-card glass" onSubmit={handleServicoSubmit} style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>{servicoEditId ? 'Editar Serviço' : 'Novo Serviço Setorial'}</h3>
              <button className="close" type="button" onClick={() => setServicoModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Data</label>
                  <input type="date" required value={servicoForm.data} onChange={e => setServicoForm(prev => ({ ...prev, data: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Setor do Serviço</label>
                  <select value={servicoForm.setor} onChange={e => setServicoForm(prev => ({ ...prev, setor: e.target.value }))}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Cliente</label>
                  <input type="text" required value={servicoForm.cliente} onChange={e => setServicoForm(prev => ({ ...prev, cliente: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Condição de Pagamento</label>
                  <select value={servicoForm.pagamento} onChange={e => setServicoForm(prev => ({ ...prev, pagamento: e.target.value }))}>
                    <option value="À vista">À vista</option>
                    <option value="Pix">Pix</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="À prazo">À prazo</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1.5 }}>
                  <label>Descrição dos Serviços</label>
                  <input type="text" required value={servicoForm.descricao} onChange={e => setServicoForm(prev => ({ ...prev, descricao: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 0.8 }}>
                  <label>Tipo de Serviço</label>
                  <input type="text" value={servicoForm.tipoServico} onChange={e => setServicoForm(prev => ({ ...prev, tipoServico: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 0.7 }}>
                  <label>OS</label>
                  <input type="text" value={servicoForm.os} onChange={e => setServicoForm(prev => ({ ...prev, os: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Quantidade</label>
                  <input type="number" value={servicoForm.qtd || 1} onFocus={e => e.target.select()} onChange={e => {
                    const newQtd = parseInt(e.target.value) || 1;
                    const unit = parseFloat(servicoForm.valorUnitario) || 0;
                    setServicoForm(prev => ({ ...prev, qtd: newQtd, valorTotal: newQtd * unit }));
                  }} />
                </div>
                <div className="form-group">
                  <label>Valor Unitário</label>
                  <input type="number" step="0.01" value={servicoForm.valorUnitario === 0 ? '' : servicoForm.valorUnitario} onFocus={e => e.target.select()} onChange={e => {
                    const newUnit = parseFloat(e.target.value) || 0;
                    const qVal = parseInt(servicoForm.qtd) || 1;
                    setServicoForm(prev => ({ ...prev, valorUnitario: newUnit, valorTotal: qVal * newUnit }));
                  }} />
                </div>
                <div className="form-group">
                  <label>Valor Total (Faturamento)</label>
                  <input type="number" step="0.01" required value={servicoForm.valorTotal === 0 ? '' : servicoForm.valorTotal} onFocus={e => e.target.select()} onChange={e => setServicoForm(prev => ({ ...prev, valorTotal: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label>Desconto</label>
                  <input type="number" step="0.01" value={servicoForm.desconto === 0 ? '' : servicoForm.desconto} onFocus={e => e.target.select()} onChange={e => setServicoForm(prev => ({ ...prev, desconto: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label>Mecânico/Produtivo</label>
                  <input type="text" value={servicoForm.produtivo} onChange={e => setServicoForm(prev => ({ ...prev, produtivo: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Comissão (R$)</label>
                  <input type="number" step="0.01" value={servicoForm.valorProdutivo === 0 ? '' : servicoForm.valorProdutivo} onFocus={e => e.target.select()} onChange={e => setServicoForm(prev => ({ ...prev, valorProdutivo: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label>Material Aplicado</label>
                  <input type="number" step="0.01" value={servicoForm.material === 0 ? '' : servicoForm.material} onFocus={e => e.target.select()} onChange={e => setServicoForm(prev => ({ ...prev, material: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label>Nº de Parcelas (se A Prazo)</label>
                  <input type="number" min="0" value={servicoForm.numParcelas === 0 ? '' : servicoForm.numParcelas} onFocus={e => e.target.select()} onChange={e => setServicoForm(prev => ({ ...prev, numParcelas: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn ghost" type="button" onClick={() => setServicoModal(false)}>Cancelar</button>
              <button className="btn primary" type="submit">Confirmar</button>
            </div>
          </form>
        </div>
      )}

      {/* Compras Modal */}
      {compraModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setCompraModal(false)}></div>
          <form className="modal-form-card glass" onSubmit={handleCompraSubmit} style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>{compraEditId ? 'Editar Compra' : 'Nova Compra de Peças'}</h3>
              <button className="close" type="button" onClick={() => setCompraModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Data</label>
                  <input type="date" required value={compraForm.data} onChange={e => setCompraForm(prev => ({ ...prev, data: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Fornecedor</label>
                  <input type="text" required value={compraForm.fornecedor} onChange={e => setCompraForm(prev => ({ ...prev, fornecedor: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Forma de Compra</label>
                  <select value={compraForm.formaCompra} onChange={e => setCompraForm(prev => ({ ...prev, formaCompra: e.target.value }))}>
                    <option value="À vista">À vista</option>
                    <option value="Pix">Pix</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="À prazo">À prazo</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Descrição do Material</label>
                  <input type="text" required value={compraForm.descricao} onChange={e => setCompraForm(prev => ({ ...prev, descricao: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Nº OS</label>
                  <input type="text" value={compraForm.numOS} onChange={e => setCompraForm(prev => ({ ...prev, numOS: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Valor do Produto/Peça</label>
                  <input type="number" step="0.01" required value={compraForm.valorProduto === 0 ? '' : compraForm.valorProduto} onFocus={e => e.target.select()} onChange={e => setCompraForm(prev => ({ ...prev, valorProduto: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label>Solicitante</label>
                  <input type="text" value={compraForm.solicitante} onChange={e => setCompraForm(prev => ({ ...prev, solicitante: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Nº Pedido</label>
                  <input type="text" value={compraForm.numPedido} onChange={e => setCompraForm(prev => ({ ...prev, numPedido: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Categoria</label>
                  <input type="text" value={compraForm.categoria} onChange={e => setCompraForm(prev => ({ ...prev, categoria: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Nº de Parcelas (se A Prazo)</label>
                  <input type="number" min="0" value={compraForm.numParcelas === 0 ? '' : compraForm.numParcelas} onFocus={e => e.target.select()} onChange={e => setCompraForm(prev => ({ ...prev, numParcelas: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>

              {/* Checkbox multi-select for sectors rateio */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Setores Beneficiados (Divisão de Custo / Rateio)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {DEPARTMENTS.map(d => {
                    const checked = compraForm.setores.includes(d);
                    return (
                      <label key={d} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input 
                          type="checkbox" 
                          checked={checked} 
                          onChange={() => {
                            const list = checked 
                              ? compraForm.setores.filter(x => x !== d)
                              : [...compraForm.setores, d];
                            setCompraForm(prev => ({ ...prev, setores: list }));
                          }}
                        />
                        {DEPT_LABELS[d]}
                      </label>
                    );
                  })}
                </div>
                <small style={{ color: 'var(--muted)', marginTop: '6px', display: 'block' }}>
                  O custo de {fmtMoney.format(compraForm.valorProduto)} será dividido igualmente em: {fmtMoney.format(compraForm.valorProduto / (compraForm.setores.length || 1))} para cada um dos {compraForm.setores.length} setores selecionados.
                </small>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn ghost" type="button" onClick={() => setCompraModal(false)}>Cancelar</button>
              <button className="btn primary" type="submit" disabled={compraForm.setores.length === 0}>
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Boletos Modal */}
      {boletoModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setBoletoModal(false)}></div>
          <form className="modal-form-card glass" onSubmit={handleBoletoSubmit} style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>{boletoEditId ? 'Editar Boleto' : 'Novo Boleto (Contas/Despesas)'}</h3>
              <button className="close" type="button" onClick={() => setBoletoModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Vencimento</label>
                  <input type="date" required value={boletoForm.dataVencimento} onChange={e => setBoletoForm(prev => ({ ...prev, dataVencimento: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Fornecedor</label>
                  <input type="text" required value={boletoForm.fornecedor} onChange={e => setBoletoForm(prev => ({ ...prev, fornecedor: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Valor Total (Boleto)</label>
                  <input type="number" step="0.01" required value={boletoForm.valorBoleto === 0 ? '' : boletoForm.valorBoleto} onFocus={e => e.target.select()} onChange={e => setBoletoForm(prev => ({ ...prev, valorBoleto: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label>Descrição da Despesa</label>
                  <input type="text" required value={boletoForm.descricao} onChange={e => setBoletoForm(prev => ({ ...prev, descricao: e.target.value }))} />
                </div>
              </div>

              {/* Checkbox multi-select for sectors rateio */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Setores Beneficiados (Divisão de Custo / Rateio)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {DEPARTMENTS.map(d => {
                    const checked = boletoForm.setores.includes(d);
                    return (
                      <label key={d} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input 
                          type="checkbox" 
                          checked={checked} 
                          onChange={() => {
                            const list = checked 
                              ? boletoForm.setores.filter(x => x !== d)
                              : [...boletoForm.setores, d];
                            setBoletoForm(prev => ({ ...prev, setores: list }));
                          }}
                        />
                        {DEPT_LABELS[d]}
                      </label>
                    );
                  })}
                </div>
                <small style={{ color: 'var(--muted)', marginTop: '6px', display: 'block' }}>
                  O custo de {fmtMoney.format(boletoForm.valorBoleto)} será dividido igualmente em: {fmtMoney.format(boletoForm.valorBoleto / (boletoForm.setores.length || 1))} para cada um dos {boletoForm.setores.length} setores selecionados.
                </small>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn ghost" type="button" onClick={() => setBoletoModal(false)}>Cancelar</button>
              <button className="btn primary" type="submit" disabled={boletoForm.setores.length === 0}>
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Excel Paste Import Modal */}
      {importModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setImportModal(false)}></div>
          <div className="modal-form-card glass" style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>Importar do Excel (Ctrl+V)</h3>
              <button className="close" type="button" onClick={() => setImportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="ag-import-type-selector">
                {['servicos', 'compras', 'boletos'].map(t => (
                  <button key={t} className={`ag-import-type-btn ${importType === t ? 'active' : ''}`}
                    onClick={() => { setImportType(t); handleImportParse(importText, t); }}>
                    {t === 'servicos' ? '🔧 Serviços' : t === 'compras' ? '🛒 Compras' : '📄 Boletos'}
                  </button>
                ))}
              </div>
              <textarea
                className="ag-import-area"
                placeholder="Cole aqui os dados copiados do Excel (Ctrl+V)..."
                value={importText}
                onChange={(e) => handleImportParse(e.target.value, importType)}
              />
              {importPreview && <div style={{ marginTop: '16px' }}>{importPreview}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn ghost" type="button" onClick={() => setImportModal(false)}>Cancelar</button>
              <button className="btn primary" disabled={parsedImportItems.length === 0} onClick={confirmImport}>
                Confirmar Importação ({parsedImportItems.length} registros)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Checker Modal */}
      {duplicateModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setDuplicateModal(false)}></div>
          <div className="modal-form-card glass" style={{ zIndex: 10, width: 'min(900px, 95vw)', maxHeight: '85vh' }}>
            <div className="modal-header">
              <h3>🔍 Detector de Dados Duplicados</h3>
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
                      headerText = `${first.cliente || 'Sem Cliente'} - ${first.data ? first.data.split('-').reverse().join('/') : ''} (${fmtMoney.format(first.valorTotal)})`;
                    } else if (duplicateTab === 'compras') {
                      headerText = `${first.fornecedor || 'Sem Fornecedor'} - ${first.data ? first.data.split('-').reverse().join('/') : ''} (${fmtMoney.format(first.valorProduto)})`;
                    } else {
                      headerText = `${first.fornecedor || 'Sem Fornecedor'} - ${first.dataVencimento ? first.dataVencimento.split('-').reverse().join('/') : ''} (${fmtMoney.format(first.valorBoleto)})`;
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
                              detail = `OS: ${item.os || 'Sem OS'} | Desc: ${item.descricao || 'Sem descrição'} | Setor: ${DEPT_LABELS[item.setor] || item.setor || 'N/A'}`;
                            } else if (duplicateTab === 'compras') {
                              detail = `OS: ${item.numOS || 'Sem OS'} | Desc: ${item.descricao || 'Sem descrição'} | Setor: ${item.setor || 'N/A'}`;
                            } else {
                              detail = `Desc: ${item.descricao || 'Sem descrição'} | Setor: ${item.setor || 'Todos'}`;
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
    </div>
  );
};

export default Pernambucana;
