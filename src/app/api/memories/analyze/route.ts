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

    const prompt = `Analise a mensagem do usuário e identifique informações PESSOAIS sobre ele que devem ser salvas como "memórias".

MEMÓRIAS EXISTENTES:
${memoriesContext}

MENSAGEM DO USUÁRIO:
"${message}"

EXEMPLOS DO QUE DEVE SER SALVO:
- "meu whey tem 15g de proteína por scoop" → criar: "Whey protein tem 15g de proteína por scoop"
- "prefiro consumir proteína espaçada ao longo do dia" → criar: "Prefere consumir proteína espaçada ao longo do dia"
- "acordo às 7h" → criar: "Costuma acordar às 7h"
- "tenho TDAH" → criar: "Tem TDAH"
- "trabalho com marketing" → criar: "Trabalha com marketing"
- "minha meta é 166g de proteína" → criar: "Meta diária de proteína: 166g"

REGRAS:
1. Memórias são FATOS sobre o usuário: preferências, características, hábitos, condições de saúde, detalhes de produtos que usa, estratégias que prefere, horários habituais, etc.
2. NÃO são memórias: pedidos diretos ("cria um evento"), perguntas, eventos únicos do calendário
3. Cada memória deve ser uma informação ATÔMICA (um fato por memória)
4. Se a mensagem contém info que ATUALIZA uma memória existente → type: "update"
5. Se a mensagem CONTRADIZ uma memória existente → type: "update"
6. Se é info NOVA sobre o usuário → type: "create"
7. Se uma memória ficou obsoleta/incorreta → type: "delete"
8. Uma mensagem pode gerar 0, 1 ou VÁRIAS ações
9. IMPORTANTE: Seja proativo! Se o usuário mencionar qualquer detalhe útil sobre sua vida, preferências ou rotina, salve como memória

FORMATO DE RESPOSTA (JSON array):
\`\`\`json
[
  {
    "type": "create",
    "newContent": "Texto da nova memória",
    "reason": "Por que criar"
  },
  {
    "type": "update",
    "memoryId": "id-da-memoria-existente",
    "currentContent": "Conteúdo atual da memória",
    "newContent": "Novo conteúdo atualizado",
    "reason": "Por que atualizar"
  },
  {
    "type": "delete",
    "memoryId": "id-da-memoria",
    "currentContent": "Conteúdo que será deletado",
    "reason": "Por que deletar"
  }
]
\`\`\`

Se não houver informações pessoais para salvar, retorne array vazio: []

Responda APENAS com o JSON, sem explicações.`;

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

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    let actions: MemoryAction[] = [];

    if (jsonMatch) {
      try {
        actions = JSON.parse(jsonMatch[0]);
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
