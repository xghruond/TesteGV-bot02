require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// === Configuração Twilio                                   ===
// ============================================================

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || sid.startsWith('ACxxx')) {
    return null;
  }
  return twilio(sid, token);
}

// Atualiza .env com o número comprado
function savePhoneToEnv(phoneNumber) {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  let content = fs.readFileSync(envPath, 'utf8');
  if (content.match(/^TWILIO_PHONE_NUMBER=.*/m)) {
    content = content.replace(/^TWILIO_PHONE_NUMBER=.*/m, `TWILIO_PHONE_NUMBER=${phoneNumber}`);
  } else {
    content += `\nTWILIO_PHONE_NUMBER=${phoneNumber}`;
  }
  fs.writeFileSync(envPath, content);
  process.env.TWILIO_PHONE_NUMBER = phoneNumber;
}

// ============================================================
// === Status                                                ===
// ============================================================

app.get('/api/status', async (req, res) => {
  const client = getClient();
  if (!client) {
    return res.json({ connected: false, message: 'Credenciais Twilio não configuradas no .env' });
  }
  try {
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    res.json({
      connected: true,
      accountName: account.friendlyName,
      status: account.status,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || null
    });
  } catch (err) {
    res.status(400).json({ connected: false, message: err.message });
  }
});

// ============================================================
// === Buscar números disponíveis                            ===
// ============================================================

app.get('/api/numbers/search', async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: 'Twilio não configurado' });

  const country = (req.query.country || 'US').toUpperCase();
  const type = req.query.type || 'local'; // local | mobile | tollFree
  const limit = parseInt(req.query.limit) || 10;

  try {
    let numbers = [];

    const typeMap = {
      local: 'localNumbers',
      mobile: 'mobileNumbers',
      tollFree: 'tollFreeNumbers'
    };
    const listKey = typeMap[type] || 'localNumbers';

    const available = await client.availablePhoneNumbers(country)[listKey].list({
      smsEnabled: true,
      limit
    });

    numbers = available.map(n => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality || null,
      region: n.region || null,
      isoCountry: n.isoCountry,
      capabilities: {
        sms: n.capabilities.sms,
        mms: n.capabilities.mms,
        voice: n.capabilities.voice
      },
      monthlyFee: type === 'local' ? '$1.00' : type === 'mobile' ? '$1.15' : '$2.15'
    }));

    res.json({ country, type, numbers });
  } catch (err) {
    // Se tipo não suportado no país, tenta o próximo
    if (err.code === 21421 || err.message.includes('not found')) {
      return res.json({ country, type, numbers: [], message: 'Tipo não disponível neste país' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// === Listar números já comprados                           ===
// ============================================================

app.get('/api/numbers/owned', async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: 'Twilio não configurado' });

  try {
    const numbers = await client.incomingPhoneNumbers.list({ limit: 50 });
    res.json({
      numbers: numbers.map(n => ({
        sid: n.sid,
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        capabilities: n.capabilities,
        dateCreated: n.dateCreated
      }))
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// === Definir número ativo (sem recomprar)                  ===
// ============================================================

app.post('/api/numbers/set-active', (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber obrigatório' });
  savePhoneToEnv(phoneNumber);
  res.json({ success: true, phoneNumber });
});

// ============================================================
// === Comprar número                                        ===
// ============================================================

app.post('/api/numbers/purchase', async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: 'Twilio não configurado' });

  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber obrigatório' });

  try {
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber,
      friendlyName: 'Green BOT Onboarding'
    });

    // Salva no .env como número ativo
    savePhoneToEnv(purchased.phoneNumber);

    res.json({
      success: true,
      phoneNumber: purchased.phoneNumber,
      sid: purchased.sid,
      friendlyName: purchased.friendlyName,
      message: `Número ${purchased.phoneNumber} comprado com sucesso!`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// === Liberar / deletar número                              ===
// ============================================================

app.delete('/api/numbers/:sid', async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: 'Twilio não configurado' });

  try {
    await client.incomingPhoneNumbers(req.params.sid).remove();
    res.json({ success: true, message: 'Número liberado.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// === Enviar SMS com credenciais do onboarding              ===
// ============================================================

app.post('/api/sms/send', async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: 'Twilio não configurado' });

  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) return res.status(400).json({ error: 'Nenhum número Twilio ativo. Compre um primeiro.' });

  const { to, employeeName, email, password, platforms } = req.body;
  if (!to) return res.status(400).json({ error: 'Número de destino (to) obrigatório' });

  // Monta lista de plataformas concluídas
  const platformLines = platforms && platforms.length > 0
    ? platforms.map(p => `• ${p.name}: @${p.username || email}`).join('\n')
    : '• (nenhuma plataforma informada)';

  const body =
    `Green BOT - Credenciais de Onboarding\n` +
    `Olá, ${employeeName}!\n\n` +
    `E-mail: ${email}@gmail.com\n` +
    `Senha sugerida: ${password}\n\n` +
    `Plataformas:\n${platformLines}\n\n` +
    `Guarde estas informações com segurança.`;

  try {
    const message = await client.messages.create({ from, to, body });
    res.json({
      success: true,
      sid: message.sid,
      to: message.to,
      status: message.status
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// === Servidor                                              ===
// ============================================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const configured = sid && !sid.startsWith('ACxxx');
  console.log(`\n🟢 Green BOT Backend rodando em http://localhost:${PORT}`);
  console.log(`   Twilio: ${configured ? '✅ configurado' : '⚠️  configure o .env com suas credenciais'}`);
  console.log(`   Número ativo: ${process.env.TWILIO_PHONE_NUMBER || '(nenhum comprado ainda)'}\n`);
});
