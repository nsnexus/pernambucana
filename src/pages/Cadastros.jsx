import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import Sidebar from '../components/Sidebar';
import * as XLSX from 'xlsx';
import '../styles/cadastros.css';

const Cadastros = () => {
  const { currentUser } = useAuth();
  const {
    servicos,
    compras,
    loading,
    addServico,
    updateServico,
    deleteServico,
    addCompra,
    updateCompra,
    deleteCompra,
    clearAll,
    importRawData,
    DEPARTMENTS,
    DEFAULT_DEPT_LABEL,
    MONTHS,
    normalizeSector
  } = useData();

  // Theme State
  const [whiteTheme, setWhiteTheme] = useState(() => {
    return localStorage.getItem('pernambucana.financeDashboard.theme.v1') === 'white';
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState('servicos'); // servicos, compras, folha, custosFixos

  // Filters State
  const [monthFilter, setMonthFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [servicoModalOpen, setServicoModalOpen] = useState(false);
  const [servicoEditId, setServicoEditId] = useState(null);
  const [servicoForm, setServicoForm] = useState({
    data: '',
    setor: '',
    pagamento: 'À vista',
    tipoServico: 'Serviços',
    os: '',
    cliente: '',
    descricao: '',
    qtd: 1,
    valorUnitario: 0,
    valorTotal: 0,
    material: 0,
    produtivo: '',
    valorProdutivo: 0,
    desconto: 0
  });

  const [compraModalOpen, setCompraModalOpen] = useState(false);
  const [compraEditId, setCompraEditId] = useState(null);
  const [compraForm, setCompraForm] = useState({
    data: '',
    setor: '',
    categoria: 'Almoxarifado',
    formaCompra: 'À vista',
    solicitante: '',
    descricao: '',
    numOS: '',
    valorOS: 0,
    valorProduto: 0,
    fornecedor: '',
    numPedido: '',
    funcionario: '',
    bruto: 0,
    desconto: 0,
    liquido: 0
  });

  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [excelText, setExcelText] = useState('');
  const [excelImportType, setExcelImportType] = useState('auto'); // auto, servicos, compras
  const [excelPreview, setExcelPreview] = useState(null);
  const [parsedExcelItems, setParsedExcelItems] = useState([]);
  const [detectedExcelType, setDetectedExcelType] = useState('');

  // Toast State
  const [toastMessage, setToastMessage] = useState('');

  // Sync theme
  useEffect(() => {
    document.body.classList.toggle('theme-white', whiteTheme);
    localStorage.setItem('pernambucana.financeDashboard.theme.v1', whiteTheme ? 'white' : 'black');
  }, [whiteTheme]);

  // Sync sector values for non-admin on login
  useEffect(() => {
    if (currentUser && !currentUser.isAdmin) {
      setSectorFilter(currentUser.sector);
      setServicoForm(f => ({ ...f, setor: currentUser.sector }));
      setCompraForm(f => ({ ...f, setor: currentUser.sector }));
    }
  }, [currentUser]);

  // Helper formats
  const fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2600);
  };

  // Auto calculation logic for Servico modal
  useEffect(() => {
    const qtd = parseFloat(servicoForm.qtd) || 0;
    const unit = parseFloat(servicoForm.valorUnitario) || 0;
    const desc = parseFloat(servicoForm.desconto) || 0;
    const total = Math.max((qtd * unit) - desc, 0);
    setServicoForm(f => ({ ...f, valorTotal: total }));
  }, [servicoForm.qtd, servicoForm.valorUnitario, servicoForm.desconto]);

  // Auto calculation logic for Folha inputs
  useEffect(() => {
    const bruto = parseFloat(compraForm.bruto) || 0;
    const desc = parseFloat(compraForm.desconto) || 0;
    const liq = Math.max(bruto - desc, 0);
    setCompraForm(f => ({ ...f, liquido: liq, valorProduto: liq }));
  }, [compraForm.bruto, compraForm.desconto]);

  // Filtering list logic
  const getFilteredItems = () => {
    let rawList = [];
    if (activeTab === 'servicos') {
      rawList = servicos;
    } else if (activeTab === 'compras') {
      rawList = compras.filter(c => c.categoria !== 'Folha de pagamento' && c.categoria !== 'Custo fixo');
    } else if (activeTab === 'folha') {
      rawList = compras.filter(c => c.categoria === 'Folha de pagamento');
    } else if (activeTab === 'custosFixos') {
      rawList = compras.filter(c => c.categoria === 'Custo fixo');
    }

    return rawList.filter(item => {
      const matchMonth = monthFilter === 'all' || String(item.mesNum) === monthFilter;
      const matchSector = sectorFilter === 'all' || item.setor === sectorFilter;
      
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        String(item.cliente || '').toLowerCase().includes(q) ||
        String(item.os || item.numOS || '').toLowerCase().includes(q) ||
        String(item.descricao || '').toLowerCase().includes(q) ||
        String(item.produtivo || item.funcionario || '').toLowerCase().includes(q) ||
        String(item.tipoServico || item.categoria || '').toLowerCase().includes(q);

      return matchMonth && matchSector && matchSearch;
    });
  };

  const filteredItems = getFilteredItems();
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Pagination bounds checking
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredItems, totalPages, currentPage]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  // Servico CRUD Actions
  const openAddServico = () => {
    setServicoEditId(null);
    setServicoForm({
      data: new Date().toISOString().split('T')[0],
      setor: currentUser?.isAdmin ? 'Mecanica' : currentUser.sector,
      pagamento: 'À vista',
      tipoServico: 'Serviços',
      os: '',
      cliente: '',
      descricao: '',
      qtd: 1,
      valorUnitario: 0,
      valorTotal: 0,
      material: 0,
      produtivo: '',
      valorProdutivo: 0,
      desconto: 0
    });
    setServicoModalOpen(true);
  };

  const openEditServico = (item) => {
    setServicoEditId(item.id);
    setServicoForm({
      data: item.data,
      setor: item.setor,
      pagamento: item.pagamento,
      tipoServico: item.tipoServico,
      os: item.os || '',
      cliente: item.cliente || '',
      descricao: item.descricao || '',
      qtd: item.qtd || 1,
      valorUnitario: item.valorUnitario || 0,
      valorTotal: item.valorTotal || 0,
      material: item.material || 0,
      produtivo: item.produtivo || '',
      valorProdutivo: item.valorProdutivo || 0,
      desconto: item.desconto || 0
    });
    setServicoModalOpen(true);
  };

  const handleServicoSubmit = async (e) => {
    e.preventDefault();
    try {
      if (servicoEditId) {
        await updateServico(servicoEditId, servicoForm);
        triggerToast('Serviço atualizado com sucesso.');
      } else {
        await addServico(servicoForm);
        triggerToast('Serviço adicionado com sucesso.');
      }
      setServicoModalOpen(false);
    } catch (err) {
      alert(err.message || 'Erro ao gravar serviço.');
    }
  };

  const handleDeleteServico = async (id) => {
    if (window.confirm('Tem certeza de que deseja excluir este serviço?')) {
      await deleteServico(id);
      triggerToast('Serviço excluído.');
    }
  };

  // Compra CRUD Actions
  const openAddCompra = (forcedCategory = 'Almoxarifado') => {
    setCompraEditId(null);
    setCompraForm({
      data: new Date().toISOString().split('T')[0],
      setor: currentUser?.isAdmin ? 'Mecanica' : currentUser.sector,
      categoria: forcedCategory,
      formaCompra: 'À vista',
      solicitante: '',
      descricao: '',
      numOS: '',
      valorOS: 0,
      valorProduto: 0,
      fornecedor: '',
      numPedido: '',
      funcionario: '',
      bruto: 0,
      desconto: 0,
      liquido: 0
    });
    setCompraModalOpen(true);
  };

  const openEditCompra = (item) => {
    setCompraEditId(item.id);
    setCompraForm({
      data: item.data,
      setor: item.setor,
      categoria: item.categoria,
      formaCompra: item.formaCompra || 'À vista',
      solicitante: item.solicitante || '',
      descricao: item.descricao || '',
      numOS: item.numOS || '',
      valorOS: item.valorOS || 0,
      valorProduto: item.valorProduto || 0,
      fornecedor: item.fornecedor || '',
      numPedido: item.numPedido || '',
      funcionario: item.funcionario || '',
      bruto: item.bruto || 0,
      desconto: item.desconto || 0,
      liquido: item.liquido || 0
    });
    setCompraModalOpen(true);
  };

  const handleCompraSubmit = async (e) => {
    e.preventDefault();
    try {
      if (compraEditId) {
        await updateCompra(compraEditId, compraForm);
        triggerToast('Lançamento atualizado.');
      } else {
        await addCompra(compraForm);
        triggerToast('Lançamento registrado.');
      }
      setCompraModalOpen(false);
    } catch (err) {
      alert(err.message || 'Erro ao salvar compra.');
    }
  };

  const handleDeleteCompra = async (id) => {
    if (window.confirm('Tem certeza de que deseja excluir este lançamento?')) {
      await deleteCompra(id);
      triggerToast('Lançamento excluído.');
    }
  };

  // Excel Paste Import Logic
  const handleExcelPasteInput = (textVal, forceTypeVal) => {
    setExcelText(textVal);
    const text = textVal;
    const forceType = forceTypeVal || excelImportType;

    if (!text.trim()) {
      setExcelPreview(<span style={{ color: 'var(--muted)' }}>Cole os dados para ver o resumo da importação.</span>);
      setParsedExcelItems([]);
      return;
    }

    const lines = text.split(/\r?\n/).map(l => l.split('\t')).filter(cols => cols.length > 1 || (cols.length === 1 && cols[0].trim() !== ''));
    if (lines.length === 0) {
      setExcelPreview(<span style={{ color: 'var(--red)' }}>Nenhum dado válido encontrado.</span>);
      setParsedExcelItems([]);
      return;
    }

    let startIndex = 0;
    const firstRowHasHeaders = lines[0].some(cell => {
      const c = String(cell || '').trim().toLowerCase();
      return ['data', 'mês', 'mes', 'setor', 'cliente', 'categoria', 'valor', 'total', 'pagamento'].includes(c);
    });
    if (firstRowHasHeaders) {
      startIndex = 1;
    }

    if (lines.length <= startIndex) {
      setExcelPreview(<span style={{ color: 'var(--red)' }}>Apenas cabeçalho detectado. Cole também as linhas de dados.</span>);
      setParsedExcelItems([]);
      return;
    }

    const testColsCount = lines[startIndex].length;
    let detectedType = '';
    if (forceType === 'auto') {
      if (testColsCount >= 14 && testColsCount <= 18) {
        detectedType = 'servicos';
      } else if (testColsCount >= 10 && testColsCount <= 13) {
        detectedType = 'compras';
      } else {
        setExcelPreview(
          <span style={{ color: 'var(--red)' }}>
            Não conseguimos identificar o tipo de dados pelas colunas ({testColsCount} colunas detectadas).<br/>
            Copie a linha inteira da planilha de Serviços (16 colunas) ou de Compras (12 colunas), ou force a seleção do tipo de dados acima.
          </span>
        );
        setParsedExcelItems([]);
        return;
      }
    } else {
      detectedType = forceType;
    }

    setDetectedExcelType(detectedType);
    const parsedList = [];

    const cleanExcelCell = (v) => {
      let s = String(v ?? '').trim();
      return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
    };

    const parseExcelNumber = (v) => {
      let s = cleanExcelCell(v);
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
      const s = cleanExcelCell(v);
      if (!s) return '';
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (m) {
        return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      }
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
    };

    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i];
      if (cols.length === 1 && cols[0].trim() === '') continue;

      while (cols.length < (detectedType === 'servicos' ? 16 : 12)) {
        cols.push('');
      }

      if (detectedType === 'servicos') {
        const totalVal = parseExcelNumber(cols[10]);
        const unitVal = parseExcelNumber(cols[9]);
        const qtdVal = parseExcelNumber(cols[7]) || 1;
        
        parsedList.push({
          data: parseExcelDate(cols[0]),
          mes: cleanExcelCell(cols[1]),
          setor: cleanExcelCell(cols[2]),
          pagamento: cleanExcelCell(cols[3]) || 'À vista',
          codigoServico: cleanExcelCell(cols[4]),
          cliente: cleanExcelCell(cols[5]) || 'Cliente Importado',
          descricao: cleanExcelCell(cols[6]),
          qtd: qtdVal,
          os: cleanExcelCell(cols[8]),
          valorUnitario: unitVal || (totalVal / qtdVal) || 0,
          valorTotal: totalVal || (unitVal * qtdVal) || 0,
          produtivo: cleanExcelCell(cols[11]),
          valorProdutivo: parseExcelNumber(cols[12]),
          desconto: parseExcelNumber(cols[13]),
          tipoServico: cleanExcelCell(cols[14]) || 'Serviços',
          material: parseExcelNumber(cols[15])
        });
      } else {
        parsedList.push({
          data: parseExcelDate(cols[0]),
          mes: cleanExcelCell(cols[1]),
          setor: cleanExcelCell(cols[2]),
          formaCompra: cleanExcelCell(cols[3]) || 'À vista',
          solicitante: cleanExcelCell(cols[4]),
          descricao: cleanExcelCell(cols[5]) || 'Compra Importada',
          numOS: cleanExcelCell(cols[6]),
          valorOS: parseExcelNumber(cols[7]),
          valorProduto: parseExcelNumber(cols[8]),
          fornecedor: cleanExcelCell(cols[9]),
          numPedido: cleanExcelCell(cols[10]),
          categoria: cleanExcelCell(cols[11]) || 'Almoxarifado'
        });
      }
    }

    setParsedExcelItems(parsedList);
    const typeLabel = detectedType === 'servicos' ? 'Serviços' : 'Compras e Despesas';
    setExcelPreview(
      <div style={{ color: 'var(--green)', textAlign: 'left' }}>
        <strong>✔ Formato Identificado:</strong> Lançamentos de {typeLabel}<br/>
        <strong>📊 Registros Encontrados:</strong> {parsedList.length} linhas de dados prontas.<br/>
        <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>Clique no botão abaixo para confirmar e importar no Firebase.</small>
      </div>
    );
  };

  const confirmExcelImport = async () => {
    if (parsedExcelItems.length === 0 || !detectedExcelType) return;
    
    let count = 0;
    try {
      for (const item of parsedExcelItems) {
        if (currentUser && !currentUser.isAdmin) {
          item.setor = currentUser.sector;
        }
        
        if (detectedExcelType === 'servicos') {
          await addServico(item);
        } else {
          await addCompra(item);
        }
        count++;
      }
      triggerToast(`${count} lançamentos importados com sucesso.`);
      setExcelModalOpen(false);
      setExcelText('');
      setExcelPreview(null);
    } catch (err) {
      alert('Erro ao realizar a importação: ' + err.message);
    }
  };

  // JSON Backups Export / Import
  const exportJSON = () => {
    const dataObj = {
      servicos: servicos,
      compras: compras,
      exportadoEm: new Date().toISOString(),
      versao: "firebase-react-v1"
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataObj, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `backup-financeiro-pernambucana-${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast('Backup JSON gerado com sucesso.');
  };

  const handleJSONImport = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (parsed && (Array.isArray(parsed.servicos) || Array.isArray(parsed.compras))) {
          if (window.confirm(`Deseja importar ${parsed.servicos?.length || 0} serviços e ${parsed.compras?.length || 0} compras para o Firebase?`)) {
            await importRawData(parsed.servicos, parsed.compras);
            triggerToast('Lançamentos importados com sucesso.');
          }
        } else {
          alert('Arquivo JSON inválido ou incompatível.');
        }
      } catch (err) {
        alert('Erro ao ler arquivo: ' + err.message);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="painel-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <button 
        className="theme-btn-icon" 
        onClick={() => setWhiteTheme(!whiteTheme)}
        title={whiteTheme ? 'Alternar para Tema Escuro' : 'Alternar para Tema Claro'}
        type="button"
      >
        {whiteTheme ? '🌙' : '☀️'}
      </button>
      <Sidebar 
        currentPage={activeTab} 
        onPageChange={handleTabChange}
        isCadastrosPage={true}
      />

      <main className="main" style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        <header className="hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--line)' }}>
          <div>
            <div className="badge"><span></span> Cadastro de Informações</div>
            <h1>Lançamentos e Cadastros Financeiros</h1>
            <p>Gerencie dados do Firestore em tempo real. Administradores editam todas as áreas, colaboradores editam seu respectivo setor.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn ghost" onClick={exportJSON}>Exportar Backup JSON</button>
            <label className="btn ghost" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              Importar Backup JSON
              <input type="file" accept=".json" onChange={handleJSONImport} style={{ display: 'none' }} />
            </label>
          </div>
        </header>

        {/* Toolbar de filtros */}
        <section className="toolbar glass" style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label>
            Mês
            <select value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setCurrentPage(1); }}>
              <option value="all">Todos</option>
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>
          </label>

          <label>
            Setor
            <select 
              value={sectorFilter} 
              onChange={(e) => { setSectorFilter(e.target.value); setCurrentPage(1); }}
              disabled={currentUser && !currentUser.isAdmin}
            >
              <option value="all">Todos os setores</option>
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{DEFAULT_DEPT_LABEL[d]}</option>
              ))}
            </select>
          </label>

          <label className="search" style={{ flex: 1 }}>
            Busca
            <input 
              type="search" 
              placeholder="Buscar por cliente, OS, descrição, solicitante..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </label>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn import" onClick={() => setExcelModalOpen(true)}>Importar do Excel (Ctrl+V)</button>
            <button className="btn primary" onClick={() => {
              if (activeTab === 'servicos') openAddServico();
              else if (activeTab === 'compras') openAddCompra('Almoxarifado');
              else if (activeTab === 'folha') openAddCompra('Folha de pagamento');
              else if (activeTab === 'custosFixos') openAddCompra('Custo fixo');
            }}>
              + Novo Registro
            </button>
          </div>
        </section>

        {/* Tabelas de lançamentos */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
            Carregando dados do Firebase Firestore...
          </div>
        ) : (
          <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
            <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <span>{activeTab === 'servicos' ? 'Serviços' : activeTab === 'compras' ? 'Compras' : activeTab === 'folha' ? 'Folha' : 'Custos Fixos'}</span>
                <h3>Lista de Lançamentos ({filteredItems.length} registros)</h3>
              </div>
              <div>Página {currentPage} de {totalPages}</div>
            </div>

            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              {activeTab === 'servicos' && (
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Setor</th>
                      <th>OS</th>
                      <th>Cliente</th>
                      <th>Descrição</th>
                      <th>Qtd</th>
                      <th>Unitário</th>
                      <th>Líquido</th>
                      <th>Condição</th>
                      <th>Produtivo</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map(item => (
                      <tr key={item.id}>
                        <td>{item.data}</td>
                        <td>{DEFAULT_DEPT_LABEL[item.setor] || item.setor}</td>
                        <td>{item.os || '-'}</td>
                        <td>{item.cliente || '-'}</td>
                        <td>{item.descricao || '-'}</td>
                        <td>{item.qtd}</td>
                        <td>{fmtMoney.format(item.valorUnitario)}</td>
                        <td><strong>{fmtMoney.format(item.valorTotal)}</strong></td>
                        <td>{item.pagamento}</td>
                        <td>{item.produtivo || '-'}</td>
                        <td>
                          <button className="btn mini ghost" onClick={() => openEditServico(item)} style={{ marginRight: '6px' }}>Editar</button>
                          <button className="btn mini bad" onClick={() => handleDeleteServico(item.id)}>Excluir</button>
                        </td>
                      </tr>
                    ))}
                    {paginatedItems.length === 0 && (
                      <tr><td colSpan="11" style={{ textAlign: 'center', color: 'var(--muted)' }}>Nenhum lançamento de serviço encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'compras' && (
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Setor</th>
                      <th>Categoria</th>
                      <th>Descrição</th>
                      <th>OS Ref</th>
                      <th>Solicitante</th>
                      <th>Fornecedor</th>
                      <th>Valor</th>
                      <th>Forma</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map(item => (
                      <tr key={item.id}>
                        <td>{item.data}</td>
                        <td>{DEFAULT_DEPT_LABEL[item.setor] || item.setor}</td>
                        <td>{item.categoria}</td>
                        <td>{item.descricao || '-'}</td>
                        <td>{item.numOS || '-'}</td>
                        <td>{item.solicitante || '-'}</td>
                        <td>{item.fornecedor || '-'}</td>
                        <td><strong>{fmtMoney.format(item.valorProduto)}</strong></td>
                        <td>{item.formaCompra}</td>
                        <td>
                          <button className="btn mini ghost" onClick={() => openEditCompra(item)} style={{ marginRight: '6px' }}>Editar</button>
                          <button className="btn mini bad" onClick={() => handleDeleteCompra(item.id)}>Excluir</button>
                        </td>
                      </tr>
                    ))}
                    {paginatedItems.length === 0 && (
                      <tr><td colSpan="10" style={{ textAlign: 'center', color: 'var(--muted)' }}>Nenhuma compra ou despesa cadastrada.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'folha' && (
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Setor</th>
                      <th>Funcionário</th>
                      <th>Valor Bruto</th>
                      <th>Descontos</th>
                      <th>Líquido Final</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map(item => (
                      <tr key={item.id}>
                        <td>{item.data}</td>
                        <td>{DEFAULT_DEPT_LABEL[item.setor] || item.setor}</td>
                        <td>{item.funcionario || '-'}</td>
                        <td>{fmtMoney.format(item.bruto)}</td>
                        <td>{fmtMoney.format(item.desconto)}</td>
                        <td><strong>{fmtMoney.format(item.liquido)}</strong></td>
                        <td>
                          <button className="btn mini ghost" onClick={() => openEditCompra(item)} style={{ marginRight: '6px' }}>Editar</button>
                          <button className="btn mini bad" onClick={() => handleDeleteCompra(item.id)}>Excluir</button>
                        </td>
                      </tr>
                    ))}
                    {paginatedItems.length === 0 && (
                      <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--muted)' }}>Nenhum holerite cadastrado para este período.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'custosFixos' && (
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Setor</th>
                      <th>Descrição</th>
                      <th>Valor do Custo Fixo</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map(item => (
                      <tr key={item.id}>
                        <td>{item.data}</td>
                        <td>{DEFAULT_DEPT_LABEL[item.setor] || item.setor}</td>
                        <td>{item.descricao || '-'}</td>
                        <td><strong>{fmtMoney.format(item.valorProduto)}</strong></td>
                        <td>
                          <button className="btn mini ghost" onClick={() => openEditCompra(item)} style={{ marginRight: '6px' }}>Editar</button>
                          <button className="btn mini bad" onClick={() => handleDeleteCompra(item.id)}>Excluir</button>
                        </td>
                      </tr>
                    ))}
                    {paginatedItems.length === 0 && (
                      <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--muted)' }}>Nenhum custo fixo cadastrado.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Rodapé da paginação */}
            {totalPages > 1 && (
              <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                <button className="btn mini ghost" disabled={currentPage === 1} onClick={() => setCurrentPage(c => Math.max(c - 1, 1))}>Anterior</button>
                <span style={{ alignSelf: 'center', fontSize: '14px', color: 'var(--muted)' }}>{currentPage} de {totalPages}</span>
                <button className="btn mini ghost" disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => Math.min(c + 1, totalPages))}>Próxima</button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Modal Cadastro de Serviço */}
      {servicoModalOpen && (
        <div className="modal show" id="servicoModal">
          <div className="modal-backdrop" onClick={() => setServicoModalOpen(false)}></div>
          <form className="login-card modal-form-card glass" onSubmit={handleServicoSubmit} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2>{servicoEditId ? 'Editar Serviço' : 'Novo Serviço'}</h2>
              <button className="close" type="button" onClick={() => setServicoModalOpen(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {!currentUser?.isAdmin && (
                <div id="servicoRestrictedInfo" style={{ display: 'flex', color: 'var(--blue)', background: 'rgba(31,182,255,0.08)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                  🔒 Seu perfil de acesso restringe lançamentos apenas ao seu setor.
                </div>
              )}
              
              <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Data</label>
                  <input type="date" required value={servicoForm.data} onChange={(e) => setServicoForm(f => ({ ...f, data: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Setor</label>
                  <select 
                    value={servicoForm.setor} 
                    onChange={(e) => setServicoForm(f => ({ ...f, setor: e.target.value }))}
                    disabled={currentUser && !currentUser.isAdmin}
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{DEFAULT_DEPT_LABEL[d]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Tipo de Serviço (Aba)</label>
                  <input type="text" placeholder="Ex: Cabeçote, Bloco, Serviços" required value={servicoForm.tipoServico} onChange={(e) => setServicoForm(f => ({ ...f, tipoServico: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Condição de Pagamento</label>
                  <select value={servicoForm.pagamento} onChange={(e) => setServicoForm(f => ({ ...f, pagamento: e.target.value }))}>
                    <option value="À vista">À vista</option>
                    <option value="À prazo">À prazo</option>
                  </select>
                </div>
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Número da O.S.</label>
                  <input type="text" placeholder="Código O.S." value={servicoForm.os} onChange={(e) => setServicoForm(f => ({ ...f, os: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Cliente</label>
                  <input type="text" placeholder="Nome do cliente" required value={servicoForm.cliente} onChange={(e) => setServicoForm(f => ({ ...f, cliente: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label>Descrição Detalhada</label>
                <textarea placeholder="Histórico do serviço..." style={{ height: '70px', resize: 'vertical' }} value={servicoForm.descricao} onChange={(e) => setServicoForm(f => ({ ...f, descricao: e.target.value }))}></textarea>
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Qtd</label>
                  <input type="number" step="0.01" min="0.01" required value={servicoForm.qtd} onChange={(e) => setServicoForm(f => ({ ...f, qtd: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Valor Unitário (R$)</label>
                  <input type="number" step="0.01" min="0" required value={servicoForm.valorUnitario} onChange={(e) => setServicoForm(f => ({ ...f, valorUnitario: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Desconto (R$)</label>
                  <input type="number" step="0.01" min="0" value={servicoForm.desconto} onChange={(e) => setServicoForm(f => ({ ...f, desconto: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Valor Líquido Total (R$)</label>
                  <input type="number" disabled value={servicoForm.valorTotal.toFixed(2)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Custo Material OS (R$)</label>
                  <input type="number" step="0.01" min="0" value={servicoForm.material} onChange={(e) => setServicoForm(f => ({ ...f, material: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Produtivo Responsável</label>
                  <input type="text" placeholder="Nome do produtivo" value={servicoForm.produtivo} onChange={(e) => setServicoForm(f => ({ ...f, produtivo: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Repasse Produtivo (R$)</label>
                  <input type="number" step="0.01" min="0" value={servicoForm.valorProdutivo} onChange={(e) => setServicoForm(f => ({ ...f, valorProdutivo: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn ghost" type="button" onClick={() => setServicoModalOpen(false)}>Cancelar</button>
              <button className="btn primary" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Cadastro de Compra / Despesa / Folha / Custo Fixo */}
      {compraModalOpen && (
        <div className="modal show" id="compraModal">
          <div className="modal-backdrop" onClick={() => setCompraModalOpen(false)}></div>
          <form className="login-card modal-form-card glass" onSubmit={handleCompraSubmit} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2>{compraEditId ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
              <button className="close" type="button" onClick={() => setCompraModalOpen(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {!currentUser?.isAdmin && (
                <div id="compraRestrictedInfo" style={{ display: 'flex', color: 'var(--blue)', background: 'rgba(31,182,255,0.08)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                  🔒 Seu perfil de acesso restringe lançamentos apenas ao seu setor.
                </div>
              )}
              
              <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Data</label>
                  <input type="date" required value={compraForm.data} onChange={(e) => setCompraForm(f => ({ ...f, data: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Setor</label>
                  <select 
                    value={compraForm.setor} 
                    onChange={(e) => setCompraForm(f => ({ ...f, setor: e.target.value }))}
                    disabled={currentUser && !currentUser.isAdmin}
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{DEFAULT_DEPT_LABEL[d]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Categoria de Despesa</label>
                <select 
                  value={compraForm.categoria} 
                  onChange={(e) => setCompraForm(f => ({ ...f, categoria: e.target.value }))}
                  disabled={compraEditId !== null} // Categoria fixa na edição
                >
                  <option value="Almoxarifado">Almoxarifado</option>
                  <option value="Alimentação">Alimentação</option>
                  <option value="Material OS">Material OS</option>
                  <option value="Imposto">Imposto</option>
                  <option value="Compras do mês">Compras do Mês</option>
                  <option value="Compras a prazo">Compras a Prazo</option>
                  <option value="Saídas à vista">Saídas à Vista</option>
                  <option value="Custo fixo">Custo Fixo</option>
                  <option value="Folha de pagamento">Folha de pagamento (Holerite)</option>
                </select>
              </div>

              {compraForm.categoria === 'Folha de pagamento' ? (
                /* Formulário específico de Folha */
                <div id="panelFolha">
                  <div className="form-group">
                    <label>Funcionário</label>
                    <input type="text" placeholder="Nome do colaborador" required value={compraForm.funcionario} onChange={(e) => setCompraForm(f => ({ ...f, funcionario: e.target.value }))} />
                  </div>
                  <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Bruto (R$)</label>
                      <input type="number" step="0.01" min="0" required value={compraForm.bruto} onChange={(e) => setCompraForm(f => ({ ...f, bruto: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Descontos (R$)</label>
                      <input type="number" step="0.01" min="0" value={compraForm.desconto} onChange={(e) => setCompraForm(f => ({ ...f, desconto: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Líquido Final (R$)</label>
                      <input type="number" disabled value={compraForm.liquido.toFixed(2)} />
                    </div>
                  </div>
                </div>
              ) : compraForm.categoria === 'Custo fixo' ? (
                /* Formulário específico de Custo Fixo */
                <div id="panelCustoFixo">
                  <div className="form-group">
                    <label>Descrição da Despesa Fixa</label>
                    <input type="text" placeholder="Ex: Aluguel, Provisão FGTS, Água/Luz" required value={compraForm.descricao} onChange={(e) => setCompraForm(f => ({ ...f, descricao: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Valor Pago (R$)</label>
                    <input type="number" step="0.01" min="0" required value={compraForm.valorProduto} onChange={(e) => setCompraForm(f => ({ ...f, valorProduto: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              ) : (
                /* Formulário padrão para compras */
                <div id="panelCompraPadrao">
                  <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Forma de Pagamento</label>
                      <select value={compraForm.formaCompra} onChange={(e) => setCompraForm(f => ({ ...f, formaCompra: e.target.value }))}>
                        <option value="À vista">À vista</option>
                        <option value="À prazo">À prazo</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Solicitante</label>
                      <input type="text" placeholder="Nome de quem solicitou" required value={compraForm.solicitante} onChange={(e) => setCompraForm(f => ({ ...f, solicitante: e.target.value }))} />
                    </div>
                  </div>

                  <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Fornecedor</label>
                      <input type="text" placeholder="Nome da empresa/fornecedor" value={compraForm.fornecedor} onChange={(e) => setCompraForm(f => ({ ...f, fornecedor: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Número do Pedido</label>
                      <input type="text" placeholder="Nº pedido compra" value={compraForm.numPedido} onChange={(e) => setCompraForm(f => ({ ...f, numPedido: e.target.value }))} />
                    </div>
                  </div>

                  <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Ref. O.S. (Opcional)</label>
                      <input type="text" placeholder="O.S. associada" value={compraForm.numOS} onChange={(e) => setCompraForm(f => ({ ...f, numOS: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Valor O.S. (R$)</label>
                      <input type="number" step="0.01" min="0" value={compraForm.valorOS} onChange={(e) => setCompraForm(f => ({ ...f, valorOS: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Descrição Detalhada</label>
                    <textarea placeholder="Itens comprados..." style={{ height: '70px', resize: 'vertical' }} required value={compraForm.descricao} onChange={(e) => setCompraForm(f => ({ ...f, descricao: e.target.value }))}></textarea>
                  </div>

                  <div className="form-group">
                    <label>Valor Total do Produto/Serviço (R$)</label>
                    <input type="number" step="0.01" min="0" required value={compraForm.valorProduto} onChange={(e) => setCompraForm(f => ({ ...f, valorProduto: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn ghost" type="button" onClick={() => setCompraModalOpen(false)}>Cancelar</button>
              <button className="btn primary" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Excel Paste */}
      {excelModalOpen && (
        <div className="modal show" id="pasteExcelModal">
          <div className="modal-backdrop" onClick={() => setExcelModalOpen(false)}></div>
          <div className="login-card modal-form-card glass" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h2>Importar Copiando do Excel</h2>
              <button className="close" type="button" onClick={() => setExcelModalOpen(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '14px' }}>
                Copie as linhas da sua tabela no Excel (com colunas separadas por Tab) e cole na caixa de texto abaixo. O sistema identificará o formato automaticamente.
              </p>
              
              <div className="form-group">
                <label>Forçar Tipo de Importação</label>
                <select value={excelImportType} onChange={(e) => { setExcelImportType(e.target.value); handleExcelPasteInput(excelText, e.target.value); }}>
                  <option value="auto">Auto-detectar pelas colunas</option>
                  <option value="servicos">Forçar Importação como Serviços (16 colunas)</option>
                  <option value="compras">Forçar Importação como Compras (12 colunas)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Área de Colagem (Ctrl+V)</label>
                <textarea 
                  placeholder="Clique aqui e cole os dados do Excel..." 
                  style={{ width: '100%', height: '180px', fontFamily: 'monospace', fontSize: '11px', borderRadius: '12px', border: '1px solid var(--line)', background: 'rgba(2, 9, 17, 0.55)', color: '#fff', padding: '12px', outline: 'none', resize: 'vertical' }}
                  value={excelText}
                  onChange={(e) => handleExcelPasteInput(e.target.value, excelImportType)}
                ></textarea>
              </div>
              
              <div id="pasteExcelPreview" style={{ marginTop: '16px', padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--line)', fontSize: '13px', minHeight: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                {excelPreview || <span style={{ color: 'var(--muted)' }}>Cole os dados para ver o resumo da importação.</span>}
              </div>
            </div>
            
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn ghost" type="button" onClick={() => setExcelModalOpen(false)}>Cancelar</button>
              <button className="btn primary" disabled={parsedExcelItems.length === 0} onClick={confirmExcelImport}>Confirmar e Importar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast show" id="toast">{toastMessage}</div>
      )}
    </div>
  );
};

export default Cadastros;
