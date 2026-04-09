"""
Bot: Criar conta Tutanota/Tuta.com (semi-automatico)
Preenche tudo automaticamente, humano resolve CAPTCHA de imagem.

CLI: python auto_tutanota.py <username> <password>
Import: from auto_tutanota import create_account
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
    """Digita como humano com velocidade variavel."""
    for char in text:
        page.keyboard.type(char)
        time.sleep(random.uniform(0.08, 0.22))
    time.sleep(random.uniform(0.3, 0.8))


def create_account(username, password):
    """Cria conta Tutanota. Retorna dict status."""
    status['email'] = username + '@tuta.com'
    status['password'] = password

    with sync_playwright() as p:
        # === STEP 1: Abrir navegador ===
        update_status(1, 'Abrindo navegador...')
        print('[1/5] Abrindo Tutanota...')

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

        page.goto('https://app.tuta.com/signup', timeout=60000)
        page.wait_for_load_state('domcontentloaded')
        print('  -> Pagina carregada')
        time.sleep(random.uniform(6, 10))

        # === STEP 2: Selecionar plano Free ===
        update_status(2, 'Selecionando plano Free...')
        print('[2/5] Selecionando plano Free...')

        free_clicked = False
        # Tentar varios seletores para o plano Free
        free_selectors = [
            'button:has-text("Free")',
            'div:has-text("Free") >> button',
            'text=Free >> ..',
            '[data-testid="free-plan"]',
            'button:has-text("Selecionar")',
            'button:has-text("Select")',
        ]
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
            # Fallback JS: procurar qualquer elemento com "Free" e clicar
            page.evaluate('''() => {
                const els = document.querySelectorAll('button, div[role="button"], a');
                for (const el of els) {
                    if (el.offsetHeight > 0 && el.textContent.includes('Free')) {
                        el.click();
                        return true;
                    }
                }
                return false;
            }''')
            print('  -> Plano Free via JS')

        time.sleep(random.uniform(3, 5))

        # Aceitar termos se aparecer
        try:
            for txt in ['Aceitar', 'Accept', 'Concordo', 'I agree', 'OK']:
                btn = page.locator('button:has-text("' + txt + '")').first
                if btn.is_visible(timeout=2000):
                    btn.click()
                    print('  -> Aceitou: ' + txt)
                    time.sleep(2)
                    break
        except:
            pass

        # === STEP 3: Preencher dados ===
        update_status(3, 'Preenchendo dados...')
        print('[3/5] Preenchendo username: ' + username)

        time.sleep(random.uniform(2, 4))

        # Preencher username — procurar campo de email/username
        username_filled = False
        try:
            # Tutanota usa inputs dentro de shadow DOM ou custom elements
            # Tentar varios seletores
            username_selectors = [
                'input[type="text"]',
                'input[placeholder*="mail" i]',
                'input[placeholder*="address" i]',
                'input[placeholder*="usuario" i]',
                'input[placeholder*="user" i]',
                'input[name*="mail" i]',
                'input[name*="user" i]',
            ]
            for sel in username_selectors:
                try:
                    inp = page.locator(sel).first
                    if inp.is_visible(timeout=2000):
                        inp.click()
                        time.sleep(0.5)
                        page.keyboard.press('Control+a')
                        page.keyboard.press('Backspace')
                        time.sleep(0.3)
                        human_type(page, username)
                        val = page.evaluate('document.querySelector("' + sel + '")?.value || ""')
                        if val:
                            print('  -> Username preenchido: ' + val + ' (' + sel + ')')
                            username_filled = True
                            break
                except:
                    continue

            if not username_filled:
                # Fallback: encontrar qualquer input visivel que nao seja password
                page.evaluate('''(u) => {
                    const inputs = document.querySelectorAll('input');
                    for (const inp of inputs) {
                        if (inp.offsetHeight > 0 && inp.type !== 'password' && inp.type !== 'hidden') {
                            inp.focus();
                            inp.click();
                            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                            if (setter) {
                                setter.call(inp, u);
                                inp.dispatchEvent(new Event('input', { bubbles: true }));
                                inp.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            return true;
                        }
                    }
                    return false;
                }''', username)
                print('  -> Username via JS fallback')
                username_filled = True
        except Exception as e:
            print('  -> ERRO username: ' + str(e))

        time.sleep(random.uniform(2, 4))

        # Selecionar dominio @tuta.com se houver dropdown
        try:
            domain_sel = page.locator('select, [role="listbox"], button:has-text("tuta"), button:has-text("tutanota")')
            if domain_sel.first.is_visible(timeout=2000):
                domain_sel.first.click()
                time.sleep(1)
                tuta = page.locator('option:has-text("tuta.com"), [role="option"]:has-text("tuta.com"), li:has-text("tuta.com")')
                if tuta.first.is_visible(timeout=2000):
                    tuta.first.click()
                    print('  -> Dominio: tuta.com')
                    time.sleep(1)
        except:
            pass

        # === STEP 4: Senha ===
        update_status(4, 'Preenchendo senha...')
        print('[4/5] Senha...')

        time.sleep(random.uniform(1.5, 3))

        try:
            pw_fields = page.locator('input[type="password"]')
            pw_count = pw_fields.count()
            print('  -> Campos de senha encontrados: ' + str(pw_count))

            if pw_count >= 1:
                # Primeiro campo de senha
                pw_fields.nth(0).click()
                time.sleep(0.5)
                human_type(page, password)
                print('  -> Senha preenchida')
                time.sleep(random.uniform(1, 2))

            if pw_count >= 2:
                # Confirmar senha
                pw_fields.nth(1).click()
                time.sleep(0.5)
                human_type(page, password)
                print('  -> Senha confirmada')
                time.sleep(random.uniform(1, 2))
        except Exception as e:
            print('  -> ERRO senha: ' + str(e))

        time.sleep(random.uniform(2, 4))

        # Clicar proximo/criar se houver botao antes do CAPTCHA
        try:
            for txt in ['Próximo', 'Next', 'Criar', 'Create', 'Continuar', 'Continue', 'Registrar', 'Register']:
                btn = page.locator('button:has-text("' + txt + '")').first
                if btn.is_visible(timeout=2000):
                    btn.click()
                    print('  -> Clicou: ' + txt)
                    time.sleep(random.uniform(3, 5))
                    break
        except:
            pass

        # === STEP 5: CAPTCHA — humano resolve ===
        update_status(5, 'CAPTCHA — resolva no navegador!')
        print('\n[5/5] Aguardando CAPTCHA...')
        print('  *** RESOLVA O CAPTCHA DE IMAGEM NO NAVEGADOR ***')

        conta_criada = False
        for i in range(600):  # 20 min
            time.sleep(2)
            try:
                url = page.url

                # Sucesso: redirecionou para inbox/login/mailbox
                if any(x in url for x in ['/mail', '/inbox', '/login', 'mailbox']):
                    # Verificar se realmente logou (nao e a pagina de login)
                    try:
                        # Se tem botao de compose/escrever, esta logado
                        logged = page.evaluate('''() => {
                            const url = window.location.href;
                            if (url.includes('/mail') || url.includes('/inbox')) return true;
                            // Verificar se tem elementos de inbox
                            const body = document.body.textContent || '';
                            if (body.includes('Compose') || body.includes('Escrever') || body.includes('Inbox') || body.includes('Caixa')) return true;
                            return false;
                        }''')
                        if logged:
                            print('  -> Conta criada! URL: ' + url)
                            conta_criada = True
                            break
                    except:
                        pass

                # Detectar mensagem de sucesso
                try:
                    success_texts = ['successfully', 'sucesso', 'created', 'criada', 'welcome', 'bem-vindo']
                    for st in success_texts:
                        if page.locator('text=' + st).first.is_visible(timeout=300):
                            print('  -> Mensagem de sucesso detectada: ' + st)
                            conta_criada = True
                            break
                    if conta_criada:
                        break
                except:
                    pass

                # Detectar se CAPTCHA sumiu (conta sendo criada)
                try:
                    loading = page.locator('[class*="progress"], [class*="loading"], [class*="spinner"]')
                    if loading.first.is_visible(timeout=300):
                        update_status(5, 'Criando conta...')
                        print('  -> Criando conta...')
                except:
                    pass

                # Clicar botoes pos-CAPTCHA (Next, Create, etc.)
                try:
                    for txt in ['Criar conta', 'Create account', 'Finalizar', 'Finish', 'OK', 'Continuar', 'Continue']:
                        btn = page.locator('button:has-text("' + txt + '")')
                        if btn.first.is_visible(timeout=300):
                            btn.first.click()
                            print('  -> Clicou pos-CAPTCHA: ' + txt)
                            time.sleep(3)
                            break
                except:
                    pass

                # Pular/fechar dialogs
                try:
                    for txt in ['Skip', 'Pular', 'Maybe later', 'Talvez', 'Close', 'Fechar', 'OK']:
                        skip = page.locator('button:has-text("' + txt + '")')
                        if skip.first.is_visible(timeout=300):
                            skip.first.click()
                            print('  -> Pulou: ' + txt)
                            time.sleep(2)
                            break
                except:
                    pass

                # Lembrete periodico
                if i > 0 and i % 15 == 0:
                    mins = (i * 2) // 60
                    update_status(5, 'CAPTCHA — resolva no navegador! (' + str(mins) + ' min)')
                    print('  -> Aguardando... (' + str(mins) + ' min)')

            except:
                pass

        # === RESULTADO ===
        if conta_criada:
            update_status(5, 'Conta criada com sucesso!', done=True, success=True)
            print('\n=== SUCESSO! ' + username + '@tuta.com ===')
        else:
            update_status(5, 'Timeout (20 min).', done=True, error='timeout')
            print('\nTimeout (20 min).')

        print('Navegador aberto por 5 min...')
        time.sleep(10)
        browser.close()

    return status


# CLI
if __name__ == '__main__':
    username = sys.argv[1] if len(sys.argv) > 1 else 'test.user'
    password = sys.argv[2] if len(sys.argv) > 2 else 'Test@12345678'
    create_account(username, password)
