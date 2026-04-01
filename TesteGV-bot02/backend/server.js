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
      headless: false,
      channel: 'chrome',
      args: ['--start-maximized']
    });
    console.log('[Bot] Chrome aberto!');

    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    // 1. Navegar para signup
    currentJob.step = 'Abrindo ProtonMail...';
    currentJob.status = 'navigating';
    console.log('[Bot] Navegando para ProtonMail...');
    await page.goto('https://account.proton.me/signup', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.bringToFront();

    // Esperar a página JS renderizar completamente
    console.log('[Bot] Esperando pagina renderizar...');
    await page.waitForTimeout(8000);

    // 2. Selecionar plano Free (tentar varias vezes)
    currentJob.step = 'Selecionando plano gratuito...';
    currentJob.status = 'selecting-plan';
    console.log('[Bot] Procurando botao Free...');

    let freeClicked = false;
    for (let attempt = 0; attempt < 3 && !freeClicked; attempt++) {
      try {
        const freeButton = page.locator('button').filter({ hasText: /^Free/i }).first();
        if (await freeButton.isVisible({ timeout: 5000 })) {
          await freeButton.click();
          freeClicked = true;
          console.log('[Bot] Clicou no plano Free!');
        }
      } catch (e) {
        console.log('[Bot] Tentativa ' + (attempt+1) + ' de clicar Free falhou, esperando...');
        await page.waitForTimeout(3000);
      }
    }

    // Esperar transição de página
    await page.waitForTimeout(5000);
    console.log('[Bot] URL atual:', page.url());

    // 3. Preencher username — tentar várias estratégias
    currentJob.step = 'Preenchendo e-mail...';
    currentJob.status = 'filling-email';
    console.log('[Bot] Procurando campo username...');

    let emailFilled = false;
    // Estratégia 1: #username
    try {
      const el = page.locator('#username');
      if (await el.isVisible({ timeout: 5000 })) {
        await el.fill(username);
        emailFilled = true;
        console.log('[Bot] Preencheu #username');
      }
    } catch(e) {}

    // Estratégia 2: input[type=text] primeiro visível
    if (!emailFilled) {
      try {
        const el = page.locator('input[type="text"]').first();
        if (await el.isVisible({ timeout: 5000 })) {
          await el.fill(username);
          emailFilled = true;
          console.log('[Bot] Preencheu input[type=text]');
        }
      } catch(e) {}
    }

    // Estratégia 3: qualquer input visível
    if (!emailFilled) {
      try {
        const el = page.locator('input:visible').first();
        await el.waitFor({ state: 'visible', timeout: 10000 });
        await el.fill(username);
        emailFilled = true;
        console.log('[Bot] Preencheu primeiro input visível');
      } catch(e) {}
    }

    if (!emailFilled) {
      // Listar o que tem na pagina para debug
      const pageInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          inputs: Array.from(document.querySelectorAll('input')).map(i => i.id + '/' + i.type + '/' + (i.offsetParent !== null)),
          title: document.title
        };
      });
      console.log('[Bot] DEBUG pagina:', JSON.stringify(pageInfo));
      throw new Error('Não encontrou campo de e-mail. A página pode ter mudado.');
    }

    await page.waitForTimeout(500);

    // 4. Preencher password (input#password)
    currentJob.step = 'Preenchendo senha...';
    currentJob.status = 'filling-password';
    try {
      const pwInput = page.locator('#password');
      await pwInput.waitFor({ state: 'visible', timeout: 5000 });
      await pwInput.fill(password);
      await page.waitForTimeout(500);
    } catch (e) {
      // Senha pode estar em outra etapa
    }

    // 5. Clicar em criar conta / próximo
    currentJob.step = 'Criando conta...';
    currentJob.status = 'submitting';
    try {
      const submitBtn = page.locator('button[type="submit"]').first();
      if (await submitBtn.isVisible({ timeout: 3000 })) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {}

    // Se aparecer confirmação de senha na próxima tela
    try {
      const confirmPw = page.locator('input[id="repeat-password"], input[type="password"]').first();
      if (await confirmPw.isVisible({ timeout: 3000 })) {
        await confirmPw.fill(password);
        await page.waitForTimeout(500);
        const nextBtn = page.locator('button[type="submit"]').first();
        if (await nextBtn.isVisible({ timeout: 2000 })) {
          await nextBtn.click();
        }
      }
    } catch (e) {}

    // 6. AGUARDAR CAPTCHA — o usuario resolve manualmente
    currentJob.step = 'Resolva o CAPTCHA no navegador Chromium!';
    currentJob.status = 'waiting-captcha';
    await page.bringToFront();
    console.log('[Bot] CAPTCHA — esperando usuario resolver...');

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
