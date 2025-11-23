/**
 * Gerador de ações JSON
 * Especializado em converter descrições de rotina em ações executáveis
 * Recebe a resposta do mentor e gera o JSON correspondente
 */

export interface CalendarAction {
  type: 'create' | 'update' | 'move' | 'delete';
  description: string;
  data: {
    // Para create
    title?: string;
    description?: string | null;
    startTime?: string;
    endTime?: string;
    color?: string;
    calendarId?: string;
    isAllDay?: boolean;
    reminderMinutes?: number | null;
    recurrenceRule?: string | null;
    // Para update/move/delete
    eventId?: string;
  };
}

export const ACTION_GENERATOR_PROMPT = `Você é um gerador de ações JSON para calendário.

ENTRADA: Descrição do mentor sobre o que fazer (criar, deletar, mover, atualizar eventos)
SAÍDA: Array JSON de ações

TIPOS DE AÇÕES:

1. CRIAR evento:
{"type":"create","description":"Título - DD/MM HH:MM","data":{"title":"Título","startTime":"YYYY-MM-DDTHH:MM:00","endTime":"YYYY-MM-DDTHH:MM:00","color":"#3b82f6","calendarId":"ID","isAllDay":false,"reminderMinutes":15}}

2. DELETAR evento (quando menciona "remover", "deletar", "apagar" ou lista com 🗑️):
{"type":"delete","description":"Deletar Título","data":{"eventId":"ID_DO_EVENTO"}}

3. MOVER evento:
{"type":"move","description":"Mover Título","data":{"eventId":"ID_DO_EVENTO","startTime":"YYYY-MM-DDTHH:MM:00","endTime":"YYYY-MM-DDTHH:MM:00"}}

4. ATUALIZAR evento:
{"type":"update","description":"Atualizar Título","data":{"eventId":"ID_DO_EVENTO","title":"Novo título"}}

CORES DISPONÍVEIS:
- Azul: #3b82f6 (padrão)
- Vermelho: #ef4444
- Verde: #22c55e
- Amarelo: #eab308
- Roxo: #a855f7
- Rosa: #ec4899
- Laranja: #f97316
- Teal: #14b8a6

REGRAS:
1. Extraia TODAS as ações mencionadas (criar, deletar, mover, atualizar)
2. Para DELETE: use o eventId exato fornecido no contexto
3. Responda APENAS com o array JSON, sem explicações

EXEMPLO 1 - CRIAR:
Entrada: "Segunda, 24/11: 07:00-08:30 - Musculação (Push)"
Saída: [{"type":"create","description":"Musculação (Push) - 24/11","data":{"title":"Musculação (Push)","startTime":"2025-11-24T07:00:00","endTime":"2025-11-24T08:30:00","color":"#22c55e","calendarId":"ID","isAllDay":false,"reminderMinutes":15}}]

EXEMPLO 2 - DELETAR:
Entrada: "🗑️ Eventos a remover:
- "Musculação (Push)" em 24/11 às 07:00 | ID: abc-123
- "Cardio" em 24/11 às 17:00 | ID: def-456"
Saída: [{"type":"delete","description":"Deletar Musculação (Push)","data":{"eventId":"abc-123"}},{"type":"delete","description":"Deletar Cardio","data":{"eventId":"def-456"}}]

EXEMPLO 3 - MOVER:
Entrada: "📦 Mover Reunião de 09:00 para 14:00 | ID: ghi-789"
Saída: [{"type":"move","description":"Mover Reunião","data":{"eventId":"ghi-789","startTime":"2025-11-24T14:00:00","endTime":"2025-11-24T15:00:00"}}]`;

/**
 * Extrai ações da resposta da IA
 */
export function parseActions(response: string): CalendarAction[] {
  try {
    // Try to find JSON array in response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [parsed];
    }
  } catch (e) {
    console.error('Failed to parse actions:', e);
  }
  return [];
}

/**
 * Valida se as ações estão bem formadas
 */
export function validateActions(actions: CalendarAction[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    if (!action.type) {
      errors.push(`Ação ${i + 1}: tipo não especificado`);
      continue;
    }

    if (action.type === 'create') {
      if (!action.data.title) errors.push(`Ação ${i + 1}: título obrigatório`);
      if (!action.data.startTime) errors.push(`Ação ${i + 1}: startTime obrigatório`);
      if (!action.data.endTime) errors.push(`Ação ${i + 1}: endTime obrigatório`);
      if (!action.data.calendarId) errors.push(`Ação ${i + 1}: calendarId obrigatório`);
    }

    if (['update', 'move', 'delete'].includes(action.type)) {
      if (!action.data.eventId) errors.push(`Ação ${i + 1}: eventId obrigatório para ${action.type}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
