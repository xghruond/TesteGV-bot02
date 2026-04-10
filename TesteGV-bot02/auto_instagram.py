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


def create_account(email, password, full_name, username, birth_day='1', birth_month='1', birth_year='2000', tuta_pass=''):
    """Cria conta Instagram. Retorna status dict.
    tuta_pass: senha do email Tutanota (para buscar codigo de verificacao)."""
    # Limpar estado residual de chamadas anteriores
    create_account._code_done = False
    create_account._mail_page = None
    create_account._mail_attempts = 0
    create_account._tuta_pass = tuta_pass

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

        time.sleep(random.uniform(1.0, 2.0))

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
                except Exception as ce:
                    pass

                # Log periodico para debug
                if i > 0 and i % 10 == 0 and not code_done:
                    print('  -> Loop ' + str(i) + ': url=' + url[:50] + ' code_visible=' + str(code_visible))

                if code_visible and not code_done:
                    # Abrir Tutanota em background (SEM bring_to_front!)
                    if not mail_page:
                        print('  -> Tela de codigo detectada! Abrindo Tutanota...')
                        update_status(8, 'Abrindo Tutanota...')
                        try:
                            mail_page = context.new_page()
                            mail_page.goto('https://app.tuta.com/login', timeout=30000)
                            time.sleep(5)
                            tuta_email = 'teste.greenvillage@tutamail.com'
                            tuta_pass = 'Waxdwaxdw134679852'
                            print('  -> Tutanota login: ' + tuta_email)
                            # Preencher email
                            try:
                                label = mail_page.locator('text=Endere').first
                                if label.is_visible(timeout=3000):
                                    box = label.bounding_box()
                                    if box:
                                        mail_page.mouse.click(box['x'] + 100, box['y'] + 10)
                                        time.sleep(0.5)
                            except:
                                mail_page.keyboard.press('Tab')
                                time.sleep(0.5)
                            mail_page.keyboard.press('Control+a')
                            mail_page.keyboard.press('Backspace')
                            time.sleep(0.3)
                            human_type(mail_page, tuta_email)
                            time.sleep(1)
                            # Senha
                            mail_page.keyboard.press('Tab')
                            time.sleep(0.5)
                            human_type(mail_page, tuta_pass)
                            time.sleep(1)
                            # Entrar
                            for txt in ['Entrar', 'Log in']:
                                try:
                                    btn = mail_page.locator('button:has-text("' + txt + '")').first
                                    if btn.is_visible(timeout=2000):
                                        btn.click()
                                        break
                                except:
                                    continue
                            print('  -> Login Tutanota enviado!')
                            time.sleep(15)
                            mail_logged_in = True
                        except Exception as e:
                            print('  -> Erro login: ' + str(e))
                            mail_page = None

                    # Buscar codigo SEM trocar de aba (usa evaluate no background)
                    if mail_page and mail_logged_in:
                        attempt = i + 1
                        if attempt % 5 == 0:
                            print('  -> Buscando codigo... (' + str(attempt) + ')')
                            update_status(8, 'Buscando codigo no Tutanota...')

                        try:
                            # Reload a cada 10 tentativas
                            if attempt > 1 and attempt % 10 == 0:
                                mail_page.reload()
                                time.sleep(5)

                            # Buscar codigo na pagina do ProtonMail (sem bring_to_front)
                            full_text = mail_page.evaluate("() => document.body.textContent || ''")
                            codes = re.findall(r'\b(\d{6})\b', full_text)

                            if codes and ('instagram' in full_text.lower() or len(codes) > 1):
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
                                time.sleep(5)
                        except:
                            pass

                # === Pular telas opcionais ===
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
