import * as pdfjsLib from 'pdfjs-dist';

// Carga do worker para o PDF.js no ambiente Vite
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.js?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export const extractHoleritesFromPDF = async (file) => {
  const fileReader = new FileReader();
  
  return new Promise((resolve, reject) => {
    fileReader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const totalPages = pdf.numPages;
        
        let employees = [];
        
        for (let i = 1; i <= totalPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Agrupar os textos do PDF por linha aproximada (mesmo Y)
          const items = textContent.items;
          items.sort((a, b) => {
             // sort by Y descending, then X ascending
             if (Math.abs(a.transform[5] - b.transform[5]) > 5) {
                 return b.transform[5] - a.transform[5];
             }
             return a.transform[4] - b.transform[4];
          });

          // Juntar itens que estão na mesma linha
          let lines = [];
          let currentLine = [];
          let lastY = null;
          
          for (let item of items) {
             const y = item.transform[5];
             if (lastY === null || Math.abs(y - lastY) <= 5) {
                currentLine.push(item.str);
             } else {
                lines.push(currentLine.join(' '));
                currentLine = [item.str];
             }
             lastY = y;
          }
          if (currentLine.length > 0) lines.push(currentLine.join(' '));
          
          // Processar as linhas para achar funcionários (tem 2 vias por página normalmente)
          // Vamos agrupar todo o texto da página e buscar padrões
          const pageText = lines.join('\n');
          
          // Dividir a página em dois recibos (se houver a marca 'Total de Vencimentos' duas vezes)
          const receipts = pageText.split(/Valor Líquido/gi);
          
          for (let j = 0; j < receipts.length - 1; j++) {
            const receiptText = receipts[j];
            
            // Tentar extrair o nome
            const nameMatch = receiptText.match(/Nome do Funcionário\s*\n\s*([A-ZÀ-Ú\s]+)\s*\n/i);
            const rawName = nameMatch ? nameMatch[1].trim() : 'Desconhecido';
            
            // Limpar o nome de cargos que podem ter grudado
            // Como é um modelo, geralmente a segunda linha depois do nome é o CBO ou cargo
            const nomeParts = rawName.split(/  +/);
            const nome = nomeParts[0].trim();
            
            if (nome === 'Desconhecido' || nome.length < 3) continue;

            // Evitar duplicidade na mesma página (via empresa / via funcionário)
            if (employees.find(e => e.nome === nome)) continue;

            // Extrair Salário Base
            let salarioBase = 0;
            const baseMatch = receiptText.match(/Salário Base\s*([0-9.,]+)/i);
            if (baseMatch) {
              salarioBase = parseFloat(baseMatch[1].replace(/\./g, '').replace(',', '.'));
            } else {
                // Tentar procurar na linha de baixo (muitas vezes os valores ficam separados)
                const sBaseRegex = /Salário Base[\s\S]*?(\d{1,3}(?:\.\d{3})*,\d{2})/;
                const match2 = receiptText.match(sBaseRegex);
                if (match2) {
                     salarioBase = parseFloat(match2[1].replace(/\./g, '').replace(',', '.'));
                }
            }

            // Extrair Vencimentos Oficiais e Descontos Oficiais (soma)
            let totalVencimentosPdf = 0;
            let totalDescontosPdf = 0;
            
            const totalMatch = receiptText.match(/Total de Vencimentos[\s\S]*?(\d{1,3}(?:\.\d{3})*,\d{2})[\s\S]*?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
            if (totalMatch) {
                totalVencimentosPdf = parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'));
                totalDescontosPdf = parseFloat(totalMatch[2].replace(/\./g, '').replace(',', '.'));
            }

            // Vencimento Liquido parcial
            let liquidoPdf = 0;
            const nextPart = receipts[j+1];
            if (nextPart) {
               const valMatch = nextPart.match(/^\s*[\n\r]*\s*(?:[^\d]*)?(\d{1,3}(?:\.\d{3})*,\d{2})/);
               if (valMatch) {
                  liquidoPdf = parseFloat(valMatch[1].replace(/\./g, '').replace(',', '.'));
               }
            }

            employees.push({
              nome,
              salarioBase,
              totalVencimentosPdf,
              totalDescontosPdf,
              liquidoPdf,
              // Campos extras que serão preenchidos manualmente
              extraFolha: 0,
              comissao: 0,
              h50: 0,
              horasEx50: 0,
              h100: 0,
              horasEx100: 0,
              hDss: 0,
              dssHex: 0,
              faltas: 0, 
              vale: 0,
            });
          }
        }
        
        resolve(employees);
      } catch (err) {
        reject(err);
      }
    };
    fileReader.readAsArrayBuffer(file);
  });
};
