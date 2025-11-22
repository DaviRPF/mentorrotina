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

MEMÓRIAS EXISTENTES DO USUÁRIO:
${memoriesContext}

EXTRAIA qualquer uma dessas informações se estiver presente:
- Preferências ("quero X", "prefiro Y", "gosto de Z")
- Quantidades/medidas ("meu X tem Y gramas", "peso Zkg")
- Hábitos ("acordo às X", "treino Y vezes")
- Características pessoais

REGRAS IMPORTANTES:
1. Se a informação nova CONTRADIZ ou ATUALIZA uma memória existente → use "update" com o memoryId
2. Se a informação nova COMPLEMENTA uma memória existente (mesmo assunto) → use "update" para adicionar
3. Se é informação completamente NOVA → use "create"

FORMATOS:
- Criar novo: {"type":"create","newContent":"fato novo","reason":"motivo"}
- Atualizar: {"type":"update","memoryId":"ID_DA_MEMORIA","currentContent":"conteúdo atual","newContent":"conteúdo atualizado","reason":"motivo"}

EXEMPLO 1 - Criar novo:
Memórias existentes: (nenhuma)
Mensagem: "minha cor favorita é laranja"
Resposta: [{"type":"create","newContent":"Cor favorita: laranja","reason":"Nova preferência"}]

EXEMPLO 2 - Atualizar (contradição):
Memórias existentes: [abc123] Cor favorita: laranja
Mensagem: "minha cor favorita é vermelha"
Resposta: [{"type":"update","memoryId":"abc123","currentContent":"Cor favorita: laranja","newContent":"Cor favorita: vermelha","reason":"Usuário mudou preferência"}]

EXEMPLO 3 - Atualizar (complementar):
Memórias existentes: [abc123] Cor favorita: laranja
Mensagem: "também gosto de vermelho"
Resposta: [{"type":"update","memoryId":"abc123","currentContent":"Cor favorita: laranja","newContent":"Cores favoritas: laranja e vermelho","reason":"Adicionando nova cor"}]

Agora analise a mensagem e retorne APENAS o JSON array:`;

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
