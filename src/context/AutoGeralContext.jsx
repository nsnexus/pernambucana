import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db, useAuth } from './AuthContext';

const AutoGeralContext = createContext();

export const useAutoGeral = () => useContext(AutoGeralContext);

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getDateInfo(dateStr) {
  if (!dateStr || dateStr.length < 7) {
    return { mesNum: new Date().getMonth() + 1, mesName: MONTHS[new Date().getMonth()] };
  }
  const parts = dateStr.split('-');
  const mesNum = parseInt(parts[1], 10);
  const mesName = MONTHS[mesNum - 1] || 'Janeiro';
  return { mesNum, mesName };
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function calculateAutoGeralConsolidation(servList, compList, boletoList, recebiveisList, yearMonth) {
  const parts = yearMonth.split('-');
  const y = parts[0];
  const m = parseInt(parts[1], 10);

  const filterByMonthYear = (item, dateField) => {
    const dateStr = item[dateField];
    if (!dateStr) return false;
    const itemY = dateStr.split('-')[0];
    const itemM = parseInt(dateStr.split('-')[1], 10);
    return itemY === y && itemM === m;
  };

  const sFiltered = servList.filter(s => filterByMonthYear(s, 'data'));
  const cFiltered = compList.filter(c => filterByMonthYear(c, 'data'));
  const bFiltered = boletoList.filter(b => filterByMonthYear(b, 'dataVencimento'));
  
  const rFiltered = recebiveisList.filter(r => {
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

  const mecanicos = {};
  sFiltered.forEach(s => {
    const name = s.mecanico || 'Não informado';
    mecanicos[name] = (mecanicos[name] || 0) + (parseFloat(s.valorOS) || 0);
  });

  let pix = 0, cartao = 0, prazo = 0;
  sFiltered.forEach(s => {
    const f = String(s.formaCompra || '').toLowerCase();
    const val = parseFloat(s.valorOS) || 0;
    if (f.includes('pix')) pix += val;
    else if (f.includes('cart')) cartao += val;
    else if (f.includes('prazo')) prazo += val;
    else pix += val;
  });

  let recPendente = 0, recRecebido = 0;
  rFiltered.forEach(r => {
    const val = parseFloat(r.valorParcela) || 0;
    if (r.status === 'Pendente') recPendente += val;
    else if (r.status === 'Recebido') recRecebido += val;
  });

  return {
    mesNum: m,
    ano: y,
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
    recebiveisVencidosCount: recebiveisVencidos.length,
    recebiveisPendentesCount: recebivelPendentes.length,
    recebiveisRecebidosCount: recebiveisRecebidos.length,
    mecanicos,
    formaPgto: { pix, cartao, prazo },
    recebiveisStatus: { pendente: recPendente, recebido: recRecebido }
  };
}

export const AutoGeralProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [servicos, setServicos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [boletos, setBoletos] = useState([]);
  const [recebiveis, setRecebiveis] = useState([]);
  const [consolidado, setConsolidado] = useState([]);
  const [rawQueriesActive, setRawQueriesActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const enableRawQueries = React.useCallback(() => {
    setRawQueriesActive(true);
  }, []);

  const triggerAutoGeralConsolidation = async (dateStr) => {
    if (!dateStr || dateStr.length < 7) return;
    const yearMonth = dateStr.slice(0, 7);
    try {
      const start = `${yearMonth}-01`;
      const end = `${yearMonth}-31`;
      const [servsSnap, compsSnap, bolsSnap, recsVencSnap, recsRecebSnap] = await Promise.all([
        getDocs(query(collection(db, 'ag_servicos'), where('data', '>=', start), where('data', '<=', end))),
        getDocs(query(collection(db, 'ag_compras'), where('data', '>=', start), where('data', '<=', end))),
        getDocs(query(collection(db, 'ag_boletos'), where('dataVencimento', '>=', start), where('dataVencimento', '<=', end))),
        getDocs(query(collection(db, 'ag_recebiveis'), where('dataVencimento', '>=', start), where('dataVencimento', '<=', end))),
        getDocs(query(collection(db, 'ag_recebiveis'), where('dataRecebimento', '>=', start), where('dataRecebimento', '<=', end)))
      ]);
      const servsList = [];
      servsSnap.forEach(d => servsList.push(d.data()));
      const compsList = [];
      compsSnap.forEach(d => compsList.push(d.data()));
      const bolsList = [];
      bolsSnap.forEach(d => bolsList.push(d.data()));
      const recsList = [];
      const seenIds = new Set();
      const addRec = (d) => {
        const data = d.data();
        if (!seenIds.has(data.id)) {
          seenIds.add(data.id);
          recsList.push(data);
        }
      };
      recsVencSnap.forEach(addRec);
      recsRecebSnap.forEach(addRec);

      const consolidatedData = calculateAutoGeralConsolidation(servsList, compsList, bolsList, recsList, yearMonth);
      await setDoc(doc(db, 'ag_consolidado_mensal', yearMonth), {
        id: yearMonth,
        ...consolidatedData,
        atualizadoEm: new Date().toISOString()
      });
      console.log(`Consolidação Auto Geral atualizada para ${yearMonth}`);
    } catch (err) {
      console.error("Erro ao atualizar consolidação Auto Geral:", err);
    }
  };

  // Real-time listeners for all 4 collections
  useEffect(() => {
    if (!currentUser) {
      setServicos([]);
      setCompras([]);
      setBoletos([]);
      setRecebiveis([]);
      setConsolidado([]);
      setLoading(true);
      return;
    }

    setLoading(true);

    if (!db) { setLoading(false); return; }

    let unsubConsolidado = () => {};
    let unsubServicos = () => {};
    let unsubCompras = () => {};
    let unsubBoletos = () => {};
    let unsubRecebiveis = () => {};

    unsubConsolidado = onSnapshot(collection(db, 'ag_consolidado_mensal'), (snap) => {
      const list = [];
      snap.forEach(d => list.push(d.data()));
      setConsolidado(list);
      if (!rawQueriesActive) {
        setLoading(false);
      }
    }, err => { console.error("AG consolidado:", err); if (!rawQueriesActive) setLoading(false); });

    if (rawQueriesActive) {
      let loadFlags = { s: false, c: false, b: false, r: false };
      const checkLoaded = () => {
        if (loadFlags.s && loadFlags.c && loadFlags.b && loadFlags.r) setLoading(false);
      };

      unsubServicos = onSnapshot(collection(db, 'ag_servicos'), (snap) => {
        const list = [];
        snap.forEach(d => list.push(d.data()));
        list.sort((a, b) => new Date(b.criadoEm || b.data) - new Date(a.criadoEm || a.data));
        setServicos(list);
        loadFlags.s = true;
        checkLoaded();
      }, err => { console.error("AG servicos:", err); loadFlags.s = true; checkLoaded(); });

      unsubCompras = onSnapshot(collection(db, 'ag_compras'), (snap) => {
        const list = [];
        snap.forEach(d => list.push(d.data()));
        list.sort((a, b) => new Date(b.criadoEm || b.data) - new Date(a.criadoEm || a.data));
        setCompras(list);
        loadFlags.c = true;
        checkLoaded();
      }, err => { console.error("AG compras:", err); loadFlags.c = true; checkLoaded(); });

      unsubBoletos = onSnapshot(collection(db, 'ag_boletos'), (snap) => {
        const list = [];
        snap.forEach(d => list.push(d.data()));
        list.sort((a, b) => new Date(b.criadoEm || b.dataVencimento) - new Date(a.criadoEm || a.dataVencimento));
        setBoletos(list);
        loadFlags.b = true;
        checkLoaded();
      }, err => { console.error("AG boletos:", err); loadFlags.b = true; checkLoaded(); });

      unsubRecebiveis = onSnapshot(collection(db, 'ag_recebiveis'), (snap) => {
        const list = [];
        snap.forEach(d => list.push(d.data()));
        list.sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));
        setRecebiveis(list);
        loadFlags.r = true;
        checkLoaded();
      }, err => { console.error("AG recebiveis:", err); loadFlags.r = true; checkLoaded(); });
    }

    return () => {
      unsubConsolidado();
      unsubServicos();
      unsubCompras();
      unsubBoletos();
      unsubRecebiveis();
    };
  }, [currentUser, rawQueriesActive]);

  // Retroactive migration to generate receivables for existing "a prazo" services with 0 installments/receivables
  const migrationRan = useRef(false);
  useEffect(() => {
    if (loading || servicos.length === 0 || migrationRan.current) return;
    migrationRan.current = true;

    const fixPending = async () => {
      let migrated = false;
      for (const s of servicos) {
        const forma = String(s.formaCompra || '').toLowerCase();
        if (forma.includes('prazo')) {
          // Check if there are any receivables for this service
          const hasRecebivel = recebiveis.some(r => r.servicoId === s.id);
          if (!hasRecebivel) {
            // Re-run receivable generation for this service
            const parcelas = s.numParcelas > 0 ? s.numParcelas : 1;
            const valorParcela = s.valorOS / parcelas;
            
            // Update the servico document if it had numParcelas = 0
            if (s.numParcelas === 0) {
              await setDoc(doc(db, 'ag_servicos', s.id), { numParcelas: parcelas }, { merge: true });
            }

            for (let i = 1; i <= parcelas; i++) {
              const recId = generateUUID();
              const dataVenc = addDays(s.data, 30 * i);
              const recData = {
                id: recId,
                servicoId: s.id,
                numOS: s.numOS || '',
                nomeCliente: s.nomeCliente || '',
                descricao: s.descricaoMaterial || '',
                mecanico: s.mecanico || '',
                parcela: i,
                totalParcelas: parcelas,
                valorParcela: Math.round(valorParcela * 100) / 100,
                valorTotalOS: s.valorOS,
                dataVencimento: dataVenc,
                mesVencimento: MONTHS[parseInt(dataVenc.split('-')[1], 10) - 1] || '',
                status: 'Pendente',
                dataRecebimento: '',
                criadoEm: new Date().toISOString()
              };
              await setDoc(doc(db, 'ag_recebiveis', recId), recData);
            }
            migrated = true;
          }
        }
      }
      if (migrated) {
        console.log("Retroactive receivables generated successfully.");
      }
    };

    fixPending();
  }, [servicos, recebiveis, loading]);

  const consolidationMigrationRan = useRef(false);
  useEffect(() => {
    if (loading || consolidado.length > 0 || !rawQueriesActive || consolidationMigrationRan.current) return;
    if (servicos.length > 0 || compras.length > 0 || boletos.length > 0 || recebiveis.length > 0) {
      consolidationMigrationRan.current = true;
      runAutoGeralMigration();
    }
  }, [loading, consolidado, rawQueriesActive, servicos, compras, boletos, recebiveis]);

  // ── SERVIÇOS CRUD ──
  const addServico = async (item) => {
    const id = item.id || generateUUID();
    const dateInfo = getDateInfo(item.data);
    
    const forma = String(item.formaCompra || '').toLowerCase();
    const isPrazo = forma.includes('prazo');
    let parsedParcelas = parseInt(item.numParcelas) || 0;
    if (isPrazo && parsedParcelas <= 0) {
      parsedParcelas = 1;
    }

    const docData = {
      ...item,
      id,
      mes: dateInfo.mesName,
      mesNum: dateInfo.mesNum,
      valorOS: parseFloat(item.valorOS) || 0,
      valorServicos: parseFloat(item.valorServicos) || 0,
      valorPecas: parseFloat(item.valorPecas) || 0,
      valorMaterial: parseFloat(item.valorMaterial) || 0,
      numParcelas: parsedParcelas,
      ano: parseInt(item.ano) || new Date().getFullYear(),
      lancamento: 'Serviços',
      criadoEm: item.criadoEm || new Date().toISOString(),
      criadoPor: item.criadoPor || (currentUser ? currentUser.email : '')
    };
    await setDoc(doc(db, 'ag_servicos', id), docData);

    // Auto-generate receivables if "à Prazo"
    if (isPrazo && parsedParcelas > 0) {
      const valorParcela = docData.valorOS / parsedParcelas;
      for (let i = 1; i <= parsedParcelas; i++) {
        const recId = generateUUID();
        const dataVenc = addDays(docData.data, 30 * i);
        const recData = {
          id: recId,
          servicoId: id,
          numOS: docData.numOS || '',
          nomeCliente: docData.nomeCliente || '',
          descricao: docData.descricaoMaterial || '',
          mecanico: docData.mecanico || '',
          parcela: i,
          totalParcelas: parsedParcelas,
          valorParcela: Math.round(valorParcela * 100) / 100,
          valorTotalOS: docData.valorOS,
          dataVencimento: dataVenc,
          mesVencimento: MONTHS[parseInt(dataVenc.split('-')[1], 10) - 1] || '',
          status: 'Pendente',
          dataRecebimento: '',
          criadoEm: new Date().toISOString()
        };
        await setDoc(doc(db, 'ag_recebiveis', recId), recData);
      }
    }

    await triggerAutoGeralConsolidation(docData.data);
    return docData;
  };

  const updateServico = async (id, data) => {
    const oldDoc = servicos.find(s => s.id === id);
    const oldDate = oldDoc?.data;

    const dateInfo = data.data ? getDateInfo(data.data) : null;
    const updateData = { ...data };
    if (dateInfo) {
      updateData.mes = dateInfo.mesName;
      updateData.mesNum = dateInfo.mesNum;
    }
    await setDoc(doc(db, 'ag_servicos', id), updateData, { merge: true });

    if (oldDate) await triggerAutoGeralConsolidation(oldDate);
    if (data.data) await triggerAutoGeralConsolidation(data.data);
  };

  const deleteServico = async (id) => {
    const oldDoc = servicos.find(s => s.id === id);
    const oldDate = oldDoc?.data;

    await deleteDoc(doc(db, 'ag_servicos', id));
    // Also delete associated receivables
    const related = recebiveis.filter(r => r.servicoId === id);
    for (const r of related) {
      await deleteDoc(doc(db, 'ag_recebiveis', r.id));
    }

    if (oldDate) await triggerAutoGeralConsolidation(oldDate);
  };

  // ── COMPRAS CRUD ──
  const addCompra = async (item) => {
    const id = item.id || generateUUID();
    const dateInfo = getDateInfo(item.data);
    const docData = {
      ...item,
      id,
      mes: dateInfo.mesName,
      mesNum: dateInfo.mesNum,
      valorOS: parseFloat(item.valorOS) || 0,
      valorPeca: parseFloat(item.valorPeca) || 0,
      lancamento: 'Compras',
      criadoEm: item.criadoEm || new Date().toISOString(),
      criadoPor: item.criadoPor || (currentUser ? currentUser.email : '')
    };
    await setDoc(doc(db, 'ag_compras', id), docData);
    await triggerAutoGeralConsolidation(docData.data);
    return docData;
  };

  const updateCompra = async (id, data) => {
    const oldDoc = compras.find(c => c.id === id);
    const oldDate = oldDoc?.data;

    const dateInfo = data.data ? getDateInfo(data.data) : null;
    const updateData = { ...data };
    if (dateInfo) {
      updateData.mes = dateInfo.mesName;
      updateData.mesNum = dateInfo.mesNum;
    }
    await setDoc(doc(db, 'ag_compras', id), updateData, { merge: true });

    if (oldDate) await triggerAutoGeralConsolidation(oldDate);
    if (data.data) await triggerAutoGeralConsolidation(data.data);
  };

  const deleteCompra = async (id) => {
    const oldDoc = compras.find(c => c.id === id);
    const oldDate = oldDoc?.data;

    await deleteDoc(doc(db, 'ag_compras', id));

    if (oldDate) await triggerAutoGeralConsolidation(oldDate);
  };

  // ── BOLETOS CRUD ──
  const addBoleto = async (item) => {
    const id = item.id || generateUUID();
    const docData = {
      ...item,
      id,
      formaCompra: 'Boletos',
      valorBoleto: parseFloat(item.valorBoleto) || 0,
      valorOS: parseFloat(item.valorOS) || 0,
      mesVencimento: item.mesVencimento || '',
      criadoEm: item.criadoEm || new Date().toISOString(),
      criadoPor: item.criadoPor || (currentUser ? currentUser.email : '')
    };
    await setDoc(doc(db, 'ag_boletos', id), docData);
    await triggerAutoGeralConsolidation(docData.dataVencimento);
    return docData;
  };

  const updateBoleto = async (id, data) => {
    const oldDoc = boletos.find(b => b.id === id);
    const oldDate = oldDoc?.dataVencimento;

    await setDoc(doc(db, 'ag_boletos', id), data, { merge: true });

    if (oldDate) await triggerAutoGeralConsolidation(oldDate);
    if (data.dataVencimento) await triggerAutoGeralConsolidation(data.dataVencimento);
  };

  const deleteBoleto = async (id) => {
    const oldDoc = boletos.find(b => b.id === id);
    const oldDate = oldDoc?.dataVencimento;

    await deleteDoc(doc(db, 'ag_boletos', id));

    if (oldDate) await triggerAutoGeralConsolidation(oldDate);
  };

  // ── RECEBÍVEIS ──
  const toggleRecebivel = async (id, newStatus) => {
    const oldDoc = recebiveis.find(r => r.id === id);
    const oldDate = oldDoc?.dataRecebimento || oldDoc?.dataVencimento;

    const dataRecebimento = newStatus === 'Recebido' ? new Date().toISOString().split('T')[0] : '';
    const updateData = {
      status: newStatus,
      dataRecebimento
    };
    await setDoc(doc(db, 'ag_recebiveis', id), updateData, { merge: true });

    if (oldDate) await triggerAutoGeralConsolidation(oldDate);
    if (dataRecebimento) await triggerAutoGeralConsolidation(dataRecebimento);
  };

  const deleteRecebivel = async (id) => {
    const oldDoc = recebiveis.find(r => r.id === id);
    const oldDate = oldDoc?.dataRecebimento || oldDoc?.dataVencimento;

    await deleteDoc(doc(db, 'ag_recebiveis', id));

    if (oldDate) await triggerAutoGeralConsolidation(oldDate);
  };

  // ── CAIXA CALCULATION ──
  const caixa = useMemo(() => {
    // Entradas à vista (Pix, Cartão, tudo que NÃO é prazo)
    const servicosVista = servicos.filter(s => {
      const forma = String(s.formaCompra || '').toLowerCase();
      return !forma.includes('prazo');
    });
    const totalServicoVista = servicosVista.reduce((sum, s) => sum + (parseFloat(s.valorOS) || 0), 0);

    // Recebíveis recebidos
    const recebiveisRecebidos = recebiveis.filter(r => r.status === 'Recebido');
    const totalRecebido = recebiveisRecebidos.reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);

    // Recebíveis pendentes
    const recebivelPendentes = recebiveis.filter(r => r.status === 'Pendente');
    const totalPendente = recebivelPendentes.reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);

    // Recebíveis vencidos (pendentes com data < hoje)
    const hoje = new Date().toISOString().split('T')[0];
    const recebiveisVencidos = recebivelPendentes.filter(r => r.dataVencimento < hoje);
    const totalVencido = recebiveisVencidos.reduce((sum, r) => sum + (parseFloat(r.valorParcela) || 0), 0);

    // Total boletos (todos são considerados como despesa/pago)
    const totalBoletos = boletos.reduce((sum, b) => sum + (parseFloat(b.valorBoleto) || 0), 0);

    // Total compras
    const totalCompras = compras.reduce((sum, c) => sum + (parseFloat(c.valorPeca) || 0), 0);

    // Total serviços geral
    const totalServicos = servicos.reduce((sum, s) => sum + (parseFloat(s.valorOS) || 0), 0);

    // Entradas efetivas
    const entradas = totalServicoVista + totalRecebido;

    // Saídas efetivas
    const saidas = totalBoletos;

    // Saldo
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
      recebiveisRecebidos: recebiveisRecebidos.length
    };
  }, [servicos, recebiveis, boletos, compras]);

  // ── IMPORT HELPERS ──
  const importServicosFromExcel = async (items) => {
    for (const item of items) {
      await addServico(item);
    }
    return items.length;
  };

  const importComprasFromExcel = async (items) => {
    for (const item of items) {
      await addCompra(item);
    }
    return items.length;
  };

  const importBoletosFromExcel = async (items) => {
    for (const item of items) {
      await addBoleto(item);
    }
    return items.length;
  };

  const runAutoGeralMigration = async () => {
    try {
      console.log("Iniciando migração de consolidação Auto Geral...");
      const [servsSnap, compsSnap, bolsSnap, recsSnap] = await Promise.all([
        getDocs(collection(db, 'ag_servicos')),
        getDocs(collection(db, 'ag_compras')),
        getDocs(collection(db, 'ag_boletos')),
        getDocs(collection(db, 'ag_recebiveis'))
      ]);

      const servsList = [];
      servsSnap.forEach(d => servsList.push(d.data()));
      const compsList = [];
      compsSnap.forEach(d => compsList.push(d.data()));
      const bolsList = [];
      bolsSnap.forEach(d => bolsList.push(d.data()));
      const recsList = [];
      recsSnap.forEach(d => recsList.push(d.data()));

      const months = new Set();
      servsList.forEach(s => { if (s.data && s.data.length >= 7) months.add(s.data.slice(0, 7)); });
      compsList.forEach(c => { if (c.data && c.data.length >= 7) months.add(c.data.slice(0, 7)); });
      bolsList.forEach(b => { if (b.dataVencimento && b.dataVencimento.length >= 7) months.add(b.dataVencimento.slice(0, 7)); });
      recsList.forEach(r => {
        if (r.dataVencimento && r.dataVencimento.length >= 7) months.add(r.dataVencimento.slice(0, 7));
        if (r.dataRecebimento && r.dataRecebimento.length >= 7) months.add(r.dataRecebimento.slice(0, 7));
      });

      for (const yearMonth of months) {
        const consolidatedData = calculateAutoGeralConsolidation(servsList, compsList, bolsList, recsList, yearMonth);
        await setDoc(doc(db, 'ag_consolidado_mensal', yearMonth), {
          id: yearMonth,
          ...consolidatedData,
          atualizadoEm: new Date().toISOString()
        });
        console.log(`Auto Geral: Consolidação gerada para ${yearMonth}`);
      }
      console.log("Migração de consolidação Auto Geral concluída!");
      return true;
    } catch (err) {
      console.error("Erro na migração Auto Geral:", err);
      return false;
    }
  };

  const value = {
    servicos,
    compras,
    boletos,
    recebiveis,
    consolidado,
    rawQueriesActive,
    enableRawQueries,
    runAutoGeralMigration,
    loading,
    caixa,
    MONTHS,
    // Serviços
    addServico,
    updateServico,
    deleteServico,
    // Compras
    addCompra,
    updateCompra,
    deleteCompra,
    // Boletos
    addBoleto,
    updateBoleto,
    deleteBoleto,
    // Recebíveis
    toggleRecebivel,
    deleteRecebivel,
    // Import
    importServicosFromExcel,
    importComprasFromExcel,
    importBoletosFromExcel
  };

  return (
    <AutoGeralContext.Provider value={value}>
      {children}
    </AutoGeralContext.Provider>
  );
};
