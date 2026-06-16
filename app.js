const payload = window.FINANCE_DATA || { meta:{}, linhas:[], auditoria:[], solicitado:{} };
const baseRows = Array.isArray(payload.linhas) ? payload.linhas : [];
const meta = payload.meta || {};
const audit = payload.auditoria || [];
const requested = payload.solicitado || {};
const months = meta.meses || ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const departments = meta.departamentos || ['Mecanica','Peças','Retifica','Torneadora','Caldeiraria'];
const fmtMoney = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const fmtNum = new Intl.NumberFormat('pt-BR');
const palette = ['#f6b44b','#4f7cff','#3be2a1','#ff5e78','#9b5cff','#20d5ff','#ff9f43','#7dd3fc','#f472b6','#a3e635'];
const $ = id => document.getElementById(id);
let charts = {};
let state = { page:'geral', dept:null };

window.addEventListener('DOMContentLoaded', () => {
  setupChartDefaults();
  setupFilters();
  bindEvents();
  updateDashboard();
  toast(`Base integrada carregada: ${fmtNum.format(baseRows.length)} registros tratados.`);
});

function bindEvents(){
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-page]').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      const page = btn.dataset.page;
      state.page = ['mecanica','pecas','torneadora','caldeiraria'].includes(page) ? 'setor' : page;
      state.dept = btn.dataset.dept || null;
      showPage(state.page);
      updateDashboard();
      setTimeout(resizeCharts, 80);
    });
  });
  ['yearFilter','monthFilter','deptFilter','conditionFilter','originFilter','searchInput'].forEach(id => $(id)?.addEventListener('input', updateDashboard));
  $('btnExport')?.addEventListener('click', exportCSV);
  $('btnPresentation')?.addEventListener('click',()=>{ document.body.classList.toggle('presentation'); setTimeout(resizeCharts,200); });
  $('btnAudit')?.addEventListener('click',()=>{ state.page='detalhes'; document.querySelectorAll('[data-page]').forEach(x=>x.classList.remove('active')); document.querySelector('[data-page="detalhes"]')?.classList.add('active'); showPage('detalhes'); updateDashboard(); document.querySelector('[data-page-section="detalhes"]')?.scrollIntoView({behavior:'smooth'}); });
}

function setupFilters(){
  const years = unique(baseRows.map(r=>r.ano)).filter(y=>String(y).length===4).sort((a,b)=>b-a);
  fillSelect('yearFilter', years.map(y=>({value:String(y), label:String(y)})));
  if(years.includes(2026)) $('yearFilter').value = '2026';
  fillSelect('monthFilter', months.map((m,i)=>({value:String(i+1), label:m})));
  fillSelect('deptFilter', departments.map(d=>({value:d,label:prettyDept(d)})));
  fillSelect('conditionFilter', unique(baseRows.map(r=>r.condicao)).filter(Boolean).sort().map(v=>({value:v,label:v})));
  fillSelect('originFilter', unique(baseRows.map(r=>r.origem)).filter(Boolean).sort().map(v=>({value:v,label:v})));
  $('sidePeriod').textContent = `${fmtNum.format(baseRows.length)} registros • ${monthsRange(baseRows)}`;
  $('sideStatus').textContent = 'Base integrada e tratada';
}

function fillSelect(id, items){
  const el=$(id); if(!el) return;
  const first = el.querySelector('option')?.outerHTML || '<option value="all">Todos</option>';
  el.innerHTML = first + items.map(x=>`<option value="${escapeHtml(x.value)}">${escapeHtml(x.label)}</option>`).join('');
}

function showPage(page){
  document.querySelectorAll('[data-page-section]').forEach(sec => sec.classList.remove('active'));
  if(page==='setor') document.querySelector('[data-page-section="setor"]')?.classList.add('active');
  else document.querySelector(`[data-page-section="${page}"]`)?.classList.add('active');
}

function updateDashboard(){
  const rows = getFilteredRows();
  renderKpis(rows);
  renderHero(rows);
  if(state.page==='geral') renderGeneral(rows);
  if(state.page==='setor') renderSector(rows, state.dept || $('deptFilter')?.value || 'Mecanica');
  if(state.page==='retifica') renderRetifica(rows);
  if(state.page==='compras') renderCompras(rows);
  if(state.page==='abastecimento') renderAbastecimento(rows);
  if(state.page==='detalhes') renderDetails(rows);
}

function getFilteredRows(){
  const year = $('yearFilter')?.value || 'all';
  const month = $('monthFilter')?.value || 'all';
  const dept = $('deptFilter')?.value || 'all';
  const condition = $('conditionFilter')?.value || 'all';
  const origin = $('originFilter')?.value || 'all';
  const term = ($('searchInput')?.value || '').trim().toLowerCase();
  return baseRows.filter(r => {
    if(year !== 'all' && String(r.ano) !== year) return false;
    if(month !== 'all' && String(r.mesNum) !== month) return false;
    if(dept !== 'all' && r.departamento !== dept) return false;
    if(condition !== 'all' && r.condicao !== condition) return false;
    if(origin !== 'all' && r.origem !== origin) return false;
    if(term){
      const hay = `${r.cliente} ${r.descricao} ${r.os} ${r.fornecedor} ${r.mecanico} ${r.departamento} ${r.origem}`.toLowerCase();
      if(!hay.includes(term)) return false;
    }
    return true;
  });
}

function renderKpis(rows){
  const receita = sum(rows, r=>r.tipo==='Receita');
  const gastos = sum(rows, r=>r.tipo==='Gasto');
  const result = receita - gastos;
  const margin = receita ? result / receita * 100 : 0;
  const os = unique(rows.filter(r=>r.os).map(r=>r.os)).length;
  const rateio = sum(rows, r=>r.rateio5x);
  const vista = sum(rows, r=>r.tipo==='Receita' && r.condicao==='À Vista');
  const prazo = sum(rows, r=>r.tipo==='Receita' && r.condicao==='À Prazo');
  const items = [
    ['Receitas', fmtMoney.format(receita), 'Serviços, peças e OS executadas'],
    ['Gastos', fmtMoney.format(gastos), 'Compras, custos, abastecimento e rateios'],
    ['Resultado', fmtMoney.format(result), 'Receitas - gastos', result>=0?'positive':'negative'],
    ['Margem', `${margin.toFixed(1).replace('.',',')}%`, 'Resultado / receitas'],
    ['Receita à vista', fmtMoney.format(vista), 'Executado recebido à vista'],
    ['Receita à prazo', fmtMoney.format(prazo), 'Executado lançado à prazo'],
    ['OS únicas', fmtNum.format(os), 'Ordens encontradas na base'],
    ['Rateio 5X', fmtMoney.format(rateio), 'Custos fixos divididos entre 5 departamentos']
  ];
  $('kpiGrid').innerHTML = items.map(([t,v,s,c])=>`<article class="kpi glass"><span>${t}</span><strong class="${c||''}" title="${escapeHtml(v)}">${v}</strong><small>${s}</small></article>`).join('');
}

function renderHero(rows){
  const receita = sum(rows, r=>r.tipo==='Receita');
  const gastos = sum(rows, r=>r.tipo==='Gasto');
  const result = receita - gastos;
  const margin = receita ? result/receita*100 : 0;
  $('heroRevenue').textContent = fmtMoney.format(receita);
  $('heroCost').textContent = fmtMoney.format(gastos);
  $('heroResult').textContent = fmtMoney.format(result);
  $('heroMargin').textContent = `${margin.toFixed(1).replace('.',',')}%`;
  $('heroMargin').className = `pill ${result>=0?'good':'bad'}`;
  const data = months.map((m,i)=>({m, receita:sum(rows,r=>r.tipo==='Receita'&&r.mesNum===i+1), gastos:sum(rows,r=>r.tipo==='Gasto'&&r.mesNum===i+1)}));
  draw('chartHero','line',{labels:data.map(x=>x.m.slice(0,3)),datasets:[{label:'Receitas',data:data.map(x=>x.receita),tension:.35,borderWidth:3,pointRadius:3},{label:'Gastos',data:data.map(x=>x.gastos),tension:.35,borderWidth:3,pointRadius:3}]},{plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:false}}});
}

function renderGeneral(rows){
  renderInsights(rows);
  const monthly = months.map((m,i)=>({m, receita:sum(rows,r=>r.tipo==='Receita'&&r.mesNum===i+1), gastos:sum(rows,r=>r.tipo==='Gasto'&&r.mesNum===i+1)}));
  draw('chartMonthly','bar',{labels:monthly.map(x=>x.m.slice(0,3)),datasets:[{label:'Receitas',data:monthly.map(x=>x.receita),borderRadius:10},{label:'Gastos',data:monthly.map(x=>x.gastos),borderRadius:10},{type:'line',label:'Resultado',data:monthly.map(x=>x.receita-x.gastos),tension:.34,borderWidth:3}]});
  const deptResult = departments.map(d=>({d, receita:sum(rows,r=>r.departamento===d&&r.tipo==='Receita'), gasto:sum(rows,r=>r.departamento===d&&r.tipo==='Gasto')}));
  draw('chartDept','bar',{labels:deptResult.map(x=>prettyDept(x.d)),datasets:[{label:'Resultado',data:deptResult.map(x=>x.receita-x.gasto),borderRadius:10}]},{plugins:{legend:{display:false}}});
  const pay = entries(groupBy(rows.filter(r=>r.tipo==='Receita'),'condicao',r=>r.valor)).slice(0,6);
  draw('chartPayment','doughnut',{labels:pay.map(x=>x.key),datasets:[{label:'Receitas',data:pay.map(x=>x.value)}]},{plugins:{legend:{position:'bottom'}}});
  const costs = departments.map(d=>({d, v:sum(rows,r=>r.tipo==='Gasto'&&r.departamento===d)}));
  draw('chartCostsDept','bar',{labels:costs.map(x=>prettyDept(x.d)),datasets:[{label:'Gastos',data:costs.map(x=>x.v),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  const clients=entries(groupBy(rows.filter(r=>r.tipo==='Receita'),'cliente',r=>r.valor)).filter(x=>x.key && x.key!=='Não informado').slice(0,8);
  draw('chartClients','bar',{labels:clients.map(x=>short(x.key,26)),datasets:[{label:'Receita',data:clients.map(x=>x.value),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  const suppliers=entries(groupBy(rows.filter(r=>r.tipo==='Gasto'),'fornecedor',r=>r.valor)).filter(x=>x.key).slice(0,8);
  draw('chartSuppliers','bar',{labels:suppliers.map(x=>short(x.key,26)),datasets:[{label:'Gastos',data:suppliers.map(x=>x.value),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
}

function renderInsights(rows){
  const byDept = departments.map(d=>({d, receita:sum(rows,r=>r.departamento===d&&r.tipo==='Receita'), gasto:sum(rows,r=>r.departamento===d&&r.tipo==='Gasto')})).map(x=>({...x,result:x.receita-x.gasto}));
  const topRevenue = byDept.slice().sort((a,b)=>b.receita-a.receita)[0] || {};
  const topCost = byDept.slice().sort((a,b)=>b.gasto-a.gasto)[0] || {};
  const best = byDept.slice().sort((a,b)=>b.result-a.result)[0] || {};
  const topClient = entries(groupBy(rows.filter(r=>r.tipo==='Receita'),'cliente',r=>r.valor)).filter(x=>x.key && x.key!=='Não informado')[0] || {key:'-',value:0};
  const cards = [
    [`${prettyDept(topRevenue.d||'-')}`, `Maior faturamento: ${fmtMoney.format(topRevenue.receita||0)}`],
    [`${prettyDept(topCost.d||'-')}`, `Maior gasto: ${fmtMoney.format(topCost.gasto||0)}`],
    [`${prettyDept(best.d||'-')}`, `Melhor resultado: ${fmtMoney.format(best.result||0)}`],
    [short(topClient.key,24), `Cliente com maior receita: ${fmtMoney.format(topClient.value||0)}`]
  ];
  $('insightsGrid').innerHTML = cards.map(c=>`<div class="insight"><b>${escapeHtml(c[0])}</b><small>${escapeHtml(c[1])}</small></div>`).join('');
}

function renderSector(filteredRows, dept){
  const rows = filteredRows.filter(r=>r.departamento===dept);
  $('sectorTitle').textContent = prettyDept(dept);
  $('sectorEyebrow').textContent = dept==='Mecanica' ? 'Mecânica / Auto Geral' : `Setor ${prettyDept(dept)}`;
  $('sectorDesc').textContent = sectorDescription(dept);
  const receita=sum(rows,r=>r.tipo==='Receita'), gastos=sum(rows,r=>r.tipo==='Gasto'), result=receita-gastos;
  $('sectorResult').textContent = fmtMoney.format(result);
  $('sectorResult').className = result>=0?'positive':'negative';
  $('sectorMonthlyTitle').textContent = `${prettyDept(dept)} por mês`;
  const monthly=months.map((m,i)=>({m, receita:sum(rows,r=>r.tipo==='Receita'&&r.mesNum===i+1), gastos:sum(rows,r=>r.tipo==='Gasto'&&r.mesNum===i+1)}));
  draw('chartSectorMonthly','bar',{labels:monthly.map(x=>x.m.slice(0,3)),datasets:[{label:'Receita',data:monthly.map(x=>x.receita),borderRadius:10},{label:'Gastos',data:monthly.map(x=>x.gastos),borderRadius:10},{type:'line',label:'Resultado',data:monthly.map(x=>x.receita-x.gastos),tension:.35,borderWidth:3}]});
  const pay=entries(groupBy(rows.filter(r=>r.tipo==='Receita'),'condicao',r=>r.valor));
  draw('chartSectorPayment','doughnut',{labels:pay.map(x=>x.key),datasets:[{label:'Receita',data:pay.map(x=>x.value)}]},{plugins:{legend:{position:'bottom'}}});
  const services=entries(groupBy(rows,'servicoGrupo',r=>r.valor)).filter(x=>x.key).slice(0,8);
  draw('chartSectorServices','bar',{labels:services.map(x=>short(x.key,26)),datasets:[{label:'Valor',data:services.map(x=>x.value),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  const origins=entries(groupBy(rows,'origem',r=>r.valor)).slice(0,8);
  draw('chartSectorOrigin','bar',{labels:origins.map(x=>short(x.key,22)),datasets:[{label:'Valor',data:origins.map(x=>x.value),borderRadius:10}]},{plugins:{legend:{display:false}}});
  $('sectorRows').innerHTML = rows.slice(0,180).map(r=>`<tr><td>${escapeHtml(r.mes)}</td><td>${badge(r.tipo)}</td><td>${escapeHtml(r.condicao)}</td><td>${escapeHtml(short(r.cliente !== 'Não informado' ? r.cliente : r.fornecedor,28))}</td><td title="${escapeHtml(r.descricao)}">${escapeHtml(short(r.descricao,42))}</td><td>${fmtMoney.format(r.valor)}</td><td>${escapeHtml(r.origem)}</td></tr>`).join('');
  const ranks=entries(groupBy(rows,'descricao',r=>r.valor)).slice(0,10);
  $('sectorRankList').innerHTML = ranks.map((x,i)=>`<div class="rank-item"><div class="rank-num">${i+1}</div><div><strong title="${escapeHtml(x.key)}">${escapeHtml(short(x.key,28))}</strong><small>${prettyDept(dept)}</small></div><b>${fmtMoney.format(x.value)}</b></div>`).join('');
}

function renderRetifica(filteredRows){
  const rows = filteredRows.filter(r=>r.origem==='Financeiro Retifica' && r.relatorio==='Serviços');
  const retRows = rows.filter(r=>r.departamento==='Retifica');
  const vista=sum(retRows,r=>r.condicao==='À Vista'), prazo=sum(retRows,r=>r.condicao==='À Prazo'), ni=sum(retRows,r=>r.condicao==='Não informado');
  const mecanica=sum(rows,r=>r.departamento==='Mecanica'), pecas=sum(rows,r=>r.departamento==='Peças');
  const cards=[['Retífica à vista',vista],['Retífica à prazo',prazo],['Sem condição',ni],['Mecânica na aba',mecanica],['Peças na aba',pecas]];
  $('retificaCards').innerHTML=cards.map(([t,v])=>`<div class="insight"><b>${fmtMoney.format(v)}</b><small>${t}</small></div>`).join('');
  const byService = entries(groupBy(retRows,'servicoGrupo',r=>r.valor)).slice(0,12);
  draw('chartRetificaServicos','bar',{labels:byService.map(x=>short(x.key,28)),datasets:[{label:'Valor executado',data:byService.map(x=>x.value),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  const lanc=entries(groupBy(rows,'departamento',r=>r.valor));
  draw('chartRetificaLanc','doughnut',{labels:lanc.map(x=>prettyDept(x.key)),datasets:[{label:'Lançamentos',data:lanc.map(x=>x.value)}]},{plugins:{legend:{position:'bottom'}}});
  const matrix={};
  retRows.forEach(r=>{ const k=r.servicoGrupo||'Não classificado'; matrix[k]=matrix[k]||{vista:0,prazo:0,ni:0}; if(r.condicao==='À Vista')matrix[k].vista+=r.valor; else if(r.condicao==='À Prazo')matrix[k].prazo+=r.valor; else matrix[k].ni+=r.valor; });
  const table=Object.entries(matrix).map(([serv,x])=>({serv,...x,total:x.vista+x.prazo+x.ni})).sort((a,b)=>b.total-a.total).slice(0,80);
  $('retificaTable').innerHTML=table.map(x=>`<tr><td>${escapeHtml(x.serv)}</td><td>${fmtMoney.format(x.vista)}</td><td>${fmtMoney.format(x.prazo)}</td><td><b>${fmtMoney.format(x.total)}</b></td></tr>`).join('');
}

function renderCompras(filteredRows){
  const rows = filteredRows.filter(r=>r.tipo==='Gasto');
  const total=sum(rows), rate=sum(rows,r=>r.rateio5x), compras=sum(rows,r=>r.classe==='Compras'), outros=total-rate-compras;
  const cards=[['Gastos totais',total],['Compras diretas',compras],['Rateio 5X',rate],['Custos/abast. complementares',outros]];
  $('comprasCards').innerHTML = cards.map(([t,v])=>`<div class="insight"><b>${fmtMoney.format(v)}</b><small>${t}</small></div>`).join('');
  const labels = months.map(m=>m.slice(0,3));
  draw('chartComprasDept','bar',{labels,datasets:departments.map((d,i)=>({label:prettyDept(d),data:months.map((_,idx)=>sum(rows,r=>r.departamento===d&&r.mesNum===idx+1)),borderRadius:8}))},{plugins:{legend:{position:'bottom'}}});
  const rateDept=departments.map(d=>({d,v:sum(rows,r=>r.departamento===d&&r.rateio5x)}));
  draw('chartRateio','bar',{labels:rateDept.map(x=>prettyDept(x.d)),datasets:[{label:'Rateio 5X',data:rateDept.map(x=>x.v),borderRadius:10}]},{plugins:{legend:{display:false}}});
  const byType=entries(groupBy(rows,'categoria',r=>r.valor)).slice(0,8);
  draw('chartCostType','bar',{labels:byType.map(x=>short(x.key,24)),datasets:[{label:'Gastos',data:byType.map(x=>x.value),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  $('comprasRows').innerHTML=rows.slice(0,250).map(r=>`<tr><td>${escapeHtml(r.mes)}</td><td>${escapeHtml(prettyDept(r.departamento))}</td><td>${escapeHtml(r.classe)}</td><td>${escapeHtml(short(r.categoria,24))}</td><td title="${escapeHtml(r.descricao)}">${escapeHtml(short(r.descricao,42))}</td><td>${fmtMoney.format(r.valor)}</td><td>${escapeHtml(r.origem)}</td><td>${r.rateio5x?'Sim':'Não'}</td></tr>`).join('');
}


function renderAbastecimento(filteredRows){
  const rows = filteredRows.filter(r=>r.classe==='Abastecimento' || r.categoria==='Combustível' || r.origem==='Controle de Abastecimento');
  const total=sum(rows), litros=rows.reduce((a,r)=>a+(+r.material||0),0), qtd=rows.length;
  const custoMedio = litros ? total/litros : 0;
  const maiorMes = months.map((m,i)=>({m, v:sum(rows,r=>r.mesNum===i+1)})).sort((a,b)=>b.v-a.v)[0] || {m:'-',v:0};
  const cards=[['Gasto total',fmtMoney.format(total),'Valor total lançado em abastecimento/combustível'],['Litros consumidos',fmtNum.format(Math.round(litros*100)/100),'Soma da coluna de litros/material'],['Custo médio/L',fmtMoney.format(custoMedio),'Valor dividido pelos litros'],['Qtd. abastecimentos',fmtNum.format(qtd),'Total de registros encontrados'],['Maior mês',maiorMes.m,fmtMoney.format(maiorMes.v)]];
  $('abastCards').innerHTML = cards.map(([t,v,s])=>`<div class="insight"><b>${escapeHtml(v)}</b><small>${escapeHtml(t)} • ${escapeHtml(s)}</small></div>`).join('');
  const labels=months.map(m=>m.slice(0,3));
  draw('chartAbastMensal','bar',{labels,datasets:[{label:'Gasto combustível',data:months.map((_,i)=>sum(rows,r=>r.mesNum===i+1)),borderRadius:10}]},{plugins:{legend:{display:false}}});
  draw('chartAbastLitros','line',{labels,datasets:[{label:'Litros',data:months.map((_,i)=>rows.filter(r=>r.mesNum===i+1).reduce((a,r)=>a+(+r.material||0),0)),tension:.35,borderWidth:3,pointRadius:3}]},{plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#93a4bd',font:{weight:'700'}},grid:{color:'rgba(255,255,255,.07)'}},y:{ticks:{color:'#93a4bd',callback:v=>fmtNum.format(v),font:{weight:'700'}},grid:{color:'rgba(255,255,255,.07)'}}}});
  const solicitantes=entries(groupBy(rows,'cliente',r=>r.valor)).filter(x=>x.key && x.key!=='Não informado').slice(0,8);
  draw('chartAbastSolicitante','bar',{labels:solicitantes.map(x=>short(x.key,24)),datasets:[{label:'Gasto',data:solicitantes.map(x=>x.value),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  const byVeiculo={}; rows.forEach(r=>{ const k=vehicleFromDesc(r.descricao); byVeiculo[k]=(byVeiculo[k]||0)+(+r.valor||0); });
  const veiculos=entries(byVeiculo).filter(x=>x.key && x.key!=='Não informado').slice(0,8);
  draw('chartAbastVeiculo','bar',{labels:veiculos.map(x=>short(x.key,24)),datasets:[{label:'Gasto',data:veiculos.map(x=>x.value),borderRadius:10}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  $('abastCounter').textContent = `${fmtNum.format(rows.length)} linhas`;
  $('abastRows').innerHTML=rows.slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))).slice(0,300).map(r=>{
    const litros=+r.material||0, valor=+r.valor||0, custo=litros?valor/litros:0;
    return `<tr><td>${escapeHtml(brDate(r.data))}</td><td>${escapeHtml(r.mes)}</td><td>${escapeHtml(short(r.cliente,26))}</td><td title="${escapeHtml(r.descricao)}">${escapeHtml(short(vehicleFromDesc(r.descricao),34))}</td><td>${fmtNum.format(Math.round(litros*100)/100)}</td><td>${fmtMoney.format(valor)}</td><td>${litros?fmtMoney.format(custo):'-'}</td><td>${escapeHtml(kmFromObs(r.observacao))}</td><td>${escapeHtml(r.origem)}</td></tr>`;
  }).join('');
}

function renderDetails(rows){
  $('rowCounter').textContent = `${fmtNum.format(rows.length)} linhas`;
  $('detailRows').innerHTML = rows.slice(0,400).map(r=>`<tr><td>${escapeHtml(brDate(r.data))}</td><td>${escapeHtml(r.mes)}</td><td>${badge(r.tipo)}</td><td>${escapeHtml(prettyDept(r.departamento))}</td><td>${escapeHtml(r.condicao)}</td><td title="${escapeHtml(r.cliente)}">${escapeHtml(short(r.cliente,26))}</td><td title="${escapeHtml(r.descricao)}">${escapeHtml(short(r.descricao,44))}</td><td>${escapeHtml(r.os)}</td><td>${fmtMoney.format(r.valor)}</td><td>${escapeHtml(short(r.fornecedor||r.mecanico||'-',28))}</td><td>${escapeHtml(r.origem)}</td></tr>`).join('');
  $('auditBox').innerHTML = audit.map(a=>`<article><strong>${escapeHtml(a.arquivo)} • ${escapeHtml(a.aba)}</strong><p>${escapeHtml(a.normalizacao||'')}</p><small>${fmtNum.format(a.linhasLidas||0)} linhas lidas ${a.rateios5x!==undefined?`• ${fmtNum.format(a.rateios5x)} itens 5X`:''}</small></article>`).join('') + `<article><strong>Observações</strong><p>${(meta.observacoes||[]).map(escapeHtml).join('<br>')}</p></article>`;
}

function draw(id,type,data,extra={}){
  const el=$(id); if(!el || !window.Chart) return;
  if(charts[id]) charts[id].destroy();
  data.datasets = (data.datasets||[]).map((ds,i)=>({
    ...ds,
    backgroundColor: ds.backgroundColor || (type==='doughnut' ? palette : palette[i%palette.length]),
    borderColor: ds.borderColor || palette[i%palette.length],
    borderWidth: ds.borderWidth ?? (ds.type==='line'||type==='line'?3:0),
    fill: ds.fill ?? false
  }));
  const horizontal = extra.indexAxis === 'y';
  const hasScale = !['doughnut','pie','polarArea','radar'].includes(type);
  const options = merge({
    responsive:true, maintainAspectRatio:false,
    animation:{duration:650,easing:'easeOutQuart'},
    layout:{padding:{top:20,right:horizontal?58:16,bottom:4,left:4}},
    plugins:{
      legend:{labels:{color:'#d7e1f3',boxWidth:10,usePointStyle:true,font:{weight:'800'}}},
      datalabels:{display: window.__HAS_DATALABELS, color:'#f8fbff',anchor:'end',align:horizontal?'right':'top',offset:4,formatter:v=>moneyShort(v),font:{weight:'900',size:10},textStrokeColor:'rgba(3,7,18,.72)',textStrokeWidth:2,clamp:true},
      tooltip:{callbacks:{label:c=>`${c.dataset.label||c.label}: ${fmtMoney.format(c.parsed?.y ?? c.parsed?.x ?? c.parsed ?? 0)}`}}
    }
  }, extra || {});
  if(hasScale && !options.scales){
    options.scales = horizontal ? {
      x:{ticks:{color:'#93a4bd',callback:v=>moneyShort(v),font:{weight:'700'}},grid:{color:'rgba(255,255,255,.07)'}},
      y:{ticks:{color:'#93a4bd',font:{weight:'700'},autoSkip:false},grid:{color:'rgba(255,255,255,.07)'}}
    } : {
      x:{ticks:{color:'#93a4bd',font:{weight:'700'},maxRotation:0,autoSkip:false},grid:{color:'rgba(255,255,255,.07)'}},
      y:{ticks:{color:'#93a4bd',callback:v=>moneyShort(v),font:{weight:'700'}},grid:{color:'rgba(255,255,255,.07)'}}
    };
  }
  charts[id]=new Chart(el,{type,data,options});
}

function setupChartDefaults(){
  if(!window.Chart) return;
  if(window.ChartDataLabels){ Chart.register(window.ChartDataLabels); window.__HAS_DATALABELS=true; }
  Chart.defaults.color='#d7e1f3';
  Chart.defaults.font.family='Inter, system-ui, sans-serif';
  Chart.defaults.plugins.tooltip.backgroundColor='rgba(5,9,21,.94)';
  Chart.defaults.plugins.tooltip.borderColor='rgba(255,255,255,.14)';
  Chart.defaults.plugins.tooltip.borderWidth=1;
}

function exportCSV(){
  const rows = getFilteredRows();
  const header=['data','ano','mes','tipo','departamento','condicao','forma','cliente','descricao','os','valor','fornecedor','mecanico','origem','relatorio','classe','categoria','rateio5x','valorOriginal'];
  const csv = [header.join(';')].concat(rows.map(r=>header.map(h=>`"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(';'))).join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='base-financeira-integrada-filtrada.csv'; a.click(); URL.revokeObjectURL(a.href); toast('Base filtrada exportada em CSV.');
}

function groupBy(rows, field, valueFn){ const d={}; rows.forEach(r=>{ const k=r[field]||'Não informado'; d[k]=(d[k]||0)+(valueFn?valueFn(r):r.valor||0); }); return d; }
function entries(obj){ return Object.entries(obj).map(([key,value])=>({key,value:Math.round(value*100)/100})).sort((a,b)=>b.value-a.value); }
function sum(rows, pred){ return rows.reduce((a,r)=>a+(pred&&!pred(r)?0:(+r.valor||0)),0); }
function unique(arr){ return [...new Set(arr.filter(v=>v!==undefined&&v!==null&&v!==''))]; }
function resizeCharts(){ Object.values(charts).forEach(c=>c?.resize?.()); }
function monthsRange(rows){ const m=unique(rows.map(r=>r.mesNum)).sort((a,b)=>a-b); return m.length?`${months[m[0]-1]} a ${months[m[m.length-1]-1]}`:'sem período'; }
function prettyDept(d){ return String(d||'').replace('Mecanica','Mecânica'); }
function sectorDescription(dept){ return ({Mecanica:'Consolida os lançamentos da mecânica/Auto Geral, serviços, compras da oficina, combustível e rateios aplicáveis.', 'Peças':'Mostra receitas e custos associados a peças, materiais, compras por cliente e valores rateados.', Retifica:'Visão da retífica por serviço, pagamento e lançamentos vinculados.', Torneadora:'Serviços e compras da torneadora, com visão mensal de à vista e à prazo.', Caldeiraria:'Serviços e compras da caldeiraria, incluindo materiais e rateios fixos.'})[dept] || 'Visão por setor.'; }
function badge(tipo){ const cls=tipo==='Receita'?'receita':'gasto'; return `<span class="type-badge ${cls}">${tipo==='Gasto'?'Gasto':tipo}</span>`; }
function short(s,n=30){ s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s; }
function escapeHtml(s){ return String(s ?? '').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function brDate(s){ if(!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return s||''; const [y,m,d]=s.slice(0,10).split('-'); return `${d}/${m}/${y}`; }
function moneyShort(v){ v=+v||0; const sign=v<0?'-':''; v=Math.abs(v); if(v>=1e6) return `${sign}R$ ${(v/1e6).toFixed(1).replace('.',',')} mi`; if(v>=1e3) return `${sign}R$ ${(v/1e3).toFixed(0)} mil`; return `${sign}R$ ${v.toFixed(0)}`; }
function merge(a,b){ const o={...a}; Object.keys(b||{}).forEach(k=>{ o[k]=isObj(o[k])&&isObj(b[k])?merge(o[k],b[k]):b[k]; }); return o; }
function isObj(x){ return x && typeof x==='object' && !Array.isArray(x); }
function vehicleFromDesc(desc){ const s=String(desc||'').replace(/^Abastecimento\s*/i,'').trim(); return s || 'Não informado'; }
function kmFromObs(obs){ const m=String(obs||'').match(/KM\s*([^;]+)/i); return m ? m[1].trim() : ''; }
function toast(msg){ const t=$('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove('show'),3600); }
