const STORAGE_KEY = 'pernambucana.financeData.manual.v2';
const THEME_STORAGE_KEY = 'pernambucana.financeDashboard.theme.v1';
const DEFAULT_FINANCE_DATA = window.FINANCE_DATA || {};
const DEFAULT_DEPARTMENTS = ['Mecanica','Peças','Retifica','Torneadora','Caldeiraria'];
const DEFAULT_DEPT_LABEL = {Mecanica:'Mecânica','Peças':'Peças',Retifica:'Retífica',Torneadora:'Torneadora',Caldeiraria:'Caldeiraria'};
let payload = loadStoredFinanceData() || DEFAULT_FINANCE_DATA || {};
let resumo = payload.resumo || [];
let servicos = payload.servicos || [];
let despesas = payload.despesas || [];
let folha = payload.folha || [];
let produtivos = payload.produtivos || [];
const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
let departments = (payload.meta && payload.meta.departamentos && payload.meta.departamentos.length) ? payload.meta.departamentos : DEFAULT_DEPARTMENTS.slice();
let deptLabel = {...DEFAULT_DEPT_LABEL, ...((payload.meta && payload.meta.departamentosLabel) || {})};
const fmtMoney = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const fmtNum = new Intl.NumberFormat('pt-BR');
const $ = id => document.getElementById(id);
const state = { page:'geral', dept:'all', charts:{} };
if (window.ChartDataLabels) { Chart.register(ChartDataLabels); }

function savedTheme(){
  return localStorage.getItem(THEME_STORAGE_KEY) === 'white' ? 'white' : 'black';
}
function isWhiteTheme(){
  return document.body.classList.contains('theme-white');
}
function chartTheme(){
  return isWhiteTheme() ? {
    axis:'#526276',
    grid:'rgba(9,33,51,.10)',
    legend:'#203449',
    labelColor:'#102033',
    labelBg:'rgba(255,255,255,.94)',
    labelBorder:'rgba(9,33,51,.16)'
  } : {
    axis:'#b9c6d7',
    gridStrong:'rgba(255,255,255,.08)',
    grid:'rgba(255,255,255,.06)',
    legend:'#dfeaf7',
    labelColor:'#ffffff',
    labelBg:'rgba(2,9,17,.82)',
    labelBorder:'rgba(255,255,255,.16)'
  };
}
function applyTheme(theme, rerender=false){
  const useWhite = theme === 'white';
  document.body.classList.toggle('theme-white', useWhite);
  localStorage.setItem(THEME_STORAGE_KEY, useWhite ? 'white' : 'black');
  const btn = $('btnThemeToggle');
  if(btn){
    btn.textContent = useWhite ? 'Tema black' : 'Tema white';
    btn.setAttribute('aria-label', useWhite ? 'Alternar para tema black' : 'Alternar para tema white');
  }
  if(rerender) render();
}

function loadStoredFinanceData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.resumo) ? parsed : null;
  }catch(err){
    console.warn('Não foi possível ler a base salva localmente.', err);
    return null;
  }
}
function refreshDataRefs(nextPayload){
  payload = nextPayload || {};
  resumo = Array.isArray(payload.resumo) ? payload.resumo : [];
  servicos = Array.isArray(payload.servicos) ? payload.servicos : [];
  despesas = Array.isArray(payload.despesas) ? payload.despesas : [];
  folha = Array.isArray(payload.folha) ? payload.folha : [];
  produtivos = Array.isArray(payload.produtivos) ? payload.produtivos : [];
  const fromMeta = payload.meta && Array.isArray(payload.meta.departamentos) ? payload.meta.departamentos : [];
  departments = unique([...fromMeta, ...resumo.map(r=>r.departamento), ...despesas.map(r=>r.departamento), ...servicos.map(r=>r.departamento)]);
  departments = DEFAULT_DEPARTMENTS.filter(d=>departments.includes(d)).concat(departments.filter(d=>!DEFAULT_DEPARTMENTS.includes(d)));
  if(!departments.length) departments = DEFAULT_DEPARTMENTS.slice();
  deptLabel = {...DEFAULT_DEPT_LABEL, ...((payload.meta && payload.meta.departamentosLabel) || {})};
}

function prettyDept(d){ return deptLabel[d] || d || '-'; }
function escapeHtml(s){ return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function short(s,n=28){ s=String(s??''); return s.length>n?s.slice(0,n-1)+'…':s; }
function sumVal(rows,field){ return rows.reduce((a,r)=>a+(+r[field]||0),0); }
function sum(rows,pred){ return rows.reduce((a,r)=>a+(pred&&!pred(r)?0:(+r.valor||0)),0); }
function unique(a){ return [...new Set(a.filter(v=>v!==undefined&&v!==null&&v!==''))]; }
function entries(obj){ return Object.entries(obj).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value); }
function group(rows,key,valueField='valor'){
  return rows.reduce((acc,r)=>{ const k=r[key] || 'Não informado'; acc[k]=(acc[k]||0)+(+r[valueField]||0); return acc; },{});
}
function toast(msg){ const el=$('toast'); if(!el) return; el.textContent=msg; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2600); }
function filteredResumo(){
  const m=$('monthFilter').value, d=$('deptFilter').value, q=$('searchInput').value.trim().toLowerCase();
  return resumo.filter(r=>(m==='all'||String(r.mesNum)===m)&&(d==='all'||r.departamento===d)&&(!q||Object.values(r).join(' ').toLowerCase().includes(q)));
}
function filteredDespesas(){
  const m=$('monthFilter').value, d=$('deptFilter').value, c=$('categoryFilter').value, q=$('searchInput').value.trim().toLowerCase();
  return despesas.filter(r=>(m==='all'||String(r.mesNum)===m)&&(d==='all'||r.departamento===d)&&(c==='all'||r.categoria===c)&&(!q||Object.values(r).join(' ').toLowerCase().includes(q)));
}
function filteredServicos(){
  const m=$('monthFilter').value, d=$('deptFilter').value, q=$('searchInput').value.trim().toLowerCase();
  return servicos.filter(r=>(m==='all'||String(r.mesNum)===m)&&(d==='all'||r.departamento===d)&&(!q||Object.values(r).join(' ').toLowerCase().includes(q)));
}
function filteredProdutivos(){
  const m=$('monthFilter').value, d=$('deptFilter').value, q=$('searchInput').value.trim().toLowerCase();
  return produtivos.filter(r=>(m==='all'||String(r.mesNum)===m)&&(d==='all'||r.departamento===d)&&(!q||Object.values(r).join(' ').toLowerCase().includes(q)));
}
const PALETTE = [
  {solid:'rgba(0,126,122,.92)', soft:'rgba(0,126,122,.28)', border:'rgba(0,126,122,1)'},
  {solid:'rgba(236,177,31,.92)', soft:'rgba(236,177,31,.28)', border:'rgba(236,177,31,1)'},
  {solid:'rgba(91,155,213,.92)', soft:'rgba(91,155,213,.28)', border:'rgba(91,155,213,1)'},
  {solid:'rgba(255,107,122,.92)', soft:'rgba(255,107,122,.28)', border:'rgba(255,107,122,1)'},
  {solid:'rgba(132,94,247,.92)', soft:'rgba(132,94,247,.28)', border:'rgba(132,94,247,1)'},
  {solid:'rgba(45,212,191,.92)', soft:'rgba(45,212,191,.28)', border:'rgba(45,212,191,1)'},
  {solid:'rgba(251,146,60,.92)', soft:'rgba(251,146,60,.28)', border:'rgba(251,146,60,1)'},
  {solid:'rgba(163,230,53,.92)', soft:'rgba(163,230,53,.28)', border:'rgba(163,230,53,1)'}
];
const SERIES_COLORS = {
  'Entradas': PALETTE[0],
  'Retiradas': PALETTE[3],
  'Resultado': PALETTE[1],
  'À vista': PALETTE[5],
  'À prazo': PALETTE[1],
  'Valor': PALETTE[2],
  'Total': PALETTE[2],
  'Entradas/Receita': PALETTE[0]
};
function colorForSeries(label, index=0){ return SERIES_COLORS[label] || PALETTE[index % PALETTE.length]; }
function gradientFromPalette(ctx, area, palette){
  const g = ctx.createLinearGradient(0, 0, 0, area.bottom || 320);
  g.addColorStop(0, palette.solid);
  g.addColorStop(1, palette.soft);
  return g;
}
function colorsByPoint(count, mode='solid'){
  return Array.from({length: count}, (_,i) => PALETTE[i % PALETTE.length][mode]);
}
function formatCompactCurrency(value){
  const n = +value || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if(abs >= 1_000_000) return `${sign}R$ ${Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(abs)}`;
  if(abs >= 1_000) return `${sign}R$ ${Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(abs)}`;
  return `${sign}${fmtMoney.format(abs)}`;
}
function draw(id,type,data,opts={}){
  const canvas=$(id); if(!canvas) return;
  if(state.charts[id]) state.charts[id].destroy();
  const ctx=canvas.getContext('2d');
  const baseType = type;
  data.datasets=(data.datasets||[]).map((ds,i)=>{
    const chartType = ds.type || baseType;
    const count = Array.isArray(ds.data) ? ds.data.length : 0;
    const palette = colorForSeries(ds.label, i);
    const singleSeriesBars = chartType==='bar' && (data.datasets||[]).length===1 && count>1;
    const pieLike = chartType==='doughnut' || chartType==='pie';
    let backgroundColor = ds.backgroundColor;
    let borderColor = ds.borderColor;
    if(!backgroundColor){
      if(pieLike){
        backgroundColor = colorsByPoint(count,'solid');
      } else if(singleSeriesBars){
        backgroundColor = colorsByPoint(count,'soft');
      } else if(chartType==='line'){
        backgroundColor = palette.soft;
      } else {
        backgroundColor = (context)=>gradientFromPalette(context.chart.ctx,context.chart.chartArea||{},palette);
      }
    }
    if(!borderColor){
      if(pieLike || singleSeriesBars){
        borderColor = colorsByPoint(count,'border');
      } else {
        borderColor = palette.border;
      }
    }
    return {
      borderColor,
      backgroundColor,
      borderWidth: chartType==='line' ? 3 : 1.5,
      pointRadius: chartType==='line' ? 4 : 0,
      pointHoverRadius: chartType==='line' ? 5 : 0,
      fill: chartType==='line' ? false : (ds.fill ?? true),
      tension:.35,
      ...ds
    };
  });
  const isHorizontal = opts.indexAxis === 'y';
  const theme = chartTheme();
  const gridStrong = theme.gridStrong || theme.grid;
  const scales = type==='doughnut' ? {} : (isHorizontal ? {
    x:{ticks:{color:theme.axis,callback:v=>Intl.NumberFormat('pt-BR',{notation:'compact'}).format(v)},grid:{color:gridStrong}},
    y:{ticks:{color:theme.axis,font:{weight:'700'},callback:function(value){ return this.getLabelForValue(value); }},grid:{color:theme.grid}}
  } : {
    x:{ticks:{color:theme.axis,font:{weight:'700'}},grid:{color:theme.grid}},
    y:{ticks:{color:theme.axis,callback:v=>Intl.NumberFormat('pt-BR',{notation:'compact'}).format(v)},grid:{color:gridStrong}}
  });
  const datalabelsDefaults = {
    display: (context) => {
      const chartType = context.dataset.type || context.chart.config.type;
      const value = +context.dataset.data[context.dataIndex] || 0;
      if(value === 0) return false;
      if(chartType === 'doughnut' || chartType === 'pie'){
        const data = context.dataset.data || [];
        const total = data.reduce((a,b)=>a+(+b||0),0);
        return total ? (Math.abs(value)/total) >= 0.05 : false;
      }
      return true;
    },
    color: theme.labelColor,
    backgroundColor: theme.labelBg,
    borderColor: theme.labelBorder,
    borderWidth: 1,
    borderRadius: 6,
    padding: {top:3,right:6,bottom:3,left:6},
    font: {weight:'900', size:10},
    textAlign: 'center',
    clamp: false,
    clip: false,
    formatter: (value, context) => {
      return formatCompactCurrency(value);
    },
    anchor: (context) => {
      const chartType = context.dataset.type || context.chart.config.type;
      if(chartType === 'doughnut' || chartType === 'pie') return 'end';
      if(chartType === 'line') return 'end';
      return 'end';
    },
    align: (context) => {
      const chartType = context.dataset.type || context.chart.config.type;
      if(chartType === 'doughnut' || chartType === 'pie') return 'end';
      if(chartType === 'line') return 'top';
      const horizontal = context.chart.options.indexAxis === 'y';
      const value = +context.dataset.data[context.dataIndex] || 0;
      if(horizontal) return value >= 0 ? 'right' : 'left';
      return value >= 0 ? 'top' : 'bottom';
    },
    offset: (context) => {
      const chartType = context.dataset.type || context.chart.config.type;
      if(chartType === 'doughnut' || chartType === 'pie') return 10;
      if(chartType === 'line') return 6;
      return 6;
    }
  };
  const pluginOpts = opts.plugins || {};
  const layoutOpts = opts.layout || {};
  const chartOpts = {...opts};
  delete chartOpts.plugins;
  delete chartOpts.layout;
  delete chartOpts.scales;
  delete chartOpts.interaction;
  const isPieLikeChart = type === 'doughnut' || type === 'pie';
  const defaultPadding = isPieLikeChart
    ? {top:42,right:74,left:74,bottom:42}
    : {top:44,right:isHorizontal?110:34,left:18,bottom:18};
  const defaultLegend = {labels:{color:theme.legend,font:{weight:'800'},usePointStyle:true,pointStyle:'circle',boxWidth:10,boxHeight:10}};
  const defaultTooltip = {callbacks:{label:(ctx)=>`${ctx.dataset.label||''}: ${fmtMoney.format(ctx.parsed.y ?? ctx.parsed.x ?? ctx.parsed)}`}};
  state.charts[id]=new Chart(ctx,{type,data,options:{
    responsive:true,
    maintainAspectRatio:false,
    ...chartOpts,
    layout:{...layoutOpts,padding:{...defaultPadding,...(layoutOpts.padding||{})}},
    interaction:{mode:'index',intersect:false,...(opts.interaction||{})},
    plugins:{
      legend:{...defaultLegend,...(pluginOpts.legend||{})},
      tooltip:{...defaultTooltip,...(pluginOpts.tooltip||{})},
      datalabels:{...datalabelsDefaults,...(pluginOpts.datalabels||{})}
    },
    scales:{...scales,...(opts.scales||{})}
  }});
}


function normalizeText(value){
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function normalizeKey(value){ return normalizeText(value).replace(/\s+/g,''); }
function normalizeDepartmentName(value){
  const n = normalizeText(value);
  if(!n || n === 'none' || n === 'nan' || n === '-') return '';
  if(n.includes('retif')) return 'Retifica';
  if(n.includes('mecan') || n === 'm') return 'Mecanica';
  if(n.includes('peca') || n === 'p') return 'Peças';
  if(n.includes('torne') || n === 't') return 'Torneadora';
  if(n.includes('calde') || n === 'c') return 'Caldeiraria';
  return String(value ?? '').trim();
}
function deptFromCode(code){
  const prefix = String(code||'').trim().charAt(0).toUpperCase();
  return ({R:'Retifica',M:'Mecanica',P:'Peças',T:'Torneadora',C:'Caldeiraria'})[prefix] || '';
}
function monthFromCode(code){
  const m = String(code||'').match(/(1[0-2]|0?[1-9])$/);
  return m ? Number(m[1]) : null;
}
function toNumber(value){
  if(typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if(value instanceof Date) return 0;
  let s = String(value ?? '').trim();
  if(!s) return 0;
  s = s.replace(/\s/g,'').replace(/R\$/gi,'').replace(/[^0-9,.-]/g,'');
  if(!s || s === '-' || s === ',' || s === '.') return 0;
  if(s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g,'').replace(',', '.');
  else s = s.replace(/,/g,'');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function boolValue(value){
  if(typeof value === 'boolean') return value;
  const n = normalizeText(value);
  if(['sim','s','true','verdadeiro','1','yes'].includes(n)) return true;
  if(['nao','n','false','falso','0','no'].includes(n)) return false;
  return Boolean(value);
}
function firstValue(row, aliases){
  for(const a of aliases){
    if(row[a] !== undefined && row[a] !== '') return row[a];
  }
  return '';
}
function getByAliases(row, aliases, asNumber=false){
  const v = firstValue(row, aliases);
  return asNumber ? toNumber(v) : v;
}
function rowsFromSheet(workbook, sheetName){
  const ws = workbook.Sheets[sheetName];
  if(!ws) return [];
  return XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true,blankrows:false});
}
function sheetObjectsFromRows(rows){
  const known = new Set(['codigo','cod','mes','mesnum','departamento','setor','area','servico','servicos','condicao','categoria','classe','valor','nome','produtivo','bruto','desconto','liquido','total','vista','prazo','entradas','retiradas','resultado']);
  let headerIndex = rows.findIndex(row => row.map(normalizeKey).filter(k=>k && known.has(k)).length >= 2);
  if(headerIndex < 0) headerIndex = rows.findIndex(row => row.filter(c=>String(c??'').trim()).length >= 3);
  if(headerIndex < 0) return [];
  const headers = rows[headerIndex].map(h=>normalizeKey(h));
  return rows.slice(headerIndex+1).map(row=>{
    const obj = {};
    headers.forEach((h,i)=>{ if(h) obj[h]=row[i]; });
    return obj;
  }).filter(obj => Object.values(obj).some(v=>String(v??'').trim() !== ''));
}
function normalizeDirectRow(kind, row){
  const codigo = String(getByAliases(row,['codigo','cod','código']) || '').trim();
  const mesNum = Number(getByAliases(row,['mesnum','mesnumero','nmes','mesn'], true)) || monthFromCode(codigo) || monthByName(getByAliases(row,['mes'])) || 0;
  const mes = String(getByAliases(row,['mes']) || (months[mesNum-1] || '')).trim();
  const departamento = normalizeDepartmentName(getByAliases(row,['departamento','setor','area','área'])) || deptFromCode(codigo);
  if(kind === 'resumo'){
    const receitaPrazo = getByAliases(row,['receitaprazo','aprazo','recebimentosaprazo','receitaprazor','prazo'], true);
    const receitaVista = getByAliases(row,['receitavista','avista','recebimentosavista','vista'], true);
    const comprasPrazo = getByAliases(row,['comprasprazo','comprasaprazo'], true);
    const comprasMes = getByAliases(row,['comprasmes','comprasdomes'], true);
    const saidasVista = getByAliases(row,['saidasvista','saidasavista','saídaavista','saidaavista'], true);
    const folhaPagamento = getByAliases(row,['folhapagamento','folhadepagamento','folha'], true);
    const custoFixo = getByAliases(row,['custofixo'], true);
    const imposto = getByAliases(row,['imposto','impostos'], true);
    const alimentacao = getByAliases(row,['alimentacao','alimentação'], true);
    const materialOS = getByAliases(row,['materialos','material'], true);
    const entradas = getByAliases(row,['entradas','totalentradas','receitatotal'], true) || receitaPrazo + receitaVista;
    const retiradas = getByAliases(row,['retiradas','totalretiradas','saidas','saídas'], true) || comprasPrazo + saidasVista + folhaPagamento + custoFixo + imposto + alimentacao;
    const resultado = getByAliases(row,['resultado','saldo'], true) || entradas - retiradas;
    return {codigo, mesNum, mes, departamento, receitaPrazo, receitaVista, entradas, retiradas, resultado, comprasPrazo, comprasMes, saidasVista, folhaPagamento, custoFixo, imposto, alimentacao, materialOS};
  }
  if(kind === 'servicos') return {codigo, mesNum, mes, departamento, servico:String(getByAliases(row,['servico','servicos','serviço','serviços','tipo'])||'Serviços').trim(), condicao:String(getByAliases(row,['condicao','condição','forma','pagamento'])||'Total').trim(), valor:getByAliases(row,['valor','total','receita'], true)};
  if(kind === 'despesas') return {codigo, mesNum, mes, departamento, categoria:String(getByAliases(row,['categoria','despesa','tipo'])||'Despesa').trim(), valor:getByAliases(row,['valor','total'], true), classe:String(getByAliases(row,['classe'])||'Retirada').trim(), entraResultado: boolValue(getByAliases(row,['entraresultado','resultado','considerar']))};
  if(kind === 'folha') return {codigo, mesNum, mes, departamento, nome:String(getByAliases(row,['nome','colaborador','funcionario','funcionário'])||'').trim(), bruto:getByAliases(row,['bruto','salariobruto','salário'], true), desconto:getByAliases(row,['desconto','descontos'], true), liquido:getByAliases(row,['liquido','líquido','valorliquido','valor'], true)};
  if(kind === 'produtivos') return {codigo, mesNum, mes, departamento, nome:String(getByAliases(row,['nome','produtivo','colaborador'])||'').trim(), prazo:getByAliases(row,['prazo','aprazo'], true), vista:getByAliases(row,['vista','avista'], true), total:getByAliases(row,['total','valor'], true)};
  if(kind === 'custosFixos') return {codigo, mesNum, mes, departamento, valor:getByAliases(row,['valor','total','custofixo'], true)};
  return null;
}
function monthByName(name){
  const n = normalizeText(name);
  const idx = months.findIndex(m=>normalizeText(m).startsWith(n) || n.startsWith(normalizeText(m).slice(0,3)));
  return idx >= 0 ? idx + 1 : 0;
}
function directKindFromSheet(sheetName){
  const n = normalizeKey(sheetName);
  if(['resumo','fechamento','consolidado','base','dados'].includes(n)) return 'resumo';
  if(['servicos','serviços','receitas'].includes(n)) return 'servicos';
  if(['despesas','retiradas','compras'].includes(n)) return 'despesas';
  if(['folha','folhadepagamento','pagamentos'].includes(n)) return 'folha';
  if(['produtivos','produtividade','ranking'].includes(n)) return 'produtivos';
  if(['custosfixos','custofixo'].includes(n)) return 'custosFixos';
  return '';
}
function buildDirectDataFromWorkbook(workbook){
  const data = {resumo:[],servicos:[],despesas:[],folha:[],produtivos:[],custosFixos:[]};
  workbook.SheetNames.forEach(sheetName=>{
    const kind = directKindFromSheet(sheetName);
    if(!kind) return;
    const rows = sheetObjectsFromRows(rowsFromSheet(workbook, sheetName));
    rows.forEach(row=>{
      const out = normalizeDirectRow(kind, row);
      if(out && (out.codigo || out.mesNum || out.departamento)) data[kind].push(out);
    });
  });
  return data;
}
function cellHasLabel(cell, labels){
  const n = normalizeText(cell);
  return labels.some(label => n.includes(normalizeText(label)));
}
function findLabelValue(rows, labels){
  for(let r=0; r<rows.length; r++){
    const row = rows[r] || [];
    for(let c=0; c<row.length; c++){
      if(!cellHasLabel(row[c], labels)) continue;
      const candidates = [];
      for(let cc=c+1; cc<Math.min(row.length, c+9); cc++) candidates.push(row[cc]);
      for(let rr=r+1; rr<Math.min(rows.length, r+8); rr++){
        candidates.push((rows[rr]||[])[c]);
        candidates.push((rows[rr]||[])[c+1]);
      }
      for(const candidate of candidates){
        const n = toNumber(candidate);
        if(n !== 0) return n;
      }
    }
  }
  return 0;
}
function findHeaderMap(rows, includeLabels, optionalLabels=[]){
  for(let r=0; r<rows.length; r++){
    const normalized = (rows[r]||[]).map(normalizeText);
    const hasAll = includeLabels.every(label => normalized.some(cell=>cell.includes(normalizeText(label))));
    if(!hasAll) continue;
    const map = {row:r};
    [...includeLabels, ...optionalLabels].forEach(label=>{
      const idx = normalized.findIndex(cell=>cell.includes(normalizeText(label)));
      if(idx >= 0) map[normalizeKey(label)] = idx;
    });
    return map;
  }
  return null;
}
function parseServicesFromCodeSheet(rows, base){
  const serviceNames = ['Cabeçote','Bloco','Biela','Virabrequim','Comando','Peças','Outras','Serviços','Soldas'];
  const out = [];
  rows.forEach(row=>{
    const cells = row || [];
    cells.forEach((cell,idx)=>{
      const service = serviceNames.find(s=>normalizeText(cell) === normalizeText(s) || normalizeText(cell).includes(normalizeText(s)));
      if(!service) return;
      const nums = cells.slice(idx+1).map(toNumber).filter(n=>n!==0);
      if(nums.length >= 2){
        out.push({...base, servico:service, condicao:'À prazo', valor:nums[0]});
        out.push({...base, servico:service, condicao:'À vista', valor:nums[1]});
      }else if(nums.length === 1){
        out.push({...base, servico:service, condicao:'Total', valor:nums[0]});
      }
    });
  });
  const seen = new Set();
  return out.filter(r=>{
    const key = `${r.servico}|${r.condicao}|${r.valor}`;
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function parseFolhaFromCodeSheet(rows, base){
  const map = findHeaderMap(rows, ['nome'], ['bruto','desconto','liquido','líquido','valor']);
  if(!map || map.row < 0) return [];
  const nomeCol = map.nome;
  const brutoCol = map.bruto ?? map.valor;
  const descontoCol = map.desconto;
  const liquidoCol = map.liquido ?? map['líquido'] ?? map.valor;
  const out = [];
  for(let r=map.row+1; r<rows.length; r++){
    const row = rows[r] || [];
    const nome = String(row[nomeCol] ?? '').trim();
    if(!nome || normalizeText(nome).includes('total')) continue;
    const bruto = toNumber(row[brutoCol]);
    const desconto = toNumber(row[descontoCol]);
    const liquido = toNumber(row[liquidoCol]) || Math.max(bruto - desconto, 0);
    if(bruto || liquido) out.push({...base, nome, bruto, desconto, liquido});
  }
  return out;
}
function parseProdutivosFromCodeSheet(rows, base){
  const map = findHeaderMap(rows, ['nome'], ['produtivo','prazo','vista','total']);
  if(!map || (map.prazo === undefined && map.vista === undefined && map.total === undefined)) return [];
  const nomeCol = map.nome ?? map.produtivo;
  const out = [];
  for(let r=map.row+1; r<rows.length; r++){
    const row = rows[r] || [];
    const nome = String(row[nomeCol] ?? '').trim();
    if(!nome || normalizeText(nome).includes('total')) continue;
    const prazo = toNumber(row[map.prazo]);
    const vista = toNumber(row[map.vista]);
    const total = toNumber(row[map.total]) || prazo + vista;
    if(total) out.push({...base, nome, prazo, vista, total});
  }
  return out;
}
function buildCodeDataFromWorkbook(workbook){
  const data = {resumo:[],servicos:[],despesas:[],folha:[],produtivos:[],custosFixos:[]};
  workbook.SheetNames.forEach(sheetName=>{
    const compact = String(sheetName||'').trim().replace(/\s+/g,'');
    const match = compact.match(/^([RMPCT])0?(1[0-2]|[1-9])$/i);
    if(!match) return;
    const codigo = `${match[1].toUpperCase()}${Number(match[2])}`;
    const mesNum = monthFromCode(codigo);
    const mes = months[mesNum-1] || String(mesNum);
    const departamento = deptFromCode(codigo);
    const base = {codigo, mesNum, mes, departamento};
    const rows = rowsFromSheet(workbook, sheetName);
    const servs = parseServicesFromCodeSheet(rows, base);
    const folhaRows = parseFolhaFromCodeSheet(rows, base);
    const prodRows = parseProdutivosFromCodeSheet(rows, base);
    const receitaPrazo = findLabelValue(rows, ['receita a prazo','receita prazo','recebimentos a prazo','total a prazo']) || sum(servs.filter(r=>normalizeText(r.condicao).includes('prazo')));
    const receitaVista = findLabelValue(rows, ['receita a vista','receita vista','recebimentos a vista','total a vista']) || sum(servs.filter(r=>normalizeText(r.condicao).includes('vista')));
    const comprasPrazo = findLabelValue(rows, ['compras a prazo','compra a prazo']);
    const comprasMes = findLabelValue(rows, ['compras do mês','compras do mes','compra do mês','compra do mes']);
    const saidasVista = findLabelValue(rows, ['saídas à vista','saidas a vista','saída à vista','saida a vista']);
    const folhaPagamento = findLabelValue(rows, ['folha de pagamento','folha pagamento']) || sumVal(folhaRows,'liquido');
    const custoFixo = findLabelValue(rows, ['custo fixo','custos fixos']);
    const imposto = findLabelValue(rows, ['imposto','impostos']);
    const alimentacao = findLabelValue(rows, ['alimentação','alimentacao']);
    const materialOS = findLabelValue(rows, ['material os','material o.s','material ordem']);
    const entradas = findLabelValue(rows, ['entradas','total entradas','receita total']) || receitaPrazo + receitaVista;
    const retiradas = findLabelValue(rows, ['retiradas','total retiradas','saídas','saidas']) || comprasPrazo + saidasVista + folhaPagamento + custoFixo + imposto + alimentacao;
    const resultado = findLabelValue(rows, ['resultado','saldo']) || entradas - retiradas;
    const summaryHasData = entradas || retiradas || resultado || comprasPrazo || comprasMes || materialOS;
    if(summaryHasData) data.resumo.push({...base, receitaPrazo, receitaVista, entradas, retiradas, resultado, comprasPrazo, comprasMes, saidasVista, folhaPagamento, custoFixo, imposto, alimentacao, materialOS});
    data.servicos.push(...servs);
    data.folha.push(...folhaRows);
    data.produtivos.push(...prodRows);
    const despesasBase = [
      ['Compras a prazo',comprasPrazo,'Retirada',true],
      ['Compras do mês',comprasMes,'Compra complementar',false],
      ['Saídas à vista',saidasVista,'Retirada',true],
      ['Folha de pagamento',folhaPagamento,'Retirada',true],
      ['Custo fixo',custoFixo,'Retirada',true],
      ['Imposto',imposto,'Retirada',true],
      ['Alimentação',alimentacao,'Retirada',true],
      ['Material OS',materialOS,'Compra complementar',false]
    ];
    despesasBase.forEach(([categoria,valor,classe,entraResultado])=>{ if(valor) data.despesas.push({...base,categoria,valor,classe,entraResultado}); });
  });
  return data;
}
function finalizeFinanceData(data){
  data = data || {};
  ['resumo','servicos','despesas','folha','produtivos','custosFixos'].forEach(k=>{ if(!Array.isArray(data[k])) data[k] = []; });
  data.resumo = data.resumo.map(r=>{
    const codigo = String(r.codigo || '').trim();
    const mesNum = Number(r.mesNum) || monthFromCode(codigo) || monthByName(r.mes) || 0;
    const mes = r.mes || months[mesNum-1] || '';
    const departamento = normalizeDepartmentName(r.departamento) || deptFromCode(codigo) || 'Não informado';
    const receitaPrazo = toNumber(r.receitaPrazo), receitaVista = toNumber(r.receitaVista);
    const comprasPrazo = toNumber(r.comprasPrazo), comprasMes = toNumber(r.comprasMes), saidasVista = toNumber(r.saidasVista), folhaPagamento = toNumber(r.folhaPagamento), custoFixo = toNumber(r.custoFixo), imposto = toNumber(r.imposto), alimentacao = toNumber(r.alimentacao), materialOS = toNumber(r.materialOS);
    const entradas = toNumber(r.entradas) || receitaPrazo + receitaVista;
    const retiradas = toNumber(r.retiradas) || comprasPrazo + saidasVista + folhaPagamento + custoFixo + imposto + alimentacao;
    const resultado = toNumber(r.resultado) || entradas - retiradas;
    return {codigo, mesNum, mes, departamento, receitaPrazo, receitaVista, entradas, retiradas, resultado, comprasPrazo, comprasMes, saidasVista, folhaPagamento, custoFixo, imposto, alimentacao, materialOS};
  }).filter(r=>r.mesNum && r.departamento && (r.entradas || r.retiradas || r.resultado));
  data.servicos = data.servicos.map(r=>({...r, codigo:String(r.codigo||'').trim(), mesNum:Number(r.mesNum)||monthFromCode(r.codigo)||monthByName(r.mes)||0, mes:r.mes || months[(Number(r.mesNum)||monthFromCode(r.codigo)||1)-1] || '', departamento:normalizeDepartmentName(r.departamento)||deptFromCode(r.codigo), servico:String(r.servico||'Serviços').trim(), condicao:String(r.condicao||'Total').trim(), valor:toNumber(r.valor)})).filter(r=>r.valor);
  data.despesas = data.despesas.map(r=>({...r, codigo:String(r.codigo||'').trim(), mesNum:Number(r.mesNum)||monthFromCode(r.codigo)||monthByName(r.mes)||0, mes:r.mes || months[(Number(r.mesNum)||monthFromCode(r.codigo)||1)-1] || '', departamento:normalizeDepartmentName(r.departamento)||deptFromCode(r.codigo), categoria:String(r.categoria||'Despesa').trim(), valor:toNumber(r.valor), classe:String(r.classe||'Retirada').trim(), entraResultado:r.entraResultado === undefined ? true : boolValue(r.entraResultado)})).filter(r=>r.valor);
  data.folha = data.folha.map(r=>({...r, codigo:String(r.codigo||'').trim(), mesNum:Number(r.mesNum)||monthFromCode(r.codigo)||monthByName(r.mes)||0, mes:r.mes || months[(Number(r.mesNum)||monthFromCode(r.codigo)||1)-1] || '', departamento:normalizeDepartmentName(r.departamento)||deptFromCode(r.codigo), nome:String(r.nome||'').trim(), bruto:toNumber(r.bruto), desconto:toNumber(r.desconto), liquido:toNumber(r.liquido)})).filter(r=>r.nome && (r.bruto || r.liquido));
  data.produtivos = data.produtivos.map(r=>{ const prazo=toNumber(r.prazo), vista=toNumber(r.vista); return {...r, codigo:String(r.codigo||'').trim(), mesNum:Number(r.mesNum)||monthFromCode(r.codigo)||monthByName(r.mes)||0, mes:r.mes || months[(Number(r.mesNum)||monthFromCode(r.codigo)||1)-1] || '', departamento:normalizeDepartmentName(r.departamento)||deptFromCode(r.codigo), nome:String(r.nome||'').trim(), prazo, vista, total:toNumber(r.total)||prazo+vista}; }).filter(r=>r.nome && r.total);
  data.custosFixos = data.custosFixos.map(r=>({...r, codigo:String(r.codigo||'').trim(), mesNum:Number(r.mesNum)||monthFromCode(r.codigo)||monthByName(r.mes)||0, mes:r.mes || months[(Number(r.mesNum)||monthFromCode(r.codigo)||1)-1] || '', departamento:normalizeDepartmentName(r.departamento)||deptFromCode(r.codigo), valor:toNumber(r.valor)})).filter(r=>r.valor);
  data.resumo.sort((a,b)=>a.mesNum-b.mesNum || a.departamento.localeCompare(b.departamento));
  const depts = DEFAULT_DEPARTMENTS.filter(d=>data.resumo.some(r=>r.departamento===d));
  const extra = unique(data.resumo.map(r=>r.departamento)).filter(d=>!depts.includes(d));
  const mesNums = unique(data.resumo.map(r=>r.mesNum)).sort((a,b)=>a-b);
  data.meta = {
    ...(data.meta || {}),
    geradoEm: new Date().toISOString(),
    departamentos: depts.concat(extra),
    departamentosLabel: DEFAULT_DEPT_LABEL,
    meses: mesNums.map(n=>months[n-1] || String(n)),
    totalEntradas: sumVal(data.resumo,'entradas'),
    totalRetiradas: sumVal(data.resumo,'retiradas'),
    resultado: sumVal(data.resumo,'resultado'),
    totalVista: sumVal(data.resumo,'receitaVista'),
    totalPrazo: sumVal(data.resumo,'receitaPrazo')
  };
  return data;
}
function buildFinanceDataFromWorkbook(workbook){
  const direct = buildDirectDataFromWorkbook(workbook);
  const coded = buildCodeDataFromWorkbook(workbook);
  const merged = (coded.resumo.length ? coded : direct);
  const finalData = finalizeFinanceData(merged);
  if(!finalData.resumo.length){
    throw new Error('Não encontrei as abas de fechamento. Use a mesma planilha-base do painel ou abas consolidadas chamadas Resumo, Serviços, Despesas, Folha e Produtivos.');
  }
  return finalData;
}
async function importSpreadsheet(file){
  if(!file) return;
  if(!window.XLSX){ toast('Leitor de Excel não carregado. Verifique a internet e tente novamente.'); return; }
  try{
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer,{type:'array',cellDates:true});
    const nextPayload = buildFinanceDataFromWorkbook(workbook);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPayload));
    applyFinanceData(nextPayload, `Planilha manual: ${file.name}`);
    toast('Planilha carregada com sucesso.');
  }catch(err){
    console.error(err);
    toast(err.message || 'Não consegui carregar a planilha.');
  }finally{
    const input = $('spreadsheetInput');
    if(input) input.value = '';
  }
}
function updateDataStatus(label){
  const meses = (payload.meta && payload.meta.meses && payload.meta.meses.length) ? payload.meta.meses.join(' • ') : unique(resumo.map(r=>r.mes)).join(' • ');
  const sideStatus = $('sideStatus');
  const sidePeriod = $('sidePeriod');
  const info = $('dataSourceInfo');
  if(sideStatus) sideStatus.textContent = label || 'Atualizado';
  if(sidePeriod) sidePeriod.textContent = meses || 'Sem período identificado';
  if(info) info.textContent = label || 'Base interna';
}
function applyFinanceData(nextPayload, label){
  Object.values(state.charts).forEach(chart=>chart && chart.destroy && chart.destroy());
  state.charts = {};
  refreshDataRefs(nextPayload);
  populateFilters();
  if(state.dept !== 'all' && !departments.includes(state.dept)) state.dept = 'all';
  render();
  updateDataStatus(label);
}
function setupSpreadsheetUpload(){
  const input = $('spreadsheetInput');
  const btnUpload = $('btnUploadSheet');
  const btnReset = $('btnResetData');
  if(btnUpload && input) btnUpload.addEventListener('click',()=>input.click());
  if(input) input.addEventListener('change',()=>importSpreadsheet(input.files && input.files[0]));
  if(btnReset) btnReset.addEventListener('click',()=>{
    localStorage.removeItem(STORAGE_KEY);
    applyFinanceData(DEFAULT_FINANCE_DATA, 'Base interna');
    toast('Dados padrão restaurados.');
  });
}
function initDashboard(){
  applyTheme(savedTheme(), false);
  refreshDataRefs(payload);
  populateFilters();
  setupNav();
  setupSpreadsheetUpload();
  render();
  updateDataStatus(localStorage.getItem(STORAGE_KEY) ? 'Planilha manual salva' : 'Base interna');
  toast('Painel financeiro atualizado.');
}


function populateFilters(){
  const monthFilter=$('monthFilter');
  const deptFilter=$('deptFilter');
  const catFilter=$('categoryFilter');
  const selectedMonth = monthFilter ? monthFilter.value : 'all';
  const selectedDept = deptFilter ? deptFilter.value : 'all';
  const selectedCat = catFilter ? catFilter.value : 'all';
  if(monthFilter){
    monthFilter.innerHTML = '<option value="all">Todos</option>';
    unique(resumo.map(r=>r.mesNum)).sort((a,b)=>a-b).forEach(n=>monthFilter.insertAdjacentHTML('beforeend',`<option value="${n}">${months[n-1] || n}</option>`));
    monthFilter.value = [...monthFilter.options].some(o=>o.value===selectedMonth) ? selectedMonth : 'all';
  }
  if(deptFilter){
    deptFilter.innerHTML = '<option value="all">Todos</option>';
    departments.forEach(d=>deptFilter.insertAdjacentHTML('beforeend',`<option value="${escapeHtml(d)}">${prettyDept(d)}</option>`));
    deptFilter.value = [...deptFilter.options].some(o=>o.value===selectedDept) ? selectedDept : 'all';
  }
  if(catFilter){
    catFilter.innerHTML = '<option value="all">Todas</option>';
    unique(despesas.map(r=>r.categoria)).sort().forEach(c=>catFilter.insertAdjacentHTML('beforeend',`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`));
    catFilter.value = [...catFilter.options].some(o=>o.value===selectedCat) ? selectedCat : 'all';
  }
}
function setupNav(){
  document.querySelectorAll('.nav-link').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-link').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); state.page=btn.dataset.page; state.dept=btn.dataset.dept||'all';
    if(state.dept!=='all') $('deptFilter').value=state.dept;
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.dataset.pageSection===state.page));
    render();
  }));
  ['monthFilter','deptFilter','categoryFilter'].forEach(id=>$(id).addEventListener('change',render));
  $('searchInput').addEventListener('input',()=>{ clearTimeout(window._s); window._s=setTimeout(render,130); });
  $('btnPresentation').addEventListener('click',()=>document.body.classList.toggle('presentation'));
  $('btnExport').addEventListener('click',exportCsv);
  const themeBtn = $('btnThemeToggle');
  if(themeBtn) themeBtn.addEventListener('click',()=>applyTheme(isWhiteTheme() ? 'black' : 'white', true));
}

function render(){
  const rows=filteredResumo();
  renderKpis(rows);
  renderHero(rows);
  if(state.page==='geral') renderGeneral(rows);
  if(state.page==='setor') renderSector(filteredResumo().filter(r=>state.dept==='all'||r.departamento===state.dept));
  if(state.page==='despesas') renderExpenses();
  if(state.page==='produtivos') renderProdutivos();
  if(state.page==='detalhes') renderDetails(rows);
}
function renderKpis(rows){
  const entradas=sumVal(rows,'entradas'), retiradas=sumVal(rows,'retiradas'), resultado=sumVal(rows,'resultado'), vista=sumVal(rows,'receitaVista'), prazo=sumVal(rows,'receitaPrazo');
  const margem=entradas?resultado/entradas*100:0;
  const cards=[['Entradas',entradas,'Total recebido/faturado'],['Retiradas',retiradas,'Total de saídas'],['Resultado',resultado,`${margem.toFixed(1).replace('.',',')}% de margem`,resultado>=0?'good':'bad'],['À vista',vista,'Recebimentos à vista'],['À prazo',prazo,'Recebimentos à prazo'],['Setores',unique(rows.map(r=>r.departamento)).length,'Áreas com movimento']];
  $('kpiGrid').innerHTML=cards.map(([t,v,s,c])=>`<article class="kpi glass"><span>${escapeHtml(t)}</span><strong class="${c||''}">${typeof v==='number'&&t!=='Setores'?fmtMoney.format(v):escapeHtml(v)}</strong><small>${escapeHtml(s)}</small></article>`).join('');
}
function renderHero(rows){
  const entradas=sumVal(rows,'entradas'), retiradas=sumVal(rows,'retiradas'), resultado=sumVal(rows,'resultado'), margem=entradas?resultado/entradas*100:0;
  $('heroResult').textContent=fmtMoney.format(resultado); $('heroResult').className=resultado>=0?'positive':'negative';
  $('heroMargin').textContent=`${margem.toFixed(1).replace('.',',')}%`; $('heroMargin').className=`pill ${resultado>=0?'good':'bad'}`;
  $('heroRevenue').textContent=fmtMoney.format(entradas); $('heroCost').textContent=fmtMoney.format(retiradas);
  const mensal=unique(rows.map(r=>r.mesNum)).sort((a,b)=>a-b).map(n=>({m:months[n-1].slice(0,3),resultado:sumVal(rows.filter(r=>r.mesNum===n),'resultado')}));
  draw('chartHero','line',{labels:mensal.map(x=>x.m),datasets:[{label:'Resultado',data:mensal.map(x=>x.resultado),type:'line'}]},{plugins:{legend:{display:false}}});
}
function renderGeneral(rows){
  const entradas=sumVal(rows,'entradas'), retiradas=sumVal(rows,'retiradas'), resultado=sumVal(rows,'resultado');
  const best=[...rows].sort((a,b)=>b.resultado-a.resultado)[0]; const worst=[...rows].sort((a,b)=>a.resultado-b.resultado)[0];
  const compras=sum(filteredDespesas().filter(r=>['Compras a prazo','Compras do mês','Material OS'].includes(r.categoria)));
  $('insightsGrid').innerHTML=[
    ['Resultado acumulado',fmtMoney.format(resultado),'Saldo entre entradas e retiradas no período.'],
    ['Melhor setor',best?prettyDept(best.departamento):'-',best?`${best.mes} • ${fmtMoney.format(best.resultado)}`:'Sem movimento'],
    ['Ponto de atenção',worst?prettyDept(worst.departamento):'-',worst?`${worst.mes} • ${fmtMoney.format(worst.resultado)}`:'Sem movimento'],
    ['Compras e material',fmtMoney.format(compras),'Compras a prazo, compras do mês e material OS.']
  ].map(([a,b,c])=>`<div class="insight"><b>${escapeHtml(b)}</b><small>${escapeHtml(a)} • ${escapeHtml(c)}</small></div>`).join('');
  const mensal=unique(rows.map(r=>r.mesNum)).sort((a,b)=>a-b).map(n=>({m:months[n-1], entradas:sumVal(rows.filter(r=>r.mesNum===n),'entradas'), retiradas:sumVal(rows.filter(r=>r.mesNum===n),'retiradas'), resultado:sumVal(rows.filter(r=>r.mesNum===n),'resultado')}));
  draw('chartMonthly','bar',{labels:mensal.map(x=>x.m.slice(0,3)),datasets:[{label:'Entradas',data:mensal.map(x=>x.entradas),borderRadius:10},{label:'Retiradas',data:mensal.map(x=>x.retiradas),borderRadius:10},{type:'line',label:'Resultado',data:mensal.map(x=>x.resultado)}]});
  const dep=departments.map(d=>({d,v:sumVal(rows.filter(r=>r.departamento===d),'resultado')}));
  draw('chartDeptResult','bar',{labels:dep.map(x=>prettyDept(x.d)),datasets:[{label:'Resultado',data:dep.map(x=>x.v),borderRadius:10}]},{plugins:{legend:{display:false}}});
  draw('chartPayment','doughnut',{labels:['À vista','À prazo'],datasets:[{label:'Valor',data:[sumVal(rows,'receitaVista'),sumVal(rows,'receitaPrazo')]}]},{plugins:{legend:{position:'bottom'}}});
  const exp=entries(group(filteredDespesas().filter(r=>r.entraResultado),'categoria')).slice(0,8);
  draw('chartExpenses','bar',{labels:exp.map(x=>short(x.key,24)),datasets:[{label:'Valor',data:exp.map(x=>x.value),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  const rev=departments.map(d=>({d,v:sumVal(rows.filter(r=>r.departamento===d),'entradas')}));
  draw('chartRevenueDept','doughnut',{labels:rev.map(x=>prettyDept(x.d)),datasets:[{label:'Entradas',data:rev.map(x=>x.v)}]},{plugins:{legend:{position:'bottom'}}});
  const comprasDept=departments.map(d=>({d,v:sum(filteredDespesas().filter(r=>r.departamento===d&&['Compras a prazo','Compras do mês','Material OS'].includes(r.categoria)))}));
  draw('chartCompras','bar',{labels:comprasDept.map(x=>prettyDept(x.d)),datasets:[{label:'Valor',data:comprasDept.map(x=>x.v),borderRadius:10}]},{plugins:{legend:{display:false}}});
}
function renderSector(rows){
  const dept=state.dept==='all'?($('deptFilter').value==='all'?'Mecanica':$('deptFilter').value):state.dept;
  rows=filteredResumo().filter(r=>r.departamento===dept);
  const exp=filteredDespesas().filter(r=>r.departamento===dept);
  const svc=filteredServicos().filter(r=>r.departamento===dept);
  $('sectorEyebrow').textContent='Setor'; $('sectorTitle').textContent=prettyDept(dept);
  const entradas=sumVal(rows,'entradas'), retiradas=sumVal(rows,'retiradas'), resultado=sumVal(rows,'resultado');
  $('sectorResult').textContent=fmtMoney.format(resultado); $('sectorResult').className=resultado>=0?'positive':'negative';
  $('sectorMonthlyTitle').textContent=`${prettyDept(dept)} por mês`;
  const mensal=unique(rows.map(r=>r.mesNum)).sort((a,b)=>a-b).map(n=>({m:months[n-1].slice(0,3),e:sumVal(rows.filter(r=>r.mesNum===n),'entradas'),s:sumVal(rows.filter(r=>r.mesNum===n),'retiradas'),r:sumVal(rows.filter(r=>r.mesNum===n),'resultado')}));
  draw('chartSectorMonthly','bar',{labels:mensal.map(x=>x.m),datasets:[{label:'Entradas',data:mensal.map(x=>x.e),borderRadius:10},{label:'Retiradas',data:mensal.map(x=>x.s),borderRadius:10},{type:'line',label:'Resultado',data:mensal.map(x=>x.r)}]});
  draw('chartSectorPayment','doughnut',{labels:['À vista','À prazo'],datasets:[{label:'Valor',data:[sumVal(rows,'receitaVista'),sumVal(rows,'receitaPrazo')]}]},{plugins:{legend:{position:'bottom'}}});
  const byExp=entries(group(exp.filter(r=>r.entraResultado),'categoria')).slice(0,8);
  draw('chartSectorExpenses','bar',{labels:byExp.map(x=>short(x.key,24)),datasets:[{label:'Valor',data:byExp.map(x=>x.value),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  const bySvc=entries(group(svc,'servico')).slice(0,8);
  draw('chartSectorServices','bar',{labels:bySvc.map(x=>short(x.key,24)),datasets:[{label:'Valor',data:bySvc.map(x=>x.value),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  $('sectorCounter').textContent=`${rows.length} linhas`;
  $('sectorRows').innerHTML=rows.sort((a,b)=>a.mesNum-b.mesNum).map(r=>`<tr><td>${escapeHtml(r.mes)}</td><td>${escapeHtml(r.codigo)}</td><td>${fmtMoney.format(r.receitaPrazo)}</td><td>${fmtMoney.format(r.receitaVista)}</td><td>${fmtMoney.format(r.entradas)}</td><td>${fmtMoney.format(r.retiradas)}</td><td><b class="${r.resultado>=0?'positive':'negative'}">${fmtMoney.format(r.resultado)}</b></td><td>${fmtMoney.format((r.comprasMes||0)+(r.materialOS||0))}</td></tr>`).join('');
}
function renderExpenses(){
  const rows=filteredDespesas();
  const total=sum(rows), retiradas=sum(rows,r=>r.entraResultado), compras=sum(rows,r=>['Compras a prazo','Compras do mês','Material OS'].includes(r.categoria));
  $('expenseCards').innerHTML=[['Total listado',total],['Retiradas',retiradas],['Compras/material',compras],['Categorias',unique(rows.map(r=>r.categoria)).length]].map(([t,v])=>`<div class="insight"><b>${typeof v==='number'&&t!=='Categorias'?fmtMoney.format(v):v}</b><small>${t}</small></div>`).join('');
  const mensal=unique(rows.map(r=>r.mesNum)).sort((a,b)=>a-b).map(n=>({m:months[n-1].slice(0,3),v:sum(rows.filter(r=>r.mesNum===n))}));
  draw('chartExpenseMonthly','bar',{labels:mensal.map(x=>x.m),datasets:[{label:'Valor',data:mensal.map(x=>x.v),borderRadius:10}]},{plugins:{legend:{display:false}}});
  const dep=departments.map(d=>({d,v:sum(rows.filter(r=>r.departamento===d))}));
  draw('chartExpenseDept','bar',{labels:dep.map(x=>prettyDept(x.d)),datasets:[{label:'Valor',data:dep.map(x=>x.v),borderRadius:10}]},{plugins:{legend:{display:false}}});
  const cat=entries(group(rows,'categoria')).slice(0,10);
  draw('chartExpenseCategory','bar',{labels:cat.map(x=>short(x.key,24)),datasets:[{label:'Valor',data:cat.map(x=>x.value),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  $('expenseCounter').textContent=`${rows.length} registros`;
  $('expenseRows').innerHTML=rows.sort((a,b)=>a.mesNum-b.mesNum||a.departamento.localeCompare(b.departamento)).map(r=>`<tr><td>${escapeHtml(r.mes)}</td><td>${escapeHtml(prettyDept(r.departamento))}</td><td>${escapeHtml(r.categoria)}</td><td>${escapeHtml(r.classe)}</td><td>${fmtMoney.format(r.valor)}</td></tr>`).join('');
}
function renderProdutivos(){
  const rows=filteredProdutivos();
  const total=sumVal(rows,'total'), vista=sumVal(rows,'vista'), prazo=sumVal(rows,'prazo');
  const top=entries(group(rows,'nome','total'))[0];
  $('prodCards').innerHTML=[['Total produtivos',total],['À vista',vista],['À prazo',prazo],['Maior destaque',top?top.key:'-']].map(([t,v])=>`<div class="insight"><b>${typeof v==='number'?fmtMoney.format(v):escapeHtml(v)}</b><small>${escapeHtml(t)}</small></div>`).join('');
  const rank=entries(group(rows,'nome','total')).slice(0,12);
  draw('chartProdRanking','bar',{labels:rank.map(x=>short(x.key,26)),datasets:[{label:'Total',data:rank.map(x=>x.value),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  draw('chartProdPayment','doughnut',{labels:['À vista','À prazo'],datasets:[{label:'Valor',data:[vista,prazo]}]},{plugins:{legend:{position:'bottom'}}});
  $('prodCounter').textContent=`${rows.length} registros`;
  $('prodRows').innerHTML=rows.sort((a,b)=>b.total-a.total).map(r=>`<tr><td>${escapeHtml(r.mes)}</td><td>${escapeHtml(prettyDept(r.departamento))}</td><td>${escapeHtml(r.nome)}</td><td>${fmtMoney.format(r.prazo)}</td><td>${fmtMoney.format(r.vista)}</td><td><b>${fmtMoney.format(r.total)}</b></td></tr>`).join('');
}
function renderDetails(rows){
  $('detailCounter').textContent=`${rows.length} linhas`;
  $('detailRows').innerHTML=rows.sort((a,b)=>a.mesNum-b.mesNum||a.departamento.localeCompare(b.departamento)).map(r=>`<tr><td>${escapeHtml(r.mes)}</td><td>${escapeHtml(r.codigo)}</td><td>${escapeHtml(prettyDept(r.departamento))}</td><td>${fmtMoney.format(r.receitaPrazo)}</td><td>${fmtMoney.format(r.receitaVista)}</td><td>${fmtMoney.format(r.entradas)}</td><td>${fmtMoney.format(r.retiradas)}</td><td><b class="${r.resultado>=0?'positive':'negative'}">${fmtMoney.format(r.resultado)}</b></td><td>${fmtMoney.format((r.comprasMes||0)+(r.materialOS||0))}</td></tr>`).join('');
  const svc=filteredServicos(); $('serviceCounter').textContent=`${svc.length} registros`;
  $('serviceRows').innerHTML=svc.sort((a,b)=>a.mesNum-b.mesNum||a.departamento.localeCompare(b.departamento)).map(r=>`<tr><td>${escapeHtml(r.mes)}</td><td>${escapeHtml(prettyDept(r.departamento))}</td><td>${escapeHtml(r.servico)}</td><td>${escapeHtml(r.condicao)}</td><td>${fmtMoney.format(r.valor)}</td></tr>`).join('');
}
function exportCsv(){
  const rows=filteredResumo();
  const head=['Mês','Código','Setor','À prazo','À vista','Entradas','Retiradas','Resultado','Compras/Material'];
  const lines=[head.join(';'),...rows.map(r=>[r.mes,r.codigo,prettyDept(r.departamento),r.receitaPrazo,r.receitaVista,r.entradas,r.retiradas,r.resultado,(r.comprasMes||0)+(r.materialOS||0)].join(';'))];
  const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='fechamento-financeiro.csv'; a.click(); URL.revokeObjectURL(a.href); toast('Fechamento exportado.');
}

initDashboard();
