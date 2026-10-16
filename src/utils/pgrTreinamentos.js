// Matriz padrão de Treinamentos PGR conforme layout oficial da empresa
export const DEFAULT_PGR_TREINAMENTOS = [
  { id: 't1', nome: 'Introdutório de Segurança', obrigatorio: true },
  { id: 't2', nome: 'Uso de EPI', obrigatorio: true },
  { id: 't3', nome: 'Plano de Emergência (PAE)', obrigatorio: true },
  { id: 't4', nome: 'Primeiros Socorros', obrigatorio: true },
  { id: 't5', nome: 'NR-12 Máquinas e Equip.', obrigatorio: true },
  { id: 't6', nome: 'NR-26 Produtos Químicos', obrigatorio: true },
  { id: 't7', nome: 'Noções PGR / PCMSO', obrigatorio: true },
  { id: 't8', nome: 'Proteção Auditiva e Respiratória', obrigatorio: true },
  { id: 't9', nome: 'NR-35 Trabalho em Altura', obrigatorio: false },
  { id: 't10', nome: 'NR-33 Espaço Confinado', obrigatorio: false },
  { id: 't11', nome: 'Operação de Ponte Rolante / Talha', obrigatorio: false },
  { id: 't12', nome: 'Segurança em Soldagem e Corte a Quente', obrigatorio: false }
];

// Inicializa a lista de treinamentos de um funcionário combinando os padrões com os já cadastrados
export const getFuncionarioTreinamentos = (funcionario) => {
  const cadastrados = Array.isArray(funcionario?.treinamentos) ? funcionario.treinamentos : [];
  
  // Se já tem lista salva no banco, preserva os itens salvos
  if (cadastrados.length > 0) {
    return cadastrados;
  }

  // Lista padrão inicial: os primeiros 8 são a base padrão do layout oficial do crachá
  return DEFAULT_PGR_TREINAMENTOS.slice(0, 8).map(t => ({
    id: t.id,
    nome: t.nome,
    status: 'pendente', // 'realizado' | 'pendente'
    dataConclusao: '',
    validade: ''
  }));
};
