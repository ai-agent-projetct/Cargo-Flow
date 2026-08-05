import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Loader2, Wrench, ShieldAlert, Sparkles } from 'lucide-react';
import { aiAPI } from '../services/api';

// Floating assistant, mirroring the SeaRates demo's Assistant button. Chats
// against /api/ai/chat, which runs Claude with tool access to the live ERP data.

const SUGGESTIONS = [
  'Which shipments are still sitting in Booked?',
  'Break down house shipments by transport mode',
  'Show me the highest-risk customers on credit',
  'Any charge anomalies worth investigating?',
];

const ToolChip = ({ call }) => (
  <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
    <Wrench className="w-3 h-3" />
    {call.name}
    {typeof call.rowCount === 'number' && <span className="text-slate-400">· {call.rowCount}</span>}
  </span>
);

const AIAssistant = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(null);
  const [provider, setProvider] = useState(null);
  // Writes stay off until the user turns them on for the session; the backend
  // refuses any mutating tool call unless this is set.
  const [allowWrites, setAllowWrites] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!open || configured !== null) return;
    aiAPI.status()
      .then((res) => {
        setConfigured(Boolean(res.data?.data?.configured));
        setProvider(res.data?.data?.model || null);
      })
      .catch(() => setConfigured(false));
  }, [open, configured]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = useCallback(async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    const nextMessages = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await aiAPI.chat({
        // Only role/content go to the API — strip the toolCalls we attach for display.
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        allowWrites,
      });
      const { text: reply, toolCalls, configured: isConfigured } = res.data.data;
      if (isConfigured === false) setConfigured(false);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, toolCalls }]);
    } catch (error) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: error?.response?.data?.message || 'Something went wrong reaching the assistant.',
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, allowWrites]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-2xl shadow-lg transition-colors"
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-semibold">Assistant</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[26rem] max-w-[calc(100vw-3rem)] h-[34rem] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-700 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <div>
            <p className="text-sm font-semibold leading-none">CargoFlo Assistant</p>
            <p className="text-[11px] text-blue-200 mt-0.5">
              {configured && provider ? `${provider} · your live data` : 'Connected to your live data'}
            </p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="p-1 hover:bg-blue-800 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>

      {configured === false && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex-shrink-0">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Add <code className="font-mono">GOOGLE_API_KEY</code> (Google AI Studio) or <code className="font-mono">ANTHROPIC_API_KEY</code> to the backend <code className="font-mono">.env</code> and restart to enable the assistant.</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p>Ask me about shipments, consolidations, organizations, CFS entries, or your margins. I query the live database rather than guessing.</p>
            </div>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-blue-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={`max-w-[92%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-blue-700 text-white'
                : m.isError
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-slate-100 text-slate-800'
            }`}>
              {m.content}
              {(m.toolCalls || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-200">
                  {m.toolCalls.map((c, ci) => <ToolChip key={ci} call={c} />)}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Querying your data...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-slate-200 p-3 space-y-2 flex-shrink-0">
        <label className="flex items-center gap-2 text-[11px] text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={allowWrites}
            onChange={(e) => setAllowWrites(e.target.checked)}
            className="rounded border-slate-300"
          />
          Allow the assistant to create and update records
        </label>
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Ask about your shipments..."
            className="flex-1 resize-none px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-24"
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="p-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white rounded-lg transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
