// Importação da planilha "Financeiro Retifica 2026" (Google Sheets, base de um
// formulário). Só serve para o setor Retífica — todos os registros importados
// entram com setor 'Retifica'.
//
// A leitura é feita via gviz JSONP (script tag), que funciona com qualquer
// planilha compartilhada como "qualquer pessoa com o link pode ver", sem
// depender de CORS nem de proxy.

export const RETIFICA_SHEET_ID = '1exlHnDH7AGF7OEr11SOSbSeWbzQBWWpZiziAGAnGAK0';

// Nome das abas na planilha
export const RETIFICA_ABAS = {
  servicos: 'Serviços',
  compras: 'Compras',
};

// Carrega uma aba via gviz JSONP e devolve { cols, rows } já "achatados"
// (cada célula vira o texto formatado, ou o valor bruto quando não há formato).
export const carregarAbaRetifica = (aba) =>
  new Promise((resolve, reject) => {
    const sheetName = RETIFICA_ABAS[aba] || aba;
    const cb = `__retificaCb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const script = document.createElement('script');
    const cleanup = () => {
      delete window[cb];
      script.remove();
    };

    window[cb] = (resp) => {
      cleanup();
      try {
        if (!resp || !resp.table) return reject(new Error('Resposta inválida da planilha.'));
        const cols = (resp.table.cols || []).map((c) => (c.label || '').trim());
        const rows = (resp.table.rows || []).map((r) =>
          (r.c || []).map((cell) => {
            if (!cell) return '';
            if (cell.f != null) return String(cell.f);
            if (cell.v == null) return '';
            return String(cell.v);
          })
        );
        resolve({ cols, rows });
      } catch (err) {
        reject(err);
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Não foi possível acessar a planilha. Confirme que o compartilhamento está como "qualquer pessoa com o link".'));
    };

    const url =
      `https://docs.google.com/spreadsheets/d/${RETIFICA_SHEET_ID}/gviz/tq` +
      `?sheet=${encodeURIComponent(sheetName)}&tqx=responseHandler:${cb}`;
    script.src = url;
    document.body.appendChild(script);

    setTimeout(() => {
      if (window[cb]) {
        cleanup();
        reject(new Error('Tempo esgotado ao carregar a planilha.'));
      }
    }, 30000);
  });

// "R$ 1.234,56" / " R$ - " / "1,00" -> número
const paraNumero = (v) => {
  if (v == null) return 0;
  const s = String(v).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

// "16/03/2026" -> "2026-03-16"
const paraDataISO = (v) => {
  const m = String(v || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = String(v || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return '';
};

const limpar = (v) => String(v || '').trim().replace(/\s+/g, ' ');
const norm = (v) => limpar(v).toLowerCase();

const ehPrazo = (v) => norm(v).includes('prazo');

// Chave estável por linha da planilha, usada para não reimportar o que já foi
// carregado no sistema.
const chaveServico = (o) =>
  [paraDataISO(o.data), norm(o.os), norm(o.cliente), norm(o.descricao), Number(o.valorTotal || 0).toFixed(2)].join('|');

const chaveCompra = (o) =>
  [paraDataISO(o.data), norm(o.fornecedor), norm(o.descricao), norm(o.numOS), Number(o.valorProduto || 0).toFixed(2)].join('|');

// Aba Serviços — colunas por índice (o cabeçalho da planilha é irregular):
// 0 Data | 1 Mês | 2 Lançamento | 3 Forma (à Prazo/à Vista) | 4 (aux) |
// 5 Cliente | 6 Descrição | 7 Qtd | 8 OS | 9 Valor unit. | 10 Total |
// 11 Produtivo | 12 (coluna quebrada, ignorada) | 13 Desconto | 14 Material | 15 Serviço/Tipo
export const parseServicosRetifica = (rows) => {
  const out = [];
  for (const r of rows) {
    if (!/retif/i.test(r[2] || '')) continue;
    const dataISO = paraDataISO(r[0]);
    const cliente = limpar(r[5]);
    if (!dataISO || !cliente) continue;

    const qtd = Math.max(1, Math.round(paraNumero(r[7])) || 1);
    const valorUnit = paraNumero(r[9]);
    const total = paraNumero(r[10]) || valorUnit * qtd;
    const prazo = ehPrazo(r[3]);

    const item = {
      data: dataISO,
      mes: limpar(r[1]),
      setor: 'Retifica',
      pagamento: prazo ? 'À prazo' : 'À vista',
      cliente,
      descricao: limpar(r[6]),
      qtd,
      os: limpar(r[8]),
      valorUnitario: valorUnit || (total / qtd) || 0,
      valorTotal: total,
      produtivo: limpar(r[11]),
      valorProdutivo: 0,
      desconto: paraNumero(r[13]),
      material: paraNumero(r[14]),
      tipoServico: limpar(r[15]) || 'Retifica',
      numParcelas: prazo ? 1 : 0,
      vendaValidada: false,
      notaFiscal: '',
      dataNotaFiscal: '',
    };
    item.sheetKey = chaveServico(item);
    out.push(item);
  }
  return out;
};

// Aba Compras — cabeçalho alinhado:
// 0 Data | 1 Mês | 2 Lançamento | 3 Forma de Compra | 4 Solicitante |
// 5 Descrição | 6 N° da OS | 7 Valor da OS | 8 Valor do Produto | 9 Fornecedor |
// 10 N° do Pedido | 11 Categoria
export const parseComprasRetifica = (rows) => {
  const out = [];
  for (const r of rows) {
    if (!/retif/i.test(r[2] || '')) continue;
    const dataISO = paraDataISO(r[0]);
    const valorProduto = paraNumero(r[8]);
    if (!dataISO || (!valorProduto && !limpar(r[5]))) continue;

    const prazo = ehPrazo(r[3]);
    const item = {
      data: dataISO,
      mes: limpar(r[1]),
      setor: 'Retifica',
      setores: ['Retifica'],
      formaCompra: prazo ? 'À prazo' : 'À vista',
      solicitante: limpar(r[4]),
      descricao: limpar(r[5]) || 'Compra Importada',
      numOS: limpar(r[6]),
      valorOS: paraNumero(r[7]),
      valorProduto,
      fornecedor: limpar(r[9]),
      numPedido: limpar(r[10]),
      categoria: limpar(r[11]) || 'Almoxarifado',
      numParcelas: prazo ? 1 : 0,
    };
    item.sheetKey = chaveCompra(item);
    out.push(item);
  }
  return out;
};
