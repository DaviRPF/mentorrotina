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

export const CLASSIFIER_PROMPT = `Classifique a intenção do usuário:

1. criar_rotina - Quer criar/agendar/montar/programar eventos ou rotina
2. modificar_evento - Quer alterar/deletar/mover evento existente
3. pergunta_simples - Pergunta que não requer ações no calendário
4. conversa_geral - Conversa casual
5. acompanhamento - Reportando o que fez/está fazendo

Responda APENAS com JSON:
{"intent":"<categoria>","confidence":<0-1>,"needsActions":<true/false>,"summary":"<resumo>"}`;

/**
 * Extrai a classificação da resposta da IA
 */
export function parseClassification(response: string): ClassificationResult {
  console.log('parseClassification - Raw response:', response);

  if (!response || response.trim() === '') {
    console.error('parseClassification - ERRO: Resposta vazia da IA');
    return { intent: 'conversa_geral', confidence: 0.3, needsActions: false, summary: 'Erro na classificação' };
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

  console.error('parseClassification - Não conseguiu extrair JSON da resposta');
  return { intent: 'conversa_geral', confidence: 0.3, needsActions: false, summary: 'Erro no parse' };
}
