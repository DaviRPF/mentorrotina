/**
 * Prompt para análise de memórias - Extrai informações pessoais das mensagens
 */

export interface MemoryAction {
  type: 'create' | 'update' | 'delete';
  memoryId?: string;
  currentContent?: string;
  newContent?: string;
  reason: string;
}

export const MEMORY_ANALYZER_PROMPT = `Extraia informações pessoais desta mensagem e retorne como JSON.

EXTRAIA qualquer uma dessas informações se presente:
- Preferências ("quero X", "prefiro Y", "gosto de Z")
- Quantidades/medidas ("meu X tem Y gramas", "peso Zkg")
- Hábitos ("acordo às X", "treino Y vezes")
- Características pessoais

REGRAS IMPORTANTES:
1. Se a informação nova CONTRADIZ uma memória existente → use "update" com memoryId
2. Se a informação COMPLEMENTA uma memória existente → use "update"
3. Se é informação completamente NOVA → use "create"

FORMATOS:
- Criar: {"type":"create","newContent":"fato novo","reason":"motivo"}
- Atualizar: {"type":"update","memoryId":"ID","currentContent":"atual","newContent":"novo","reason":"motivo"}

Responda APENAS com o JSON array.`;

export function buildMemoryAnalyzerPrompt(message: string, memories: Array<{ id: string; content: string }>): string {
  const memoriesContext = memories.length > 0
    ? memories.map((m) => `[${m.id}] ${m.content}`).join('\n')
    : '(nenhuma memória registrada)';

  return `${MEMORY_ANALYZER_PROMPT}

MENSAGEM: "${message}"

MEMÓRIAS EXISTENTES:
${memoriesContext}`;
}

export function parseMemoryActions(response: string): MemoryAction[] {
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.error('Failed to parse memory actions:', response);
  }
  return [];
}
