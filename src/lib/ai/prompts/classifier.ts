/**
 * Classificador de intenção do usuário
 * Prompt leve e rápido para determinar o tipo de resposta necessária
 */

export type IntentType =
  | 'criar_rotina'      // Usuário quer criar eventos/rotina
  | 'modificar_evento'  // Usuário quer alterar/mover/deletar evento existente
  | 'pergunta_simples'  // Pergunta que não requer ações
  | 'conversa_geral'    // Conversa normal, sem ações
  | 'acompanhamento';   // Reportando progresso do dia

export interface ClassificationResult {
  intent: IntentType;
  confidence: number;
  needsActions: boolean;
  summary: string;
}

export const CLASSIFIER_PROMPT = `Classifique a intenção do usuário em UMA das categorias:

CATEGORIAS:
1. criar_rotina - Usuário PEDE para criar/montar/terminar eventos/rotina/agendar algo
   Exemplos: "monta minha rotina", "agenda meu treino", "cria eventos para", "planeja minha semana", "termina minha rotina", "completa minha rotina de amanhã", "consegue terminar minha rotina?"

2. modificar_evento - Usuário quer ALTERAR/DELETAR evento existente
   Exemplos: "muda o horário", "cancela a reunião", "move o treino para", "ajusta o horário", "apaga os treinos", "deleta os eventos", "remove da agenda", "exclui"

3. pergunta_simples - Pergunta que NÃO requer criar eventos
   Exemplos: "o que devo fazer?", "como você separaria?", "vale a pena?", "o que você acha?"

4. conversa_geral - Conversa normal sem relação com calendário
   Exemplos: "oi", "obrigado", "entendi", "como funciona X?"

5. acompanhamento - Usuário reportando o que fez/está fazendo
   Exemplos: "terminei o treino", "acabei de acordar", "tô na academia"

REGRAS:
- "Quero que você planeje" = criar_rotina
- "Consegue terminar/completar minha rotina?" = criar_rotina
- "Como você faria?" = pergunta_simples (NÃO criar_rotina)
- "O que você sugere?" = pergunta_simples (NÃO criar_rotina)
- Se menciona "criar", "montar", "agendar", "planejar", "terminar rotina", "completar rotina" como PEDIDO = criar_rotina
- Se é uma PERGUNTA sobre o que fazer = pergunta_simples

Responda APENAS com JSON (sem markdown, sem código):
{"intent":"<categoria>","confidence":<0-1>,"needsActions":<true/false>,"summary":"<resumo em 5 palavras>"}`;

/**
 * Classificador de backup baseado em palavras-chave
 * Usado quando a IA falha
 */
function backupClassifier(message: string): ClassificationResult {
  const msg = message.toLowerCase();

  // criar_rotina
  if (
    msg.includes('monta') || msg.includes('montar') ||
    msg.includes('cria') || msg.includes('criar') ||
    msg.includes('agenda') || msg.includes('agendar') ||
    msg.includes('planeja') || msg.includes('planejar') ||
    msg.includes('termina minha rotina') || msg.includes('terminar minha rotina') ||
    msg.includes('completa minha rotina') || msg.includes('completar minha rotina') ||
    msg.includes('faz minha rotina') || msg.includes('fazer minha rotina') ||
    (msg.includes('rotina') && (msg.includes('amanhã') || msg.includes('semana') || msg.includes('hoje')))
  ) {
    return { intent: 'criar_rotina', confidence: 0.8, needsActions: true, summary: 'Criar rotina/eventos' };
  }

  // modificar_evento
  if (
    msg.includes('muda') || msg.includes('mudar') ||
    msg.includes('move') || msg.includes('mover') ||
    msg.includes('cancela') || msg.includes('cancelar') ||
    msg.includes('apaga') || msg.includes('apagar') ||
    msg.includes('deleta') || msg.includes('deletar') ||
    msg.includes('remove') || msg.includes('remover') ||
    msg.includes('exclui') || msg.includes('excluir') ||
    msg.includes('ajusta') || msg.includes('ajustar')
  ) {
    return { intent: 'modificar_evento', confidence: 0.8, needsActions: true, summary: 'Modificar evento' };
  }

  // acompanhamento
  if (
    msg.includes('terminei') || msg.includes('acabei') ||
    msg.includes('fiz') || msg.includes('completei') ||
    msg.includes('tô na') || msg.includes('to na') ||
    msg.includes('estou na') || msg.includes('cheguei')
  ) {
    return { intent: 'acompanhamento', confidence: 0.7, needsActions: false, summary: 'Reportando progresso' };
  }

  // pergunta_simples
  if (
    msg.includes('o que você acha') || msg.includes('como você') ||
    msg.includes('o que devo') || msg.includes('vale a pena') ||
    msg.includes('sugere') || msg.includes('recomenda')
  ) {
    return { intent: 'pergunta_simples', confidence: 0.7, needsActions: false, summary: 'Pergunta simples' };
  }

  return { intent: 'conversa_geral', confidence: 0.5, needsActions: false, summary: 'Conversa geral' };
}

/**
 * Extrai a classificação da resposta da IA
 */
export function parseClassification(response: string, originalMessage?: string): ClassificationResult {
  console.log('parseClassification - Raw response:', response);

  // Se resposta vazia, usa classificador de backup
  if (!response || response.trim() === '') {
    console.log('parseClassification - Empty response, using backup classifier');
    if (originalMessage) {
      return backupClassifier(originalMessage);
    }
    return { intent: 'conversa_geral', confidence: 0.3, needsActions: false, summary: 'Não classificado' };
  }

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    console.log('parseClassification - JSON match:', jsonMatch?.[0]);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('parseClassification - Parsed:', parsed);
      return {
        intent: parsed.intent || 'conversa_geral',
        confidence: parsed.confidence || 0.5,
        needsActions: parsed.needsActions || false,
        summary: parsed.summary || '',
      };
    }
  } catch (e) {
    console.error('Failed to parse classification:', response, e);
  }

  // Se não conseguiu parsear JSON, usa classificador de backup
  console.log('parseClassification - Using backup classifier');
  if (originalMessage) {
    return backupClassifier(originalMessage);
  }
  return { intent: 'conversa_geral', confidence: 0.3, needsActions: false, summary: 'Não classificado' };
}
