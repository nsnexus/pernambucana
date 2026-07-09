import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, useAuth } from './AuthContext';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

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

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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

function getDateInfo(dateStr) {
  if (!dateStr || dateStr.length < 7) {
    return { mesNum: 1, mesName: 'Janeiro' };
  }
  const parts = dateStr.split('-');
  const mesNum = parseInt(parts[1], 10);
  const mesName = MONTHS[mesNum - 1] || 'Janeiro';
  return { mesNum, mesName };
}

function addDays(dateStr, days) {
  let parsedDate;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    parsedDate = new Date(parts[2], parts[1] - 1, parts[0], 12, 0, 0);
  } else {
    parsedDate = new Date(dateStr + 'T12:00:00');
  }
  if (isNaN(parsedDate.getTime())) {
    parsedDate = new Date();
  }
  parsedDate.setDate(parsedDate.getDate() + days);
  return parsedDate.toISOString().split('T')[0];
}

export const DataProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [servicos, setServicos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [boletos, setBoletos] = useState([]);
  const [recebiveis, setRecebiveis] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubServs = () => {};
    let unsubComps = () => {};
    let unsubBols = () => {};
    let unsubRecs = () => {};

    let loadFlags = { s: false, c: false, b: false, r: false };
    const checkLoaded = () => {
      if (loadFlags.s && loadFlags.c && loadFlags.b && loadFlags.r) setLoading(false);
    };

    if (db) {
      unsubServs = onSnapshot(collection(db, 'servicos'), (snap) => {
        const list = [];
        snap.forEach(d => list.push(d.data()));
        list.sort((a, b) => new Date(b.criadoEm || b.data) - new Date(a.criadoEm || a.data));
        setServicos(list);
        loadFlags.s = true;
        checkLoaded();
      }, err => { console.error("Erro servicos:", err); loadFlags.s = true; checkLoaded(); });

      unsubComps = onSnapshot(collection(db, 'compras'), (snap) => {
        const list = [];
        snap.forEach(d => list.push(d.data()));
        list.sort((a, b) => new Date(b.criadoEm || b.data) - new Date(a.criadoEm || a.data));
        setCompras(list);
        loadFlags.c = true;
        checkLoaded();
      }, err => { console.error("Erro compras:", err); loadFlags.c = true; checkLoaded(); });

      unsubBols = onSnapshot(collection(db, 'p_boletos'), (snap) => {
        const list = [];
        snap.forEach(d => list.push(d.data()));
        list.sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));
        setBoletos(list);
        loadFlags.b = true;
        checkLoaded();
      }, err => { console.error("Erro boletos:", err); loadFlags.b = true; checkLoaded(); });

      unsubRecs = onSnapshot(collection(db, 'p_recebiveis'), (snap) => {
        const list = [];
        snap.forEach(d => list.push(d.data()));
        list.sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));
        setRecebiveis(list);
        loadFlags.r = true;
        checkLoaded();
      }, err => { console.error("Erro recebiveis:", err); loadFlags.r = true; checkLoaded(); });
    } else {
      setLoading(false);
    }

    return () => {
      unsubServs();
      unsubComps();
      unsubBols();
      unsubRecs();
    };
  }, []);

  // Seeding
  useEffect(() => {
    if (!loading && servicos.length === 0 && compras.length === 0 && db) {
      console.log("Firestore está vazio. Iniciando seeding de demonstração...");
      const defaultData = window.FINANCE_DATA || {};
      
      // Seed services
      if (Array.isArray(defaultData.servicos)) {
        defaultData.servicos.forEach(async (s) => {
          const id = generateUUID();
          const docData = {
            id,
            data: `2026-${String(s.mesNum).padStart(2, '0')}-01`,
            mes: s.mes,
            mesNum: s.mesNum,
            setor: s.departamento,
            pagamento: s.condicao || 'À vista',
            codigoServico: s.codigo,
            cliente: 'Importação Padrão',
            descricao: `Serviço de ${s.servico}`,
            qtd: 1,
            os: '',
            valorUnitario: s.valor,
            valorTotal: s.valor,
            produtivo: '',
            valorProdutivo: 0,
            desconto: 0,
            tipoServico: s.servico,
            material: 0,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
            criadoPor: 'sistema@pernambucana.com.br'
          };
          await setDoc(doc(db, 'servicos', id), docData);
        });
      }

      // Seed expenses
      if (Array.isArray(defaultData.despesas)) {
        defaultData.despesas.forEach(async (d) => {
          const id = generateUUID();
          const docData = {
            id,
            data: `2026-${String(d.mesNum).padStart(2, '0')}-01`,
            mes: d.mes,
            mesNum: d.mesNum,
            setor: d.departamento,
            formaCompra: d.categoria.includes('prazo') ? 'À prazo' : 'À vista',
            solicitante: 'Sistema',
            descricao: `Despesa: ${d.categoria}`,
            numOS: '',
            valorOS: 0,
            valorProduto: d.valor,
            fornecedor: 'Importação Padrão',
            numPedido: '',
            categoria: d.categoria,
            funcionario: '',
            bruto: 0,
            desconto: 0,
            liquido: 0,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
            criadoPor: 'sistema@pernambucana.com.br'
          };
          await setDoc(doc(db, 'compras', id), docData);
        });
      }

      // Seed folha
      if (Array.isArray(defaultData.folha)) {
        defaultData.folha.forEach(async (f) => {
          const id = generateUUID();
          const docData = {
            id,
            data: `2026-${String(f.mesNum).padStart(2, '0')}-01`,
            mes: f.mes,
            mesNum: f.mesNum,
            setor: f.departamento,
            formaCompra: 'À vista',
            solicitante: 'Recursos Humanos',
            descricao: `Folha de pagamento: ${f.nome}`,
            numOS: '',
            valorOS: 0,
            valorProduto: f.liquido,
            fornecedor: '',
            numPedido: '',
            categoria: 'Folha de pagamento',
            funcionario: f.nome,
            bruto: f.bruto,
            desconto: f.desconto,
            liquido: f.liquido,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
            criadoPor: 'sistema@pernambucana.com.br'
          };
          await setDoc(doc(db, 'compras', id), docData);
        });
      }
    }
  }, [loading, servicos, compras]);

  // Retroactive migration to generate Pernambucana receivables for existing "a prazo" services
  const migrationRan = React.useRef(false);
  useEffect(() => {
    if (loading || servicos.length === 0 || migrationRan.current) return;
    migrationRan.current = true;

    const fixPending = async () => {
      let migrated = false;
      for (const s of servicos) {
        const pagamento = String(s.pagamento || '').toLowerCase();
        if (pagamento.includes('prazo')) {
          const hasRecebivel = recebiveis.some(r => r.servicoId === s.id);
          if (!hasRecebivel) {
            const parcelas = s.numParcelas > 0 ? s.numParcelas : 1;
            const valorParcela = (parseFloat(s.valorTotal) || parseFloat(s.valorOS) || 0) / parcelas;
            
            if (s.numParcelas === 0 || !s.numParcelas) {
              await setDoc(doc(db, 'servicos', s.id), { numParcelas: parcelas }, { merge: true });
            }

            for (let i = 1; i <= parcelas; i++) {
              const recId = generateUUID();
              const dataVenc = addDays(s.data, 30 * i);
              const recData = {
                id: recId,
                servicoId: s.id,
                os: s.os || '',
                cliente: s.cliente || '',
                descricao: s.descricao || '',
                produtivo: s.produtivo || '',
                setor: normalizeSector(s.setor),
                parcela: i,
                totalParcelas: parcelas,
                valorParcela: Math.round(valorParcela * 100) / 100,
                valorTotalOS: parseFloat(s.valorTotal) || parseFloat(s.valorOS) || 0,
                dataVencimento: dataVenc,
                mesVencimento: MONTHS[parseInt(dataVenc.split('-')[1], 10) - 1] || '',
                status: 'Pendente',
                dataRecebimento: '',
                criadoEm: new Date().toISOString()
              };
              await setDoc(doc(db, 'p_recebiveis', recId), recData);
            }
            migrated = true;
          }
        }
      }
      if (migrated) {
        console.log("Retroactive Pernambucana receivables generated successfully.");
      }
    };

    fixPending();
  }, [servicos, recebiveis, loading]);

  // Operations
  const addServico = async (item) => {
    const id = item.id || generateUUID();
    const dateInfo = getDateInfo(item.data);
    
    const pagamento = String(item.pagamento || '').toLowerCase();
    const isPrazo = pagamento.includes('prazo');
    let parsedParcelas = parseInt(item.numParcelas) || 0;
    if (isPrazo && parsedParcelas <= 0) {
      parsedParcelas = 1;
    }

    const docData = {
      ...item,
      id,
      mes: dateInfo.mesName,
      mesNum: dateInfo.mesNum,
      setor: normalizeSector(item.setor || (currentUser ? currentUser.sector : 'all')),
      valorTotal: parseFloat(item.valorTotal) || 0,
      valorUnitario: parseFloat(item.valorUnitario) || 0,
      numParcelas: parsedParcelas,
      criadoEm: item.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      criadoPor: item.criadoPor || (currentUser ? currentUser.email : '')
    };
    await setDoc(doc(db, 'servicos', id), docData);

    // Auto-generate receivables if "à Prazo"
    if (isPrazo && parsedParcelas > 0) {
      const valorParcela = docData.valorTotal / parsedParcelas;
      for (let i = 1; i <= parsedParcelas; i++) {
        const recId = generateUUID();
        const dataVenc = addDays(docData.data, 30 * i);
        const recData = {
          id: recId,
          servicoId: id,
          os: docData.os || '',
          cliente: docData.cliente || '',
          descricao: docData.descricao || '',
          produtivo: docData.produtivo || '',
          setor: docData.setor,
          parcela: i,
          totalParcelas: parsedParcelas,
          valorParcela: Math.round(valorParcela * 100) / 100,
          valorTotalOS: docData.valorTotal,
          dataVencimento: dataVenc,
          mesVencimento: MONTHS[parseInt(dataVenc.split('-')[1], 10) - 1] || '',
          status: 'Pendente',
          dataRecebimento: '',
          criadoEm: new Date().toISOString()
        };
        await setDoc(doc(db, 'p_recebiveis', recId), recData);
      }
    }

    return docData;
  };

  const updateServico = async (id, data) => {
    const dateInfo = data.data ? getDateInfo(data.data) : null;
    const docRef = doc(db, 'servicos', id);
    const updateData = {
      ...data,
      atualizadoEm: new Date().toISOString()
    };
    if (dateInfo) {
      updateData.mes = dateInfo.mesName;
      updateData.mesNum = dateInfo.mesNum;
    }
    if ('valorTotal' in data) {
      updateData.valorTotal = parseFloat(data.valorTotal) || 0;
    }
    if ('valorUnitario' in data) {
      updateData.valorUnitario = parseFloat(data.valorUnitario) || 0;
    }
    await setDoc(docRef, updateData, { merge: true });
  };

  const deleteServico = async (id) => {
    await deleteDoc(doc(db, 'servicos', id));
    // Delete associated receivables
    const recsToDelete = recebiveis.filter(r => r.servicoId === id);
    const promises = recsToDelete.map(r => deleteDoc(doc(db, 'p_recebiveis', r.id)));
    await Promise.all(promises);
  };

  const toggleRecebivel = async (id, newStatus) => {
    const docRef = doc(db, 'p_recebiveis', id);
    const dataRecebimento = newStatus === 'Recebido' ? new Date().toISOString().split('T')[0] : '';
    await setDoc(docRef, { status: newStatus, dataRecebimento }, { merge: true });
  };

  // Boletos CRUD
  const addBoleto = async (item) => {
    const id = item.id || generateUUID();
    const dateInfo = getDateInfo(item.dataVencimento);
    const docData = {
      ...item,
      id,
      mesVencimento: dateInfo.mesName,
      valorBoleto: parseFloat(item.valorBoleto) || 0,
      criadoEm: item.criadoEm || new Date().toISOString(),
      criadoPor: item.criadoPor || (currentUser ? currentUser.email : '')
    };
    await setDoc(doc(db, 'p_boletos', id), docData);
    return docData;
  };

  const updateBoleto = async (id, data) => {
    const docRef = doc(db, 'p_boletos', id);
    const updateData = {
      ...data,
      atualizadoEm: new Date().toISOString()
    };
    if (data.dataVencimento) {
      const dateInfo = getDateInfo(data.dataVencimento);
      updateData.mesVencimento = dateInfo.mesName;
    }
    if ('valorBoleto' in data) {
      updateData.valorBoleto = parseFloat(data.valorBoleto) || 0;
    }
    await setDoc(docRef, updateData, { merge: true });
  };

  const deleteBoleto = async (id) => {
    await deleteDoc(doc(db, 'p_boletos', id));
  };

  const addCompra = async (item) => {
    const id = item.id || generateUUID();
    const dateInfo = getDateInfo(item.data);
    const isFolha = item.categoria === 'Folha de pagamento';
    const bruto = isFolha ? parseFloat(item.bruto) || 0 : 0;
    const desconto = isFolha ? parseFloat(item.desconto) || 0 : 0;
    const liquido = isFolha ? (bruto - desconto) : 0;

    const docData = {
      ...item,
      id,
      mes: dateInfo.mesName,
      mesNum: dateInfo.mesNum,
      setor: normalizeSector(item.setor || (currentUser ? currentUser.sector : 'all')),
      bruto,
      desconto,
      liquido,
      valorProduto: isFolha ? liquido : (parseFloat(item.valorProduto) || 0),
      criadoEm: item.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      criadoPor: item.criadoPor || (currentUser ? currentUser.email : '')
    };
    await setDoc(doc(db, 'compras', id), docData);
    return docData;
  };

  const updateCompra = async (id, data) => {
    const dateInfo = data.data ? getDateInfo(data.data) : null;
    const docRef = doc(db, 'compras', id);
    const updateData = {
      ...data,
      atualizadoEm: new Date().toISOString()
    };
    if (dateInfo) {
      updateData.mes = dateInfo.mesName;
      updateData.mesNum = dateInfo.mesNum;
    }
    await setDoc(docRef, updateData, { merge: true });
  };

  const deleteCompra = async (id) => {
    await deleteDoc(doc(db, 'compras', id));
  };

  const clearAll = async () => {
    if (window.confirm("Isso excluirá permanentemente todos os lançamentos do banco de dados Firebase. Deseja continuar?")) {
      const promises = [
        ...servicos.map(s => deleteDoc(doc(db, 'servicos', s.id))),
        ...compras.map(c => deleteDoc(doc(db, 'compras', c.id)))
      ];
      await Promise.all(promises);
    }
  };

  const importRawData = async (servicosList, comprasList) => {
    const promises = [];
    if (Array.isArray(servicosList)) {
      servicosList.forEach(item => {
        promises.push(setDoc(doc(db, 'servicos', item.id || generateUUID()), item));
      });
    }
    if (Array.isArray(comprasList)) {
      comprasList.forEach(item => {
        promises.push(setDoc(doc(db, 'compras', item.id || generateUUID()), item));
      });
    }
    await Promise.all(promises);
  };

  const buildFinancePayload = () => {
    const payload = {
      meta: {},
      resumo: [],
      servicos: [],
      despesas: [],
      folha: [],
      produtivos: [],
      custosFixos: []
    };

    const groups = {};

    servicos.forEach(s => {
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

    compras.forEach(c => {
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
        const isPrazo = String(c.formaCompra).toLowerCase().includes('prazo');
        if (isPrazo) {
          groups[key].comprasPrazo += val;
        } else {
          groups[key].saidasVista += val;
        }
      }
    });

    Object.keys(groups).forEach(key => {
      const r = groups[key];
      const prefix = (r.departamento.charAt(0) || 'A').toUpperCase();
      r.codigo = `${prefix}${r.mesNum}`;
      r.entradas = r.receitaPrazo + r.receitaVista;
      r.retiradas = r.comprasPrazo + r.saidasVista + r.folhaPagamento + r.custoFixo + r.imposto + r.alimentacao;
      r.resultado = r.entradas - r.retiradas;
      payload.resumo.push(r);
    });

    const serviceGroups = {};
    servicos.forEach(s => {
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

    const despesasGroups = {};
    compras.forEach(c => {
      const sec = normalizeSector(c.setor);
      const mNum = parseInt(c.mesNum, 10);
      if (!sec || !mNum) return;

      let cat = String(c.categoria).trim();
      const val = parseFloat(c.valorProduto) || 0;

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

    compras.filter(c => c.categoria === 'Folha de pagamento').forEach(c => {
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

    const productiveGroups = {};
    servicos.forEach(s => {
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

    const custosFixosGroups = {};
    compras.filter(c => c.categoria === 'Custo fixo').forEach(c => {
      const sec = normalizeSector(c.setor);
      const mNum = parseInt(c.mesNum, 10);
      if (!sec || !mNum) return;

      const key = `${sec}|${mNum}`;
      if (!custosFixosGroups[key]) {
        const prefix = (sec.charAt(0) || 'A').toUpperCase();
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
  };

  const hasData = () => {
    return servicos.length > 0 || compras.length > 0;
  };

  const getFilteredServicos = () => {
    if (!currentUser) return [];
    if (currentUser.isAdmin) return servicos;
    return servicos.filter(item => currentUser.allowedSectors && currentUser.allowedSectors.includes(normalizeSector(item.setor)));
  };

  const getFilteredCompras = () => {
    if (!currentUser) return [];
    if (currentUser.isAdmin) return compras;
    return compras.filter(item => currentUser.allowedSectors && currentUser.allowedSectors.includes(normalizeSector(item.setor)));
  };

  const getFilteredBoletos = () => {
    if (!currentUser) return [];
    if (currentUser.isAdmin) return boletos;
    
    const getBoletoNormalizedSectors = (b) => {
      if (b.setores && b.setores.length > 0) return b.setores;
      if (!b.setor) return ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria'];
      const s = String(b.setor).toLowerCase().trim();
      if (s === 'todos' || s === '5x') return ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria'];
      
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
    };

    return boletos.filter(b => {
      const secs = getBoletoNormalizedSectors(b);
      return secs.some(sec => currentUser.allowedSectors && currentUser.allowedSectors.includes(sec));
    });
  };

  const getFilteredRecebiveis = () => {
    if (!currentUser) return [];
    if (currentUser.isAdmin) return recebiveis;
    return recebiveis.filter(r => currentUser.allowedSectors && currentUser.allowedSectors.includes(normalizeSector(r.setor)));
  };

  const value = {
    servicos: getFilteredServicos(),
    compras: getFilteredCompras(),
    boletos: getFilteredBoletos(),
    recebiveis: getFilteredRecebiveis(),
    allServicos: servicos,
    allCompras: compras,
    allBoletos: boletos,
    allRecebiveis: recebiveis,
    loading,
    hasData,
    addServico,
    updateServico,
    deleteServico,
    addCompra,
    updateCompra,
    deleteCompra,
    addBoleto,
    updateBoleto,
    deleteBoleto,
    toggleRecebivel,
    clearAll,
    importRawData,
    buildFinancePayload,
    DEPARTMENTS,
    DEFAULT_DEPT_LABEL,
    MONTHS,
    normalizeSector
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
