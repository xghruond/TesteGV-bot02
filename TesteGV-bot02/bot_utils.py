"""
Utilitarios compartilhados pelos bots Playwright.
- retry(): tenta operacao N vezes com backoff exponencial
- log_event(): escreve em buffer circular lido por /api/logs
"""
import time
import threading
import datetime


# Buffer circular de logs estruturados (lido por /api/logs)
LOGS_MAX = 200
logs_buffer = []
logs_lock = threading.Lock()


def log_event(bot, level, message, step=None, extra=None):
    """Registra evento no buffer. level: info | warn | error"""
    entry = {
        'ts': datetime.datetime.now().isoformat(timespec='seconds'),
        'bot': bot,
        'level': level,
        'message': message,
        'step': step,
        'extra': extra or {}
    }
    with logs_lock:
        logs_buffer.append(entry)
        if len(logs_buffer) > LOGS_MAX:
            logs_buffer.pop(0)


def get_logs():
    with logs_lock:
        return list(logs_buffer)


def clear_logs():
    with logs_lock:
        logs_buffer.clear()


def retry(op, tries=3, backoff=1.5, initial_delay=0.5, label='op', bot='unknown'):
    """
    Executa op() ate que tenha sucesso ou estoure tentativas.
    Retorna o resultado da op ou levanta a ultima excecao.
    Loga cada tentativa que falhar.
    """
    delay = initial_delay
    last_exc = None
    for attempt in range(1, tries + 1):
        try:
            result = op()
            if attempt > 1:
                log_event(bot, 'info', label + ' ok apos retry', extra={'attempt': attempt})
            return result
        except Exception as e:
            last_exc = e
            log_event(
                bot, 'warn',
                label + ' falhou (tentativa ' + str(attempt) + '/' + str(tries) + ')',
                extra={'error': str(e)[:120]}
            )
            if attempt < tries:
                time.sleep(delay)
                delay *= backoff
    log_event(bot, 'error', label + ' falhou apos ' + str(tries) + ' tentativas',
              extra={'error': str(last_exc)[:120]})
    raise last_exc


