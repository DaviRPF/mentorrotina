import { NextRequest, NextResponse } from 'next/server';
import { callGeminiSimple } from '@/lib/ai/gemini-client';
import { buildMemorySplitterPrompt, parseMemories } from '@/lib/ai/prompts/memory-splitter';

export async function POST(request: NextRequest) {
  try {
    const { text, model = 'gemini-2.5-flash' } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Texto é obrigatório' },
        { status: 400 }
      );
    }

    const prompt = buildMemorySplitterPrompt(text);
    const response = await callGeminiSimple(prompt, { temperature: 0.1, maxOutputTokens: 2048 }, model);

    const memories = parseMemories(response);

    return NextResponse.json({ memories });
  } catch (error) {
    console.error('Memory split API error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
