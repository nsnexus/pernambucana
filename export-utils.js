/**
 * Pernambucana Centro de Manutenção - Import & Export Utils
 * export-utils.js
 */

(function() {
  const STORAGE_SERVICOS = 'pernambucana.data.servicos.v1';
  const STORAGE_COMPRAS = 'pernambucana.data.compras.v1';

  const DEPT_LABELS = {
    Mecanica: 'Mecânica',
    Peças: 'Peças',
    Retifica: 'Retífica',
    Torneadora: 'Torneadora',
    Caldeiraria: 'Caldeiraria',
    AltoGeral: 'Alto Geral'
  };

  function prettySector(sec) {
    return DEPT_LABELS[sec] || sec || '';
  }

  // Trigger download of a file in the browser
  function triggerDownload(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const ExportUtils = {
    // Export all raw localStorage tables as a single JSON file
    exportJSON: function() {
      const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        servicos: JSON.parse(localStorage.getItem(STORAGE_SERVICOS) || '[]'),
        compras: JSON.parse(localStorage.getItem(STORAGE_COMPRAS) || '[]')
      };

      const jsonStr = JSON.stringify(data, null, 2);
      const filename = `backup-lançamentos-${new Date().toISOString().split('T')[0]}.json`;
      triggerDownload(jsonStr, filename, 'application/json;charset=utf-8');
    },

    // Import from JSON file
    importJSON: function(file, callback) {
      if (!file) return;
      const reader = new FileReader();
      
      reader.onload = function(e) {
        try {
          const parsed = JSON.parse(e.target.result);
          if (!parsed || (!Array.isArray(parsed.servicos) && !Array.isArray(parsed.compras))) {
            throw new Error('Formato JSON de importação inválido.');
          }

          // Import into DataStore
          window.DataStore.importRawData(parsed.servicos || [], parsed.compras || []);
          
          if (callback) callback(null, true);
        } catch (err) {
          console.error('Error importing JSON', err);
          if (callback) callback(err.message || 'Falha ao ler o arquivo JSON.', false);
        }
      };

      reader.onerror = function() {
        if (callback) callback('Erro ao ler o arquivo.', false);
      };

      reader.readAsText(file);
    },

    // Export raw data back into an Excel file (.xlsx) with the standard columns
    exportXLSX: function() {
      if (!window.XLSX) {
        alert('Biblioteca XLSX.js não carregada. Conecte-se à internet.');
        return;
      }

      const servicosRaw = window.DataStore.getServicos(); // retrieves list (filtered by sector if not admin)
      const comprasRaw = window.DataStore.getCompras();

      // 1. Format Servicos data for Sheet
      const servicosSheetData = servicosRaw.map(s => {
        // Format date to DD/MM/YYYY for spreadsheet visibility
        let formattedDate = s.data;
        if (s.data && s.data.includes('-')) {
          const p = s.data.split('-');
          formattedDate = `${p[2]}/${p[1]}/${p[0]}`;
        }

        return {
          'Data': formattedDate,
          'Mês': s.mes || '',
          'Lançamento(setor)': prettySector(s.setor),
          'Pagamento(à vista/prazo)': s.pagamento || 'À vista',
          'código': s.codigoServico || '',
          'Nome do Cliente': s.cliente || '',
          'Descrição dos Produtos': s.descricao || '',
          'Qtd': s.qtd || 1,
          'OS': s.os || '',
          'Valor': s.valorUnitario || 0,
          'Total': s.valorTotal || 0,
          'Produtivo': s.produtivo || '',
          'Valor Total': s.valorProdutivo || 0,
          'Desconto': s.desconto || 0,
          'Serviço(Cabeçote/Bloco/etc)': s.tipoServico || 'Serviços',
          'Material': s.material || 0
        };
      });

      // 2. Format Compras data for Sheet
      const comprasSheetData = comprasRaw.map(c => {
        let formattedDate = c.data;
        if (c.data && c.data.includes('-')) {
          const p = c.data.split('-');
          formattedDate = `${p[2]}/${p[1]}/${p[0]}`;
        }

        let desc = c.descricao || '';
        if (c.categoria === 'Folha de pagamento') {
          desc = desc || `Folha de Pagamento: ${c.funcionario || ''}`;
        } else if (c.categoria === 'Custo fixo') {
          desc = desc || `Custo Fixo`;
        }

        return {
          'Data': formattedDate,
          'Mês': c.mes || '',
          'Lançamento(setor)': prettySector(c.setor),
          'Forma de Compra': c.formaCompra || 'À vista',
          'Nome do Solicitante': c.solicitante || c.funcionario || '',
          'Descrição do Material': desc,
          'N° da OS': c.numOS || '',
          'Valor da OS': c.valorOS || 0,
          'Valor do Produto': c.valorProduto || 0,
          'Fornecedor': c.fornecedor || '',
          'N° do Pedido': c.numPedido || '',
          'Categoria': c.categoria || 'Almoxarifado'
        };
      });

      // Create Workbook and append sheets
      const wb = XLSX.utils.book_new();
      
      const wsServicos = XLSX.utils.json_to_sheet(servicosSheetData);
      const wsCompras = XLSX.utils.json_to_sheet(comprasSheetData);

      XLSX.utils.book_append_sheet(wb, wsServicos, 'Serviços');
      XLSX.utils.book_append_sheet(wb, wsCompras, 'Compras');

      // Write workbook file and download it
      const filename = `planilha-financeira-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
    }
  };

  window.ExportUtils = ExportUtils;
})();
