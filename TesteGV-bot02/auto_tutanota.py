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
        tuta_ctx = browser.new_context(no_viewport=True, locale='pt-BR', timezone_id='America/Sao_Paulo')
        tuta_page = tuta_ctx.new_page()
        tuta_page.set_default_timeout(30000)

        result = _create_tutanota_on_page(tuta_page, username, password)

        if result:
            print('  -> [Tuta] Conta criada: ' + email)
            return email, password, tuta_page, tuta_ctx
        else:
            print('  -> [Tuta] Falha ao criar conta')
            try:
                tuta_ctx.close()
            except:
                pass
            return None
    except Exception as e:
        safe_print('  -> [Tuta] ERRO: ' + str(e))
        return None


def _create_tutanota_on_page(page, username, password):
    """Logica interna de criacao de conta Tutanota via keyboard navigation.
    Retorna True se sucesso, False se falha."""

    page.goto('https://app.tuta.com/signup', timeout=60000)
    page.wait_for_load_state('domcontentloaded')
    time.sleep(random.uniform(8, 12))

    # === STEP 2: Selecionar plano Free via JS (bypassa SVG) ===
    print('  -> [Tuta] Selecionando plano Free...')
    page.evaluate("""() => {
        const els = document.querySelectorAll('div[role="button"], button, [tabindex]');
        for (const el of els) {
            if (el.offsetHeight > 0 && el.textContent.includes('Free')) {
                el.click();
                return true;
            }
        }
        return false;
    }""")
    time.sleep(random.uniform(2, 4))

    # Clicar Continuar via JS
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

    # === STEP 3: Preencher formulario via Tab navigation ===
    print('  -> [Tuta] Preenchendo formulario...')

    # Tab ate encontrar campo de texto (username)
    for attempt in range(15):
        page.keyboard.press('Tab')
        time.sleep(0.5)
        info = get_active_info(page)
        safe_print('  -> [Tuta] Tab ' + str(attempt + 1) + ': <' + info['tag'] + '> type=' + info['type'] + ' role=' + info['role'])
        # Encontrou campo de input de texto
        if info['tag'] == 'input' and info['type'] in ['text', '']:
            break
        if info['role'] == 'textbox':
            break

    # Digitar username
    page.keyboard.press('Control+a')
    page.keyboard.press('Backspace')
    time.sleep(0.3)
    human_type(page, username)
    print('  -> [Tuta] Username: ' + username)
    time.sleep(random.uniform(1, 2))

    # Tab para proximo campo — pode ser dropdown de dominio ou senha
    page.keyboard.press('Tab')
    time.sleep(0.5)
    info = get_active_info(page)
    safe_print('  -> [Tuta] Apos username: <' + info['tag'] + '> role=' + info['role'])

    # Se e dropdown de dominio, pular (manter padrao @tutamail.com)
    if info['role'] in ['combobox', 'listbox', 'button'] or 'select' in info['tag']:
        print('  -> [Tuta] Dropdown de dominio detectado, pulando...')
        page.keyboard.press('Tab')
        time.sleep(0.5)

    # === STEP 4: Senha ===
    print('  -> [Tuta] Senha...')
    # Navegar ate campo de password
    info = get_active_info(page)
    if info['type'] != 'password':
        for _ in range(5):
            page.keyboard.press('Tab')
            time.sleep(0.3)
            info = get_active_info(page)
            if info['type'] == 'password':
                break

    human_type(page, password)
    time.sleep(random.uniform(0.5, 1))

    # Tab para confirmar senha
    page.keyboard.press('Tab')
    time.sleep(0.5)
    info = get_active_info(page)
    if info['type'] == 'password':
        human_type(page, password)
        print('  -> [Tuta] Senha confirmada')
    else:
        # Tentar encontrar segundo campo de senha
        for _ in range(3):
            page.keyboard.press('Tab')
            time.sleep(0.3)
            info = get_active_info(page)
            if info['type'] == 'password':
                human_type(page, password)
                print('  -> [Tuta] Senha confirmada')
                break

    time.sleep(random.uniform(1, 2))

    # === Checkboxes via JS (mais confiavel que Tab+Space) ===
    print('  -> [Tuta] Marcando checkboxes...')
    page.evaluate("""() => {
        const switches = document.querySelectorAll('[role="switch"], label.tutaui-switch, input[type="checkbox"]');
        switches.forEach(sw => {
            if (sw.offsetHeight > 0) {
                try { sw.click(); } catch(e) {}
            }
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
