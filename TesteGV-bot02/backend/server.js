require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const twilio     = require('twilio');
const fs         = require('fs');
const path       = require('path');

const app = express();

// ============================================================
// === Segurança — Headers HTTP (helmet)                     ===
// ============================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  contentSecurityPolicy: false  // API pura, sem HTML servido
}));

// ============================================================
// === CORS — somente origens locais                         ===
// ============================================================
const ALLOWED_ORIGINS = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'null'   // file:// abre com Origin: null
];

app.use(cors({
  origin: function(origin, callback) {
    // Permite requests sem origin (Postman local, curl, etc.)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origem não permitida — ' + origin));
    }
  },
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-API-Key']
}));

app.use(express.json({ limit: '16kb' }));  // limita body size

// ============================================================
// === Rate Limiting por rota                                ===
// ============================================================
function makeLimit(max, windowMs, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message }
  });
}

const limiterGlobal   = makeLimit(60,  60 * 1000,        'Muitas requisições. Tente em 1 minuto.');
const limiterSearch   = makeLimit(20,  60 * 1000,        'Limite de buscas atingido. Aguarde 1 minuto.');
const limiterPurchase = makeLimit(3,   60 * 60 * 1000,   'Limite de compras atingido. Aguarde 1 hora.');
const limiterSms      = makeLimit(5,   10 * 60 * 1000,   'Limite de SMS atingido. Aguarde 10 minutos.');

app.use(limiterGlobal);

// ============================================================
// === API Key — autenticação entre frontend e backend       ===
// ============================================================
const API_KEY = process.env.API_KEY;

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
  next();
}

// Rota pública especial: retorna a API Key apenas para origens locais
// (o frontend a busca uma vez e usa em todas as chamadas seguintes)
app.get('/api/config', function(req, res) {
  const origin = req.headers.origin || '';
  const host   = req.headers.host   || '';
  const isLocal =
    origin === 'null' ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    host.includes('localhost') ||
    host.includes('127.0.0.1');

  if (!isLocal) {
    return res.status(403).json({ error: 'Acesso restrito a localhost.' });
  }
  if (!API_KEY) {
    return res.status(503).json({ error: 'API_KEY não configurada no .env.' });
  }
  res.json({ apiKey: API_KEY });
});

// ============================================================
// === Validações de input                                   ===
// ============================================================
const VALID_COUNTRIES = new Set([
  'US','GB','CA','AU','DE','FR','ES','IT','NL','SE','NO','DK','FI',
  'PL','CH','AT','BE','PT','MX','AR','CL','CO','JP','KR','SG','HK',
  'IN','ZA','IL','IE','BR','NZ','CZ','RO','HU','SK','HR','SI','EE',
  'LV','LT','LU','MT','CY','BG','GR','IS','TR','UA','RS','BA','MK'
]);
const VALID_TYPES  = new Set(['local', 'mobile', 'tollFree']);
const E164_REGEX   = /^\+[1-9]\d{7,14}$/;
const PN_SID_REGEX = /^PN[0-9a-f]{32}$/i;

function validE164(phone) {
  return typeof phone === 'string' && E164_REGEX.test(phone.trim());
}

// ============================================================
// === Erros Twilio → mensagens amigáveis (não vaza internos)===
// ============================================================
const TWILIO_ERRORS = {
  20003: 'Credenciais Twilio inválidas.',
  20008: 'Conta Twilio suspensa.',
  21421: 'Tipo de número não disponível neste país.',
  21422: 'Código de país inválido.',
  21608: 'Número de destino inválido.',
  21610: 'Número bloqueou mensagens deste remetente.',
  21614: 'Número de destino não é SMS-capable.',
  21617: 'Mensagem excede o limite de caracteres.',
  30003: 'Número de destino inacessível.',
  30004: 'Mensagem bloqueada.',
  30006: 'Número fixo — não recebe SMS.',
  63038: 'Limite de envios atingido na conta Twilio.'
};

function handleTwilioError(err, res) {
  console.error('[Twilio Error]', err.code || err.status || '', err.message);
  const code = err.code || err.status;
  const msg = TWILIO_ERRORS[code] || 'Operação falhou. Verifique sua conta Twilio.';
  res.status(err.status || 400).json({ error: msg });
}

// ============================================================
// === Cliente Twilio                                        ===
// ============================================================
function getClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || sid.startsWith('ACxxx')) return null;
  return twilio(sid, token);
}

// Grava número ativo no .env com sanitização
function savePhoneToEnv(phoneNumber) {
  // Sanitiza: remove qualquer caractere que não seja +, dígito
  const safe = phoneNumber.replace(/[^\+0-9]/g, '');
  if (!E164_REGEX.test(safe)) return;
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  let content = fs.readFileSync(envPath, 'utf8');
  if (content.match(/^TWILIO_PHONE_NUMBER=.*/m)) {
    content = content.replace(/^TWILIO_PHONE_NUMBER=.*/m, 'TWILIO_PHONE_NUMBER=' + safe);
  } else {
    content += '\nTWILIO_PHONE_NUMBER=' + safe;
  }
  fs.writeFileSync(envPath, content, { mode: 0o600 });
  process.env.TWILIO_PHONE_NUMBER = safe;
}

// ============================================================
// === A partir daqui todas as rotas exigem API Key          ===
// ============================================================
app.use('/api', requireApiKey);

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
      connected:   true,
      accountName: account.friendlyName,
      status:      account.status,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || null
    });
  } catch (err) {
    handleTwilioError(err, res);
  }
});

// ============================================================
// === Buscar números disponíveis                            ===
// ============================================================
app.get('/api/numbers/search', limiterSearch, async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: 'Twilio não configurado.' });

  const country = (req.query.country || 'US').toUpperCase().slice(0, 2);
  const type    = req.query.type || 'local';
  const limit   = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 20);

  if (!VALID_COUNTRIES.has(country)) return res.status(400).json({ error: 'Código de país inválido.' });
  if (!VALID_TYPES.has(type))        return res.status(400).json({ error: 'Tipo inválido.' });

  const typeMap = { local: 'local', mobile: 'mobile', tollFree: 'tollFree' };

  try {
    const available = await client.availablePhoneNumbers(country)[typeMap[type]].list({
      smsEnabled: true, limit
    });
    res.json({
      country,
      type,
      numbers: available.map(n => ({
        phoneNumber:  n.phoneNumber,
        friendlyName: n.friendlyName,
        locality:     n.locality    || null,
        region:       n.region      || null,
        isoCountry:   n.isoCountry,
        capabilities: { sms: n.capabilities.sms, mms: n.capabilities.mms, voice: n.capabilities.voice },
        monthlyFee:   type === 'tollFree' ? '$2.15' : type === 'mobile' ? '$1.15' : '$1.00'
      }))
    });
  } catch (err) {
    if (err.code === 21421) return res.json({ country, type, numbers: [], message: 'Tipo não disponível neste país.' });
    handleTwilioError(err, res);
  }
});

// ============================================================
// === Listar números comprados                              ===
// ============================================================
app.get('/api/numbers/owned', async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: 'Twilio não configurado.' });
  try {
    const numbers = await client.incomingPhoneNumbers.list({ limit: 50 });
    res.json({
      numbers: numbers.map(n => ({
        sid:          n.sid,
        phoneNumber:  n.phoneNumber,
        friendlyName: n.friendlyName,
        capabilities: n.capabilities,
        dateCreated:  n.dateCreated
      }))
    });
  } catch (err) { handleTwilioError(err, res); }
});

// ============================================================
// === Definir número ativo                                  ===
// ============================================================
app.post('/api/numbers/set-active', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!validE164(phoneNumber)) return res.status(400).json({ error: 'Número inválido. Use formato E.164 (ex: +351XXXXXXXXX).' });

  // Confirma que o número pertence à conta antes de ativar
  const client = getClient();
  if (client) {
    try {
      const owned = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
      if (owned.length === 0) return res.status(400).json({ error: 'Número não encontrado na conta Twilio.' });
    } catch (err) { handleTwilioError(err, res); return; }
  }

  savePhoneToEnv(phoneNumber.trim());
  res.json({ success: true, phoneNumber: phoneNumber.trim() });
});

// ============================================================
// === Comprar número                                        ===
// ============================================================
app.post('/api/numbers/purchase', limiterPurchase, async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: 'Twilio não configurado.' });

  const { phoneNumber } = req.body;
  if (!validE164(phoneNumber)) return res.status(400).json({ error: 'Número inválido. Use formato E.164.' });

  try {
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber:  phoneNumber.trim(),
      friendlyName: 'Green BOT Onboarding'
    });
    savePhoneToEnv(purchased.phoneNumber);
    res.json({
      success:      true,
      phoneNumber:  purchased.phoneNumber,
      sid:          purchased.sid,
      friendlyName: purchased.friendlyName,
      message:      'Número ' + purchased.phoneNumber + ' comprado com sucesso!'
    });
  } catch (err) { handleTwilioError(err, res); }
});

// ============================================================
// === Liberar número                                        ===
// ============================================================
app.delete('/api/numbers/:sid', async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: 'Twilio não configurado.' });

  const { sid } = req.params;
  if (!PN_SID_REGEX.test(sid)) return res.status(400).json({ error: 'SID inválido.' });

  // Confirma ownership antes de deletar
  try {
    const owned = await client.incomingPhoneNumbers.list({ limit: 50 });
    const match = owned.find(n => n.sid === sid);
    if (!match) return res.status(404).json({ error: 'Número não encontrado na conta.' });
    await client.incomingPhoneNumbers(sid).remove();
    res.json({ success: true, message: 'Número liberado.' });
  } catch (err) { handleTwilioError(err, res); }
});

// ============================================================
// === Enviar SMS                                            ===
// ============================================================
app.post('/api/sms/send', limiterSms, async (req, res) => {
  const client = getClient();
  if (!client) return res.status(503).json({ error: 'Twilio não configurado.' });

  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) return res.status(400).json({ error: 'Nenhum número ativo. Configure um número primeiro.' });

  const { to, employeeName, email, password, platforms } = req.body;

  if (!validE164(to)) return res.status(400).json({ error: 'Número de destino inválido. Use formato E.164 (ex: +5511999999999).' });
  if (!employeeName || typeof employeeName !== 'string') return res.status(400).json({ error: 'Nome do funcionário obrigatório.' });
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'E-mail obrigatório.' });

  const safeName     = employeeName.slice(0, 100).replace(/[<>&"]/g, '');
  const safeEmail    = email.slice(0, 100).replace(/[<>&"]/g, '');
  const safePassword = (password || '').slice(0, 50).replace(/[<>&"]/g, '');

  const platformLines = Array.isArray(platforms) && platforms.length > 0
    ? platforms.map(p => '• ' + String(p.name || '').slice(0, 30) + ': @' + String(p.username || safeEmail).slice(0, 50)).join('\n')
    : '(nenhuma plataforma informada)';

  const body =
    'Green BOT — Credenciais\n' +
    'Olá, ' + safeName + '!\n\n' +
    'E-mail: ' + safeEmail + '@gmail.com\n' +
    'Senha: ' + safePassword + '\n\n' +
    'Plataformas:\n' + platformLines + '\n\n' +
    'Guarde com segurança.';

  try {
    const message = await client.messages.create({ from, to: to.trim(), body });
    res.json({ success: true, sid: message.sid, to: message.to, status: message.status });
  } catch (err) { handleTwilioError(err, res); }
});

// ============================================================
// === Handler de erro global (não vaza stack traces)        ===
// ============================================================
app.use(function(err, req, res, _next) {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ============================================================
// === Servidor                                              ===
// ============================================================
const PORT = parseInt(process.env.PORT) || 3001;

// Validações críticas no startup
if (!process.env.API_KEY) {
  console.error('\n❌  API_KEY não definida no .env — o servidor não pode iniciar com segurança.\n');
  process.exit(1);
}

app.listen(PORT, '127.0.0.1', () => {
  const configured = !!(process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID.startsWith('ACxxx'));
  console.log('\n🟢  Green BOT Backend em http://127.0.0.1:' + PORT);
  console.log('    Twilio:       ' + (configured ? '✅ configurado' : '⚠️  configure o .env'));
  console.log('    Número ativo: ' + (process.env.TWILIO_PHONE_NUMBER || '(nenhum)'));
  console.log('    Segurança:    helmet ✅  rate-limit ✅  API Key ✅  CORS local ✅\n');
});
