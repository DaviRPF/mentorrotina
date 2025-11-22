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

    const prompt = `Você é um extrator de informações pessoais. Analise a mensagem e EXTRAIA TODAS as informações úteis sobre o usuário.

MEMÓRIAS JÁ SALVAS:
${memoriesContext}

MENSAGEM PARA ANALISAR:
"${message}"

VOCÊ DEVE EXTRAIR:
- Preferências ("quero X espaçado", "prefiro Y") → SALVAR
- Detalhes de produtos ("meu whey tem X gramas", "meu scoop tem Y") → SALVAR
- Características pessoais (peso, altura, condições) → SALVAR
- Hábitos e rotinas ("acordo às X", "treino Y vezes") → SALVAR
- Metas e objetivos numéricos → SALVAR

EXEMPLOS DE EXTRAÇÃO:
Mensagem: "meus scoops de proteina no talo tem 15g"
→ Criar: "Scoop de whey protein cheio tem 15g de proteína"

Mensagem: "quero o consumo de proteina espaçado"
→ Criar: "Prefere consumir proteína de forma espaçada ao longo do dia"

Mensagem: "tenho que consumir 166g de proteina"
→ Criar: "Meta diária de proteína: 166g"

NÃO EXTRAIR:
- Pedidos de ação ("cria evento", "faz meu dia")
- Perguntas
- Informações já salvas nas memórias existentes

FORMATO JSON OBRIGATÓRIO:
\`\`\`json
[
  {"type": "create", "newContent": "Fato sobre o usuário", "reason": "Motivo"},
  {"type": "update", "memoryId": "id", "currentContent": "antigo", "newContent": "novo", "reason": "Motivo"}
]
\`\`\`

Se realmente não houver NADA para extrair, retorne: []

RESPONDA APENAS COM O JSON.`;

    const response = await fetch(
      `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
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

    console.log('Memory analyze - Message:', message);
    console.log('Memory analyze - Gemini response:', responseText);

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    let actions: MemoryAction[] = [];

    if (jsonMatch) {
      try {
        actions = JSON.parse(jsonMatch[0]);
        console.log('Memory analyze - Parsed actions:', actions);
      } catch {
        console.error('Failed to parse memory actions:', responseText);
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
