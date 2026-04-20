# Arquitetura — Green BOT Sistema de Onboarding

## 1. Visão Geral

SPA que guia novos funcionários de multinacional na criação de contas profissionais em 4 plataformas: **ProtonMail**, **Instagram**, **Facebook** e **TikTok**. Inclui bots Playwright para automação semi-automática de ProtonMail e Instagram.

### Stack

| Camada | Tecnologia | Motivo |
|--------|-----------|--------|
| Frontend | HTML5 + Tailwind CSS 3 (CDN) + JS vanilla (ES5) | Zero build, deploy por cópia |
| Persistência | localStorage | Sem backend, retomar sessão |
| Servidor | Python (`http.server`) | Serve arquivos + API para bots |
| Automação | Playwright (Python) | Preenche formulários das plataformas |
| Deploy | GitHub Pages (frontend apenas) | Gratuito, automático |

### Decisões Técnicas

- **Sem framework** — zero build step, compatível com `file://`
- **Namespace global `App`** — organização sem ES modules
- **IIFE no app.js** — estado privado, sem poluição global
- **String concat para HTML** — simples, sem template engine
- **Dois modos de operação** — com servidor (automação) ou sem (manual)

---

## 2. Estrutura de Arquivos (10.605 linhas)

```
TesteGV-bot02/
├── index.html              (98)    — SPA shell + splash screen
├── server.py               (292)   — Servidor HTTP multi-threaded + API bots
├── bot_utils.py            (71)    — retry + log_event compartilhado
├── auto_protonmail.py      (764)   — Bot Playwright ProtonMail + login Tuta verificacao
├── auto_instagram.py       (1900)  — Bot Instagram + SMS via sms24.me + ProtonMail login
├── auto_tutanota.py        (395)   — Bot Tutanota (uso interno p/ verificacao ProtonMail)
├── auto_facebook.py        (-)     — Scaffold (nao testado contra live site)
├── auto_tiktok.py          (-)     — Scaffold (nao testado contra live site)
├── css/
│   └── styles.css          (1419)  — Animacoes, print, dark theme, parallax
├── js/
│   ├── data.js             (1049)  — Plataformas, icones SVG, helpers
│   ├── storage.js          (148)   — localStorage + favoritos + fila CSV + version 6
│   ├── particles.js        (200)   — Canvas de particulas (welcome screen)
│   ├── app.js              (3158)  — Controlador principal (estado, rotas, eventos)
│   └── components/
│       ├── header.js       (73)    — Stepper de progresso
│       ├── form.js         (99)    — Formulario de dados + chips de email
│       ├── platform-card.js(184)   — Cards de plataformas com cores
│       ├── guide-viewer.js (131)   — Guia passo-a-passo + ferramenta de senha
│       ├── wizard.js       (170)   — Assistente automatico (modo wizard)
│       ├── checklist.js    (69)    — FAB + drawer de progresso
│       ├── monitor.js      (227)   — Monitor ao Vivo (logs + progresso + screenshot)
│       └── summary.js      (158)   — Resumo final + export TXT/PDF/QR
├── tests/                          — pytest smoke tests (server + bots)
├── assets/
│   └── logo-gv.png                 — Logo oficial HD (1536x1024)
├── CLAUDE.md                       — Instrucoes para Claude Code
├── ARCHITECTURE.md                 — Este documento
├── MEMORY.md                       — Contexto de negocio e decisoes
└── .claude/skills/                 — Skills customizadas (/audit, /deploy, etc.)
```

---

## 3. Arquitetura do Sistema

### Modo Manual (GitHub Pages / file://)

```
┌─────────────┐
│  index.html │ ← Usuário abre no navegador
│  + JS/CSS   │
│             │ ← Guia passo a passo
│ localStorage│ ← Persiste estado
└─────────────┘
```

### Modo Automação (com server.py)

```
┌─────────────┐    POST /api/create-protonmail     ┌──────────────────┐
│             │ ──────────────────────────────────→ │   server.py      │
│  Interface  │                                     │   porta 8080     │
│  (browser)  │    GET /api/status                  │                  │
│             │ ←─────────────────────────────────  │  ┌────────────┐  │
│             │    { step, message, done, success }  │  │ Thread:    │  │
│  Modal de   │                                     │  │ Playwright │  │
│  progresso  │    polling 2s                        │  │ (Chrome)   │  │
└─────────────┘                                     │  └────────────┘  │
                                                    └──────────────────┘
```

### API do Servidor

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check |
| GET | `/api/status?platform=protonmail` | Status do bot ProtonMail |
| GET | `/api/status?platform=instagram` | Status do bot Instagram |
| POST | `/api/create-protonmail` | Iniciar automação ProtonMail |
| POST | `/api/create-instagram` | Iniciar automação Instagram |
| GET | `/*` | Arquivos estáticos |

---

## 4. Namespace Global (`App`)

Todos os arquivos estendem `var App = App || {};`.

| Propriedade | Arquivo | Tipo | Descrição |
|------------|---------|------|-----------|
| `App.icons` | data.js | Object | ~21 ícones SVG inline |
| `App.platforms` | data.js | Object | 4 plataformas com steps |
| `App.formFields` | data.js | Array | 7 campos do formulário |
| `App.departmentLabels` | data.js | Object | Tradução de departamentos |
| `App.generateEmailVariations` | data.js | Function | Gera ~15 sugestões de email |
| `App.generatePassword` | data.js | Function | Gera senha segura aleatória |
| `App.escapeHtml` | data.js | Function | Sanitiza strings para HTML |
| `App.storage` | storage.js | Object | save/load/clear + histórico |
| `App.initParticles` | particles.js | Function | Canvas de partículas |
| `App.renderHeader` | header.js | Function → HTML | Stepper de progresso |
| `App.renderForm` | form.js | Function → HTML | Formulário + chips email |
| `App.renderPlatformCards` | platform-card.js | Function → HTML | Grid de plataformas |
| `App.renderGuide` | guide-viewer.js | Function → HTML | Guia passo a passo |
| `App.renderWizard` | wizard.js | Function → HTML | Assistente automático |
| `App.renderChecklist` | checklist.js | Function → HTML | Drawer de progresso |
| `App.renderChecklistFab` | checklist.js | Function → HTML | Botão flutuante |
| `App.renderSummary` | summary.js | Function → HTML | Resumo final |
| `App.showToast` | app.js | Function | Notificação toast |

---

## 5. Gerenciamento de Estado

### Shape

```javascript
{
  currentScreen: 'welcome'|'form'|'platforms'|'guide'|'wizard'|'summary'|'history',
  currentGuide: null|'protonmail'|'instagram'|'facebook'|'tiktok',
  currentStep: 0..N,
  wizardMode: boolean,
  suggestedPassword: string,
  employee: {
    nomeCompleto: string,
    emailDesejado: string,
    telefone: string,
    dataNascimento: string,     // YYYY-MM-DD
    cargo: string,
    departamento: string,
    dataAdmissao: string        // YYYY-MM-DD
  },
  platforms: {
    protonmail: { completed: boolean, accountInfo: string },
    instagram:  { completed: boolean, accountInfo: string },
    facebook:   { completed: boolean, accountInfo: string },
    tiktok:     { completed: boolean, accountInfo: string }
  },
  startedAt: string|null,       // ISO timestamp
  completedAt: string|null
}
```

### Ciclo

```
Ação do usuário → handler atualiza state → App.storage.save(state)
    → render() atualiza DOM → bindEvents() reanexa handlers

Ao reabrir → App.storage.load() → mergeDeep(defaultState, saved) → render()
```

### Versionamento

`App.storage.VERSION = 4` — ao mudar o schema, incrementar limpa o estado antigo automaticamente.

---

## 6. Telas e Navegação

| # | Screen ID | Componente | Descrição |
|---|-----------|------------|-----------|
| 1 | `welcome` | inline (app.js) | Splash com logo, parallax, partículas |
| 2 | `form` | form.js | 7 campos + chips de sugestão de email |
| 3 | `platforms` | platform-card.js | Grid 2x2 com status por plataforma |
| 4 | `guide` | guide-viewer.js | Passo a passo manual |
| 5 | `wizard` | wizard.js | Assistente automático com automação |
| 6 | `summary` | summary.js | Relatório final (TXT/PDF/copiar) |
| 7 | `history` | inline (app.js) | Lista de onboardings anteriores |

### Fluxo Principal

```
┌──────────┐    ┌──────┐    ┌────────────┐    ┌─────────────────┐    ┌─────────┐
│ Welcome  │───→│ Form │───→│ Platforms  │───→│ Guide / Wizard  │───→│ Summary │
│          │    │      │    │            │←───│  (por plataforma)│    │         │
└──────────┘    └──────┘    └────────────┘    └─────────────────┘    └─────────┘
     ↑                                                                     │
     └────────────── "Novo Colaborador" / Salvar no Histórico ────────────┘
```

### Dois Modos por Plataforma

- **Guide (manual)** — passos com instruções textuais, usuário faz tudo
- **Wizard (automático)** — interface simplificada + bot Playwright preenche formulário

---

## 7. Sistema de Automação (Bots Playwright)

### auto_protonmail.py — Semi-automático (6 steps)

```
Step 1: Abrir Chrome (sem incógnito, locale pt-BR)
Step 2: Selecionar plano Free (múltiplos seletores + fallback JS)
Step 3: Preencher username (human_type + React setter fallback)
Step 4: Preencher senha + confirmação
Step 5: Clicar submit
Step 6: PAUSA — aguarda humano resolver CAPTCHA (até 20 min)
         → Detecta displayName, skip buttons, sidebar = sucesso
```

**Características:**
- Digitação humanizada (0.08-0.22s por caractere)
- Delays aleatórios entre ações
- Sem dependências externas (removido Mail.gw/requests)
- Fallback: se servidor off, interface abre modo manual

### auto_instagram.py — Semi-automático (8 steps)

```
Step 1: Abrir Chrome
Step 2: Preencher email
Step 3: Preencher nome completo
Step 4: Preencher username
Step 5: Preencher senha
Step 6: Preencher data de nascimento
Step 7: Clicar submit
Step 8: Aguardar verificação (CAPTCHA/email)
```

### Protocolo de Status (polling)

```javascript
// Interface faz polling a cada 2s
GET /api/status?platform=protonmail

// Resposta:
{
  "step": 3,
  "total": 6,
  "message": "Preenchendo username: joao.silva",
  "done": false,
  "success": false,
  "error": null,
  "email": "joao.silva@proton.me",
  "password": "***"
}
```

A interface renderiza um modal com steps visuais (checkmarks verdes para completos, ponto animado para atual). Após 5 falhas de polling, mostra erro de conexão.

---

## 8. Sistema de Eventos (Event Delegation)

Um único listener no `document` com `data-action` + `e.target.closest()`:

```javascript
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var action = el.getAttribute('data-action');
  if (actions[action]) actions[action](e, el);
});
```

### Actions Registradas (principais)

| Action | Handler | Descrição |
|--------|---------|-----------|
| `start` | Navega form | Iniciar onboarding |
| `continue` | Restaura state | Retomar sessão salva |
| `submit-form` | Salva employee | Salvar formulário |
| `open-guide` | Navega guide | Abrir guia da plataforma |
| `open-wizard` | Navega wizard | Abrir wizard da plataforma |
| `guide-next/prev` | Muda step | Navegar passos |
| `complete-platform` | Marca done | Completar plataforma |
| `auto-create-protonmail` | POST API | Iniciar bot ProtonMail |
| `auto-create-instagram` | POST API | Iniciar bot Instagram |
| `view-summary` | Navega summary | Ver resumo final |
| `export-txt/pdf/copy` | Gera export | Exportar dados |
| `view-history` | Navega history | Ver onboardings anteriores |
| `reset` | Limpa state | Novo colaborador |
| `toggle-password` | Mostra/oculta | Toggle visibilidade senha |
| `select-email-variation` | Preenche campo | Escolher sugestão de email |
| `regenerate-email` | Recalcula chips | Gerar novas sugestões |

---

## 9. Componentes Visuais

### Splash Screen (welcome)
- Logo HD com `backdrop-filter: blur(20px)`
- Partículas canvas (55 partículas, conexões a 150px)
- Parallax floresta 3 camadas com profundidade por tela
- Botão "Continuar de onde parei" se há sessão salva

### Formulário (form)
- 7 campos com validação visual em tempo real (borda verde/vermelha no blur)
- Chips de sugestão de email (gerados a partir do nome)
- Máscara de telefone `(XX) XXXXX-XXXX`
- Botão "Gerar Dados de Teste" para desenvolvimento
- Auto-save no blur de cada campo

### Platform Cards
- Grid responsivo com cores por plataforma
- Badge de status (Pendente / Concluído)
- Barra de progresso geral
- Stagger animation ao entrar na tela

### Guide Viewer
- Navegação step-by-step com indicador visual
- Ferramenta de geração de senha segura
- Botão "Abrir Página de Cadastro" (window.open)
- Campo para registrar email/username criado

### Wizard
- Modo simplificado com foco na ação atual
- Integração com bots (botão "Criar Automaticamente")
- Modal de progresso com steps em tempo real
- Fallback manual se servidor indisponível

### Summary
- Grid responsivo com dados do funcionário
- Tabela de contas criadas por plataforma
- Export: TXT, PDF, copiar para clipboard
- Salva no histórico antes de resetar

---

## 10. Ordem de Carregamento

```
1. Tailwind CSS 3 (CDN)
2. Google Fonts (Inter)
3. css/styles.css
4. js/data.js          ← App.icons, App.platforms, App.formFields, helpers
5. js/storage.js       ← App.storage
6. js/particles.js     ← App.initParticles
7-12. js/components/*  ← App.render* (qualquer ordem entre si)
13. js/app.js          ← init, render(), bindEvents() — DEVE ser último
```

Cache-busting via `?v=93` em todos os scripts no `index.html`.

---

## 11. Extensibilidade

### Adicionar Nova Plataforma

1. `data.js` — adicionar em `App.platforms` (id, name, icon, color, steps, registerUrl)
2. `app.js` — adicionar em `defaultState.platforms` (`{ completed: false, accountInfo: '' }`)
3. (Opcional) criar `auto_novaplataforma.py` + rota no `server.py`
4. Componentes renderizam automaticamente

### Adicionar Novo Bot de Automação

1. Criar `auto_plataforma.py` com `status` dict global + `create_account()`
2. `server.py` — importar, adicionar rota POST + status no GET
3. `app.js` — adicionar handler `auto-create-plataforma` com modal + polling

### Adicionar Nova Tela

1. Criar `js/components/nova-tela.js` com `App.renderNovaTela(state)`
2. Adicionar `<script>` no `index.html` (antes de app.js, incrementar `?v=`)
3. Adicionar case no `render()` em `app.js`
4. Adicionar handlers em `bindEvents()`

---

## 12. Deploy

### GitHub Pages (frontend only)
```bash
git push origin master  # Deploy automático
# https://xghruond.github.io/TesteGV-bot02/
```
Funciona sem servidor — modo manual para todas as plataformas.

### Com automação (local)
```bash
cd c:\TesteGV-bot02
pip install playwright requests
playwright install chromium
python server.py        # http://localhost:8080
```
Requer Chrome instalado em `C:/Program Files/Google/Chrome/Application/chrome.exe`.
