import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Captura cada ".recibo-page" renderizada dentro de containerEl (o mesmo
// modelo usado na impressão via ReciboPrint) e monta um PDF real, uma
// página por recibo, mantendo o layout exatamente igual ao impresso.
export const generatePdfFromContainer = async (containerEl, filename) => {
  const pages = containerEl.querySelectorAll('.recibo-page');
  if (pages.length === 0) throw new Error('Nenhum recibo para gerar PDF.');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    const el = pages[i];
    // O container fica posicionado fora da tela (left: -99999px) pra não
    // aparecer durante a geração — sem passar width/height/windowWidth/
    // windowHeight explícitos, o html2canvas às vezes calcula a área de
    // captura com base no viewport em vez do tamanho real do elemento, e
    // corta o que passa da borda direita.
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: el.scrollWidth,
      height: el.scrollHeight,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });
    const imgData = canvas.toDataURL('image/png');
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, Math.min(imgHeight, pageHeight));
  }

  pdf.save(filename);
};
