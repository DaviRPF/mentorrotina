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

    const prompt = `Liste os principais capítulos e tópicos do livro "${title}".

Formato esperado (seja conciso, apenas liste os tópicos):
- Capítulo 1: Nome do capítulo
  • Tópico principal 1
  • Tópico principal 2
- Capítulo 2: Nome do capítulo
  • Tópico principal 1
  • Tópico principal 2
...

Se você não conhecer o livro exatamente, liste os tópicos mais prováveis baseado no título e tema.
Seja direto, não adicione explicações - apenas a lista de capítulos e tópicos.`;

    const response = await fetch(
      `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
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
