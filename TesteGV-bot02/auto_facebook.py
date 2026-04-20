"""
Bot: Criar conta Facebook automaticamente (SCAFFOLD — nao testado contra live site)

IMPORTANTE — este arquivo e um ESQUELETO baseado na estrutura de auto_instagram.py.
Os seletores CSS e fluxo de verificacao sao ESTIMATIVAS e devem ser validados
rodando contra https://www.facebook.com/r.php antes de considerar funcional.

Pontos de atencao ao testar:
1. Facebook tem anti-bot agressivo — pode pedir verificacao de identidade imediatamente
2. Campos de data de nascimento sao <select> (nao <input>)
3. Codigo de email ou SMS apos signup varia por regiao
4. Selector 'nome', 'sobrenome' sao separados (diferente do Instagram)

CLI: python auto_facebook.py <email> <password> <first_name> <last_name> <birth_day> <birth_month> <birth_year>
Import: from auto_facebook import create_account
"""
import os
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

# Flag de cancelamento (setado por server.py via POST /api/cancel)
_cancel_requested = False


class _CancelError(Exception):
    pass


def _check_cancel():
    if _cancel_requested:
        raise _CancelError()


def update_status(step, message, done=False, success=False, error=None):
    status['step'] = step
    status['message'] = message
    status['done'] = done
    status['success'] = success
    status['error'] = error
    level = 'error' if error else 'info'
    log_event('facebook', level, message, step=step, extra={'done': done, 'success': success})


def human_type(page, text):
    """Digita como humano com velocidade variavel."""
    for char in text:
        page.keyboard.type(char)
        time.sleep(random.uniform(0.08, 0.22))
    time.sleep(random.uniform(0.3, 0.8))


# Meses em ingles (Facebook usa label em EN por default mesmo em pt-BR)
MESES_EN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def create_account(email, password, first_name, last_name,
                   birth_day='15', birth_month='6', birth_year='2000'):
    """
    Cria conta Facebook. SCAFFOLD — seletores precisam validacao.
    Retorna status dict.
    """
    global _cancel_requested
    _cancel_requested = False
    status['email'] = email
    status['password'] = password

    try:
      with sync_playwright() as p:
        update_status(1, 'Abrindo navegador...')
        print('[1/6] Abrindo Facebook...')

        browser = p.chromium.launch(
            headless=False,
            channel='chrome',
            args=[
                '--start-maximized',
                '--window-position=0,0',
                '--disable-blink-features=AutomationControlled',
            ]
        )
        context = browser.new_context(
            no_viewport=True,
            locale='pt-BR',
            timezone_id='America/Sao_Paulo',
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        )
        page = context.new_page()
        page.set_default_timeout(30000)

        page.goto('https://www.facebook.com/r.php', timeout=60000)
        page.wait_for_load_state('domcontentloaded')
        time.sleep(random.uniform(4, 7))

        _check_cancel()

        # === STEP 2: Nome ===
        # NOTE seletores baseados em inspecao manual ~2025-04; podem mudar
        update_status(2, 'Preenchendo nome...')
        print('[2/6] Nome: ' + first_name + ' ' + last_name)

        try:
            fn_input = page.locator('input[name="firstname"], input[aria-label*="Nome" i]').first
            fn_input.click()
            human_type(page, first_name)

            ln_input = page.locator('input[name="lastname"], input[aria-label*="Sobrenome" i]').first
            ln_input.click()
            human_type(page, last_name)
        except Exception as e:
            update_status(2, 'Erro preenchendo nome: ' + str(e)[:80], done=True, error='form_nome')
            browser.close()
            return status

        _check_cancel()

        # === STEP 3: Email + senha ===
        update_status(3, 'Preenchendo email e senha...')
        print('[3/6] Email: ' + email)

        try:
            em = page.locator('input[name="reg_email__"], input[aria-label*="e-mail" i]').first
            em.click()
            human_type(page, email)

            em_confirm = page.locator('input[name="reg_email_confirmation__"]')
            if em_confirm.count() > 0:
                em_confirm.first.click()
                human_type(page, email)

            pw = page.locator('input[name="reg_passwd__"], input[aria-label*="senha" i]').first
            pw.click()
            human_type(page, password)
        except Exception as e:
            update_status(3, 'Erro preenchendo credenciais: ' + str(e)[:80], done=True, error='form_creds')
            browser.close()
            return status

        _check_cancel()

        # === STEP 4: Data de nascimento (3 <select>) ===
        update_status(4, 'Preenchendo data de nascimento...')
        print('[4/6] Nascimento: ' + birth_day + '/' + birth_month + '/' + birth_year)

        try:
            page.select_option('select[name="birthday_day"]', str(int(birth_day)))
            time.sleep(random.uniform(0.3, 0.7))
            # Facebook usa label em EN para o mes
            month_label = MESES_EN[int(birth_month)]
            page.select_option('select[name="birthday_month"]', label=month_label)
            time.sleep(random.uniform(0.3, 0.7))
            page.select_option('select[name="birthday_year"]', str(int(birth_year)))
            time.sleep(random.uniform(0.5, 1.2))
        except Exception as e:
            update_status(4, 'Erro data: ' + str(e)[:80], done=True, error='form_data')
            browser.close()
            return status

        _check_cancel()

        # === STEP 5: Genero + submit ===
        update_status(5, 'Selecionando genero e enviando...')
        print('[5/6] Enviando...')

        try:
            # Genero: clicar em "Personalizado" para evitar assumir binario
            gender_inputs = page.locator('input[name="sex"]').all()
            if gender_inputs:
                gender_inputs[-1].click()  # ultimo geralmente e "Personalizado"
            time.sleep(random.uniform(0.5, 1.0))

            # Submit
            submit_btn = page.locator('button[name="websubmit"], button:has-text("Cadastrar")').first
            submit_btn.click()
        except Exception as e:
            update_status(5, 'Erro submit: ' + str(e)[:80], done=True, error='submit')
            browser.close()
            return status

        time.sleep(random.uniform(4, 7))
        _check_cancel()

        # === STEP 6: Aguardar verificacao/sucesso ===
        update_status(6, 'Aguardando verificacao...')
        print('[6/6] Aguardando Facebook processar...')

        conta_criada = False
        for i in range(180):  # 6 min
            _check_cancel()
            time.sleep(2)
            try:
                url = page.url
                # Sucesso heuristico: Facebook redireciona para home ou confirma-email
                if 'confirmemail' in url or 'confirmation' in url:
                    conta_criada = True
                    print('  -> Tela de confirmacao de email detectada')
                    break
                if 'facebook.com/home' in url or page.locator('[aria-label="Facebook"]').first.is_visible(timeout=500):
                    conta_criada = True
                    print('  -> Home do Facebook detectada!')
                    break
            except _CancelError:
                raise
            except Exception as e:
                if i % 30 == 0:
                    log_event('facebook', 'warn', 'iter_error: ' + str(e)[:120], step=status['step'])

        if conta_criada:
            update_status(6, 'Conta Facebook criada! Verifique email de confirmacao.',
                          done=True, success=True)
            print('\nSUCESSO! ' + email)
        else:
            update_status(6, 'Timeout (6min) — verifique navegador', done=True, error='timeout')
            print('\nTimeout.')

        time.sleep(10)
        browser.close()
    except _CancelError:
      print('[CANCEL] Facebook: cancelado pelo usuario')
      update_status(status['step'], 'Cancelado pelo usuario', done=True, error='Cancelado pelo usuario')

    return status


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 8:
        print('Uso: python auto_facebook.py <email> <password> <first_name> <last_name> <birth_day> <birth_month> <birth_year>')
        sys.exit(1)
    create_account(*sys.argv[1:8])
