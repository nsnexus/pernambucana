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

export const DataProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [servicos, setServicos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let servicosUnsubscribe = () => {};
    let comprasUnsubscribe = () => {};

    let servsLoaded = false;
    let compsLoaded = false;

    if (db) {
      servicosUnsubscribe = onSnapshot(collection(db, 'servicos'), (snapshot) => {
        const list = [];
        snapshot.forEach(doc => list.push(doc.data()));
        list.sort((a, b) => new Date(b.criadoEm || b.data) - new Date(a.criadoEm || a.data));
        setServicos(list);
        servsLoaded = true;
        if (servsLoaded && compsLoaded) {
          setLoading(false);
        }
      }, err => {
        console.error("Erro ao carregar servicos:", err);
        setLoading(false);
      });

      comprasUnsubscribe = onSnapshot(collection(db, 'compras'), (snapshot) => {
        const list = [];
        snapshot.forEach(doc => list.push(doc.data()));
        list.sort((a, b) => new Date(b.criadoEm || b.data) - new Date(a.criadoEm || a.data));
        setCompras(list);
        compsLoaded = true;
        if (servsLoaded && compsLoaded) {
          setLoading(false);
        }
      }, err => {
        console.error("Erro ao carregar compras:", err);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      servicosUnsubscribe();
      comprasUnsubscribe();
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

  // Operations
  const addServico = async (item) => {
    const id = item.id || generateUUID();
    const dateInfo = getDateInfo(item.data);
    const docData = {
      ...item,
      id,
      mes: dateInfo.mesName,
      mesNum: dateInfo.mesNum,
      setor: normalizeSector(item.setor || (currentUser ? currentUser.sector : 'all')),
      criadoEm: item.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      criadoPor: item.criadoPor || (currentUser ? currentUser.email : '')
    };
    await setDoc(doc(db, 'servicos', id), docData);
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
    await setDoc(docRef, updateData, { merge: true });
  };

  const deleteServico = async (id) => {
    await deleteDoc(doc(db, 'servicos', id));
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

  const value = {
    servicos: getFilteredServicos(),
    compras: getFilteredCompras(),
    allServicos: servicos,
    allCompras: compras,
    loading,
    hasData,
    addServico,
    updateServico,
    deleteServico,
    addCompra,
    updateCompra,
    deleteCompra,
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
