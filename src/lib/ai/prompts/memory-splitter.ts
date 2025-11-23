/**
 * Prompt para separar texto em memórias individuais
 */

export const MEMORY_SPLITTER_PROMPT = `Separe o texto em memórias individuais sobre a pessoa.

REGRAS:
1. Cada memória = um FATO único e atômico
2. Reformule para terceira pessoa ("Tem TDAH" ao invés de "Eu tenho TDAH")
3. Seja conciso mas mantenha informações importantes
4. Separe informações diferentes em memórias diferentes
5. Não invente informações

FORMATO (JSON array de strings):
["Memória 1", "Memória 2", "Memória 3"]

Responda APENAS com o JSON.`;

export function buildMemorySplitterPrompt(text: string): string {
  return `${MEMORY_SPLITTER_PROMPT}

TEXTO:
"${text}"`;
}

export function parseMemories(response: string): string[] {
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.error('Failed to parse memories:', response);
  }
  return [];
}
