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

    const prompt = `"${title}" - liste capítulos e conceitos-chave.

REGRAS (economize tokens):
- SEM artigos (o/a/os/as/um/uma)
- SEM repetir título do livro
- SEM introduções ou conclusões textuais
- Abrevie: Cap=Capítulo, Pt=Parte
- Conceitos em 2-4 palavras max
- Use vírgulas ao invés de bullets quando possível

Formato compacto:
Pt1: Nome
Cap1: Nome - conceito1, conceito2, conceito3
Cap2: Nome - conceito1, conceito2

Exemplo "Atomic Habits":
Pt1: Fundamentos
Cap1: Poder hábitos pequenos - 1% melhor/dia, agregação ganhos
Cap2: Identidade molda hábitos - ser>fazer, ciclo feedback
Pt2: 4 Leis
Cap3: Deixar óbvio - gatilhos visuais, implementation intentions
...

Liste TODOS os capítulos, formato compacto.`;

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
