import { NextRequest, NextResponse } from 'next/server';
import { processChat } from '@/lib/ai/orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message,
      model = 'gemini-2.5-flash',
      history = [],
      memories = [],
      orientations = '',
      bookReferences = [],
      timeContexts = [],
      isDayTracker = false,
      dayTrackerContext = null,
      images = [],
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Mensagem é obrigatória' },
        { status: 400 }
      );
    }

    // Processa a mensagem usando o orquestrador
    const result = await processChat({
      message,
      history,
      images,
      model,
      isDayTracker,
      dayTrackerContext: isDayTracker && dayTrackerContext ? {
        date: dayTrackerContext.date,
        events: dayTrackerContext.events,
        memories: memories.length > 0 ? memories.join('\n') : dayTrackerContext.memories,
        orientations: orientations || dayTrackerContext.orientations,
      } : undefined,
    });

    // Log para debug
    if (result.classification) {
      console.log('Chat processed:', {
        intent: result.classification.intent,
        confidence: result.classification.confidence,
        actionsCount: result.actions.length,
      });
    }

    return NextResponse.json({
      response: result.response,
      actions: result.actions,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
