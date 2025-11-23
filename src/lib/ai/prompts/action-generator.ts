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

export const ACTION_GENERATOR_PROMPT = `Você é um gerador de ações JSON para calendário. Sua ÚNICA função é converter descrições de rotina em JSON executável.

ENTRADA: Uma descrição de rotina com horários e atividades
SAÍDA: Array JSON de ações

FORMATO DE AÇÕES:

CRIAR evento:
{
  "type": "create",
  "description": "Título - Dia DD/MM HH:MM-HH:MM",
  "data": {
    "title": "Título",
    "description": null,
    "startTime": "YYYY-MM-DDTHH:MM:00",
    "endTime": "YYYY-MM-DDTHH:MM:00",
    "color": "#cor",
    "calendarId": "ID_CALENDARIO",
    "isAllDay": false,
    "reminderMinutes": 15,
    "recurrenceRule": null
  }
}

ATUALIZAR evento:
{
  "type": "update",
  "description": "Atualizar Título - mudança",
  "data": {
    "eventId": "ID_DO_EVENTO",
    "title": "Novo título",
    "description": "Nova descrição"
  }
}

MOVER evento:
{
  "type": "move",
  "description": "Mover Título HH:MM → HH:MM",
  "data": {
    "eventId": "ID_DO_EVENTO",
    "startTime": "YYYY-MM-DDTHH:MM:00",
    "endTime": "YYYY-MM-DDTHH:MM:00"
  }
}

DELETAR evento:
{
  "type": "delete",
  "description": "Deletar Título",
  "data": {
    "eventId": "ID_DO_EVENTO"
  }
}

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
1. Extraia TODOS os eventos mencionados na descrição
2. Use datas ISO corretas (YYYY-MM-DDTHH:MM:00)
3. Use o calendarId fornecido no contexto
4. Se não tiver cor especificada, use #3b82f6 (azul)
5. Responda APENAS com o array JSON, sem explicações
6. A descrição de cada ação deve ser clara: "Título - Dia DD/MM HH:MM-HH:MM"

EXEMPLO DE ENTRADA:
"Segunda-feira, 24 de novembro:
- 07:00-08:30 - Musculação (Push)
- 17:00-18:00 - Cardio"

EXEMPLO DE SAÍDA:
[
  {"type":"create","description":"Musculação (Push) - Seg 24/11 07:00-08:30","data":{"title":"Musculação (Push)","description":null,"startTime":"2025-11-24T07:00:00","endTime":"2025-11-24T08:30:00","color":"#22c55e","calendarId":"ID","isAllDay":false,"reminderMinutes":15,"recurrenceRule":null}},
  {"type":"create","description":"Cardio - Seg 24/11 17:00-18:00","data":{"title":"Cardio","description":null,"startTime":"2025-11-24T17:00:00","endTime":"2025-11-24T17:00:00","color":"#f97316","calendarId":"ID","isAllDay":false,"reminderMinutes":15,"recurrenceRule":null}}
]`;

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
