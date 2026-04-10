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

# Importar criacao de Tutanota fresco
from auto_tutanota import create_fresh_tutanota

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
                    code_visible = False

                    # Verificar por texto na pagina
                    code_keywords = ['confirma', 'confirmation', 'Insira o c', 'Enter the code',
                                     'codigo de 6', 'code we sent', 'enviamos para']
                    for ct in code_keywords:
                        try:
                            if page.locator('text=' + ct).first.is_visible(timeout=200):
                                code_visible = True
                                print('  -> Tela de codigo detectada: "' + ct + '"')
                                break
                        except:
                            continue

                    # Verificar por input de codigo
                    code_input = page.locator('input[name="email_confirmation_code"], input[aria-label*="digo" i], input[aria-label*="code" i], input[placeholder*="code" i], input[placeholder*="digo" i], input[name="code"], input[placeholder*="confirma" i]')
                    if not code_visible:
                        try:
                            code_visible = code_input.first.is_visible(timeout=200)
                            if code_visible:
                                print('  -> Input de codigo detectado')
                        except:
                            pass

                    # Verificar pela URL (challenge)
                    if not code_visible and '/challenge' in url:
                        code_visible = True
                        print('  -> URL challenge detectada')

                    if code_visible and not getattr(create_account, '_code_done', False):
                        # Abrir Tutanota se ainda nao abriu
                        if not getattr(create_account, '_mail_page', None):
                            print('  -> Codigo de email detectado! Abrindo Tutanota...')
                            update_status(8, 'Login no Tutanota (' + email + ')...')
                            # email e tuta_pass vem como parametros da funcao
                            tuta_pass = getattr(create_account, '_tuta_pass', 'GvTuta2026!')
                            try:
                                mail_page = context.new_page()
                                mail_page.goto('https://app.tuta.com/login', timeout=30000)
                                time.sleep(5)

                                print('  -> Tutanota login: ' + email)

                                # Preencher email
                                try:
                                    email_label = mail_page.locator('text=Endere').first
                                    if email_label.is_visible(timeout=3000):
                                        box = email_label.bounding_box()
                                        if box:
                                            mail_page.mouse.click(box['x'] + 100, box['y'] + 10)
                                            time.sleep(0.5)
                                except:
                                    mail_page.keyboard.press('Tab')
                                    time.sleep(0.5)

                                mail_page.keyboard.press('Control+a')
                                mail_page.keyboard.press('Backspace')
                                time.sleep(0.3)
                                human_type(mail_page, email)
                                time.sleep(1)

                                # Preencher senha
                                mail_page.keyboard.press('Tab')
                                time.sleep(0.5)
                                human_type(mail_page, tuta_pass)
                                time.sleep(1)

                                # Clicar Entrar
                                for txt in ['Entrar', 'Log in', 'Login']:
                                    try:
                                        btn = mail_page.locator('button:has-text("' + txt + '")').first
                                        if btn.is_visible(timeout=2000):
                                            btn.click()
                                            break
                                    except:
                                        continue
                                print('  -> Login Tutanota enviado!')
                                time.sleep(15)

                                # Esperar inbox carregar
                                for w in range(15):
                                    mail_url = mail_page.url
                                    if '/mail' in mail_url or '/inbox' in mail_url:
                                        print('  -> Tutanota inbox carregado!')
                                        break
                                    try:
                                        has_inbox = mail_page.evaluate("""() => {
                                            const body = document.body.textContent || '';
                                            return body.includes('Entrada') || body.includes('Inbox');
                                        }""")
                                        if has_inbox:
                                            print('  -> Tutanota inbox detectado!')
                                            break
                                    except:
                                        pass
                                    # Fechar dialogs
                                    for dtxt in ['OK', 'Fechar', 'Close']:
                                        try:
                                            db = mail_page.locator('button:has-text("' + dtxt + '")').first
                                            if db.is_visible(timeout=500):
                                                db.click()
                                                time.sleep(1)
                                        except:
                                            pass
                                    time.sleep(2)

                                create_account._mail_page = mail_page
                                create_account._mail_attempts = 0
                            except Exception as e:
                                print('  -> Erro ao abrir Tutanota: ' + str(e))
                                create_account._mail_page = None

                        # Buscar codigo na inbox (uma tentativa por loop)
                        mail_page = getattr(create_account, '_mail_page', None)
                        if mail_page:
                            create_account._mail_attempts = getattr(create_account, '_mail_attempts', 0) + 1
                            attempt = create_account._mail_attempts
                            update_status(8, 'Buscando codigo... tentativa ' + str(attempt))

                            try:
                                mail_page.bring_to_front()
                                time.sleep(1)

                                print('  -> Buscando codigo no Tutanota... tentativa ' + str(attempt))

                                # Clicar em Entrada/Inbox para atualizar
                                if attempt > 1 and attempt % 3 == 0:
                                    try:
                                        inbox_btn = mail_page.locator('text=Entrada, text=Inbox').first
                                        if inbox_btn.is_visible(timeout=1000):
                                            inbox_btn.click()
                                            time.sleep(3)
                                    except:
                                        mail_page.reload()
                                        time.sleep(6)

                                # Pegar texto da pagina
                                full_text = mail_page.evaluate("() => document.body.textContent || ''")
                                full_lower = full_text.lower()

                                has_email = 'instagram' in full_lower or 'confirm' in full_lower or 'verif' in full_lower

                                if has_email:
                                    print('  -> Email do Instagram detectado no Tutanota!')

                                    # Clicar no email do Instagram na lista
                                    try:
                                        # Buscar item na lista que contem "Instagram" ou "confirm"
                                        mail_page.evaluate("""() => {
                                            // Pegar todos os elementos clicaveis na lista de emails
                                            const rows = document.querySelectorAll('[class*="row"], [class*="list"], li, tr, div');
                                            for (const row of rows) {
                                                if (row.offsetHeight > 20 && row.offsetHeight < 200) {
                                                    const text = (row.textContent || '').toLowerCase();
                                                    if ((text.includes('instagram') || text.includes('confirm')) && !text.includes('tuta team') && !text.includes('proton')) {
                                                        row.click();
                                                        return true;
                                                    }
                                                }
                                            }
                                            return false;
                                        }""")
                                        time.sleep(4)
                                    except:
                                        pass

                                    # Ler pagina inteira — o email aberto deve conter o codigo
                                    time.sleep(2)
                                    full_text = mail_page.evaluate("() => document.body.textContent || ''")
                                    codes = re.findall(r'\b(\d{6})\b', full_text)
                                    try:
                                        safe_text = full_text[:200].encode('ascii', 'replace').decode().replace('\n', ' ')
                                        print('  -> Pagina: ' + safe_text)
                                    except:
                                        print('  -> Pagina: (texto com caracteres especiais)')
                                    print('  -> Codigos 6 digitos: ' + str(codes[:5]))

                                    if codes:
                                        code = codes[0]
                                        print('  -> CODIGO INSTAGRAM: ' + code)
                                        update_status(8, 'Codigo: ' + code)

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
                                            for btn_text in ['Continuar', 'Next', 'Confirm']:
                                                try:
                                                    btn = page.locator('button:has-text("' + btn_text + '"), div[role="button"]:has-text("' + btn_text + '")').first
                                                    if btn.is_visible(timeout=2000):
                                                        btn.click()
                                                        print('  -> Codigo enviado!')
                                                        break
                                                except:
                                                    continue

                                        create_account._code_done = True
                                        try:
                                            mail_page.close()
                                        except:
                                            pass
                                        time.sleep(5)
                                    else:
                                        print('  -> Email encontrado mas sem codigo de 6 digitos')
                                        page.bring_to_front()
                                else:
                                    print('  -> Inbox sem email do Instagram...')
                                    page.bring_to_front()
                            except Exception as e:
                                print('  -> Erro busca codigo: ' + str(e))
                                page.bring_to_front()

                            if attempt >= 30:
                                print('  -> Codigo nao encontrado apos 30 tentativas')
                                update_status(8, 'Codigo nao encontrado. Verifique manualmente.')
                                create_account._code_done = True
                                try:
                                    mail_page.close()
                                except:
                                    pass
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
