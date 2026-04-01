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

    // 2. Selecionar plano Free
    currentJob.step = 'Selecionando plano gratuito...';
    currentJob.status = 'selecting-plan';
    try {
      // O botão Free contém "Free" e "Gratuito" no texto
      const freeButton = page.locator('button.card-plan').filter({ hasText: /Free|Gratuito/i }).first();
      await freeButton.waitFor({ state: 'visible', timeout: 15000 });
      await freeButton.click();
      await page.waitForTimeout(3000);
    } catch (e) {
      // Tentar clicar direto se já passou da seleção
    }

    // 3. Preencher username — esperar a página de criação de conta
    currentJob.step = 'Preenchendo e-mail...';
    currentJob.status = 'filling-email';
    try {
      // Esperar qualquer input aparecer (página de username)
      const emailInput = page.locator('input[id="email"], input[name="email"], input[type="text"]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 20000 });
      await emailInput.fill(username);
      await page.waitForTimeout(800);
    } catch (e) {
      throw new Error('Não encontrou campo de e-mail. A página pode ter mudado.');
    }

    // 4. Preencher password
    currentJob.step = 'Preenchendo senha...';
    currentJob.status = 'filling-password';
    try {
      const pwInputs = page.locator('input[type="password"]');
      await pwInputs.first().waitFor({ state: 'visible', timeout: 10000 });
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
      // Senha pode estar em outra etapa
    }

    // 5. Clicar em próximo/criar conta
    currentJob.step = 'Avançando...';
    currentJob.status = 'submitting';
    try {
      const submitBtn = page.locator('button[type="submit"]').first();
      if (await submitBtn.isVisible({ timeout: 3000 })) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {}

    // Se tem mais campos de senha na próxima tela, preencher
    try {
      const pwInputs2 = page.locator('input[type="password"]');
      if (await pwInputs2.first().isVisible({ timeout: 3000 })) {
        const count2 = await pwInputs2.count();
        for (let i = 0; i < count2; i++) {
          await pwInputs2.nth(i).fill(password);
          await page.waitForTimeout(200);
        }
        await page.waitForTimeout(500);
        const submitBtn2 = page.locator('button[type="submit"]').first();
        if (await submitBtn2.isVisible({ timeout: 2000 })) {
          await submitBtn2.click();
        }
      }
    } catch (e) {}

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
