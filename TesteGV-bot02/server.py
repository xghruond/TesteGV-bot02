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

        if path == '/api/status':
            platform = params.get('platform', 'protonmail')
            if platform == 'instagram':
                return self._json(auto_instagram.status)
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

        else:
            return self._json({'error': 'Endpoint nao encontrado'}, 404)


class ReusableServer(socketserver.TCPServer):
    allow_reuse_address = True


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
