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
from playwright.sync_api import sync_playwright

print = functools.partial(print, flush=True)

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
    for char in text:
        page.keyboard.type(char)
        time.sleep(random.uniform(0.06, 0.18))


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


def create_account(email, password, full_name, username, birth_day='1', birth_month='1', birth_year='2000'):
    """Cria conta Instagram. Retorna status dict."""

    with sync_playwright() as p:
        # === PASSO 1: Abrir Chrome ===
        update_status(1, 'Abrindo navegador...')
        print('[1/8] Abrindo Instagram...')

        browser = p.chromium.launch(
            headless=False,
            channel='chrome',
            args=['--start-maximized', '--window-position=0,0']
        )
        context = browser.new_context(
            no_viewport=True,
            locale='pt-BR',
            timezone_id='America/Sao_Paulo'
        )
        page = context.new_page()
        page.set_default_timeout(20000)

        # === PASSO 2: Navegar para signup ===
        update_status(2, 'Abrindo pagina de cadastro...')
        print('[2/8] Navegando para signup...')
        page.goto('https://www.instagram.com/accounts/emailsignup/', timeout=60000)
        page.wait_for_load_state('domcontentloaded')
        time.sleep(8)

        # Aceitar cookies se aparecer
        try:
            cookies = page.locator('button:has-text("Permitir"), button:has-text("Allow"), button:has-text("Accept")')
            if cookies.first.is_visible(timeout=3000):
                cookies.first.click()
                time.sleep(2)
        except:
            pass

        # === PASSO 2.5: Data de nascimento (Instagram pode pedir ANTES do formulario) ===
        print('  -> Verificando se pede data de nascimento...')
        try:
            selects = page.locator('select:visible')
            select_count = selects.count()
            if select_count >= 3:
                print('  -> Data de nascimento detectada! Preenchendo...')
                update_status(2, 'Preenchendo data de nascimento...')

                # Ordem: Mes (0), Dia (1), Ano (2) — ou Dia (0), Mes (1), Ano (2)
                # Tentar preencher por valor primeiro, depois por indice
                for idx, val in [(0, birth_month), (1, birth_day), (2, birth_year)]:
                    try:
                        selects.nth(idx).select_option(value=val)
                    except:
                        try:
                            selects.nth(idx).select_option(index=int(val) if idx < 2 else max(1, int(val) - 1919))
                        except:
                            pass
                    time.sleep(0.5)

                print('  -> Nascimento: ' + birth_day + '/' + birth_month + '/' + birth_year)
                time.sleep(1)

                # Clicar em Avançar/Next
                next_btns = [
                    'button:has-text("Avan")', 'button:has-text("Next")',
                    'div[role="button"]:has-text("Avan")', 'div[role="button"]:has-text("Next")',
                ]
                for nsel in next_btns:
                    try:
                        nb = page.locator(nsel).first
                        if nb.is_visible(timeout=2000):
                            nb.click()
                            print('  -> Avancou!')
                            break
                    except:
                        continue
                time.sleep(5)
            else:
                print('  -> Data nao pedida neste ponto')
        except:
            pass

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

        time.sleep(random.uniform(1.0, 2.0))

        # === PASSO 4: Preencher nome completo ===
        update_status(4, 'Preenchendo nome: ' + full_name)
        print('[4/8] Preenchendo nome: ' + full_name)
        try:
            name_selectors = [
                'input[name="fullName"]',
                'input[aria-label*="Full Name" i]',
                'input[aria-label*="Nome completo" i]',
                'input[aria-label*="nome" i]',
            ]
            filled = False
            for sel in name_selectors:
                try:
                    el = page.locator(sel).first
                    if el.is_visible(timeout=2000):
                        filled = react_fill(page, sel, full_name)
                        if filled:
                            print('  -> Nome preenchido! (' + sel + ')')
                            break
                except:
                    continue

            if not filled:
                # Fallback: 2o input visível
                inputs = page.locator('input[type="text"]:visible')
                if inputs.count() >= 2:
                    inputs.nth(1).click()
                    time.sleep(0.5)
                    human_type(page, full_name)
                    print('  -> Nome preenchido (fallback 2o input)!')
        except Exception as e:
            print('  -> ERRO nome: ' + str(e))

        time.sleep(random.uniform(1.0, 2.0))

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

        time.sleep(random.uniform(1.0, 2.0))

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

        # === PASSO 7.5: Data de nascimento (se aparecer) ===
        print('  -> Verificando data de nascimento...')
        try:
            # Instagram usa <select> nativos para dia/mes/ano
            # Buscar TODOS os selects visiveis na pagina
            selects = page.locator('select:visible')
            select_count = selects.count()
            print('  -> Selects encontrados: ' + str(select_count))

            if select_count >= 3:
                print('  -> Tela de nascimento detectada!')
                update_status(7, 'Preenchendo data de nascimento...')

                # Ordem no Instagram: Mes (0), Dia (1), Ano (2)
                # Mes
                try:
                    selects.nth(0).select_option(value=birth_month)
                    print('  -> Mes: ' + birth_month)
                except:
                    try:
                        selects.nth(0).select_option(index=int(birth_month))
                    except:
                        pass
                time.sleep(0.5)

                # Dia
                try:
                    selects.nth(1).select_option(value=birth_day)
                    print('  -> Dia: ' + birth_day)
                except:
                    try:
                        selects.nth(1).select_option(index=int(birth_day))
                    except:
                        pass
                time.sleep(0.5)

                # Ano
                try:
                    selects.nth(2).select_option(value=birth_year)
                    print('  -> Ano: ' + birth_year)
                except:
                    try:
                        selects.nth(2).select_option(index=int(birth_year) - 1919)
                    except:
                        pass
                time.sleep(1)

                print('  -> Nascimento: ' + birth_day + '/' + birth_month + '/' + birth_year)

                # Clicar em Avançar/Next/Cadastre-se
                next_btns = [
                    'button:has-text("Avan")', 'button:has-text("Next")',
                    'button:has-text("Cadastre")', 'button:has-text("Sign")',
                    'div[role="button"]:has-text("Avan")', 'div[role="button"]:has-text("Next")',
                    'button[type="button"]',
                ]
                for nsel in next_btns:
                    try:
                        nb = page.locator(nsel).first
                        if nb.is_visible(timeout=2000):
                            nb.click()
                            print('  -> Avancou! (' + nsel + ')')
                            break
                    except:
                        continue
                time.sleep(5)
            elif select_count == 0:
                print('  -> Sem selects — data nao foi pedida')
            else:
                print('  -> ' + str(select_count) + ' selects — tentando preencher...')
        except Exception as e:
            print('  -> Erro nascimento: ' + str(e))

        # === PASSO 8: Aguardar verificação ===
        update_status(8, 'Aguardando verificacao... Resolva no navegador se necessario!')
        print('\n[8/8] Aguardando verificacao...')

        # Numeros virtuais para SMS
        sms_numbers = ['+17404619556', '+16145308929', '+447884641162']

        conta_criada = False
        for i in range(300):  # 10 min
            time.sleep(2)
            try:
                url = page.url

                # Detectar sucesso (chegou no feed/home)
                if any(x in url for x in ['/explore', '/accounts/onetap', 'instagram.com/']) and '/signup' not in url and '/emailsignup' not in url and '/challenge' not in url:
                    try:
                        if page.locator('svg[aria-label="Home"], svg[aria-label="P\u00e1gina inicial"], a[href="/explore/"]').first.is_visible(timeout=2000):
                            print('  -> Conta criada! Feed detectado.')
                            conta_criada = True
                            break
                    except:
                        pass

                # Detectar código de email → fazer login no ProtonMail e buscar
                try:
                    code_text = page.locator('text=código de confirmação, text=confirmation code, text=codigo de confirmacao')
                    code_input = page.locator('input[name="email_confirmation_code"], input[aria-label*="código" i], input[aria-label*="code" i], input[placeholder*="code" i], input[placeholder*="código" i], input[name="code"]')

                    if code_text.first.is_visible(timeout=500) or code_input.first.is_visible(timeout=500):
                        if not getattr(create_account, '_code_searched', False):
                            create_account._code_searched = True
                            print('  -> Codigo de email detectado! Buscando no ProtonMail...')
                            update_status(8, 'Buscando codigo no ProtonMail...')

                            # Abrir nova aba e fazer login no ProtonMail
                            try:
                                mail_page = context.new_page()
                                mail_page.goto('https://mail.proton.me/login', timeout=30000)
                                time.sleep(5)

                                # Login com as credenciais do email que foi criado
                                proton_user = email.split('@')[0]  # ex: rafael.almeida.gv
                                mail_page.locator('#username').fill(proton_user)
                                time.sleep(1)
                                mail_page.locator('#password').fill(password)
                                time.sleep(1)
                                mail_page.locator('button[type="submit"]').first.click()
                                print('  -> Login ProtonMail enviado!')
                                time.sleep(15)

                                # Buscar codigo (tentar 15x)
                                code_found = False
                                for attempt in range(15):
                                    update_status(8, 'Buscando codigo... tentativa ' + str(attempt + 1) + '/15')
                                    try:
                                        mail_page.reload()
                                        time.sleep(6)

                                        # Clicar no email mais recente do Instagram
                                        items = mail_page.locator('[data-testid="message-item"], [data-shortcut-target="message-container"] div[role="button"]')
                                        for ei in range(min(items.count(), 5)):
                                            try:
                                                item = items.nth(ei)
                                                txt = item.text_content() or ''
                                                if any(k in txt.lower() for k in ['instagram', 'confirm', 'verif', 'code']):
                                                    item.click()
                                                    time.sleep(3)
                                                    body = mail_page.locator('[data-testid="message-content"], .message-content, article').first.text_content() or ''
                                                    codes = re.findall(r'\b(\d{6})\b', body)
                                                    if codes:
                                                        code = codes[0]
                                                        print('  -> CODIGO INSTAGRAM: ' + code)
                                                        update_status(8, 'Codigo encontrado: ' + code)

                                                        # Voltar pra aba do Instagram e preencher
                                                        page.bring_to_front()
                                                        time.sleep(1)
                                                        ci = code_input.first
                                                        if ci.is_visible(timeout=3000):
                                                            ci.click()
                                                            time.sleep(0.5)
                                                            page.keyboard.press('Control+a')
                                                            page.keyboard.press('Backspace')
                                                            time.sleep(0.3)
                                                            human_type(page, code)
                                                            time.sleep(1)
                                                            # Clicar Continuar/Next/Confirm
                                                            confirm_btn = page.locator('button:has-text("Continuar"), button:has-text("Next"), button:has-text("Confirm"), div[role="button"]:has-text("Continuar"), div[role="button"]:has-text("Next")')
                                                            if confirm_btn.first.is_visible(timeout=3000):
                                                                confirm_btn.first.click()
                                                                print('  -> Codigo enviado!')
                                                                time.sleep(5)
                                                        code_found = True
                                                        break
                                            except:
                                                continue
                                        if code_found:
                                            break
                                    except:
                                        pass
                                    time.sleep(5)

                                # Fechar aba do ProtonMail
                                try:
                                    mail_page.close()
                                except:
                                    pass

                                if code_found:
                                    print('  -> Verificacao de email resolvida!')
                                else:
                                    print('  -> Codigo nao encontrado no ProtonMail')
                                    update_status(8, 'Codigo nao encontrado. Verifique o ProtonMail manualmente.')
                            except Exception as e:
                                print('  -> Erro ao buscar codigo: ' + str(e))
                                update_status(8, 'Erro ao buscar codigo. Verifique manualmente.')
                except:
                    pass

                # Detectar verificação por telefone
                try:
                    phone_text = page.locator('text=celular, text=phone number, text=telefone, text=n\u00famero de celular')
                    phone_input = page.locator('input[type="tel"]')
                    if phone_text.first.is_visible(timeout=500) and phone_input.first.is_visible(timeout=500):
                        print('  -> Verificacao por telefone detectada!')
                        update_status(8, 'Testando numero virtual para SMS...')

                        for num_idx, phone in enumerate(sms_numbers):
                            print('  -> Tentando: ' + phone)
                            try:
                                phone_input.first.click()
                                time.sleep(0.5)
                                page.keyboard.press('Control+a')
                                page.keyboard.press('Backspace')
                                time.sleep(0.3)
                                human_type(page, phone)
                                time.sleep(1)

                                # Clicar enviar
                                send = page.locator('button:has-text("Enviar"), button:has-text("Send"), button:has-text("c\u00f3digo"), div[role="button"]:has-text("Enviar")')
                                if send.first.is_visible(timeout=2000):
                                    send.first.click()
                                    time.sleep(5)

                                    # Verificar erro
                                    try:
                                        err = page.locator('text=excessivo, text=rate limit, text=invalid, text=too many')
                                        if err.first.is_visible(timeout=3000):
                                            print('  -> Numero bloqueado, tentando proximo...')
                                            continue
                                    except:
                                        pass

                                    # Sucesso — abrir site de SMS
                                    print('  -> Codigo enviado! Abra anonymsms.com para pegar o codigo')
                                    update_status(8, 'Abra anonymsms.com, procure ' + phone + ' e pegue o codigo!')
                                    page.evaluate('window.open("https://anonymsms.com", "_blank")')
                                    break
                            except:
                                continue
                except:
                    pass

                # Pular telas opcionais
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

        print('Navegador aberto por 5 min...')
        time.sleep(300)
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
