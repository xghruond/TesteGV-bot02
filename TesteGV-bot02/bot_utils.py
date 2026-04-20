"""
Utilitarios compartilhados pelos bots Playwright.
- retry(): tenta operacao N vezes com backoff exponencial
- log_event(): escreve em buffer circular (lido por /api/logs) + arquivo rotativo
  em logs/botlog-YYYY-MM-DD.jsonl (persistencia entre reinicios)
"""
import os
import json
import time
import threading
import datetime


# Buffer circular de logs estruturados (lido por /api/logs)
LOGS_MAX = 200
logs_buffer = []
logs_lock = threading.Lock()

# Persistencia em arquivo (JSONL rotativo por dia)
LOGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
_logs_dir_ensured = False


def _ensure_logs_dir():
    global _logs_dir_ensured
    if _logs_dir_ensured:
        return
    try:
        os.makedirs(LOGS_DIR, exist_ok=True)
        _logs_dir_ensured = True
    except OSError:
        # Se nao conseguir criar, desiste silenciosamente (buffer em memoria ainda funciona)
        _logs_dir_ensured = True  # nao tenta de novo


def _log_file_path():
    return os.path.join(LOGS_DIR, 'botlog-' + datetime.date.today().isoformat() + '.jsonl')


def log_event(bot, level, message, step=None, extra=None):
    """Registra evento no buffer + arquivo. level: info | warn | error"""
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
    # Persistencia em arquivo (fora do lock pra nao bloquear leitores)
    _ensure_logs_dir()
    try:
        with open(_log_file_path(), 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    except OSError:
        pass  # disco cheio / permissao — buffer em memoria ainda funciona


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


