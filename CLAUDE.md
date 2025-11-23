# Instruções para o Claude

## Gemini API

**NUNCA** usar parâmetros de configuração do Gemini como:
- `temperature`
- `topK`
- `topP`
- `maxOutputTokens`

Deixar a IA usar os padrões dela. Essas configurações causam problemas como respostas vazias e comportamentos inesperados.

## Regras Gerais

- Não usar regex para classificação de texto - usar IA
- Confiar mais na IA, não ficar super específico nos prompts
