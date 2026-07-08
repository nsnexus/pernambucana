import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAutoGeral } from '../context/AutoGeralContext';
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

const AutoGeral = () => {
  const { currentUser } = useAuth();
  const {
    servicos, compras, boletos, recebiveis, loading, caixa, MONTHS,
    addServico, updateServico, deleteServico,
    addCompra, updateCompra, deleteCompra,
    addBoleto, updateBoleto, deleteBoleto,
    toggleRecebivel, deleteRecebivel,
    importServicosFromExcel, importComprasFromExcel, importBoletosFromExcel
  } = useAutoGeral();

  // Theme
  const [whiteTheme, setWhiteTheme] = useState(() =>
    localStorage.getItem('pernambucana.financeDashboard.theme.v1') === 'white'
  );
  useEffect(() => {
    document.body.classList.toggle('theme-white', whiteTheme);
    localStorage.setItem('pernambucana.financeDashboard.theme.v1', whiteTheme ? 'white' : 'black');
  }, [whiteTheme]);

  // Tabs
  const [activeTab, setActiveTab] = useState('dashboard');

  // Filters
  const [monthFilter, setMonthFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const triggerToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 2600); };

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
    nomeFornecedor: '', descricaoMaterial: '', valorBoleto: 0,
    valorOS: 0, nomeCliente: '', dataVencimento: '', mesVencimento: ''
  });

  const [importModal, setImportModal] = useState(false);
  const [importType, setImportType] = useState('servicos');
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [parsedImportItems, setParsedImportItems] = useState([]);

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
    try {
      const changedIds = Object.keys(gridChanges);
      if (changedIds.length === 0) {
        setGridEditMode(false);
        return;
      }
      
      for (const id of changedIds) {
        const changes = gridChanges[id];
        
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
    }
  };

  const discardGridChanges = () => {
    setGridChanges({});
    setGridEditMode(false);
    triggerToast('Alterações descartadas.');
  };

  // Money formatter
  const fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  // Reset page on tab change
  useEffect(() => { setCurrentPage(1); setGridEditMode(false); setGridChanges({}); }, [activeTab, monthFilter, searchQuery, statusFilter]);

  // ── FILTERING ──
  const filterList = (list, extraFilter) => {
    return list.filter(item => {
      const mNum = item.mesNum || parseInt((item.dataVencimento || '').split('-')[1], 10);
      const matchMonth = monthFilter === 'all' || String(mNum) === monthFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || Object.values(item).join(' ').toLowerCase().includes(q);
      const extra = extraFilter ? extraFilter(item) : true;
      return matchMonth && matchSearch && extra;
    });
  };

  const filteredServicos = useMemo(() => filterList(servicos), [servicos, monthFilter, searchQuery]);
  const filteredCompras = useMemo(() => filterList(compras), [compras, monthFilter, searchQuery]);
  const filteredBoletos = useMemo(() => filterList(boletos), [boletos, monthFilter, searchQuery]);
  const filteredRecebiveis = useMemo(() => filterList(recebiveis, (item) => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  }), [recebiveis, monthFilter, searchQuery, statusFilter]);

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
    try {
      if (servicoEditId) {
        await updateServico(servicoEditId, servicoForm);
        triggerToast('Serviço atualizado.');
      } else {
        await addServico(servicoForm);
        triggerToast('Serviço cadastrado' + (String(servicoForm.formaCompra).toLowerCase().includes('prazo') && servicoForm.numParcelas > 0 ? ` com ${servicoForm.numParcelas} recebíveis gerados.` : '.'));
      }
      setServicoModal(false);
    } catch (err) { alert(err.message); }
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
    try {
      if (compraEditId) {
        await updateCompra(compraEditId, compraForm);
        triggerToast('Compra atualizada.');
      } else {
        await addCompra(compraForm);
        triggerToast('Compra registrada.');
      }
      setCompraModal(false);
    } catch (err) { alert(err.message); }
  };

  // ── BOLETO ACTIONS ──
  const openAddBoleto = () => {
    setBoletoEditId(null);
    setBoletoForm({
      nomeFornecedor: '', descricaoMaterial: '', valorBoleto: 0,
      valorOS: 0, nomeCliente: '', dataVencimento: '', mesVencimento: ''
    });
    setBoletoModal(true);
  };

  const openEditBoleto = (item) => {
    setBoletoEditId(item.id);
    setBoletoForm({
      nomeFornecedor: item.nomeFornecedor || '', descricaoMaterial: item.descricaoMaterial || '',
      valorBoleto: item.valorBoleto || 0, valorOS: item.valorOS || 0,
      nomeCliente: item.nomeCliente || '', dataVencimento: item.dataVencimento || '',
      mesVencimento: item.mesVencimento || ''
    });
    setBoletoModal(true);
  };

  const handleBoletoSubmit = async (e) => {
    e.preventDefault();
    try {
      if (boletoEditId) {
        await updateBoleto(boletoEditId, boletoForm);
        triggerToast('Boleto atualizado.');
      } else {
        await addBoleto(boletoForm);
        triggerToast('Boleto registrado.');
      }
      setBoletoModal(false);
    } catch (err) { alert(err.message); }
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
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  };

  const cleanCell = (v) => {
    let s = String(v ?? '').trim();
    return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
  };

  const handleImportParse = (text) => {
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

      if (importType === 'servicos') {
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
      } else if (importType === 'compras') {
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
      } else if (importType === 'boletos') {
        while (cols.length < 7) cols.push('');
        parsedList.push({
          nomeFornecedor: cleanCell(cols[1]),
          descricaoMaterial: cleanCell(cols[2]),
          valorBoleto: parseExcelNumber(cols[3]),
          valorOS: parseExcelNumber(cols[4]),
          nomeCliente: cleanCell(cols[5]),
          dataVencimento: parseExcelDate(cols[6]),
          mesVencimento: cleanCell(cols[7]) || ''
        });
      }
    }

    setParsedImportItems(parsedList);
    const typeLabel = importType === 'servicos' ? 'Serviços' : importType === 'compras' ? 'Compras' : 'Boletos';
    setImportPreview(
      <div style={{ color: 'var(--green)', textAlign: 'left' }}>
        <strong>✔ Formato:</strong> {typeLabel}<br/>
        <strong>📊 Registros:</strong> {parsedList.length} linhas prontas para importar.<br/>
        <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>Clique em "Confirmar Importação" para salvar no Firebase.</small>
      </div>
    );
  };

  const confirmImport = async () => {
    if (parsedImportItems.length === 0) return;
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
    } catch (err) { alert('Erro: ' + err.message); }
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
        legend: { display: !hideLegend, position: 'bottom', labels: { color: colors.legend, font: { family: 'Inter', weight: '600', size: 11 } } },
        tooltip: {
          backgroundColor: whiteTheme ? 'rgba(255,255,255,.98)' : 'rgba(13,34,51,.98)',
          titleColor: whiteTheme ? '#092133' : '#fff', bodyColor: whiteTheme ? '#092133' : '#fff',
          borderColor: colors.grid, borderWidth: 1, padding: 10, cornerRadius: 8,
          callbacks: { label: (ctx) => `${ctx.dataset.label || ''}: ${fmtMoney.format(ctx.parsed.y ?? ctx.parsed.x ?? ctx.parsed)}` }
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
        legend: { position: 'bottom', labels: { color: colors.legend, font: { family: 'Inter', weight: '600', size: 10 } } },
        tooltip: {
          backgroundColor: whiteTheme ? 'rgba(255,255,255,.98)' : 'rgba(13,34,51,.98)',
          titleColor: whiteTheme ? '#092133' : '#fff', bodyColor: whiteTheme ? '#092133' : '#fff',
          callbacks: { label: (ctx) => `${ctx.label}: ${fmtMoney.format(ctx.parsed)}` }
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
    const monthsSet = new Set();
    servicos.forEach(s => monthsSet.add(s.mesNum));
    boletos.forEach(b => {
      const m = parseInt((b.dataVencimento || '').split('-')[1], 10);
      if (m) monthsSet.add(m);
    });
    const months = Array.from(monthsSet).sort((a, b) => a - b);

    const dataEntradas = months.map(n => {
      const sv = servicos.filter(s => s.mesNum === n && !String(s.formaCompra || '').toLowerCase().includes('prazo'));
      const recM = recebiveis.filter(r => r.status === 'Recebido' && parseInt((r.dataRecebimento || r.dataVencimento || '').split('-')[1], 10) === n);
      return sv.reduce((s, x) => s + (parseFloat(x.valorOS) || 0), 0) + recM.reduce((s, x) => s + (parseFloat(x.valorParcela) || 0), 0);
    });

    const dataSaidas = months.map(n => {
      const bm = boletos.filter(b => parseInt((b.dataVencimento || '').split('-')[1], 10) === n);
      return bm.reduce((s, x) => s + (parseFloat(x.valorBoleto) || 0), 0);
    });

    return {
      labels: months.map(n => MONTHS[n - 1]?.slice(0, 3) || `M${n}`),
      datasets: [
        { label: 'Entradas', data: dataEntradas, backgroundColor: 'rgba(20,184,166,.8)', borderRadius: 8 },
        { label: 'Saídas', data: dataSaidas, backgroundColor: 'rgba(244,63,94,.8)', borderRadius: 8 }
      ]
    };
  }, [servicos, boletos, recebiveis]);

  const chartFormaPgto = useMemo(() => {
    const pix = servicos.filter(s => String(s.formaCompra || '').toLowerCase().includes('pix')).reduce((sum, s) => sum + (parseFloat(s.valorOS) || 0), 0);
    const cartao = servicos.filter(s => String(s.formaCompra || '').toLowerCase().includes('cart')).reduce((sum, s) => sum + (parseFloat(s.valorOS) || 0), 0);
    const prazo = servicos.filter(s => String(s.formaCompra || '').toLowerCase().includes('prazo')).reduce((sum, s) => sum + (parseFloat(s.valorOS) || 0), 0);
    return {
      labels: ['Pix', 'Cartão', 'À Prazo'],
      datasets: [{ data: [pix, cartao, prazo], backgroundColor: ['rgba(20,184,166,.85)', 'rgba(59,130,246,.85)', 'rgba(245,158,11,.85)'], borderWidth: 0 }]
    };
  }, [servicos]);

  const chartRecebiveisStatus = useMemo(() => {
    const pendente = recebiveis.filter(r => r.status === 'Pendente').reduce((s, r) => s + (parseFloat(r.valorParcela) || 0), 0);
    const recebido = recebiveis.filter(r => r.status === 'Recebido').reduce((s, r) => s + (parseFloat(r.valorParcela) || 0), 0);
    return {
      labels: ['Pendente', 'Recebido'],
      datasets: [{ data: [pendente, recebido], backgroundColor: ['rgba(245,158,11,.85)', 'rgba(20,184,166,.85)'], borderWidth: 0 }]
    };
  }, [recebiveis]);

  const chartMecanicos = useMemo(() => {
    const grouped = {};
    servicos.forEach(s => {
      const name = s.mecanico || 'Não informado';
      grouped[name] = (grouped[name] || 0) + (parseFloat(s.valorOS) || 0);
    });
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      labels: sorted.map(s => s[0]),
      datasets: [{ label: 'Faturamento', data: sorted.map(s => s[1]), backgroundColor: 'rgba(139,92,246,.8)', borderRadius: 8 }]
    };
  }, [servicos]);

  // ── RENDER HELPERS ──
  const hoje = new Date().toISOString().split('T')[0];

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
        Mês
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          <option value="all">Todos</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </label>
      {showStatus && (
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="Pendente">Pendente</option>
            <option value="Recebido">Recebido</option>
          </select>
        </label>
      )}
      <label className="search-field">
        Busca
        <input type="search" placeholder="Buscar por OS, cliente, mecânico..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        {['servicos', 'compras', 'boletos'].includes(activeTab) && (
          <button 
            className={`btn ghost ${gridEditMode ? 'active' : ''}`}
            type="button"
            onClick={() => {
              if (gridEditMode && Object.keys(gridChanges).length > 0) {
                if (!window.confirm('Descartar alterações pendentes?')) return;
              }
              setGridChanges({});
              setGridEditMode(!gridEditMode);
            }} 
            style={{ height: '38px', borderColor: gridEditMode ? 'var(--yellow)' : 'var(--line)', color: gridEditMode ? 'var(--yellow)' : 'var(--muted)', fontWeight: 800 }}
          >
            {gridEditMode ? '✓ Sair do Modo Planilha' : '✏️ Modo Planilha'}
          </button>
        )}
        <button className="btn import" onClick={() => setImportModal(true)} style={{ height: '38px' }}>Importar Excel</button>
        <button className="btn primary" onClick={() => {
          if (activeTab === 'servicos') openAddServico();
          else if (activeTab === 'compras') openAddCompra();
          else if (activeTab === 'boletos') openAddBoleto();
        }} style={{ height: '38px' }}>+ Novo</button>
      </div>
    </div>
  );

  // ── FORM FIELD ──
  const Field = ({ label, type = 'text', value, onChange, options, readOnly, step }) => (
    <div className="form-group">
      <label>{label}</label>
      {options ? (
        <select value={value} onChange={onChange} disabled={readOnly}>
          {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={onChange} readOnly={readOnly} step={step} />
      )}
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
      />

      <main className="main">
        {/* Tab Navigation */}
        <div className="tab-nav">
          {[
            { key: 'dashboard', label: '📊 Dashboard' },
            { key: 'servicos', label: '🔧 Serviços' },
            { key: 'compras', label: '🛒 Compras' },
            { key: 'boletos', label: '📄 Boletos a Pagar' },
            { key: 'recebiveis', label: '💰 Recebíveis' }
          ].map(t => (
            <button key={t.key} className={`tab-btn ${activeTab === t.key ? 'active' : ''}`} onClick={() => { setActiveTab(t.key); setCurrentPage(1); }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ DASHBOARD ═══ */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="ag-section-header">
              <div>
                <div className="badge" style={{ marginBottom: '6px' }}>Auto Geral</div>
                <h1>Painel Financeiro — Alto Geral</h1>
                <p>Visão consolidada do caixa, recebíveis e despesas do setor.</p>
              </div>
            </div>

            {/* Caixa Hero */}
            <div className="ag-caixa-hero">
              <div className={`ag-caixa-card glass ${caixa.saldo >= 0 ? 'positive' : 'negative'}`}>
                <div className="caixa-label">Saldo do Caixa</div>
                <span className="caixa-value">{fmtMoney.format(caixa.saldo)}</span>
                <div className="caixa-sub">Entradas efetivas − Saídas</div>
              </div>
              <div className="ag-caixa-card glass positive">
                <div className="caixa-label">Entradas Efetivas</div>
                <span className="caixa-value">{fmtMoney.format(caixa.entradas)}</span>
                <div className="caixa-sub">À vista + Recebíveis recebidos</div>
              </div>
              <div className="ag-caixa-card glass negative">
                <div className="caixa-label">Saídas (Boletos)</div>
                <span className="caixa-value">{fmtMoney.format(caixa.saidas)}</span>
                <div className="caixa-sub">{boletos.length} boletos</div>
              </div>
            </div>

            {/* KPIs */}
            <div className="ag-kpis">
              <div className="ag-kpi glass">
                <div className="kpi-label">Total Serviços</div>
                <span className="kpi-value">{fmtMoney.format(caixa.totalServicos)}</span>
                <span className="kpi-sub">{servicos.length} lançamentos</span>
              </div>
              <div className="ag-kpi glass accent-yellow">
                <div className="kpi-label">À Vista Recebido</div>
                <span className="kpi-value">{fmtMoney.format(caixa.totalServicoVista)}</span>
                <span className="kpi-sub">Pix + Cartão</span>
              </div>
              <div className="ag-kpi glass accent-blue">
                <div className="kpi-label">Recebíveis Pendentes</div>
                <span className="kpi-value">{fmtMoney.format(caixa.totalPendente)}</span>
                <span className="kpi-sub">{caixa.recebiveisPendentes} parcelas</span>
              </div>
              <div className="ag-kpi glass accent-purple">
                <div className="kpi-label">Recebíveis Recebidos</div>
                <span className="kpi-value">{fmtMoney.format(caixa.totalRecebido)}</span>
                <span className="kpi-sub">{caixa.recebiveisRecebidos} parcelas</span>
              </div>
              <div className="ag-kpi glass accent-red">
                <div className="kpi-label">Recebíveis Vencidos</div>
                <span className="kpi-value">{fmtMoney.format(caixa.totalVencido)}</span>
                <span className="kpi-sub">{caixa.recebiveisVencidos} parcelas atrasadas</span>
              </div>
              <div className="ag-kpi glass">
                <div className="kpi-label">Total Compras</div>
                <span className="kpi-value">{fmtMoney.format(caixa.totalCompras)}</span>
                <span className="kpi-sub">{compras.length} registros</span>
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
              <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table>
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
                                item.data
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <select value={rowData.formaCompra || 'Pix'} onChange={e => handleGridCellChange(item.id, 'formaCompra', e.target.value)} className="ag-grid-input">
                                  <option value="Pix">Pix</option>
                                  <option value="Cartão de Crédito">Cartão de Crédito</option>
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
                                {!gridEditMode && <button onClick={() => openEditServico(item)}>Editar</button>}
                                {hasChanges && <span style={{ color: 'var(--yellow)', fontSize: '11px', fontWeight: 'bold', padding: '4px 6px' }}>Editado</span>}
                                <button className="delete" onClick={() => { if (window.confirm('Excluir serviço e seus recebíveis?')) deleteServico(item.id).then(() => triggerToast('Excluído.')); }}>Excluir</button>
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
              <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table>
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
                                item.data
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <select value={rowData.formaCompra || 'Pix'} onChange={e => handleGridCellChange(item.id, 'formaCompra', e.target.value)} className="ag-grid-input">
                                  <option value="Pix">Pix</option>
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
              <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Fornecedor</th><th>Descrição Material</th><th>Valor Boleto</th>
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
                                item.dataVencimento || '-'
                              )}
                            </td>
                            <td>
                              {gridEditMode ? (
                                <select value={rowData.mesVencimento || ''} onChange={e => handleGridCellChange(item.id, 'mesVencimento', e.target.value)} className="ag-grid-input">
                                  <option value=""></option>
                                  {MONTHS.map(m => <option key={m} value={m.toLowerCase()}>{m}</option>)}
                                </select>
                              ) : (
                                item.mesVencimento || '-'
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
                </div>
                <div className="ag-kpi glass">
                  <div className="kpi-label">Recebidos</div>
                  <span className="kpi-value">{fmtMoney.format(caixa.totalRecebido)}</span>
                  <span className="kpi-sub">{caixa.recebiveisRecebidos} parcelas</span>
                </div>
                <div className="ag-kpi glass accent-red">
                  <div className="kpi-label">Vencidos</div>
                  <span className="kpi-value">{fmtMoney.format(caixa.totalVencido)}</span>
                  <span className="kpi-sub">{caixa.recebiveisVencidos} parcelas atrasadas</span>
                </div>
              </div>

              <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table>
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
                            <td style={isVencido ? { color: 'var(--red)', fontWeight: 800 } : {}}>{item.dataVencimento}</td>
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
                <Field label="Forma de Compra" value={servicoForm.formaCompra} onChange={e => setServicoForm({...servicoForm, formaCompra: e.target.value})} options={['Pix', 'Cartão de Crédito', 'à Prazo']} />
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
              <button className="btn ghost" type="button" onClick={() => setServicoModal(false)}>Cancelar</button>
              <button className="btn primary" type="submit">{servicoEditId ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Compra Modal */}
      {compraModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setCompraModal(false)} />
          <form className="modal-form-card glass" onSubmit={handleCompraSubmit} style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>{compraEditId ? 'Editar Compra' : 'Nova Compra'}</h3>
              <button className="close" type="button" onClick={() => setCompraModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <Field label="Data" type="date" value={compraForm.data} onChange={e => setCompraForm({...compraForm, data: e.target.value})} />
                <Field label="Forma de Compra" value={compraForm.formaCompra} onChange={e => setCompraForm({...compraForm, formaCompra: e.target.value})} options={['Pix', 'à Prazo']} />
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
              <button className="btn ghost" type="button" onClick={() => setCompraModal(false)}>Cancelar</button>
              <button className="btn primary" type="submit">{compraEditId ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Boleto Modal */}
      {boletoModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setBoletoModal(false)} />
          <form className="modal-form-card glass" onSubmit={handleBoletoSubmit} style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>{boletoEditId ? 'Editar Boleto' : 'Novo Boleto'}</h3>
              <button className="close" type="button" onClick={() => setBoletoModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <Field label="Nome do Fornecedor" value={boletoForm.nomeFornecedor} onChange={e => setBoletoForm({...boletoForm, nomeFornecedor: e.target.value})} />
                <Field label="Descrição do Material" value={boletoForm.descricaoMaterial} onChange={e => setBoletoForm({...boletoForm, descricaoMaterial: e.target.value})} />
                <Field label="Valor do Boleto" type="number" step="0.01" value={boletoForm.valorBoleto} onChange={e => setBoletoForm({...boletoForm, valorBoleto: parseFloat(e.target.value) || 0})} />
                <Field label="Valor da OS" type="number" step="0.01" value={boletoForm.valorOS} onChange={e => setBoletoForm({...boletoForm, valorOS: parseFloat(e.target.value) || 0})} />
                <Field label="Nome do Cliente" value={boletoForm.nomeCliente} onChange={e => setBoletoForm({...boletoForm, nomeCliente: e.target.value})} />
                <Field label="Data de Vencimento" type="date" value={boletoForm.dataVencimento} onChange={e => setBoletoForm({...boletoForm, dataVencimento: e.target.value})} />
                <Field label="Mês Vencimento" value={boletoForm.mesVencimento} onChange={e => setBoletoForm({...boletoForm, mesVencimento: e.target.value})} options={['', ...MONTHS.map(m => ({ value: m.toLowerCase(), label: m }))]} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" type="button" onClick={() => setBoletoModal(false)}>Cancelar</button>
              <button className="btn primary" type="submit">{boletoEditId ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <div className="modal show">
          <div className="modal-backdrop" onClick={() => setImportModal(false)} />
          <div className="modal-form-card glass" style={{ zIndex: 10 }}>
            <div className="modal-header">
              <h3>Importar do Excel (Ctrl+V)</h3>
              <button className="close" type="button" onClick={() => setImportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="ag-import-type-selector">
                {['servicos', 'compras', 'boletos'].map(t => (
                  <button key={t} className={`ag-import-type-btn ${importType === t ? 'active' : ''}`}
                    onClick={() => { setImportType(t); handleImportParse(importText); }}>
                    {t === 'servicos' ? '🔧 Serviços' : t === 'compras' ? '🛒 Compras' : '📄 Boletos'}
                  </button>
                ))}
              </div>
              <textarea
                className="ag-import-area"
                placeholder="Cole aqui os dados copiados do Excel (Ctrl+V)..."
                value={importText}
                onChange={(e) => handleImportParse(e.target.value)}
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
          <button className="btn primary" style={{ height: '36px', padding: '0 16px' }} onClick={saveGridChanges}>Salvar Alterações</button>
          <button className="btn ghost" style={{ height: '36px', padding: '0 16px', color: 'var(--red)', borderColor: 'rgba(244,63,94,0.3)' }} onClick={discardGridChanges}>Descartar</button>
        </div>
      )}

      {/* Toast */}
      {toastMessage && <div className="toast show" id="toast">{toastMessage}</div>}
    </div>
  );
};

export default AutoGeral;
