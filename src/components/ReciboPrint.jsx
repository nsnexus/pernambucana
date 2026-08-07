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

const buildLinhas = (hol) => {
  const linhas = (hol.rubricas || []).map(r => ({ codigo: r.codigo, descricao: r.descricao, referencia: r.referencia, valor: r.valor, tipo: r.tipo }));
  const extras = [
    { campo: 'extraFolha', descricao: 'Salário Extra', tipo: 'vencimento' },
    { campo: 'comissao', descricao: 'Comissão (Extra)', tipo: 'vencimento' },
    { campo: 'horasEx50', descricao: 'Horas Extras 50% (Extra)', tipo: 'vencimento', refCampo: 'h50' },
    { campo: 'horasEx100', descricao: 'Horas Extras 100% (Extra)', tipo: 'vencimento', refCampo: 'h100' },
    { campo: 'dssHex', descricao: 'DSS (Extra)', tipo: 'vencimento', refCampo: 'hDss' },
    { campo: 'faltas', descricao: 'Faltas (Extra)', tipo: 'desconto' },
    { campo: 'vale', descricao: 'Vale (Extra)', tipo: 'desconto' },
  ];
  extras.forEach(({ campo, descricao, tipo, refCampo }) => {
    const valor = Number(hol[campo] || 0);
    if (valor > 0) linhas.push({ codigo: '', descricao, referencia: refCampo ? Number(hol[refCampo] || 0) : 0, valor, tipo });
  });
  return linhas;
};

const f = (val) => Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ReciboPrint = ({ holerites = [], mesAnoRef = '' }) => {
  if (!holerites || holerites.length === 0) return null;

  return (
    <div className="recibo-print-container">
      {holerites.map((hol, index) => {
        const linhas = buildLinhas(hol);
        const extrasV = Number(hol.extraFolha || 0) + Number(hol.comissao || 0) + Number(hol.horasEx50 || 0) + Number(hol.horasEx100 || 0) + Number(hol.dssHex || 0);
        const extrasD = Number(hol.faltas || 0) + Number(hol.vale || 0);
        const totalV = Number(hol.totalVencimentosPdf || 0) + extrasV;
        const totalD = Number(hol.totalDescontosPdf || 0) + extrasD;
        const liquido = totalV - totalD;

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
                  <strong>RECIBO DE PAGAMENTO</strong>
                  <span>Mensalista</span>
                </div>
                <div className="hol-hd-folha">
                  <span>Folha Mensal</span>
                  <span>{formatMesAnoRef(hol.mesAnoRef || mesAnoRef)}</span>
                </div>
              </div>

              {/* Dados do funcionário */}
              <div className="hol-funcionario">
                <table className="hol-table">
                  <thead>
                    <tr>
                      <th style={{width:'8%'}}>Código</th>
                      <th style={{width:'44%'}}>Nome do Funcionário</th>
                      <th style={{width:'22%'}}>CBO</th>
                      <th style={{width:'13%'}}>Departamento</th>
                      <th style={{width:'13%'}}>Filial</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{hol.codigo}</td>
                      <td>
                        <div>{hol.nome}</div>
                        <div>{hol.cargo || ''}</div>
                      </td>
                      <td><div>{hol.cbo}</div><div>Admissão: {hol.admissao}</div></td>
                      <td>{hol.departamento}</td>
                      <td>{hol.filial}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Rubricas */}
              <div className="hol-rubricas">
                <table className="hol-table">
                  <thead>
                    <tr>
                      <th style={{width:'8%'}}>Código</th>
                      <th style={{width:'42%'}}>Descrição</th>
                      <th style={{width:'14%'}}>Referência</th>
                      <th style={{width:'18%'}}>Vencimentos</th>
                      <th style={{width:'18%'}}>Descontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => (
                      <tr key={i}>
                        <td>{l.codigo}</td>
                        <td>{l.descricao}</td>
                        <td className="td-right">{l.referencia > 0 ? f(l.referencia) : ''}</td>
                        <td className="td-right">{l.tipo === 'vencimento' ? f(l.valor) : ''}</td>
                        <td className="td-right">{l.tipo === 'desconto' ? f(l.valor) : ''}</td>
                      </tr>
                    ))}
                    <tr className="hol-filler"><td colSpan="5"></td></tr>
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
                    <span className="td-right">{f(totalV)}</span>
                    <span className="td-right">{f(totalD)}</span>
                  </div>
                  <div className="hol-liquido">
                    <span>Valor Líquido ⇨</span>
                    <span className="hol-liquido-valor">{f(liquido)}</span>
                  </div>
                </div>
              </div>

              {/* Bases */}
              <div className="hol-bases">
                <table className="hol-table">
                  <thead>
                    <tr>
                      <th>Salário Base</th>
                      <th>Sal. Contr. INSS</th>
                      <th>Base Cálc. FGTS</th>
                      <th>F.G.T.S do Mês</th>
                      <th>Base Cálc. IRRF</th>
                      <th>Faixa IRRF</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="td-right">{f(hol.salarioBase)}</td>
                      <td className="td-right">{f(hol.salContrInss)}</td>
                      <td className="td-right">{f(hol.baseCalcFgts)}</td>
                      <td className="td-right">{f(hol.fgtsDoMes)}</td>
                      <td className="td-right">{f(hol.baseCalcIrrf)}</td>
                      <td className="td-right">{f(hol.faixaIrrf)}</td>
                    </tr>
                  </tbody>
                </table>
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
