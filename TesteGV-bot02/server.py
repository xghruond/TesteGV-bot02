"""
Servidor Green BOT — porta unica, arquivos estaticos + API
Uso: python server.py [porta]
"""
import http.server
import socketserver
import json
import threading
import sys
import os
import mimetypes
import functools
from urllib.parse import urlparse

print = functools.partial(print, flush=True)

# Parse PORT so que quando rodando como script (evita quebrar imports em testes)
def _parse_port():
    if len(sys.argv) > 1:
        try:
            return int(sys.argv[1])
        except ValueError:
            return 8080
    return 8080

PORT = _parse_port()
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

# Auth opt-in: se GV_API_TOKEN setado, POST /api/* exige header X-API-Token
# Se nao setado, endpoints ficam abertos (compatibilidade com uso local)
API_TOKEN = os.environ.get('GV_API_TOKEN', '').strip()

# Importar bots
sys.path.insert(0, ROOT_DIR)
import auto_protonmail
import auto_instagram
import auto_tutanota
import auto_facebook
import auto_tiktok
import bot_utils
from validators import validate_proton_username


class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-API-Token')

    def _auth_ok(self):
        """True se auth desabilitada OU header X-API-Token bate com GV_API_TOKEN."""
        if not API_TOKEN:
            return True
        provided = (self.headers.get('X-API-Token') or '').strip()
        return provided == API_TOKEN

    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _serve_file(self, filepath):
        """Servir arquivo estatico"""
        if not os.path.isfile(filepath):
            self.send_error(404, 'File not found')
            return
        mime, _ = mimetypes.guess_type(filepath)
        if not mime:
            mime = 'application/octet-stream'
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.end_headers()
        with open(filepath, 'rb') as f:
            self.wfile.write(f.read())

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = dict(x.split('=') for x in parsed.query.split('&') if '=' in x) if parsed.query else {}

        # === API ===
        if path == '/api/health':
            return self._json({'ok': True})

        if path == '/api/connectivity':
            # Checar acessibilidade dos servicos externos
            import urllib.request
            services = {
                'protonmail': 'https://account.proton.me/signup',
                'tutanota': 'https://app.tuta.com/login',
                'instagram': 'https://www.instagram.com/accounts/emailsignup/'
            }
            result = {}
            for name, url in services.items():
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    resp = urllib.request.urlopen(req, timeout=4)
                    result[name] = {
                        'ok': True,
                        'status': resp.getcode()
                    }
                except Exception as e:
                    result[name] = {
                        'ok': False,
                        'error': str(e)[:80]
                    }
            return self._json(result)

        if path == '/api/logs':
            # Opcao de limit para pegar so os N ultimos
            limit = int(params.get('limit', '50'))
            logs = bot_utils.get_logs()
            return self._json({'logs': logs[-limit:] if limit > 0 else logs})

        if path == '/api/screenshot':
            # Screenshot ao vivo do bot (se houver page ativa).
            # Race condition: page pode ser fechada entre is_closed() e screenshot()
            # por isso o try interno especifico captura o caso.
            import base64
            platform = params.get('platform', 'instagram')
            if platform not in ('instagram', 'protonmail', 'tutanota', 'facebook', 'tiktok'):
                return self._json({'error': 'platform invalido'}, 400)
            target = {'instagram': auto_instagram, 'protonmail': auto_protonmail,
                      'tutanota': auto_tutanota, 'facebook': auto_facebook,
                      'tiktok': auto_tiktok}[platform]
            page = getattr(target, '_current_page', None)
            if not page:
                return self._json({'error': 'no_active_page'}, 404)
            try:
                if page.is_closed():
                    return self._json({'error': 'page_closed'}, 404)
                img_bytes = page.screenshot(type='jpeg', quality=50)
            except Exception as e:
                # Page fechou entre check e screenshot, ou erro de rede
                return self._json({'error': 'screenshot_failed', 'detail': str(e)[:120]}, 503)
            b64 = base64.b64encode(img_bytes).decode()
            return self._json({'img': 'data:image/jpeg;base64,' + b64})

        if path == '/api/check-username':
            username = params.get('username', '').strip()
            return self._json(validate_proton_username(username))

        if path == '/api/status':
            platform = params.get('platform', 'protonmail')
            if platform == 'instagram':
                return self._json(auto_instagram.status)
            if platform == 'tutanota':
                return self._json(auto_tutanota.status)
            if platform == 'facebook':
                return self._json(auto_facebook.status)
            if platform == 'tiktok':
                return self._json(auto_tiktok.status)
            return self._json(auto_protonmail.status)

        # === Arquivos estaticos ===
        if path == '/':
            path = '/index.html'

        filepath = os.path.join(ROOT_DIR, path.lstrip('/').replace('/', os.sep))
        filepath = os.path.normpath(filepath)

        # Seguranca: nao servir fora do ROOT_DIR
        if not filepath.startswith(ROOT_DIR):
            self.send_error(403, 'Forbidden')
            return

        self._serve_file(filepath)

    def do_POST(self):
        path = urlparse(self.path).path
        print('[API] POST ' + path)

        if not self._auth_ok():
            return self._json({'error': 'Token invalido ou ausente (X-API-Token)'}, 401)

        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode() if length > 0 else '{}'
        try:
            data = json.loads(body)
        except json.JSONDecodeError as e:
            print('[API] JSON invalido em ' + path + ': ' + str(e)[:80])
            return self._json({'error': 'JSON invalido'}, 400)

        if path == '/api/logs/clear':
            bot_utils.clear_logs()
            return self._json({'ok': True})

        if path == '/api/cancel':
            # Sinaliza cancel para os bots (flag verificada em _check_cancel())
            auto_instagram._cancel_requested = True
            auto_protonmail._cancel_requested = True
            auto_tutanota._cancel_requested = True
            auto_facebook._cancel_requested = True
            auto_tiktok._cancel_requested = True
            # Feedback imediato no status (UI atualiza antes do bot reagir de fato)
            for mod in (auto_instagram, auto_protonmail, auto_tutanota, auto_facebook, auto_tiktok):
                if not mod.status.get('done'):
                    mod.status.update({'message': 'Cancelando...'})
            return self._json({'ok': True, 'msg': 'Cancelamento solicitado'})

        if path == '/api/create-protonmail':
            username = data.get('username', '')
            password = data.get('password', '')
            display_name = data.get('displayName', '')

            if not username or not password:
                return self._json({'error': 'username e password obrigatorios'}, 400)

            auto_protonmail.status.update({
                'step': 0, 'message': 'Iniciando...', 'done': False,
                'success': False, 'error': None,
                'email': username + '@proton.me', 'password': password
            })

            threading.Thread(
                target=auto_protonmail.create_account,
                args=(username, password, display_name),
                daemon=True
            ).start()

            return self._json({'started': True, 'message': 'Automacao ProtonMail iniciada!'})

        elif path == '/api/create-instagram':
            email = data.get('email', '')
            password = data.get('password', '')
            full_name = data.get('fullName', '')
            username = data.get('username', '')
            birth_day = data.get('birthDay', '15')
            birth_month = data.get('birthMonth', '6')
            birth_year = data.get('birthYear', '2000')

            if not email or not password:
                return self._json({'error': 'email e password obrigatorios'}, 400)

            auto_instagram.status.update({
                'step': 0, 'message': 'Iniciando...', 'done': False,
                'success': False, 'error': None
            })

            threading.Thread(
                target=auto_instagram.create_account,
                args=(email, password, full_name, username, birth_day, birth_month, birth_year),
                daemon=True
            ).start()

            return self._json({'started': True, 'message': 'Automacao Instagram iniciada!'})

        elif path == '/api/create-facebook':
            # SCAFFOLD — seletores nao testados contra live site
            email = data.get('email', '')
            password = data.get('password', '')
            first_name = data.get('firstName', '')
            last_name = data.get('lastName', '')
            birth_day = data.get('birthDay', '15')
            birth_month = data.get('birthMonth', '6')
            birth_year = data.get('birthYear', '2000')

            if not email or not password or not first_name:
                return self._json({'error': 'email, password e firstName obrigatorios'}, 400)

            auto_facebook.status.update({
                'step': 0, 'message': 'Iniciando...', 'done': False,
                'success': False, 'error': None, 'email': email, 'password': password
            })

            threading.Thread(
                target=auto_facebook.create_account,
                args=(email, password, first_name, last_name, birth_day, birth_month, birth_year),
                daemon=True
            ).start()

            return self._json({'started': True, 'message': 'Automacao Facebook iniciada (BETA)!'})

        elif path == '/api/create-tiktok':
            # SCAFFOLD — seletores nao testados contra live site
            email = data.get('email', '')
            password = data.get('password', '')
            birth_month = data.get('birthMonth', '6')
            birth_day = data.get('birthDay', '15')
            birth_year = data.get('birthYear', '2000')

            if not email or not password:
                return self._json({'error': 'email e password obrigatorios'}, 400)

            auto_tiktok.status.update({
                'step': 0, 'message': 'Iniciando...', 'done': False,
                'success': False, 'error': None, 'email': email, 'password': password
            })

            threading.Thread(
                target=auto_tiktok.create_account,
                args=(email, password, birth_month, birth_day, birth_year),
                daemon=True
            ).start()

            return self._json({'started': True, 'message': 'Automacao TikTok iniciada (BETA)!'})

        else:
            return self._json({'error': 'Endpoint nao encontrado'}, 404)


class ReusableServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def reset_all_status():
    """Resetar status de todos os bots ao iniciar o servidor"""
    auto_protonmail.status.update({
        'step': 0, 'total': 6, 'message': 'Aguardando...', 'done': False,
        'success': False, 'error': None, 'email': '', 'password': ''
    })
    auto_instagram.status.update({
        'step': 0, 'total': 8, 'message': 'Aguardando...', 'done': False,
        'success': False, 'error': None
    })
    auto_tutanota.status.update({
        'step': 0, 'total': 5, 'message': 'Aguardando...', 'done': False,
        'success': False, 'error': None, 'email': '', 'password': ''
    })
    auto_facebook.status.update({
        'step': 0, 'total': 6, 'message': 'Aguardando...', 'done': False,
        'success': False, 'error': None, 'email': '', 'password': ''
    })
    auto_tiktok.status.update({
        'step': 0, 'total': 5, 'message': 'Aguardando...', 'done': False,
        'success': False, 'error': None, 'email': '', 'password': ''
    })


if __name__ == '__main__':
    reset_all_status()
    print('=' * 50)
    print('  Green BOT Server')
    print('  http://localhost:' + str(PORT))
    if API_TOKEN:
        print('  [AUTH] POST /api/* exige header X-API-Token')
    else:
        print('  [AUTH] Desabilitada (sete GV_API_TOKEN para ativar)')
    print('=' * 50)

    try:
        with ReusableServer(('', PORT), Handler) as httpd:
            print('[OK] Rodando na porta ' + str(PORT))
            print('Abra http://localhost:' + str(PORT))
            print('')
            httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nParado.')
    except OSError as e:
        print('ERRO: Porta em uso. Tente: python server.py ' + str(PORT + 10))
