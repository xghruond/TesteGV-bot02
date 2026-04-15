"""
Bot: Criar conta Tutanota automaticamente via keyboard navigation.
Bypassa SVG overlays usando JS evaluate + Tab navigation.

CLI: python auto_tutanota.py [username] [password]
Import: from auto_tutanota import create_account, create_fresh_tutanota
"""
import sys
import time
import random
import functools
from playwright.sync_api import sync_playwright
try:
    from bot_utils import retry, log_event
except ImportError:
    def retry(op, **kw): return op()
    def log_event(*a, **k): pass

print = functools.partial(print, flush=True)

# Status global (lido pelo server.py via polling)
status = {
    'step': 0,
    'total': 5,
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
    level = 'error' if error else 'info'
    log_event('tutanota', level, message, step=step, extra={'done': done, 'success': success})


def safe_goto_tuta(page, url, label='goto'):
    return retry(lambda: page.goto(url, timeout=60000), tries=3, backoff=1.5,
                 label='tutanota.' + label, bot='tutanota')


def human_type(page, text):
    """Digita como humano."""
    for char in text:
        page.keyboard.type(char)
        time.sleep(random.uniform(0.08, 0.22))
    time.sleep(random.uniform(0.3, 0.8))


def safe_print(msg):
    """Print seguro para Windows (sem crash de encoding)."""
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode('ascii', 'replace').decode())


def get_active_info(page):
    """Retorna info do elemento focado."""
    try:
        return page.evaluate("""() => {
            const el = document.activeElement;
            if (!el) return {tag: 'none', type: '', role: ''};
            return {
                tag: el.tagName.toLowerCase(),
                type: el.type || '',
                role: el.getAttribute('role') || '',
                text: (el.textContent || '').substring(0, 30)
            };
        }""")
    except:
        return {'tag': 'unknown', 'type': '', 'role': ''}


def create_account(username, password):
    """Cria conta Tutanota standalone. Retorna status dict."""
    status['email'] = username + '@tutamail.com'
    status['password'] = password

    with sync_playwright() as p:
        update_status(1, 'Abrindo navegador...')
        print('[1/5] Abrindo Tutanota...')

        browser = p.chromium.launch(
            headless=False,
            executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',
            args=['--start-maximized', '--window-position=0,0']
        )
        context = browser.new_context(no_viewport=True, locale='pt-BR', timezone_id='America/Sao_Paulo')
        page = context.new_page()
        page.set_default_timeout(30000)

        result = _create_tutanota_on_page(page, username, password)

        if result:
            update_status(5, 'Conta criada com sucesso!', done=True, success=True)
            print('\n=== SUCESSO! ' + username + '@tutamail.com ===')
        else:
            update_status(5, 'Falha na criacao.', done=True, error='failed')
            print('\nFalha.')

        time.sleep(10)
        browser.close()

    return status


def create_fresh_tutanota(browser):
    """Cria conta Tutanota NOVA no mesmo browser.
    Retorna (email, password, tuta_page, tuta_ctx) ou None."""
    username = 'gvbot' + ''.join([str(random.randint(0, 9)) for _ in range(8)])
    password = 'Gv@' + ''.join([random.choice('abcdefghijklmnopqrstuvwxyz0123456789') for _ in range(12)])
    email = username + '@tutamail.com'

    print('  -> [Tuta] Criando conta nova: ' + email)

    try:
        # browser.new_page() usa contexto default — new_context customizado
        # causa problemas no Tutanota (formulario nao carrega)
        tuta_page = browser.new_page()
        tuta_page.set_default_timeout(30000)

        result = _create_tutanota_on_page(tuta_page, username, password)

        if result:
            print('  -> [Tuta] Conta criada: ' + email)
            return email, password, tuta_page, None
        else:
            print('  -> [Tuta] Falha ao criar conta')
            try:
                tuta_page.close()
            except:
                pass
            return None
    except Exception as e:
        safe_print('  -> [Tuta] ERRO: ' + str(e))
        return None


def _create_tutanota_on_page(page, username, password):
    """Logica interna de criacao de conta Tutanota via keyboard navigation.
    Retorna True se sucesso, False se falha."""

    safe_goto_tuta(page, 'https://app.tuta.com/signup', label='signup')
    page.wait_for_load_state('domcontentloaded')
    time.sleep(random.uniform(8, 12))

    # === STEP 2: Selecionar plano Free e ir ao formulario ===
    print('  -> [Tuta] Verificando se formulario ja esta visivel...')

    # Verificar se ja tem inputs visiveis (pode estar direto no formulario)
    has_inputs = page.locator('input[type="text"]').count() > 0

    if not has_inputs:
        # Precisa selecionar Free e clicar Continuar
        print('  -> [Tuta] Selecionando plano Free...')
        page.evaluate("""() => {
            const boxes = document.querySelectorAll('div[role="button"]');
            for (const box of boxes) {
                const text = box.textContent || '';
                if (box.offsetHeight > 0 && text.includes('Free') && text.includes('0')) {
                    box.click();
                    return true;
                }
            }
            return false;
        }""")
        time.sleep(random.uniform(3, 5))

        print('  -> [Tuta] Clicando Continuar...')
        page.evaluate("""() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
                const t = (b.textContent || '').toLowerCase();
                if (b.offsetHeight > 0 && (t.includes('continuar') || t.includes('continue') || t.includes('next'))) {
                    b.click();
                    return true;
                }
            }
            return false;
        }""")
        time.sleep(random.uniform(4, 6))
    else:
        print('  -> [Tuta] Formulario ja esta visivel, pulando selecao de plano')

    # === STEP 3: Preencher formulario via click direto nos inputs ===
    print('  -> [Tuta] Preenchendo formulario...')

    # Esperar formulario carregar (pode ter tela intermediaria)
    for wait in range(15):
        inputs = page.locator('input[type="text"]')
        if inputs.count() > 0 and inputs.first.is_visible(timeout=1000):
            print('  -> [Tuta] Formulario carregado!')
            break
        # Pode ter botao "Uso pessoal" ou similar
        page.evaluate("""() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
                const t = (b.textContent || '').toLowerCase();
                if (b.offsetHeight > 0 && (t.includes('pessoal') || t.includes('personal') || t.includes('continuar') || t.includes('continue'))) {
                    b.click(); return true;
                }
            }
            return false;
        }""")
        safe_print('  -> [Tuta] Aguardando formulario... (' + str(wait + 1) + ')')
        time.sleep(2)

    # Username — clicar no input[type=text] e digitar
    try:
        username_input = page.locator('input[type="text"]').first
        if username_input.is_visible(timeout=5000):
            username_input.click()
            time.sleep(0.5)
            page.keyboard.press('Control+a')
            page.keyboard.press('Backspace')
            time.sleep(0.3)
            human_type(page, username)
            print('  -> [Tuta] Username: ' + username)
        else:
            print('  -> [Tuta] ERRO: campo username nao encontrado!')
            return False
    except Exception as e:
        safe_print('  -> [Tuta] ERRO username: ' + str(e))
        return False

    time.sleep(random.uniform(1, 2))

    # === STEP 4: Senha — clicar nos input[type=password] ===
    print('  -> [Tuta] Senha...')
    try:
        pw_fields = page.locator('input[type="password"]')
        pw_count = pw_fields.count()
        print('  -> [Tuta] Campos de senha: ' + str(pw_count))

        if pw_count >= 1:
            pw_fields.nth(0).click()
            time.sleep(0.5)
            human_type(page, password)
            time.sleep(random.uniform(0.5, 1))

        if pw_count >= 2:
            pw_fields.nth(1).click()
            time.sleep(0.5)
            human_type(page, password)
            print('  -> [Tuta] Senha confirmada')
        time.sleep(random.uniform(1, 2))
    except Exception as e:
        safe_print('  -> [Tuta] ERRO senha: ' + str(e))

    # === Checkboxes — clicar diretamente ===
    print('  -> [Tuta] Marcando checkboxes...')
    try:
        checkboxes = page.locator('input[type="checkbox"]')
        for idx in range(checkboxes.count()):
            cb = checkboxes.nth(idx)
            if cb.is_visible(timeout=1000):
                cb.click(force=True)
                time.sleep(0.5)
        print('  -> [Tuta] Checkboxes OK')
    except:
        # Fallback JS
        page.evaluate("""() => {
            document.querySelectorAll('input[type="checkbox"], [role="switch"]').forEach(function(cb) {
                if (cb.offsetHeight > 0) cb.click();
            });
        }""")
    time.sleep(random.uniform(1, 2))

    # === Clicar "Criar conta" via JS ===
    print('  -> [Tuta] Criando conta...')
    page.evaluate("""() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
            const t = (b.textContent || '').toLowerCase();
            if (b.offsetHeight > 0 && (t.includes('criar conta') || t.includes('create') || t.includes('registr'))) {
                b.click();
                return true;
            }
        }
        return false;
    }""")
    time.sleep(random.uniform(8, 15))

    # === STEP 5: Recovery code screen ===
    print('  -> [Tuta] Verificando tela de recovery...')
    for _ in range(20):
        try:
            body_text = page.evaluate("() => (document.body.textContent || '').toLowerCase()")
            if 'chave' in body_text or 'recovery' in body_text or 'recupera' in body_text:
                print('  -> [Tuta] Recovery screen detectada!')
                # Marcar checkbox via JS
                page.evaluate("""() => {
                    const els = document.querySelectorAll('[role="switch"], input[type="checkbox"], label');
                    els.forEach(el => {
                        if (el.offsetHeight > 0 && !el.checked) {
                            try { el.click(); } catch(e) {}
                        }
                    });
                }""")
                time.sleep(1)
                # Clicar OK/Continuar via JS
                page.evaluate("""() => {
                    const btns = document.querySelectorAll('button');
                    for (const b of btns) {
                        const t = (b.textContent || '').toLowerCase();
                        if (b.offsetHeight > 0 && (t.includes('vamos') || t.includes('ok') || t.includes('continuar') || t.includes('continue') || t.includes('let') || t.includes('done'))) {
                            b.click();
                            return true;
                        }
                    }
                    return false;
                }""")
                time.sleep(5)
                break

            # Verificar se ja esta no inbox
            url = page.url
            if '/mail' in url or '/inbox' in url:
                print('  -> [Tuta] Inbox direto!')
                break
        except:
            pass

        # Fechar dialogs
        page.evaluate("""() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
                const t = (b.textContent || '').toLowerCase();
                if (b.offsetHeight > 0 && (t.includes('ok') || t.includes('fechar') || t.includes('close') || t.includes('entendido'))) {
                    b.click();
                    return;
                }
            }
        }""")
        time.sleep(2)

    # === Verificar sucesso ===
    for _ in range(15):
        try:
            url = page.url
            if '/mail' in url or '/inbox' in url:
                return True
            body = page.evaluate("() => (document.body.textContent || '').toLowerCase()")
            if 'entrada' in body or 'inbox' in body or 'novo e-mail' in body:
                return True
        except:
            pass
        # Fechar mais dialogs
        page.evaluate("""() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
                const t = (b.textContent || '').toLowerCase();
                if (b.offsetHeight > 0 && (t.includes('ok') || t.includes('fechar') || t.includes('close') || t.includes('pular') || t.includes('skip'))) {
                    b.click(); return;
                }
            }
        }""")
        time.sleep(2)

    return False


# CLI
if __name__ == '__main__':
    username = sys.argv[1] if len(sys.argv) > 1 else 'gvbot' + str(random.randint(10000000, 99999999))
    password = sys.argv[2] if len(sys.argv) > 2 else 'Gv@test12345678'
    create_account(username, password)
