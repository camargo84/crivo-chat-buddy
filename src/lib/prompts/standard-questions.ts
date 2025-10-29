export const STANDARD_QUESTIONS = [
  {
    id: 1,
    category: 'identificacao',
    template: (profile: any) => 
      `**Pergunta 1 de 10**\n\nPara garantir documentação correta:\n\n**Esta demanda é de responsabilidade da ${profile.orgao_demandante || 'sua secretaria'}, correto?**\n\nSe for outro órgão ou secretaria, por favor me informe qual.`
  },
  
  {
    id: 2,
    category: 'identificacao',
    template: (profile: any) => 
      `**Pergunta 2 de 10**\n\n**O local onde a solução será utilizada é:**\n${profile.endereco_completo || '[endereço do cadastro]'}\n\nConfirma? Se for outro local (prédio diferente, unidade), especifique.`
  },
  
  {
    id: 3,
    category: 'problema',
    template: (profile: any, demandaTitle: string) => 
      `**Pergunta 3 de 10**\n\nVocê mencionou "${demandaTitle}".\n\n**Descreva com mais detalhes o problema atual:**\n\nPara me ajudar:\n- Que equipamentos/sistemas/processos estão problemáticos?\n- Há quanto tempo essa situação existe?\n- Frequência do problema (diário, semanal, eventual)?`
  },
  
  {
    id: 4,
    category: 'impacto',
    template: () => 
      `**Pergunta 4 de 10**\n\n**Qual o impacto concreto desse problema no trabalho?**\n\nPense em:\n- Tempo perdido (horas/dias por semana)\n- Tarefas que ficam paradas ou atrasadas\n- Reclamações formais (se houver)`
  },
  
  {
    id: 5,
    category: 'beneficiarios',
    template: () => 
      `**Pergunta 5 de 10**\n\n**Quem será diretamente beneficiado pela solução?**\n\nEspecifique:\n- Quantos servidores/funcionários (aproximado)\n- Quais setores ou departamentos\n- Impacto no atendimento ao público (se houver)\n\n🎉 **Você completou metade das perguntas!**`
  },
  
  {
    id: 6,
    category: 'situacao_atual',
    template: () => 
      `**Pergunta 6 de 10**\n\n**Como vocês lidam com essa situação HOJE (antes da solução)?**\n\nDescreva:\n- Processos/métodos atuais (manual, planilha, sistema antigo)\n- Soluções temporárias que usam\n- O que já tentaram melhorar (se tentaram)`
  },
  
  {
    id: 7,
    category: 'resultado',
    template: () => 
      `**Pergunta 7 de 10**\n\n**Qual resultado mensurável vocês esperam alcançar?**\n\nExemplos:\n- Reduzir tempo de processo em X%\n- Eliminar paradas/reclamações\n- Aumentar produtividade\n- Atender mais Y pessoas por dia`
  },
  
  {
    id: 8,
    category: 'solucao_candidata',
    template: () => 
      `**Pergunta 8 de 10** ⭐\n\nEsta é importante!\n\n**Vocês já têm alguma hipótese de solução em mente?**\n\nPode ser:\n- Algo visto em outro órgão\n- Produto/serviço conhecido\n- Sugestão da equipe técnica\n- Ou está em aberto para o mercado propor\n\nMe conte o que já pensaram ou se preferem deixar em aberto.`
  },
  
  {
    id: 9,
    category: 'quantitativos',
    template: () => 
      `**Pergunta 9 de 10**\n\n**Qual a quantidade estimada necessária?**\n\nEspecifique (mesmo aproximado):\n- Quantidade total de itens/licenças/unidades\n- Previsão de crescimento futuro\n- Implantação de uma vez ou gradual`
  },
  
  {
    id: 10,
    category: 'planejamento',
    template: () => 
      `**Pergunta 10 de 10** ✨\n\nÚltima pergunta desta etapa!\n\n**Sobre prazos e recursos:**\n\na) **Prazo:** Quando precisam que esteja funcionando? Há marco crítico (fim de ano, evento, prazo legal)?\n\nb) **Orçamento:** Há recurso aprovado/previsto? Se sim, faixa de valor ou rubrica?\n\nResponda ambos os pontos.\n\n🎉 **Você concluiu as 10 perguntas padrão!**`
  }
];

export function getStandardQuestion(
  questionNumber: number,
  profile: any,
  demandaTitle: string,
  previousAnswer?: string
): string {
  const question = STANDARD_QUESTIONS.find(q => q.id === questionNumber);
  
  if (!question) {
    return `Pergunta ${questionNumber} não encontrada.`;
  }
  
  return question.template(profile, previousAnswer || demandaTitle);
}
