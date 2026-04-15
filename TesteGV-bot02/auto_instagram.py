"""
Bot: Criar conta Instagram automaticamente
Usa Playwright para preencher formulário de signup do Instagram.
IDs são dinâmicos — usa aria-labels e ordem dos campos.

Uso CLI: python auto_instagram.py <email> <password> <full_name> <username> <birth_day> <birth_month> <birth_year>
Import: from auto_instagram import create_account
"""
import sys
import time
import random
import functools
import subprocess
from playwright.sync_api import sync_playwright
try:
    from bot_utils import retry, log_event
except ImportError:
    def retry(op, **kw): return op()
    def log_event(*a, **k): pass


print = functools.partial(print, flush=True)


def disconnect_vpn():
    """Desconecta ProtonVPN para acessar Tutanota com IP real."""
    print('  -> [VPN] Desconectando...')
    subprocess.run(['taskkill', '/F', '/IM', 'ProtonVPN.WireGuardService.exe'],
                   capture_output=True)
    subprocess.run(['taskkill', '/F', '/IM', 'ProtonVPNService.exe'],
                   capture_output=True)
    time.sleep(4)
    print('  -> [VPN] Desconectado!')


def reconnect_vpn():
    """Reconecta ProtonVPN."""
    print('  -> [VPN] Reconectando...')
    subprocess.run(['net', 'start', 'ProtonVPN Service'], capture_output=True)
    # Abrir o client para trigger reconexao
    subprocess.run(['start', '', 'C:/Program Files/Proton/VPN/v4.3.13/ProtonVPN.Client.exe'],
                   shell=True, capture_output=True)
    time.sleep(10)
    print('  -> [VPN] Reconectado!')

# Status global (lido pelo server.py)
status = {
    'step': 0,
    'total': 8,
    'message': 'Aguardando...',
    'done': False,
    'success': False,
    'error': None
}


def update_status(step, message, done=False, success=False, error=None):
    status['step'] = step
    status['message'] = message
    status['done'] = done
    status['success'] = success
    status['error'] = error
    level = 'error' if error else ('info' if not done else ('info' if success else 'warn'))
    log_event('instagram', level, message, step=step, extra={'done': done, 'success': success})


def safe_goto_ig(page, url, label='goto'):
    return retry(lambda: page.goto(url, timeout=60000), tries=3, backoff=1.5,
                 label='instagram.' + label, bot='instagram')


def get_cdp_context(p):
    """Tenta conectar ao Chrome CDP (localhost:9222). Retorna (browser, context) ou (None, None)."""
    try:
        cdp_browser = p.chromium.connect_over_cdp('http://localhost:9222', timeout=3000)
        if cdp_browser.contexts:
            print('  -> [CDP] Conectado ao Chrome externo em localhost:9222')
            return cdp_browser, cdp_browser.contexts[0]
    except Exception as e:
        print('  -> [CDP] Nao disponivel: ' + str(e)[:80])
    return None, None


def get_sms24_numbers(cdp_context, country='ca', max_check=12):
    """
    Lista numeros de sms24.me/en/countries/<country> via CDP e RANKEIA:
    1) Visita cada numero para ler timestamp + historico Instagram
    2) Prioriza: tem Instagram > ativo recente
    3) Filtra: descarta mortos (> 6h)
    Returns: lista rankeada de {number, href, no_prefix, age_min, ig_count}
    """
    if not cdp_context:
        return []
    try:
        pages = cdp_context.pages
        sms_page = None
        for pg in pages:
            if 'sms24.me' in pg.url:
                sms_page = pg
                break
        if not sms_page:
            sms_page = cdp_context.new_page()

        print('  -> [SMS24] Carregando lista de numeros ' + country.upper() + '...')
        sms_page.goto('https://sms24.me/en/countries/' + country, timeout=30000)
        time.sleep(3)

        numbers = sms_page.evaluate(r"""() => {
            const results = [];
            const links = document.querySelectorAll('a[href*="/numbers/"]');
            for (const link of links) {
                const txt = (link.textContent || '').trim();
                const m = txt.match(/\+\d{10,15}/);
                if (m) results.push({ number: m[0], href: link.href });
            }
            return results;
        }""") or []

        if not numbers:
            return []

        print('  -> [SMS24] ' + str(len(numbers)) + ' numeros listados, analisando atividade...')

        # Visitar cada numero para coletar info (limitado a max_check)
        analyzed = []
        for idx, n in enumerate(numbers[:max_check]):
            try:
                sms_page.goto(n['href'], timeout=15000)
                time.sleep(1.8)
                info = sms_page.evaluate(r"""() => {
                    const body = (document.body.innerText || '');
                    const tMatch = body.match(/(\d+)\s+(minute|hour|day|week|second)s?\s+ago/i);
                    let ageMin = 999999;
                    if (tMatch) {
                        const n = parseInt(tMatch[1]);
                        const unit = tMatch[2].toLowerCase();
                        if (unit.includes('second')) ageMin = 0;
                        else if (unit.includes('minute')) ageMin = n;
                        else if (unit.includes('hour')) ageMin = n * 60;
                        else if (unit.includes('day')) ageMin = n * 1440;
                        else if (unit.includes('week')) ageMin = n * 10080;
                    }
                    const igCount = (body.substring(0, 3000).match(/instagram/gi) || []).length;
                    return { ageMin, igCount };
                }""") or {}
                analyzed.append({
                    'number': n['number'],
                    'href': n['href'],
                    'age_min': info.get('ageMin', 999999),
                    'ig_count': info.get('igCount', 0)
                })
            except:
                continue

        # Filtrar mortos (>= 6 horas)
        alive = [a for a in analyzed if a['age_min'] < 360]
        # Ordenar: mais IG historico primeiro, depois mais recente
        alive.sort(key=lambda x: (-x['ig_count'], x['age_min']))

        # Adicionar no_prefix
        for a in alive:
            full = a['number'].lstrip('+')
            # US e CA usam +1
            if (country in ('us', 'ca')) and full.startswith('1') and len(full) == 11:
                a['no_prefix'] = full[1:]
            else:
                a['no_prefix'] = full

        print('  -> [SMS24] ' + str(len(alive)) + ' ativos (' + str(len(analyzed) - len(alive)) + ' mortos descartados)')
        for i, a in enumerate(alive[:7]):
            mark = ('[IG=' + str(a['ig_count']) + ']') if a['ig_count'] > 0 else '[--]'
            print('    ' + str(i + 1) + '. ' + a['number'] + ' ' + mark + ' (' + str(a['age_min']) + 'min)')
        return alive
    except Exception as e:
        print('  -> [SMS24] Erro: ' + str(e)[:100])
        return []


def get_receive_smss_numbers(bot_context):
    """Fallback: lista numeros de receive-smss.com usando contexto do bot."""
    try:
        sms_page = bot_context.new_page()
        sms_page.set_default_timeout(15000)
        sms_page.goto('https://receive-smss.com/', timeout=20000)
        time.sleep(3)
        numbers = sms_page.evaluate(r"""() => {
            const results = [];
            const links = document.querySelectorAll('a[href*="/sms/"]');
            for (const link of links) {
                const txt = (link.textContent || '').trim();
                const m = txt.match(/\+?\d{10,15}/);
                if (m) {
                    results.push({ number: '+' + m[0].replace('+', ''), href: link.href });
                }
            }
            return results.slice(0, 15);
        }""") or []
        sms_page.close()
        # Calcular no_prefix
        filtered = []
        for n in numbers:
            full = n['number'].lstrip('+')
            if full.startswith('1') and len(full) == 11:
                n['no_prefix'] = full[1:]
                filtered.append(n)  # so US
        print('  -> [receive-smss] ' + str(len(filtered)) + ' numeros US encontrados')
        return filtered
    except Exception as e:
        print('  -> [receive-smss] Erro: ' + str(e)[:80])
        return []


def open_sms_number_page(number_info, cdp_context=None, bot_context=None):
    """
    Abre a pagina de mensagens de um numero.
    Returns: page ou None
    """
    try:
        if cdp_context:
            # sms24.me via CDP
            for pg in cdp_context.pages:
                if 'sms24.me' in pg.url:
                    pg.goto(number_info['href'], timeout=30000)
                    time.sleep(3)
                    return pg
            sms_page = cdp_context.new_page()
            sms_page.goto(number_info['href'], timeout=30000)
            time.sleep(3)
            return sms_page
        elif bot_context:
            # receive-smss.com via bot context
            sms_page = bot_context.new_page()
            sms_page.set_default_timeout(15000)
            sms_page.goto(number_info['href'], timeout=20000)
            time.sleep(3)
            return sms_page
    except Exception as e:
        print('  -> [SMS] Erro open_sms_number_page: ' + str(e)[:80])
    return None


def extract_instagram_code_from_page(sms_page, seen_codes, is_sms24):
    """
    Extrai codigo Instagram da pagina de mensagens atual.
    Returns: codigo 6 digitos ou None
    """
    import re as _re
    try:
        if is_sms24:
            # sms24.me: mensagens em <li> ou outros elementos de texto
            messages = sms_page.evaluate(r"""() => {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                const out = [];
                let node;
                while ((node = walker.nextNode())) {
                    const t = (node.textContent || '').trim();
                    if (t.length > 15 && t.length < 400 && /\d{4,6}/.test(t)) {
                        out.push(t);
                    }
                }
                return out;
            }""") or []
        else:
            # receive-smss.com: divs .msgg
            messages = sms_page.evaluate(r"""() => {
                const rows = document.querySelectorAll('.msgg, [class*="msg"]');
                const msgs = [];
                for (const row of rows) {
                    const text = (row.textContent || '').trim();
                    if (text.length > 10 && text.length < 400) {
                        msgs.push(text);
                    }
                }
                return msgs;
            }""") or []

        for msg in messages:
            if 'instagram' not in msg.lower():
                continue
            m = _re.search(r'(\d{6})', msg)
            if not m:
                continue
            code = m.group(1)
            if code in seen_codes:
                continue
            print('  -> [SMS] *** CODIGO INSTAGRAM: ' + code + ' ***')
            print('  -> [SMS] Mensagem: ' + msg[:120].replace('\n', ' '))
            return code
    except Exception as e:
        print('  -> [SMS] Erro extract: ' + str(e)[:80])
    return None


def get_existing_codes(sms_page, is_sms24):
    """Retorna set de codigos 6-digitos ja presentes (para ignorar)."""
    import re as _re
    existing = set()
    try:
        if is_sms24:
            msgs = sms_page.evaluate(r"""() => {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                const out = [];
                let node;
                while ((node = walker.nextNode())) {
                    const t = (node.textContent || '').trim();
                    if (t.length > 10) out.push(t);
                }
                return out;
            }""") or []
        else:
            msgs = sms_page.evaluate(r"""() => {
                const rows = document.querySelectorAll('.msgg, [class*="msg"]');
                return Array.from(rows).map(r => r.textContent || '');
            }""") or []
        for m in msgs:
            for c in _re.findall(r'\b(\d{6})\b', m):
                existing.add(c)
    except:
        pass
    return existing


def tuta_is_logged_in(page):
    """Retorna True se o Tuta esta logado (nao na tela de login)."""
    try:
        body = page.evaluate("() => (document.body.textContent || '').toLowerCase()")
        # Indicadores de tela de login
        if 'endereço de e-mail' in body and 'senha' in body and 'lembrar' in body:
            return False
        # Indicadores de inbox logado
        return 'entrada' in body or 'inbox' in body
    except:
        return False


def tuta_relogin(mail_page):
    """Re-loga no Tuta se deslogou. Retorna True se sucesso."""
    print('  -> [TUTA] Detectado logout, re-logando...')
    try:
        mail_page.goto('https://app.tuta.com/login', timeout=30000)
        time.sleep(6)
        inputs = mail_page.locator('input:visible')
        if inputs.count() >= 1:
            inputs.nth(0).click()
            time.sleep(0.3)
            mail_page.keyboard.press('Control+a')
            mail_page.keyboard.press('Backspace')
            time.sleep(0.2)
            for ch in 'teste.greenvillage@tutamail.com':
                mail_page.keyboard.type(ch, delay=50)
        time.sleep(0.8)
        pw = mail_page.locator('input[type="password"]:visible')
        if pw.count() >= 1:
            pw.first.click()
            time.sleep(0.3)
            for ch in 'Waxdwaxdw134679852':
                mail_page.keyboard.type(ch, delay=50)
        time.sleep(0.5)
        mail_page.evaluate(r"""() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
                const t = (b.textContent || '').toLowerCase();
                if (b.offsetHeight > 0 && (t.includes('entrar') || t.includes('log in'))) {
                    b.click(); return true;
                }
            }
            return false;
        }""")
        time.sleep(10)
        if tuta_is_logged_in(mail_page):
            print('  -> [TUTA] Re-login OK!')
            return True
        print('  -> [TUTA] Re-login falhou')
        return False
    except Exception as e:
        print('  -> [TUTA] Erro re-login: ' + str(e)[:80])
        return False


def human_type(page, text):
    """Digitacao humanizada com pausas de 'pensamento'."""
    char_count = 0
    for char in text:
        page.keyboard.type(char)
        time.sleep(random.uniform(0.12, 0.35))
        char_count += 1
        # A cada 4-7 chars, pausa mais longa (pensando)
        if char_count >= random.randint(4, 7):
            time.sleep(random.uniform(0.5, 1.2))
            char_count = 0
    time.sleep(random.uniform(0.5, 1.5))


def human_wiggle(page):
    """Movimentos aleatorios de mouse + scroll para parecer humano."""
    try:
        for _ in range(random.randint(2, 4)):
            x = random.randint(200, 1200)
            y = random.randint(200, 700)
            page.mouse.move(x, y, steps=random.randint(5, 15))
            time.sleep(random.uniform(0.1, 0.3))
        if random.random() > 0.5:
            page.mouse.wheel(0, random.randint(-100, 100))
            time.sleep(random.uniform(0.2, 0.5))
    except:
        pass


def react_fill(page, selector, value):
    """Preenche campo React — tenta click+type, fallback para setter nativo"""
    try:
        el = page.locator(selector).first
        el.scroll_into_view_if_needed()
        time.sleep(0.3)
        el.click()
        time.sleep(0.5)
        page.keyboard.press('Control+a')
        page.keyboard.press('Backspace')
        time.sleep(0.3)
        human_type(page, value)
        time.sleep(0.5)
        return True
    except:
        # Fallback: React native setter
        try:
            page.evaluate('''(args) => {
                const el = document.querySelector(args.sel);
                if (!el) return false;
                el.focus();
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, args.val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }''', {'sel': selector, 'val': value})
            return True
        except:
            return False


def create_account(email, password, full_name, username, birth_day='1', birth_month='1', birth_year='2000', tuta_pass=''):
    """Cria conta Instagram. Retorna status dict.
    tuta_pass: senha do email Tutanota (para buscar codigo de verificacao)."""
    # Limpar estado residual de chamadas anteriores
    create_account._code_done = False
    create_account._mail_page = None
    create_account._mail_attempts = 0
    create_account._tuta_pass = tuta_pass
    create_account._vpn_off_for_code = False
    create_account._code_search_started = False
    create_account._sms_detected = False
    create_account._sms_done = False
    create_account._sms_start_time = 0
    create_account._sms_initial_len = 0

    with sync_playwright() as p:
        # === PASSO 1: Abrir Chrome ===
        update_status(1, 'Abrindo navegador...')
        print('[1/8] Abrindo Instagram...')

        browser = p.chromium.launch(
            headless=False,
            channel='chrome',
            args=[
                '--start-maximized',
                '--window-position=0,0',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--no-sandbox',
                '--disable-dev-shm-usage',
            ]
        )
        context = browser.new_context(
            no_viewport=True,
            locale='pt-BR',
            timezone_id='America/Sao_Paulo',
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            is_mobile=False,
            has_touch=False,
            java_script_enabled=True,
        )
        # Anti-deteccao reforcada (reduzir trigger de SMS no Instagram)
        context.add_init_script("""
            // Remover webdriver flag COMPLETAMENTE
            delete Object.getPrototypeOf(navigator).webdriver;

            // Hardware realista
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

            // Plugins como PluginArray-like (nao array simples)
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const plugins = [
                        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: '' },
                        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: '' },
                        { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: '' },
                        { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: '' }
                    ];
                    plugins.item = i => plugins[i];
                    plugins.namedItem = n => plugins.find(p => p.name === n);
                    plugins.refresh = () => {};
                    return plugins;
                }
            });

            Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });

            // Chrome runtime mais completo
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };

            // Permissions real (prompt, nao denied)
            if (navigator.permissions && navigator.permissions.query) {
                const originalQuery = navigator.permissions.query;
                navigator.permissions.query = (params) => {
                    if (params.name === 'notifications') {
                        return Promise.resolve({ state: 'prompt', onchange: null });
                    }
                    return originalQuery.call(navigator.permissions, params);
                };
            }

            // WebGL vendor/renderer realista
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(param) {
                if (param === 37445) return 'Intel Inc.';
                if (param === 37446) return 'Intel Iris OpenGL Engine';
                return getParameter.call(this, param);
            };

            // Screen mais realista
            Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
            Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
            Object.defineProperty(screen, 'width', { get: () => 1920 });
            Object.defineProperty(screen, 'height', { get: () => 1080 });
            Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
            Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
        """)

        # === PASSO 0: Logar no Tutanota ANTES de tudo ===
        update_status(1, 'Logando no Tutanota primeiro...')
        print('[0/8] Logando no Tutanota (para buscar codigo depois)...')
        mail_page = None
        mail_logged_in = False
        try:
            disconnect_vpn()
            mail_page = context.new_page()
            mail_page.set_default_timeout(30000)
            mail_page.goto('https://app.tuta.com/login', timeout=30000)
            time.sleep(8)

            tuta_email = 'teste.greenvillage@tutamail.com'
            tuta_pass_val = 'Waxdwaxdw134679852'

            # Preencher email
            inputs = mail_page.locator('input:visible')
            if inputs.count() >= 1:
                inputs.nth(0).click()
                time.sleep(0.5)
                mail_page.keyboard.press('Control+a')
                mail_page.keyboard.press('Backspace')
                time.sleep(0.3)
                human_type(mail_page, tuta_email)
                print('  -> Email preenchido')
            time.sleep(1)

            # Senha
            pw = mail_page.locator('input[type="password"]:visible')
            if pw.count() >= 1:
                pw.first.click()
                time.sleep(0.5)
                human_type(mail_page, tuta_pass_val)
                print('  -> Senha preenchida')
            time.sleep(1)

            # Entrar via JS
            mail_page.evaluate("""() => {
                const btns = document.querySelectorAll('button');
                for (const b of btns) {
                    const t = (b.textContent || '').toLowerCase();
                    if (b.offsetHeight > 0 && (t.includes('entrar') || t.includes('log in'))) {
                        b.click(); return true;
                    }
                }
                return false;
            }""")
            print('  -> Login enviado!')
            time.sleep(15)

            # Verificar inbox
            for w in range(10):
                try:
                    body = mail_page.evaluate("() => (document.body.textContent || '').toLowerCase()")
                    if 'entrada' in body or 'inbox' in body:
                        mail_logged_in = True
                        print('  -> Tutanota inbox OK!')
                        break
                except:
                    pass
                time.sleep(2)

            if not mail_logged_in:
                print('  -> AVISO: Tutanota pode nao ter logado, mas continuando...')

            # === Cache de codigos ja vistos (evita usar codigos antigos) ===
            # Ao inves de deletar (que causa logout), vamos salvar os codigos
            # existentes ANTES do Instagram enviar o novo. Qualquer codigo novo
            # que aparecer depois = eh o novo que deve ser usado.
            seen_codes = set()
            if mail_logged_in:
                try:
                    time.sleep(2)
                    existing = mail_page.evaluate(r"""() => {
                        const t = document.body.innerText || '';
                        const matches = t.match(/(\d{6})\s+is\s+your\s+Instagram\s+code/gi) || [];
                        return matches.map(m => (m.match(/(\d{6})/) || [])[1]).filter(Boolean);
                    }""")
                    for c in (existing or []):
                        seen_codes.add(c)
                    print('  -> Codigos Instagram ja existentes no inbox: ' + str(len(seen_codes)))
                    if seen_codes:
                        print('  -> (serao IGNORADOS) ' + ', '.join(list(seen_codes)[:5]))
                except Exception as e:
                    print('  -> Erro cache codigos (ignorado): ' + str(e)[:80])

            # NAO reconectar VPN — Instagram funciona melhor com IP real
            print('  -> VPN permanece desligado para Instagram (IP real)')
        except Exception as e:
            print('  -> Erro login Tutanota: ' + str(e))

        # === Agora abrir Instagram (SEM VPN — IP real) ===
        page = context.new_page()
        page.set_default_timeout(20000)

        # === PASSO 1.5: Aquecer sessao — navegar em sites normais primeiro ===
        print('[1.5/8] Aquecendo sessao (simular humano)...')
        update_status(2, 'Aquecendo sessao...')
        try:
            page.goto('https://www.google.com', timeout=15000)
            time.sleep(random.uniform(3, 5))
            # Scroll aleatorio
            page.mouse.wheel(0, random.randint(100, 400))
            time.sleep(random.uniform(2, 4))
        except:
            pass

        # === PASSO 2: Navegar para Instagram via home (mais natural) ===
        update_status(2, 'Abrindo Instagram...')
        print('[2/8] Abrindo Instagram home...')
        try:
            page.goto('https://www.instagram.com/', timeout=30000)
            page.wait_for_load_state('domcontentloaded')
            time.sleep(random.uniform(4, 7))
            # Scroll para parecer humano
            page.mouse.wheel(0, random.randint(200, 500))
            time.sleep(random.uniform(2, 4))
        except:
            pass

        # Agora sim ir para signup
        print('[2/8] Navegando para signup...')
        safe_goto_ig(page, 'https://www.instagram.com/accounts/emailsignup/', label='signup')
        page.wait_for_load_state('domcontentloaded')
        time.sleep(random.uniform(5, 8))

        # Aceitar cookies se aparecer
        try:
            cookies = page.locator('button:has-text("Permitir"), button:has-text("Allow"), button:has-text("Accept")')
            if cookies.first.is_visible(timeout=3000):
                cookies.first.click()
                time.sleep(2)
        except:
            pass

        # === PASSO 2.5: Data de nascimento ===
        # Instagram agora mostra nascimento NA MESMA TELA que email/nome/senha
        # Preencher aqui ANTES dos outros campos (esta no topo da tela)
        print('  -> Preenchendo data de nascimento...')
        try:
            meses_pt = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
            comboboxes = page.locator('[role="combobox"]:visible')
            cb_count = comboboxes.count()

            if cb_count >= 3:
                print('  -> Comboboxes encontrados: ' + str(cb_count))
                update_status(2, 'Preenchendo data de nascimento...')
                mes_nome = meses_pt[int(birth_month)] if int(birth_month) <= 12 else 'Janeiro'

                # Debug: mostrar texto de cada combobox
                birth_cbs = []
                for idx in range(cb_count):
                    text = (comboboxes.nth(idx).text_content() or '').strip()[:20]
                    print('  -> CB[' + str(idx) + ']: "' + text + '"')
                    birth_cbs.append(text.lower())

                # Filtrar comboboxes de nascimento (excluir idioma/outros)
                # Idioma geralmente tem texto longo ou "Portugues", "English", etc
                dia_idx = mes_idx = ano_idx = -1
                for idx, text in enumerate(birth_cbs):
                    if 'dia' in text or 'day' in text or text.isdigit():
                        if dia_idx == -1:
                            dia_idx = idx
                    elif any(m in text for m in ['mês', 'mes', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro', 'month']):
                        mes_idx = idx
                    elif 'ano' in text or 'year' in text or (len(text) == 4 and text.isdigit()):
                        ano_idx = idx

                # Fallback posicional se nao detectou
                if dia_idx == -1 or mes_idx == -1 or ano_idx == -1:
                    print('  -> Usando posicao: primeiro 3 comboboxes')
                    dia_idx, mes_idx, ano_idx = 0, 1, 2

                print('  -> Indices: Dia=' + str(dia_idx) + ' Mes=' + str(mes_idx) + ' Ano=' + str(ano_idx))

                def click_combobox_option(cb_idx, val):
                    """Clica combobox e seleciona opcao."""
                    try:
                        comboboxes.nth(cb_idx).click(force=True)
                        time.sleep(1.5)
                        opts = page.locator('[role="option"]')
                        for oi in range(opts.count()):
                            opt = opts.nth(oi)
                            if opt.is_visible(timeout=300):
                                opt_text = (opt.text_content() or '').strip()
                                if opt_text == val:
                                    opt.click()
                                    print('  -> OK: ' + val)
                                    return True
                        # Fallback
                        opt = page.locator('[role="option"]:has-text("' + val + '")').first
                        if opt.is_visible(timeout=1000):
                            opt.click()
                            print('  -> OK (fallback): ' + val)
                            return True
                        page.keyboard.press('Escape')
                        return False
                    except:
                        page.keyboard.press('Escape')
                        return False

                click_combobox_option(dia_idx, birth_day)
                time.sleep(random.uniform(0.5, 1))
                click_combobox_option(mes_idx, mes_nome)
                time.sleep(random.uniform(0.5, 1))
                click_combobox_option(ano_idx, birth_year)
                time.sleep(random.uniform(0.5, 1))
                print('  -> Nascimento: ' + birth_day + '/' + birth_month + '/' + birth_year)
            else:
                print('  -> Sem comboboxes de nascimento (' + str(cb_count) + ')')
        except Exception as e:
            print('  -> Erro nascimento: ' + str(e))

        time.sleep(random.uniform(1, 2))

        # === PASSO 3: Preencher email ===
        update_status(3, 'Preenchendo email: ' + email)
        print('[3/8] Preenchendo email: ' + email)
        try:
            # Email é o 1o input visivel (pode ser emailOrPhone ou genérico)
            email_selectors = [
                'input[name="emailOrPhone"]',
                'input[aria-label*="email" i]',
                'input[aria-label*="Email" i]',
                'input[aria-label*="celular" i]',
                'input[aria-label*="phone" i]',
            ]
            filled = False
            for sel in email_selectors:
                try:
                    el = page.locator(sel).first
                    if el.is_visible(timeout=2000):
                        filled = react_fill(page, sel, email)
                        if filled:
                            print('  -> Email preenchido! (' + sel + ')')
                            break
                except:
                    continue

            if not filled:
                # Fallback: 1o input[type=text] visível
                page.locator('input[type="text"]').first.click()
                time.sleep(0.5)
                human_type(page, email)
                print('  -> Email preenchido (fallback 1o input)!')
        except Exception as e:
            print('  -> ERRO email: ' + str(e))

        time.sleep(random.uniform(2.5, 4.5))

        # === PASSO 4: Preencher nome completo ===
        update_status(4, 'Preenchendo nome: ' + full_name)
        print('[4/8] Preenchendo nome: ' + full_name)
        try:
            name_selectors = [
                'input[name="fullName"]',
                'input[aria-label="Nome completo" i]',
                'input[aria-label="Full Name" i]',
                'input[placeholder="Nome completo" i]',
                'input[placeholder="Full name" i]',
                'input[aria-label="Nome" i]',
            ]
            filled = False
            for sel in name_selectors:
                try:
                    el = page.locator(sel).first
                    if el.is_visible(timeout=2000):
                        # Verificar que nao e o campo de username
                        aria = el.get_attribute('aria-label') or ''
                        if 'usu' in aria.lower() or 'user' in aria.lower():
                            continue
                        filled = react_fill(page, sel, full_name)
                        if filled:
                            print('  -> Nome preenchido! (' + sel + ')')
                            break
                except:
                    continue

            if not filled:
                # Fallback: procurar input com placeholder "Nome completo"
                inputs = page.locator('input:visible')
                for idx in range(inputs.count()):
                    inp = inputs.nth(idx)
                    ph = (inp.get_attribute('placeholder') or '').lower()
                    aria = (inp.get_attribute('aria-label') or '').lower()
                    if 'nome completo' in ph or 'full name' in ph or ('nome' in aria and 'usu' not in aria):
                        inp.click()
                        time.sleep(0.5)
                        page.keyboard.press('Control+a')
                        page.keyboard.press('Backspace')
                        time.sleep(0.3)
                        human_type(page, full_name)
                        filled = True
                        print('  -> Nome preenchido (fallback scan)!')
                        break
        except Exception as e:
            print('  -> ERRO nome: ' + str(e))

        time.sleep(random.uniform(2.5, 4.5))

        # === PASSO 5: Preencher username ===
        update_status(5, 'Preenchendo username: ' + username)
        print('[5/8] Preenchendo username: ' + username)
        try:
            username_selectors = [
                'input[name="username"]',
                'input[aria-label="Username"]',
                'input[aria-label*="usu\u00e1rio" i]',
                'input[aria-label*="Nome de usu" i]',
            ]
            filled = False
            for sel in username_selectors:
                try:
                    el = page.locator(sel).first
                    if el.is_visible(timeout=2000):
                        filled = react_fill(page, sel, username)
                        if filled:
                            print('  -> Username preenchido! (' + sel + ')')
                            break
                except:
                    continue

            if not filled:
                # Fallback: input tipo search (Instagram usa type=search pro username)
                search_input = page.locator('input[type="search"]').first
                if search_input.is_visible(timeout=2000):
                    search_input.click()
                    time.sleep(0.5)
                    human_type(page, username)
                    print('  -> Username preenchido (fallback search)!')
        except Exception as e:
            print('  -> ERRO username: ' + str(e))

        time.sleep(random.uniform(2.5, 4.5))

        # === PASSO 6: Preencher senha ===
        update_status(6, 'Preenchendo senha...')
        print('[6/8] Preenchendo senha...')
        try:
            pw_selectors = [
                'input[name="password"]',
                'input[type="password"]',
                'input[aria-label*="Senha" i]',
                'input[aria-label*="Password" i]',
            ]
            filled = False
            for sel in pw_selectors:
                try:
                    el = page.locator(sel).first
                    if el.is_visible(timeout=2000):
                        filled = react_fill(page, sel, password)
                        if filled:
                            print('  -> Senha preenchida! (' + sel + ')')
                            break
                except:
                    continue
        except Exception as e:
            print('  -> ERRO senha: ' + str(e))

        time.sleep(random.uniform(1.5, 2.5))

        # === Pausa longa antes do submit (reduz deteccao de SMS) ===
        print('  -> Pausa pre-submit (parecer humano revisando o form)...')
        human_wiggle(page)
        time.sleep(random.uniform(3, 6))
        human_wiggle(page)

        # === PASSO 7: Clicar em Cadastre-se / Sign up ===
        update_status(7, 'Clicando em Cadastre-se...')
        print('[7/8] Clicando submit...')
        try:
            submit_selectors = [
                'button:has-text("Cadastre-se")',
                'button:has-text("Sign up")',
                'button:has-text("Enviar")',
                'button[type="submit"]',
                'div[role="button"]:has-text("Cadastre-se")',
                'div[role="button"]:has-text("Sign up")',
                'div[role="button"]:has-text("Enviar")',
                'div[role="button"]:has-text("Submit")',
            ]
            clicked = False
            for sel in submit_selectors:
                try:
                    btn = page.locator(sel).first
                    if btn.is_visible(timeout=2000):
                        btn.click()
                        clicked = True
                        print('  -> Submit clicado! (' + sel + ')')
                        break
                except:
                    continue

            if not clicked:
                print('  -> Submit nao encontrado, tentando Enter...')
                page.keyboard.press('Enter')
        except Exception as e:
            print('  -> ERRO submit: ' + str(e))

        time.sleep(5)

        # === PASSO 7.5: Data de nascimento pos-submit (se aparecer tela separada) ===
        print('  -> Verificando se nascimento aparece pos-submit...')
        try:
            # Verificar se tem tela separada de nascimento (layout antigo)
            selects = page.locator('select:visible')
            if selects.count() >= 3:
                meses_pt = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
                print('  -> Tela separada de nascimento (selects)!')
                for idx, val in [(0, birth_month), (1, birth_day), (2, birth_year)]:
                    try:
                        selects.nth(idx).select_option(value=val)
                    except:
                        pass
                    time.sleep(0.5)
                for nsel in ['button:has-text("Avan")', 'div[role="button"]:has-text("Avan")', 'button:has-text("Next")']:
                    try:
                        nb = page.locator(nsel).first
                        if nb.is_visible(timeout=2000):
                            nb.click()
                            break
                    except:
                        continue
                time.sleep(5)
            else:
                print('  -> Nascimento ja preenchido na tela principal')
        except:
            pass

        # === PASSO 8: Aguardar verificação ===
        update_status(8, 'Aguardando verificacao...')
        print('\n[8/8] Aguardando verificacao...')
        print('  -> mail_page esta ' + ('OK' if mail_page else 'NONE'))
        print('  -> mail_logged_in esta ' + str(mail_logged_in))

        # Se mail_page existe mas nao logou, tentar re-login
        if mail_page and not mail_logged_in:
            print('  -> Tentando re-login no Tutanota antes de prosseguir...')
            if tuta_relogin(mail_page):
                mail_logged_in = True
                print('  -> Re-login OK!')
            else:
                print('  -> Re-login falhou, bot vai ficar em modo manual')

        code_done = False
        conta_criada = False

        for i in range(300):  # 10 min
            time.sleep(3)
            try:
                url = page.url

                # === Sucesso: chegou no feed/home ===
                if any(x in url for x in ['/explore', '/accounts/onetap']) and '/signup' not in url and '/emailsignup' not in url:
                    try:
                        if page.locator('svg[aria-label="Home"], svg[aria-label="P\u00e1gina inicial"], a[href="/explore/"]').first.is_visible(timeout=2000):
                            print('  -> Conta criada! Feed detectado.')
                            conta_criada = True
                            break
                    except:
                        pass

                # === Detectar tela de codigo de email ===
                code_input = page.locator('input[name="email_confirmation_code"], input[aria-label*="digo" i], input[aria-label*="code" i], input[placeholder*="code" i], input[placeholder*="digo" i], input[name="code"], input[placeholder*="confirma" i]')
                code_visible = False
                try:
                    code_visible = code_input.first.is_visible(timeout=500)
                except:
                    pass
                # Fallback: detectar pelo texto na pagina
                if not code_visible:
                    try:
                        for kw in ['Insira o c', 'confirma', 'confirmation code', 'enviamos para']:
                            if page.locator('text=' + kw).first.is_visible(timeout=200):
                                code_visible = True
                                # Tentar encontrar qualquer input visivel
                                all_inputs = page.locator('input:visible')
                                if all_inputs.count() > 0:
                                    code_input = all_inputs.first
                                break
                    except:
                        pass

                # Log periodico para debug
                if i > 0 and i % 10 == 0 and not code_done:
                    print('  -> Loop ' + str(i) + ': url=' + url[:50] + ' code_visible=' + str(code_visible))

                if code_visible and not code_done:
                    # Log claro na 1a deteccao
                    if not getattr(create_account, '_code_search_started', False):
                        create_account._code_search_started = True
                        create_account._code_start_time = time.time()
                        print('\n' + '='*60)
                        print('  -> TELA DE CODIGO DETECTADA no Instagram')
                        print('  -> Iniciando busca agressiva no Tutanota...')
                        print('='*60)
                        update_status(8, 'Buscando codigo no Tutanota...')

                    # Buscar codigo no Tutanota
                    if mail_page and mail_logged_in:
                        attempt = i + 1
                        elapsed = int(time.time() - getattr(create_account, '_code_start_time', time.time()))

                        # Verificar se Tuta ainda esta logado (reload causa logout, nao fazer!)
                        if attempt % 5 == 0:
                            try:
                                if not tuta_is_logged_in(mail_page):
                                    print('  -> [' + str(elapsed) + 's] Tuta deslogou! Re-logando...')
                                    tuta_relogin(mail_page)
                                else:
                                    # Sem reload — apenas log de confirmacao
                                    print('  -> [' + str(elapsed) + 's] Tuta ainda logado, aguardando email...')
                            except Exception as e:
                                print('  -> Erro check login: ' + str(e)[:60])

                        try:
                            # ESTRATEGIA 1: Pega o PRIMEIRO email visivel da lista (sempre o mais recente)
                            # Tuta ordena por data desc — primeiro DOM element = mais novo
                            code_from_subject = mail_page.evaluate(r"""() => {
                                // Procurar todos os elementos com texto contendo "is your Instagram code"
                                // e selecionar o QUE ESTA MAIS NO TOPO na pagina (menor Y)
                                const candidates = [];
                                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                                let node;
                                while (node = walker.nextNode()) {
                                    const text = node.textContent || '';
                                    const m = text.match(/(\d{6})\s+is\s+your\s+Instagram\s+code/i);
                                    if (m && node.parentElement) {
                                        const rect = node.parentElement.getBoundingClientRect();
                                        if (rect.top >= 0 && rect.top < window.innerHeight + 500) {
                                            candidates.push({ code: m[1], top: rect.top, text: text.substring(0, 60) });
                                        }
                                    }
                                }
                                // Ordenar por top asc (mais no topo = mais recente)
                                candidates.sort((a, b) => a.top - b.top);
                                if (candidates.length > 0) {
                                    return { code: candidates[0].code, source: 'top-element', candidates: candidates.length };
                                }
                                // Fallback: regex no texto
                                const bodyText = document.body.innerText || '';
                                let m = bodyText.match(/(\d{6})\s+is\s+your\s+Instagram\s+code/i);
                                if (m) return { code: m[1], source: 'regex-flat', candidates: 0 };
                                m = bodyText.match(/Instagram[^0-9]{1,40}(\d{6})/i);
                                if (m) return { code: m[1], source: 'instagram-flex', candidates: 0 };
                                return null;
                            }""")

                            # Log detalhado a cada 5 tentativas
                            if attempt % 5 == 0:
                                debug_info = mail_page.evaluate(r"""() => {
                                    const body = (document.body.innerText || '').substring(0, 400);
                                    const hasInstagram = /instagram/i.test(body);
                                    const codes = (body.match(/\b\d{6}\b/g) || []).slice(0, 5);
                                    return { hasInstagram, codes, preview: body.substring(0, 150) };
                                }""")
                                try:
                                    safe_preview = str(debug_info.get('preview', ''))[:100].encode('ascii', 'replace').decode()
                                    print('  -> [' + str(elapsed) + 's] Tuta preview: ' + safe_preview)
                                    print('  -> Tem "instagram": ' + str(debug_info.get('hasInstagram', False)))
                                    print('  -> Codigos 6-digitos encontrados: ' + str(debug_info.get('codes', [])))
                                except:
                                    pass

                            if code_from_subject and code_from_subject.get('code'):
                                # Buscar TODOS os codigos e filtrar os ja vistos
                                all_codes = mail_page.evaluate(r"""() => {
                                    const t = document.body.innerText || '';
                                    const matches = t.match(/(\d{6})\s+is\s+your\s+Instagram\s+code/gi) || [];
                                    return matches.map(m => (m.match(/(\d{6})/) || [])[1]).filter(Boolean);
                                }""") or []

                                # Achar codigo NOVO (que nao estava antes)
                                new_codes = [c for c in all_codes if c not in seen_codes]

                                if new_codes:
                                    code = new_codes[0]  # primeiro codigo novo
                                    print('  -> *** CODIGO NOVO ENCONTRADO: ' + code + ' (ignorados: ' + str(len(seen_codes)) + ' antigos) ***')
                                    update_status(8, 'Codigo: ' + code + ' — preenchendo...')
                                    codes = [code]
                                    has_ig = True
                                else:
                                    # Todos os codigos encontrados ja estavam no inbox antes
                                    if attempt % 5 == 0:
                                        print('  -> [' + str(elapsed) + 's] Aguardando email novo... (' + str(len(all_codes)) + ' codigos vistos, todos antigos)')
                                    codes = []
                                    has_ig = False
                            else:
                                # ESTRATEGIA 2: clicar no email e ler conteudo
                                if attempt % 2 == 0:
                                    mail_page.evaluate(r"""() => {
                                        const selectors = [
                                            '.list-row', '[class*="list-row"]',
                                            'li[role="option"]', 'li[role="button"]',
                                            'div[role="row"]', 'div[role="button"]',
                                            'li', 'div[class*="row"]'
                                        ];
                                        for (const sel of selectors) {
                                            const items = document.querySelectorAll(sel);
                                            for (const item of items) {
                                                if (item.offsetHeight < 15 || item.offsetHeight > 150) continue;
                                                const text = (item.textContent || '').toLowerCase();
                                                if (text.includes('instagram') && /\d{6}/.test(text)) {
                                                    item.scrollIntoView({ block: 'center' });
                                                    item.click();
                                                    return 'clicked: ' + text.substring(0, 60);
                                                }
                                            }
                                        }
                                        return 'nenhum';
                                    }""")
                                    time.sleep(2)
                                    # Tentar regex novamente apos abrir email
                                    code_after = mail_page.evaluate(r"""() => {
                                        const t = document.body.innerText || '';
                                        let m = t.match(/(\d{6})\s+is\s+your\s+Instagram/i);
                                        if (m) return m[1];
                                        m = t.match(/Instagram[^0-9]{1,50}(\d{6})/i);
                                        if (m) return m[1];
                                        return null;
                                    }""")
                                    if code_after:
                                        codes = [code_after]
                                        has_ig = True
                                        print('  -> CODIGO ENCONTRADO apos abrir email: ' + code_after)
                                    else:
                                        codes = []
                                        has_ig = False
                                else:
                                    codes = []
                                    has_ig = False

                            if codes and has_ig:
                                code = codes[0]
                                print('  -> >>> PREENCHENDO codigo ' + code + ' no Instagram...')
                                update_status(8, 'Codigo: ' + code + ' — preenchendo...')

                                # Trazer aba Instagram para frente antes de preencher
                                try:
                                    page.bring_to_front()
                                    time.sleep(0.5)
                                except:
                                    pass

                                filled = False

                                # TENTATIVA 1: fill() direto (mais rapido e confiavel)
                                try:
                                    ci = code_input.first
                                    ci.fill(code, timeout=5000)
                                    print('  -> Codigo preenchido via fill()')
                                    filled = True
                                except Exception as e:
                                    print('  -> fill() falhou: ' + str(e)[:60])

                                # TENTATIVA 2: click forcado + type
                                if not filled:
                                    try:
                                        ci = code_input.first
                                        ci.click(force=True, timeout=5000)
                                        time.sleep(0.3)
                                        page.keyboard.press('Control+a')
                                        page.keyboard.press('Backspace')
                                        time.sleep(0.2)
                                        page.keyboard.type(code, delay=80)
                                        print('  -> Codigo preenchido via click forcado + type')
                                        filled = True
                                    except Exception as e:
                                        print('  -> click+type falhou: ' + str(e)[:60])

                                # TENTATIVA 3: JS direto (ignora overlays e pointer events)
                                if not filled:
                                    try:
                                        page.evaluate("""(code) => {
                                            const selectors = [
                                                'input[name="email_confirmation_code"]',
                                                'input[aria-label*="digo" i]',
                                                'input[aria-label*="code" i]',
                                                'input[placeholder*="digo" i]',
                                                'input[placeholder*="code" i]',
                                                'input[placeholder*="confirma" i]',
                                                'input[type="text"]:not([disabled])'
                                            ];
                                            for (const sel of selectors) {
                                                const inp = document.querySelector(sel);
                                                if (inp) {
                                                    inp.focus();
                                                    const nativeSetter = Object.getOwnPropertyDescriptor(
                                                        window.HTMLInputElement.prototype, 'value'
                                                    ).set;
                                                    nativeSetter.call(inp, code);
                                                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                                                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                                                    return sel;
                                                }
                                            }
                                            return null;
                                        }""", code)
                                        print('  -> Codigo preenchido via JS direto')
                                        filled = True
                                    except Exception as e:
                                        print('  -> JS direto falhou: ' + str(e)[:60])

                                if filled:
                                    time.sleep(1.2)
                                    # Clicar Continuar
                                    sent = False
                                    for bt in ['Continuar', 'Confirmar', 'Next', 'Confirm', 'Avancar', 'Avançar']:
                                        try:
                                            b = page.locator('button:has-text("' + bt + '"), div[role="button"]:has-text("' + bt + '")').first
                                            if b.is_visible(timeout=1500):
                                                b.click(force=True, timeout=3000)
                                                print('  -> >>> CODIGO ENVIADO com botao "' + bt + '"')
                                                sent = True
                                                break
                                        except:
                                            continue
                                    if not sent:
                                        page.keyboard.press('Enter')
                                        print('  -> Codigo enviado via Enter')
                                    code_done = True
                                    try:
                                        mail_page.close()
                                    except:
                                        pass
                                    time.sleep(5)
                                else:
                                    print('  -> FALHA TOTAL ao preencher. Tentando no proximo loop...')
                        except Exception as e:
                            print('  -> Erro busca Tuta: ' + str(e)[:80])

                # === Detectar tela de SMS/telefone (AUTOMATIZADO via receive-smss.com) ===
                if not getattr(create_account, '_sms_done', False):
                    try:
                        sms_input = page.locator('input[type="tel"], input[name="phone_number"], input[aria-label*="telefone" i], input[aria-label*="celular" i], input[aria-label*="phone" i]')
                        sms_visible = False
                        try:
                            sms_visible = sms_input.first.is_visible(timeout=400)
                        except:
                            pass

                        # Fallback: detectar por texto
                        if not sms_visible:
                            try:
                                for kw in ['nmero de celular', 'numero de celular', 'phone number', 'telefone', 'Adicione um n']:
                                    if page.locator('text=' + kw).first.is_visible(timeout=200):
                                        sms_visible = True
                                        break
                            except:
                                pass

                        if sms_visible and not getattr(create_account, '_sms_handler_running', False):
                            create_account._sms_handler_running = True
                            print('\n' + '='*60)
                            print('  *** TELA DE SMS DETECTADA ***')
                            print('='*60)

                            # Tentar CDP (sms24.me) primeiro, fallback receive-smss.com
                            cdp_browser, cdp_ctx = get_cdp_context(p)
                            numbers_list = []
                            is_sms24 = False

                            if cdp_ctx:
                                print('  -> [SMS] Usando sms24.me via CDP')
                                # Cascata de paises: CA (mais Instagram) > US > BR
                                # Todos usam +1 ou similar, Instagram aceita bem
                                country_priority = ['ca', 'us', 'br']
                                for try_country in country_priority:
                                    update_status(8, 'Buscando numero sms24.me (' + try_country.upper() + ')...')
                                    numbers_list = get_sms24_numbers(cdp_ctx, try_country)
                                    if numbers_list:
                                        print('  -> [SMS] Encontrou ' + str(len(numbers_list)) + ' numeros ativos em ' + try_country.upper())
                                        break
                                is_sms24 = True

                            if not numbers_list:
                                print('  -> [SMS] Fallback: receive-smss.com')
                                update_status(8, 'Buscando numero receive-smss...')
                                numbers_list = get_receive_smss_numbers(context)
                                is_sms24 = False

                            if not numbers_list:
                                print('  -> [SMS] Nenhum numero disponivel! Modo manual.')
                                update_status(8, 'ACAO: digite SMS manualmente')
                                create_account._sms_handler_running = False
                                create_account._sms_manual_fallback = True
                            else:
                                max_tries = min(7, len(numbers_list))
                                success = False

                                for try_idx in range(max_tries):
                                    num_info = numbers_list[try_idx]
                                    full_num = num_info['number']
                                    no_prefix = num_info['no_prefix']
                                    print('\n  ===== Tentativa ' + str(try_idx + 1) + '/' + str(max_tries) + ': ' + full_num + ' =====')
                                    update_status(8, 'SMS tentativa ' + str(try_idx + 1) + ': ' + full_num)

                                    sms_page = open_sms_number_page(
                                        num_info,
                                        cdp_context=cdp_ctx if is_sms24 else None,
                                        bot_context=context if not is_sms24 else None
                                    )
                                    if not sms_page:
                                        print('  -> [SMS] Nao conseguiu abrir pagina, pulando')
                                        continue

                                    existing_codes = get_existing_codes(sms_page, is_sms24)
                                    print('  -> [SMS] ' + str(len(existing_codes)) + ' codigos antigos ignorados')

                                    try:
                                        page.bring_to_front()
                                        time.sleep(0.5)
                                        try:
                                            sms_input.first.fill(no_prefix, timeout=4000)
                                            print('  -> [SMS] Numero preenchido')
                                        except:
                                            page.evaluate("""(num) => {
                                                const inp = document.querySelector('input[type="tel"], input[name="phone_number"], input[aria-label*="telefone" i]');
                                                if (inp) {
                                                    inp.focus();
                                                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                                                    setter.call(inp, num);
                                                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                                                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                                                }
                                            }""", no_prefix)
                                            print('  -> [SMS] Numero preenchido via JS')
                                        time.sleep(1.5)

                                        for bt in ['Enviar c', 'Send Code', 'Send', 'Enviar', 'Continuar', 'Next']:
                                            try:
                                                b = page.locator('button:has-text("' + bt + '"), div[role="button"]:has-text("' + bt + '")').first
                                                if b.is_visible(timeout=1500):
                                                    b.click(force=True, timeout=3000)
                                                    print('  -> [SMS] Clicou: "' + bt + '"')
                                                    break
                                            except:
                                                continue
                                        time.sleep(4)
                                    except Exception as e:
                                        print('  -> [SMS] Erro preencher: ' + str(e)[:80])
                                        continue

                                    # Checar rejeicao
                                    try:
                                        rejected = page.evaluate("""() => {
                                            const t = (document.body.innerText || '').toLowerCase();
                                            return t.includes('invalid') || t.includes('inválido') ||
                                                   t.includes('try another') || t.includes('não conseguimos');
                                        }""")
                                        if rejected:
                                            print('  -> [SMS] Instagram REJEITOU o numero, tentando proximo...')
                                            continue
                                    except:
                                        pass

                                    print('  -> [SMS] Aguardando SMS (90s max)...')
                                    sms_code = None
                                    poll_start = time.time()
                                    last_reload = 0
                                    resend_done = False
                                    while time.time() - poll_start < 90:
                                        try:
                                            elapsed_poll = int(time.time() - poll_start)
                                            # Reload sms_page a cada 12s
                                            if elapsed_poll - last_reload >= 12 and elapsed_poll > 5:
                                                last_reload = elapsed_poll
                                                try:
                                                    sms_page.reload()
                                                    time.sleep(3)
                                                except:
                                                    pass
                                            # Aos 40s, clicar "Não recebi o código" no Instagram para forcar reenvio
                                            if not resend_done and elapsed_poll >= 40:
                                                resend_done = True
                                                try:
                                                    page.bring_to_front()
                                                    time.sleep(0.5)
                                                    for resend_bt in ['N\u00e3o recebi', 'Didn', 'Resend', 'Reenviar', 'send another']:
                                                        try:
                                                            rb = page.locator('button:has-text("' + resend_bt + '"), div[role="button"]:has-text("' + resend_bt + '"), a:has-text("' + resend_bt + '")').first
                                                            if rb.is_visible(timeout=1000):
                                                                rb.click(force=True, timeout=2000)
                                                                print('  -> [SMS] Clicou resend: "' + resend_bt + '"')
                                                                break
                                                        except:
                                                            continue
                                                except:
                                                    pass
                                            sms_code = extract_instagram_code_from_page(sms_page, existing_codes, is_sms24)
                                            if sms_code:
                                                break
                                        except:
                                            pass
                                        time.sleep(4)

                                    if sms_code:
                                        page.bring_to_front()
                                        time.sleep(1)
                                        code_input2 = page.locator('input[type="text"][maxlength="6"], input[name*="code" i], input[aria-label*="digo" i], input[type="tel"]')
                                        try:
                                            code_input2.first.fill(sms_code, timeout=4000)
                                        except:
                                            page.evaluate("""(code) => {
                                                const inputs = document.querySelectorAll('input');
                                                for (const inp of inputs) {
                                                    if (inp.type === 'hidden' || inp.disabled || inp.offsetHeight === 0) continue;
                                                    inp.focus();
                                                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                                                    setter.call(inp, code);
                                                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                                                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                                                    return true;
                                                }
                                            }""", sms_code)
                                        time.sleep(1)
                                        for bt in ['Continuar', 'Next', 'Confirm', 'Avan', 'Confirmar']:
                                            try:
                                                b = page.locator('button:has-text("' + bt + '"), div[role="button"]:has-text("' + bt + '")').first
                                                if b.is_visible(timeout=1500):
                                                    b.click(force=True, timeout=3000)
                                                    print('  -> [SMS] >>> CODIGO ENVIADO com "' + bt + '"')
                                                    success = True
                                                    break
                                            except:
                                                continue
                                        if success:
                                            create_account._sms_done = True
                                            time.sleep(5)
                                            break
                                    else:
                                        print('  -> [SMS] Timeout, tentando proximo numero...')
                                        try:
                                            if not is_sms24:
                                                sms_page.close()
                                        except:
                                            pass

                                if not success:
                                    print('\n  -> [SMS] Todos os numeros falharam. Modo manual ativado.')
                                    update_status(8, 'ACAO: digite SMS manualmente')
                                    create_account._sms_manual_fallback = True
                                    create_account._sms_handler_running = False
                    except Exception as e:
                        print('  -> Erro SMS handler: ' + str(e)[:100])

                # === Pular telas opcionais (nao pular se SMS ativo) ===
                if not getattr(create_account, '_sms_detected', False) or getattr(create_account, '_sms_done', False):
                    try:
                        for txt in ['Skip', 'Pular', 'Not Now', 'Agora n\u00e3o']:
                            skip = page.locator('button:has-text("' + txt + '"), div[role="button"]:has-text("' + txt + '")')
                            if skip.first.is_visible(timeout=300):
                                skip.first.click()
                                print('  -> Pulou: ' + txt)
                                time.sleep(2)
                                break
                    except:
                        pass

            except:
                pass

        if conta_criada:
            update_status(8, 'Conta Instagram criada com sucesso!', done=True, success=True)
            print('\nSUCESSO! @' + username)
        else:
            update_status(8, 'Timeout — verifique o navegador.', done=True, error='timeout')
            print('\nTimeout.')

        # Garantir VPN reconectado antes de fechar
        try:
            reconnect_vpn()
        except:
            pass
        time.sleep(10)
        browser.close()

    return status


# CLI
if __name__ == '__main__':
    email = sys.argv[1] if len(sys.argv) > 1 else 'test@proton.me'
    password = sys.argv[2] if len(sys.argv) > 2 else 'Test@12345678'
    full_name = sys.argv[3] if len(sys.argv) > 3 else 'Test User'
    username = sys.argv[4] if len(sys.argv) > 4 else 'test.user.gv'
    birth_day = sys.argv[5] if len(sys.argv) > 5 else '15'
    birth_month = sys.argv[6] if len(sys.argv) > 6 else '6'
    birth_year = sys.argv[7] if len(sys.argv) > 7 else '2000'
    create_account(email, password, full_name, username, birth_day, birth_month, birth_year)
