import {
  addDays,
  addWeeks,
  setHours,
  setMinutes,
  endOfDay,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
} from 'date-fns';
import { callGeminiSimple } from './ai/gemini-client';

interface ParsedDeadline {
  deadline: Date | null;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  cleanContent: string;
}

const DEADLINE_PARSER_PROMPT = `Analise o texto e extraia informações de prazo/deadline.

HOJE: {{TODAY}}
HORA ATUAL: {{CURRENT_TIME}}

Responda APENAS com JSON:
{
  "hasDeadline": true/false,
  "deadlineType": "hoje" | "amanha" | "dia_semana" | "data_especifica" | "essa_semana" | "semana_que_vem" | "esse_mes" | "urgente" | null,
  "dayOfWeek": "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado" | "domingo" | null,
  "day": number | null,
  "month": number | null,
  "hour": number | null,
  "minute": number | null,
  "isUrgent": true/false,
  "cleanContent": "texto sem a parte do prazo"
}

Exemplos:
- "comprar leite até amanhã 14h" → {"hasDeadline":true,"deadlineType":"amanha","hour":14,"minute":0,"cleanContent":"comprar leite"}
- "reunião urgente" → {"hasDeadline":true,"deadlineType":"urgente","isUrgent":true,"cleanContent":"reunião"}
- "estudar até sexta" → {"hasDeadline":true,"deadlineType":"dia_semana","dayOfWeek":"sexta","hour":23,"minute":59,"cleanContent":"estudar"}
- "entregar até dia 25" → {"hasDeadline":true,"deadlineType":"data_especifica","day":25,"hour":23,"minute":59,"cleanContent":"entregar"}
- "fazer exercício" → {"hasDeadline":false,"cleanContent":"fazer exercício"}`;

const dayNameToNext: Record<string, (date: Date) => Date> = {
  'segunda': nextMonday,
  'terca': nextTuesday,
  'quarta': nextWednesday,
  'quinta': nextThursday,
  'sexta': nextFriday,
  'sabado': nextSaturday,
  'domingo': nextSunday,
};

export async function parseDeadline(text: string): Promise<ParsedDeadline> {
  const now = new Date();

  // Build prompt with current date/time context
  const prompt = DEADLINE_PARSER_PROMPT
    .replace('{{TODAY}}', now.toLocaleDateString('pt-BR'))
    .replace('{{CURRENT_TIME}}', now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

  try {
    const response = await callGeminiSimple(
      `${prompt}\n\nTEXTO: "${text}"`,
      { temperature: 0.1, maxOutputTokens: 256 },
      'gemini-2.5-flash'
    );

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { deadline: null, priority: 'medium', cleanContent: text.trim() };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.hasDeadline) {
      return { deadline: null, priority: 'medium', cleanContent: parsed.cleanContent || text.trim() };
    }

    let deadline: Date | null = null;
    let priority: 'urgent' | 'high' | 'medium' | 'low' = 'medium';

    const hour = parsed.hour ?? 23;
    const minute = parsed.minute ?? 59;

    switch (parsed.deadlineType) {
      case 'urgente':
        deadline = endOfDay(now);
        priority = 'urgent';
        break;

      case 'hoje':
        deadline = setMinutes(setHours(now, hour), minute);
        priority = 'urgent';
        break;

      case 'amanha':
        deadline = setMinutes(setHours(addDays(now, 1), hour), minute);
        priority = 'high';
        break;

      case 'dia_semana':
        if (parsed.dayOfWeek && dayNameToNext[parsed.dayOfWeek]) {
          let targetDay = dayNameToNext[parsed.dayOfWeek](now);
          deadline = setMinutes(setHours(targetDay, hour), minute);

          const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 2) priority = 'high';
          else if (daysUntil <= 5) priority = 'medium';
          else priority = 'low';
        }
        break;

      case 'data_especifica':
        if (parsed.day) {
          const month = parsed.month ? parsed.month - 1 : now.getMonth();
          let year = now.getFullYear();
          let targetDate = new Date(year, month, parsed.day, hour, minute);

          if (targetDate < now) {
            targetDate = new Date(year + 1, month, parsed.day, hour, minute);
          }

          deadline = targetDate;
          const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 1) priority = 'urgent';
          else if (daysUntil <= 3) priority = 'high';
          else if (daysUntil <= 7) priority = 'medium';
          else priority = 'low';
        }
        break;

      case 'essa_semana':
        deadline = setMinutes(setHours(nextSunday(now), 23), 59);
        priority = 'medium';
        break;

      case 'semana_que_vem':
        deadline = setMinutes(setHours(addWeeks(nextSunday(now), 1), 23), 59);
        priority = 'low';
        break;

      case 'esse_mes':
        deadline = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        priority = 'low';
        break;
    }

    return {
      deadline,
      priority: parsed.isUrgent ? 'urgent' : priority,
      cleanContent: parsed.cleanContent || text.trim(),
    };

  } catch (error) {
    console.error('Error parsing deadline with AI:', error);
    return { deadline: null, priority: 'medium', cleanContent: text.trim() };
  }
}

// Calculate priority based on deadline
export function calculatePriority(deadline: Date | null): 'urgent' | 'high' | 'medium' | 'low' {
  if (!deadline) return 'medium';

  const now = new Date();
  const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil <= 24) return 'urgent';
  if (hoursUntil <= 72) return 'high';
  if (hoursUntil <= 168) return 'medium'; // 7 days
  return 'low';
}
