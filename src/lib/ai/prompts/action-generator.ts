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

ENTRADA: Descrição do mentor + lista de EVENTOS EXISTENTES com IDs
SAÍDA: Array JSON de ações

IMPORTANTE: Para DELETE/MOVE/UPDATE, encontre o evento correspondente na lista de EVENTOS EXISTENTES e use o ID correto.

TIPOS DE AÇÕES:

1. CRIAR evento:
{"type":"create","description":"Título - DD/MM","data":{"title":"Título","startTime":"YYYY-MM-DDTHH:MM:00","endTime":"YYYY-MM-DDTHH:MM:00","color":"#3b82f6","calendarId":"ID","isAllDay":false,"reminderMinutes":15}}

2. DELETAR evento (🗑️ ou "remover/deletar/apagar"):
{"type":"delete","description":"Deletar Título","data":{"eventId":"ID_DO_EVENTO_DA_LISTA"}}

3. MOVER evento (📦):
{"type":"move","description":"Mover Título","data":{"eventId":"ID_DO_EVENTO_DA_LISTA","startTime":"NOVO_HORARIO","endTime":"NOVO_HORARIO"}}

4. ATUALIZAR evento (✏️):
{"type":"update","description":"Atualizar Título","data":{"eventId":"ID_DO_EVENTO_DA_LISTA","title":"Novo título"}}

REGRAS:
1. Para DELETE: encontre cada evento mencionado na lista de EVENTOS EXISTENTES pelo título/data e use o eventId correto
2. Se o mentor menciona "Musculação Push (24/11)", encontre na lista de eventos existentes o evento com título similar e data 24/11, e use o ID dele
3. Responda APENAS com o array JSON

EXEMPLO - DELETAR (mentor diz "remover Musculação Push 24/11" e na lista existe "Musculação Push" com ID abc-123):
Saída: [{"type":"delete","description":"Deletar Musculação Push","data":{"eventId":"abc-123"}}]`;

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
