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

    const prompt = `Extraia informações pessoais desta mensagem e retorne como JSON.

MENSAGEM: "${message}"

EXTRAIA qualquer uma dessas informações se estiver presente:
- Preferências ("quero X", "prefiro Y", "gosto de Z")
- Quantidades/medidas ("meu X tem Y gramas", "peso Zkg")
- Hábitos ("acordo às X", "treino Y vezes")
- Características pessoais

Para CADA informação encontrada, adicione ao array:
{"type":"create","newContent":"descrição do fato","reason":"motivo"}

EXEMPLO:
Mensagem: "meu whey tem 15g por scoop e prefiro tomar espaçado"
Resposta:
[
{"type":"create","newContent":"Whey protein tem 15g de proteína por scoop","reason":"Informação sobre produto"},
{"type":"create","newContent":"Prefere consumir proteína de forma espaçada","reason":"Preferência pessoal"}
]

Agora extraia da mensagem acima. Retorne APENAS o JSON array:`;

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
        { error: 'Erro ao analisar memórias' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    console.log('Memory analyze - Message:', message.substring(0, 100));
    console.log('Memory analyze - Response:', responseText);

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    let actions: MemoryAction[] = [];

    if (jsonMatch) {
      try {
        actions = JSON.parse(jsonMatch[0]);
        console.log('Memory analyze - Actions found:', actions.length);
      } catch {
        console.error('Failed to parse memory actions:', responseText);
      }
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
