#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const token = process.env.TELEGRAM_BOT_TOKEN_SEBAS || process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const jorgeChatId = process.env.JORGE_CHAT_ID;

const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);
const client = new Anthropic({ apiKey: anthropicKey });

console.log('🎯 SEBAS PM Global iniciando...');
console.log(`📱 Token: ${token ? 'configurado ✅' : 'NO configurado ❌'}`);
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
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: `Eres un PM Global que identifica qué agentes especializados se necesitan.

Agentes disponibles:
- dev-analista: Análisis de requisitos
- dev-backend: APIs y lógica de servidor
- dev-frontend: Interfaces de usuario
- dev-bd: Diseño de base de datos
- dev-testing: Testing y QA
- dev-devops: CI/CD y deployment
- dev-documentador: Documentación
- dev-diseño: UI/UX

Responde SOLO con una lista de agent types separados por comas, sin explicación.
Ej: dev-analista, dev-backend, dev-bd`,
      messages: [
        {
          role: 'user',
          content: request,
        },
      ],
    });

    const agentsText = message.content[0].text
      .split(',')
      .map((a) => a.trim())
      .filter((a) => AGENT_TYPES.includes(a));

    return agentsText.length > 0 ? agentsText : ['dev-analista'];
  } catch (error) {
    console.error('[SEBAS] Error identificando agentes:', error.message);
    return ['dev-analista'];
  }
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  console.log(`[SEBAS] Mensaje recibido de ${msg.from.first_name}: ${text}`);

  try {
    // Identificar agentes necesarios
    const agents = await identifyRequiredAgents(text);
    console.log(`[SEBAS] Agentes identificados: ${agents.join(', ')}`);

    // Log en Supabase
    await supabase.from('sebas_messages').insert({
      chat_id: chatId,
      user_name: msg.from.first_name,
      message: text,
      agents_identified: agents,
      timestamp: new Date().toISOString(),
    }).catch(() => null);

    // Respuesta
    const response = `🎯 SEBAS - PM Global\n\n📋 Solicitud: "${text}"\n\n🔍 Agentes identificados:\n${agents
      .map((a) => `• ${a}`)
      .join('\n')}\n\n⏳ Delegando tareas a los agentes especializados...`;

    await bot.sendMessage(chatId, response);
  } catch (error) {
    console.error('[SEBAS] Error:', error.message);
    await bot.sendMessage(chatId, '❌ Error procesando tu solicitud');
  }
});

bot.on('polling_error', (error) => {
  console.error('[SEBAS] Error de polling:', error);
});

console.log('✅ SEBAS PM Global listo');
