'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface MensajeUI {
  id: string;
  rol: 'usuario' | 'agente';
  contenido: string;
  pendiente?: boolean;
}

interface ToolEvent {
  id: string;
  tool: string;
  estado: 'running' | 'done' | 'error';
  result?: unknown;
}

interface Props {
  conversacionIdInicial: string | null;
  mensajesIniciales: Array<{ id: string; rol: string; contenido: string; created_at: string }>;
}

const TOOL_META: Record<string, { emoji: string; label: string }> = {
  log_bitacora:              { emoji: '📝', label: 'Registrando en bitácora' },
  crear_tarea:               { emoji: '📋', label: 'Creando tarea' },
  actualizar_avatar_estado:  { emoji: '🎭', label: 'Animando agente' },
  consultar_proyectos:       { emoji: '🗂️', label: 'Consultando proyectos' },
};

export default function ChatPM({ conversacionIdInicial, mensajesIniciales }: Props) {
  const router = useRouter();
  const [conversacionId, setConversacionId] = useState<string | null>(conversacionIdInicial);
  const [mensajes, setMensajes] = useState<MensajeUI[]>(
    mensajesIniciales.map(m => ({
      id: m.id,
      rol: m.rol === 'usuario' ? 'usuario' : 'agente',
      contenido: m.contenido,
    }))
  );
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  async function enviar() {
    const texto = input.trim();
    if (!texto || isStreaming) return;
    setInput('');
    setIsStreaming(true);
    setToolEvents([]);

    const idUsuario = crypto.randomUUID();
    const idAgente = crypto.randomUUID();

    setMensajes(prev => [
      ...prev,
      { id: idUsuario, rol: 'usuario', contenido: texto },
      { id: idAgente, rol: 'agente', contenido: '', pendiente: true },
    ]);

    try {
      const res = await fetch('/api/pm-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: texto, conversacion_id: conversacionId ?? undefined }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let nuevaConvId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === 'init') {
              nuevaConvId = ev.conversacion_id;
              setConversacionId(ev.conversacion_id);
            }
            if (ev.type === 'text') {
              setMensajes(prev => prev.map(m =>
                m.id === idAgente ? { ...m, contenido: m.contenido + ev.delta } : m
              ));
            }
            if (ev.type === 'tool_start') {
              const toolId = crypto.randomUUID();
              setToolEvents(prev => [...prev, { id: toolId, tool: ev.tool, estado: 'running' }]);
            }
            if (ev.type === 'tool_end') {
              setToolEvents(prev => prev.map(t =>
                t.tool === ev.tool && t.estado === 'running'
                  ? { ...t, estado: ev.result?.error ? 'error' : 'done', result: ev.result }
                  : t
              ));
            }
            if (ev.type === 'error') {
              setMensajes(prev => prev.map(m =>
                m.id === idAgente ? { ...m, contenido: `⚠️ ${ev.message}`, pendiente: false } : m
              ));
            }
            if (ev.type === 'done' && nuevaConvId && !conversacionId) {
              router.replace(`/superadmin/solicitar?conversacion=${nuevaConvId}`);
              router.refresh();
            }
          } catch { /* línea malformada */ }
        }
      }
    } catch (e) {
      setMensajes(prev => prev.map(m =>
        m.id === idAgente
          ? { ...m, contenido: '⚠️ Error de conexión con el agente.', pendiente: false }
          : m
      ));
    } finally {
      setIsStreaming(false);
      setMensajes(prev => prev.map(m =>
        m.id === idAgente ? { ...m, pendiente: false } : m
      ));
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <span className="text-xl">🎯</span>
        <div>
          <p className="text-sm font-semibold text-gray-900">PM Global</p>
          <p className="text-xs text-gray-500">Project Manager del Área de Sistemas</p>
        </div>
        {isStreaming && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            Procesando...
          </span>
        )}
      </div>

      {/* Tool events feed */}
      {toolEvents.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-2">
          {toolEvents.map(ev => {
            const meta = TOOL_META[ev.tool] ?? { emoji: '⚙️', label: ev.tool };
            return (
              <span
                key={ev.id}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                  ev.estado === 'running'
                    ? 'bg-blue-50 text-blue-600'
                    : ev.estado === 'error'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-green-50 text-green-700'
                }`}
              >
                {ev.estado === 'running'
                  ? <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                  : <span>{ev.estado === 'done' ? '✓' : '✗'}</span>
                }
                {meta.emoji} {meta.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {mensajes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 select-none">
            <span className="text-5xl mb-4">🎯</span>
            <p className="text-sm font-semibold text-gray-700">¿En qué puedo ayudarte?</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Escribe tu requerimiento y el PM Global lo analizará, delegará tareas y coordinará al equipo.
            </p>
          </div>
        )}

        {mensajes.map(m => (
          <div key={m.id} className={`flex ${m.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            {m.rol === 'agente' && (
              <span className="text-xl mr-2 mt-0.5 shrink-0">🎯</span>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.rol === 'usuario'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-gray-100 text-gray-800 rounded-tl-sm'
              }`}
            >
              <pre className="whitespace-pre-wrap font-sans">{m.contenido}</pre>
              {m.pendiente && m.contenido === '' && (
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
              {m.pendiente && m.contenido !== '' && (
                <span className="inline-block w-2 h-4 bg-gray-400 ml-0.5 animate-pulse rounded-sm align-text-bottom" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isStreaming}
            placeholder="Escribe tu requerimiento... (Ctrl+Enter para enviar)"
            rows={3}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
          />
          <button
            onClick={enviar}
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {isStreaming ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                Enviando
              </span>
            ) : 'Enviar'}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 ml-1">Ctrl+Enter para enviar</p>
      </div>
    </div>
  );
}
