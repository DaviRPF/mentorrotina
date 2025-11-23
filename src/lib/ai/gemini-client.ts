/**
 * Cliente unificado para chamadas à API do Gemini
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

export interface GeminiConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
}

export interface GeminiResponse {
  text: string;
  raw: unknown;
}

const DEFAULT_CONFIG: GeminiConfig = {
  temperature: 0.3,
  topK: 40,
  topP: 0.95,
};

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

/**
 * Faz uma chamada à API do Gemini
 */
export async function callGemini(
  contents: GeminiMessage[],
  config: GeminiConfig = {},
  model: string = 'gemini-2.5-flash'
): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada. Adicione no arquivo .env');
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const response = await fetch(
    `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: mergedConfig,
        safetySettings: SAFETY_SETTINGS,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Gemini API error:', errorData);
    throw new Error('Erro ao chamar API do Gemini: ' + (errorData.error?.message || 'Erro desconhecido'));
  }

  const data = await response.json();

  // Debug logging
  console.log('=== GEMINI RAW RESPONSE ===');
  console.log('Candidates:', JSON.stringify(data.candidates, null, 2));
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    console.log('WARNING: No text in response. Full data:', JSON.stringify(data, null, 2));
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return { text, raw: data };
}

/**
 * Faz uma chamada simples com um único prompt
 */
export async function callGeminiSimple(
  prompt: string,
  config: GeminiConfig = {},
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  const result = await callGemini(
    [{ role: 'user', parts: [{ text: prompt }] }],
    config,
    model
  );
  return result.text;
}

/**
 * Faz uma chamada com sistema + mensagem do usuário
 */
export async function callGeminiWithSystem(
  systemPrompt: string,
  userMessage: string,
  config: GeminiConfig = {},
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  const result = await callGemini(
    [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Entendido!' }] },
      { role: 'user', parts: [{ text: userMessage }] },
    ],
    config,
    model
  );
  return result.text;
}

/**
 * Faz uma chamada com histórico de conversa
 */
export async function callGeminiWithHistory(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string,
  images: Array<{ base64: string; mimeType: string }> = [],
  config: GeminiConfig = {},
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  // Build user message parts with optional images
  const userMessageParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: userMessage }
  ];

  // Add images if present
  for (const img of images) {
    userMessageParts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64,
      }
    });
  }

  const contents: GeminiMessage[] = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Entendido!' }] },
    // Map history (limit to last 20 messages)
    ...history.slice(-20).map((msg) => ({
      role: (msg.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: msg.content }],
    })),
    { role: 'user', parts: userMessageParts },
  ];

  const result = await callGemini(contents, config, model);
  return result.text;
}
