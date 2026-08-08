import React from 'react';
import '../styles/recibo.css';
import { assinaturaColunaDataUri, ASSINATURA_LARGURA, ASSINATURA_ALTURA } from './assinaturaColuna';

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const formatMesAnoRef = (value) => {
  if (!value) return '';
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return value;
  const mesNome = MESES_PT[parseInt(m[2], 10) - 1];
  return mesNome ? `${mesNome} de ${m[1]}` : value;
};

const f = (val) => Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Só o que é lançado manualmente (Extra Folha, Comissão, Horas Extras, DSS,
// Faltas, Vale) entra no recibo — os dados do holerite oficial (importados
// do PDF) ficam só na tela do sistema, como referência de conferência; não
// são impressos de novo aqui. Reflete exatamente a planilha "Folha de PG"
// da cliente: "Salário Avista" (AN) = soma dos proventos extra (AM) menos
// Faltas e Vale, sem nenhuma coluna do holerite oficial (A–AB) entrando na
// conta.
const buildLinhas = (hol) => ([
  { descricao: 'Extra Folha', referencia: 0, valor: Number(hol.extraFolha || 0), tipo: 'vencimento' },
  { descricao: 'Comissão', referencia: 0, valor: Number(hol.comissao || 0), tipo: 'vencimento' },
  { descricao: 'Horas Extras 50%', referencia: Number(hol.h50 || 0), valor: Number(hol.horasEx50 || 0), tipo: 'vencimento' },
  { descricao: 'Horas Extras 100%', referencia: Number(hol.h100 || 0), valor: Number(hol.horasEx100 || 0), tipo: 'vencimento' },
  { descricao: 'DSS', referencia: Number(hol.hDss || 0), valor: Number(hol.dssHex || 0), tipo: 'vencimento' },
  { descricao: 'Faltas', referencia: 0, valor: Number(hol.faltas || 0), tipo: 'desconto' },
  { descricao: 'Vale', referencia: 0, valor: Number(hol.vale || 0), tipo: 'desconto' },
].filter(l => l.valor > 0));

const ReciboPrint = ({ holerites = [], mesAnoRef = '' }) => {
  if (!holerites || holerites.length === 0) return null;

  return (
    <div className="recibo-print-container">
      {holerites.map((hol, index) => {
        const linhas = buildLinhas(hol);

        // AM da planilha: soma dos proventos extra
        const totalProventos = Number(hol.extraFolha || 0) + Number(hol.comissao || 0) + Number(hol.horasEx50 || 0) + Number(hol.horasEx100 || 0) + Number(hol.dssHex || 0);
        const totalDescontos = Number(hol.faltas || 0) + Number(hol.vale || 0);
        // AN da planilha: "Salário Avista" = AM - Vale - Faltas
        const salarioAvista = totalProventos - totalDescontos;

        return (
          <div key={index} className="hol-wrapper recibo-page">

            {/* ── COLUNA PRINCIPAL 90% ── */}
            <div className="hol-main">

              {/* Cabeçalho */}
              <div className="hol-header">
                <div className="hol-hd-empresa">
                  <strong>PERNAMBUCANA SERVIÇOS ADMINISTRATIVOS LTDA</strong>
                  <span>CNPJ: 66.477.205/0001-70</span>
                </div>
                <div className="hol-hd-titulo">
                  <strong>RECIBO DE PAGAMENTO EXTRA</strong>
                  <span>{hol.nome}{hol.cargo ? ` — ${hol.cargo}` : ''}</span>
                </div>
                <div className="hol-hd-folha">
                  <span>Folha Mensal</span>
                  <span>{formatMesAnoRef(hol.mesAnoRef || mesAnoRef)}</span>
                </div>
              </div>

              {/* Rubricas lançadas manualmente */}
              <div className="hol-rubricas">
                <table className="hol-table">
                  <colgroup>
                    <col style={{ width: '46%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '18%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th className="td-right">Referência</th>
                      <th className="td-right">Vencimentos</th>
                      <th className="td-right">Descontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => (
                      <tr key={i}>
                        <td>{l.descricao}</td>
                        <td className="td-right">{l.referencia > 0 ? f(l.referencia) : ''}</td>
                        <td className="td-right">{l.tipo === 'vencimento' ? f(l.valor) : ''}</td>
                        <td className="td-right">{l.tipo === 'desconto' ? f(l.valor) : ''}</td>
                      </tr>
                    ))}
                    {linhas.length === 0 && (
                      <tr><td colSpan="4" style={{ textAlign: 'center', color: '#666' }}>Nenhum lançamento extra</td></tr>
                    )}
                    <tr className="hol-filler"><td colSpan="4"></td></tr>
                  </tbody>
                </table>
              </div>

              {/* Totais */}
              <div className="hol-totais">
                <div className="hol-totais-blank"></div>
                <div className="hol-totais-box">
                  <div className="hol-totais-linha hol-totais-header">
                    <span>Total de Vencimentos</span>
                    <span>Total de Descontos</span>
                  </div>
                  <div className="hol-totais-linha">
                    <span className="td-right">{f(totalProventos)}</span>
                    <span className="td-right">{f(totalDescontos)}</span>
                  </div>
                  <div className="hol-liquido">
                    <span>Salário Avista ⇨</span>
                    <span className="hol-liquido-valor">{f(salarioAvista)}</span>
                  </div>
                </div>
              </div>

            </div>{/* fim hol-main */}

            {/* ── COLUNA ASSINATURA 10% ── */}
            <div className="hol-assinatura">
              <img
                src={assinaturaColunaDataUri}
                width={ASSINATURA_LARGURA}
                height={ASSINATURA_ALTURA}
                alt="Assinatura do funcionário e data"
              />
            </div>

          </div>
        );
      })}
    </div>
  );
};

export default ReciboPrint;
