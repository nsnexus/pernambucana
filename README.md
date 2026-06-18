# Pernambucana Centro de Manutenção - Painel Financeiro

Sistema executivo com visão geral, páginas por setor, controle de despesas, ranking de produtivos e tabela final de fechamento.

## Estrutura
- `index.html`: página inicial
- `painel.html`: painel financeiro
- `data.js`: base consolidada padrão do painel
- `app.js`: lógica dos dashboards e importação manual de planilha
- `dashboard.css`: estilos do painel
- `landing.css`: estilos da página inicial

## Acesso
Usuário: `nsnexus`
Senha: `123456`

## Atualização manual da planilha
No painel, use o botão **Inserir planilha** para carregar um arquivo `.xlsx`, `.xls`, `.xlsm` ou `.csv`.

O arquivo precisa manter a mesma estrutura da planilha-base usada para gerar os gráficos. O painel também aceita abas consolidadas com os nomes: `Resumo`, `Serviços`, `Despesas`, `Folha` e `Produtivos`.

Depois de carregada, a base fica salva no navegador. Para voltar à base original do pacote, clique em **Dados padrão**.

## Atualização - Alto Geral
- Incluída a aba/setor **Alto Geral** no menu do painel.
- O upload de planilha agora reconhece abas no padrão **AG4**, **A4**, **Alto Geral 4** ou **Auto Geral 4**.
- O setor fica disponível mesmo sem dados, aguardando o carregamento da planilha.
