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
          
          // Processar as linhas para achar funcionários
          const pageText = lines.join('\n');
          
          // Dividir a página em recibos (se houver a marca 'Valor Líquido' ou similar)
          const receipts = pageText.split(/Valor L[ií]quido/gi);
          
          for (let j = 0; j < receipts.length - 1; j++) {
            const receiptText = receipts[j];
            
            // Tentar extrair o nome identificando a linha com Código, Nome e CBO
            // Exemplo: "8 ABMAEL SOUZA OLIVEIRA 724315 1 1"
            const nameMatch = receiptText.match(/(?:^|\n)\s*\d+\s+([A-Za-zÀ-Úà-ú][A-Za-zÀ-Úà-ú\s]+?)\s+\d{4,6}/);
            const rawName = nameMatch ? nameMatch[1].trim() : 'Desconhecido';
            
            const nomeParts = rawName.split(/  +/);
            const nome = nomeParts[0].trim();
            
            if (nome === 'Desconhecido' || nome.length < 3) continue;

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
        if (employees.length === 0) {
           // Fallback to debug
           const debugText = (await (await pdf.getPage(1)).getTextContent()).items.map(i => i.str).join(' ').substring(0, 600);
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
