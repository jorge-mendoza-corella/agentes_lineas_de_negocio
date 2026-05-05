#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const token = process.env.TELEGRAM_BOT_TOKEN_SEBAS || process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!token) { console.error('[SEBAS] FATAL: TELEGRAM_BOT_TOKEN_SEBAS no configurado'); process.exit(1); }
if (!anthropicKey) { console.error('[SEBAS] FATAL: ANTHROPIC_API_KEY no configurado'); process.exit(1); }

const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);
const client = new Anthropic({ apiKey: anthropicKey });

console.log('🎯 SEBAS PM Global iniciando...');
console.log(`📱 Token: ${token ? 'configurado ✅' : 'NO configurado ❌'}`);

// Memoria temporal de conversaciones (en producción usar Supabase)
const conversations = new Map();

const AGENT_TYPES = [
  'dev-analista',
  'dev-backend',
  'dev-frontend',
  'dev-bd',
  'dev-testing',
  'dev-devops',
  'dev-documentador',
  'dev-diseño',
];

const SYSTEM_PROMPT = `Eres SEBAS, el PM Global del sistema de agentes de líneas de negocio.

Tu rol es:
1. Entender solicitudes de desarrollo/proyectos de empresas
2. Ser conversacional y hacer preguntas clarificatorias si necesitas más contexto
3. Identificar qué agentes especializados necesitas para completar la tarea
4. Explicar tu estrategia de orquestación de forma clara y concisa
5. Ser profesional pero cercano, como un verdadero PM

Agentes disponibles:
- dev-analista: Análisis de requisitos y especificaciones
- dev-backend: APIs, lógica de servidor, bases de datos
- dev-frontend: Interfaces de usuario, experiencia
- dev-bd: Diseño y arquitectura de bases de datos
- dev-testing: Testing, QA, aseguramiento de calidad
- dev-devops: CI/CD, deployment, infraestructura
- dev-documentador: Documentación técnica y arquitectura
- dev-diseño: UI/UX, diseño visual

Responde siempre en español. Sé conversacional, no robótico.`;

async function processRequest(chatId, userMessage, userName) {
  try {
    // Obtener o crear historial de conversación
    let history = conversations.get(chatId) || [];

    // Agregar mensaje del usuario
    history.push({
      role: 'user',
      content: userMessage,
    });

    // Mantener últimos 10 mensajes
    if (history.length > 10) {
      history = history.slice(-10);
    }

    // Obtener respuesta de Claude
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const assistantMessage = response.content[0].text;

    // Agregar respuesta de SEBAS al historial
    history.push({
      role: 'assistant',
      content: assistantMessage,
    });

    // Guardar historial
    conversations.set(chatId, history);

    // Enviar respuesta
    await bot.sendMessage(chatId, assistantMessage);

    // Log en Supabase (opcional)
    await supabase.from('sebas_messages')
      .insert({
        chat_id: chatId,
        user_name: userName,
        user_message: userMessage,
        sebas_response: assistantMessage,
        timestamp: new Date().toISOString(),
      })
      .catch(() => null);
  } catch (error) {
    console.error('[SEBAS] Error completo:', error);
    console.error('[SEBAS] Stack:', error instanceof Error ? error.stack : 'sin stack');
    const errorMsg = error instanceof Error ? error.message : String(error);
    await bot.sendMessage(
      chatId,
      `Disculpa, tuve un problema: ${errorMsg.substring(0, 100)}`
    ).catch(e => console.error('[SEBAS] Error al enviar mensaje de error:', e));
  }
}
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userName = msg.from.first_name || msg.from.username || 'Usuario';

  console.log(`[SEBAS] Mensaje de ${userName}: ${text}`);

  // Ignorar comandos que no sean texto
  if (!text || text.startsWith('/')) {
    return;
  }

  // Mostrar que SEBAS está escribiendo
  await bot.sendChatAction(chatId, 'typing');

  // Procesar solicitud
  await processRequest(chatId, text, userName);
});

bot.on('polling_error', (error) => {
  console.error('[SEBAS] Error de polling:', error.code, error.message);
});

console.log('✅ SEBAS PM Global listo - conversacional y contextual');
