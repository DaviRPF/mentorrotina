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
1. criar_rotina - Usuário PEDE para criar eventos/rotina/agendar algo
   Exemplos: "monta minha rotina", "agenda meu treino", "cria eventos para", "planeja minha semana"

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
- "Como você faria?" = pergunta_simples (NÃO criar_rotina)
- "O que você sugere?" = pergunta_simples (NÃO criar_rotina)
- Se menciona "criar", "montar", "agendar", "planejar" como PEDIDO = criar_rotina
- Se é uma PERGUNTA sobre o que fazer = pergunta_simples

Responda APENAS com JSON:
{"intent":"<categoria>","confidence":<0-1>,"needsActions":<true/false>,"summary":"<resumo em 5 palavras>"}`;

/**
 * Extrai a classificação da resposta da IA
 */
export function parseClassification(response: string): ClassificationResult {
  console.log('parseClassification - Raw response:', response);
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

  // Default fallback
  console.log('parseClassification - Using fallback');
  return {
    intent: 'conversa_geral',
    confidence: 0.3,
    needsActions: false,
    summary: 'Não classificado',
  };
}
