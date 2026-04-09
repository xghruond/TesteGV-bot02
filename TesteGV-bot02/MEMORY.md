# Memória do Projeto — Green BOT

## Contexto de Negócio

Sistema de onboarding para **Green Village Mobile Homes** (multinacional). Cada novo funcionário precisa criar contas profissionais em 4 plataformas. Muitos são novos em tecnologia — o sistema guia passo a passo e automatiza o que for possível.

## Dados do Projeto

| Campo | Valor |
|-------|-------|
| **Repositório** | https://github.com/xghruond/TesteGV-bot02 |
| **Deploy** | https://xghruond.github.io/TesteGV-bot02/ |
| **Branch** | `master` |
| **Git root** | `C:\` com `core.worktree` → `TesteGV-bot02/` |
| **Stack** | HTML5 + Tailwind CSS 3 (CDN) + JS vanilla (ES5) |
| **Backend** | Python `http.server` + Playwright (opcional) |
| **Persistência** | localStorage (`gv-onboarding-state`, VERSION 4) |
| **Build** | Nenhum |
| **Cache** | `?v=93` |
| **Total** | 17 arquivos, 5.911 linhas |
| **Idioma** | Português BR |

## Plataformas e Automação

| Plataforma | Steps (guide) | Bot Playwright | Status |
|------------|:---:|:---:|---|
| **ProtonMail** | 6 | `auto_protonmail.py` (semi-auto, 6 steps) | Funcional — humano resolve CAPTCHA |
| **Instagram** | 5 | `auto_instagram.py` (semi-auto, 8 steps) | Funcional — humano resolve CAPTCHA |
| **Facebook** | 4 | — | Manual apenas |
| **TikTok** | 5 | — | Manual apenas |

### Modo Semi-Automático

Bots Playwright preenchem formulário automaticamente (username, senha, nome), mas **pausam no CAPTCHA** para intervenção humana. A interface mostra modal com progresso em tempo real (polling a cada 2s). Se o servidor não estiver rodando, cai para modo manual automaticamente.

### ProtonMail — Limitações Conhecidas

- ProtonMail detecta automação e bane IPs (mensagem "abusive traffic")
- Bans duram ~24-48h; trocar IP via VPN contorna
- Bot usa Chrome real (não Chromium), sem incógnito, com delays humanizados
- Removido: Mail.gw (email temporário) — não confiável, causava mais bans

## Telas (7)

```
welcome → form → platforms → guide/wizard → summary → history
```

| Tela | Descrição |
|------|-----------|
| **Welcome** | Splash com logo HD, parallax floresta, partículas canvas |
| **Form** | 7 campos + validação visual + chips de sugestão de email |
| **Platforms** | Grid 2x2 com cards coloridos e barra de progresso |
| **Guide** | Passo a passo manual com ferramenta de senha |
| **Wizard** | Assistente automático + integração com bots |
| **Summary** | Relatório final — export TXT/PDF/copiar |
| **History** | Lista de onboardings anteriores (localStorage) |

## Funcionalidades Implementadas

- Splash screen com logo HD + backdrop-filter blur
- Formulário com 7 campos + "Gerar Dados de Teste"
- Sugestão de email via chips (gerados do nome completo)
- Stepper de progresso (círculos numerados + labels)
- Cards de plataforma com stagger animation + cores por plataforma
- Dois modos: Guide (manual) e Wizard (automação)
- Automação ProtonMail + Instagram via Playwright (semi-auto)
- Modal de progresso com polling em tempo real
- Fallback manual se servidor offline
- Ferramenta de geração de senha segura
- Celebração ao completar plataforma (confetti)
- Resumo final: export TXT/PDF, copiar clipboard
- Histórico de onboardings completos
- Validação visual em tempo real (borda verde/vermelha no blur)
- Floresta parallax 3 camadas com profundidade por tela
- Partículas canvas na welcome screen
- Persistência completa via localStorage (retomar sessão)
- Tema dark consistente com glass morphism

## Decisões Técnicas Importantes

| Decisão | Motivo |
|---------|--------|
| Sem framework | Zero build, funciona em `file://`, deploy por cópia |
| Namespace global `App` | Compatível sem ES modules |
| IIFE no app.js | Estado privado, sem poluição global |
| Event delegation | Listener único no document, funciona com render dinâmico |
| `style.display` para toggles | Em vez de `classList.toggle('hidden')` |
| String concat para HTML | Simples, sem template engine |
| Chrome real (não Chromium) | Menos detecção de automação pelo ProtonMail |
| Semi-automático (CAPTCHA manual) | Evita bans de IP por resolver CAPTCHA automaticamente |

## Histórico de Evolução

| Fase | Período | Marcos |
|------|---------|--------|
| **v1 — MVP** | Mar/2026 | Interface base, 4 plataformas (Gmail), tema dark, parallax |
| **v2 — Twilio** | Mar/2026 | Integração SMS Twilio para verificação (removido depois) |
| **v3 — ProtonMail** | Mar/2026 | Substituiu Gmail por ProtonMail (sem verificação por SMS) |
| **v4 — Playwright** | Abr/2026 | Bots de automação ProtonMail + Instagram |
| **v5 — Semi-auto** | Abr/2026 | CAPTCHA manual, removido Mail.gw, polling com erro handling |

### Removido

- **Twilio/SMS** (01/04/2026) — backend, twilio.js, modais, handlers
- **Gmail** — substituído por ProtonMail (não exige telefone)
- **Mail.gw** — email temporário para verificação automática (instável, causava bans)
- **Modo incógnito** — aumentava detecção de automação
- **`assets/icons/`** — pasta vazia (ícones são inline SVG no data.js)

## Como Rodar

### Frontend apenas (manual)
```bash
# Opção 1: abrir direto
start index.html

# Opção 2: servidor simples
cd c:\TesteGV-bot02
python -m http.server 5500
```

### Com automação
```bash
cd c:\TesteGV-bot02
python server.py          # http://localhost:8080
# Requer: pip install playwright requests && playwright install chromium
# Requer: Chrome instalado no caminho padrão
```

## Git

- **Root**: `C:\` com worktree — usar `cd /c` para git commands
- **Caminhos**: relativos a `C:\` (ex: `git add TesteGV-bot02/js/app.js`)
- **Commits**: em português, prefixos `feat:`, `fix:`, `chore:`
- **Push**: após cada commit significativo

## Documentação Relacionada

- [ARCHITECTURE.md](ARCHITECTURE.md) — Arquitetura técnica detalhada (namespace, estado, componentes, APIs, extensibilidade)
- [CLAUDE.md](CLAUDE.md) — Instruções para Claude Code (padrões, skills, convenções)
