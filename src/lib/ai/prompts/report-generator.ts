/**
 * Prompt para geração de relatórios do dia
 */

export interface DayReportData {
  summary: string;
  completedTasks: string[];
  skippedTasks: string[];
  highlights: string[];
  challenges: string[];
  insights: string[];
  completedEvents: number;
  energyLevel: number | null;
  moodRating: number | null;
}

export const REPORT_GENERATOR_PROMPT = `Analise esta conversa de acompanhamento do dia e gere um relatório estruturado.

INSTRUÇÕES:
1. Compare os HORÁRIOS das mensagens com os HORÁRIOS dos eventos planejados
2. Identifique se atividades foram feitas no horário, com atraso, ou adiantadas
3. Liste o que foi feito e em que horário foi reportado
4. Liste o que estava planejado mas não foi mencionado como feito

Gere um relatório JSON:
{
  "summary": "Resumo em 2-3 frases, incluindo observações sobre pontualidade",
  "completedTasks": ["lista de tarefas completadas COM horário, ex: 'Academia (feito às 08:30, planejado 08:00)'"],
  "skippedTasks": ["tarefas planejadas não mencionadas como feitas"],
  "highlights": ["momentos positivos ou conquistas"],
  "challenges": ["dificuldades enfrentadas, incluindo atrasos"],
  "insights": ["aprendizados sobre gestão de tempo"],
  "completedEvents": número,
  "energyLevel": 1-5 ou null,
  "moodRating": 1-5 ou null
}

Responda APENAS com o JSON.`;

export function buildReportPrompt(
  date: string,
  events: string,
  conversation: string
): string {
  return `${REPORT_GENERATOR_PROMPT}

DATA: ${date}

EVENTOS PLANEJADOS (com horários):
${events || 'Nenhum evento planejado'}

CONVERSA DE ACOMPANHAMENTO (com horários):
${conversation || 'Nenhuma conversa'}`;
}

export function parseReport(response: string): DayReportData {
  try {
    const cleanedText = response.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch {
    console.error('Failed to parse report:', response);
    return {
      summary: 'Relatório gerado automaticamente',
      completedTasks: [],
      skippedTasks: [],
      highlights: [],
      challenges: [],
      insights: [],
      completedEvents: 0,
      energyLevel: null,
      moodRating: null,
    };
  }
}
