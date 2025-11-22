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

    const { text, model = 'gemini-2.5-flash' } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Texto é obrigatório' },
        { status: 400 }
      );
    }

    const prompt = `Separe o texto abaixo em memórias individuais sobre a pessoa.

TEXTO:
"${text}"

REGRAS:
1. Cada memória = um FATO único e atômico sobre a pessoa
2. Reformule para terceira pessoa se necessário ("Tem TDAH" ao invés de "Eu tenho TDAH")
3. Seja conciso mas mantenha informações importantes
4. Separe informações diferentes em memórias diferentes
5. Não invente informações que não estão no texto

FORMATO (JSON array de strings):
\`\`\`json
["Memória 1", "Memória 2", "Memória 3"]
\`\`\`

Responda APENAS com o JSON.`;

    const response = await fetch(
      `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      return NextResponse.json(
        { error: 'Erro ao separar memórias' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    let memories: string[] = [];

    if (jsonMatch) {
      try {
        memories = JSON.parse(jsonMatch[0]);
      } catch {
        console.error('Failed to parse memories:', responseText);
      }
    }

    return NextResponse.json({ memories });
  } catch (error) {
    console.error('Memory split API error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
