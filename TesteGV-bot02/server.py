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

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

# Importar bots
sys.path.insert(0, ROOT_DIR)
import auto_protonmail
import auto_instagram
import auto_tutanota
import bot_utils


PROTON_RESERVED = {
    'admin', 'root', 'test', 'info', 'contact', 'support', 'help',
    'noreply', 'no-reply', 'postmaster', 'abuse', 'webmaster',
    'hostmaster', 'security', 'ceo', 'sales', 'proton', 'protonmail'
}


def validate_proton_username(username):
    """Validacao local: regex + tamanho + reservados."""
    import re
    if not username:
        return {'ok': False, 'reason': 'Username vazio'}
    if len(username) < 3:
        return {'ok': False, 'reason': 'Muito curto (minimo 3 caracteres)'}
    if len(username) > 40:
        return {'ok': False, 'reason': 'Muito longo (maximo 40 caracteres)'}
    if not re.match(r'^[a-z0-9][a-z0-9._-]*[a-z0-9]$', username.lower()):
        return {'ok': False, 'reason': 'Formato invalido. Use letras, numeros, ponto, traco, underscore'}
    if username.lower() in PROTON_RESERVED:
        return {'ok': False, 'reason': 'Username reservado. Escolha outro'}
    if '..' in username or '--' in username or '__' in username:
        return {'ok': False, 'reason': 'Sem caracteres especiais repetidos'}
    return {'ok': True, 'reason': 'Username valido'}


class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

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
            # Screenshot ao vivo do bot (se houver page ativa)
            try:
                import base64
                from io import BytesIO
                platform = params.get('platform', 'instagram')
                target = auto_instagram if platform == 'instagram' else (auto_protonmail if platform == 'protonmail' else auto_tutanota)
                page = getattr(target, '_current_page', None)
                if page and not page.is_closed():
                    img_bytes = page.screenshot(type='jpeg', quality=50)
                    b64 = base64.b64encode(img_bytes).decode()
                    return self._json({'img': 'data:image/jpeg;base64,' + b64})
                return self._json({'error': 'No active page'}, 404)
            except Exception as e:
                return self._json({'error': str(e)[:100]}, 500)

        if path == '/api/check-username':
            username = params.get('username', '').strip()
            return self._json(validate_proton_username(username))

        if path == '/api/status':
            platform = params.get('platform', 'protonmail')
            if platform == 'instagram':
                return self._json(auto_instagram.status)
            if platform == 'tutanota':
                return self._json(auto_tutanota.status)
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

        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode() if length > 0 else '{}'
        try:
            data = json.loads(body)
        except:
            data = {}

        if path == '/api/logs/clear':
            bot_utils.clear_logs()
            return self._json({'ok': True})

        if path == '/api/cancel':
            # Sinaliza cancel para os bots (setam flag _cancel_requested)
            auto_instagram._cancel_requested = True
            auto_protonmail._cancel_requested = True
            auto_tutanota._cancel_requested = True
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

        elif path == '/api/create-tutanota':
            username = data.get('username', '')
            password = data.get('password', '')

            if not username or not password:
                return self._json({'error': 'username e password obrigatorios'}, 400)

            auto_tutanota.status.update({
                'step': 0, 'message': 'Iniciando...', 'done': False,
                'success': False, 'error': None,
                'email': username + '@tuta.com', 'password': password
            })

            threading.Thread(
                target=auto_tutanota.create_account,
                args=(username, password),
                daemon=True
            ).start()

            return self._json({'started': True, 'message': 'Automacao Tutanota iniciada!'})

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


if __name__ == '__main__':
    reset_all_status()
    print('=' * 50)
    print('  Green BOT Server')
    print('  http://localhost:' + str(PORT))
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
