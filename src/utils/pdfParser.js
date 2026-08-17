import * as pdfjsLib from 'pdfjs-dist';

// Carga do worker para o PDF.js no ambiente Vite
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.js?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const parseNumber = (str) => parseFloat(str.replace(/\./g, '').replace(',', '.'));
const isMoney = (str) => /^\d{1,3}(\.\d{3})*,\d{2}$/.test(str.trim());
const ADMISSAO_RE = /^admiss/i;
const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const CBO_RE = /^\d{6}$/;

// O PDF.js entrega os itens de texto na ordem do fluxo interno do arquivo,
// que nem sempre corresponde à ordem visual (linha a linha, coluna a
// coluna). Aqui as linhas reais são reconstruídas pela posição (x, y) de
// cada item, para poder ler a tabela do holerite coluna a coluna em vez de
// depender de regex sobre um texto "achatado" — que é frágil e muda de
// resultado dependendo de como o funcionário/via foi posicionado na página.
// Em algumas páginas o PDF quebra um mesmo valor (ex.: "4,19") em um
// fragmento por caractere ("4" "," "1" "9"), com espaçamento praticamente
// zero entre eles — bem diferente do espaço real entre palavras (~5
// unidades). Sem juntar esses fragmentos, nenhuma regex de valor monetário
// bate contra eles e a linha inteira é perdida na extração.
const FRAGMENT_GAP_THRESHOLD = 2;

const buildRows = (items) => {
  const points = items
    .filter(it => it.str.trim() !== '')
    .map(it => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, str: it.str.trim() }));
  points.sort((a, b) => b.y - a.y);

  const rows = [];
  for (const p of points) {
    let row = rows.find(r => Math.abs(r.y - p.y) <= 3);
    if (!row) { row = { y: p.y, items: [] }; rows.push(row); }
    row.items.push(p);
  }

  rows.forEach(r => {
    r.items.sort((a, b) => a.x - b.x);
    const merged = [];
    for (const it of r.items) {
      const last = merged[merged.length - 1];
      if (last && (it.x - (last.x + last.w)) < FRAGMENT_GAP_THRESHOLD) {
        last.str += it.str;
        last.w = (it.x + it.w) - last.x;
      } else {
        merged.push({ ...it });
      }
    }
    r.items = merged;
  });

  return rows;
};

const stripSpacesLower = (s) => s.toLowerCase().replace(/\s+/g, '');

// Alguns rótulos do PDF vêm como um único item de texto ("Nome do
// Funcionário", "Descrição"), mas dependendo da versão/fonte do pdfjs-dist
// e de como o gerador do holerite escreveu o PDF, o mesmo rótulo pode vir
// quebrado em vários fragmentos adjacentes na mesma linha (ex.: "Nome" +
// "do" + "Funcionário", ou "Des" + "crição", ou "Total" + "de" +
// "Vencimentos"). Esta função reconhece o rótulo nos dois casos,
// concatenando itens consecutivos até bater com o texto procurado, e
// devolve o item onde o rótulo começa (usado como referência de X).
const findItem = (row, label) => {
  const target = stripSpacesLower(label);
  for (let i = 0; i < row.items.length; i++) {
    let acc = '';
    for (let j = i; j < row.items.length; j++) {
      acc += stripSpacesLower(row.items[j].str);
      if (acc.length >= target.length) {
        if (acc.startsWith(target)) return row.items[i];
        break;
      }
      if (!target.startsWith(acc)) break;
    }
  }
  return null;
};

const stripAccents = (str) => str.normalize('NFD').replace(/[̀-ͯ]/g, '');

const MESES = {
  janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

// O PDF traz "Folha Mensal <Mês> de <Ano>" (ex.: "Folha Mensal Julho de
// 2026") em cada página — usado para pré-preencher o Mês/Ano de Referência
// automaticamente e evitar erro de digitação por parte de quem importa.
const extractMesAnoRef = (rows) => {
  for (const row of rows) {
    for (const it of row.items) {
      const m = it.str.trim().match(/^([A-Za-zçÇ]+)\s+de\s+(\d{4})$/);
      if (!m) continue;
      const mesKey = stripAccents(m[1].toLowerCase());
      if (MESES[mesKey]) return `${m[2]}-${MESES[mesKey]}`;
    }
  }
  return '';
};

// Os valores monetários costumam vir alguma linhas abaixo do rótulo e
// levemente deslocados à direita (alinhamento à direita da coluna). Em vez
// de tentar casar pela posição X exata do rótulo, pareia os valores com os
// rótulos pela ordem esquerda->direita na primeira linha seguinte que tiver
// valores monetários suficientes.
const readValuesInOrder = (rows, labelRowIndex, labelCount, maxRowsAhead = 5) => {
  for (let i = labelRowIndex + 1; i < Math.min(rows.length, labelRowIndex + 1 + maxRowsAhead); i++) {
    const moneyItems = rows[i].items.filter(it => isMoney(it.str));
    if (moneyItems.length >= labelCount) {
      return moneyItems.slice(0, labelCount).map(it => parseNumber(it.str));
    }
  }
  return new Array(labelCount).fill(0);
};

// Devolve { nome, cargo } separados. O PDF traz o nome na linha de valores
// logo abaixo do cabeçalho e, quando o texto quebra linha, o cargo/função
// aparece sozinho na linha seguinte, na mesma coluna do Nome — antes os
// dois eram concatenados num único campo "nome", o que juntava por exemplo
// "JESREEL JHEELK LINO MOTTA" com "MECANICO II".
const extractNome = (rows, headerRowIndex) => {
  const headerRow = rows[headerRowIndex];
  const nomeLabel = findItem(headerRow, 'Nome do Funcion');
  if (!nomeLabel) return null;

  const valueRow = rows[headerRowIndex + 1];
  if (!valueRow) return null;

  const nomeMinX = nomeLabel.x - 5;

  // O nome às vezes vem como um único item, às vezes quebrado em várias
  // palavras separadas na mesma linha (ex.: "JESREEL" "JHEELK" "LINO"
  // "MOTTA" como 4 itens distintos) — nesse caso o índice do cabeçalho não
  // alinha mais com a coluna certa da linha de valores. Por isso o fim da
  // coluna do nome é delimitado pelo código CBO (sempre 6 dígitos), que é
  // um marcador confiável independente de quantos itens o nome ocupa.
  const cboItem = valueRow.items.find(it => CBO_RE.test(it.str));
  const nomeMaxX = (cboItem ? cboItem.x : nomeLabel.x + 300) - 5;

  const nomeItemsRow1 = valueRow.items.filter(it => it.x >= nomeMinX && it.x < nomeMaxX);
  if (nomeItemsRow1.length === 0) return null;
  const nomeParts = [nomeItemsRow1.map(it => it.str).join(' ').trim()];

  // Código do funcionário fica à esquerda do Nome; Departamento e Filial
  // ficam à direita do CBO, nessa ordem.
  const codigoItem = valueRow.items.find(it => it.x < nomeMinX);
  const codigo = codigoItem ? codigoItem.str : '';
  const cbo = cboItem ? cboItem.str : '';
  const cboIdx = cboItem ? valueRow.items.indexOf(cboItem) : -1;
  const departamento = cboIdx >= 0 && valueRow.items[cboIdx + 1] ? valueRow.items[cboIdx + 1].str : '';
  const filial = cboIdx >= 0 && valueRow.items[cboIdx + 2] ? valueRow.items[cboIdx + 2].str : '';

  // Se o nome (ou o cargo, quando não cabe na mesma linha) continuar nas
  // próximas linhas, elas ficam na mesma coluna — a linha que contém
  // "Admissão:" é sempre a que traz o cargo/função e a data de admissão;
  // linhas antes dela, se houver, são continuação do nome.
  let cargo = '';
  let admissao = '';
  for (let j = headerRowIndex + 2; j < Math.min(rows.length, headerRowIndex + 5); j++) {
    const row = rows[j];
    const admissaoItem = row.items.find(it => ADMISSAO_RE.test(it.str));
    const rightBound = admissaoItem ? Math.min(nomeMaxX, admissaoItem.x - 5) : nomeMaxX;
    const inCol = row.items.filter(it => it.x >= nomeMinX && it.x < rightBound && !DATE_RE.test(it.str));
    if (inCol.length === 0) break;

    const text = inCol.map(it => it.str).join(' ').trim();
    if (admissaoItem) {
      cargo = text;
      const dateItem = row.items.find(it => DATE_RE.test(it.str));
      admissao = dateItem ? dateItem.str : '';
      break;
    }
    nomeParts.push(text);
  }

  return { nome: nomeParts.join(' ').trim(), cargo, codigo, cbo, departamento, filial, admissao };
};

const extractTotals = (rows, headerRowIndex) => {
  let totalVencimentosPdf = 0, totalDescontosPdf = 0, liquidoPdf = 0, salarioBase = 0;
  let salContrInss = 0, baseCalcFgts = 0, fgtsDoMes = 0, baseCalcIrrf = 0, faixaIrrf = 0;

  for (let j = headerRowIndex + 1; j < Math.min(rows.length, headerRowIndex + 30); j++) {
    const vLabel = findItem(rows[j], 'Total de Vencimentos');
    const dLabel = findItem(rows[j], 'Total de Descontos');
    if (vLabel && dLabel) {
      const [venc, desc] = readValuesInOrder(rows, j, 2);
      totalVencimentosPdf = venc;
      totalDescontosPdf = desc;
    }

    const liqLabel = findItem(rows[j], 'Valor Líquido') || findItem(rows[j], 'Valor Liquido');
    if (liqLabel) {
      const moneyInRow = rows[j].items.filter(it => isMoney(it.str));
      liquidoPdf = moneyInRow.length ? parseNumber(moneyInRow[0].str) : readValuesInOrder(rows, j, 1, 2)[0];
    }

    const salLabel = findItem(rows[j], 'Salário Base') || findItem(rows[j], 'Salario Base');
    if (salLabel) {
      // A mesma linha traz Salário Base, Sal. Contr. INSS, Base Cálc.
      // FGTS, F.G.T.S do Mês, Base Cálc. IRRF e Faixa IRRF, nessa ordem.
      const [salBase, inss, fgtsBase, fgtsMes, irrfBase, irrfFaixa] = readValuesInOrder(rows, j, 6, 2);
      salarioBase = salBase;
      salContrInss = inss;
      baseCalcFgts = fgtsBase;
      fgtsDoMes = fgtsMes;
      baseCalcIrrf = irrfBase;
      faixaIrrf = irrfFaixa;
      break; // último rótulo do bloco do funcionário na página
    }
  }

  if (!liquidoPdf) liquidoPdf = totalVencimentosPdf - totalDescontosPdf;
  return {
    totalVencimentosPdf, totalDescontosPdf, liquidoPdf, salarioBase,
    salContrInss, baseCalcFgts, fgtsDoMes, baseCalcIrrf, faixaIrrf,
  };
};

// "Assinatura do Funcionário" é o rodapé do recibo; quando a última rubrica
// fica perto dele em Y, o texto vaza para dentro da descrição da linha.
const FOOTER_NOISE_RE = /\s*ASSINATURA DO FUNCION[ÁA]RIO.*$/i;

// Lê a tabela "Código | Descrição | Referência | Vencimentos | Descontos" e
// devolve tanto os campos manuais conhecidos (Horas Extras 50%/100% e
// Faltas/Dias Suspensos) quanto a lista completa de rubricas encontradas
// (inclusive as que não têm campo próprio, como INSS, sindicato,
// adiantamento e empréstimo consignado) para exibição/conferência — sem
// somar nada nelas nos campos manuais, já que são descontos oficiais que já
// estão refletidos no Total de Descontos do próprio PDF.
const extractRubricas = (rows, headerRowIndex) => {
  const result = { rubricas: [] };

  let tableHeaderIdx = -1;
  for (let j = headerRowIndex + 1; j < Math.min(rows.length, headerRowIndex + 30); j++) {
    if (findItem(rows[j], 'Descrição') && findItem(rows[j], 'Vencimentos') && findItem(rows[j], 'Descontos')) {
      tableHeaderIdx = j;
      break;
    }
  }
  if (tableHeaderIdx === -1) return result;

  const tableHeaderRow = rows[tableHeaderIdx];
  const refAnchorX = (findItem(tableHeaderRow, 'Referência') || findItem(tableHeaderRow, 'Referencia'))?.x ?? 0;
  const vencAnchorX = findItem(tableHeaderRow, 'Vencimentos')?.x ?? 0;
  const descAnchorX = findItem(tableHeaderRow, 'Descontos')?.x ?? 0;

  const classify = (x) => {
    const dists = [['ref', Math.abs(x - refAnchorX)], ['venc', Math.abs(x - vencAnchorX)], ['desc', Math.abs(x - descAnchorX)]];
    dists.sort((a, b) => a[1] - b[1]);
    return dists[0][0];
  };

  for (let j = tableHeaderIdx + 1; j < rows.length; j++) {
    const row = rows[j];
    if (findItem(row, 'Total de Vencimentos')) break; // fim da tabela de rubricas

    const moneyItems = row.items.filter(it => isMoney(it.str));
    const nonMoneyItems = row.items.filter(it => !isMoney(it.str));
    if (moneyItems.length === 0 || nonMoneyItems.length === 0) continue;

    // O código da rubrica normalmente vem como item separado, mas às vezes
    // aparece grudado ao texto da descrição no mesmo fragmento (ex.: "8069
    // HORAS FALTAS") — por isso é extraído por regex em vez de simplesmente
    // descartar o primeiro item não-monetário.
    const rawDescricao = nonMoneyItems.map(it => it.str).join(' ').trim();
    const codeMatch = rawDescricao.match(/^(\d+)\s+(.*)$/);
    const codigoRubrica = codeMatch ? codeMatch[1] : '';
    const descricao = (codeMatch ? codeMatch[2] : rawDescricao)
      .replace(FOOTER_NOISE_RE, '')
      .trim()
      .toUpperCase();
    if (!descricao) continue;

    const byCol = { ref: 0, venc: 0, desc: 0 };
    moneyItems.forEach(it => { byCol[classify(it.x)] = parseNumber(it.str); });

    result.rubricas.push({
      codigo: codigoRubrica,
      descricao,
      tipo: byCol.desc ? 'desconto' : 'vencimento',
      referencia: byCol.ref,
      valor: byCol.desc || byCol.venc,
    });
  }

  return result;
};

// Mapeia cada rubrica do PDF pras colunas oficiais da planilha "Folha de
// PG" da cliente (G até AB) — usado pra exportação em XLSX e pra visão
// completa dentro do sistema. Cada regra é checada nessa ordem (a primeira
// que bater vence); o que não encaixa em nenhuma vai pra "outros" — nunca
// é descartado, só fica sem coluna específica.
const REGRAS_CLASSIFICACAO_OFICIAL = [
  { campo: 'horaExtra100', re: /100\s*%/ },
  { campo: 'horaExtra50', re: /^HORAS EXTRAS/ },
  { campo: 'adicionalNoturno', re: /ADICIONAL NOTURNO/ },
  { campo: 'salarioFamilia', re: /SALARIO FAMILIA|SALÁRIO FAMÍLIA/ },
  { campo: 'licencaMedica', re: /LICEN[CÇ]A M[EÉ]DICA|AFAST(AMENTO)?.*DOEN[CÇ]A|MEDIA AFAST/ },
  { campo: 'periculosidade', re: /PERICULOSIDADE/ },
  { campo: 'tempoServico', re: /^(SEXENIO|QUINQUENIO|QUATRIENIO|TRIENIO|BIENIO|ANUENIO|DECENIO|OITOCENIO|SETECENIO|NOVENIO)\b|TEMPO DE SERVI[CÇ]O/ },
  { campo: 'dsr', re: /REFLEXO.*DSR|^DSR\b/ },
  { campo: 'comissaoOficial', re: /COMISS[AÃ]O/ },
  { campo: 'contConf', re: /CONFEDERATIVA/ },
  { campo: 'inss', re: /I\.?N\.?S\.?S\.?/ },
  { campo: 'suspensao', re: /SUSPENS/ },
  { campo: 'faltasHoras', re: /HORAS FALTAS/ },
  { campo: 'irrf', re: /IRRF/ },
  { campo: 'falta', re: /FALTA/ },
  { campo: 'odonto', re: /ODONTOL[OÓ]GICA|^ODON\b/ },
  { campo: 'emprestimo', re: /EMP\.?\s*CRED|EMPRESTIMO/ },
  { campo: 'vale', re: /^VALE\b|ADIANT/ },
];

// Soma cada rubrica na coluna oficial correspondente (ver tabela acima).
// O que não bate com nenhuma regra entra em "outros" — nem soma escondida,
// nem rubrica perdida, só sem coluna própria pra não inventar categoria.
const classificarRubricas = (rubricas) => {
  const oficial = {
    horaExtra50: 0, horaExtra100: 0, adicionalNoturno: 0, salarioFamilia: 0,
    licencaMedica: 0, periculosidade: 0, tempoServico: 0, dsr: 0, comissaoOficial: 0,
    contConf: 0, inss: 0, suspensao: 0, faltasHoras: 0, irrf: 0, falta: 0,
    odonto: 0, emprestimo: 0, vale: 0, outros: [],
  };

  for (const r of rubricas || []) {
    if (r.descricao === 'DIAS NORMAIS') continue; // já é o Salário Base (G), não é "outros"
    const regra = REGRAS_CLASSIFICACAO_OFICIAL.find(({ re }) => re.test(r.descricao));
    if (regra) {
      oficial[regra.campo] += r.valor;
    } else {
      oficial.outros.push({ descricao: r.descricao, tipo: r.tipo, valor: r.valor });
    }
  }

  return oficial;
};

// Cálculo de Horas Extras com base no Salário Extra Folha:
// Hora normal = Salário ÷ 220
// Hora extra 50% = (Salário ÷ 220) × 1,5 × Qtd Horas
// Hora extra 100% = (Salário ÷ 220) × 2 × Qtd Horas
export const calcHorasExtras = (extraFolha, h50, h100) => {
  const sal = Number(extraFolha) || 0;
  const qtd50 = Number(h50) || 0;
  const qtd100 = Number(h100) || 0;

  const horasEx50 = sal > 0 && qtd50 > 0 ? Number(((sal / 220) * 1.5 * qtd50).toFixed(2)) : 0;
  const horasEx100 = sal > 0 && qtd100 > 0 ? Number(((sal / 220) * 2.0 * qtd100).toFixed(2)) : 0;

  return { horasEx50, horasEx100 };
};

export const extractHoleritesFromPDF = async (file) => {
  const fileReader = new FileReader();

  return new Promise((resolve, reject) => {
    fileReader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const totalPages = pdf.numPages;

        let employees = [];
        let mesAnoRef = '';

        for (let p = 1; p <= totalPages; p++) {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          if (!textContent || !textContent.items || textContent.items.length === 0) continue;
          const rows = buildRows(textContent.items);
          if (!rows || rows.length === 0) continue;

          if (!mesAnoRef) mesAnoRef = extractMesAnoRef(rows);

          for (let k = 0; k < rows.length; k++) {
            if (!findItem(rows[k], 'Nome do Funcion')) continue;
            if (!rows[k] || !rows[k].items) continue;

            const extractedNome = extractNome(rows, k);
            if (!extractedNome || !extractedNome.nome) continue;
            const { nome, cargo: cargoPdf, codigo, cbo, departamento, filial, admissao } = extractedNome;
            if (employees.find(emp => emp.nome === nome)) continue;

            const {
              totalVencimentosPdf, totalDescontosPdf, liquidoPdf, salarioBase,
              salContrInss, baseCalcFgts, fgtsDoMes, baseCalcIrrf, faixaIrrf,
            } = extractTotals(rows, k);
            const { rubricas } = extractRubricas(rows, k);
            const oficial = classificarRubricas(rubricas);

            // Extrai quantidade de horas extras (50% e 100%) a partir das rubricas do PDF
            let h50 = 0;
            let h100 = 0;
            for (const r of rubricas || []) {
              if (/100\s*%/.test(r.descricao)) {
                h100 += Number(r.referencia || 0);
              } else if (/50\s*%|^HORAS?\s+EXTRAS?/i.test(r.descricao)) {
                h50 += Number(r.referencia || 0);
              }
            }

            const extraFolha = 0;
            const { horasEx50, horasEx100 } = calcHorasExtras(extraFolha, h50, h100);

            employees.push({
              nome,
              cargoPdf, // cargo/função conforme o PDF, separado do nome
              codigo, cbo, departamento, filial, admissao,
              salarioBase,
              totalVencimentosPdf,
              totalDescontosPdf,
              liquidoPdf,
              salContrInss, baseCalcFgts, fgtsDoMes, baseCalcIrrf, faixaIrrf,
              rubricas, // detalhamento completo de todas as linhas do PDF, para reconstruir o holerite no recibo
              oficial, // rubricas classificadas nas colunas da planilha "Folha de PG" (G–AB), só pra conferência/exportação
              // Campos "extra" 100% manuais — o recibo já mostra a rubrica
              // oficial completa (rubricas acima), então esses começam
              // zerados e representam só o que for lançado A MAIS do que
              // já está no holerite oficial (evita contar o mesmo valor
              // duas vezes no recibo final).
              extraFolha,
              comissao: 0,
              h50,
              horasEx50,
              h100,
              horasEx100,
              hDss: 0,
              dssHex: 0,
              faltas: 0,
              vale: 0,
            });
          }
        }

        if (employees.length === 0) {
          const firstPage = await pdf.getPage(1);
          const debugText = (await firstPage.getTextContent()).items.map(i => i.str).join(' ').substring(0, 600);
          throw new Error("DEBUG_TEXT: " + debugText);
        }

        resolve({ employees, mesAnoRef });
      } catch (err) {
        const msg = err.message || String(err);
        if (msg.startsWith('DEBUG_TEXT:')) {
          reject(new Error('Nenhum funcionário encontrado no PDF. Verifique se o arquivo é um holerite válido.'));
        } else {
          reject(err);
        }
      }
    };
    fileReader.onerror = () => reject(new Error('Erro ao ler o arquivo. Tente novamente.'));
    fileReader.readAsArrayBuffer(file);
  });
};
