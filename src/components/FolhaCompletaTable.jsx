import React from 'react';
import { COLUNAS } from '../utils/holeriteExport';

const fmt = (v) => {
  if (typeof v === 'number') return v === 0 ? '-' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v || '';
};

// Só a coluna 0 (Funcionário) fica fixa ao rolar pro lado.
const NOME_COL_WIDTH = 180;
const stickyNomeStyle = { position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 1 };

// Mesma visão da planilha "Folha de PG" da cliente (colunas A–AO), montada
// a partir dos mesmos getters usados na exportação em XLSX — o que aparece
// aqui na tela é exatamente o que sai no arquivo baixado.
const FolhaCompletaTable = ({ holerites }) => {
  if (!holerites || holerites.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>Nenhum lançamento para mostrar.</div>;
  }

  // Agrupa cabeçalhos de grupo consecutivos pra fazer o colSpan — as
  // colunas iniciais sem grupo (Funcionário, Função) viram um grupo vazio,
  // senão a linha de grupos fica com menos células que a de colunas e a
  // tabela desalinha.
  const grupos = [];
  COLUNAS.forEach((c, i) => {
    if (c.grupo) {
      grupos.push({ nome: c.grupo, inicio: i, fim: i });
    } else if (grupos.length > 0) {
      grupos[grupos.length - 1].fim = i;
    } else {
      grupos.push({ nome: '', inicio: i, fim: i });
    }
  });

  return (
    <div className="table-wrap" style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
      <table style={{ minWidth: `${COLUNAS.length * 110}px`, fontSize: '12px' }}>
        <thead>
          <tr>
            {grupos.map((g, i) => (
              <th
                key={i}
                colSpan={g.fim - g.inicio + 1}
                style={{
                  textAlign: 'center', position: 'sticky', top: 0,
                  zIndex: g.inicio === 0 ? 3 : 2,
                  ...(g.inicio === 0 ? { left: 0, width: NOME_COL_WIDTH, background: 'var(--bg)' } : {}),
                }}
              >
                {g.nome}
              </th>
            ))}
          </tr>
          <tr>
            {COLUNAS.map((c, i) => (
              <th
                key={i}
                style={{
                  position: 'sticky', top: '29px', zIndex: i === 0 ? 3 : 2, whiteSpace: 'nowrap',
                  ...(i === 0 ? { left: 0, width: NOME_COL_WIDTH, background: 'var(--bg)' } : {}),
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holerites.map((h, ri) => (
            <tr key={ri}>
              {COLUNAS.map((c, ci) => (
                <td
                  key={ci}
                  style={{
                    textAlign: ci <= 1 ? 'left' : 'right', whiteSpace: ci <= 1 ? 'nowrap' : 'normal',
                    ...(ci === 0 ? stickyNomeStyle : {}),
                  }}
                >
                  {fmt(c.get(h))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FolhaCompletaTable;
