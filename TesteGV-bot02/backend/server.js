const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors({ origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'null'] }));
app.use(express.json());

// Status da automação em andamento
let currentJob = null;

// ============================================================
// === POST /api/create-protonmail                           ===
// ============================================================
app.post('/api/create-protonmail', async (req, res) => {
  if (currentJob) {
    return res.status(409).json({ error: 'Já existe uma criação em andamento. Aguarde.' });
  }

  const { username, password, displayName } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password são obrigatórios.' });
  }

  currentJob = { status: 'starting', step: 'Iniciando navegador...' };

  try {
    const result = await createProtonMailAccount(username, password, displayName || '');
    res.json(result);
  } catch (err) {
    console.error('[Automation Error]', err.message);
    res.status(500).json({ error: err.message || 'Erro na automação.' });
  } finally {
    currentJob = null;
  }
});

// ============================================================
// === GET /api/automation-status                            ===
// ============================================================
app.get('/api/automation-status', (req, res) => {
  if (!currentJob) {
    return res.json({ active: false });
  }
  res.json({ active: true, status: currentJob.status, step: currentJob.step });
});

// ============================================================
// === Playwright: Criar conta ProtonMail                    ===
// ============================================================
async function createProtonMailAccount(username, password, displayName) {
  let browser;
  try {
    currentJob.step = 'Abrindo navegador...';
    currentJob.status = 'browser';

    browser = await chromium.launch({
      headless: false,  // VISIVEL — usuario precisa resolver CAPTCHA
      args: ['--start-maximized']
    });

    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    // 1. Navegar para signup
    currentJob.step = 'Abrindo ProtonMail...';
    currentJob.status = 'navigating';
    await page.goto('https://account.proton.me/signup', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    // 2. Selecionar plano Free (se aparecer seletor de planos)
    currentJob.step = 'Selecionando plano gratuito...';
    currentJob.status = 'selecting-plan';
    try {
      const freeButton = page.locator('button:has-text("Free"), [data-testid="select-free"]').first();
      if (await freeButton.isVisible({ timeout: 5000 })) {
        await freeButton.click();
        await page.waitForTimeout(1500);
      }
    } catch (e) {
      // Plano Free pode já estar selecionado ou não ter seletor
    }

    // 3. Preencher username
    currentJob.step = 'Preenchendo e-mail...';
    currentJob.status = 'filling-email';
    try {
      // Tentar vários seletores possíveis
      const emailInput = page.locator('input[id="email"], input[name="email"], input[placeholder*="mail" i], input[placeholder*="user" i]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.fill(username);
      await page.waitForTimeout(500);
    } catch (e) {
      throw new Error('Não encontrou campo de e-mail. A página pode ter mudado.');
    }

    // 4. Preencher password
    currentJob.step = 'Preenchendo senha...';
    currentJob.status = 'filling-password';
    try {
      const pwInputs = page.locator('input[type="password"]');
      const count = await pwInputs.count();
      if (count >= 2) {
        await pwInputs.nth(0).fill(password);
        await page.waitForTimeout(300);
        await pwInputs.nth(1).fill(password);
      } else if (count === 1) {
        await pwInputs.nth(0).fill(password);
      }
      await page.waitForTimeout(500);
    } catch (e) {
      throw new Error('Não encontrou campo de senha.');
    }

    // 5. Clicar em criar conta
    currentJob.step = 'Clicando em criar conta...';
    currentJob.status = 'submitting';
    try {
      const createBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Criar"), button:has-text("Next"), button:has-text("Próximo")').first();
      if (await createBtn.isVisible({ timeout: 3000 })) {
        await createBtn.click();
      }
    } catch (e) {
      // Pode não ter botão visível ainda
    }

    // 6. AGUARDAR CAPTCHA — o usuario resolve manualmente
    currentJob.step = 'Resolva o CAPTCHA no navegador que abriu!';
    currentJob.status = 'waiting-captcha';

    // Esperar até que a URL mude (indica que passou do signup)
    // ou que um elemento de sucesso apareça
    // Timeout: 5 minutos
    try {
      await page.waitForFunction(() => {
        const url = window.location.href;
        // Proton redireciona após sucesso para /mail ou mostra tela de boas-vindas
        return url.includes('/mail') ||
               url.includes('/inbox') ||
               url.includes('/welcome') ||
               url.includes('/setup') ||
               url.includes('/congratulations') ||
               document.querySelector('[class*="congratulations" i]') ||
               document.querySelector('[class*="welcome" i]') ||
               document.querySelector('[data-testid="onboarding"]');
      }, { timeout: 300000 }); // 5 minutos
    } catch (e) {
      throw new Error('Tempo esgotado (5 min). Feche o navegador e tente novamente.');
    }

    currentJob.step = 'Conta criada com sucesso!';
    currentJob.status = 'success';

    // 7. Capturar informações
    await page.waitForTimeout(2000);
    const finalUrl = page.url();

    // Fechar browser após 3 segundos
    setTimeout(async () => {
      try { await browser.close(); } catch (e) {}
    }, 3000);

    return {
      success: true,
      email: username + '@proton.me',
      password: password,
      displayName: displayName,
      message: 'Conta ProtonMail criada com sucesso!'
    };

  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    throw err;
  }
}

// ============================================================
// === Iniciar servidor                                      ===
// ============================================================
const PORT = 3001;
app.listen(PORT, () => {
  console.log('');
  console.log('  Green BOT — Automation Backend');
  console.log('  ==============================');
  console.log('  Servidor:  http://localhost:' + PORT);
  console.log('  Endpoint:  POST /api/create-protonmail');
  console.log('  Status:    GET  /api/automation-status');
  console.log('');
});
