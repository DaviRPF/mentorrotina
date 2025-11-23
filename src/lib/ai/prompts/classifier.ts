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
1. criar_rotina - Usuário PEDE para criar/montar/ajustar rotina ou dá FEEDBACK para refazer
   Exemplos: "monta minha rotina", "agenda meu treino", "programa meu dia", "não dá pra dormir depois das 22h", "tá muito pesado", "tá solicita", "ajusta isso", "refaz", "muito cedo", "muito tarde"

2. modificar_evento - Usuário quer ALTERAR/DELETAR evento específico já existente no calendário
   Exemplos: "muda o horário do treino", "cancela a reunião de amanhã", "deleta os eventos", "remove da agenda"

3. pergunta_simples - Pergunta que NÃO requer criar/modificar eventos
   Exemplos: "o que devo fazer?", "vale a pena?", "o que você acha?"

4. conversa_geral - Conversa casual sem relação com calendário
   Exemplos: "oi", "obrigado", "entendi"

5. acompanhamento - Usuário reportando o que fez/está fazendo
   Exemplos: "terminei o treino", "acabei de acordar", "tô na academia"

IMPORTANTE:
- Se o usuário dá FEEDBACK sobre uma rotina proposta (ex: "não dá", "muito X", "ajusta") = criar_rotina
- Se pede pra CRIAR/MONTAR/PROGRAMAR algo = criar_rotina
- Se quer ALTERAR evento ESPECÍFICO já no calendário = modificar_evento

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
