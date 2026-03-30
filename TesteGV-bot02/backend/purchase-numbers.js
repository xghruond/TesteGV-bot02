/**
 * Script de compra automática de números Twilio
 * Uso: node purchase-numbers.js
 *
 * Compra:
 *   2x Portugal (PT)
 *   1x Brasil (BR)
 *   1x Holanda/Países Baixos (NL)
 *   1x Reino Unido (GB)
 */

require('dotenv').config();
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');

const SID   = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;

if (!SID || SID.startsWith('ACxxx')) {
  console.error('\n❌  Configure TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN no arquivo .env primeiro.\n');
  process.exit(1);
}

const client = twilio(SID, TOKEN);

// Pedido: [país, quantidade, tipo preferido, fallback]
const ORDERS = [
  { country: 'PT', qty: 2, name: 'Portugal',       types: ['local', 'mobile'] },
  { country: 'BR', qty: 1, name: 'Brasil',          types: ['local', 'mobile'] },
  { country: 'NL', qty: 1, name: 'Holanda',         types: ['local', 'mobile'] },
  { country: 'GB', qty: 1, name: 'Reino Unido',     types: ['local', 'mobile', 'tollFree'] }
];

const purchased = [];

async function searchNumbers(country, type, limit) {
  const typeMap = {
    local:    'localNumbers',
    mobile:   'mobileNumbers',
    tollFree: 'tollFreeNumbers'
  };
  const key = typeMap[type];
  if (!key) return [];
  try {
    const results = await client.availablePhoneNumbers(country)[key].list({ smsEnabled: true, limit });
    return results;
  } catch (e) {
    return [];
  }
}

async function buyNumber(phoneNumber, label) {
  const num = await client.incomingPhoneNumbers.create({
    phoneNumber,
    friendlyName: 'Green BOT — ' + label
  });
  return num;
}

function saveEnv(numbers) {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  let content = fs.readFileSync(envPath, 'utf8');
  // Define o primeiro número comprado como ativo
  const first = numbers[0];
  if (content.match(/^TWILIO_PHONE_NUMBER=.*/m)) {
    content = content.replace(/^TWILIO_PHONE_NUMBER=.*/m, 'TWILIO_PHONE_NUMBER=' + first);
  } else {
    content += '\nTWILIO_PHONE_NUMBER=' + first;
  }
  fs.writeFileSync(envPath, content);
}

async function run() {
  console.log('\n🌍  Green BOT — Compra automática de números Twilio');
  console.log('══════════════════════════════════════════════════\n');

  for (const order of ORDERS) {
    console.log(`🔍  Buscando ${order.qty}x ${order.name} (${order.country})...`);

    let available = [];
    let usedType = null;

    for (const type of order.types) {
      available = await searchNumbers(order.country, type, order.qty + 3);
      if (available.length > 0) { usedType = type; break; }
    }

    if (available.length === 0) {
      console.log(`   ⚠️  Nenhum número disponível em ${order.name}. Pulando.\n`);
      continue;
    }

    console.log(`   Tipo encontrado: ${usedType} — ${available.length} disponíveis`);

    let bought = 0;
    for (let i = 0; i < available.length && bought < order.qty; i++) {
      const candidate = available[i];
      try {
        const num = await buyNumber(candidate.phoneNumber, order.name);
        purchased.push(num.phoneNumber);
        bought++;
        console.log(`   ✅  Comprado: ${num.phoneNumber} (${order.name})`);
      } catch (err) {
        console.log(`   ⚠️  Falha em ${candidate.phoneNumber}: ${err.message}`);
      }
    }

    if (bought < order.qty) {
      console.log(`   ℹ️  Conseguiu ${bought}/${order.qty} números para ${order.name}`);
    }
    console.log('');
  }

  if (purchased.length === 0) {
    console.log('❌  Nenhum número foi comprado. Verifique suas credenciais e saldo Twilio.\n');
    return;
  }

  // Salva o primeiro como ativo no .env
  saveEnv(purchased);

  console.log('══════════════════════════════════════════════════');
  console.log('✅  Compra concluída!\n');
  console.log('   Números adquiridos:');
  purchased.forEach(function(p) { console.log('   • ' + p); });
  console.log('\n   Número ativo definido no .env: ' + purchased[0]);
  console.log('\n   Reinicie o servidor para aplicar: node server.js\n');
}

run().catch(function(err) {
  console.error('\n❌  Erro fatal:', err.message, '\n');
  process.exit(1);
});
