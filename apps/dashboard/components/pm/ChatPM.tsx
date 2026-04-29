'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface MensajeUI {
  id: string;
  rol: 'usuario' | 'agente';
  contenido: string;
  pendiente?: boolean;
  esAudio?: boolean;
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

function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Obtiene la mejor voz Google en español disponible
function getGoogleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => v.name.toLowerCase().includes('google') && v.lang.startsWith('es')) ??
    voices.find(v => v.lang === 'es-MX') ??
    voices.find(v => v.lang.startsWith('es')) ??
    null
  );
}

function speak(texto: string) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = 'es-MX';
  utterance.rate = 1.0;
  // Las voces pueden no estar listas; reintenta una vez si la lista está vacía
  const trySpeak = () => {
    const voice = getGoogleVoice();
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => { trySpeak(); };
  } else {
    trySpeak();
  }
}

function stopSpeaking() {
  window.speechSynthesis.cancel();
}

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
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [sttSupported, setSttSupported] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  useEffect(() => {
    const supported = typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    setSttSupported(supported);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Limpia el TTS al desmontar
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  // Limpia MediaRecorder y timer al desmontar
  useEffect(() => () => {
    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const toggleMic = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRec =
      (window as unknown as { SpeechRecognition: typeof SpeechRecognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.lang = 'es-MX';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);

    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, [isListening]);

  function toggleSpeak(id: string, contenido: string) {
    if (speakingId === id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(id);
    const utterance = new SpeechSynthesisUtterance(contenido);
    utterance.lang = 'es-MX';
    const trySpeak = () => {
      const voice = getGoogleVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = trySpeak;
    } else {
      trySpeak();
    }
  }

  async function iniciarGrabacion() {
    if (isRecording || isStreaming) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const mimeType = mr.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        await enviarAudio(blob, mimeType);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      alert('No se pudo acceder al micrófono.');
    }
  }

  function detenerYEnviarAudio() {
    if (!isRecording || !mediaRecorderRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setRecordingTime(0);
  }

  async function enviarAudio(blob: Blob, mimeType: string) {
    if (isStreaming) return;
    setIsStreaming(true);
    setToolEvents([]);
    stopSpeaking();
    setSpeakingId(null);

    const idUsuario = crypto.randomUUID();
    const idAgente = crypto.randomUUID();

    setMensajes(prev => [
      ...prev,
      { id: idUsuario, rol: 'usuario', contenido: '🎤 Transcribiendo...', esAudio: true },
      { id: idAgente, rol: 'agente', contenido: '', pendiente: true },
    ]);

    try {
      const base64 = await blobToBase64(blob);
      const res = await fetch('/api/pm-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_base64: base64, audio_mime: mimeType, conversacion_id: conversacionId ?? undefined }),
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
            if (ev.type === 'init') { nuevaConvId = ev.conversacion_id; setConversacionId(ev.conversacion_id); }
            if (ev.type === 'transcript') {
              setMensajes(prev => prev.map(m =>
                m.id === idUsuario ? { ...m, contenido: `🎤 ${ev.texto}` } : m
              ));
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
    } catch {
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

  async function enviar() {
    const texto = input.trim();
    if (!texto || isStreaming) return;
    setInput('');
    setIsStreaming(true);
    setToolEvents([]);
    stopSpeaking();
    setSpeakingId(null);

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
    } catch {
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
        <div className="ml-auto flex items-center gap-3">
          {isRecording && (
            <span className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
              Grabando {fmtTime(recordingTime)}
            </span>
          )}
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
              Procesando...
            </span>
          )}
        </div>
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
              Escribe o dicta tu requerimiento y el PM Global lo analizará, delegará tareas y coordinará al equipo.
            </p>
          </div>
        )}

        {mensajes.map(m => (
          <div key={m.id} className={`flex ${m.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            {m.rol === 'agente' && (
              <span className="text-xl mr-2 mt-0.5 shrink-0">🎯</span>
            )}
            <div className="flex flex-col gap-1 max-w-[75%]">
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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

              {/* Botón TTS en mensajes del agente ya completos */}
              {m.rol === 'agente' && !m.pendiente && m.contenido && (
                <button
                  onClick={() => toggleSpeak(m.id, m.contenido)}
                  title={speakingId === m.id ? 'Detener audio' : 'Escuchar respuesta'}
                  className={`self-start flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                    speakingId === m.id
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {speakingId === m.id ? (
                    <>
                      <span className="flex gap-0.5 items-end h-3">
                        <span className="w-0.5 bg-blue-500 rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" style={{ height: '40%', animationDelay: '0ms' }} />
                        <span className="w-0.5 bg-blue-500 rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" style={{ height: '100%', animationDelay: '100ms' }} />
                        <span className="w-0.5 bg-blue-500 rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" style={{ height: '60%', animationDelay: '200ms' }} />
                        <span className="w-0.5 bg-blue-500 rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" style={{ height: '80%', animationDelay: '150ms' }} />
                      </span>
                      Detener
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                      </svg>
                      Escuchar
                    </>
                  )}
                </button>
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
            placeholder="Escribe o dicta tu requerimiento... (Ctrl+Enter para enviar)"
            rows={3}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
          />
          <div className="flex flex-col gap-2">
            {/* Botón STT */}
            {sttSupported && (
              <button
                onClick={toggleMic}
                disabled={isStreaming}
                title={isListening ? 'Detener grabación' : 'Dictar mensaje (Google STT)'}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0 ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {isListening ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <rect x="6" y="6" width="8" height="8" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )}
            {/* Botón grabar y enviar audio */}
            <button
              onClick={isRecording ? detenerYEnviarAudio : iniciarGrabacion}
              disabled={isStreaming}
              title={isRecording ? 'Detener y enviar audio' : 'Grabar y enviar audio (Gemini)'}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0 ${
                isRecording
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {isRecording ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <rect x="5" y="5" width="10" height="10" rx="1" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z"/>
                  <path d="M17 11a1 1 0 00-2 0 3 3 0 01-6 0 1 1 0 00-2 0 5 5 0 0010 0z"/>
                  <path d="M11 18.93V21H9a1 1 0 000 2h6a1 1 0 000-2h-2v-2.07A7 7 0 0019 12a1 1 0 00-2 0 5 5 0 01-10 0 1 1 0 00-2 0 7 7 0 006 6.93z"/>
                </svg>
              )}
            </button>
            {/* Botón Enviar */}
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
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 ml-1">
          Ctrl+Enter para enviar{sttSupported ? ' · 🎤 dictar' : ''} · 🎙 grabar y enviar audio vía Gemini
        </p>
      </div>
    </div>
  );
}
