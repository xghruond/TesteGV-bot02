"""
Smoke tests — garantia minima de que modulos carregam e APIs basicas
funcionam sem invocar Playwright / rede.

Rodar: cd c:/TesteGV-bot02 && python -m unittest tests.test_smoke -v
Ou (com pytest instalado): python -m pytest tests/ -v

Tests que dependem de Playwright sao auto-skipped se playwright nao carregar.
"""
import os
import sys
import unittest

# Permitir import dos modulos na raiz do projeto
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


# Detectar se Playwright carrega (alguns ambientes Windows tem stdlib quebrado)
try:
    import playwright.sync_api  # noqa: F401
    PLAYWRIGHT_OK = True
    PLAYWRIGHT_ERR = None
except Exception as e:
    PLAYWRIGHT_OK = False
    PLAYWRIGHT_ERR = str(e)[:100]


playwright_required = unittest.skipUnless(
    PLAYWRIGHT_OK, 'Playwright indisponivel: ' + (PLAYWRIGHT_ERR or '?')
)


class TestPureImports(unittest.TestCase):
    """Modulos que nao dependem de Playwright."""

    def test_bot_utils_imports(self):
        import bot_utils
        self.assertTrue(callable(bot_utils.log_event))
        self.assertTrue(callable(bot_utils.retry))
        self.assertTrue(callable(bot_utils.get_logs))
        self.assertTrue(callable(bot_utils.clear_logs))

    def test_validators_imports(self):
        import validators
        self.assertTrue(callable(validators.validate_proton_username))
        self.assertIn('admin', validators.PROTON_RESERVED)


@playwright_required
class TestBotImports(unittest.TestCase):
    """Garantir que bots carregam (requer Playwright)."""

    def test_auto_protonmail_imports(self):
        import auto_protonmail
        self.assertIn('step', auto_protonmail.status)
        self.assertEqual(auto_protonmail.status['total'], 6)
        self.assertTrue(callable(auto_protonmail._check_cancel))

    def test_auto_instagram_imports(self):
        import auto_instagram
        self.assertEqual(auto_instagram.status['total'], 8)
        self.assertTrue(callable(auto_instagram._check_cancel))

    def test_auto_tutanota_imports(self):
        import auto_tutanota
        self.assertEqual(auto_tutanota.status['total'], 5)
        self.assertTrue(callable(auto_tutanota._check_cancel))

    def test_server_imports(self):
        import server
        self.assertTrue(hasattr(server, 'Handler'))
        self.assertTrue(hasattr(server, 'validate_proton_username'))


@playwright_required
class TestCancelFlag(unittest.TestCase):
    """Verificar _check_cancel() nos 3 bots."""

    def _assert_cancel_behavior(self, mod):
        mod._cancel_requested = False
        mod._check_cancel()  # nao levanta
        mod._cancel_requested = True
        self.assertRaises(mod._CancelError, mod._check_cancel)
        mod._cancel_requested = False  # reset

    def test_protonmail_cancel(self):
        import auto_protonmail
        self._assert_cancel_behavior(auto_protonmail)

    def test_instagram_cancel(self):
        import auto_instagram
        self._assert_cancel_behavior(auto_instagram)

    def test_tutanota_cancel(self):
        import auto_tutanota
        self._assert_cancel_behavior(auto_tutanota)


class TestValidateUsername(unittest.TestCase):
    """Validacao de username ProtonMail (validators.py — pura, sem deps)."""

    def setUp(self):
        from validators import validate_proton_username
        self.validate = validate_proton_username

    def test_empty(self):
        r = self.validate('')
        self.assertFalse(r['ok'])

    def test_too_short(self):
        r = self.validate('ab')
        self.assertFalse(r['ok'])
        self.assertIn('curto', r['reason'].lower())

    def test_too_long(self):
        r = self.validate('a' * 50)
        self.assertFalse(r['ok'])
        self.assertIn('longo', r['reason'].lower())

    def test_reserved(self):
        for name in ('admin', 'root', 'postmaster', 'proton'):
            r = self.validate(name)
            self.assertFalse(r['ok'], 'esperado reservado: ' + name)

    def test_valid(self):
        for name in ('joao.silva', 'greenvillage', 'ana_maria', 'user-123'):
            r = self.validate(name)
            self.assertTrue(r['ok'], 'esperado valido: ' + name + ' (' + r['reason'] + ')')

    def test_invalid_chars(self):
        for name in ('joao@silva', 'ana silva', 'user!', '..bad'):
            r = self.validate(name)
            self.assertFalse(r['ok'], 'esperado invalido: ' + name)

    def test_repeated_specials(self):
        r = self.validate('a..b')
        self.assertFalse(r['ok'])


class TestLogsBuffer(unittest.TestCase):
    """Buffer circular de logs (bot_utils)."""

    def setUp(self):
        import bot_utils
        self.m = bot_utils
        self.m.clear_logs()

    def test_log_and_get(self):
        self.m.log_event('test', 'info', 'hello')
        logs = self.m.get_logs()
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]['bot'], 'test')
        self.assertEqual(logs[0]['level'], 'info')
        self.assertEqual(logs[0]['message'], 'hello')

    def test_circular_cap(self):
        # Empurra mais que LOGS_MAX e confirma cap
        for i in range(self.m.LOGS_MAX + 50):
            self.m.log_event('test', 'info', 'msg ' + str(i))
        logs = self.m.get_logs()
        self.assertEqual(len(logs), self.m.LOGS_MAX)
        # Primeiro deve ser o 50-esimo (os primeiros 50 foram descartados)
        self.assertEqual(logs[0]['message'], 'msg 50')

    def test_clear(self):
        self.m.log_event('test', 'info', 'x')
        self.m.clear_logs()
        self.assertEqual(len(self.m.get_logs()), 0)


class TestRetry(unittest.TestCase):
    """retry() com backoff."""

    def setUp(self):
        import bot_utils
        self.retry = bot_utils.retry
        bot_utils.clear_logs()

    def test_first_try_success(self):
        calls = []
        def op():
            calls.append(1)
            return 'ok'
        result = self.retry(op, tries=3, initial_delay=0.01)
        self.assertEqual(result, 'ok')
        self.assertEqual(len(calls), 1)

    def test_eventual_success(self):
        calls = []
        def op():
            calls.append(1)
            if len(calls) < 3:
                raise RuntimeError('still failing')
            return 'recovered'
        result = self.retry(op, tries=5, initial_delay=0.01, backoff=1)
        self.assertEqual(result, 'recovered')
        self.assertEqual(len(calls), 3)

    def test_all_fail_reraises(self):
        def op():
            raise ValueError('boom')
        self.assertRaises(ValueError, self.retry, op, tries=2, initial_delay=0.01)


if __name__ == '__main__':
    unittest.main(verbosity=2)
