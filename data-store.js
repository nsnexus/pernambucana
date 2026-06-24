/**
 * Pernambucana Centro de Manutenção - Data Layer
 * data-store.js
 * 
 * Provides CRUD for raw data and generates the aggregated payload for the dashboard.
 */

(function() {
  const STORAGE_SERVICOS = 'pernambucana.data.servicos.v1';
  const STORAGE_COMPRAS = 'pernambucana.data.compras.v1';
  const AUTH_EMAIL_KEY = 'pernambucanaUserEmail';
  const AUTH_KEY = 'pernambucanaFinanceAuth';

  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const DEPARTMENTS = ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria', 'AltoGeral'];
  const DEFAULT_DEPT_LABEL = {
    Mecanica: 'Mecânica',
    'Peças': 'Peças',
    Retifica: 'Retífica',
    Torneadora: 'Torneadora',
    Caldeiraria: 'Caldeiraria',
    AltoGeral: 'Alto Geral'
  };

  // Helper: UUID v4 generator (simple fallback for client-side)
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Get current user auth info
  function getUserAuth() {
    const email = sessionStorage.getItem(AUTH_EMAIL_KEY) || '';
    const token = sessionStorage.getItem(AUTH_KEY);
    if (token !== 'ok') {
      return { email: '', sector: '', isAdmin: false };
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || cleanEmail === 'nsnexus' || cleanEmail.includes('admin') || cleanEmail.includes('nsnexus')) {
      return { email: cleanEmail || 'nsnexus', sector: 'all', isAdmin: true };
    }
    
    let sector = 'all';
    if (cleanEmail.includes('retif')) sector = 'Retifica';
    else if (cleanEmail.includes('mecan')) sector = 'Mecanica';
    else if (cleanEmail.includes('peca')) sector = 'Peças';
    else if (cleanEmail.includes('torne')) sector = 'Torneadora';
    else if (cleanEmail.includes('calde')) sector = 'Caldeiraria';
    
    return {
      email: cleanEmail,
      sector: sector,
      isAdmin: sector === 'all'
    };
  }

  // Helper: Trigger event when data changes
  function notifyDataChange() {
    const event = new CustomEvent('dataStoreChanged');
    window.dispatchEvent(event);
  }

  // Low level reads
  function getRawServicos() {
    try {
      const data = localStorage.getItem(STORAGE_SERVICOS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading servicos from storage', e);
      return [];
    }
  }

  function getRawCompras() {
    try {
      const data = localStorage.getItem(STORAGE_COMPRAS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading compras from storage', e);
      return [];
    }
  }

  // Low level writes
  function saveRawServicos(list) {
    localStorage.setItem(STORAGE_SERVICOS, JSON.stringify(list));
    notifyDataChange();
  }

  function saveRawCompras(list) {
    localStorage.setItem(STORAGE_COMPRAS, JSON.stringify(list));
    notifyDataChange();
  }

  // Utility to parse dates and return month/month number
  function getDateInfo(dateStr) {
    // Expected dateStr: YYYY-MM-DD
    if (!dateStr || dateStr.length < 7) {
      return { mesNum: 1, mesName: 'Janeiro' };
    }
    const parts = dateStr.split('-');
    const mesNum = parseInt(parts[1], 10);
    const mesName = MONTHS[mesNum - 1] || 'Janeiro';
    return { mesNum, mesName };
  }

  // Normalize sector names to standard database ones
  function normalizeSector(sec) {
    const s = String(sec || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (s.includes('retif')) return 'Retifica';
    if (s.includes('mecan') || s === 'm') return 'Mecanica';
    if (s.includes('peca') || s === 'p') return 'Peças';
    if (s.includes('torne') || s === 't') return 'Torneadora';
    if (s.includes('calde') || s === 'c') return 'Caldeiraria';
    if (s.includes('alto') || s.includes('auto') || s === 'ag') return 'AltoGeral';
    return sec || 'AltoGeral';
  }

  // Public API
  const DataStore = {
    getUser: getUserAuth,

    hasData: function() {
      const s = getRawServicos();
      const c = getRawCompras();
      return s.length > 0 || c.length > 0;
    },

    clearAll: function() {
      localStorage.removeItem(STORAGE_SERVICOS);
      localStorage.removeItem(STORAGE_COMPRAS);
      notifyDataChange();
    },

    // CRUD Servicos
    getServicos: function() {
      const auth = getUserAuth();
      const raw = getRawServicos();
      if (auth.isAdmin) return raw;
      return raw.filter(item => normalizeSector(item.setor) === auth.sector);
    },

    addServico: function(item) {
      const list = getRawServicos();
      const auth = getUserAuth();
      const dateInfo = getDateInfo(item.data);
      
      const newItem = {
        id: generateUUID(),
        data: item.data,
        mes: dateInfo.mesName,
        mesNum: dateInfo.mesNum,
        setor: normalizeSector(item.setor || auth.sector),
        pagamento: item.pagamento || 'À vista',
        codigoServico: item.codigoServico || '',
        cliente: item.cliente || '',
        descricao: item.descricao || '',
        qtd: parseFloat(item.qtd) || 1,
        os: item.os || '',
        valorUnitario: parseFloat(item.valorUnitario) || 0,
        valorTotal: parseFloat(item.valorTotal) || 0,
        produtivo: item.produtivo || '',
        valorProdutivo: parseFloat(item.valorProdutivo) || 0,
        desconto: parseFloat(item.desconto) || 0,
        tipoServico: item.tipoServico || 'Serviços',
        material: parseFloat(item.material) || 0,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        criadoPor: auth.email
      };
      
      list.unshift(newItem);
      saveRawServicos(list);
      return newItem;
    },

    updateServico: function(id, data) {
      const list = getRawServicos();
      const idx = list.findIndex(i => i.id === id);
      if (idx === -1) return null;

      const auth = getUserAuth();
      // Access check
      if (!auth.isAdmin && normalizeSector(list[idx].setor) !== auth.sector) {
        throw new Error('Sem permissão para alterar este registro.');
      }

      const dateInfo = data.data ? getDateInfo(data.data) : { mesNum: list[idx].mesNum, mesName: list[idx].mes };

      list[idx] = {
        ...list[idx],
        ...data,
        mes: dateInfo.mesName,
        mesNum: dateInfo.mesNum,
        setor: normalizeSector(data.setor || list[idx].setor),
        qtd: data.qtd !== undefined ? parseFloat(data.qtd) || 0 : list[idx].qtd,
        valorUnitario: data.valorUnitario !== undefined ? parseFloat(data.valorUnitario) || 0 : list[idx].valorUnitario,
        valorTotal: data.valorTotal !== undefined ? parseFloat(data.valorTotal) || 0 : list[idx].valorTotal,
        valorProdutivo: data.valorProdutivo !== undefined ? parseFloat(data.valorProdutivo) || 0 : list[idx].valorProdutivo,
        desconto: data.desconto !== undefined ? parseFloat(data.desconto) || 0 : list[idx].desconto,
        material: data.material !== undefined ? parseFloat(data.material) || 0 : list[idx].material,
        atualizadoEm: new Date().toISOString()
      };

      saveRawServicos(list);
      return list[idx];
    },

    deleteServico: function(id) {
      const list = getRawServicos();
      const idx = list.findIndex(i => i.id === id);
      if (idx === -1) return false;

      const auth = getUserAuth();
      if (!auth.isAdmin && normalizeSector(list[idx].setor) !== auth.sector) {
        throw new Error('Sem permissão para excluir este registro.');
      }

      list.splice(idx, 1);
      saveRawServicos(list);
      return true;
    },

    // CRUD Compras
    getCompras: function() {
      const auth = getUserAuth();
      const raw = getRawCompras();
      if (auth.isAdmin) return raw;
      return raw.filter(item => normalizeSector(item.setor) === auth.sector);
    },

    addCompra: function(item) {
      const list = getRawCompras();
      const auth = getUserAuth();
      const dateInfo = getDateInfo(item.data);
      
      const isFolha = item.categoria === 'Folha de pagamento';
      const bruto = isFolha ? parseFloat(item.bruto) || 0 : 0;
      const desconto = isFolha ? parseFloat(item.desconto) || 0 : 0;
      const liquido = isFolha ? (bruto - desconto) : 0;

      const newItem = {
        id: generateUUID(),
        data: item.data,
        mes: dateInfo.mesName,
        mesNum: dateInfo.mesNum,
        setor: normalizeSector(item.setor || auth.sector),
        formaCompra: item.formaCompra || 'À vista',
        solicitante: item.solicitante || '',
        descricao: item.descricao || '',
        numOS: item.numOS || '',
        valorOS: parseFloat(item.valorOS) || 0,
        valorProduto: parseFloat(isFolha ? liquido : item.valorProduto) || 0,
        fornecedor: item.fornecedor || '',
        numPedido: item.numPedido || '',
        categoria: item.categoria || 'Almoxarifado',
        // Folha de pagamento fields
        funcionario: isFolha ? item.funcionario || '' : '',
        bruto: bruto,
        desconto: desconto,
        liquido: liquido,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        criadoPor: auth.email
      };
      
      list.unshift(newItem);
      saveRawCompras(list);
      return newItem;
    },

    updateCompra: function(id, data) {
      const list = getRawCompras();
      const idx = list.findIndex(i => i.id === id);
      if (idx === -1) return null;

      const auth = getUserAuth();
      if (!auth.isAdmin && normalizeSector(list[idx].setor) !== auth.sector) {
        throw new Error('Sem permissão para alterar este registro.');
      }

      const dateInfo = data.data ? getDateInfo(data.data) : { mesNum: list[idx].mesNum, mesName: list[idx].mes };
      const isFolha = (data.categoria || list[idx].categoria) === 'Folha de pagamento';
      
      let bruto = 0, desconto = 0, liquido = 0;
      if (isFolha) {
        bruto = data.bruto !== undefined ? parseFloat(data.bruto) || 0 : list[idx].bruto || 0;
        desconto = data.desconto !== undefined ? parseFloat(data.desconto) || 0 : list[idx].desconto || 0;
        liquido = bruto - desconto;
      }

      list[idx] = {
        ...list[idx],
        ...data,
        mes: dateInfo.mesName,
        mesNum: dateInfo.mesNum,
        setor: normalizeSector(data.setor || list[idx].setor),
        valorOS: data.valorOS !== undefined ? parseFloat(data.valorOS) || 0 : list[idx].valorOS,
        valorProduto: data.valorProduto !== undefined ? parseFloat(isFolha ? liquido : data.valorProduto) || 0 : (isFolha ? liquido : list[idx].valorProduto),
        funcionario: isFolha ? (data.funcionario !== undefined ? data.funcionario : list[idx].funcionario) : '',
        bruto: isFolha ? bruto : 0,
        desconto: isFolha ? desconto : 0,
        liquido: isFolha ? liquido : 0,
        atualizadoEm: new Date().toISOString()
      };

      saveRawCompras(list);
      return list[idx];
    },

    deleteCompra: function(id) {
      const list = getRawCompras();
      const idx = list.findIndex(i => i.id === id);
      if (idx === -1) return false;

      const auth = getUserAuth();
      if (!auth.isAdmin && normalizeSector(list[idx].setor) !== auth.sector) {
        throw new Error('Sem permissão para excluir este registro.');
      }

      list.splice(idx, 1);
      saveRawCompras(list);
      return true;
    },

    // Import external lists directly (for JSON load/restores)
    importRawData: function(servicosList, comprasList) {
      if (Array.isArray(servicosList)) {
        saveRawServicos(servicosList);
      }
      if (Array.isArray(comprasList)) {
        saveRawCompras(comprasList);
      }
    },

    // Build the FINANCE_DATA structure consumed by the dashboard
    buildFinancePayload: function() {
      const rawServicos = getRawServicos();
      const rawCompras = getRawCompras();

      const payload = {
        meta: {},
        resumo: [],
        servicos: [],
        despesas: [],
        folha: [],
        produtivos: [],
        custosFixos: []
      };

      // 1. Group data by Month + Sector combinations to construct the summary "resumo"
      const groups = {}; // key: Sector|MonthNum

      // Process Servicos for resumen
      rawServicos.forEach(s => {
        const sec = normalizeSector(s.setor);
        const mNum = parseInt(s.mesNum, 10);
        if (!sec || !mNum) return;

        const key = `${sec}|${mNum}`;
        if (!groups[key]) {
          groups[key] = {
            codigo: '',
            mesNum: mNum,
            mes: s.mes || MONTHS[mNum - 1],
            departamento: sec,
            receitaPrazo: 0,
            receitaVista: 0,
            comprasPrazo: 0,
            comprasMes: 0,
            saidasVista: 0,
            folhaPagamento: 0,
            custoFixo: 0,
            imposto: 0,
            alimentacao: 0,
            materialOS: 0
          };
        }

        const isPrazo = String(s.pagamento).toLowerCase().includes('prazo');
        const val = parseFloat(s.valorTotal) || 0;
        if (isPrazo) {
          groups[key].receitaPrazo += val;
        } else {
          groups[key].receitaVista += val;
        }
      });

      // Process Compras for resumen
      rawCompras.forEach(c => {
        const sec = normalizeSector(c.setor);
        const mNum = parseInt(c.mesNum, 10);
        if (!sec || !mNum) return;

        const key = `${sec}|${mNum}`;
        if (!groups[key]) {
          groups[key] = {
            codigo: '',
            mesNum: mNum,
            mes: c.mes || MONTHS[mNum - 1],
            departamento: sec,
            receitaPrazo: 0,
            receitaVista: 0,
            comprasPrazo: 0,
            comprasMes: 0,
            saidasVista: 0,
            folhaPagamento: 0,
            custoFixo: 0,
            imposto: 0,
            alimentacao: 0,
            materialOS: 0
          };
        }

        const cat = String(c.categoria).trim();
        const val = parseFloat(c.valorProduto) || 0;

        if (cat === 'Folha de pagamento') {
          groups[key].folhaPagamento += parseFloat(c.liquido) || val;
        } else if (cat === 'Custo fixo') {
          groups[key].custoFixo += val;
        } else if (cat === 'Alimentação') {
          groups[key].alimentacao += val;
        } else if (cat === 'Material OS') {
          groups[key].materialOS += val;
        } else if (cat === 'Imposto') {
          groups[key].imposto += val;
        } else if (cat === 'Compras do mês') {
          groups[key].comprasMes += val;
        } else if (cat === 'Compras a prazo') {
          groups[key].comprasPrazo += val;
        } else if (cat === 'Saídas à vista') {
          groups[key].saidasVista += val;
        } else {
          // If a general category, look at payment form
          const isPrazo = String(c.formaCompra).toLowerCase().includes('prazo');
          if (isPrazo) {
            groups[key].comprasPrazo += val;
          } else {
            groups[key].saidasVista += val;
          }
        }
      });

      // Finalize Resumo rows
      Object.keys(groups).forEach(key => {
        const r = groups[key];
        const prefix = (r.departamento.charAt(0) || 'A').toUpperCase();
        r.codigo = `${prefix}${r.mesNum}`;
        r.entradas = r.receitaPrazo + r.receitaVista;
        r.retiradas = r.comprasPrazo + r.saidasVista + r.folhaPagamento + r.custoFixo + r.imposto + r.alimentacao;
        r.resultado = r.entradas - r.retiradas;
        payload.resumo.push(r);
      });

      // 2. Build Services subcollection (grouped by Sector, Month, Service Type, Payment Condition)
      const serviceGroups = {};
      rawServicos.forEach(s => {
        const sec = normalizeSector(s.setor);
        const mNum = parseInt(s.mesNum, 10);
        const type = s.tipoServico || 'Serviços';
        const cond = s.pagamento || 'À vista';
        if (!sec || !mNum) return;

        const key = `${sec}|${mNum}|${type}|${cond}`;
        if (!serviceGroups[key]) {
          const prefix = (sec.charAt(0) || 'A').toUpperCase();
          serviceGroups[key] = {
            codigo: `${prefix}${mNum}`,
            mesNum: mNum,
            mes: s.mes || MONTHS[mNum - 1],
            departamento: sec,
            servico: type,
            condicao: cond,
            valor: 0
          };
        }
        serviceGroups[key].valor += parseFloat(s.valorTotal) || 0;
      });
      payload.servicos = Object.values(serviceGroups).filter(x => x.valor > 0);

      // 3. Build Despesas subcollection (grouped by Sector, Month, and Category)
      const despesasGroups = {};
      rawCompras.forEach(c => {
        const sec = normalizeSector(c.setor);
        const mNum = parseInt(c.mesNum, 10);
        if (!sec || !mNum) return;

        let cat = String(c.categoria).trim();
        const val = parseFloat(c.valorProduto) || 0;

        // Normalize aggregated category names
        let mappedCat = cat;
        let classe = 'Retirada';
        let entraRes = true;

        if (cat === 'Folha de pagamento') {
          mappedCat = 'Folha de pagamento';
        } else if (cat === 'Custo fixo') {
          mappedCat = 'Custo fixo';
        } else if (cat === 'Alimentação') {
          mappedCat = 'Alimentação';
        } else if (cat === 'Material OS') {
          mappedCat = 'Material OS';
          classe = 'Compra complementar';
          entraRes = false;
        } else if (cat === 'Imposto') {
          mappedCat = 'Imposto';
        } else if (cat === 'Compras do mês') {
          mappedCat = 'Compras do mês';
          classe = 'Compra complementar';
          entraRes = false;
        } else if (cat === 'Compras a prazo') {
          mappedCat = 'Compras a prazo';
        } else if (cat === 'Saídas à vista') {
          mappedCat = 'Saídas à vista';
        } else {
          // General categories map based on payment form
          const isPrazo = String(c.formaCompra).toLowerCase().includes('prazo');
          mappedCat = isPrazo ? 'Compras a prazo' : 'Saídas à vista';
        }

        const key = `${sec}|${mNum}|${mappedCat}`;
        if (!despesasGroups[key]) {
          const prefix = (sec.charAt(0) || 'A').toUpperCase();
          despesasGroups[key] = {
            codigo: `${prefix}${mNum}`,
            mesNum: mNum,
            mes: c.mes || MONTHS[mNum - 1],
            departamento: sec,
            categoria: mappedCat,
            valor: 0,
            classe: classe,
            entraResultado: entraRes
          };
        }
        despesasGroups[key].valor += val;
      });
      payload.despesas = Object.values(despesasGroups).filter(x => x.valor > 0);

      // 4. Build Folha subcollection (flat mapped from Folha de pagamento category purchases)
      rawCompras.filter(c => c.categoria === 'Folha de pagamento').forEach(c => {
        const sec = normalizeSector(c.setor);
        const mNum = parseInt(c.mesNum, 10);
        const prefix = (sec.charAt(0) || 'A').toUpperCase();

        payload.folha.push({
          codigo: `${prefix}${mNum}`,
          mesNum: mNum,
          mes: c.mes || MONTHS[mNum - 1],
          departamento: sec,
          nome: c.funcionario || c.solicitante || 'Funcionário não identificado',
          bruto: parseFloat(c.bruto) || 0,
          desconto: parseFloat(c.desconto) || 0,
          liquido: parseFloat(c.liquido) || parseFloat(c.valorProduto) || 0
        });
      });

      // 5. Build Produtivos subcollection (grouped by Sector, Month, and Productive Employee Name)
      const productiveGroups = {};
      rawServicos.forEach(s => {
        const sec = normalizeSector(s.setor);
        const mNum = parseInt(s.mesNum, 10);
        const name = String(s.produtivo || '').trim();
        if (!sec || !mNum || !name) return;

        const key = `${sec}|${mNum}|${name}`;
        if (!productiveGroups[key]) {
          const prefix = (sec.charAt(0) || 'A').toUpperCase();
          productiveGroups[key] = {
            codigo: `${prefix}${mNum}`,
            mesNum: mNum,
            mes: s.mes || MONTHS[mNum - 1],
            departamento: sec,
            nome: name,
            prazo: 0,
            vista: 0,
            total: 0
          };
        }

        const isPrazo = String(s.pagamento).toLowerCase().includes('prazo');
        const val = parseFloat(s.valorProdutivo) || parseFloat(s.valorTotal) || 0;

        if (isPrazo) {
          productiveGroups[key].prazo += val;
        } else {
          productiveGroups[key].vista += val;
        }
        productiveGroups[key].total += val;
      });
      payload.produtivos = Object.values(productiveGroups);

      // 6. Build custosFixos subcollection (grouped by Sector, Month)
      const custosFixosGroups = {};
      rawCompras.filter(c => c.categoria === 'Custo fixo').forEach(c => {
        const sec = normalizeSector(c.setor);
        const mNum = parseInt(c.mesNum, 10);
        if (!sec || !mNum) return;

        const key = `${sec}|${mNum}`;
        if (!custosFixosGroups[key]) {
          const prefix = (sec.charAt(0) || 'A').toUpperCase();
          // Note: in original data.js, departamento labels had accents like "Retífica" in costs fixos, 
          // but we can normalize and let the UI pretty-print them.
          custosFixosGroups[key] = {
            codigo: `${prefix}${mNum}`,
            mesNum: mNum,
            mes: c.mes || MONTHS[mNum - 1],
            departamento: sec,
            valor: 0
          };
        }
        custosFixosGroups[key].valor += parseFloat(c.valorProduto) || 0;
      });
      payload.custosFixos = Object.values(custosFixosGroups);

      // 7. General Metadata
      const allDepts = Array.from(new Set(payload.resumo.map(r => r.departamento)));
      const extraDepts = allDepts.filter(d => !DEPARTMENTS.includes(d));
      const sortedMesNums = Array.from(new Set(payload.resumo.map(r => r.mesNum))).sort((a, b) => a - b);

      payload.meta = {
        geradoEm: new Date().toISOString(),
        departamentos: DEPARTMENTS.concat(extraDepts),
        departamentosLabel: DEFAULT_DEPT_LABEL,
        meses: sortedMesNums.map(n => MONTHS[n - 1] || String(n)),
        totalEntradas: payload.resumo.reduce((sum, r) => sum + r.entradas, 0),
        totalRetiradas: payload.resumo.reduce((sum, r) => sum + r.retiradas, 0),
        resultado: payload.resumo.reduce((sum, r) => sum + r.resultado, 0),
        totalVista: payload.resumo.reduce((sum, r) => sum + r.receitaVista, 0),
        totalPrazo: payload.resumo.reduce((sum, r) => sum + r.receitaPrazo, 0)
      };

      return payload;
    }
  };

  // Export globally
  window.DataStore = DataStore;
})();
