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
          
          // Usar o texto puro exatamente na ordem que o PDFJS extrai
          const rawText = textContent.items.map(i => i.str).join(' ');
          
          // Dividir por 'Nome do Funcionário' - isso sempre vai funcionar, mesmo se o PDF for cortado na metade
          const receipts = rawText.split(/Nome do Funcion[aá]rio/gi);
          
          for (let j = 1; j < receipts.length; j++) {
            const receiptText = receipts[j];
            
            // Extrair nome (tudo maiúsculo entre o split e a próxima palavra CamelCase ou número)
            const nameMatch = receiptText.match(/^\s*([A-ZÀ-Úa-z\s]+?)\s+(?:[A-Z][a-z]|CBO|Des|Dep|\d)/);
            const rawName = nameMatch ? nameMatch[1].trim() : 'Desconhecido';
            const nome = rawName;
            
            if (nome === 'Desconhecido' || nome.length < 3) continue;

            if (employees.find(e => e.nome === nome)) continue;

            let totalVencimentosPdf = 0;
            let totalDescontosPdf = 0;
            let salarioBase = 0;
            
            // Encontrar os valores de Vencimentos (lista de números após a palavra Vencimentos)
            const vencimentosMatch = receiptText.match(/Vencimentos\s+((?:\d{1,3}(?:\.\d{3})*,\d{2}\s*)+)/i);
            if (vencimentosMatch) {
               const vals = vencimentosMatch[1].trim().split(/\s+/);
               vals.forEach((v, idx) => {
                   const num = parseFloat(v.replace(/\./g, '').replace(',', '.'));
                   totalVencimentosPdf += num;
                   if (idx === 0) salarioBase = num; // O primeiro vencimento (ex: DIAS NORMAIS) é a base
               });
            }

            // Encontrar os valores de Descontos (lista de números após a palavra Descontos)
            const descontosMatch = receiptText.match(/Descontos\s+((?:\d{1,3}(?:\.\d{3})*,\d{2}\s*)+)/i);
            if (descontosMatch) {
               const vals = descontosMatch[1].trim().split(/\s+/);
               vals.forEach((v) => {
                   totalDescontosPdf += parseFloat(v.replace(/\./g, '').replace(',', '.'));
               });
            }

            // O líquido é simplesmente a diferença
            let liquidoPdf = totalVencimentosPdf - totalDescontosPdf;

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
