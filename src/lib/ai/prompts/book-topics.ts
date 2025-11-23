/**
 * Prompt para listar tópicos de livros
 */

export const BOOK_TOPICS_PROMPT = `Liste capítulos e conceitos-chave do livro.

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

export function buildBookTopicsPrompt(title: string): string {
  return `"${title}" - ${BOOK_TOPICS_PROMPT}`;
}
