// Model-provider abstraction for the AI features.
//
// Both providers get the same tool definitions (plain JSON Schema) and the same
// system prompt; this module hides the differences in message shape and the
// agentic loop. Whichever key is present wins — GOOGLE_API_KEY selects Gemini,
// ANTHROPIC_API_KEY selects Claude. Set AI_PROVIDER to force one when both exist.

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

const googleKey = () => process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const anthropicKey = () => process.env.ANTHROPIC_API_KEY;

const providerName = () => {
  const forced = (process.env.AI_PROVIDER || '').toLowerCase();
  if (forced === 'gemini' || forced === 'google') return googleKey() ? 'gemini' : null;
  if (forced === 'claude' || forced === 'anthropic') return anthropicKey() ? 'claude' : null;
  if (googleKey()) return 'gemini';
  if (anthropicKey()) return 'claude';
  return null;
};

const isConfigured = () => providerName() !== null;

const activeModel = () => (providerName() === 'gemini' ? GEMINI_MODEL : CLAUDE_MODEL);

let geminiClient = null;
const getGemini = () => {
  if (!geminiClient) {
    const { GoogleGenAI } = require('@google/genai');
    geminiClient = new GoogleGenAI({ apiKey: googleKey() });
  }
  return geminiClient;
};

let claudeClient = null;
const getClaude = () => {
  if (!claudeClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    claudeClient = new Anthropic({ apiKey: anthropicKey() });
  }
  return claudeClient;
};

// ─── Gemini agent loop ───────────────────────────────────────────────────────

const geminiLoop = async ({ system, tools, messages, execute, maxIterations }) => {
  const ai = getGemini();
  // Gemini uses 'model' for the assistant role and carries tool traffic as
  // functionCall / functionResponse parts rather than separate message types.
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
  }));

  const functionDeclarations = tools.map((t) => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: t.input_schema,
  }));

  const toolCalls = [];

  for (let i = 0; i < maxIterations; i += 1) {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: system,
        tools: [{ functionDeclarations }],
        maxOutputTokens: 8000,
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

    if (calls.length === 0) {
      const text = parts.filter((p) => p.text).map((p) => p.text).join('\n').trim();
      return { text, toolCalls };
    }

    contents.push({ role: 'model', parts });

    const responseParts = [];
    for (const call of calls) {
      let result;
      try {
        result = await execute(call.name, call.args || {});
      } catch (error) {
        result = { error: error.message };
      }
      toolCalls.push({
        name: call.name,
        input: call.args,
        rowCount: Array.isArray(result) ? result.length : undefined,
      });
      // Gemini requires the response to be an object, so wrap arrays.
      responseParts.push({
        functionResponse: {
          name: call.name,
          response: Array.isArray(result) ? { results: result } : result,
        },
      });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  return { text: 'Stopped after too many tool calls without reaching an answer.', toolCalls };
};

// ─── Claude agent loop ───────────────────────────────────────────────────────

const claudeLoop = async ({ system, tools, messages, execute, maxIterations }) => {
  const anthropic = getClaude();
  const convo = [...messages];
  const toolCalls = [];

  for (let i = 0; i < maxIterations; i += 1) {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system,
      tools,
      messages: convo,
    });

    // Safety classifiers can decline; check before reading content.
    if (response.stop_reason === 'refusal') {
      return { text: 'That request was declined by safety filters. Try rephrasing it.', toolCalls };
    }

    if (response.stop_reason !== 'tool_use') {
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return { text, toolCalls };
    }

    convo.push({ role: 'assistant', content: response.content });

    const results = [];
    for (const block of response.content.filter((b) => b.type === 'tool_use')) {
      let result;
      let isError = false;
      try {
        result = await execute(block.name, block.input);
      } catch (error) {
        result = { error: error.message };
        isError = true;
      }
      toolCalls.push({
        name: block.name,
        input: block.input,
        rowCount: Array.isArray(result) ? result.length : undefined,
      });
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result).slice(0, 60000),
        is_error: isError,
      });
    }
    convo.push({ role: 'user', content: results });
  }

  return { text: 'Stopped after too many tool calls without reaching an answer.', toolCalls };
};

const runAgentLoop = async ({ system, tools, messages, execute, maxIterations = 8 }) => {
  const provider = providerName();
  if (!provider) {
    return {
      configured: false,
      text: 'The AI assistant is not configured yet. Add GOOGLE_API_KEY (Google AI Studio) or ANTHROPIC_API_KEY to the backend environment and restart.',
      toolCalls: [],
    };
  }
  const args = { system, tools, messages, execute, maxIterations };
  const result = provider === 'gemini' ? await geminiLoop(args) : await claudeLoop(args);
  return { configured: true, provider, model: activeModel(), ...result };
};

// ─── Structured extraction (document AI) ─────────────────────────────────────

const extractStructured = async ({ system, prompt, file, schema }) => {
  const provider = providerName();
  if (!provider) {
    return { configured: false, error: 'No AI provider configured. Set GOOGLE_API_KEY or ANTHROPIC_API_KEY.' };
  }

  const base64 = file.data.toString('base64');

  if (provider === 'gemini') {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: file.mimeType, data: base64 } },
          { text: prompt },
        ],
      }],
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        maxOutputTokens: 8000,
      },
    });
    try {
      return { configured: true, provider, data: JSON.parse(response.text), usage: response.usageMetadata };
    } catch {
      return { configured: true, provider, error: 'Extraction returned malformed output.', raw: (response.text || '').slice(0, 2000) };
    }
  }

  const anthropic = getClaude();
  const isPdf = file.mimeType === 'application/pdf';
  const source = { type: 'base64', media_type: file.mimeType, data: base64 };
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system,
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{
      role: 'user',
      content: [
        isPdf ? { type: 'document', source } : { type: 'image', source },
        { type: 'text', text: prompt },
      ],
    }],
  });

  if (response.stop_reason === 'refusal') {
    return { configured: true, provider, error: 'The document could not be processed.' };
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return { configured: true, provider, data: JSON.parse(text), usage: response.usage };
  } catch {
    return { configured: true, provider, error: 'Extraction returned malformed output.', raw: text.slice(0, 2000) };
  }
};

module.exports = { isConfigured, providerName, activeModel, runAgentLoop, extractStructured, CLAUDE_MODEL, GEMINI_MODEL };
