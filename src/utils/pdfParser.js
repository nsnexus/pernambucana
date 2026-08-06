import * as pdfjsLib from 'pdfjs-dist';

// Carga do worker para o PDF.js no ambiente Vite
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.js?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const parseNumber = (str) => parseFloat(str.replace(/\./g, '').replace(',', '.'));
const isMoney = (str) => /^\d{1,3}(\.\d{3})*,\d{2}$/.test(str.trim());
const ADMISSAO_RE = /^admiss/i;
const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

// O PDF.js entrega os itens de texto na ordem do fluxo interno do arquivo,
// que nem sempre corresponde à ordem visual (linha a linha, coluna a
// coluna). Aqui as linhas reais são reconstruídas pela posição (x, y) de
// cada item, para poder ler a tabela do holerite coluna a coluna em vez de
// depender de regex sobre um texto "achatado" — que é frágil e muda de
// resultado dependendo de como o funcionário/via foi posicionado na página.
const buildRows = (items) => {
  const points = items
    .filter(it => it.str.trim() !== '')
    .map(it => ({ x: it.transform[4], y: it.transform[5], str: it.str.trim() }));
  points.sort((a, b) => b.y - a.y);

  const rows = [];
  for (const p of points) {
    let row = rows.find(r => Math.abs(r.y - p.y) <= 3);
    if (!row) { row = { y: p.y, items: [] }; rows.push(row); }
    row.items.push(p);
  }
  rows.forEach(r => r.items.sort((a, b) => a.x - b.x));
  return rows;
};

const findItem = (row, label) => row.items.find(it => it.str.toLowerCase().startsWith(label.toLowerCase()));

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

const extractNome = (rows, headerRowIndex) => {
  const headerRow = rows[headerRowIndex];
  const nomeIdx = headerRow.items.findIndex(it => /^nome do funcion/i.test(it.str));
  if (nomeIdx === -1) return null;

  // A linha de valores logo abaixo segue a mesma ordem de colunas do
  // cabeçalho (Código, Nome, CBO, Departamento, Filial) — usar o índice
  // evita confundir o nome com o valor do CBO, que às vezes fica deslocado
  // para a esquerda o suficiente para invadir a faixa de X do nome.
  const valueRow = rows[headerRowIndex + 1];
  if (!valueRow || valueRow.items.length <= nomeIdx) return null;
  const nameParts = [valueRow.items[nomeIdx].str];

  // Cargo, quando quebra linha, fica na linha seguinte, na mesma coluna do Nome
  const nomeLabel = headerRow.items[nomeIdx];
  const nextLabel = headerRow.items[nomeIdx + 1];
  const nomeMinX = nomeLabel.x - 5;
  const nomeMaxX = (nextLabel ? nextLabel.x : nomeLabel.x + 300) - 5;

  const wrapRow = rows[headerRowIndex + 2];
  if (wrapRow) {
    const admissaoItem = wrapRow.items.find(it => ADMISSAO_RE.test(it.str));
    const rightBound = admissaoItem ? Math.min(nomeMaxX, admissaoItem.x - 5) : nomeMaxX;
    const inCol = wrapRow.items.filter(it => it.x >= nomeMinX && it.x < rightBound && !DATE_RE.test(it.str));
    nameParts.push(...inCol.map(it => it.str));
  }

  return nameParts.join(' ').trim();
};

const extractTotals = (rows, headerRowIndex) => {
  let totalVencimentosPdf = 0, totalDescontosPdf = 0, liquidoPdf = 0, salarioBase = 0;

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
      salarioBase = readValuesInOrder(rows, j, 1, 2)[0];
      break; // último rótulo do bloco do funcionário na página
    }
  }

  if (!liquidoPdf) liquidoPdf = totalVencimentosPdf - totalDescontosPdf;
  return { totalVencimentosPdf, totalDescontosPdf, liquidoPdf, salarioBase };
};

// "Assinatura do Funcionário" é o rodapé do recibo; quando a última rubrica
// fica perto dele em Y, o texto vaza para dentro da descrição da linha.
const FOOTER_NOISE_RE = /\s*ASSINATURA DO FUNCION[ÁA]RIO.*$/i;
const FALTA_RE = /FALTA|SUSPENS/;

// Lê a tabela "Código | Descrição | Referência | Vencimentos | Descontos" e
// devolve tanto os campos manuais conhecidos (Horas Extras 50%/100% e
// Faltas/Dias Suspensos) quanto a lista completa de rubricas encontradas
// (inclusive as que não têm campo próprio, como INSS, sindicato,
// adiantamento e empréstimo consignado) para exibição/conferência — sem
// somar nada nelas nos campos manuais, já que são descontos oficiais que já
// estão refletidos no Total de Descontos do próprio PDF.
const extractRubricas = (rows, headerRowIndex) => {
  const result = { h50: 0, horasEx50: 0, h100: 0, horasEx100: 0, faltas: 0, rubricas: [] };

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
    // HORAS FALTAS") — por isso remove-se o número por regex em vez de
    // simplesmente descartar o primeiro item não-monetário.
    const descricao = nonMoneyItems.map(it => it.str).join(' ').trim()
      .replace(/^\d+\s+/, '')
      .replace(FOOTER_NOISE_RE, '')
      .trim()
      .toUpperCase();
    if (!descricao || descricao === 'DIAS NORMAIS') continue; // já coberto pelo Salário Base

    const byCol = { ref: 0, venc: 0, desc: 0 };
    moneyItems.forEach(it => { byCol[classify(it.x)] = parseNumber(it.str); });

    if (descricao.includes('100%')) {
      result.h100 += byCol.ref;
      result.horasEx100 += byCol.venc;
    } else if (descricao.startsWith('HORAS EXTRAS')) {
      result.h50 += byCol.ref;
      result.horasEx50 += byCol.venc;
    } else if (byCol.desc && FALTA_RE.test(descricao)) {
      result.faltas += byCol.desc;
    }

    result.rubricas.push({
      descricao,
      tipo: byCol.desc ? 'desconto' : 'vencimento',
      referencia: byCol.ref,
      valor: byCol.desc || byCol.venc,
    });
  }

  return result;
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

        for (let p = 1; p <= totalPages; p++) {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          const rows = buildRows(textContent.items);

          for (let k = 0; k < rows.length; k++) {
            if (!findItem(rows[k], 'Nome do Funcion')) continue;

            const nome = extractNome(rows, k);
            if (!nome) continue;
            if (employees.find(emp => emp.nome === nome)) continue;

            const { totalVencimentosPdf, totalDescontosPdf, liquidoPdf, salarioBase } = extractTotals(rows, k);
            const { h50, horasEx50, h100, horasEx100, faltas, rubricas } = extractRubricas(rows, k);

            employees.push({
              nome,
              salarioBase,
              totalVencimentosPdf,
              totalDescontosPdf,
              liquidoPdf,
              rubricas, // detalhamento completo de todas as linhas do PDF, só para conferência
              // Rubricas extraídas do PDF, editáveis manualmente na tela
              extraFolha: 0,
              comissao: 0,
              h50,
              horasEx50,
              h100,
              horasEx100,
              hDss: 0,
              dssHex: 0,
              faltas,
              vale: 0,
            });
          }
        }

        if (employees.length === 0) {
          const firstPage = await pdf.getPage(1);
          const debugText = (await firstPage.getTextContent()).items.map(i => i.str).join(' ').substring(0, 600);
          throw new Error("DEBUG_TEXT: " + debugText);
        }

        resolve(employees);
      } catch (err) {
        reject(err);
      }
    };
    fileReader.readAsArrayBuffer(file);
  });
};
