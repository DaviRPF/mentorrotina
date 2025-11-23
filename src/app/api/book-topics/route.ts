import { NextRequest, NextResponse } from 'next/server';
import { callGeminiSimple } from '@/lib/ai/gemini-client';
import { buildBookTopicsPrompt } from '@/lib/ai/prompts/book-topics';

export async function POST(request: NextRequest) {
  try {
    const { title, model = 'gemini-2.5-flash' } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: 'Título do livro é obrigatório' },
        { status: 400 }
      );
    }

    const prompt = buildBookTopicsPrompt(title);
    const response = await callGeminiSimple(prompt, { temperature: 0.2, maxOutputTokens: 8192 }, model);

    return NextResponse.json({ topics: response.trim() });
  } catch (error) {
    console.error('Book topics API error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
