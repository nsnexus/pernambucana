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
          const rawText = items.map(i => i.str).join(' ');
          
          // Dividir por Valor Líquido
          const receipts = rawText.split(/Valor\s*L[ií]quido/gi);
          
          for (let j = 0; j < receipts.length - 1; j++) {
            const receiptText = receipts[j];
            
            // Extrair nome (tudo maiúsculo entre "Nome do Funcionário" e a próxima palavra CamelCase ou número)
            const nameMatch = receiptText.match(/Nome do Funcion[aá]rio\s+([A-ZÀ-Ú\s]+?)\s+(?:[A-Z][a-z]|CBO|\d)/);
            const rawName = nameMatch ? nameMatch[1].trim() : 'Desconhecido';
            
            // O cargo acaba vindo junto (ex: ABMAEL SOUZA OLIVEIRA SOLDADOR). Vamos usar a string toda,
            // no Painel a busca vai dar match se contiver o nome.
            const nome = rawName;
            
            if (nome === 'Desconhecido' || nome.length < 3) continue;

            if (employees.find(e => e.nome === nome)) continue;

            // Extrair Vencimentos Oficiais e Descontos Oficiais
            let totalVencimentosPdf = 0;
            let totalDescontosPdf = 0;
            
            const totalMatch = receiptText.match(/Total de Vencimentos[\s\S]*?(\d{1,3}(?:\.\d{3})*,\d{2})[\s\S]*?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
            if (totalMatch) {
                totalVencimentosPdf = parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'));
                totalDescontosPdf = parseFloat(totalMatch[2].replace(/\./g, '').replace(',', '.'));
            }

            // Vencimento Liquido e Salário Base ficam na próxima parte do split
            let liquidoPdf = 0;
            let salarioBase = 0;
            const nextPart = receipts[j+1];
            
            if (nextPart) {
               // Liquido é o primeiro número logo após o Valor Líquido
               const valMatch = nextPart.match(/^\s*[\n\r]*\s*(?:[^\d]*)?(\d{1,3}(?:\.\d{3})*,\d{2})/);
               if (valMatch) {
                  liquidoPdf = parseFloat(valMatch[1].replace(/\./g, '').replace(',', '.'));
               }
               
               // Salário base
               const sBaseMatch = nextPart.match(/Sal[aá]rio\s*Base[\s\S]*?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
               if (sBaseMatch) {
                  salarioBase = parseFloat(sBaseMatch[1].replace(/\./g, '').replace(',', '.'));
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
