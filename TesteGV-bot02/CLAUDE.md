# Green BOT — Sistema de Onboarding

## Resumo
SPA que guia novos funcionarios de multinacional na criacao de contas em redes sociais e e-mail corporativo. Interface com tema dark, floresta parallax, animacoes cinematicas. Automacao via Playwright (bots Python) para ProtonMail + Instagram. Scaffolds (nao testados) para Facebook e TikTok.

## Stack
- HTML5 + Tailwind CSS v3 (CDN) + JavaScript vanilla (ES5)
- Persistencia: localStorage (sem backend)
- Build: nenhum — abrir `index.html` direto ou `python -m http.server`
- Deploy: GitHub Pages (https://xghruond.github.io/TesteGV-bot02/)

## Padroes Obrigatorios
- **Namespace global `App`** — todos os componentes estendem `App` (ex: `App.renderForm`)
- **IIFE no app.js** — estado privado, sem poluicao do escopo global
- **Event delegation** — listener unico no `document` com `data-action` + `e.target.closest()`
- **Toggles** — usar `style.display` em vez de `classList.toggle('hidden')`
- **Cache-busting** — scripts usam `?v=N` no index.html. INCREMENTAR ao alterar JS/CSS
- **HTML via string concat** — componentes retornam strings HTML, sem template engine

## Git
- **Repo**: https://github.com/xghruond/TesteGV-bot02
- **Branch**: master
- **Git root**: `C:\` com `core.worktree` apontando para `TesteGV-bot02/`
- **Caminhos git**: usar relativos a `C:\` (ex: `git add TesteGV-bot02/js/app.js`)
- **Commits**: em portugues, prefixos feat/fix/chore

## Estrutura (10.605 linhas)
```
TesteGV-bot02/
├── index.html              (98 linhas)   — SPA shell + splash screen
├── CLAUDE.md               — Este arquivo
├── ARCHITECTURE.md         — Documentacao tecnica detalhada
├── MEMORY.md               — Contexto de negocio e decisoes
├── .gitignore
├── server.py               (292 linhas)  — Servidor HTTP multi-threaded + API bots
├── bot_utils.py            (71 linhas)   — retry + log_event compartilhado
├── auto_protonmail.py      (764 linhas)  — Bot ProtonMail + login Tutanota para verificacao
├── auto_instagram.py       (1900 linhas) — Bot Instagram + ProtonMail login + SMS via sms24.me
├── auto_tutanota.py        (395 linhas)  — Bot Tutanota (usado para verificacao ProtonMail)
├── css/
│   └── styles.css          (1419 linhas) — Animacoes, print, dark theme
├── js/
│   ├── data.js             (1049 linhas) — Plataformas, icones, helpers
│   ├── storage.js          (148 linhas)  — localStorage + favoritos + fila CSV + version 6
│   ├── particles.js        (200 linhas)  — Canvas de particulas
│   ├── app.js              (3158 linhas) — Controlador principal (IIFE + event delegation)
│   └── components/
│       ├── header.js       (73 linhas)   — Stepper de progresso
│       ├── form.js         (99 linhas)   — Formulario de dados
│       ├── platform-card.js(184 linhas)  — Cards de plataformas
│       ├── guide-viewer.js (131 linhas)  — Guia passo-a-passo
│       ├── wizard.js       (170 linhas)  — Assistente automatico
│       ├── checklist.js    (69 linhas)   — FAB + drawer de progresso
│       ├── monitor.js      (227 linhas)  — Monitor ao vivo (logs + progresso + screenshot)
│       └── summary.js      (158 linhas)  — Resumo final + export + QR code
└── assets/
    └── logo-gv.png         — Logo oficial HD (1536x1024)
```

## Telas (6)
welcome → form → platforms → guide/wizard → summary → history

## Bots Playwright
| Plataforma | Arquivo | Steps | Status |
|------------|---------|-------|--------|
| ProtonMail | auto_protonmail.py | 6 | Funcional |
| Instagram  | auto_instagram.py  | 8 | Funcional (c/ SMS via sms24.me) |
| Tutanota   | auto_tutanota.py   | 5 | Interno (verificacao ProtonMail) |
| Facebook   | auto_facebook.py   | - | Scaffold (nao testado) |
| TikTok     | auto_tiktok.py     | - | Scaffold (nao testado) |

Endpoints `POST /api/create-<platform>` no server.py (exceto tutanota, que e uso interno).
`POST /api/cancel` seta `_cancel_requested=True` nos 3 bots principais (verificado via `_check_cancel()`).

## Env Vars
- `TUTA_EMAIL` / `TUTA_PASS` — credenciais Tutanota (fallback: teste.greenvillage@tutamail.com)

## Como rodar
```bash
cd c:\TesteGV-bot02
python server.py 8080
# Abrir http://localhost:8080
```

## Testes
```bash
cd c:\TesteGV-bot02
python -m pytest tests/ -v
```

## Skills Disponiveis
- `/audit` — Auditoria completa (syntax, dead code, cache, stale files)
- `/bump-cache` — Incrementa `?v=N` e faz push
- `/sync-docs` — Sincroniza CLAUDE.md, ARCHITECTURE.md e MEMORY.md com estado real
- `/status` — Resumo rapido (git, cache, storage, servidor)
- `/deploy` — Commit + push automatico com mensagem gerada
- `auto-context` (background) — Atualiza memoria automaticamente apos cada tarefa

## Convencoes
- Idioma: Portugues BR
- Commits: `feat:`, `fix:`, `chore:` com descricao em portugues
- Push para GitHub apos cada commit
- Incrementar `?v=N` no index.html ao alterar arquivos JS/CSS

## Auto-Save (IMPORTANTE)
Ao final de CADA tarefa significativa:
1. Atualizar auto-memory em `~/.claude/projects/c--/memory/` se contexto mudou
2. Atualizar CLAUDE.md se estrutura/line counts mudaram significativamente
3. SEMPRE incrementar cache ao alterar JS/CSS
