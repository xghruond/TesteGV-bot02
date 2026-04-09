"""
Bot: Criar conta ProtonMail (semi-automatico)
Preenche tudo automaticamente + resolve verificacao por email.
Humano so resolve CAPTCHA visual (hCaptcha) se aparecer.

CLI: python auto_protonmail.py <username> <password> <display_name>
Import: from auto_protonmail import create_account
"""
import sys
import time
import random
import re
import functools
from playwright.sync_api import sync_playwright

print = functools.partial(print, flush=True)

# Status global (lido pelo server.py via polling)
status = {
    'step': 0,
    'total': 6,
    'message': 'Aguardando...',
    'done': False,
    'success': False,
    'error': None,
    'email': '',
    'password': ''
}


def update_status(step, message, done=False, success=False, error=None):
    status['step'] = step
    status['message'] = message
    status['done'] = done
    status['success'] = success
    status['error'] = error


def human_type(page, text):
    """Digita como humano com velocidade variavel."""
    for char in text:
        page.keyboard.type(char)
        time.sleep(random.uniform(0.08, 0.22))
    time.sleep(random.uniform(0.3, 0.8))


def clear_and_type(page, selector, text):
    """Limpa campo e digita texto humanizado."""
    page.evaluate('''(sel) => {
        const el = document.querySelector(sel);
        if (el) { el.scrollIntoView({ block: "center" }); el.focus(); el.click(); }
    }''', selector)
    time.sleep(random.uniform(0.4, 0.8))
    page.keyboard.press('Control+a')
    page.keyboard.press('Backspace')
    time.sleep(0.3)
    human_type(page, text)


# =====================================================
# TUTANOTA — login na conta existente para verificacao
# =====================================================

TUTA_EMAIL = 'teste.greenvillage@tutamail.com'
TUTA_PASS = 'Waxdwaxdw134679852'


def login_tutanota(browser):
    """Faz login no Tutanota existente. Retorna (email, tuta_page, tuta_ctx) ou None."""
    print('  -> [Tuta] Fazendo login: ' + TUTA_EMAIL)
    update_status(6, 'Login no Tutanota...')

    try:
        tuta_ctx = browser.new_context(
            no_viewport=True,
            locale='pt-BR',
            timezone_id='America/Sao_Paulo'
        )
        tuta_page = tuta_ctx.new_page()
        tuta_page.set_default_timeout(30000)

        tuta_page.goto('https://app.tuta.com/login', timeout=60000)
        tuta_page.wait_for_load_state('domcontentloaded')
        time.sleep(random.uniform(4, 7))

        # Preencher email — clicar no campo e digitar
        print('  -> [Tuta] Preenchendo email...')
        try:
            # Clicar no campo de email (primeiro campo visivel)
            email_label = tuta_page.locator('text=Endere').first
            if email_label.is_visible(timeout=3000):
                box = email_label.bounding_box()
                if box:
                    tuta_page.mouse.click(box['x'] + 100, box['y'] + 10)
                    time.sleep(0.5)
            else:
                # Fallback: Tab para focar
                tuta_page.keyboard.press('Tab')
                time.sleep(0.5)
        except:
            tuta_page.keyboard.press('Tab')
            time.sleep(0.5)

        tuta_page.keyboard.press('Control+a')
        tuta_page.keyboard.press('Backspace')
        time.sleep(0.3)
        human_type(tuta_page, TUTA_EMAIL)
        time.sleep(random.uniform(1, 2))

        # Tab para senha
        print('  -> [Tuta] Preenchendo senha...')
        tuta_page.keyboard.press('Tab')
        time.sleep(0.5)
        human_type(tuta_page, TUTA_PASS)
        time.sleep(random.uniform(1, 2))

        # Clicar "Entrar" / "Log in"
        print('  -> [Tuta] Clicando Entrar...')
        login_clicked = False
        for txt in ['Entrar', 'Log in', 'Login', 'Sign in']:
            try:
                btn = tuta_page.locator('button:has-text("' + txt + '")').first
                if btn.is_visible(timeout=2000):
                    btn.click()
                    login_clicked = True
                    print('  -> [Tuta] Clicou: ' + txt)
                    break
            except:
                continue

        if not login_clicked:
            # Fallback: Enter
            tuta_page.keyboard.press('Enter')
            print('  -> [Tuta] Enter para login')

        # Aguardar inbox carregar
        print('  -> [Tuta] Aguardando inbox...')
        for attempt in range(30):
            time.sleep(2)
            try:
                url = tuta_page.url
                if '/mail' in url or '/inbox' in url:
                    print('  -> [Tuta] Inbox carregado! URL: ' + url)
                    break

                has_inbox = tuta_page.evaluate("""() => {
                    const body = document.body.textContent || '';
                    return body.includes('Entrada') || body.includes('Inbox') ||
                           body.includes('Novo e-mail') || body.includes('New email');
                }""")
                if has_inbox:
                    print('  -> [Tuta] Inbox detectado!')
                    break
            except:
                pass

            # Fechar dialogs se aparecer
            for txt in ['OK', 'Fechar', 'Close', 'Entendido', 'Got it']:
                try:
                    btn = tuta_page.locator('button:has-text("' + txt + '")').first
                    if btn.is_visible(timeout=500):
                        btn.click()
                        time.sleep(1)
                        break
                except:
                    continue

        print('  -> [Tuta] Login OK: ' + TUTA_EMAIL)
        update_status(6, 'Tutanota logado!')
        return TUTA_EMAIL, tuta_page, tuta_ctx

    except Exception as e:
        print('  -> [Tuta] ERRO login: ' + str(e))
        try:
            tuta_ctx.close()
        except:
            pass
        return None


def fetch_code_from_tutanota(tuta_page):
    """Busca codigo de verificacao do ProtonMail na inbox do Tutanota via DOM."""
    print('  -> [Tuta] Buscando codigo na inbox...')

    for attempt in range(30):
        update_status(6, 'Buscando codigo na inbox Tutanota... ' + str(attempt + 1) + '/30')
        print('  -> [Tuta] Tentativa ' + str(attempt + 1))

        try:
            # Recarregar inbox (clicar em Entrada/Inbox)
            try:
                inbox_btn = tuta_page.locator('text=Entrada, text=Inbox').first
                if inbox_btn.is_visible(timeout=1000):
                    inbox_btn.click()
                    time.sleep(2)
            except:
                pass

            # Procurar email do Proton na lista
            email_items = tuta_page.evaluate('''() => {
                const items = document.querySelectorAll('[class*="row"], [class*="list-row"], [class*="mail-row"], tr, li');
                const results = [];
                for (const item of items) {
                    const text = (item.textContent || '').toLowerCase();
                    if (text.includes('proton') || text.includes('verification') || text.includes('verify') || text.includes('code')) {
                        results.push({ index: results.length, text: text.substring(0, 100) });
                    }
                }
                return results;
            }''')

            if email_items and len(email_items) > 0:
                print('  -> [Tuta] Email encontrado: ' + email_items[0].get('text', '')[:60])

                # Clicar no email — tentar por texto
                try:
                    proton_mail = tuta_page.locator('text=Proton, text=proton, text=verification, text=Verification').first
                    if proton_mail.is_visible(timeout=2000):
                        proton_mail.click()
                        time.sleep(3)
                except:
                    pass

                # Extrair corpo do email
                body_text = tuta_page.evaluate('''() => {
                    // Pegar todo texto visivel da area de conteudo
                    const selectors = ['[class*="mail-body"]', '[class*="message-body"]', '[class*="content"]', 'article', '.tutanota-body', 'iframe'];
                    for (const sel of selectors) {
                        const el = document.querySelector(sel);
                        if (el && el.offsetHeight > 0) {
                            if (el.tagName === 'IFRAME') {
                                try { return el.contentDocument.body.textContent; } catch(e) {}
                            }
                            return el.textContent;
                        }
                    }
                    // Fallback: pegar texto da metade direita da tela (area de leitura)
                    const all = document.body.textContent || '';
                    return all;
                }''')

                if body_text:
                    codes = re.findall(r'\b(\d{6})\b', body_text)
                    if codes:
                        print('  -> [Tuta] CODIGO ENCONTRADO: ' + codes[0])
                        return codes[0]
                    print('  -> [Tuta] Email aberto mas sem codigo de 6 digitos')

        except Exception as e:
            print('  -> [Tuta] Erro: ' + str(e))

        time.sleep(4)

    print('  -> [Tuta] Codigo nao encontrado apos 30 tentativas')
    return None


def fill_code_in_page(page, code):
    """Preenche o codigo de verificacao no campo correto."""
    filled = page.evaluate('''(code) => {
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
            if (inp.offsetHeight > 0 && inp.type !== 'hidden' && inp.type !== 'password' && inp.type !== 'email') {
                const val = inp.value || '';
                const ph = (inp.placeholder || '').toLowerCase();
                if (val === '' || val === '123456' || ph.includes('code') || ph.includes('codigo') || ph.includes('verif')) {
                    inp.focus();
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    setter.call(inp, code);
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    return 'js';
                }
            }
        }
        return false;
    }''', code)

    if filled:
        print('  -> Codigo preenchido via JS!')
        return True

    # Fallback: digitar direto
    try:
        cinput = page.locator('input:not([type="email"]):not([type="password"]):not([type="hidden"])').last
        if cinput.is_visible(timeout=2000):
            cinput.click()
            page.keyboard.press('Control+a')
            page.keyboard.press('Backspace')
            human_type(page, code)
            print('  -> Codigo digitado via fallback!')
            return True
    except:
        pass
    return False


# =====================================================
# FLUXO PRINCIPAL
# =====================================================

def create_account(username, password, display_name):
    """Cria conta ProtonMail. Retorna dict status."""
    status['email'] = username + '@proton.me'
    status['password'] = password

    with sync_playwright() as p:
        # === STEP 1: Abrir navegador ===
        update_status(1, 'Abrindo navegador...')
        print('[1/6] Abrindo ProtonMail...')

        browser = p.chromium.launch(
            headless=False,
            executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',
            args=['--start-maximized', '--window-position=0,0']
        )
        context = browser.new_context(
            no_viewport=True,
            locale='pt-BR',
            timezone_id='America/Sao_Paulo'
        )
        context.clear_cookies()
        page = context.new_page()
        page.set_default_timeout(30000)

        page.goto('https://account.proton.me/signup?plan=free', timeout=60000)
        page.wait_for_load_state('domcontentloaded')
        print('  -> Pagina carregada')
        time.sleep(random.uniform(8, 12))

        # === STEP 2: Plano Free ===
        update_status(2, 'Selecionando plano Free...')
        print('[2/6] Selecionando plano Free...')

        free_selectors = [
            'label:has-text("Free")',
            'div:has-text("Free"):has-text("BRL 0")',
            'input[value="free"]',
            'button:has-text("Free")',
            'text=Gratuito para sempre',
        ]
        free_clicked = False
        for sel in free_selectors:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=3000):
                    el.click()
                    free_clicked = True
                    print('  -> Plano Free: ' + sel)
                    break
            except:
                continue

        if not free_clicked:
            page.evaluate('''() => {
                const cards = document.querySelectorAll('[class*="card"], [class*="plan"]');
                for (const c of cards) {
                    if (c.textContent.includes('Free') || c.textContent.includes('BRL 0')) {
                        c.click(); return true;
                    }
                }
                const r = document.querySelectorAll('input[type="radio"]');
                if (r.length > 0) { r[0].click(); return true; }
                return false;
            }''')
            print('  -> Plano Free via JS')

        time.sleep(random.uniform(2, 4))

        # Scroll ate formulario
        for _ in range(10):
            page.evaluate('window.scrollBy(0, 300)')
            time.sleep(random.uniform(0.2, 0.5))
        time.sleep(random.uniform(1.5, 3))

        # Garantir campo username visivel
        page.evaluate('''() => {
            const el = document.querySelector('#username');
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }''')
        time.sleep(2)

        # === STEP 3: Username ===
        update_status(3, 'Preenchendo username...')
        print('[3/6] Username: ' + username)
        try:
            clear_and_type(page, '#username', username)
            time.sleep(1)
            val = page.evaluate('document.querySelector("#username").value')
            if val != username:
                # React setter fallback
                page.evaluate('''(u) => {
                    const el = document.querySelector('#username');
                    if (!el) return;
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    setter.call(el, u);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }''', username)
                time.sleep(1)
            val = page.evaluate('document.querySelector("#username").value')
            print('  -> Username: "' + str(val) + '"')
        except Exception as e:
            print('  -> ERRO username: ' + str(e))
            update_status(3, 'Erro: ' + str(e), done=True, error=str(e))
            time.sleep(10)
            browser.close()
            return status

        time.sleep(random.uniform(2, 4))

        # === STEP 4: Senha ===
        update_status(4, 'Preenchendo senha...')
        print('[4/6] Senha...')
        try:
            clear_and_type(page, '#password', password)
            print('  -> Senha OK')
        except Exception as e:
            print('  -> ERRO senha: ' + str(e))

        time.sleep(random.uniform(1.5, 3))

        # Confirmar senha (se existir segundo campo)
        try:
            pw_count = page.evaluate('document.querySelectorAll("input[type=password]").length')
            if pw_count >= 2:
                page.evaluate('''() => {
                    const f = document.querySelectorAll('input[type="password"]');
                    if (f.length >= 2) { f[1].scrollIntoView({ block: "center" }); f[1].focus(); f[1].click(); }
                }''')
                time.sleep(random.uniform(0.5, 1))
                human_type(page, password)
                print('  -> Senha confirmada')
            elif page.evaluate('!!document.querySelector("#repeat-password")'):
                clear_and_type(page, '#repeat-password', password)
                print('  -> Senha confirmada (#repeat-password)')
        except Exception as e:
            print('  -> Confirmar senha: ' + str(e))

        time.sleep(random.uniform(2, 4))

        # === STEP 5: Submit ===
        update_status(5, 'Enviando formulario...')
        print('[5/6] Submit...')
        try:
            page.evaluate('document.querySelector("button[type=submit]").click()')
            print('  -> Submit OK')
        except Exception as e:
            print('  -> ERRO submit: ' + str(e))

        time.sleep(random.uniform(4, 6))

        # Fechar oferta Mail Plus
        for _ in range(8):
            try:
                for txt in ['Não, obrigado', 'No, thanks', 'No thanks']:
                    btn = page.locator('text=' + txt).first
                    if btn.is_visible(timeout=1500):
                        btn.click()
                        print('  -> Fechou oferta: ' + txt)
                        time.sleep(2)
                        break
            except:
                pass
            try:
                close = page.locator('button[aria-label="Close"]').first
                if close.is_visible(timeout=1000):
                    close.click()
                    time.sleep(2)
                    break
            except:
                pass
            time.sleep(1)

        # === STEP 6: Verificacao ===
        update_status(6, 'Verificando...')
        print('\n[6/6] Verificacao...')

        hv_done = False
        conta_criada = False

        for i in range(600):  # 20 min
            time.sleep(2)
            try:
                url = page.url

                # --- Sucesso ---
                if any(x in url for x in ['mail.proton', 'welcome', 'inbox', 'setup', 'get-started']):
                    print('  -> SUCESSO! URL: ' + url)
                    conta_criada = True
                    break

                # --- Sidebar = logado ---
                try:
                    if page.locator('[data-testid="sidebar"]').is_visible(timeout=300):
                        conta_criada = True
                        break
                except:
                    pass

                # --- Human Verification (email) ---
                if not hv_done:
                    try:
                        hv_visible = page.locator('text=Human Verification').first.is_visible(timeout=500)
                    except:
                        hv_visible = False

                    if hv_visible:
                        print('  -> Human Verification detectada!')
                        update_status(6, 'Verificando opcoes de verificacao...')

                        # Verificar se aba E-mail existe (IP pode estar banido)
                        email_tab_found = False
                        try:
                            for tab_text in ['E-mail', 'Email']:
                                tab = page.locator('button:has-text("' + tab_text + '"), [role="tab"]:has-text("' + tab_text + '")')
                                if tab.first.is_visible(timeout=3000):
                                    tab.first.click()
                                    email_tab_found = True
                                    print('  -> Aba E-mail encontrada!')
                                    time.sleep(random.uniform(1, 2))
                                    break
                        except:
                            pass

                        if not email_tab_found:
                            print('  -> SEM aba E-mail! IP restrito pelo ProtonMail.')
                            print('  -> Use VPN para trocar o IP e tente novamente.')
                            update_status(6, 'IP restrito — use VPN e tente novamente!')
                            hv_done = True
                            continue

                        # Aba E-mail existe — fazer login no Tutanota
                        update_status(6, 'Login no Tutanota...')
                        tuta_result = login_tutanota(browser)
                        tuta_ctx_ref = None

                        if tuta_result:
                            tuta_email, tuta_page, tuta_ctx_ref = tuta_result

                            # Voltar para pagina do ProtonMail
                            page.bring_to_front()
                            time.sleep(1)

                            # Preencher email Tutanota
                            try:
                                einput = page.locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="e-mail" i], input[placeholder*="Endereço" i]').first
                                if einput.is_visible(timeout=3000):
                                    einput.click()
                                    time.sleep(0.5)
                                    page.keyboard.press('Control+a')
                                    page.keyboard.press('Backspace')
                                    time.sleep(0.3)
                                    human_type(page, tuta_email)
                                    print('  -> Email preenchido: ' + tuta_email)
                                    time.sleep(random.uniform(1, 2))
                            except Exception as e:
                                print('  -> Erro preencher email: ' + str(e))

                            # Clicar "Obter codigo"
                            try:
                                time.sleep(1)
                                send_clicked = False
                                for btn_text in ['Obter', 'Get', 'Send', 'Enviar']:
                                    try:
                                        btn = page.locator('button:has-text("' + btn_text + '")').first
                                        if btn.is_visible(timeout=2000):
                                            btn.click()
                                            send_clicked = True
                                            print('  -> Botao clicado: ' + btn_text)
                                            break
                                    except:
                                        continue
                                if not send_clicked:
                                    page.evaluate('''() => {
                                        const btns = document.querySelectorAll('button');
                                        for (const b of btns) {
                                            const t = b.textContent.toLowerCase();
                                            if (b.offsetHeight > 0 && (t.includes('obter') || t.includes('código') || t.includes('codigo'))) {
                                                b.click(); return true;
                                            }
                                        }
                                        return false;
                                    }''')
                                    print('  -> Botao via JS')
                            except:
                                pass

                            # Verificar se dominio bloqueado
                            time.sleep(4)
                            blocked = False
                            try:
                                blocked = page.evaluate('''() => {
                                    const els = document.querySelectorAll('[class*="error"], [class*="notification"], [class*="alert"]');
                                    for (const el of els) {
                                        const t = el.textContent.toLowerCase();
                                        if (el.offsetHeight > 0 && (t.includes('disabled') || t.includes('blocked') || t.includes('try another'))) return true;
                                    }
                                    return false;
                                }''')
                            except:
                                pass

                            if blocked:
                                print('  -> Dominio @tutamail.com BLOQUEADO!')
                                update_status(6, 'Dominio bloqueado — resolva no navegador.')
                                try:
                                    tuta_ctx_ref.close()
                                except:
                                    pass
                            else:
                                # Dominio aceito — buscar codigo na inbox do Tutanota
                                update_status(6, 'Codigo solicitado! Buscando na inbox Tutanota...')
                                print('  -> Dominio aceito! Buscando codigo no Tutanota...')
                                time.sleep(6)

                                # Mudar para aba do Tutanota
                                tuta_page.bring_to_front()
                                time.sleep(2)

                                code = fetch_code_from_tutanota(tuta_page)
                                if code:
                                    # Voltar para ProtonMail e preencher codigo
                                    page.bring_to_front()
                                    time.sleep(1)

                                    print('  -> CODIGO: ' + code)
                                    update_status(6, 'Codigo: ' + code)
                                    fill_code_in_page(page, code)
                                    time.sleep(1)

                                    # Clicar verificar
                                    try:
                                        for vtext in ['Verificar', 'Verify', 'Confirmar', 'Confirm']:
                                            vb = page.locator('button:has-text("' + vtext + '")')
                                            if vb.first.is_visible(timeout=2000):
                                                vb.first.click()
                                                print('  -> Clicou: ' + vtext)
                                                break
                                        else:
                                            page.evaluate('document.querySelector("button[type=submit]")?.click()')
                                    except:
                                        pass
                                    time.sleep(5)
                                    print('  -> Verificacao resolvida via Tutanota!')
                                    update_status(6, 'Verificacao resolvida!')
                                else:
                                    print('  -> Codigo nao chegou na inbox Tutanota.')
                                    update_status(6, 'Codigo nao chegou — resolva no navegador.')
                                    page.bring_to_front()

                                # Fechar contexto Tutanota
                                try:
                                    tuta_ctx_ref.close()
                                except:
                                    pass
                        else:
                            print('  -> Falha ao criar conta Tutanota.')
                            update_status(6, 'Resolva a verificacao no navegador.')

                        hv_done = True

                # --- CAPTCHA visual (hCaptcha) ---
                try:
                    hcaptcha = page.locator('iframe[src*="hcaptcha"], iframe[src*="captcha"], [class*="captcha"]')
                    if hcaptcha.first.is_visible(timeout=300):
                        if i % 15 == 0:
                            mins = (i * 2) // 60
                            update_status(6, 'CAPTCHA visual — resolva no navegador! (' + str(mins) + ' min)')
                            print('  -> CAPTCHA visual — aguardando humano...')
                except:
                    pass

                # --- Display name (pos-verificacao) ---
                try:
                    dn = page.evaluate('!!document.querySelector("#displayName") && document.querySelector("#displayName").offsetHeight > 0')
                    if dn:
                        print('  -> Display name encontrado!')
                        clear_and_type(page, '#displayName', display_name)
                        print('  -> Nome: ' + display_name)
                        time.sleep(random.uniform(1, 2))
                        page.evaluate('document.querySelector("button[type=submit]").click()')
                        time.sleep(3)
                        continue
                except:
                    pass

                # --- Skip / Pular ---
                try:
                    for txt in ['Skip', 'Pular', 'Maybe later', 'Talvez', 'obrigado', 'No thanks']:
                        skip = page.locator('button:has-text("' + txt + '"), a:has-text("' + txt + '"), span:has-text("' + txt + '")')
                        if skip.first.is_visible(timeout=300):
                            skip.first.click()
                            print('  -> Pulou: ' + txt)
                            time.sleep(random.uniform(1.5, 3))
                            break
                except:
                    pass

                # --- Log periodico ---
                if i > 0 and i % 30 == 0:
                    mins = (i * 2) // 60
                    print('  -> Aguardando... (' + str(mins) + ' min)')

            except:
                pass

        # === RESULTADO ===
        if conta_criada:
            update_status(6, 'Conta criada com sucesso!', done=True, success=True)
            print('\n=== SUCESSO! ' + username + '@proton.me ===')
        else:
            update_status(6, 'Timeout (20 min).', done=True, error='timeout')
            print('\nTimeout (20 min).')

        print('Navegador aberto por 5 min...')
        time.sleep(10)
        browser.close()

    return status


# CLI
if __name__ == '__main__':
    username = sys.argv[1] if len(sys.argv) > 1 else 'test.user'
    password = sys.argv[2] if len(sys.argv) > 2 else 'Test@12345678'
    display_name = sys.argv[3] if len(sys.argv) > 3 else 'Test User'
    create_account(username, password, display_name)
