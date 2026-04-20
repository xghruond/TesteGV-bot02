"""
Validadores puros — sem dependencia de Playwright ou HTTP.
Usado por server.py e tests/.
"""
import re


PROTON_RESERVED = {
    'admin', 'root', 'test', 'info', 'contact', 'support', 'help',
    'noreply', 'no-reply', 'postmaster', 'abuse', 'webmaster',
    'hostmaster', 'security', 'ceo', 'sales', 'proton', 'protonmail'
}


def validate_proton_username(username):
    """Validacao local: regex + tamanho + reservados."""
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
