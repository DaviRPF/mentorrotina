import { NextRequest, NextResponse } from 'next/server';
import { callGeminiSimple } from '@/lib/ai/gemini-client';
import { buildMemoryAnalyzerPrompt, parseMemoryActions, MemoryAction } from '@/lib/ai/prompts/memory-analyzer';

export type { MemoryAction };

export async function POST(request: NextRequest) {
  try {
    const { message, memories, model = 'gemini-2.5-flash' } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Mensagem é obrigatória' },
        { status: 400 }
      );
    }

    const prompt = buildMemoryAnalyzerPrompt(message, memories || []);
    const response = await callGeminiSimple(prompt, { disableThinking: true }, model);

    console.log('Memory analyze - Message:', message.substring(0, 100));
    console.log('Memory analyze - Response:', response);

    const actions = parseMemoryActions(response);
    console.log('Memory analyze - Actions found:', actions.length);

    return NextResponse.json({ actions });
  } catch (error) {
    console.error('Memory analyze API error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
