import * as XLSX from 'xlsx';

// Layout de colunas espelhando a planilha "Folha de PG" da cliente.
// A–AB vêm do holerite oficial (importado do PDF); AC–AL são lançamento
// manual; AM–AO são os totais calculados (mesmas fórmulas da planilha
// original: AM = soma dos proventos extra, AN = Salário Avista, AO =
// Salário Depósito). "Outros" no fim é nosso, não existe na planilha da
// cliente — junta qualquer rubrica do PDF que não bateu com nenhuma coluna
// conhecida, pra nada ficar escondido.
export const COLUNAS = [
  { grupo: '', header: 'Funcionário', get: h => h.nome },
  { grupo: '', header: 'Função', get: h => h.cargoPdf || h.cargo || '' },
  { grupo: 'Holerite Oficial (PDF)', header: 'SALÁRIO', get: h => h.salarioBase },
  { grupo: '', header: 'HORA EXTRA 50%', get: h => h.oficial?.horaExtra50 },
  { grupo: '', header: 'HORA EXTRA 100%', get: h => h.oficial?.horaExtra100 },
  { grupo: '', header: 'ADICIONAL NOTURNO', get: h => h.oficial?.adicionalNoturno },
  { grupo: '', header: 'SALARIO FAMILIA', get: h => h.oficial?.salarioFamilia },
  { grupo: '', header: 'Licença Médica', get: h => h.oficial?.licencaMedica },
  { grupo: '', header: 'PERICULOSIDADE', get: h => h.oficial?.periculosidade },
  { grupo: '', header: 'TEMPO DE SERVIÇO', get: h => h.oficial?.tempoServico },
  { grupo: '', header: 'DSR', get: h => h.oficial?.dsr },
  { grupo: '', header: 'COMISSÃO', get: h => h.oficial?.comissaoOficial },
  { grupo: '', header: 'TOTAL', get: h => h.totalVencimentosPdf },
  { grupo: '', header: 'CONT.CONF', get: h => h.oficial?.contConf },
  { grupo: '', header: 'INSS', get: h => h.oficial?.inss },
  { grupo: '', header: 'SUSPENSÃO DISC.', get: h => h.oficial?.suspensao },
  { grupo: '', header: 'FALTAS HORAS', get: h => h.oficial?.faltasHoras },
  { grupo: '', header: 'IRRF', get: h => h.oficial?.irrf },
  { grupo: '', header: 'FALTA', get: h => h.oficial?.falta },
  { grupo: '', header: 'ODON', get: h => h.oficial?.odonto },
  { grupo: '', header: 'Emprestimo', get: h => h.oficial?.emprestimo },
  { grupo: '', header: 'VALE', get: h => h.oficial?.vale },
  { grupo: '', header: 'Valor Desconto', get: h => h.totalDescontosPdf },
  { grupo: 'Pagamento Extra Folha (Manual)', header: 'Extra Folha', get: h => h.extraFolha },
  { grupo: '', header: 'COMISSÃO', get: h => h.comissao },
  { grupo: '', header: 'H 50%', get: h => h.h50 },
  { grupo: '', header: 'HORAS EX 50%', get: h => h.horasEx50 },
  { grupo: '', header: 'H 100%', get: h => h.h100 },
  { grupo: '', header: 'HORAS EX 100%', get: h => h.horasEx100 },
  { grupo: '', header: 'H DSS', get: h => h.hDss },
  { grupo: '', header: 'DSS HEX', get: h => h.dssHex },
  { grupo: '', header: 'Faltas', get: h => h.faltas },
  { grupo: '', header: 'Vale', get: h => h.vale },
  {
    grupo: 'Valores para Pagamento', header: 'Salário Avista',
    get: h => (Number(h.extraFolha || 0) + Number(h.comissao || 0) + Number(h.horasEx50 || 0) + Number(h.horasEx100 || 0) + Number(h.dssHex || 0))
      - Number(h.faltas || 0) - Number(h.vale || 0),
  },
  { grupo: '', header: 'Salário Depósito', get: h => h.liquidoPdf },
  { grupo: 'Não Classificado', header: 'Outros (rubricas do PDF sem coluna própria)', get: h => (h.oficial?.outros || []).map(o => `${o.descricao}: ${o.tipo === 'desconto' ? '-' : ''}${Number(o.valor).toFixed(2)}`).join('; ') },
];

export const exportFolhaPGXlsx = (holerites, mesAnoRef, filename) => {
  const linha1 = COLUNAS.map(c => c.grupo);
  const linha2 = COLUNAS.map(c => c.header);
  const linhasDados = holerites.map(h => COLUNAS.map(c => {
    const v = c.get(h);
    return typeof v === 'number' ? Number(v.toFixed(2)) : (v || '');
  }));

  const aoa = [[`Folha de Pagamento — ${mesAnoRef || ''}`], linha1, linha2, ...linhasDados];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Mescla o título e os cabeçalhos de grupo que se repetem em branco
  const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLUNAS.length - 1 } }];
  let inicioGrupo = null;
  COLUNAS.forEach((c, i) => {
    if (c.grupo) {
      if (inicioGrupo !== null) merges.push({ s: { r: 1, c: inicioGrupo }, e: { r: 1, c: i - 1 } });
      inicioGrupo = i;
    }
  });
  if (inicioGrupo !== null) merges.push({ s: { r: 1, c: inicioGrupo }, e: { r: 1, c: COLUNAS.length - 1 } });
  ws['!merges'] = merges;
  ws['!cols'] = COLUNAS.map(c => ({ wch: Math.max(12, c.header.length + 2) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Folha de PG');
  XLSX.writeFile(wb, filename);
};
