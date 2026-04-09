"""
Bot: Criar conta ProtonMail (semi-automatico)
Preenche formulario automaticamente, pausa para humano resolver CAPTCHA.

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


def create_account(username, password, display_name):
    """Cria conta ProtonMail (semi-automatico).
    Preenche tudo, pausa no CAPTCHA para humano resolver."""
    status['email'] = username + '@proton.me'
    status['password'] = password

    with sync_playwright() as p:
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

        # === Plano Free ===
        update_status(2, 'Selecionando plano Free...')
        print('[2/6] Selecionando plano Free...')

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
                    time.sleep(random.uniform(2, 4))
                    break
            except:
                continue

        if not free_clicked:
            page.evaluate('''() => {
                const cards = document.querySelectorAll('[class*="card"], [class*="plan"]');
                for (const card of cards) {
                    if (card.textContent.includes('Free') || card.textContent.includes('BRL 0')) {
                        card.click();
                        return true;
                    }
                }
                const radios = document.querySelectorAll('input[type="radio"]');
                if (radios.length > 0) { radios[0].click(); return true; }
                return false;
            }''')
            print('  -> Plano Free clicado via JS!')
            time.sleep(random.uniform(2, 4))

        # Scroll ate o formulario
        print('  -> Scrollando ate o formulario...')
        for i in range(10):
            page.evaluate('window.scrollBy(0, 300)')
            time.sleep(random.uniform(0.2, 0.5))
        time.sleep(random.uniform(1.5, 3))

        # Verificar campo username
        is_visible = page.evaluate('''() => {
            const el = document.querySelector('#username');
            if (!el) return 'NOT_FOUND';
            const rect = el.getBoundingClientRect();
            return { visible: rect.height > 0 && rect.top > 0 && rect.top < window.innerHeight, top: rect.top };
        }''')
        print('  -> Username visivel: ' + str(is_visible))

        if isinstance(is_visible, dict) and not is_visible.get('visible', False):
            page.evaluate('''() => {
                const el = document.querySelector('#username');
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }''')
            time.sleep(2)

        # === Username ===
        update_status(3, 'Preenchendo username: ' + username)
        print('[3/6] Preenchendo username: ' + username)
        try:
            page.evaluate('''() => {
                const el = document.querySelector('#username');
                if (el) { el.scrollIntoView({ block: "center" }); el.focus(); el.click(); }
            }''')
            time.sleep(random.uniform(0.5, 1.0))
            page.keyboard.press('Control+a')
            page.keyboard.press('Backspace')
            time.sleep(0.3)
            human_type(page, username)
            time.sleep(1)
            val = page.evaluate('document.querySelector("#username").value')
            if not val or val != username:
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
            return status

        time.sleep(random.uniform(2, 4))

        # === Senha ===
        update_status(4, 'Preenchendo senha...')
        print('[4/6] Preenchendo senha...')
        try:
            page.evaluate('''() => {
                const el = document.querySelector('#password');
                if (el) { el.scrollIntoView({ block: "center" }); el.focus(); el.click(); }
            }''')
            time.sleep(random.uniform(0.5, 1.0))
            human_type(page, password)
            time.sleep(random.uniform(1, 2))
            print('  -> Senha OK!')
        except Exception as e:
            print('  -> ERRO: ' + str(e))

        time.sleep(random.uniform(1.5, 3))

        # === Confirmar senha ===
        print('  -> Confirmando senha...')
        try:
            time.sleep(2)
            pw_count = page.evaluate('document.querySelectorAll("input[type=password]").length')
            if pw_count >= 2:
                page.evaluate('''() => {
                    const fields = document.querySelectorAll('input[type="password"]');
                    if (fields.length >= 2) { fields[1].scrollIntoView({ block: "center" }); fields[1].focus(); fields[1].click(); }
                }''')
                time.sleep(random.uniform(0.5, 1.0))
                human_type(page, password)
                print('  -> Senha confirmada!')
            else:
                rp = page.evaluate('!!document.querySelector("#repeat-password")')
                if rp:
                    page.evaluate('(() => { const e=document.querySelector("#repeat-password"); e.scrollIntoView({block:"center"}); e.focus(); e.click(); })()')
                    time.sleep(random.uniform(0.5, 1.0))
                    human_type(page, password)
                    print('  -> Confirmada via #repeat-password!')
        except Exception as e:
            print('  -> Info: ' + str(e))

        time.sleep(random.uniform(2, 4))

        # === Submit ===
        update_status(5, 'Enviando formulario...')
        print('[5/6] Clicando submit...')
        try:
            page.evaluate('document.querySelector("button[type=submit]").click()')
            print('  -> Submit!')
        except Exception as e:
            print('  -> ERRO: ' + str(e))

        time.sleep(random.uniform(4, 6))

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

        # === Aguardar — CAPTCHA manual + deteccao de sucesso ===
        update_status(6, 'CAPTCHA/verificacao — resolva no navegador!')
        print('\n[6/6] Aguardando verificacao...')
        print('  *** RESOLVA O CAPTCHA/VERIFICACAO NO NAVEGADOR ***')
        print('  *** O bot vai detectar automaticamente quando concluir ***')

        conta_criada = False
        for i in range(600):  # 20 min de espera
            time.sleep(2)
            try:
                url = page.url

                # === Sucesso: chegou no inbox/welcome ===
                if any(x in url for x in ['mail.proton', 'welcome', 'inbox', 'setup', 'get-started']):
                    print('  -> Conta criada! URL: ' + url)
                    conta_criada = True
                    break

                # === Lembrete periodico para o humano ===
                if i > 0 and i % 15 == 0:
                    elapsed = (i * 2) // 60
                    update_status(6, 'Aguardando CAPTCHA... (' + str(elapsed) + ' min)')
                    print('  -> Ainda aguardando... (' + str(elapsed) + ' min)')

                # === Display name (pos-verificacao) ===
                try:
                    dn_exists = page.evaluate('!!document.querySelector("#displayName") && document.querySelector("#displayName").offsetHeight > 0')
                    if dn_exists:
                        print('  -> Campo displayName encontrado!')
                        page.evaluate('(() => { const e=document.querySelector("#displayName"); e.focus(); e.click(); })()')
                        time.sleep(random.uniform(0.5, 1.0))
                        human_type(page, display_name)
                        print('  -> Nome: ' + display_name)
                        time.sleep(random.uniform(1, 2))
                        page.evaluate('document.querySelector("button[type=submit]").click()')
                        time.sleep(3)
                        continue
                except:
                    pass

                # === Skip / Nao obrigado ===
                try:
                    for txt in ['Skip', 'Pular', 'Maybe later', 'Talvez', 'obrigado']:
                        skip = page.locator('button:has-text("' + txt + '"), a:has-text("' + txt + '"), span:has-text("' + txt + '")')
                        if skip.first.is_visible(timeout=300):
                            skip.first.click()
                            print('  -> Pulou: ' + txt)
                            time.sleep(random.uniform(1.5, 3))
                            break
                except:
                    pass

                # === Sidebar = logado ===
                try:
                    if page.locator('[data-testid="sidebar"]').is_visible(timeout=300):
                        conta_criada = True
                        break
                except:
                    pass
            except:
                pass

        if conta_criada:
            update_status(6, 'Conta criada com sucesso!', done=True, success=True)
            print('\n=== SUCESSO! ' + username + '@proton.me ===')
        else:
            update_status(6, 'Timeout (20 min) — verifique o navegador.', done=True, error='timeout')
            print('\nTimeout (20 min).')

        print('Navegador aberto por 5 min para conferencia...')
        time.sleep(300)
        browser.close()

    return status


# CLI
if __name__ == '__main__':
    username = sys.argv[1] if len(sys.argv) > 1 else 'test.user'
    password = sys.argv[2] if len(sys.argv) > 2 else 'Test@12345678'
    display_name = sys.argv[3] if len(sys.argv) > 3 else 'Test User'
    create_account(username, password, display_name)
