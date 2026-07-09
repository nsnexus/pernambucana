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

// Date format parser (YYYY-MM-DD, DD/MM/YYYY, etc.)
function parseYearMonth(dateStr) {
  if (!dateStr) return { year: '', month: 0, day: 0 };
  const s = String(dateStr).trim();
  
  let m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    return { year: m[1], month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
  }
  
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
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

const Pernambucana = () => {
  const { currentUser } = useAuth();
  const {
    allServicos, allCompras, allBoletos, allRecebiveis, loading,
    addServico, updateServico, deleteServico,
    addCompra, updateCompra, deleteCompra,
    addBoleto, updateBoleto, deleteBoleto,
    toggleRecebivel, normalizeSector
  } = useData();

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
  const [activeTab, setActiveTab] = useState('dashboard');

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
    numPedido: '', categoria: 'Almoxarifado', setor: 'Mecanica', numParcelas: 0
  });

  const [boletoModal, setBoletoModal] = useState(false);
  const [boletoEditId, setBoletoEditId] = useState(null);
  const [boletoForm, setBoletoForm] = useState({
    dataVencimento: '', fornecedor: '', descricao: '', valorBoleto: 0,
    setor: 'Todos', status: 'Pendente', dataPagamento: '', setores: []
  });

  // Excel paste import modal
  const [importModal, setImportModal] = useState(false);
  const [importType, setImportType] = useState('servicos');
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [parsedImportItems, setParsedImportItems] = useState([]);

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

    // 6. COMPRAS (internal detail, doesn't reduce cash flow)
    const totalCompras = cFiltered
      .filter(c => deptFilter === 'all' || normalizeSector(c.setor) === deptFilter)
      .reduce((sum, c) => sum + (parseFloat(c.valorProduto) || 0), 0);

    // 6.1 COMPRAS À VISTA / PIX / CARTÃO (Outflows)
    const totalComprasVista = cFiltered
      .filter(c => deptFilter === 'all' || normalizeSector(c.setor) === deptFilter)
      .filter(c => !String(c.formaCompra || '').toLowerCase().includes('prazo'))
      .reduce((sum, c) => sum + (parseFloat(c.valorProduto) || 0), 0);

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
      splitBoletosList
    };
  }, [allServicos, allCompras, allBoletos, allRecebiveis, monthFilter, yearFilter, deptFilter]);

  // ── GRID FILTERING FOR PAGES ──
  const filterList = (list, extraFilter) => {
    return list.filter(item => {
      // Perms sector lock check
      const sec = normalizeSector(item.setor);
      if (currentUser && !currentUser.isAdmin && currentUser.allowedSectors && !currentUser.allowedSectors.includes(sec)) {
        // For boletos, check if any allowed sector is in the list
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
      numPedido: '', categoria: 'Almoxarifado', setor: deptFilter !== 'all' ? deptFilter : 'Mecanica', numParcelas: 0
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
      setor: item.setor || 'Mecanica', numParcelas: item.numParcelas || 0
    });
    setCompraModal(true);
  };

  const handleCompraSubmit = async (e) => {
    e.preventDefault();
    try {
      if (compraEditId) {
        await updateCompra(compraEditId, compraForm);
        triggerToast('Compra atualizada.');
      } else {
        await addCompra(compraForm);
        triggerToast('Compra adicionada.');
      }
      setCompraModal(false);
    } catch (err) { alert(err.message); }
  };

  const openAddBoleto = () => {
    setBoletoEditId(null);
    setBoletoForm({
      dataVencimento: hoje, fornecedor: '', descricao: '', valorBoleto: 0,
      setor: 'Todos', status: 'Pendente', dataPagamento: '', setores: ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria']
    });
    setBoletoModal(true);
  };

  const openEditBoleto = (item) => {
    setBoletoEditId(item.id);
    setBoletoForm({
      dataVencimento: item.dataVencimento || '', fornecedor: item.fornecedor || '',
      descricao: item.descricao || '', valorBoleto: item.valorBoleto || 0,
      setor: item.setor || 'Todos', status: item.status || 'Pendente',
      dataPagamento: item.dataPagamento || '', setores: item.setores || parseBoletoSectors(item.setor)
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
      const dataPayload = { ...boletoForm, setor: sectorLabel };

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

        if (activeTab === 'servicos') await updateServico(id, changes);
        else if (activeTab === 'compras') await updateCompra(id, changes);
        else if (activeTab === 'boletos') await updateBoleto(id, changes);
      }
      triggerToast('Alterações salvas com sucesso.');
      setGridEditMode(false);
      setGridChanges({});
    } catch (err) { alert('Erro: ' + err.message); }
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
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
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
    const firstRowHasHeaders = lines[0] && lines[0].some(cell => {
      const c = String(cell || '').trim().toLowerCase();
      return ['data', 'mês', 'mes', 'forma', 'cliente', 'material', 'fornecedor', 'valor', 'boleto', 'vencimento', 'lançamento'].includes(c);
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
        const colsCount = cols.length;
        if (colsCount >= 14) {
          // Format 1 (Retifica, Peças, Mecânica - 16 columns)
          while (cols.length < 16) cols.push('');
          const totalVal = parseExcelNumber(cols[10]);
          const unitVal = parseExcelNumber(cols[9]);
          const qtyVal = parseExcelNumber(cols[7]) || 1;
          const pagamento = cleanCell(cols[3]);
          const isPrazo = pagamento.toLowerCase().includes('prazo');

          parsedList.push({
            data: parseExcelDate(cols[0]),
            mes: cleanCell(cols[1]),
            setor: cleanCell(cols[2]) || 'Retifica',
            pagamento: isPrazo ? 'À prazo' : 'À vista',
            codigoServico: cleanCell(cols[4]),
            cliente: cleanCell(cols[5]) || 'Cliente Importado',
            descricao: cleanCell(cols[6]),
            qtd: qtyVal,
            os: cleanCell(cols[8]),
            valorUnitario: unitVal || (totalVal / qtyVal) || 0,
            valorTotal: totalVal || (unitVal * qtyVal) || 0,
            produtivo: cleanCell(cols[11]),
            valorProdutivo: parseExcelNumber(cols[12]),
            desconto: parseExcelNumber(cols[13]),
            material: parseExcelNumber(cols[14]),
            tipoServico: cleanCell(cols[15]) || 'Serviços',
            numParcelas: isPrazo ? 1 : 0
          });
        } else {
          // Format 2 (Torneadora, Caldeiraria - 12 columns)
          while (cols.length < 12) cols.push('');
          const totalVal = parseExcelNumber(cols[7]);
          const servVal = parseExcelNumber(cols[8]);
          const prodVal = parseExcelNumber(cols[9]);
          const matVal = parseExcelNumber(cols[10]);
          const pagamento = cleanCell(cols[3]);
          const isPrazo = pagamento.toLowerCase().includes('prazo');

          parsedList.push({
            data: parseExcelDate(cols[0]),
            mes: cleanCell(cols[1]),
            setor: cleanCell(cols[2]) || 'Torneadora',
            pagamento: isPrazo ? 'À prazo' : 'À vista',
            cliente: cleanCell(cols[4]) || 'Cliente Importado',
            descricao: cleanCell(cols[5]),
            os: cleanCell(cols[6]),
            valorTotal: totalVal || (servVal + prodVal + matVal) || 0,
            valorServicos: servVal,
            valorPecas: prodVal,
            material: matVal,
            produtivo: cleanCell(cols[11]),
            numParcelas: isPrazo ? 1 : 0
          });
        }
      } else if (type === 'compras') {
        while (cols.length < 12) cols.push('');
        const formComp = cleanCell(cols[3]);
        const isPrazo = formComp.toLowerCase().includes('prazo');
        parsedList.push({
          data: parseExcelDate(cols[0]),
          mes: cleanCell(cols[1]),
          setor: cleanCell(cols[2]) || 'Mecanica',
          formaCompra: isPrazo ? 'À prazo' : 'À vista',
          solicitante: cleanCell(cols[4]),
          descricao: cleanCell(cols[5]) || 'Compra Importada',
          numOS: cleanCell(cols[6]),
          valorOS: parseExcelNumber(cols[7]),
          valorProduto: parseExcelNumber(cols[8]),
          fornecedor: cleanCell(cols[9]),
          numPedido: cleanCell(cols[10]),
          categoria: cleanCell(cols[11]) || 'Almoxarifado',
          numParcelas: isPrazo ? 1 : 0
        });
      } else if (type === 'boletos') {
        while (cols.length < 5) cols.push('');
        const rawSetor = cleanCell(cols[4]);
        const secsNormalized = parseBoletoSectors(rawSetor);
        parsedList.push({
          mesVencimento: cleanCell(cols[0]),
          dataVencimento: parseExcelDate(cols[1]),
          fornecedor: cleanCell(cols[2]),
          valorBoleto: parseExcelNumber(cols[3]),
          setor: rawSetor || 'Todos',
          setores: secsNormalized,
          status: 'Pendente',
          dataPagamento: ''
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
      const sec = normalizeSector(c.setor);
      if (comprasByDept[sec] !== undefined) comprasByDept[sec] += (parseFloat(c.valorProduto) || 0);
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

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: whiteTheme ? '#102033' : '#ffffff', font: { weight: 'bold' } } },
      datalabels: { display: false },
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
      legend: { position: 'right', labels: { color: whiteTheme ? '#102033' : '#ffffff', font: { size: 11 } } },
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
      <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Mostrando {p.paginated.length} de {p.total} registros</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn ghost-light" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={p.page === 1}>Anterior</button>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Pág. {p.page} de {p.totalPages}</span>
          <button className="btn ghost-light" onClick={() => setCurrentPage(prev => Math.min(prev + 1, p.totalPages))} disabled={p.page === p.totalPages}>Próxima</button>
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
        {activeTab === 'dashboard' && (
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
              </div>
              <div className="ag-kpi glass accent-green">
                <div className="kpi-label">Entradas Efetivas</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.entradas)}</span>
                <span className="kpi-sub">À vista + Recebíveis recebidos</span>
              </div>
              <div className="ag-kpi glass accent-red">
                <div className="kpi-label">Saídas Efetivas</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.saidas)}</span>
                <span className="kpi-sub">Boletos + Compras à Vista</span>
              </div>
            </div>

            <div className="ag-kpis">
              <div className="ag-kpi glass">
                <div className="kpi-label">Total Serviços</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.totalServicos)}</span>
                <span className="kpi-sub">{dashboardStats.sFiltered.length} OS lançadas</span>
              </div>
              <div className="ag-kpi glass accent-yellow">
                <div className="kpi-label">Recebíveis Pendentes</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.totalPendente)}</span>
                <span className="kpi-sub">{dashboardStats.recebiveisPendentes} parcelas</span>
              </div>
              <div className="ag-kpi glass accent-red">
                <div className="kpi-label">Recebíveis Vencidos</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.totalVencido)}</span>
                <span className="kpi-sub">{dashboardStats.recebiveisVencidos} parcelas atrasadas</span>
              </div>
              <div className="ag-kpi glass">
                <div className="kpi-label">Total Compras</div>
                <span className="kpi-value">{fmtMoney.format(dashboardStats.totalCompras)}</span>
                <span className="kpi-sub">Detalhamento (Sem efeito no Caixa)</span>
              </div>
            </div>

            {/* Dashboard Charts */}
            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }}>
              <div className="chart-card glass" style={{ height: '340px', padding: '20px', borderRadius: '16px' }}>
                <h3>Receita vs Custos por Setor</h3>
                <div style={{ height: '260px', marginTop: '10px' }}>
                  <Bar data={barChartData} options={barOptions} />
                </div>
              </div>

              <div className="chart-card glass" style={{ height: '340px', padding: '20px', borderRadius: '16px' }}>
                <h3>Despesas com Boletos (Fornecedores)</h3>
                <div style={{ height: '260px', marginTop: '10px' }}>
                  <Pie data={despesasPieData} options={pieOptions} />
                </div>
              </div>

              <div className="chart-card glass" style={{ height: '340px', padding: '20px', borderRadius: '16px' }}>
                <h3>Comissão de Produtivos</h3>
                <div style={{ height: '260px', marginTop: '10px' }}>
                  <Bar data={commissionChartData} options={{ ...barOptions, indexAxis: 'y' }} />
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

              <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th><th>Setor</th><th>Cliente</th><th>Descrição</th>
                        <th>OS</th><th>Valor Total</th><th>Pagamento</th><th>Produtivo</th>
                        <th>Comissão</th><th>Material</th><th>Ações</th>
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
                                <input type="text" value={rowData.os || ''} onChange={e => handleGridCellChange(item.id, 'os', e.target.value)} className="ag-grid-input" />
                              ) : (
                                item.os || '-'
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
                                <select value={rowData.pagamento || 'À vista'} onChange={e => handleGridCellChange(item.id, 'pagamento', e.target.value)} className="ag-grid-input">
                                  <option value="À vista">À vista</option>
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
                        <tr><td colSpan="11" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>Nenhum serviço encontrado.</td></tr>
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

              <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
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
                        <tr><td colSpan="10" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>Nenhuma compra encontrada.</td></tr>
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

              <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Vencimento</th><th>Fornecedor</th><th>Descrição</th><th>Valor Total</th>
                        <th>Setor(es)</th><th>Status</th><th>Pagamento</th><th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.paginated.map(item => {
                        const hasChanges = !!gridChanges[item.id];
                        const rowData = { ...item, ...(gridChanges[item.id] || {}) };
                        const isVencido = item.status === 'Pendente' && item.dataVencimento < hoje;
                        return (
                          <tr key={item.id} className={hasChanges ? 'grid-changed-row' : ''} style={isVencido ? { background: 'rgba(244,63,94,.06)' } : {}}>
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
                              {gridEditMode ? (
                                <select value={rowData.status || 'Pendente'} onChange={e => handleGridCellChange(item.id, 'status', e.target.value)} className="ag-grid-input">
                                  <option value="Pendente">Pendente</option>
                                  <option value="Pago">Pago</option>
                                </select>
                              ) : (
                                <span className={`status-badge ${item.status === 'Pago' ? 'recebido' : isVencido ? 'vencido' : 'pendente'}`}>
                                  {item.status === 'Pago' ? '✓ Pago' : isVencido ? '⚠ Vencido' : '◌ Pendente'}
                                </span>
                              )}
                            </td>
                            <td>{item.dataPagamento || '-'}</td>
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
                        <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>Nenhum boleto encontrado.</td></tr>
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

              <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table>
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
          <form className="modal-card glass" onSubmit={handleServicoSubmit} style={{ maxWidth: '640px' }}>
            <h2>{servicoEditId ? 'Editar Serviço' : 'Novo Serviço Setorial'}</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label>
                Data
                <input type="date" required value={servicoForm.data} onChange={e => setServicoForm(prev => ({ ...prev, data: e.target.value }))} />
              </label>
              <label>
                Setor do Serviço
                <select value={servicoForm.setor} onChange={e => setServicoForm(prev => ({ ...prev, setor: e.target.value }))}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', marginTop: '12px' }}>
              <label>
                Cliente
                <input type="text" required value={servicoForm.cliente} onChange={e => setServicoForm(prev => ({ ...prev, cliente: e.target.value }))} />
              </label>
              <label>
                Condição de Pagamento
                <select value={servicoForm.pagamento} onChange={e => setServicoForm(prev => ({ ...prev, pagamento: e.target.value }))}>
                  <option value="À vista">À vista</option>
                  <option value="À prazo">À prazo</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.5fr', gap: '16px', marginTop: '12px' }}>
              <label>
                Descrição dos Serviços
                <input type="text" required value={servicoForm.descricao} onChange={e => setServicoForm(prev => ({ ...prev, descricao: e.target.value }))} />
              </label>
              <label>
                OS
                <input type="text" value={servicoForm.os} onChange={e => setServicoForm(prev => ({ ...prev, os: e.target.value }))} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
              <label>
                Valor Total (Faturamento)
                <input type="number" step="0.01" required value={servicoForm.valorTotal} onChange={e => setServicoForm(prev => ({ ...prev, valorTotal: parseFloat(e.target.value) || 0 }))} />
              </label>
              <label>
                Valor Unitário
                <input type="number" step="0.01" value={servicoForm.valorUnitario} onChange={e => setServicoForm(prev => ({ ...prev, valorUnitario: parseFloat(e.target.value) || 0 }))} />
              </label>
              <label>
                Material Aplicado
                <input type="number" step="0.01" value={servicoForm.material} onChange={e => setServicoForm(prev => ({ ...prev, material: parseFloat(e.target.value) || 0 }))} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', marginTop: '12px' }}>
              <label>
                Mecânico/Produtivo
                <input type="text" value={servicoForm.produtivo} onChange={e => setServicoForm(prev => ({ ...prev, produtivo: e.target.value }))} />
              </label>
              <label>
                Comissão (R$)
                <input type="number" step="0.01" value={servicoForm.valorProdutivo} onChange={e => setServicoForm(prev => ({ ...prev, valorProdutivo: parseFloat(e.target.value) || 0 }))} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
              <label>
                Tipo de Serviço
                <input type="text" value={servicoForm.tipoServico} onChange={e => setServicoForm(prev => ({ ...prev, tipoServico: e.target.value }))} />
              </label>
              <label>
                Nº de Parcelas (se A Prazo)
                <input type="number" min="0" value={servicoForm.numParcelas} onChange={e => setServicoForm(prev => ({ ...prev, numParcelas: parseInt(e.target.value) || 0 }))} />
              </label>
            </div>

            <div className="modal-actions-btns" style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
          <form className="modal-card glass" onSubmit={handleCompraSubmit} style={{ maxWidth: '600px' }}>
            <h2>{compraEditId ? 'Editar Compra' : 'Nova Compra de Peças'}</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label>
                Data
                <input type="date" required value={compraForm.data} onChange={e => setCompraForm(prev => ({ ...prev, data: e.target.value }))} />
              </label>
              <label>
                Setor
                <select value={compraForm.setor} onChange={e => setCompraForm(prev => ({ ...prev, setor: e.target.value }))}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', marginTop: '12px' }}>
              <label>
                Fornecedor
                <input type="text" required value={compraForm.fornecedor} onChange={e => setCompraForm(prev => ({ ...prev, fornecedor: e.target.value }))} />
              </label>
              <label>
                Forma de Compra
                <select value={compraForm.formaCompra} onChange={e => setCompraForm(prev => ({ ...prev, formaCompra: e.target.value }))}>
                  <option value="À vista">À vista</option>
                  <option value="À prazo">À prazo</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.5fr', gap: '16px', marginTop: '12px' }}>
              <label>
                Descrição do Material
                <input type="text" required value={compraForm.descricao} onChange={e => setCompraForm(prev => ({ ...prev, descricao: e.target.value }))} />
              </label>
              <label>
                Nº OS
                <input type="text" value={compraForm.numOS} onChange={e => setCompraForm(prev => ({ ...prev, numOS: e.target.value }))} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
              <label>
                Valor do Produto/Peça
                <input type="number" step="0.01" required value={compraForm.valorProduto} onChange={e => setCompraForm(prev => ({ ...prev, valorProduto: parseFloat(e.target.value) || 0 }))} />
              </label>
              <label>
                Solicitante
                <input type="text" value={compraForm.solicitante} onChange={e => setCompraForm(prev => ({ ...prev, solicitante: e.target.value }))} />
              </label>
              <label>
                Nº Pedido
                <input type="text" value={compraForm.numPedido} onChange={e => setCompraForm(prev => ({ ...prev, numPedido: e.target.value }))} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
              <label>
                Categoria
                <input type="text" value={compraForm.categoria} onChange={e => setCompraForm(prev => ({ ...prev, categoria: e.target.value }))} />
              </label>
              <label>
                Nº de Parcelas (se A Prazo)
                <input type="number" min="0" value={compraForm.numParcelas} onChange={e => setCompraForm(prev => ({ ...prev, numParcelas: parseInt(e.target.value) || 0 }))} />
              </label>
            </div>

            <div className="modal-actions-btns" style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn ghost" type="button" onClick={() => setCompraModal(false)}>Cancelar</button>
              <button className="btn primary" type="submit">Confirmar</button>
            </div>
          </form>
        </div>
      )}

      {/* Boletos Modal */}
      {boletoModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setBoletoModal(false)}></div>
          <form className="modal-card glass" onSubmit={handleBoletoSubmit} style={{ maxWidth: '580px' }}>
            <h2>{boletoEditId ? 'Editar Boleto' : 'Novo Boleto (Contas/Despesas)'}</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label>
                Vencimento
                <input type="date" required value={boletoForm.dataVencimento} onChange={e => setBoletoForm(prev => ({ ...prev, dataVencimento: e.target.value }))} />
              </label>
              <label>
                Status
                <select value={boletoForm.status} onChange={e => setBoletoForm(prev => ({ ...prev, status: e.target.value, dataPagamento: e.target.value === 'Pago' ? hoje : '' }))}>
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', marginTop: '12px' }}>
              <label>
                Fornecedor
                <input type="text" required value={boletoForm.fornecedor} onChange={e => setBoletoForm(prev => ({ ...prev, fornecedor: e.target.value }))} />
              </label>
              <label>
                Valor Total (Boleto)
                <input type="number" step="0.01" required value={boletoForm.valorBoleto} onChange={e => setBoletoForm(prev => ({ ...prev, valorBoleto: parseFloat(e.target.value) || 0 }))} />
              </label>
            </div>

            <label style={{ marginTop: '12px' }}>
              Descrição da Despesa
              <input type="text" required value={boletoForm.descricao} onChange={e => setBoletoForm(prev => ({ ...prev, descricao: e.target.value }))} />
            </label>

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

            {boletoForm.status === 'Pago' && (
              <label style={{ marginTop: '12px' }}>
                Data do Pagamento
                <input type="date" value={boletoForm.dataPagamento} onChange={e => setBoletoForm(prev => ({ ...prev, dataPagamento: e.target.value }))} />
              </label>
            )}

            <div className="modal-actions-btns" style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
          <div className="modal-card glass" style={{ maxWidth: '680px' }}>
            <h2>Importador de Planilha — Copie e Cole</h2>
            
            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
              <label style={{ flex: 1 }}>
                Tipo de Importação
                <select value={importType} onChange={e => handleImportParse(importText, e.target.value)}>
                  <option value="servicos">Serviços</option>
                  <option value="compras">Compras</option>
                  <option value="boletos">Boletos a Pagar</option>
                </select>
              </label>
            </div>

            <label>
              Cole as linhas copiadas da planilha Excel aqui (com ou sem cabeçalhos)
              <textarea 
                rows="8" 
                placeholder="Copie as linhas da planilha Excel (CTRL+C) e cole (CTRL+V) nesta caixa..." 
                value={importText}
                onChange={e => handleImportParse(e.target.value)}
                style={{ width: '100%', fontFamily: 'monospace', padding: '10px', fontSize: '11px', borderRadius: '12px', border: '1px solid var(--line)', background: 'rgba(0,0,0,.2)', color: '#fff', resize: 'vertical' }}
              />
            </label>

            {importPreview && (
              <div className="import-preview-box glass" style={{ marginTop: '12px', padding: '12px', borderRadius: '12px', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.03)' }}>
                {importPreview}
              </div>
            )}

            <div className="modal-actions-btns" style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setImportModal(false)}>Cancelar</button>
              <button className="btn primary" onClick={confirmImport} disabled={parsedImportItems.length === 0}>
                Confirmar Importação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pernambucana;
