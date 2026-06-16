# Pernambucana Portal Premium — Dashboard financeiro integrado

## O que foi implementado

- Base única tratada em `data.js`, gerada a partir dos arquivos anexados:
  - Financeiro Usinagem 2026
  - Financeiro Retifica 2026
  - Financeiro Auto Geral 2026
  - Planilha de Custos 2026
  - Controle de Abastecimento
  - Acompanhamento de custos 2026
- Nova visão geral do negócio com receitas, gastos, resultado, margem, OS, à vista, à prazo e rateio 5X.
- Páginas/abas no painel para:
  - Visão geral
  - Mecânica / Auto Geral
  - Peças
  - Retífica
  - Torneadora
  - Caldeiraria
  - Compras & 5X
  - Detalhamento / auditoria
- Regra 5X aplicada: cada item marcado como 5X foi dividido igualmente entre os 5 departamentos informados.

## Login de demonstração

O login continua o mesmo do projeto original.

Usuário: `nsnexus`

A senha está definida no arquivo `landing.js`, conforme o modelo original do protótipo.

## Arquivos principais

- `index.html`: landing page
- `painel.html`: dashboard financeiro integrado
- `data.js`: base consolidada e auditoria de leitura
- `app.js`: lógica dos filtros, gráficos, páginas e exportação CSV
- `dashboard.css`: layout do painel

## Observações de tratamento

- Retífica: o valor executado usa `Valor Total`; quando não disponível, usa `Total`/`Valor`.
- Usinagem: usa `Valor Serviços` para Torneadora e Caldeiraria.
- Auto Geral: serviços foram alocados em Mecânica; peças/material foram alocados em Peças para permitir análise por setor.
- Compras: cada relatório de compras foi associado ao departamento quando possível.
- Abastecimento possui aba própria no painel, com gasto mensal, litros consumidos, custo médio por litro, top solicitantes, veículos/placas e tabela detalhada. Também continua compondo custos complementares na visão geral.
