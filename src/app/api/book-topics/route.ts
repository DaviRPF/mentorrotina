import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurada' },
        { status: 500 }
      );
    }

    const { title, model = 'gemini-2.5-flash' } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: 'Título do livro é obrigatório' },
        { status: 400 }
      );
    }

    const prompt = `Liste TODOS os capítulos e principais conceitos do livro "${title}".

IMPORTANTE: Liste a estrutura COMPLETA do livro, todos os capítulos do início ao fim.

Formato:
- Parte/Capítulo: Nome
  • Conceito chave 1
  • Conceito chave 2

Exemplo para "Atomic Habits":
- Introdução: O poder surpreendente dos hábitos atômicos
- Cap 1: Os 4 Passos para Construir Melhores Hábitos
  • Deixar óbvio
  • Tornar atrativo
  • Facilitar
  • Tornar satisfatório
...continue até o final do livro...

Seja direto - apenas a lista, sem explicações. Liste TODOS os capítulos.`;

    const response = await fetch(
      `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      return NextResponse.json(
        { error: 'Erro ao gerar tópicos: ' + (errorData.error?.message || 'Erro desconhecido') },
        { status: response.status }
      );
    }

    const data = await response.json();
    const topics = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({ topics: topics.trim() });
  } catch (error) {
    console.error('Book topics API error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
