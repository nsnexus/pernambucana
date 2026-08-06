import React from 'react';
import '../styles/recibo.css';

const ReciboPrint = ({ holerites = [], mesAnoRef = '' }) => {
  if (!holerites || holerites.length === 0) return null;

  return (
    <div className="recibo-print-container">
      {holerites.map((hol, index) => {
        // Formatar valores para R$
        const f = (val) => Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        const proventos = (
            Number(hol.extraFolha || 0) + 
            Number(hol.h50 || 0) + 
            Number(hol.horasEx50 || 0) + 
            Number(hol.h100 || 0) + 
            Number(hol.horasEx100 || 0) + 
            Number(hol.hDss || 0) + 
            Number(hol.dssHex || 0) + 
            Number(hol.comissao || 0)
        );

        const descontos = (
            Number(hol.faltas || 0) + 
            Number(hol.vale || 0)
        );

        const liquido = proventos - descontos;

        return (
          <div key={index} className="recibo-page">
            <table className="recibo-table">
              <thead>
                <tr>
                  <th colSpan="3" className="recibo-header-title">RECIBO DE PAGAMENTO MENSAL</th>
                </tr>
                <tr>
                  <th colSpan="3" className="recibo-empresa-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span><strong>Nome do(a) Empregador(a):</strong> PERNAMBUCANA SERVIÇOS ADMINISTRATIVOS LTDA</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span><strong>CNPJ:</strong> 66.477.205/0001-70</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span><strong>Cargo ou Função:</strong> {hol.cargo || 'Funcionário'}</span>
                      <span><strong>Mês/Ano de Referência:</strong> {mesAnoRef || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong>Nome do(a) Empregado(a):</strong> {hol.nome}</span>
                    </div>
                  </th>
                </tr>
                <tr className="recibo-col-headers">
                  <th style={{ width: '60%' }}>Descrição</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Proventos</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Descontos</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Salário Extra</td>
                  <td className="text-right">{hol.extraFolha > 0 ? `R$ ${f(hol.extraFolha)}` : 'R$ -'}</td>
                  <td></td>
                </tr>
                <tr>
                  <td>Horas Extras 50%</td>
                  <td className="text-right">{(Number(hol.h50 || 0) + Number(hol.horasEx50 || 0)) > 0 ? `R$ ${f(Number(hol.h50 || 0) + Number(hol.horasEx50 || 0))}` : 'R$ -'}</td>
                  <td></td>
                </tr>
                <tr>
                  <td>Horas Extras 100%</td>
                  <td className="text-right">{(Number(hol.h100 || 0) + Number(hol.horasEx100 || 0)) > 0 ? `R$ ${f(Number(hol.h100 || 0) + Number(hol.horasEx100 || 0))}` : 'R$ -'}</td>
                  <td></td>
                </tr>
                <tr>
                  <td>DSS</td>
                  <td className="text-right">{(Number(hol.hDss || 0) + Number(hol.dssHex || 0)) > 0 ? `R$ ${f(Number(hol.hDss || 0) + Number(hol.dssHex || 0))}` : 'R$ -'}</td>
                  <td></td>
                </tr>
                <tr>
                  <td>Comissão</td>
                  <td className="text-right">{hol.comissao > 0 ? `R$ ${f(hol.comissao)}` : 'R$ -'}</td>
                  <td></td>
                </tr>
                <tr>
                  <td>Faltas</td>
                  <td></td>
                  <td className="text-right">{hol.faltas > 0 ? `R$ ${f(hol.faltas)}` : 'R$ -'}</td>
                </tr>
                <tr>
                  <td>Vale</td>
                  <td></td>
                  <td className="text-right">{hol.vale > 0 ? `R$ ${f(hol.vale)}` : 'R$ -'}</td>
                </tr>
                {/* Linhas vazias para manter layout padrao */}
                <tr className="empty-row"><td colSpan="3"></td></tr>
                <tr className="empty-row"><td colSpan="3"></td></tr>
              </tbody>
              <tfoot>
                <tr className="recibo-totals">
                  <td className="text-right" style={{ fontWeight: 'bold' }}>Total</td>
                  <td className="text-right" style={{ fontWeight: 'bold' }}>R$ {f(proventos)}</td>
                  <td className="text-right" style={{ fontWeight: 'bold' }}>R$ {f(descontos)}</td>
                </tr>
                <tr className="recibo-liquido">
                  <td colSpan="2" className="text-right">(Resultado da subtração de proventos, menos o desconto) ........................................</td>
                  <td className="text-right" style={{ fontWeight: 'bold', fontSize: '14px' }}>Liquido a Receber: R$ {f(liquido)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="recibo-footer">
              <p>Declaro para os devidos fins que, recebi nesta data a importância acima discriminada, referente ao meu salário.</p>
              <div className="recibo-assinatura">
                <div className="assinatura-data">
                  Data: &nbsp; &nbsp; &nbsp; / &nbsp; &nbsp; &nbsp; / &nbsp; &nbsp; &nbsp; 
                </div>
                <div className="assinatura-linha">
                  Assinatura: ____________________________________________________________________
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReciboPrint;
