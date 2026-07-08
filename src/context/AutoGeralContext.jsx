import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
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

export const AutoGeralProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [servicos, setServicos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [boletos, setBoletos] = useState([]);
  const [recebiveis, setRecebiveis] = useState([]);
  const [loading, setLoading] = useState(true);

  // Real-time listeners for all 4 collections
  useEffect(() => {
    if (!db) { setLoading(false); return; }

    let loadFlags = { s: false, c: false, b: false, r: false };
    const checkLoaded = () => {
      if (loadFlags.s && loadFlags.c && loadFlags.b && loadFlags.r) setLoading(false);
    };

    const unsubServicos = onSnapshot(collection(db, 'ag_servicos'), (snap) => {
      const list = [];
      snap.forEach(d => list.push(d.data()));
      list.sort((a, b) => new Date(b.criadoEm || b.data) - new Date(a.criadoEm || a.data));
      setServicos(list);
      loadFlags.s = true;
      checkLoaded();
    }, err => { console.error("AG servicos:", err); loadFlags.s = true; checkLoaded(); });

    const unsubCompras = onSnapshot(collection(db, 'ag_compras'), (snap) => {
      const list = [];
      snap.forEach(d => list.push(d.data()));
      list.sort((a, b) => new Date(b.criadoEm || b.data) - new Date(a.criadoEm || a.data));
      setCompras(list);
      loadFlags.c = true;
      checkLoaded();
    }, err => { console.error("AG compras:", err); loadFlags.c = true; checkLoaded(); });

    const unsubBoletos = onSnapshot(collection(db, 'ag_boletos'), (snap) => {
      const list = [];
      snap.forEach(d => list.push(d.data()));
      list.sort((a, b) => new Date(b.criadoEm || b.dataVencimento) - new Date(a.criadoEm || a.dataVencimento));
      setBoletos(list);
      loadFlags.b = true;
      checkLoaded();
    }, err => { console.error("AG boletos:", err); loadFlags.b = true; checkLoaded(); });

    const unsubRecebiveis = onSnapshot(collection(db, 'ag_recebiveis'), (snap) => {
      const list = [];
      snap.forEach(d => list.push(d.data()));
      list.sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));
      setRecebiveis(list);
      loadFlags.r = true;
      checkLoaded();
    }, err => { console.error("AG recebiveis:", err); loadFlags.r = true; checkLoaded(); });

    return () => { unsubServicos(); unsubCompras(); unsubBoletos(); unsubRecebiveis(); };
  }, []);

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

    return docData;
  };

  const updateServico = async (id, data) => {
    const dateInfo = data.data ? getDateInfo(data.data) : null;
    const updateData = { ...data };
    if (dateInfo) {
      updateData.mes = dateInfo.mesName;
      updateData.mesNum = dateInfo.mesNum;
    }
    await setDoc(doc(db, 'ag_servicos', id), updateData, { merge: true });
  };

  const deleteServico = async (id) => {
    await deleteDoc(doc(db, 'ag_servicos', id));
    // Also delete associated receivables
    const related = recebiveis.filter(r => r.servicoId === id);
    for (const r of related) {
      await deleteDoc(doc(db, 'ag_recebiveis', r.id));
    }
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
    return docData;
  };

  const updateCompra = async (id, data) => {
    const dateInfo = data.data ? getDateInfo(data.data) : null;
    const updateData = { ...data };
    if (dateInfo) {
      updateData.mes = dateInfo.mesName;
      updateData.mesNum = dateInfo.mesNum;
    }
    await setDoc(doc(db, 'ag_compras', id), updateData, { merge: true });
  };

  const deleteCompra = async (id) => {
    await deleteDoc(doc(db, 'ag_compras', id));
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
    return docData;
  };

  const updateBoleto = async (id, data) => {
    await setDoc(doc(db, 'ag_boletos', id), data, { merge: true });
  };

  const deleteBoleto = async (id) => {
    await deleteDoc(doc(db, 'ag_boletos', id));
  };

  // ── RECEBÍVEIS ──
  const toggleRecebivel = async (id, newStatus) => {
    const updateData = {
      status: newStatus,
      dataRecebimento: newStatus === 'Recebido' ? new Date().toISOString().split('T')[0] : ''
    };
    await setDoc(doc(db, 'ag_recebiveis', id), updateData, { merge: true });
  };

  const deleteRecebivel = async (id) => {
    await deleteDoc(doc(db, 'ag_recebiveis', id));
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

  const value = {
    servicos,
    compras,
    boletos,
    recebiveis,
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
