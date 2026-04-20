"""
Bot: Criar conta TikTok automaticamente (SCAFFOLD — nao testado contra live site)

IMPORTANTE — este arquivo e um ESQUELETO baseado na estrutura de auto_instagram.py.
Os seletores CSS e fluxo sao ESTIMATIVAS. TikTok usa Shadow DOM em algumas areas,
captcha personalizado, e deteccao de automacao bem agressiva.

Pontos de atencao ao testar:
1. TikTok usa iframes e shadow DOM para certos componentes
2. Captcha slide-puzzle pode aparecer ANTES mesmo de submeter
3. Verificacao via email OR telefone (por pais)
4. Seletor de aniversario e dropdown custom (nao <select> nativo)

CLI: python auto_tiktok.py <email> <password> <birth_month> <birth_day> <birth_year>
Import: from auto_tiktok import create_account
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
    'total': 5,
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
    log_event('tiktok', level, message, step=step, extra={'done': done, 'success': success})


def human_type(page, text):
    for char in text:
        page.keyboard.type(char)
        time.sleep(random.uniform(0.08, 0.22))
    time.sleep(random.uniform(0.3, 0.8))


def create_account(email, password, birth_month='6', birth_day='15', birth_year='2000'):
    """
    Cria conta TikTok. SCAFFOLD — seletores precisam validacao.
    Retorna status dict.
    """
    global _cancel_requested
    _cancel_requested = False
    status['email'] = email
    status['password'] = password

    try:
      with sync_playwright() as p:
        update_status(1, 'Abrindo navegador...')
        print('[1/5] Abrindo TikTok...')

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

        page.goto('https://www.tiktok.com/signup/phone-or-email/email', timeout=60000)
        page.wait_for_load_state('domcontentloaded')
        time.sleep(random.uniform(5, 8))

        _check_cancel()

        # === STEP 2: Data de nascimento (dropdowns custom) ===
        update_status(2, 'Preenchendo data de nascimento...')
        print('[2/5] Nascimento: ' + birth_month + '/' + birth_day + '/' + birth_year)

        try:
            # TikTok usa seus proprios dropdowns (nao <select>)
            # Tentar seletor generico de dropdown por aria-label
            month_dd = page.locator('select[data-tt-month-select], [aria-label*="Month" i], [aria-label*="Mes" i]').first
            try:
                month_dd.select_option(value=str(int(birth_month)))
            except Exception:
                # Fallback: clicar e escolher option
                month_dd.click()
                time.sleep(0.5)
                page.locator('[role="option"]').nth(int(birth_month) - 1).click()

            time.sleep(random.uniform(0.5, 1))

            day_dd = page.locator('select[data-tt-day-select], [aria-label*="Day" i], [aria-label*="Dia" i]').first
            try:
                day_dd.select_option(value=str(int(birth_day)))
            except Exception:
                day_dd.click()
                time.sleep(0.5)
                page.locator('[role="option"]').nth(int(birth_day) - 1).click()

            time.sleep(random.uniform(0.5, 1))

            year_dd = page.locator('select[data-tt-year-select], [aria-label*="Year" i], [aria-label*="Ano" i]').first
            try:
                year_dd.select_option(value=str(int(birth_year)))
            except Exception:
                year_dd.click()
                time.sleep(0.5)
                # Ano precisa scroll — clica o texto diretamente
                page.locator('[role="option"]:has-text("' + str(int(birth_year)) + '")').first.click()

            time.sleep(random.uniform(0.8, 1.5))
        except Exception as e:
            update_status(2, 'Erro data: ' + str(e)[:80], done=True, error='form_data')
            browser.close()
            return status

        _check_cancel()

        # === STEP 3: Email ===
        update_status(3, 'Preenchendo email...')
        print('[3/5] Email: ' + email)

        try:
            em = page.locator('input[name="email"], input[type="email"], input[placeholder*="mail" i]').first
            em.click()
            human_type(page, email)
            time.sleep(random.uniform(0.5, 1))
        except Exception as e:
            update_status(3, 'Erro email: ' + str(e)[:80], done=True, error='form_email')
            browser.close()
            return status

        _check_cancel()

        # === STEP 4: Senha + submit ===
        update_status(4, 'Preenchendo senha...')
        print('[4/5] Enviando...')

        try:
            pw = page.locator('input[type="password"], input[placeholder*="senha" i], input[placeholder*="password" i]').first
            pw.click()
            human_type(page, password)
            time.sleep(random.uniform(0.8, 1.5))

            submit = page.locator('button[type="submit"], button:has-text("Enviar"), button:has-text("Send"), button:has-text("Continuar")').first
            submit.click()
        except Exception as e:
            update_status(4, 'Erro submit: ' + str(e)[:80], done=True, error='submit')
            browser.close()
            return status

        time.sleep(random.uniform(4, 7))
        _check_cancel()

        # === STEP 5: Aguardar codigo/captcha/sucesso ===
        update_status(5, 'Aguardando codigo ou verificacao...')
        print('[5/5] Aguardando TikTok processar...')

        conta_criada = False
        for i in range(180):  # 6 min
            _check_cancel()
            time.sleep(2)
            try:
                url = page.url
                # TikTok home ou "for you"
                if '/foryou' in url or url == 'https://www.tiktok.com/' or '/following' in url:
                    conta_criada = True
                    print('  -> Home do TikTok detectada!')
                    break
                # Captcha slide-puzzle
                if page.locator('text=arraste, text=slide, [class*="captcha"]').first.is_visible(timeout=500):
                    update_status(5, 'Resolva o captcha no navegador!')
                # Codigo de email
                if page.locator('input[placeholder*="codigo" i], input[placeholder*="code" i]').first.is_visible(timeout=500):
                    update_status(5, 'ACAO NECESSARIA: digite o codigo de email no TikTok')
            except _CancelError:
                raise
            except Exception as e:
                if i % 30 == 0:
                    log_event('tiktok', 'warn', 'iter_error: ' + str(e)[:120], step=status['step'])

        if conta_criada:
            update_status(5, 'Conta TikTok criada!', done=True, success=True)
            print('\nSUCESSO! ' + email)
        else:
            update_status(5, 'Timeout (6min) — verifique navegador', done=True, error='timeout')
            print('\nTimeout.')

        time.sleep(10)
        browser.close()
    except _CancelError:
      print('[CANCEL] TikTok: cancelado pelo usuario')
      update_status(status['step'], 'Cancelado pelo usuario', done=True, error='Cancelado pelo usuario')

    return status


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 6:
        print('Uso: python auto_tiktok.py <email> <password> <birth_month> <birth_day> <birth_year>')
        sys.exit(1)
    create_account(*sys.argv[1:6])
