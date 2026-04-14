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
import re
import functools
import subprocess
from playwright.sync_api import sync_playwright


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
        page.goto('https://www.instagram.com/accounts/emailsignup/', timeout=60000)
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

        mail_page = None
        mail_logged_in = False
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
                    # Tutanota ja esta logado (step 0) e VPN ja esta desligado
                    if not getattr(create_account, '_code_search_started', False):
                        create_account._code_search_started = True
                        print('  -> Tela de codigo detectada! Atualizando Tutanota...')
                        update_status(8, 'Buscando codigo no Tutanota...')
                        # Atualizar inbox do Tutanota
                        if mail_page:
                            try:
                                mail_page.reload()
                                time.sleep(5)
                                print('  -> Tutanota inbox atualizado')
                            except:
                                pass

                    # Buscar codigo no Tutanota
                    if mail_page and mail_logged_in:
                        attempt = i + 1
                        if attempt % 5 == 0:
                            print('  -> Buscando codigo... (' + str(attempt) + ')')
                            update_status(8, 'Buscando codigo no Tutanota...')

                        try:
                            # Atualizar inbox: reload a cada 8 tentativas
                            if attempt > 1 and attempt % 8 == 0:
                                mail_page.reload()
                                time.sleep(6)

                            # PASSO 1: Clicar no email do Instagram na lista
                            clicked_email = mail_page.evaluate("""() => {
                                // Buscar items clicaveis na lista de emails
                                const items = document.querySelectorAll('div[role="button"], li, [class*="row"], [class*="list-row"]');
                                for (const item of items) {
                                    if (item.offsetHeight > 15 && item.offsetHeight < 120) {
                                        const text = (item.textContent || '').toLowerCase();
                                        if (text.includes('instagram') || text.includes('your') || text.includes('code') || text.includes('confirm')) {
                                            item.click();
                                            return 'clicked: ' + text.substring(0, 40);
                                        }
                                    }
                                }
                                // Fallback: clicar primeiro item que parece email
                                for (const item of items) {
                                    if (item.offsetHeight > 30 && item.offsetHeight < 100 && item.textContent.length > 10) {
                                        item.click();
                                        return 'fallback: ' + item.textContent.substring(0, 30);
                                    }
                                }
                                return 'nenhum';
                            }""")

                            if attempt % 5 == 0:
                                try:
                                    print('  -> Click email: ' + str(clicked_email).encode('ascii', 'replace').decode()[:60])
                                except:
                                    pass

                            # PASSO 2: Esperar painel de detalhes carregar
                            time.sleep(3)

                            # PASSO 3: Ler texto COMPLETO da pagina (agora com email aberto)
                            full_text = mail_page.evaluate("() => document.body.textContent || ''")
                            full_lower = full_text.lower()
                            codes = re.findall(r'\b(\d{6})\b', full_text)

                            # Debug a cada 10 tentativas
                            if attempt % 10 == 0:
                                try:
                                    safe = full_text[:200].encode('ascii', 'replace').decode().replace('\n', ' ')
                                    print('  -> Texto: ' + safe[:100])
                                    print('  -> Codigos: ' + str(codes[:5]))
                                except:
                                    pass

                            has_ig = 'instagram' in full_lower or 'confirm' in full_lower or 'code' in full_lower or 'your' in full_lower

                            if codes and has_ig:
                                code = codes[0]
                                print('  -> CODIGO ENCONTRADO: ' + code)
                                update_status(8, 'Codigo: ' + code + ' — preenchendo...')

                                # Preencher codigo no Instagram
                                ci = code_input.first
                                if ci.is_visible(timeout=3000):
                                    ci.click()
                                    time.sleep(0.5)
                                    page.keyboard.press('Control+a')
                                    page.keyboard.press('Backspace')
                                    time.sleep(0.3)
                                    human_type(page, code)
                                    time.sleep(1)
                                    # Clicar Continuar
                                    for bt in ['Continuar', 'Next', 'Confirm', 'Avan']:
                                        try:
                                            b = page.locator('button:has-text("' + bt + '"), div[role="button"]:has-text("' + bt + '")').first
                                            if b.is_visible(timeout=2000):
                                                b.click()
                                                print('  -> Codigo enviado!')
                                                break
                                        except:
                                            continue
                                code_done = True
                                try:
                                    mail_page.close()
                                except:
                                    pass
                                # VPN permanece desligado — Instagram com IP real
                                time.sleep(5)
                        except:
                            pass

                # === Detectar tela de SMS/telefone ===
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

                        if sms_visible:
                            if not getattr(create_account, '_sms_detected', False):
                                create_account._sms_detected = True
                                create_account._sms_start_time = time.time()
                                # Capturar valor inicial do input (pode ja ter algo digitado)
                                try:
                                    create_account._sms_initial_len = len(sms_input.first.input_value() or '')
                                except:
                                    create_account._sms_initial_len = 0
                                print('\n  *** SMS NECESSARIO! ***')
                                print('  *** Pegue o SMS no seu celular e digite o codigo NO INSTAGRAM ***')
                                update_status(8, 'ACAO NECESSARIA: Digite o codigo SMS no Instagram — aguardando 10min')

                            # Verificar se usuario digitou codigo
                            try:
                                current_val = sms_input.first.input_value() or ''
                            except:
                                current_val = ''

                            if len(current_val) >= 6 and len(current_val) > create_account._sms_initial_len:
                                print('  -> Codigo SMS digitado pelo usuario! Clicando Continuar...')
                                time.sleep(2)  # Dar tempo de terminar de digitar
                                for bt in ['Continuar', 'Next', 'Confirm', 'Avan', 'Enviar']:
                                    try:
                                        b = page.locator('button:has-text("' + bt + '"), div[role="button"]:has-text("' + bt + '")').first
                                        if b.is_visible(timeout=2000):
                                            b.click()
                                            print('  -> Clicou: ' + bt)
                                            break
                                    except:
                                        continue
                                create_account._sms_done = True
                                time.sleep(5)

                            # Status com countdown
                            elapsed = int(time.time() - create_account._sms_start_time)
                            mm = elapsed // 60
                            ss = elapsed % 60
                            if elapsed % 10 == 0:
                                update_status(8, 'ACAO NECESSARIA: Digite codigo SMS no Instagram (' + str(mm).zfill(2) + ':' + str(ss).zfill(2) + '/10:00)')

                            # Timeout 10 min
                            if elapsed > 600:
                                print('  -> Timeout SMS (10min) — usuario nao respondeu')
                                update_status(8, 'Timeout SMS', done=True, error='sms_timeout')
                                break
                    except:
                        pass

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
