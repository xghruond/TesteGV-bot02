"""
Servidor Green BOT — serve arquivos estáticos (5500) + API de automação (3001)
Uso: python server.py
"""
import http.server
import socketserver
import json
import threading
import sys
from urllib.parse import urlparse

# Portas (podem ser passadas como argumento)
STATIC_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
API_PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 3001

# Importar os bots
import auto_protonmail
import auto_instagram

# ============================================================
# API Server (porta 3001) — endpoints de automação
# ============================================================

class APIHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Silenciar logs

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _json_response(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = dict(x.split('=') for x in parsed.query.split('&') if '=' in x) if parsed.query else {}

        if path == '/status':
            platform = params.get('platform', 'protonmail')
            if platform == 'instagram':
                self._json_response(auto_instagram.status)
            else:
                self._json_response(auto_protonmail.status)
        elif path == '/health':
            self._json_response({'ok': True})
        else:
            self._json_response({'error': 'Not found'}, 404)

    def do_POST(self):
        path = urlparse(self.path).path

        if path == '/create-protonmail':
            # Ler body
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode() if length > 0 else '{}'
            try:
                data = json.loads(body)
            except:
                data = {}

            username = data.get('username', '')
            password = data.get('password', '')
            display_name = data.get('displayName', '')

            if not username or not password:
                self._json_response({'error': 'username e password obrigatórios'}, 400)
                return

            # Resetar status
            auto_protonmail.status['step'] = 0
            auto_protonmail.status['message'] = 'Iniciando...'
            auto_protonmail.status['done'] = False
            auto_protonmail.status['success'] = False
            auto_protonmail.status['error'] = None
            auto_protonmail.status['email'] = username + '@proton.me'
            auto_protonmail.status['password'] = password

            # Executar em thread separada
            thread = threading.Thread(
                target=auto_protonmail.create_account,
                args=(username, password, display_name),
                daemon=True
            )
            thread.start()

            self._json_response({
                'started': True,
                'message': 'Automação iniciada! Acompanhe em /status'
            })
        elif path == '/create-instagram':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode() if length > 0 else '{}'
            try:
                data = json.loads(body)
            except:
                data = {}

            email = data.get('email', '')
            password = data.get('password', '')
            full_name = data.get('fullName', '')
            username = data.get('username', '')
            birth_day = data.get('birthDay', '15')
            birth_month = data.get('birthMonth', '6')
            birth_year = data.get('birthYear', '2000')

            if not email or not password:
                self._json_response({'error': 'email e password obrigatórios'}, 400)
                return

            # Resetar status
            auto_instagram.status['step'] = 0
            auto_instagram.status['message'] = 'Iniciando...'
            auto_instagram.status['done'] = False
            auto_instagram.status['success'] = False
            auto_instagram.status['error'] = None

            thread = threading.Thread(
                target=auto_instagram.create_account,
                args=(email, password, full_name, username, birth_day, birth_month, birth_year),
                daemon=True
            )
            thread.start()

            self._json_response({
                'started': True,
                'message': 'Automação Instagram iniciada!'
            })
        else:
            self._json_response({'error': 'Not found'}, 404)


# ============================================================
# Static File Server (porta 5500)
# ============================================================

class StaticHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Log simplificado
        pass


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True
    allow_reuse_port = True


def start_static_server():
    with ReusableTCPServer(('', STATIC_PORT), StaticHandler) as httpd:
        httpd.serve_forever()


def start_api_server():
    with ReusableTCPServer(('', API_PORT), APIHandler) as httpd:
        httpd.serve_forever()


if __name__ == '__main__':
    print('=' * 50)
    print('  Green BOT Server')
    print('  Static: http://localhost:' + str(STATIC_PORT))
    print('  API:    http://localhost:' + str(API_PORT))
    print('=' * 50)
    print('')

    # Iniciar static server em thread
    static_thread = threading.Thread(target=start_static_server, daemon=True)
    static_thread.start()
    print('[OK] Servidor de arquivos rodando na porta ' + str(STATIC_PORT))

    # API server na thread principal
    print('[OK] Servidor de automação rodando na porta ' + str(API_PORT))
    print('')
    print('Abra http://localhost:5500 no navegador')
    print('Pressione Ctrl+C para parar')
    print('')

    try:
        start_api_server()
    except KeyboardInterrupt:
        print('\nServidor parado.')
