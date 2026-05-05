#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const token = process.env.TELEGRAM_BOT_TOKEN_SEBAS || process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const jorgeChatId = process.env.JORGE_CHAT_ID;

if (!token) { console.error('[SEBAS] FATAL: TELEGRAM_BOT_TOKEN_SEBAS no configurado'); process.exit(1); }
if (!anthropicKey) { console.error('[SEBAS] FATAL: ANTHROPIC_API_KEY no configurado'); process.exit(1); }

const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl || '', supabaseKey || '');
const client = new Anthropic({ apiKey: anthropicKey });

console.log('🎯 SEBAS PM Global iniciando...');
console.log(`📱 Token: ${token ? token.slice(0, 10) + '...' : 'NO configurado ❌'}`);
console.log(`🔗 Supabase: ${supabaseUrl ? 'configurado ✅' : 'NO configurado ❌'}`);
console.log(`🧠 Anthropic: ${anthropicKey ? 'configurado ✅' : 'NO configurado ❌'}`);

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

async function identifyRequiredAgents(request) {
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system: `Eres un PM Global que identifica qué agentes especializados se necesitan.

Agentes disponibles: dev-analista, dev-backend, dev-frontend, dev-bd, dev-testing, dev-devops, dev-documentador, dev-diseño

Responde SOLO con una lista separada por comas, sin explicación. Ej: dev-analista, dev-backend`,
      messages: [{ role: 'user', content: request }],
    });

    const agentsText = message.content[0].text
      .split(',')
      .map((a) => a.trim())
      .filter((a) => AGENT_TYPES.includes(a));

    return agentsText.length > 0 ? agentsText : ['dev-analista'];
  } catch (error) {
    console.error('[SEBAS] Error Claude API:', error.message);
    return ['dev-analista'];
  }
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Ignorar mensajes sin texto (stickers, fotos, etc.)
  if (!text) return;

  const senderName = msg.from?.first_name || 'Usuario';
  console.log(`[SEBAS] Mensaje de ${senderName} (${chatId}): ${text}`);

  try {
    const agents = await identifyRequiredAgents(text);
    console.log(`[SEBAS] Agentes identificados: ${agents.join(', ')}`);

    try {
      const { error: dbError } = await supabase.from('sebas_messages').insert({
        chat_id: chatId,
        user_name: senderName,
        message: text,
        agents_identified: agents,
        timestamp: new Date().toISOString(),
      });
      if (dbError) console.warn('[SEBAS] Supabase insert falló:', dbError.message);
    } catch (e) {
      console.warn('[SEBAS] Supabase insert falló:', e.message);
    }

    const response = `🎯 *SEBAS — PM Global*\n\n📋 Solicitud: "${text}"\n\n🔍 Agentes identificados:\n${agents.map((a) => `• ${a}`).join('\n')}\n\n⏳ Delegando tareas...`;

    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('[SEBAS] Error en handler:', error.message, error.stack);
    await bot.sendMessage(chatId, '❌ Error procesando tu solicitud').catch(() => null);
  }
});

bot.on('polling_error', (error) => {
  console.error('[SEBAS] Error de polling:', error.code, error.message);
});

console.log('✅ SEBAS PM Global listo');
