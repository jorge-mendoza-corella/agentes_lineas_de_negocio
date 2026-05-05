#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jorgeChatId = process.env.JORGE_CHAT_ID;

const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🤖 ALO Orchestrator iniciando...');
console.log(`📱 Token: ${token ? 'configurado ✅' : 'NO configurado ❌'}`);
console.log(`🔗 Supabase: ${supabaseUrl ? 'configurado ✅' : 'NO configurado ❌'}`);

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  console.log(`[ALO] Mensaje recibido de ${msg.from.first_name}: ${text}`);

  try {
    // Log en Supabase
    await supabase.from('alo_messages').insert({
      chat_id: chatId,
      user_name: msg.from.first_name,
      message: text,
      timestamp: new Date().toISOString(),
    }).catch(() => null); // Silenciar error si tabla no existe

    // Responder
    const response = `Hola ${msg.from.first_name} 👋\n\nSoy ALO, tu asistente de infraestructura y DevOps.\n\n✅ Estoy escuchando en este canal.\n\nPuedo ayudarte con:\n- Cambios en el repositorio\n- Mantenimiento de infraestructura\n- Preguntas técnicas\n- Troubleshooting`;

    await bot.sendMessage(chatId, response);
  } catch (error) {
    console.error('[ALO] Error:', error.message);
    await bot.sendMessage(chatId, '❌ Error procesando tu mensaje');
  }
});

bot.on('polling_error', (error) => {
  console.error('[ALO] Error de polling:', error);
});

console.log('✅ ALO Orchestrator listo');
