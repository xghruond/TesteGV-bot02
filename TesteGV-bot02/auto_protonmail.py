"""
Bot: Criar conta ProtonMail automaticamente
Pode ser usado como CLI ou importado pelo server.py

CLI: python auto_protonmail.py <username> <password> <display_name>
Import: from auto_protonmail import create_account
"""
import sys
import time
import random
import functools
from playwright.sync_api import sync_playwright

# Forcar flush
print = functools.partial(print, flush=True)

# Status global (lido pelo server.py)
status = {
    'step': 0,
    'total': 7,
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
    for char in text:
        page.keyboard.type(char)
        time.sleep(random.uniform(0.06, 0.18))


def create_account(username, password, display_name):
    """Cria conta ProtonMail. Retorna dict com resultado."""
    status['email'] = username + '@proton.me'
    status['password'] = password

    with sync_playwright() as p:
        update_status(1, 'Abrindo navegador...')
        print('[1/7] Abrindo ProtonMail...')

        browser = p.chromium.launch(
            headless=False,
            executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',
            args=['--start-maximized', '--window-position=0,0', '--incognito']
        )
        context = browser.new_context(
            no_viewport=True,
            locale='pt-BR',
            timezone_id='America/Sao_Paulo'
        )
        # Limpar cookies/storage para evitar sessoes anteriores
        context.clear_cookies()
        page = context.new_page()
        page.set_default_timeout(30000)

        page.goto('https://account.proton.me/signup?plan=free', timeout=60000)
        page.wait_for_load_state('domcontentloaded')
        print('  -> Pagina carregada')
        time.sleep(10)

        # === Plano Free ===
        update_status(2, 'Selecionando plano Free...')
        print('[2/7] Selecionando plano Free...')

        # Clicar no radio/card do plano Free (tentar varios seletores)
        free_clicked = False
        free_selectors = [
            'label:has-text("Free")',
            'div:has-text("Free"):has-text("BRL 0")',
            'input[value="free"]',
            'button:has-text("Free")',
            'text=Gratuito para sempre',
            'text=Free >> ..',
        ]
        for sel in free_selectors:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=3000):
                    el.click()
                    free_clicked = True
                    print('  -> Plano Free clicado! (' + sel + ')')
                    time.sleep(3)
                    break
            except:
                continue

        if not free_clicked:
            # Fallback: clicar via JavaScript no primeiro card (Free)
            page.evaluate('''() => {
                const cards = document.querySelectorAll('[class*="card"], [class*="plan"]');
                for (const card of cards) {
                    if (card.textContent.includes('Free') || card.textContent.includes('BRL 0')) {
                        card.click();
                        return true;
                    }
                }
                // Tentar clicar no radio button do Free
                const radios = document.querySelectorAll('input[type="radio"]');
                if (radios.length > 0) { radios[0].click(); return true; }
                return false;
            }''')
            print('  -> Plano Free clicado via JS!')
            time.sleep(3)

        # Scroll forte ate o formulario
        print('  -> Scrollando ate o formulario...')
        for i in range(10):
            page.evaluate('window.scrollBy(0, 300)')
            time.sleep(0.3)
        time.sleep(2)

        # Verificar se o campo username esta visivel
        is_visible = page.evaluate('''() => {
            const el = document.querySelector('#username');
            if (!el) return 'NOT_FOUND';
            const rect = el.getBoundingClientRect();
            return { visible: rect.height > 0 && rect.top > 0 && rect.top < window.innerHeight, top: rect.top };
        }''')
        print('  -> Username visivel: ' + str(is_visible))

        # Se nao visivel, forcar scroll
        if isinstance(is_visible, dict) and not is_visible.get('visible', False):
            page.evaluate('''() => {
                const el = document.querySelector('#username');
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }''')
            time.sleep(2)

        # === Username ===
        update_status(3, 'Preenchendo username: ' + username)
        print('[3/7] Preenchendo username: ' + username)
        try:
            page.evaluate('''() => {
                const el = document.querySelector('#username');
                if (el) { el.scrollIntoView({ block: "center" }); el.focus(); el.click(); }
            }''')
            time.sleep(0.5)
            page.keyboard.press('Control+a')
            page.keyboard.press('Backspace')
            time.sleep(0.3)
            human_type(page, username)
            time.sleep(1)
            val = page.evaluate('document.querySelector("#username").value')
            if not val or val != username:
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
            print('  -> ERRO: ' + str(e))
            update_status(3, 'Erro no username: ' + str(e), done=True, error=str(e))
            time.sleep(300)
            browser.close()
            return

        time.sleep(random.uniform(1.5, 2.5))

        # === Senha ===
        update_status(4, 'Preenchendo senha...')
        print('[4/7] Preenchendo senha...')
        try:
            page.evaluate('''() => {
                const el = document.querySelector('#password');
                if (el) { el.scrollIntoView({ block: "center" }); el.focus(); el.click(); }
            }''')
            time.sleep(0.5)
            human_type(page, password)
            time.sleep(1.5)
            print('  -> Senha OK!')
        except Exception as e:
            print('  -> ERRO: ' + str(e))

        time.sleep(random.uniform(1.0, 2.0))

        # === Confirmar senha ===
        update_status(5, 'Confirmando senha...')
        print('[5/7] Confirmando senha...')
        try:
            time.sleep(2)
            pw_count = page.evaluate('document.querySelectorAll("input[type=password]").length')
            if pw_count >= 2:
                page.evaluate('''() => {
                    const fields = document.querySelectorAll('input[type="password"]');
                    if (fields.length >= 2) { fields[1].scrollIntoView({ block: "center" }); fields[1].focus(); fields[1].click(); }
                }''')
                time.sleep(0.5)
                human_type(page, password)
                print('  -> Senha confirmada!')
            else:
                rp = page.evaluate('!!document.querySelector("#repeat-password")')
                if rp:
                    page.evaluate('(() => { const e=document.querySelector("#repeat-password"); e.scrollIntoView({block:"center"}); e.focus(); e.click(); })()')
                    time.sleep(0.5)
                    human_type(page, password)
                    print('  -> Confirmada via #repeat-password!')
        except Exception as e:
            print('  -> Info: ' + str(e))

        time.sleep(random.uniform(1.5, 2.5))

        # === Submit ===
        update_status(6, 'Criando conta...')
        print('[6/7] Clicando submit...')
        try:
            page.evaluate('document.querySelector("button[type=submit]").click()')
            print('  -> Submit!')
        except Exception as e:
            print('  -> ERRO: ' + str(e))

        time.sleep(5)

        # === Fechar oferta Mail Plus ===
        print('  -> Verificando oferta Mail Plus...')
        for _ in range(10):
            try:
                nao = page.locator('text=Não, obrigado').first
                if nao.is_visible(timeout=2000):
                    nao.click()
                    print('  -> Clicou "Nao, obrigado"!')
                    time.sleep(3)
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

        # === Human Verification — email automatico via gv.verificacao ===
        VERIF_EMAIL = 'gv.verificacao@proton.me'
        VERIF_PASSWORD = 'GvVerif@2026!'

        print('  -> Verificando se pede Human Verification...')
        try:
            hv = page.locator('text=Human Verification')
            if hv.first.is_visible(timeout=5000):
                print('  -> Human Verification detectada!')
                update_status(7, 'Verificacao detectada! Resolvendo automaticamente...')

                # Clicar na aba E-mail
                try:
                    email_tab = page.locator('button:has-text("E-mail"), [role="tab"]:has-text("E-mail"), [role="tab"]:has-text("Email")')
                    if email_tab.first.is_visible(timeout=3000):
                        email_tab.first.click()
                        time.sleep(2)
                        print('  -> Aba E-mail selecionada!')
                except:
                    pass

                # Preencher email de verificacao
                try:
                    email_input = page.locator('input[type="email"], input[placeholder*="email" i], input[id*="email"]').first
                    if email_input.is_visible(timeout=5000):
                        email_input.click()
                        time.sleep(0.5)
                        page.keyboard.press('Control+a')
                        page.keyboard.press('Backspace')
                        time.sleep(0.3)
                        human_type(page, VERIF_EMAIL)
                        time.sleep(1)
                        print('  -> Email preenchido: ' + VERIF_EMAIL)

                        # Clicar "Obter codigo de verificacao"
                        send_btn = page.locator('button:has-text("Obter"), button:has-text("verificacao"), button:has-text("Get"), button:has-text("Send code")')
                        if send_btn.first.is_visible(timeout=3000):
                            send_btn.first.click()
                            print('  -> Codigo solicitado!')
                            update_status(7, 'Codigo enviado para ' + VERIF_EMAIL + '! Buscando...')
                            time.sleep(8)

                            # Abrir nova aba e fazer login no ProtonMail para buscar codigo
                            print('  -> Abrindo ProtonMail para buscar codigo...')
                            mail_page = context.new_page()
                            mail_page.goto('https://mail.proton.me/login', timeout=30000)
                            time.sleep(5)

                            # Login
                            try:
                                mail_page.locator('#username').fill(VERIF_EMAIL.split('@')[0])
                                time.sleep(1)
                                mail_page.locator('#password').fill(VERIF_PASSWORD)
                                time.sleep(1)
                                mail_page.locator('button[type="submit"]').first.click()
                                print('  -> Login enviado!')
                                time.sleep(10)
                            except Exception as e:
                                print('  -> Erro login: ' + str(e))

                            # Buscar email com codigo (tentar ate 15x)
                            code_found = False
                            for attempt in range(15):
                                update_status(7, 'Buscando codigo no email... tentativa ' + str(attempt + 1) + '/15')
                                try:
                                    # Procurar email do Proton na inbox
                                    mail_page.reload()
                                    time.sleep(5)

                                    # Clicar no email mais recente que contenha "verification" ou "code"
                                    email_items = mail_page.locator('[data-testid="message-item"], [data-shortcut-target="message-container"] div[role="button"]')
                                    count = email_items.count()
                                    print('  -> Emails encontrados: ' + str(count))

                                    for ei in range(min(count, 5)):
                                        try:
                                            item = email_items.nth(ei)
                                            item_text = item.text_content() or ''
                                            if any(kw in item_text.lower() for kw in ['verif', 'code', 'confirm', 'proton']):
                                                item.click()
                                                time.sleep(3)

                                                # Extrair codigo de 6 digitos do corpo do email
                                                import re
                                                body_text = mail_page.locator('[data-testid="message-content"], .message-content, article').first.text_content() or ''
                                                codes = re.findall(r'\b(\d{6})\b', body_text)
                                                if codes:
                                                    code = codes[0]
                                                    print('  -> CODIGO ENCONTRADO: ' + code)
                                                    update_status(7, 'Codigo encontrado: ' + code)

                                                    # Voltar pra aba principal e preencher codigo
                                                    page.bring_to_front()
                                                    time.sleep(1)

                                                    code_input = page.locator('input[id*="code" i], input[placeholder*="code" i], input[placeholder*="codigo" i]').first
                                                    if code_input.is_visible(timeout=5000):
                                                        code_input.click()
                                                        time.sleep(0.5)
                                                        human_type(page, code)
                                                        time.sleep(1)

                                                        # Clicar verificar
                                                        verify_btn = page.locator('button:has-text("Verif"), button:has-text("Confirm"), button[type="submit"]').first
                                                        if verify_btn.is_visible(timeout=3000):
                                                            verify_btn.click()
                                                            print('  -> Codigo enviado!')
                                                            time.sleep(5)

                                                    code_found = True
                                                    break
                                        except:
                                            continue

                                    if code_found:
                                        break
                                except Exception as e:
                                    print('  -> Tentativa ' + str(attempt + 1) + ': ' + str(e))

                                time.sleep(5)

                            # Fechar aba do mail
                            try:
                                mail_page.close()
                            except:
                                pass

                            if code_found:
                                print('  -> Verificacao concluida automaticamente!')
                                time.sleep(5)
                            else:
                                print('  -> Codigo nao encontrado. Resolva manualmente no navegador.')
                                update_status(7, 'Codigo nao encontrado. Resolva manualmente no navegador.')
                                # Aguardar usuario resolver
                                for _ in range(300):
                                    time.sleep(2)
                                    try:
                                        if not hv.first.is_visible(timeout=1000):
                                            print('  -> Verificacao concluida!')
                                            time.sleep(3)
                                            break
                                    except:
                                        break
                except Exception as e:
                    print('  -> Erro na verificacao: ' + str(e))
                    update_status(7, 'Erro. Resolva manualmente no navegador.')
                    for _ in range(300):
                        time.sleep(2)
                        try:
                            if not hv.first.is_visible(timeout=1000):
                                break
                        except:
                            break
        except:
            print('  -> Sem Human Verification, continuando...')

        # === Aguardar CAPTCHA/verificacao ===
        update_status(7, 'Aguardando verificacao... Resolva no navegador se necessario!')
        print('\n[7/7] Aguardando verificacao...')

        conta_criada = False
        for i in range(300):  # 10 min
            time.sleep(2)
            try:
                url = page.url
                if any(x in url for x in ['mail.proton', 'welcome', 'inbox', 'setup', 'get-started']):
                    print('  -> Conta criada! URL: ' + url)
                    conta_criada = True
                    break

                # Display name
                try:
                    dn_exists = page.evaluate('!!document.querySelector("#displayName") && document.querySelector("#displayName").offsetHeight > 0')
                    if dn_exists:
                        page.evaluate('(() => { const e=document.querySelector("#displayName"); e.focus(); e.click(); })()')
                        time.sleep(0.5)
                        human_type(page, display_name)
                        print('  -> Nome: ' + display_name)
                        time.sleep(1)
                        page.evaluate('document.querySelector("button[type=submit]").click()')
                        time.sleep(3)
                        continue
                except:
                    pass

                # Skip / Nao obrigado
                try:
                    for txt in ['Skip', 'Pular', 'Maybe later', 'Talvez', 'obrigado']:
                        skip = page.locator('button:has-text("' + txt + '"), a:has-text("' + txt + '"), span:has-text("' + txt + '")')
                        if skip.first.is_visible(timeout=300):
                            skip.first.click()
                            print('  -> Pulou: ' + txt)
                            time.sleep(2)
                            break
                except:
                    pass

                # Sidebar = logado
                try:
                    if page.locator('[data-testid="sidebar"]').is_visible(timeout=300):
                        conta_criada = True
                        break
                except:
                    pass
            except:
                pass

        if conta_criada:
            update_status(7, 'Conta criada com sucesso!', done=True, success=True)
            print('\nSUCESSO! ' + username + '@proton.me')
        else:
            update_status(7, 'Timeout — verifique o navegador.', done=True, error='timeout')
            print('\nTimeout.')

        print('Navegador aberto por 5 min...')
        time.sleep(300)
        browser.close()

    return status


# CLI
if __name__ == '__main__':
    username = sys.argv[1] if len(sys.argv) > 1 else 'test.user'
    password = sys.argv[2] if len(sys.argv) > 2 else 'Test@12345678'
    display_name = sys.argv[3] if len(sys.argv) > 3 else 'Test User'
    create_account(username, password, display_name)
