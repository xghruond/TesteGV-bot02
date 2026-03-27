# Arquitetura do Sistema de Onboarding

## 1. Visão Geral

Sistema web SPA (Single Page Application) que guia novos funcionários na criação de contas profissionais em 4 plataformas: **Gmail**, **Instagram**, **Facebook** e **TikTok**.

### Stack Tecnológica

| Camada | Tecnologia | Motivo |
|--------|-----------|--------|
| Markup | HTML5 | Semântico, acessível |
| Estilização | Tailwind CSS 3 (CDN) | Utilitário, responsivo, sem build |
| Tipografia | Google Fonts (Inter) | Moderna, legível |
| Lógica | JavaScript vanilla (ES5) | Zero dependências, funciona em qualquer navegador |
| Persistência | localStorage | Sem backend, permite retomar progresso |
| Build | Nenhum | Abrir `index.html` direto no navegador |

### Decisões Técnicas

- **Sem framework** → Zero build step, deploy por cópia de arquivos
- **Namespace global `App`** → Organização sem ES modules (compatível com `file://`)
- **IIFE no app.js** → Estado privado, sem poluição do escopo global
- **String concatenation para HTML** → Simples, sem engine de template
- **localStorage** → Persistência sem backend, retomada de sessão

---

## 2. Estrutura de Arquivos

```
TesteGV-bot02/
├── index.html                          # Página principal (SPA shell)        53 linhas
├── css/
│   └── styles.css                      # Estilos: animações, print, drawer   151 linhas
├── js/
│   ├── data.js                         # Dados estáticos (plataformas, ícones) 217 linhas
│   ├── storage.js                      # Abstração do localStorage            27 linhas
│   ├── app.js                          # Controlador principal (estado, rota)  299 linhas
│   └── components/
│       ├── header.js                   # Cabeçalho + barra de progresso       39 linhas
│       ├── form.js                     # Formulário de dados do funcionário   60 linhas
│       ├── platform-card.js            # Cards de seleção de plataformas      61 linhas
│       ├── guide-viewer.js             # Guia passo a passo interativo        81 linhas
│       ├── checklist.js                # Drawer de progresso + FAB            66 linhas
│       └── summary.js                  # Resumo final + impressão             83 linhas
└── ARCHITECTURE.md                     # Este documento
```

**Total: ~1.137 linhas de código**

---

## 3. Namespace Global (`App`)

Todos os arquivos estendem o objeto global `App` com `var App = App || {};`.

| Propriedade | Arquivo | Tipo | Descrição |
|------------|---------|------|-----------|
| `App.icons` | `data.js` | `Object<string, string>` | 21 ícones SVG inline |
| `App.platforms` | `data.js` | `Object<string, Platform>` | 4 plataformas com passos |
| `App.formFields` | `data.js` | `Array<Field>` | 7 definições de campos |
| `App.departmentLabels` | `data.js` | `Object<string, string>` | Tradução de departamentos |
| `App.storage` | `storage.js` | `Object` | Métodos: `save()`, `load()`, `clear()` |
| `App.renderHeader` | `header.js` | `Function(state) → HTML` | Cabeçalho com progresso |
| `App.renderForm` | `form.js` | `Function(state) → HTML` | Formulário de dados |
| `App.renderPlatformCards` | `platform-card.js` | `Function(state) → HTML` | Grid de plataformas |
| `App.renderGuide` | `guide-viewer.js` | `Function(state) → HTML` | Guia passo a passo |
| `App.renderChecklist` | `checklist.js` | `Function(state) → HTML` | Drawer de progresso |
| `App.renderChecklistFab` | `checklist.js` | `Function(state) → HTML` | Botão flutuante |
| `App.renderSummary` | `summary.js` | `Function(state) → HTML` | Resumo final |

---

## 4. Gerenciamento de Estado

### Shape do Estado

```javascript
{
  currentScreen: 'welcome' | 'form' | 'platforms' | 'guide' | 'summary',
  currentGuide: null | 'gmail' | 'instagram' | 'facebook' | 'tiktok',
  currentStep: 0..N,
  employee: {
    nomeCompleto: string,
    emailDesejado: string,
    telefone: string,
    dataNascimento: string,      // YYYY-MM-DD
    cargo: string,
    departamento: string,
    dataAdmissao: string         // YYYY-MM-DD
  },
  platforms: {
    gmail:     { completed: boolean, accountInfo: string },
    instagram: { completed: boolean, accountInfo: string },
    facebook:  { completed: boolean, accountInfo: string },
    tiktok:    { completed: boolean, accountInfo: string }
  },
  startedAt: string | null,      // ISO timestamp
  completedAt: string | null     // ISO timestamp
}
```

### Ciclo de Persistência

```
Ação do usuário
    ↓
Handler atualiza `state`
    ↓
App.storage.save(state)  →  localStorage.setItem('gv-onboarding-state', JSON.stringify(state))
    ↓
render() atualiza a tela
    ↓
bindEvents() reanexa handlers

--- ao reabrir o navegador ---

App.storage.load()  →  localStorage.getItem('gv-onboarding-state')
    ↓
mergeDeep(defaultState, savedState)
    ↓
render() restaura a tela salva
```

### Deep Merge

A função `mergeDeep()` no `app.js` combina o estado salvo com os valores padrão. Isso garante compatibilidade quando novos campos são adicionados ao `defaultState` — campos antigos do localStorage são preservados e novos campos recebem valor padrão.

---

## 5. Sistema de Navegação

### Telas

| # | Screen ID | Nome | Descrição |
|---|-----------|------|-----------|
| 1 | `welcome` | Boas-vindas | Tela inicial com botão de começar |
| 2 | `form` | Dados | Formulário de informações do funcionário |
| 3 | `platforms` | Plataformas | Grid com 4 cards de plataformas |
| 4 | `guide` | Guia | Passo a passo para uma plataforma |
| 5 | `summary` | Resumo | Relatório final imprimível |

### Fluxo de Navegação

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────┐
│ Welcome  │────→│  Form    │────→│  Platforms   │────→│  Guide (x4)   │────→│ Summary  │
│          │     │          │     │              │←────│               │     │          │
└──────────┘     └──────────┘     └──────────────┘     └───────────────┘     └──────────┘
     ↑                                                                            │
     └────────────────────────── "Novo Colaborador" ──────────────────────────────┘
```

### Função `navigateTo(screen, options)`

```javascript
function navigateTo(screen, options) {
  state.currentScreen = screen;
  if (options.guide) state.currentGuide = options.guide;
  if (options.step !== undefined) state.currentStep = options.step;
  App.storage.save(state);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

Parâmetros opcionais:
- `options.guide` — ID da plataforma (`'gmail'`, `'instagram'`, etc.)
- `options.step` — Índice do passo no guia (0-based)

---

## 6. Pipeline de Renderização

```
render()
  │
  ├─ state.currentScreen === 'welcome' ?
  │     header.innerHTML = ''
  │   else
  │     header.innerHTML = App.renderHeader(state)
  │
  ├─ switch (state.currentScreen)
  │     'welcome'   → renderWelcome()              [inline no app.js]
  │     'form'      → App.renderForm(state)        [form.js]
  │     'platforms'  → App.renderPlatformCards(state) [platform-card.js]
  │     'guide'     → App.renderGuide(state)       [guide-viewer.js]
  │     'summary'   → App.renderSummary(state)     [summary.js]
  │
  ├─ screen === 'platforms' || 'guide' ?
  │     checklist.innerHTML = App.renderChecklistFab(state)
  │                         + App.renderChecklist(state)
  │
  ├─ Adiciona classe '.screen-enter' (animação fadeIn)
  │
  └─ bindEvents()
       ├─ data-action="start"          → iniciar onboarding
       ├─ data-action="continue"       → retomar sessão salva
       ├─ data-action="back-platforms"  → voltar para plataformas
       ├─ data-action="guide-next"     → próximo passo
       ├─ data-action="guide-prev"     → passo anterior
       ├─ data-action="open-register"  → window.open(url)
       ├─ data-action="view-summary"   → ver resumo final
       ├─ data-action="print"          → window.print()
       ├─ data-action="reset"          → resetar aplicação
       ├─ data-action="toggle-checklist" → abrir/fechar drawer
       ├─ #employee-form submit        → salvar dados do formulário
       ├─ [name="telefone"] input      → máscara (XX) XXXXX-XXXX
       ├─ [data-platform] click        → navegar para guia
       └─ #complete-platform-form submit → marcar como concluído
```

### Por que re-bindEvents() a cada render?

Cada `render()` substitui o `innerHTML` dos containers, destruindo os elementos DOM anteriores e seus event listeners. Por isso, `bindEvents()` é chamado após cada render para reanexar todos os handlers aos novos elementos.

---

## 7. Componentes

### Header (`header.js`)

| | |
|---|---|
| **Entrada** | `state.currentScreen`, `state.employee.nomeCompleto` |
| **Saída** | HTML: logo, nome do funcionário, barra de progresso (4 segmentos), botão reset |
| **Dependências** | `App.icons.refresh` |
| **Visibilidade** | Todas as telas exceto `welcome` |

### Form (`form.js`)

| | |
|---|---|
| **Entrada** | `state.employee`, `App.formFields` |
| **Saída** | HTML: formulário com 7 campos (text, tel, date, select), botão submit |
| **Dependências** | `App.icons`, `App.formFields` |
| **Campos** | nomeCompleto, emailDesejado, telefone, dataNascimento, cargo, departamento, dataAdmissao |

### Platform Cards (`platform-card.js`)

| | |
|---|---|
| **Entrada** | `state.platforms`, `App.platforms` |
| **Saída** | HTML: grid 2x2 com cards coloridos, badges de status, barra de progresso geral |
| **Dependências** | `App.platforms`, `App.icons` |
| **Interação** | Clique no card navega para `guide` da plataforma |

### Guide Viewer (`guide-viewer.js`)

| | |
|---|---|
| **Entrada** | `state.currentGuide`, `state.currentStep`, `state.platforms` |
| **Saída** | HTML: passo atual com título, descrição, dicas, botão de cadastro, navegação prev/next |
| **Dependências** | `App.platforms`, `App.icons` |
| **Ações** | Abrir URL cadastro, avançar/voltar passos, marcar como concluído |

### Checklist (`checklist.js`)

| | |
|---|---|
| **Entrada** | `state.platforms`, `state.employee.nomeCompleto` |
| **Saída** | HTML: FAB (botão flutuante) + drawer lateral com progresso |
| **Dependências** | `App.platforms`, `App.icons` |
| **Visibilidade** | Telas `platforms` e `guide` apenas |

### Summary (`summary.js`)

| | |
|---|---|
| **Entrada** | `state` completo (employee + platforms + timestamps) |
| **Saída** | HTML: dados do funcionário, tabela de contas, botões imprimir/resetar |
| **Dependências** | `App.platforms`, `App.departmentLabels`, `App.icons` |
| **Print** | Cabeçalho print-only aparece via CSS `@media print` |

---

## 8. Cadeia de Dependências

### Ordem de Carregamento (index.html)

```
1. Tailwind CSS CDN          ← framework de estilização
2. Google Fonts (Inter)       ← tipografia
3. css/styles.css             ← estilos customizados
4. js/data.js                 ← App.icons, App.platforms, App.formFields
5. js/storage.js              ← App.storage
6. js/components/header.js    ← App.renderHeader
7. js/components/form.js      ← App.renderForm
8. js/components/platform-card.js ← App.renderPlatformCards
9. js/components/guide-viewer.js  ← App.renderGuide
10. js/components/checklist.js    ← App.renderChecklist, App.renderChecklistFab
11. js/components/summary.js      ← App.renderSummary
12. js/app.js                     ← inicialização, render(), bindEvents()
```

### Grafo de Dependências

```
data.js ─────────────────────────────────────────┐
  │ (App.icons, App.platforms, App.formFields)    │
  │                                               │
  ├──→ storage.js (App.storage)                   │
  │       │                                       │
  ├──→ header.js ──────┐                          │
  ├──→ form.js ────────┤                          │
  ├──→ platform-card.js┤                          │
  ├──→ guide-viewer.js ┼──→ app.js ◄─────────────┘
  ├──→ checklist.js ───┤      │
  └──→ summary.js ─────┘      │
                               ↓
                          render() → tela ativa
```

**Regras:**
- `data.js` DEVE carregar primeiro (define dados base)
- `storage.js` DEVE carregar antes de `app.js`
- Componentes podem carregar em qualquer ordem (entre si)
- `app.js` DEVE carregar por último (chama `render()` na inicialização)

---

## 9. Fluxo do Usuário

### Jornada Completa

```
1. BOAS-VINDAS
   Usuário abre index.html
   ↓ Clica "Iniciar Onboarding"
   (Se há sessão salva, pode clicar "Continuar de onde parei")

2. FORMULÁRIO
   Preenche: nome, email desejado, telefone, nascimento, cargo, departamento, admissão
   Telefone auto-formata para (XX) XXXXX-XXXX
   ↓ Clica "Continuar"

3. PAINEL DE PLATAFORMAS
   Vê 4 cards: Gmail, Instagram, Facebook, TikTok
   Todos marcados como "Pendente"
   ↓ Clica em "Gmail"

4. GUIA PASSO A PASSO (Gmail - 6 passos)
   Passo 1: Clica "Abrir Página de Cadastro" → abre accounts.google.com em nova aba
   Passos 2-5: Segue instruções com dicas
   Passo 6: Digita o email criado → Clica "Marcar como Concluído"
   ↓ Volta automaticamente para o painel

5. REPETIR para Instagram (5 passos), Facebook (4 passos), TikTok (5 passos)

6. RESUMO FINAL
   Quando as 4 plataformas estão concluídas, aparece "Ver Resumo Final"
   Mostra dados do funcionário + tabela de contas criadas
   ↓ Clica "Imprimir Relatório" (abre diálogo de impressão)
   ↓ Ou "Novo Colaborador" (reseta para o próximo funcionário)
```

### Fluxo de Retomada

```
Usuário fecha o navegador no meio do processo
    ↓
Reabre index.html
    ↓
app.js detecta estado salvo no localStorage
    ↓
Tela de boas-vindas mostra botão "Continuar de onde parei"
    ↓
Estado restaurado, usuário retoma do ponto exato
```

---

## 10. Padrões de Design

### IIFE (Immediately Invoked Function Expression)
**Onde:** `app.js` — todo o código está envolto em `(function() { ... })();`
**Por quê:** Mantém `state`, `defaultState` e funções internas privadas, expondo apenas o que está no `App`.

### Namespace Pattern
**Onde:** Todos os arquivos — `var App = App || {};`
**Por quê:** Organiza código em módulos sem ES modules, funciona com protocolo `file://`.

### MVC-like
- **Model:** `state` no `app.js` + `App.platforms`/`App.formFields` no `data.js`
- **View:** Funções `App.render*()` nos componentes
- **Controller:** `bindEvents()` e handlers no `app.js`

### Unobtrusive JavaScript
**Onde:** Atributos `data-action` e `data-platform` no HTML gerado
**Por quê:** Separa marcação de comportamento, fácil de entender a intenção olhando o HTML.

### Deep Merge para Evolução de Schema
**Onde:** `mergeDeep()` no `app.js`
**Por quê:** Ao adicionar novos campos ao `defaultState`, sessões salvas antigas continuam funcionando — campos novos recebem valor padrão, campos existentes são preservados.

### Imutabilidade via JSON Clone
**Onde:** `JSON.parse(JSON.stringify(defaultState))` no `app.js`
**Por quê:** Garante que cada instância do estado é independente, sem referências compartilhadas.

---

## 11. Dependências Externas

### CDN

| Recurso | URL | Propósito |
|---------|-----|-----------|
| Tailwind CSS 3 | `cdn.tailwindcss.com` | Framework de estilização utilitário |
| Google Fonts | `fonts.googleapis.com` | Fonte Inter (400-800) |

### APIs do Navegador

| API | Uso |
|-----|-----|
| `localStorage` | Persistência de estado entre sessões |
| `FormData` | Extração de dados do formulário |
| `window.open()` | Abrir páginas de cadastro em nova aba |
| `window.print()` | Impressão do relatório final |
| `window.scrollTo()` | Scroll suave ao navegar entre telas |
| `confirm()` | Confirmação antes de resetar |
| `JSON.stringify/parse` | Serialização do estado |
| `Date` | Timestamps e formatação pt-BR |

### URLs de Cadastro das Plataformas

| Plataforma | URL |
|------------|-----|
| Gmail | `https://accounts.google.com/signup` |
| Instagram | `https://www.instagram.com/accounts/emailsignup/` |
| Facebook | `https://www.facebook.com/r.php` |
| TikTok | `https://www.tiktok.com/signup` |

---

## 12. Extensibilidade

### Adicionar Nova Plataforma

1. **`js/data.js`** — Adicionar objeto em `App.platforms`:
   ```javascript
   App.platforms.linkedin = {
     id: 'linkedin',
     name: 'LinkedIn',
     description: 'Rede profissional',
     registerUrl: 'https://www.linkedin.com/signup',
     color: { bg: 'bg-sky-50', border: 'border-sky-200', ... },
     icon: '<svg>...</svg>',
     steps: [ { title: '...', description: '...', tip: '...' }, ... ]
   };
   ```

2. **`js/app.js`** — Adicionar entrada no `defaultState.platforms`:
   ```javascript
   platforms: {
     gmail: { completed: false, accountInfo: '' },
     // ...
     linkedin: { completed: false, accountInfo: '' }
   }
   ```

Os componentes renderizam automaticamente qualquer plataforma presente em `App.platforms`.

### Adicionar Nova Tela

1. Criar `js/components/nova-tela.js` com `App.renderNovaTela = function(state) { ... }`
2. Adicionar `<script>` no `index.html` (antes de `app.js`)
3. Adicionar case no `switch` do `render()` em `app.js`
4. Adicionar handlers em `bindEvents()` se necessário
5. Chamar `navigateTo('nova-tela')` de onde for preciso

### Adicionar Campo no Formulário

1. Adicionar definição em `App.formFields` no `data.js`
2. Adicionar propriedade correspondente em `defaultState.employee` no `app.js`
3. O formulário renderiza automaticamente o novo campo
