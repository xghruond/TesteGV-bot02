# Green BOT — Sistema de Onboarding

## Resumo
SPA que guia novos funcionarios de multinacional na criacao de contas Gmail, Instagram, Facebook e TikTok. Interface com tema dark, floresta parallax, animacoes cinematicas.

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

## Estrutura (4.309 linhas)
```
TesteGV-bot02/
├── index.html              (96 linhas)  — SPA shell + splash screen
├── CLAUDE.md               — Este arquivo
├── ARCHITECTURE.md         — Documentacao tecnica detalhada
├── MEMORY.md               — Contexto de negocio e decisoes
├── .gitignore
├── css/
│   └── styles.css          (1026 linhas) — Animacoes, print, dark theme
├── js/
│   ├── data.js             (725 linhas)  — Plataformas, icones, helpers
│   ├── storage.js          (76 linhas)   — localStorage + version check
│   ├── particles.js        (200 linhas)  — Canvas de particulas
│   ├── app.js              (1393 linhas) — Controlador principal
│   └── components/
│       ├── header.js       (65 linhas)   — Stepper de progresso
│       ├── form.js         (88 linhas)   — Formulario de dados
│       ├── platform-card.js(178 linhas)  — Cards de plataformas
│       ├── guide-viewer.js (105 linhas)  — Guia passo-a-passo
│       ├── wizard.js       (150 linhas)  — Assistente automatico
│       ├── checklist.js    (69 linhas)   — FAB + drawer de progresso
│       └── summary.js      (138 linhas)  — Resumo final + export
└── assets/
    ├── logo-gv.png         — Logo oficial HD (1536x1024)
    └── icons/              — Icones SVG
```

## Telas (6)
welcome → form → platforms → guide/wizard → summary → history

## Como rodar
```bash
cd c:\TesteGV-bot02
python -m http.server 5500
# Abrir http://localhost:5500
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
