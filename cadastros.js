/**
 * Pernambucana Centro de Manutenção - Forms & CRUD JS
 * cadastros.js
 */

(function() {
  const THEME_STORAGE_KEY = 'pernambucana.financeDashboard.theme.v1';
  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const DEPARTMENTS = ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria', 'AltoGeral'];
  const DEPT_LABELS = {
    Mecanica: 'Mecânica',
    Peças: 'Peças',
    Retifica: 'Retífica',
    Torneadora: 'Torneadora',
    Caldeiraria: 'Caldeiraria',
    AltoGeral: 'Alto Geral'
  };

  const fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const $ = id => document.getElementById(id);

  // Global State for Paginations, Filters, and Pages
  const state = {
    page: 'servicos', // Active page section: servicos, compras, folha, custosFixos
    user: null,       // Loaded from DataStore.getUser()
    filters: {
      mesNum: 'all',
      setor: 'all',
      query: ''
    },
    pagination: {
      servicos: { page: 1, limit: 10 },
      compras: { page: 1, limit: 10 },
      folha: { page: 1, limit: 10 },
      custosFixos: { page: 1, limit: 10 }
    }
  };

  // Toast notification helper
  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // Theme support
  function isWhiteTheme() {
    return document.body.classList.contains('theme-white');
  }

  function applyTheme(theme) {
    const useWhite = theme === 'white';
    document.body.classList.toggle('theme-white', useWhite);
    localStorage.setItem(THEME_STORAGE_KEY, useWhite ? 'white' : 'black');
    const btn = $('btnThemeToggle');
    if (btn) btn.textContent = useWhite ? 'Tema black' : 'Tema white';
  }

  // Initialize Theme and Listeners
  function initTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) === 'white' ? 'white' : 'black';
    applyTheme(saved);
    $('btnThemeToggle')?.addEventListener('click', () => {
      applyTheme(isWhiteTheme() ? 'black' : 'white');
    });
  }

  // Check login and restrict sector access
  function initSecurity() {
    state.user = window.DataStore.getUser();
    
    // Fill user indicators
    $('userEmailAddress').textContent = state.user.email || 'Não Identificado';
    $('userSectorName').textContent = DEPT_LABELS[state.user.sector] || 'Administrador';

    // Handle restrict labels in modal
    if (!state.user.isAdmin) {
      $('servicoRestrictedInfo').style.display = 'flex';
      $('compraRestrictedInfo').style.display = 'flex';
      
      // Restrict sectors in form modal select
      const sSel = $('servicoSetor');
      const cSel = $('compraSetor');
      
      if (sSel) {
        sSel.value = state.user.sector;
        sSel.disabled = true;
      }
      if (cSel) {
        cSel.value = state.user.sector;
        cSel.disabled = true;
      }
    }
  }

  // Populate filter elements
  function populateFilters() {
    const monthFilter = $('monthFilter');
    const deptFilter = $('deptFilter');

    if (monthFilter) {
      monthFilter.innerHTML = '<option value="all">Todos</option>';
      MONTHS.forEach((m, idx) => {
        monthFilter.insertAdjacentHTML('beforeend', `<option value="${idx + 1}">${m}</option>`);
      });
    }

    if (deptFilter) {
      if (state.user.isAdmin) {
        deptFilter.innerHTML = '<option value="all">Todos os setores</option>';
        DEPARTMENTS.forEach(d => {
          deptFilter.insertAdjacentHTML('beforeend', `<option value="${d}">${DEPT_LABELS[d]}</option>`);
        });
        deptFilter.disabled = false;
      } else {
        deptFilter.innerHTML = `<option value="${state.user.sector}">${DEPT_LABELS[state.user.sector]}</option>`;
        deptFilter.value = state.user.sector;
        deptFilter.disabled = true;
        state.filters.setor = state.user.sector;
      }
    }
  }

  // Filter lists based on toolbar search & dropdown filters
  function getFilteredServicos() {
    let list = window.DataStore.getServicos(); // is already filtered by sector if user is non-admin
    const f = state.filters;
    
    return list.filter(item => {
      const matchMonth = f.mesNum === 'all' || String(item.mesNum) === f.mesNum;
      const matchSector = f.setor === 'all' || item.setor === f.setor;
      
      const q = f.query.toLowerCase().trim();
      const matchSearch = !q || 
        String(item.cliente || '').toLowerCase().includes(q) ||
        String(item.os || '').toLowerCase().includes(q) ||
        String(item.descricao || '').toLowerCase().includes(q) ||
        String(item.produtivo || '').toLowerCase().includes(q) ||
        String(item.tipoServico || '').toLowerCase().includes(q);

      return matchMonth && matchSector && matchSearch;
    });
  }

  function getFilteredCompras() {
    let list = window.DataStore.getCompras(); // already filtered if user is non-admin
    const f = state.filters;

    return list.filter(item => {
      const matchMonth = f.mesNum === 'all' || String(item.mesNum) === f.mesNum;
      const matchSector = f.setor === 'all' || item.setor === f.setor;

      const q = f.query.toLowerCase().trim();
      const matchSearch = !q || 
        String(item.solicitante || '').toLowerCase().includes(q) ||
        String(item.funcionario || '').toLowerCase().includes(q) ||
        String(item.fornecedor || '').toLowerCase().includes(q) ||
        String(item.numOS || '').toLowerCase().includes(q) ||
        String(item.descricao || '').toLowerCase().includes(q) ||
        String(item.categoria || '').toLowerCase().includes(q);

      return matchMonth && matchSector && matchSearch;
    });
  }

  // Toggle dynamic sub-panels in Compra modal based on Category selection
  function updateCompraCategoryPanels() {
    const cat = $('compraCategoria').value;
    const pPadrao = $('panelCompraPadrao');
    const pFolha = $('panelCompraFolha');
    const pFixo = $('panelCompraCustoFixo');

    // Hide all first
    pPadrao.style.display = 'none';
    pFolha.style.display = 'none';
    pFixo.style.display = 'none';

    // Disable required validations on hidden inputs
    // standard
    $('compraDescricao').required = false;
    $('compraValorProduto').required = false;
    // folha
    $('folhaFuncionario').required = false;
    $('folhaBruto').required = false;
    // custos fixos
    $('fixoDescricao').required = false;
    $('fixoValor').required = false;

    if (cat === 'Folha de pagamento') {
      pFolha.style.display = 'grid';
      $('folhaFuncionario').required = true;
      $('folhaBruto').required = true;
    } else if (cat === 'Custo fixo') {
      pFixo.style.display = 'grid';
      $('fixoDescricao').required = true;
      $('fixoValor').required = true;
    } else {
      pPadrao.style.display = 'grid';
      $('compraDescricao').required = true;
      $('compraValorProduto').required = true;
    }
  }

  // Open and close modals
  function showModal(modalId) {
    const modal = $(modalId);
    if (!modal) return;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  function hideModal(modalId) {
    const modal = $(modalId);
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  // Format YYYY-MM-DD back to Brazilian Date format
  function formatBRDate(dateStr) {
    if (!dateStr || !dateStr.includes('-')) return dateStr || '-';
    const p = dateStr.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  // Pagination Renderer Utility
  function renderPagination(targetId, filteredTotal, pagState, onPageChange) {
    const totalPages = Math.ceil(filteredTotal / pagState.limit) || 1;
    if (pagState.page > totalPages) pagState.page = totalPages;

    const el = $(targetId);
    if (!el) return;

    el.innerHTML = `
      <div class="pagination-info">Mostrando ${Math.min(filteredTotal, (pagState.page - 1) * pagState.limit + 1)} a ${Math.min(filteredTotal, pagState.page * pagState.limit)} de ${filteredTotal} registros</div>
      <div class="pagination-controls">
        <button class="btn-page" id="${targetId}_prev" ${pagState.page === 1 ? 'disabled' : ''}>Anterior</button>
        <span class="pagination-info">Página ${pagState.page} de ${totalPages}</span>
        <button class="btn-page" id="${targetId}_next" ${pagState.page === totalPages ? 'disabled' : ''}>Próxima</button>
      </div>
    `;

    $(`${targetId}_prev`).addEventListener('click', () => {
      pagState.page--;
      onPageChange();
    });
    $(`${targetId}_next`).addEventListener('click', () => {
      pagState.page++;
      onPageChange();
    });
  }

  // RENDERING FUNCTIONS FOR DATA PAGES
  
  // 1. Serviços
  function renderServicos() {
    const tbody = $('servicosTableBody');
    if (!tbody) return;

    const filtered = getFilteredServicos();
    $('servicosCounter').textContent = `${filtered.length} registros`;

    const p = state.pagination.servicos;
    const start = (p.page - 1) * p.limit;
    const pageItems = filtered.slice(start, start + p.limit);

    if (pageItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">Nenhum serviço encontrado.</td></tr>';
      renderPagination('servicosPagination', 0, p, renderServicos);
      return;
    }

    tbody.innerHTML = pageItems.map(item => `
      <tr>
        <td>${formatBRDate(item.data)}</td>
        <td>${DEPT_LABELS[item.setor] || item.setor}</td>
        <td>${item.os || '-'}</td>
        <td>${item.cliente || '-'}</td>
        <td>${item.tipoServico || 'Serviço'}</td>
        <td><span class="table-badge ${item.pagamento === 'À prazo' ? 'prazo' : 'vista'}">${item.pagamento}</span></td>
        <td>${item.qtd}</td>
        <td><b>${fmtMoney.format(item.valorTotal)}</b></td>
        <td>${item.produtivo || '-'}</td>
        <td>${item.desconto ? fmtMoney.format(item.desconto) : '-'}</td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon edit" data-id="${item.id}" title="Editar">✎</button>
            <button class="btn-icon delete" data-id="${item.id}" title="Excluir">✕</button>
          </div>
        </td>
      </tr>
    `).join('');

    renderPagination('servicosPagination', filtered.length, p, renderServicos);

    // Bind edit/delete
    tbody.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', () => openEditServico(btn.dataset.id));
    });
    tbody.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteServico(btn.dataset.id));
    });
  }

  // 2. Compras e Despesas
  function renderCompras() {
    const tbody = $('comprasTableBody');
    if (!tbody) return;

    // Filter out payroll and custos fixos
    const filtered = getFilteredCompras().filter(c => c.categoria !== 'Folha de pagamento' && c.categoria !== 'Custo fixo');
    $('comprasCounter').textContent = `${filtered.length} registros`;

    const p = state.pagination.compras;
    const start = (p.page - 1) * p.limit;
    const pageItems = filtered.slice(start, start + p.limit);

    if (pageItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Nenhuma compra encontrada.</td></tr>';
      renderPagination('comprasPagination', 0, p, renderCompras);
      return;
    }

    tbody.innerHTML = pageItems.map(item => `
      <tr>
        <td>${formatBRDate(item.data)}</td>
        <td>${DEPT_LABELS[item.setor] || item.setor}</td>
        <td>${item.categoria}</td>
        <td>${item.solicitante || '-'}</td>
        <td>${item.fornecedor || '-'}</td>
        <td>${item.descricao || '-'}</td>
        <td><span class="table-badge ${item.formaCompra === 'À prazo' ? 'prazo' : 'vista'}">${item.formaCompra}</span></td>
        <td><b>${fmtMoney.format(item.valorProduto)}</b></td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon edit" data-id="${item.id}" title="Editar">✎</button>
            <button class="btn-icon delete" data-id="${item.id}" title="Excluir">✕</button>
          </div>
        </td>
      </tr>
    `).join('');

    renderPagination('comprasPagination', filtered.length, p, renderCompras);

    // Bind edit/delete
    tbody.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', () => openEditCompra(btn.dataset.id));
    });
    tbody.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteCompra(btn.dataset.id));
    });
  }

  // 3. Folha de Pagamento
  function renderFolha() {
    const tbody = $('folhaTableBody');
    if (!tbody) return;

    // Filter ONLY payroll
    const filtered = getFilteredCompras().filter(c => c.categoria === 'Folha de pagamento');
    $('folhaCounter').textContent = `${filtered.length} colaboradores`;

    const p = state.pagination.folha;
    const start = (p.page - 1) * p.limit;
    const pageItems = filtered.slice(start, start + p.limit);

    if (pageItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhum registro de folha encontrado.</td></tr>';
      renderPagination('folhaPagination', 0, p, renderFolha);
      return;
    }

    tbody.innerHTML = pageItems.map(item => {
      // Month-year label
      const dParts = item.data ? item.data.split('-') : [];
      const label = dParts.length >= 2 ? `${MONTHS[parseInt(dParts[1], 10) - 1]}/${dParts[0]}` : item.mes;

      return `
        <tr>
          <td>${label}</td>
          <td>${DEPT_LABELS[item.setor] || item.setor}</td>
          <td>${item.funcionario || '-'}</td>
          <td>${fmtMoney.format(item.bruto || 0)}</td>
          <td>${fmtMoney.format(item.desconto || 0)}</td>
          <td><b>${fmtMoney.format(item.liquido || 0)}</b></td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon edit" data-id="${item.id}" title="Editar">✎</button>
              <button class="btn-icon delete" data-id="${item.id}" title="Excluir">✕</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    renderPagination('folhaPagination', filtered.length, p, renderFolha);

    tbody.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', () => openEditCompra(btn.dataset.id));
    });
    tbody.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteCompra(btn.dataset.id));
    });
  }

  // 4. Custos Fixos
  function renderCustosFixos() {
    const tbody = $('custosFixosTableBody');
    if (!tbody) return;

    // Filter ONLY fixed costs
    const filtered = getFilteredCompras().filter(c => c.categoria === 'Custo fixo');
    $('custosFixosCounter').textContent = `${filtered.length} registros`;

    const p = state.pagination.custosFixos;
    const start = (p.page - 1) * p.limit;
    const pageItems = filtered.slice(start, start + p.limit);

    if (pageItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum custo fixo registrado.</td></tr>';
      renderPagination('custosFixosPagination', 0, p, renderCustosFixos);
      return;
    }

    tbody.innerHTML = pageItems.map(item => {
      const dParts = item.data ? item.data.split('-') : [];
      const label = dParts.length >= 2 ? `${MONTHS[parseInt(dParts[1], 10) - 1]}/${dParts[0]}` : item.mes;

      return `
        <tr>
          <td>${label}</td>
          <td>${DEPT_LABELS[item.setor] || item.setor}</td>
          <td>${item.descricao || '-'}</td>
          <td><b>${fmtMoney.format(item.valorProduto)}</b></td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon edit" data-id="${item.id}" title="Editar">✎</button>
              <button class="btn-icon delete" data-id="${item.id}" title="Excluir">✕</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    renderPagination('custosFixosPagination', filtered.length, p, renderCustosFixos);

    tbody.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', () => openEditCompra(btn.dataset.id));
    });
    tbody.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteCompra(btn.dataset.id));
    });
  }

  // Master Render switcher
  function renderData() {
    if (state.page === 'servicos') renderServicos();
    else if (state.page === 'compras') renderCompras();
    else if (state.page === 'folha') renderFolha();
    else if (state.page === 'custosFixos') renderCustosFixos();
  }

  // DELETE ACTIONS
  function deleteServico(id) {
    if (!confirm('Deseja realmente excluir este serviço? Esta ação não pode ser desfeita.')) return;
    try {
      if (window.DataStore.deleteServico(id)) {
        toast('Serviço excluído com sucesso.');
        renderServicos();
      }
    } catch (e) {
      toast(e.message || 'Erro ao excluir.');
    }
  }

  function deleteCompra(id) {
    if (!confirm('Deseja realmente excluir este lançamento? Esta ação não pode ser desfeita.')) return;
    try {
      if (window.DataStore.deleteCompra(id)) {
        toast('Registro excluído com sucesso.');
        renderData();
      }
    } catch (e) {
      toast(e.message || 'Erro ao excluir.');
    }
  }

  // OPEN MODALS FOR ADD / CREATES
  function openAddModal() {
    const today = new Date().toISOString().split('T')[0];

    if (state.page === 'servicos') {
      $('servicoForm').reset();
      $('servicoId').value = '';
      $('servicoData').value = today;
      $('servicoModalTitle').textContent = 'Novo Lançamento de Serviço';
      
      // Prefill sector if user is non-admin
      if (!state.user.isAdmin) {
        $('servicoSetor').value = state.user.sector;
      } else {
        $('servicoSetor').value = 'Mecanica';
      }
      
      showModal('servicoModal');
    } else {
      $('compraForm').reset();
      $('compraId').value = '';
      $('compraData').value = today;
      $('compraModalTitle').textContent = 'Novo Lançamento de Compra/Despesa';

      // Prefill sector if non-admin
      if (!state.user.isAdmin) {
        $('compraSetor').value = state.user.sector;
      } else {
        $('compraSetor').value = 'Mecanica';
      }

      const catSel = $('compraCategoria');
      catSel.disabled = false;

      // Lock category depending on which page we are on
      if (state.page === 'folha') {
        catSel.value = 'Folha de pagamento';
        catSel.disabled = true;
      } else if (state.page === 'custosFixos') {
        catSel.value = 'Custo fixo';
        catSel.disabled = true;
      } else {
        // default compras
        catSel.value = 'Almoxarifado';
      }

      updateCompraCategoryPanels();
      showModal('compraModal');
    }
  }

  // OPEN EDIT FOR SERVICO
  function openEditServico(id) {
    const list = window.DataStore.getServicos();
    const item = list.find(i => i.id === id);
    if (!item) return;

    $('servicoId').value = item.id;
    $('servicoData').value = item.data || '';
    $('servicoSetor').value = item.setor || '';
    $('servicoPagamento').value = item.pagamento || 'À vista';
    $('servicoTipo').value = item.tipoServico || 'Serviços';
    $('servicoOS').value = item.os || '';
    $('servicoCliente').value = item.cliente || '';
    $('servicoDescricao').value = item.descricao || '';
    
    $('servicoQtd').value = item.qtd || 1;
    $('servicoValorUnitario').value = item.valorUnitario || 0;
    $('servicoDesconto').value = item.desconto || 0;
    $('servicoValorTotal').value = item.valorTotal || 0;
    $('servicoMaterial').value = item.material || 0;
    
    $('servicoProdutivo').value = item.produtivo || '';
    $('servicoValorProdutivo').value = item.valorProdutivo || 0;

    $('servicoModalTitle').textContent = 'Editar Lançamento de Serviço';
    showModal('servicoModal');
  }

  // OPEN EDIT FOR COMPRA/DESPESA/FOLHA/FIXO
  function openEditCompra(id) {
    const list = window.DataStore.getCompras();
    const item = list.find(i => i.id === id);
    if (!item) return;

    $('compraId').value = item.id;
    $('compraData').value = item.data || '';
    $('compraSetor').value = item.setor || '';

    const catSel = $('compraCategoria');
    catSel.value = item.categoria || 'Almoxarifado';
    catSel.disabled = false;

    // Lock depending on active page
    if (state.page === 'folha') {
      catSel.value = 'Folha de pagamento';
      catSel.disabled = true;
    } else if (state.page === 'custosFixos') {
      catSel.value = 'Custo fixo';
      catSel.disabled = true;
    }

    updateCompraCategoryPanels();

    // Populate the panels accordingly
    if (item.categoria === 'Folha de pagamento') {
      $('folhaFuncionario').value = item.funcionario || '';
      $('folhaBruto').value = item.bruto || 0;
      $('folhaDesconto').value = item.desconto || 0;
      $('folhaLiquido').value = item.liquido || 0;
    } else if (item.categoria === 'Custo fixo') {
      $('fixoDescricao').value = item.descricao || '';
      $('fixoValor').value = item.valorProduto || 0;
    } else {
      // standard compra
      $('compraForma').value = item.formaCompra || 'À vista';
      $('compraSolicitante').value = item.solicitante || '';
      $('compraFornecedor').value = item.fornecedor || '';
      $('compraPedido').value = item.numPedido || '';
      $('compraNumOS').value = item.numOS || '';
      $('compraValorOS').value = item.valorOS || 0;
      $('compraDescricao').value = item.descricao || '';
      $('compraValorProduto').value = item.valorProduto || 0;
    }

    $('compraModalTitle').textContent = 'Editar Registro';
    showModal('compraModal');
  }

  // AUTO CALCULATION EVENTS
  function initAutoCalculations() {
    // Servico forms
    const calcServico = () => {
      const qtd = parseFloat($('servicoQtd').value) || 0;
      const unit = parseFloat($('servicoValorUnitario').value) || 0;
      const desc = parseFloat($('servicoDesconto').value) || 0;
      
      const total = Math.max((qtd * unit) - desc, 0);
      $('servicoValorTotal').value = total.toFixed(2);
    };

    $('servicoQtd').addEventListener('input', calcServico);
    $('servicoValorUnitario').addEventListener('input', calcServico);
    $('servicoDesconto').addEventListener('input', calcServico);

    // Folha forms
    const calcFolha = () => {
      const bruto = parseFloat($('folhaBruto').value) || 0;
      const desc = parseFloat($('folhaDesconto').value) || 0;
      const liq = Math.max(bruto - desc, 0);
      $('folhaLiquido').value = liq.toFixed(2);
    };

    $('folhaBruto').addEventListener('input', calcFolha);
    $('folhaDesconto').addEventListener('input', calcFolha);

    // Category Selector triggers panel changes
    $('compraCategoria').addEventListener('change', updateCompraCategoryPanels);
  }

  // SUBMIT EVENTS
  function initSubmitHandlers() {
    // 1. Servicos Form
    $('servicoForm').addEventListener('submit', e => {
      e.preventDefault();
      
      const id = $('servicoId').value;
      const payload = {
        data: $('servicoData').value,
        setor: $('servicoSetor').value,
        pagamento: $('servicoPagamento').value,
        tipoServico: $('servicoTipo').value,
        os: $('servicoOS').value,
        cliente: $('servicoCliente').value,
        descricao: $('servicoDescricao').value,
        qtd: parseFloat($('servicoQtd').value) || 1,
        valorUnitario: parseFloat($('servicoValorUnitario').value) || 0,
        valorTotal: parseFloat($('servicoValorTotal').value) || 0,
        material: parseFloat($('servicoMaterial').value) || 0,
        produtivo: $('servicoProdutivo').value,
        valorProdutivo: parseFloat($('servicoValorProdutivo').value) || 0,
        desconto: parseFloat($('servicoDesconto').value) || 0
      };

      try {
        if (id) {
          window.DataStore.updateServico(id, payload);
          toast('Serviço atualizado com sucesso.');
        } else {
          window.DataStore.addServico(payload);
          toast('Serviço adicionado com sucesso.');
        }
        hideModal('servicoModal');
        renderServicos();
      } catch (err) {
        alert(err.message || 'Erro ao salvar serviço.');
      }
    });

    // 2. Compras Form
    $('compraForm').addEventListener('submit', e => {
      e.preventDefault();

      const id = $('compraId').value;
      const cat = $('compraCategoria').value;
      
      let payload = {
        data: $('compraData').value,
        setor: $('compraSetor').value,
        categoria: cat
      };

      if (cat === 'Folha de pagamento') {
        payload.funcionario = $('folhaFuncionario').value;
        payload.bruto = parseFloat($('folhaBruto').value) || 0;
        payload.desconto = parseFloat($('folhaDesconto').value) || 0;
        payload.valorProduto = parseFloat($('folhaLiquido').value) || 0; // mapped to final valorProduto
      } else if (cat === 'Custo fixo') {
        payload.descricao = $('fixoDescricao').value;
        payload.valorProduto = parseFloat($('fixoValor').value) || 0;
      } else {
        payload.formaCompra = $('compraForma').value;
        payload.solicitante = $('compraSolicitante').value;
        payload.fornecedor = $('compraFornecedor').value;
        payload.numPedido = $('compraPedido').value;
        payload.numOS = $('compraNumOS').value;
        payload.valorOS = parseFloat($('compraValorOS').value) || 0;
        payload.descricao = $('compraDescricao').value;
        payload.valorProduto = parseFloat($('compraValorProduto').value) || 0;
      }

      try {
        if (id) {
          window.DataStore.updateCompra(id, payload);
          toast('Lançamento atualizado.');
        } else {
          window.DataStore.addCompra(payload);
          toast('Lançamento registrado.');
        }
        hideModal('compraModal');
        renderData();
      } catch (err) {
        alert(err.message || 'Erro ao registrar compra.');
      }
    });
  }

  // Navigation handlers
  function initNavigation() {
    document.querySelectorAll('#cadastroNav .nav-link').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#cadastroNav .nav-link').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        state.page = btn.dataset.page;
        
        // Hide all page sections, show active
        document.querySelectorAll('.page').forEach(p => {
          p.classList.toggle('active', p.dataset.pageSection === state.page);
        });

        // Reset pagination page and render
        if (state.pagination[state.page]) {
          state.pagination[state.page].page = 1;
        }
        
        renderData();
      });
    });

    // Modal click buttons
    $('btnNewEntry').addEventListener('click', openAddModal);
    
    // Servico modal close
    $('btnCancelServico').addEventListener('click', () => hideModal('servicoModal'));
    $('btnCancelServico2').addEventListener('click', () => hideModal('servicoModal'));
    $('servicoModalBackdrop').addEventListener('click', () => hideModal('servicoModal'));

    // Compra modal close
    $('btnCancelCompra').addEventListener('click', () => hideModal('compraModal'));
    $('btnCancelCompra2').addEventListener('click', () => hideModal('compraModal'));
    $('compraModalBackdrop').addEventListener('click', () => hideModal('compraModal'));

    // Filter listeners
    $('monthFilter').addEventListener('change', e => {
      state.filters.mesNum = e.target.value;
      renderData();
    });

    $('deptFilter').addEventListener('change', e => {
      state.filters.setor = e.target.value;
      renderData();
    });

    $('searchInput').addEventListener('input', e => {
      clearTimeout(window._searchDebounce);
      window._searchDebounce = setTimeout(() => {
        state.filters.query = e.target.value;
        renderData();
      }, 200);
    });

    // JSON Backup imports/exports
    $('btnExportJson').addEventListener('click', () => {
      window.ExportUtils.exportJSON();
      toast('Backup JSON gerado com sucesso.');
    });

    $('btnExportXlsx').addEventListener('click', () => {
      window.ExportUtils.exportXLSX();
      toast('Planilha exportada com sucesso.');
    });

    const fileInput = $('jsonFileInput');
    $('btnImportJson').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        window.ExportUtils.importJSON(fileInput.files[0], (err, success) => {
          if (success) {
            toast('Lançamentos importados com sucesso.');
            renderData();
          } else {
            alert(err || 'Erro na importação.');
          }
          fileInput.value = '';
        });
      }
    });
  }

  // --- EXCEL COPY & PASTE IMPORT FEATURE ---
  let parsedExcelItems = [];
  let parsedExcelType = ''; // 'servicos' or 'compras'

  function cleanExcelCell(val) {
    let s = String(val ?? '').trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      s = s.slice(1, -1);
    }
    return s;
  }

  function parseExcelNumber(val) {
    let s = cleanExcelCell(val);
    if (!s || s === '-') return 0;
    s = s.replace(/R\$/gi, '').replace(/\s/g, '');
    if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function parseExcelDate(val) {
    const s = cleanExcelCell(val);
    if (!s) return '';
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) {
      const day = m[1].padStart(2, '0');
      const month = m[2].padStart(2, '0');
      const year = m[3];
      return `${year}-${month}-${day}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      return s.slice(0, 10);
    }
    return s;
  }

  function handleExcelPasteInput() {
    const text = $('pasteExcelTextarea').value;
    const forceType = $('pasteExcelType').value;
    const previewEl = $('pasteExcelPreview');
    const confirmBtn = $('btnConfirmPasteImport');
    
    parsedExcelItems = [];
    parsedExcelType = '';
    
    if (!text.trim()) {
      previewEl.innerHTML = '<span style="color: var(--muted);">Cole os dados para ver o resumo da importação.</span>';
      confirmBtn.disabled = true;
      return;
    }

    const lines = text.split(/\r?\n/).map(l => l.split('\t')).filter(cols => cols.length > 1 || (cols.length === 1 && cols[0].trim() !== ''));
    if (lines.length === 0) {
      previewEl.innerHTML = '<span style="color: var(--red);">Nenhum dado válido encontrado.</span>';
      confirmBtn.disabled = true;
      return;
    }

    // Determine type: check first non-header row column count
    let startIndex = 0;
    
    // Check if first line is header
    const firstRowHasHeaders = lines[0].some(cell => {
      const c = cleanExcelCell(cell).toLowerCase();
      return ['data', 'mês', 'mes', 'setor', 'cliente', 'categoria', 'valor', 'total', 'pagamento'].includes(c);
    });
    
    if (firstRowHasHeaders) {
      startIndex = 1;
    }

    if (lines.length <= startIndex) {
      previewEl.innerHTML = '<span style="color: var(--red);">Apenas cabeçalho detectado. Cole também as linhas de dados.</span>';
      confirmBtn.disabled = true;
      return;
    }

    // Inspect columns count of the first data line to auto-detect
    const testColsCount = lines[startIndex].length;
    let detectedType = '';
    if (forceType === 'auto') {
      if (testColsCount >= 14 && testColsCount <= 18) {
        detectedType = 'servicos';
      } else if (testColsCount >= 10 && testColsCount <= 13) {
        detectedType = 'compras';
      } else {
        previewEl.innerHTML = `<span style="color: var(--red);">Não conseguimos identificar o tipo de dados pelas colunas (${testColsCount} colunas detectadas).<br/>Copie a linha inteira da planilha de Serviços (16 colunas) ou de Compras (12 colunas), ou selecione o tipo de importação acima.</span>`;
        confirmBtn.disabled = true;
        return;
      }
    } else {
      detectedType = forceType;
    }

    parsedExcelType = detectedType;

    // Parse rows
    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i];
      if (cols.length === 1 && cols[0].trim() === '') continue; // skip blank rows

      // Pad columns to prevent undefined checks
      while (cols.length < (detectedType === 'servicos' ? 16 : 12)) {
        cols.push('');
      }

      if (detectedType === 'servicos') {
        const totalVal = parseExcelNumber(cols[10]);
        const unitVal = parseExcelNumber(cols[9]);
        const qtdVal = parseExcelNumber(cols[7]) || 1;
        
        parsedExcelItems.push({
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
        // compras
        parsedExcelItems.push({
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

    if (parsedExcelItems.length === 0) {
      previewEl.innerHTML = '<span style="color: var(--red);">Nenhuma linha de dados válida para importar.</span>';
      confirmBtn.disabled = true;
      return;
    }

    // Success summary
    const typeLabel = detectedType === 'servicos' ? 'Serviços' : 'Compras e Despesas';
    previewEl.innerHTML = `
      <div style="color: var(--green); text-align: left;">
        <strong>✔ Formato Identificado:</strong> Lançamentos de ${typeLabel}<br/>
        <strong>📊 Registros Encontrados:</strong> ${parsedExcelItems.length} linhas de dados prontas.<br/>
        <small style="color: var(--muted); margin-top: 4px; display: block;">Clique no botão abaixo para confirmar e gravar.</small>
      </div>
    `;
    confirmBtn.disabled = false;
  }

  function initExcelPaste() {
    $('btnPasteExcel')?.addEventListener('click', () => {
      $('pasteExcelTextarea').value = '';
      $('pasteExcelType').value = 'auto';
      $('pasteExcelPreview').innerHTML = '<span style="color: var(--muted);">Cole os dados para ver o resumo da importação.</span>';
      $('btnConfirmPasteImport').disabled = true;
      showModal('pasteExcelModal');
      setTimeout(() => $('pasteExcelTextarea').focus(), 150);
    });

    $('btnCancelPasteExcel')?.addEventListener('click', () => hideModal('pasteExcelModal'));
    $('btnCancelPasteExcel2')?.addEventListener('click', () => hideModal('pasteExcelModal'));
    $('pasteExcelModalBackdrop')?.addEventListener('click', () => hideModal('pasteExcelModal'));

    $('pasteExcelTextarea')?.addEventListener('input', handleExcelPasteInput);
    $('pasteExcelType')?.addEventListener('change', handleExcelPasteInput);

    $('btnConfirmPasteImport')?.addEventListener('click', () => {
      if (parsedExcelItems.length === 0 || !parsedExcelType) return;
      
      let importedCount = 0;
      try {
        parsedExcelItems.forEach(item => {
          // Security lock: Override sector for non-admin users
          if (!state.user.isAdmin) {
            item.setor = state.user.sector;
          }
          
          if (parsedExcelType === 'servicos') {
            window.DataStore.addServico(item);
          } else {
            window.DataStore.addCompra(item);
          }
          importedCount++;
        });

        toast(`${importedCount} lançamentos importados com sucesso.`);
        hideModal('pasteExcelModal');
        renderData();
      } catch (err) {
        alert(err.message || 'Erro ao realizar a importação em lote.');
      }
    });
  }

  // Setup initial load
  window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSecurity();
    populateFilters();
    initNavigation();
    initAutoCalculations();
    initSubmitHandlers();
    initExcelPaste();
    
    // Initial render of default page
    renderData();
  });
})();
