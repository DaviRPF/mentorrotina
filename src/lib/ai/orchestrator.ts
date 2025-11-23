/**
 * Orquestrador de chamadas de IA
 * Coordena o fluxo multi-prompt para garantir respostas consistentes
 */

import { callGeminiSimple, callGeminiWithHistory, GeminiConfig } from './gemini-client';
import {
  buildFullContext,
  buildFormattedContext,
  formatTemporalContext,
  formatCalendarsContext,
  formatEventsContext,
  formatTodosContext,
  formatHistoryContext,
  formatMemoriesContext,
  formatOrientationsContext,
  formatBooksContext,
  formatGoalsContext,
  FullContext,
} from './context-builder';
import {
  CLASSIFIER_PROMPT,
  parseClassification,
  IntentType,
  ClassificationResult,
} from './prompts/classifier';
import {
  MENTOR_PERSONA_PROMPT,
  MENTOR_FOR_QUESTIONS_PROMPT,
  MENTOR_FOR_ROUTINE_PROMPT,
  MENTOR_FOR_MODIFICATION_PROMPT,
} from './prompts/mentor';
import {
  ACTION_GENERATOR_PROMPT,
  parseActions,
  validateActions,
  CalendarAction,
} from './prompts/action-generator';
import { buildDayTrackerPrompt } from './prompts/day-tracker';

// ============================================================================
// TIPOS
// ============================================================================

export interface ChatRequest {
  message: string;
  history?: Array<{ role: string; content: string }>;
  images?: Array<{ base64: string; mimeType: string }>;
  model?: string;
  isDayTracker?: boolean;
  dayTrackerContext?: {
    date?: string;
    events?: string;
    memories?: string;
    orientations?: string;
  };
}

export interface ChatResponse {
  response: string;
  actions: CalendarAction[];
  classification?: ClassificationResult;
  debug?: {
    intent: IntentType;
    mentorResponse: string;
    actionsGenerated: boolean;
  };
}

// ============================================================================
// CONFIGURAÇÕES
// ============================================================================

const FAST_CONFIG: GeminiConfig = {
  temperature: 0.1,
  maxOutputTokens: 256,
};

const NORMAL_CONFIG: GeminiConfig = {
  temperature: 0.3,
  maxOutputTokens: 8192,
};

const LARGE_CONFIG: GeminiConfig = {
  temperature: 0.3,
  maxOutputTokens: 32768,
};

// ============================================================================
// FUNÇÕES PRINCIPAIS
// ============================================================================

/**
 * Classifica a intenção do usuário
 */
async function classifyIntent(
  message: string,
  model: string = 'gemini-2.5-flash'
): Promise<ClassificationResult> {
  const prompt = `${CLASSIFIER_PROMPT}

MENSAGEM DO USUÁRIO: "${message}"`;

  const response = await callGeminiSimple(prompt, FAST_CONFIG, model);
  return parseClassification(response);
}

/**
 * Gera resposta do mentor baseada na intenção
 */
async function generateMentorResponse(
  message: string,
  intent: IntentType,
  context: FullContext,
  history: Array<{ role: string; content: string }>,
  images: Array<{ base64: string; mimeType: string }>,
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  // Seleciona o prompt base do mentor baseado na intenção
  let mentorPrompt: string;
  let fullPrompt: string;

  switch (intent) {
    case 'criar_rotina':
      // Para criar rotina: contexto MÍNIMO para não confundir a IA
      mentorPrompt = MENTOR_FOR_ROUTINE_PROMPT;
      fullPrompt = `${mentorPrompt}

=== CONTEXTO MÍNIMO ===
${formatTemporalContext(context)}

${formatCalendarsContext(context)}

${formatEventsContext(context)}

IMPORTANTE: Crie SOMENTE o que o usuário pediu. Nada mais.`;
      break;

    case 'modificar_evento':
      mentorPrompt = MENTOR_FOR_MODIFICATION_PROMPT;
      fullPrompt = `${mentorPrompt}

=== CONTEXTO ===
${formatTemporalContext(context)}
${formatCalendarsContext(context)}
${formatEventsContext(context)}`;
      break;

    case 'pergunta_simples':
      mentorPrompt = MENTOR_FOR_QUESTIONS_PROMPT;
      fullPrompt = `${mentorPrompt}

=== CONTEXTO ===
${formatTemporalContext(context)}
${formatMemoriesContext(context)}
${formatBooksContext(context)}`;
      break;

    default:
      // Conversa geral: contexto completo
      mentorPrompt = MENTOR_PERSONA_PROMPT;
      fullPrompt = `${mentorPrompt}

=== CONTEXTO DO SISTEMA ===
${formatTemporalContext(context)}

${formatCalendarsContext(context)}

${formatEventsContext(context)}

${formatTodosContext(context)}

${formatMemoriesContext(context)}

${formatOrientationsContext(context)}

${formatBooksContext(context)}

${formatGoalsContext(context)}

${formatHistoryContext(context)}`;
  }

  // Escolhe config baseada na intenção
  const config = intent === 'criar_rotina' ? LARGE_CONFIG : NORMAL_CONFIG;

  return callGeminiWithHistory(fullPrompt, history, message, images, config, model);
}

/**
 * Gera ações JSON a partir da resposta do mentor
 */
async function generateActions(
  mentorResponse: string,
  context: FullContext,
  intent: IntentType,
  model: string = 'gemini-2.5-flash'
): Promise<CalendarAction[]> {
  // A IA já classificou a intenção - confiamos nela
  // Se é criar_rotina ou modificar_evento, geramos ações
  if (intent !== 'criar_rotina' && intent !== 'modificar_evento') {
    console.log('generateActions: Intent não requer ações -', intent);
    return [];
  }

  console.log('generateActions: Gerando ações para intent -', intent);

  const defaultCalendarId = context.calendars[0]?.id || '';

  const prompt = `${ACTION_GENERATOR_PROMPT}

=== CONTEXTO ===
DATA DE HOJE: ${context.todayISO}
CALENDÁRIO PADRÃO ID: ${defaultCalendarId}

EVENTOS EXISTENTES (NÃO criar duplicatas):
${context.events.map(e => `- "${e.title}" | ${e.startTime} | ID: ${e.id}`).join('\n') || 'Nenhum'}

=== DESCRIÇÃO DA ROTINA (do mentor) ===
${mentorResponse}

Gere o array JSON de ações:`;

  const response = await callGeminiSimple(prompt, NORMAL_CONFIG, model);
  const actions = parseActions(response);

  // Valida as ações
  const validation = validateActions(actions);
  if (!validation.valid) {
    console.warn('Action validation warnings:', validation.errors);
  }

  // Corrige calendarId se estiver faltando
  for (const action of actions) {
    if (action.type === 'create' && !action.data.calendarId) {
      action.data.calendarId = defaultCalendarId;
    }
  }

  return actions;
}

/**
 * Processa uma mensagem do chat principal
 */
export async function processChat(request: ChatRequest): Promise<ChatResponse> {
  const {
    message,
    history = [],
    images = [],
    model = 'gemini-2.5-flash',
    isDayTracker = false,
    dayTrackerContext,
  } = request;

  // Busca contexto completo
  const context = await buildFullContext();

  // Day Tracker tem fluxo separado
  if (isDayTracker && dayTrackerContext) {
    return processDayTracker(message, history, images, context, dayTrackerContext, model);
  }

  // 1. Classifica a intenção do usuário
  console.log('=== ORCHESTRATOR: Processando mensagem ===');
  console.log('Mensagem:', message.substring(0, 100));
  const classification = await classifyIntent(message, model);
  console.log('Classification:', JSON.stringify(classification));

  // 2. Gera resposta do mentor
  const mentorResponse = await generateMentorResponse(
    message,
    classification.intent,
    context,
    history,
    images,
    model
  );

  // 3. Se a intenção requer ações, gera o JSON
  let actions: CalendarAction[] = [];
  if (classification.needsActions || classification.intent === 'criar_rotina' || classification.intent === 'modificar_evento') {
    actions = await generateActions(mentorResponse, context, classification.intent, model);
  }

  return {
    response: mentorResponse,
    actions,
    classification,
    debug: {
      intent: classification.intent,
      mentorResponse,
      actionsGenerated: actions.length > 0,
    },
  };
}

/**
 * Processa mensagem do Day Tracker
 */
async function processDayTracker(
  message: string,
  history: Array<{ role: string; content: string }>,
  images: Array<{ base64: string; mimeType: string }>,
  context: FullContext,
  dayTrackerContext: {
    date?: string;
    events?: string;
    memories?: string;
    orientations?: string;
  },
  model: string
): Promise<ChatResponse> {
  // Formata contexto de histórico
  const historyText = formatHistoryContext(context);

  // Formata todos
  const todosText = formatTodosContext(context);

  // Constrói o prompt do day tracker
  const prompt = buildDayTrackerPrompt(
    dayTrackerContext.date || context.today,
    context.currentTime,
    dayTrackerContext.events || '',
    dayTrackerContext.memories || formatMemoriesContext(context),
    dayTrackerContext.orientations || formatOrientationsContext(context),
    todosText,
    historyText
  );

  const response = await callGeminiWithHistory(prompt, history, message, images, NORMAL_CONFIG, model);

  return {
    response,
    actions: [],
  };
}

// ============================================================================
// FUNÇÕES AUXILIARES PARA OUTROS ENDPOINTS
// ============================================================================

export { buildFullContext, buildFormattedContext };
export { callGeminiSimple, callGeminiWithHistory } from './gemini-client';
export * from './prompts';
