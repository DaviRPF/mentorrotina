import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface MemoryAction {
  type: 'create' | 'update' | 'delete';
  memoryId?: string; // for update/delete
  currentContent?: string; // for update/delete - show what it was
  newContent?: string; // for create/update - what it will be
  reason: string; // why this action
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurada' },
        { status: 500 }
      );
    }

    const { message, memories, model = 'gemini-2.5-flash' } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Mensagem é obrigatória' },
        { status: 400 }
      );
    }

    const memoriesContext = memories.length > 0
      ? memories.map((m: { id: string; content: string }, i: number) => `[${m.id}] ${m.content}`).join('\n')
      : '(nenhuma memória registrada)';

    const prompt = `TAREFA: Extraia fatos pessoais da mensagem abaixo.

MENSAGEM: "${message}"

MEMÓRIAS EXISTENTES: ${memoriesContext}

INSTRUÇÕES:
1. Leia a mensagem com atenção
2. Identifique QUALQUER informação sobre o usuário: preferências, quantidades, produtos, hábitos
3. Para cada informação encontrada, crie uma entrada no array

EXEMPLOS:
- "meu whey tem 15g" → {"type":"create","newContent":"Whey protein tem 15g de proteína por scoop","reason":"Info sobre produto"}
- "quero proteina espaçada" → {"type":"create","newContent":"Prefere consumir proteína espaçada ao longo do dia","reason":"Preferência do usuário"}
- "guarda na memoria" → indica que o usuário QUER que você extraia informações

RESPOSTA (apenas JSON, sem texto):
[`;

    const response = await fetch(
      `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      return NextResponse.json(
        { error: 'Erro ao analisar memórias' },
        { status: response.status }
      );
    }

    const data = await response.json();
    let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ']';

    console.log('Memory analyze - Message:', message);
    console.log('Memory analyze - Gemini response:', responseText);

    // Since prompt ends with "[", prepend it to complete the array
    let jsonText = '[' + responseText;

    // Try to extract JSON array
    const jsonMatch = jsonText.match(/\[[\s\S]*?\]/);
    let actions: MemoryAction[] = [];

    if (jsonMatch) {
      try {
        actions = JSON.parse(jsonMatch[0]);
        console.log('Memory analyze - Parsed actions:', actions);
      } catch {
        // Try original response text if prepending didn't work
        const originalMatch = responseText.match(/\[[\s\S]*?\]/);
        if (originalMatch) {
          try {
            actions = JSON.parse(originalMatch[0]);
            console.log('Memory analyze - Parsed from original:', actions);
          } catch {
            console.error('Failed to parse memory actions:', responseText);
          }
        } else {
          console.error('Failed to parse memory actions:', responseText);
        }
      }
    } else {
      console.log('Memory analyze - No JSON found in response');
    }

    return NextResponse.json({ actions });
  } catch (error) {
    console.error('Memory analyze API error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
