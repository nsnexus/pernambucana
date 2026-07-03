import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import Sidebar from '../components/Sidebar';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
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
import * as XLSX from 'xlsx';
import '../styles/dashboard.css';

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

const Dashboard = () => {
  const { currentUser } = useAuth();
  const {
    servicos: contextServicos,
    compras: contextCompras,
    hasData,
    clearAll,
    buildFinancePayload,
    DEPARTMENTS,
    DEFAULT_DEPT_LABEL,
    MONTHS,
    normalizeSector
  } = useData();

  // Theme state
  const [whiteTheme, setWhiteTheme] = useState(() => {
    return localStorage.getItem('pernambucana.financeDashboard.theme.v1') === 'white';
  });

  // Pages state
  const [activeTab, setActiveTab] = useState('geral'); // geral, setor, despesas, produtivos, detalhes
  const [activeDept, setActiveDept] = useState('all');

  // Filters state
  const [monthFilter, setMonthFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Toast message state
  const [toastMessage, setToastMessage] = useState('');

  // Local spreadsheet upload fallback state
  const [localSpreadsheetPayload, setLocalSpreadsheetPayload] = useState(() => {
    try {
      const raw = localStorage.getItem('pernambucana.financeData.manual.v2');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && Array.isArray(parsed.resumo) ? parsed : null;
    } catch {
      return null;
    }
  });

  // Load consolidated default or custom payload
  const currentPayload = useMemo(() => {
    if (hasData()) {
      return buildFinancePayload();
    }
    if (localSpreadsheetPayload) {
      return localSpreadsheetPayload;
    }
    return window.FINANCE_DATA || {};
  }, [hasData, buildFinancePayload, localSpreadsheetPayload]);

  const resumo = currentPayload.resumo || [];
  const servs = currentPayload.servicos || [];
  const despesas = currentPayload.despesas || [];
  const folha = currentPayload.folha || [];
  const produtivos = currentPayload.produtivos || [];

  // Synced theme
  useEffect(() => {
    document.body.classList.toggle('theme-white', whiteTheme);
    localStorage.setItem('pernambucana.financeDashboard.theme.v1', whiteTheme ? 'white' : 'black');
  }, [whiteTheme]);

  // Sync toolbar filters
  useEffect(() => {
    if (activeDept !== 'all') {
      setDeptFilter(activeDept);
    }
  }, [activeDept]);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2600);
  };

  const fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  // Filtering helpers
  const filteredResumo = useMemo(() => {
    return resumo.filter(r => {
      const matchMonth = monthFilter === 'all' || String(r.mesNum) === monthFilter;
      const matchSector = deptFilter === 'all' || r.departamento === deptFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || Object.values(r).join(' ').toLowerCase().includes(q);
      return matchMonth && matchSector && matchSearch;
    });
  }, [resumo, monthFilter, deptFilter, searchQuery]);

  const filteredDespesas = useMemo(() => {
    return despesas.filter(r => {
      const matchMonth = monthFilter === 'all' || String(r.mesNum) === monthFilter;
      const matchSector = deptFilter === 'all' || r.departamento === deptFilter;
      const matchCat = categoryFilter === 'all' || r.categoria === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || Object.values(r).join(' ').toLowerCase().includes(q);
      return matchMonth && matchSector && matchCat && matchSearch;
    });
  }, [despesas, monthFilter, deptFilter, categoryFilter, searchQuery]);

  const filteredServicos = useMemo(() => {
    return servs.filter(r => {
      const matchMonth = monthFilter === 'all' || String(r.mesNum) === monthFilter;
      const matchSector = deptFilter === 'all' || r.departamento === deptFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || Object.values(r).join(' ').toLowerCase().includes(q);
      return matchMonth && matchSector && matchSearch;
    });
  }, [servs, monthFilter, deptFilter, searchQuery]);

  const filteredProdutivos = useMemo(() => {
    return produtivos.filter(r => {
      const matchMonth = monthFilter === 'all' || String(r.mesNum) === monthFilter;
      const matchSector = deptFilter === 'all' || r.departamento === deptFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || Object.values(r).join(' ').toLowerCase().includes(q);
      return matchMonth && matchSector && matchSearch;
    });
  }, [produtivos, monthFilter, deptFilter, searchQuery]);

  // Aggregate sums
  const sumVal = (rows, field) => rows.reduce((a, r) => a + (Number(r[field]) || 0), 0);
  const sumValDespesa = (rows, pred) => rows.reduce((a, r) => a + (pred && !pred(r) ? 0 : (Number(r.valor) || 0)), 0);

  const totalEntradas = sumVal(filteredResumo, 'entradas');
  const totalRetiradas = sumVal(filteredResumo, 'retiradas');
  const totalResultado = sumVal(filteredResumo, 'resultado');
  const totalVista = sumVal(filteredResumo, 'receitaVista');
  const totalPrazo = sumVal(filteredResumo, 'receitaPrazo');
  const totalMargem = totalEntradas ? (totalResultado / totalEntradas) * 100 : 0;

  // Chart configuration theme helpers
  const getChartColors = () => {
    const isWhite = whiteTheme;
    return {
      axis: isWhite ? '#526276' : '#b9c6d7',
      grid: isWhite ? 'rgba(9,33,51,.08)' : 'rgba(255,255,255,.05)',
      legend: isWhite ? '#203449' : '#dfeaf7',
      labelColor: isWhite ? '#102033' : '#ffffff'
    };
  };

  const PALETTE = [
    { solid: 'rgba(0,126,122,.92)', soft: 'rgba(0,126,122,.24)', border: 'rgba(0,126,122,1)' },
    { solid: 'rgba(236,177,31,.92)', soft: 'rgba(236,177,31,.24)', border: 'rgba(236,177,31,1)' },
    { solid: 'rgba(91,155,213,.92)', soft: 'rgba(91,155,213,.24)', border: 'rgba(91,155,213,1)' },
    { solid: 'rgba(255,107,122,.92)', soft: 'rgba(255,107,122,.24)', border: 'rgba(255,107,122,1)' },
    { solid: 'rgba(132,94,247,.92)', soft: 'rgba(132,94,247,.24)', border: 'rgba(132,94,247,1)' },
    { solid: 'rgba(45,212,191,.92)', soft: 'rgba(45,212,191,.24)', border: 'rgba(45,212,191,1)' },
    { solid: 'rgba(251,146,60,.92)', soft: 'rgba(251,146,60,.24)', border: 'rgba(251,146,60,1)' },
    { solid: 'rgba(163,230,53,.92)', soft: 'rgba(163,230,53,.24)', border: 'rgba(163,230,53,1)' }
  ];

  // Helper chart configurations
  const commonOptions = (title, indexAxis = 'x', hideLegend = true) => {
    const colors = getChartColors();
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis,
      plugins: {
        legend: {
          display: !hideLegend,
          position: 'bottom',
          labels: { 
            color: colors.legend,
            font: { family: 'Inter, system-ui, sans-serif', weight: '600', size: 11 }
          }
        },
        tooltip: {
          backgroundColor: whiteTheme ? 'rgba(255, 255, 255, 0.98)' : 'rgba(13, 34, 51, 0.98)',
          titleColor: whiteTheme ? '#092133' : '#fff',
          bodyColor: whiteTheme ? '#092133' : '#fff',
          borderColor: colors.grid,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: 'Inter, system-ui, sans-serif', weight: 'bold' },
          bodyFont: { family: 'Inter, system-ui, sans-serif' },
          callbacks: {
            label: (context) => {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) {
                label += fmtMoney.format(context.parsed.y);
              } else if (context.parsed.x !== null) {
                label += fmtMoney.format(context.parsed.x);
              }
              return label;
            }
          }
        },
        datalabels: {
          display: true,
          color: colors.labelColor,
          font: { family: 'Inter, system-ui, sans-serif', weight: 'bold', size: 9 },
          offset: 4,
          align: 'top',
          formatter: (value) => {
            if (!value) return '';
            return value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value.toFixed(0)}`;
          }
        }
      },
      scales: {
        x: {
          grid: { 
            color: colors.grid,
            drawBorder: false,
            borderDash: [5, 5]
          },
          ticks: { 
            color: colors.axis,
            font: { family: 'Inter, system-ui, sans-serif', size: 10 }
          }
        },
        y: {
          grid: { 
            color: colors.grid,
            drawBorder: false,
            borderDash: [5, 5]
          },
          ticks: { 
            color: colors.axis,
            font: { family: 'Inter, system-ui, sans-serif', size: 10 }
          }
        }
      }
    };
  };

  // 1. Chart Hero (Resultado Acumulado) data
  const chartHeroData = useMemo(() => {
    const monthsInResumo = Array.from(new Set(filteredResumo.map(r => r.mesNum))).sort((a, b) => a - b);
    const dataPoints = monthsInResumo.map(n => {
      const name = MONTHS[n - 1] ? MONTHS[n - 1].slice(0, 3) : `M${n}`;
      const sum = sumVal(filteredResumo.filter(r => r.mesNum === n), 'resultado');
      return { name, sum };
    });

    return {
      labels: dataPoints.map(d => d.name),
      datasets: [
        {
          label: 'Resultado',
          data: dataPoints.map(d => d.sum),
          borderColor: PALETTE[1].border,
          backgroundColor: PALETTE[1].soft,
          fill: true,
          tension: 0.45,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: PALETTE[1].border,
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5
        }
      ]
    };
  }, [filteredResumo]);

  // 2. Chart Monthly (Entradas, Retiradas e Resultado)
  const chartMonthlyData = useMemo(() => {
    const monthsInResumo = Array.from(new Set(filteredResumo.map(r => r.mesNum))).sort((a, b) => a - b);
    const dataPoints = monthsInResumo.map(n => {
      const name = MONTHS[n - 1] ? MONTHS[n - 1].slice(0, 3) : `M${n}`;
      const e = sumVal(filteredResumo.filter(r => r.mesNum === n), 'entradas');
      const s = sumVal(filteredResumo.filter(r => r.mesNum === n), 'retiradas');
      const r = sumVal(filteredResumo.filter(r => r.mesNum === n), 'resultado');
      return { name, e, s, r };
    });

    return {
      labels: dataPoints.map(d => d.name),
      datasets: [
        {
          type: 'bar',
          label: 'Entradas',
          data: dataPoints.map(d => d.e),
          backgroundColor: PALETTE[0].solid,
          borderRadius: 8
        },
        {
          type: 'bar',
          label: 'Retiradas',
          data: dataPoints.map(d => d.s),
          backgroundColor: PALETTE[3].solid,
          borderRadius: 8
        },
        {
          type: 'line',
          label: 'Resultado',
          data: dataPoints.map(d => d.r),
          borderColor: PALETTE[1].border,
          borderWidth: 3,
          fill: false,
          tension: 0.45,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: PALETTE[1].border,
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5
        }
      ]
    };
  }, [filteredResumo]);

  // 3. Chart Dept Result (Resultado por Setor)
  const chartDeptResultData = useMemo(() => {
    const depts = Array.from(new Set(filteredResumo.map(r => r.departamento)));
    const dataPoints = depts.map(d => {
      const sum = sumVal(filteredResumo.filter(r => r.departamento === d), 'resultado');
      return { name: DEFAULT_DEPT_LABEL[d] || d, sum };
    });

    return {
      labels: dataPoints.map(d => d.name),
      datasets: [
        {
          label: 'Resultado',
          data: dataPoints.map(d => d.sum),
          backgroundColor: dataPoints.map((_, i) => PALETTE[i % PALETTE.length].solid),
          borderRadius: 8
        }
      ]
    };
  }, [filteredResumo]);

  // 4. Chart Payment (À vista x À prazo)
  const chartPaymentData = useMemo(() => {
    return {
      labels: ['À vista', 'À prazo'],
      datasets: [
        {
          data: [totalVista, totalPrazo],
          backgroundColor: [PALETTE[5].solid, PALETTE[1].solid],
          borderWidth: 0
        }
      ]
    };
  }, [totalVista, totalPrazo]);

  // 5. Chart Expenses (Despesas)
  const chartExpensesData = useMemo(() => {
    const grouped = filteredDespesas.filter(r => r.entraResultado).reduce((acc, d) => {
      const cat = d.categoria || 'Outros';
      acc[cat] = (acc[cat] || 0) + d.valor;
      return acc;
    }, {});
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 8);

    return {
      labels: sorted.map(s => s[0]),
      datasets: [
        {
          label: 'Valor',
          data: sorted.map(s => s[1]),
          backgroundColor: PALETTE[2].solid,
          borderRadius: 8
        }
      ]
    };
  }, [filteredDespesas]);

  // 6. Chart Revenue Dept (Participação por Setor)
  const chartRevenueDeptData = useMemo(() => {
    const deptsInResumo = Array.from(new Set(filteredResumo.map(r => r.departamento)));
    const dataPoints = deptsInResumo.map(d => {
      const sum = sumVal(filteredResumo.filter(r => r.departamento === d), 'entradas');
      return { name: DEFAULT_DEPT_LABEL[d] || d, sum };
    });

    return {
      labels: dataPoints.map(d => d.name),
      datasets: [
        {
          data: dataPoints.map(d => d.sum),
          backgroundColor: dataPoints.map((_, i) => PALETTE[i % PALETTE.length].solid),
          borderWidth: 0
        }
      ]
    };
  }, [filteredResumo]);

  // 7. Chart Compras (Compras e Material por Setor)
  const chartComprasData = useMemo(() => {
    const deptsInDespesas = Array.from(new Set(filteredDespesas.map(d => d.departamento)));
    const dataPoints = deptsInDespesas.map(d => {
      const sum = sumValDespesa(filteredDespesas.filter(r => r.departamento === d && ['Compras a prazo', 'Compras do mês', 'Material OS'].includes(r.categoria)));
      return { name: DEFAULT_DEPT_LABEL[d] || d, sum };
    });

    return {
      labels: dataPoints.map(d => d.name),
      datasets: [
        {
          label: 'Valor',
          data: dataPoints.map(d => d.sum),
          backgroundColor: PALETTE[4].solid,
          borderRadius: 8
        }
      ]
    };
  }, [filteredDespesas]);

  // Dynamic calculations for Sector page tabs
  const sectorResumoRows = useMemo(() => {
    const dept = activeDept === 'all' ? (deptFilter === 'all' ? 'Mecanica' : deptFilter) : activeDept;
    return resumo.filter(r => r.departamento === dept);
  }, [resumo, activeDept, deptFilter]);

  const sectorServicesFiltered = useMemo(() => {
    const dept = activeDept === 'all' ? (deptFilter === 'all' ? 'Mecanica' : deptFilter) : activeDept;
    return filteredServicos.filter(r => r.departamento === dept);
  }, [filteredServicos, activeDept, deptFilter]);

  const sectorDespesasFiltered = useMemo(() => {
    const dept = activeDept === 'all' ? (deptFilter === 'all' ? 'Mecanica' : deptFilter) : activeDept;
    return filteredDespesas.filter(r => r.departamento === dept);
  }, [filteredDespesas, activeDept, deptFilter]);

  // 8. Chart Sector Monthly
  const chartSectorMonthlyData = useMemo(() => {
    const months = Array.from(new Set(sectorResumoRows.map(r => r.mesNum))).sort((a, b) => a - b);
    const dataPoints = months.map(n => {
      const name = MONTHS[n - 1] ? MONTHS[n - 1].slice(0, 3) : `M${n}`;
      const e = sumVal(sectorResumoRows.filter(r => r.mesNum === n), 'entradas');
      const s = sumVal(sectorResumoRows.filter(r => r.mesNum === n), 'retiradas');
      const r = sumVal(sectorResumoRows.filter(r => r.mesNum === n), 'resultado');
      return { name, e, s, r };
    });

    return {
      labels: dataPoints.map(d => d.name),
      datasets: [
        {
          type: 'bar',
          label: 'Entradas',
          data: dataPoints.map(d => d.e),
          backgroundColor: PALETTE[0].solid,
          borderRadius: 8
        },
        {
          type: 'bar',
          label: 'Retiradas',
          data: dataPoints.map(d => d.s),
          backgroundColor: PALETTE[3].solid,
          borderRadius: 8
        },
        {
          type: 'line',
          label: 'Resultado',
          data: dataPoints.map(d => d.r),
          borderColor: PALETTE[1].border,
          borderWidth: 3,
          fill: false,
          tension: 0.45,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: PALETTE[1].border,
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5
        }
      ]
    };
  }, [sectorResumoRows]);

  // 9. Chart Sector Payment (À vista x À prazo para Setor)
  const chartSectorPaymentData = useMemo(() => {
    const vista = sumVal(sectorResumoRows, 'receitaVista');
    const prazo = sumVal(sectorResumoRows, 'receitaPrazo');
    return {
      labels: ['À vista', 'À prazo'],
      datasets: [
        {
          data: [vista, prazo],
          backgroundColor: [PALETTE[5].solid, PALETTE[1].solid],
          borderWidth: 0
        }
      ]
    };
  }, [sectorResumoRows]);

  // 10. Chart Sector Expenses
  const chartSectorExpensesData = useMemo(() => {
    const grouped = sectorDespesasFiltered.filter(r => r.entraResultado).reduce((acc, d) => {
      const cat = d.categoria || 'Outros';
      acc[cat] = (acc[cat] || 0) + d.valor;
      return acc;
    }, {});
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 8);

    return {
      labels: sorted.map(s => s[0]),
      datasets: [
        {
          label: 'Valor',
          data: sorted.map(s => s[1]),
          backgroundColor: PALETTE[3].solid,
          borderRadius: 8
        }
      ]
    };
  }, [sectorDespesasFiltered]);

  // 11. Chart Sector Services
  const chartSectorServicesData = useMemo(() => {
    const grouped = sectorServicesFiltered.reduce((acc, s) => {
      const type = s.servico || 'Outros';
      acc[type] = (acc[type] || 0) + s.valor;
      return acc;
    }, {});
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 8);

    return {
      labels: sorted.map(s => s[0]),
      datasets: [
        {
          label: 'Valor',
          data: sorted.map(s => s[1]),
          backgroundColor: PALETTE[0].solid,
          borderRadius: 8
        }
      ]
    };
  }, [sectorServicesFiltered]);

  // Despesas Page Calculations
  const despesasTotalSum = sumValDespesa(filteredDespesas);
  const despesasRetiradasSum = sumValDespesa(filteredDespesas, r => r.entraResultado);
  const despesasComprasSum = sumValDespesa(filteredDespesas, r => ['Compras a prazo', 'Compras do mês', 'Material OS'].includes(r.categoria));

  // 12. Chart Expense Monthly
  const chartExpenseMonthlyData = useMemo(() => {
    const months = Array.from(new Set(filteredDespesas.map(d => d.mesNum))).sort((a, b) => a - b);
    const dataPoints = months.map(n => {
      const name = MONTHS[n - 1] ? MONTHS[n - 1].slice(0, 3) : `M${n}`;
      const sum = sumValDespesa(filteredDespesas.filter(r => r.mesNum === n));
      return { name, sum };
    });

    return {
      labels: dataPoints.map(d => d.name),
      datasets: [
        {
          label: 'Valor',
          data: dataPoints.map(d => d.sum),
          backgroundColor: PALETTE[3].solid,
          borderRadius: 8
        }
      ]
    };
  }, [filteredDespesas]);

  // 13. Chart Expense Dept
  const chartExpenseDeptData = useMemo(() => {
    const dataPoints = DEPARTMENTS.map(d => {
      const sum = sumValDespesa(filteredDespesas.filter(r => r.departamento === d));
      return { name: DEFAULT_DEPT_LABEL[d] || d, sum };
    });

    return {
      labels: dataPoints.map(d => d.name),
      datasets: [
        {
          label: 'Valor',
          data: dataPoints.map(d => d.sum),
          backgroundColor: PALETTE[2].solid,
          borderRadius: 8
        }
      ]
    };
  }, [filteredDespesas]);

  // 14. Chart Expense Category
  const chartExpenseCategoryData = useMemo(() => {
    const grouped = filteredDespesas.reduce((acc, d) => {
      const cat = d.categoria || 'Outros';
      acc[cat] = (acc[cat] || 0) + d.valor;
      return acc;
    }, {});
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return {
      labels: sorted.map(s => s[0]),
      datasets: [
        {
          label: 'Valor',
          data: sorted.map(s => s[1]),
          backgroundColor: PALETTE[1].solid,
          borderRadius: 8
        }
      ]
    };
  }, [filteredDespesas]);

  // Produtivos Page Calculations
  const prodTotalSum = sumVal(filteredProdutivos, 'total');
  const prodVistaSum = sumVal(filteredProdutivos, 'vista');
  const prodPrazoSum = sumVal(filteredProdutivos, 'prazo');

  // Find top productive
  const topProductive = useMemo(() => {
    const grouped = filteredProdutivos.reduce((acc, r) => {
      acc[r.nome] = (acc[r.nome] || 0) + r.total;
      return acc;
    }, {});
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? sorted[0][0] : '-';
  }, [filteredProdutivos]);

  // 15. Chart Prod Ranking
  const chartProdRankingData = useMemo(() => {
    const grouped = filteredProdutivos.reduce((acc, r) => {
      acc[r.nome] = (acc[r.nome] || 0) + r.total;
      return acc;
    }, {});
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 12);

    return {
      labels: sorted.map(s => s[0]),
      datasets: [
        {
          label: 'Total',
          data: sorted.map(s => s[1]),
          backgroundColor: PALETTE[0].solid,
          borderRadius: 8
        }
      ]
    };
  }, [filteredProdutivos]);

  // 16. Chart Prod Payment
  const chartProdPaymentData = useMemo(() => {
    return {
      labels: ['À vista', 'À prazo'],
      datasets: [
        {
          data: [prodVistaSum, prodPrazoSum],
          backgroundColor: [PALETTE[5].solid, PALETTE[1].solid],
          borderWidth: 0
        }
      ]
    };
  }, [prodVistaSum, prodPrazoSum]);

  // Spreadsheet workbook loading fallback logic
  const handleSpreadsheetUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      
      // Port parsing functions from app.js to convert worksheets to payload
      // (This serves as a backup upload when they drag and drop local spreadsheets directly)
      const data = { resumo: [], servicos: [], despesas: [], folha: [], produtivos: [], custosFixos: [] };
      
      const sheetNames = workbook.SheetNames;
      sheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (json.length === 0) return;
        
        // Simples parsing do Excel consolidador (como no app.js original)
        // (Apenas mapeando as abas consolidadas principais do modelo)
        const nameLower = sheetName.toLowerCase().trim();
        
        if (nameLower === 'resumo') {
          // parse rows into resumen
          for(let i=1; i<json.length; i++) {
            const row = json[i];
            if (row.length < 3) continue;
            data.resumo.push({
              codigo: String(row[0] || ''),
              mesNum: Number(row[1]) || 1,
              mes: String(row[2] || ''),
              departamento: String(row[3] || ''),
              receitaPrazo: Number(row[4]) || 0,
              receitaVista: Number(row[5]) || 0,
              entradas: Number(row[6]) || 0,
              retiradas: Number(row[7]) || 0,
              resultado: Number(row[8]) || 0,
              comprasPrazo: Number(row[9]) || 0,
              comprasMes: Number(row[10]) || 0,
              saidasVista: Number(row[11]) || 0,
              folhaPagamento: Number(row[12]) || 0,
              custoFixo: Number(row[13]) || 0,
              imposto: Number(row[14]) || 0,
              alimentacao: Number(row[15]) || 0,
              materialOS: Number(row[16]) || 0
            });
          }
        } else if (nameLower === 'serviços' || nameLower === 'servicos') {
          for(let i=1; i<json.length; i++) {
            const row = json[i];
            if (row.length < 3) continue;
            data.servicos.push({
              codigo: String(row[0] || ''),
              mesNum: Number(row[1]) || 1,
              mes: String(row[2] || ''),
              departamento: String(row[3] || ''),
              servico: String(row[4] || ''),
              condicao: String(row[5] || ''),
              valor: Number(row[6]) || 0
            });
          }
        } else if (nameLower === 'despesas') {
          for(let i=1; i<json.length; i++) {
            const row = json[i];
            if (row.length < 3) continue;
            data.despesas.push({
              codigo: String(row[0] || ''),
              mesNum: Number(row[1]) || 1,
              mes: String(row[2] || ''),
              departamento: String(row[3] || ''),
              categoria: String(row[4] || ''),
              valor: Number(row[5]) || 0,
              classe: String(row[6] || ''),
              entraResultado: String(row[7]).toLowerCase() !== 'false'
            });
          }
        } else if (nameLower === 'folha') {
          for(let i=1; i<json.length; i++) {
            const row = json[i];
            if (row.length < 3) continue;
            data.folha.push({
              codigo: String(row[0] || ''),
              mesNum: Number(row[1]) || 1,
              mes: String(row[2] || ''),
              departamento: String(row[3] || ''),
              nome: String(row[4] || ''),
              bruto: Number(row[5]) || 0,
              desconto: Number(row[6]) || 0,
              liquido: Number(row[7]) || 0
            });
          }
        } else if (nameLower === 'produtivos') {
          for(let i=1; i<json.length; i++) {
            const row = json[i];
            if (row.length < 3) continue;
            data.produtivos.push({
              codigo: String(row[0] || ''),
              mesNum: Number(row[1]) || 1,
              mes: String(row[2] || ''),
              departamento: String(row[3] || ''),
              nome: String(row[4] || ''),
              prazo: Number(row[5]) || 0,
              vista: Number(row[6]) || 0,
              total: Number(row[7]) || 0
            });
          }
        }
      });

      if (data.resumo.length > 0) {
        localStorage.setItem('pernambucana.financeData.manual.v2', JSON.stringify(data));
        setLocalSpreadsheetPayload(data);
        triggerToast('Planilha carregada e salva localmente.');
      } else {
        alert('Não encontramos as abas padrão consolidadas ("Resumo", "Serviços", "Despesas", "Folha", "Produtivos") no arquivo.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar planilha: ' + err.message);
    }
    e.target.value = '';
  };

  const handleResetData = () => {
    localStorage.removeItem('pernambucana.financeData.manual.v2');
    setLocalSpreadsheetPayload(null);
    clearAll();
    triggerToast('Base resetada para o padrão.');
  };

  const exportCsv = () => {
    const head = ['Mês', 'Código', 'Setor', 'À prazo', 'À vista', 'Entradas', 'Retiradas', 'Resultado', 'Compras/Material'];
    const lines = [
      head.join(';'),
      ...filteredResumo.map(r => [
        r.mes,
        r.codigo,
        DEFAULT_DEPT_LABEL[r.departamento] || r.departamento,
        r.receitaPrazo,
        r.receitaVista,
        r.entradas,
        r.retiradas,
        r.resultado,
        (r.comprasMes || 0) + (r.materialOS || 0)
      ].join(';'))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fechamento-financeiro-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    triggerToast('Tabela exportada em CSV.');
  };

  const currentPeriod = useMemo(() => {
    const meses = Array.from(new Set(resumo.map(r => r.mes)));
    return meses.length > 0 ? meses.join(' • ') : 'Nenhum período';
  }, [resumo]);

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
        onPageChange={setActiveTab}
        currentDept={activeDept}
        onDeptChange={setActiveDept}
        isCadastrosPage={false}
      />

      <main className="main" style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        
        {/* Seção Hero Superior */}
        <section className="hero" id="visao" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <div className="hero-copy" style={{ flex: 1.2, minWidth: '300px' }}>
            <div className="badge"><span></span> Gestão financeira executiva</div>
            <h1>Resultado financeiro por mês e setor.</h1>
            <p>Monitore KPIs consolidados de entradas, saídas, resultado líquido, recebimentos e produtividade em tempo real.</p>
            <div className="hero-actions" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="btn primary" onClick={() => document.body.classList.toggle('presentation')}>Tela Cheia</button>
              <button className="btn ghost" onClick={exportCsv}>Exportar CSV</button>
            </div>
          </div>

          <div className="hero-panel glass" style={{ flex: 1, minWidth: '300px', padding: '16px', borderRadius: '16px' }}>
            <div className="hero-panel-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span>Resultado acumulado</span>
                <strong id="heroResult" className={totalResultado >= 0 ? 'positive' : 'negative'} style={{ display: 'block', fontSize: '24px' }}>
                  {fmtMoney.format(totalResultado)}
                </strong>
              </div>
              <span id="heroMargin" className={`pill ${totalResultado >= 0 ? 'good' : 'bad'}`}>
                {totalMargem.toFixed(1).replace('.', ',')}% margem
              </span>
            </div>
            
            <div style={{ height: '160px', position: 'relative' }}>
              <Line data={chartHeroData} options={commonOptions('Resultado Acumulado', 'x', true)} />
            </div>

            <div className="hero-mini" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
              <div>
                <span>Entradas</span>
                <strong id="heroRevenue" style={{ color: 'var(--green)' }}>{fmtMoney.format(totalEntradas)}</strong>
              </div>
              <div>
                <span>Retiradas</span>
                <strong id="heroCost" style={{ color: 'var(--red)' }}>{fmtMoney.format(totalRetiradas)}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* Toolbar de filtros e Upload */}
        <section className="toolbar glass" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
          <label>
            Mês
            <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
              <option value="all">Todos</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>

          <label>
            Setor
            <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); if (e.target.value !== 'all') setActiveDept(e.target.value); }}>
              <option value="all">Todos</option>
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{DEFAULT_DEPT_LABEL[d]}</option>
              ))}
            </select>
          </label>

          {activeTab === 'despesas' && (
            <label>
              Categoria
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">Todas</option>
                {Array.from(new Set(despesas.map(d => d.categoria))).sort().map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          )}

          <label className="search" style={{ flex: 1 }}>
            Busca
            <input 
              type="search" 
              placeholder="Buscar setor, categoria, serviço..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>

          <div className="upload-box" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="btn import" style={{ cursor: 'pointer' }}>
              Carregar Planilha local
              <input type="file" accept=".xlsx,.xls,.xlsm,.csv" onChange={handleSpreadsheetUpload} style={{ display: 'none' }} />
            </label>
            <button className="btn mini ghost" onClick={handleResetData}>Limpar Base</button>
            <small id="dataSourceInfo" style={{ color: 'var(--muted)', fontSize: '11px' }}>
              {hasData() ? 'Base Firebase Firestore' : localSpreadsheetPayload ? 'Planilha local salva' : 'Base Estática Inicial'}
            </small>
          </div>
        </section>

        {/* KPIs Cards Grid */}
        <section className="kpis" id="kpiGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <article className="kpi glass">
            <span>Entradas</span>
            <strong>{fmtMoney.format(totalEntradas)}</strong>
            <small>Faturamento bruto</small>
          </article>
          <article className="kpi glass">
            <span>Retiradas</span>
            <strong>{fmtMoney.format(totalRetiradas)}</strong>
            <small>Total saídas</small>
          </article>
          <article className="kpi glass">
            <span>Resultado</span>
            <strong className={totalResultado >= 0 ? 'good' : 'bad'}>{fmtMoney.format(totalResultado)}</strong>
            <small>{totalMargem.toFixed(1).replace('.', ',')}% margem</small>
          </article>
          <article className="kpi glass">
            <span>À vista</span>
            <strong>{fmtMoney.format(totalVista)}</strong>
            <small>Recebimento imediato</small>
          </article>
          <article className="kpi glass">
            <span>À prazo</span>
            <strong>{fmtMoney.format(totalPrazo)}</strong>
            <small>A receber</small>
          </article>
          <article className="kpi glass">
            <span>Setores</span>
            <strong>{Array.from(new Set(filteredResumo.map(r => r.departamento))).length}</strong>
            <small>Áreas ativas</small>
          </article>
        </section>

        {/* --- ABA 1: VISÃO GERAL --- */}
        {activeTab === 'geral' && (
          <div className="page active">
            <section className="insights glass" style={{ padding: '20px', borderRadius: '16px', marginBottom: '24px' }}>
              <div className="section-title">
                <span>Resumo executivo</span>
                <h2>Visão Geral do Negócio</h2>
              </div>
              <div className="insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '14px' }}>
                <div className="insight">
                  <b>{fmtMoney.format(totalResultado)}</b>
                  <small>Resultado acumulado no período filtrado.</small>
                </div>
                <div className="insight">
                  <b>{resumo.length > 0 ? DEFAULT_DEPT_LABEL[[...resumo].sort((a,b) => b.resultado - a.resultado)[0]?.departamento] || '-' : '-'}</b>
                  <small>Setor com maior lucratividade acumulada.</small>
                </div>
                <div className="insight">
                  <b>{resumo.length > 0 ? DEFAULT_DEPT_LABEL[[...resumo].sort((a,b) => a.resultado - b.resultado)[0]?.departamento] || '-' : '-'}</b>
                  <small>Ponto de atenção (setor com menor resultado).</small>
                </div>
                <div className="insight">
                  <b>{fmtMoney.format(sumValDespesa(filteredDespesas, r => ['Compras a prazo','Compras do mês','Material OS'].includes(r.categoria)))}</b>
                  <small>Compras cumulativas de insumos e almoxarifado.</small>
                </div>
              </div>
            </section>

            <section className="charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <article className="card glass wide" style={{ gridColumn: 'span 2', height: '320px' }}>
                <div className="card-head">
                  <h3>Entradas, retiradas e resultado</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar data={chartMonthlyData} options={commonOptions('Resultado Mensal', 'x', false)} />
                </div>
              </article>

              <article className="card glass" style={{ height: '320px' }}>
                <div className="card-head">
                  <h3>Resultado por Setor</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar data={chartDeptResultData} options={commonOptions('Resultado por Setor', 'x', true)} />
                </div>
              </article>

              <article className="card glass" style={{ height: '320px' }}>
                <div className="card-head">
                  <h3>Recebimentos à vista x prazo</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Doughnut data={chartPaymentData} options={commonOptions('Recebimentos', 'x', false)} />
                </div>
              </article>

              <article className="card glass" style={{ height: '320px' }}>
                <div className="card-head">
                  <h3>Composição das Despesas</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar data={chartExpensesData} options={commonOptions('Composição das Despesas', 'y', true)} />
                </div>
              </article>

              <article className="card glass" style={{ height: '320px' }}>
                <div className="card-head">
                  <h3>Participação no Faturamento</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Doughnut data={chartRevenueDeptData} options={commonOptions('Faturamento por Setor', 'x', false)} />
                </div>
              </article>

              <article className="card glass" style={{ height: '320px' }}>
                <div className="card-head">
                  <h3>Gastos de Compras e Insumos por Setor</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar data={chartComprasData} options={commonOptions('Compras por Setor', 'x', true)} />
                </div>
              </article>
            </section>
          </div>
        )}

        {/* --- ABA 2: VISÃO POR SETOR --- */}
        {activeTab === 'setor' && (
          <div className="page active">
            <section className="sector-head glass" style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', borderRadius: '16px', marginBottom: '24px', alignItems: 'center' }}>
              <div>
                <span>Detalhamento por Área</span>
                <h2>{DEFAULT_DEPT_LABEL[activeDept] || 'Setor não informado'}</h2>
                <p>Evolução financeira, receita de serviços prestados e controle de retiradas locais.</p>
              </div>
              <div className="sector-score">
                <small>Resultado</small>
                <strong className={sumVal(sectorResumoRows, 'resultado') >= 0 ? 'positive' : 'negative'} style={{ fontSize: '24px' }}>
                  {fmtMoney.format(sumVal(sectorResumoRows, 'resultado'))}
                </strong>
              </div>
            </section>

            <section className="charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <article className="card glass wide" style={{ gridColumn: 'span 2', height: '320px' }}>
                <div className="card-head">
                  <h3>Resultado Mensal</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar data={chartSectorMonthlyData} options={commonOptions('Resultado Mensal do Setor', 'x', false)} />
                </div>
              </article>

              <article className="card glass" style={{ height: '320px' }}>
                <div className="card-head">
                  <h3>Forma de Recebimento</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Doughnut data={chartSectorPaymentData} options={commonOptions('Recebimentos do Setor', 'x', false)} />
                </div>
              </article>

              <article className="card glass" style={{ height: '320px' }}>
                <div className="card-head">
                  <h3>Retiradas e Despesas</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar data={chartSectorExpensesData} options={commonOptions('Despesas por Categoria', 'y', true)} />
                </div>
              </article>

              <article className="card glass" style={{ height: '320px' }}>
                <div className="card-head">
                  <h3>Receita por Tipo de Serviço</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar data={chartSectorServicesData} options={commonOptions('Serviços por Faturamento', 'y', true)} />
                </div>
              </article>
            </section>

            <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3>Fechamento Mensal Consolidado do Setor</h3>
                <em>{sectorResumoRows.length} períodos listados</em>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Código</th>
                      <th>À prazo</th>
                      <th>À vista</th>
                      <th>Entradas</th>
                      <th>Retiradas</th>
                      <th>Resultado</th>
                      <th>Compras/Material</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectorResumoRows.map(r => (
                      <tr key={r.codigo}>
                        <td>{r.mes}</td>
                        <td>{r.codigo}</td>
                        <td>{fmtMoney.format(r.receitaPrazo)}</td>
                        <td>{fmtMoney.format(r.receitaVista)}</td>
                        <td>{fmtMoney.format(r.entradas)}</td>
                        <td>{fmtMoney.format(r.retiradas)}</td>
                        <td><b className={r.resultado >= 0 ? 'positive' : 'negative'}>{fmtMoney.format(r.resultado)}</b></td>
                        <td>{fmtMoney.format((r.comprasMes || 0) + (r.materialOS || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* --- ABA 3: DESPESAS --- */}
        {activeTab === 'despesas' && (
          <div className="page active">
            <section className="insights glass" style={{ padding: '20px', borderRadius: '16px', marginBottom: '24px' }}>
              <div className="section-title">
                <span>Centro de custos</span>
                <h2>Controle de Despesas e Saídas</h2>
              </div>
              <div className="insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '14px' }}>
                <div className="insight">
                  <b>{fmtMoney.format(despesasTotalSum)}</b>
                  <small>Gasto total listado com despesas e compras.</small>
                </div>
                <div className="insight">
                  <b>{fmtMoney.format(despesasRetiradasSum)}</b>
                  <small>Retiradas efetivas que impactam o resultado.</small>
                </div>
                <div className="insight">
                  <b>{fmtMoney.format(despesasComprasSum)}</b>
                  <small>Total em compras/almoxarifado.</small>
                </div>
                <div className="insight">
                  <b>{Array.from(new Set(filteredDespesas.map(d => d.categoria))).length}</b>
                  <small>Categorias distintas de gastos identificados.</small>
                </div>
              </div>
            </section>

            <section className="charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <article className="card glass wide" style={{ gridColumn: 'span 2', height: '320px' }}>
                <div className="card-head">
                  <h3>Despesas por Mês</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar data={chartExpenseMonthlyData} options={commonOptions('Gastos Mensais', 'x', true)} />
                </div>
              </article>

              <article className="card glass" style={{ height: '320px' }}>
                <div className="card-head">
                  <h3>Despesas por Setor</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar data={chartExpenseDeptData} options={commonOptions('Despesas por Setor', 'x', true)} />
                </div>
              </article>

              <article className="card glass" style={{ height: '320px' }}>
                <div className="card-head">
                  <h3>Top 10 Categorias de Gastos</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar data={chartExpenseCategoryData} options={commonOptions('Ranking de Despesas', 'y', true)} />
                </div>
              </article>
            </section>

            <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3>Tabela de Detalhes de Despesas</h3>
                <em>{filteredDespesas.length} registros listados</em>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Setor</th>
                      <th>Categoria</th>
                      <th>Classe</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDespesas.sort((a,b) => a.mesNum - b.mesNum).map((d, index) => (
                      <tr key={index}>
                        <td>{d.mes}</td>
                        <td>{DEFAULT_DEPT_LABEL[d.departamento] || d.departamento}</td>
                        <td>{d.categoria}</td>
                        <td>{d.classe}</td>
                        <td><strong>{fmtMoney.format(d.valor)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* --- ABA 4: PRODUTIVOS --- */}
        {activeTab === 'produtivos' && (
          <div className="page active">
            <section className="insights glass" style={{ padding: '20px', borderRadius: '16px', marginBottom: '24px' }}>
              <div className="section-title">
                <span>Rendimento técnico</span>
                <h2>Produtividade dos Técnicos</h2>
              </div>
              <div className="insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '14px' }}>
                <div className="insight">
                  <b>{fmtMoney.format(prodTotalSum)}</b>
                  <small>Soma dos repasses de produtividade.</small>
                </div>
                <div className="insight">
                  <b>{fmtMoney.format(prodVistaSum)}</b>
                  <small>Repasse de serviços pagos à vista.</small>
                </div>
                <div className="insight">
                  <b>{fmtMoney.format(prodPrazoSum)}</b>
                  <small>Repasse de serviços faturados à prazo.</small>
                </div>
                <div className="insight">
                  <b>{topProductive}</b>
                  <small>Produtivo com maior destaque financeiro.</small>
                </div>
              </div>
            </section>

            <section className="charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <article className="card glass wide" style={{ gridColumn: 'span 2', height: '320px' }}>
                <div className="card-head">
                  <h3>Top Produtivos (Valor Total)</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar data={chartProdRankingData} options={commonOptions('Ranking de Produtores', 'y', true)} />
                </div>
              </article>

              <article className="card glass" style={{ height: '320px' }}>
                <div className="card-head">
                  <h3>Recebimentos Relacionados</h3>
                </div>
                <div style={{ height: '240px', position: 'relative' }}>
                  <Doughnut data={chartProdPaymentData} options={commonOptions('Faturamento por Tipo', 'x', false)} />
                </div>
              </article>
            </section>

            <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3>Detalhamento Individual de Produtividade</h3>
                <em>{filteredProdutivos.length} linhas de registros</em>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Setor</th>
                      <th>Produtivo</th>
                      <th>À prazo</th>
                      <th>À vista</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProdutivos.sort((a,b) => b.total - a.total).map((p, index) => (
                      <tr key={index}>
                        <td>{p.mes}</td>
                        <td>{DEFAULT_DEPT_LABEL[p.departamento] || p.departamento}</td>
                        <td>{p.nome}</td>
                        <td>{fmtMoney.format(p.prazo)}</td>
                        <td>{fmtMoney.format(p.vista)}</td>
                        <td><strong>{fmtMoney.format(p.total)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* --- ABA 5: DETALHES FECHAMENTO --- */}
        {activeTab === 'detalhes' && (
          <div className="page active">
            <section className="details glass" style={{ padding: '20px', borderRadius: '16px', marginBottom: '24px' }}>
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3>Fechamento Consolidado Final por Período</h3>
                <em>{filteredResumo.length} linhas de fechamento</em>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Código</th>
                      <th>Setor</th>
                      <th>À prazo</th>
                      <th>À vista</th>
                      <th>Entradas</th>
                      <th>Retiradas</th>
                      <th>Resultado</th>
                      <th>Compras/Material</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResumo.sort((a,b) => a.mesNum - b.mesNum || a.departamento.localeCompare(b.departamento)).map(r => (
                      <tr key={r.codigo}>
                        <td>{r.mes}</td>
                        <td>{r.codigo}</td>
                        <td>{DEFAULT_DEPT_LABEL[r.departamento] || r.departamento}</td>
                        <td>{fmtMoney.format(r.receitaPrazo)}</td>
                        <td>{fmtMoney.format(r.receitaVista)}</td>
                        <td>{fmtMoney.format(r.entradas)}</td>
                        <td>{fmtMoney.format(r.retiradas)}</td>
                        <td><b className={r.resultado >= 0 ? 'positive' : 'negative'}>{fmtMoney.format(r.resultado)}</b></td>
                        <td>{fmtMoney.format((r.comprasMes || 0) + (r.materialOS || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="details glass" style={{ padding: '20px', borderRadius: '16px' }}>
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3>Serviços Consolidados por Categoria e Tipo</h3>
                <em>{filteredServicos.length} registros consolidados</em>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Setor</th>
                      <th>Serviço</th>
                      <th>Condição</th>
                      <th>Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServicos.sort((a,b) => a.mesNum - b.mesNum).map((s, index) => (
                      <tr key={index}>
                        <td>{s.mes}</td>
                        <td>{DEFAULT_DEPT_LABEL[s.departamento] || s.departamento}</td>
                        <td>{s.servico}</td>
                        <td>{s.condicao}</td>
                        <td><strong>{fmtMoney.format(s.valor)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

      </main>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast show" id="toast">{toastMessage}</div>
      )}
    </div>
  );
};

export default Dashboard;
