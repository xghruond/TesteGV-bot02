# Memória do Projeto — Sistema de Onboarding

## Contexto de Negócio

Este projeto foi criado para uma **multinacional** que precisa que todo novo funcionário contratado crie contas profissionais em 4 plataformas: Gmail, Instagram, Facebook e TikTok. Muitos funcionários são novos em tecnologia, então o sistema guia passo a passo a criação de cada conta.

## Informações do Projeto

| Campo | Valor |
|-------|-------|
| **Repositório** | https://github.com/xghruond/TesteGV-bot02 |
| **Branch principal** | `master` |
| **Stack** | HTML5, Tailwind CSS 3 (CDN), JavaScript vanilla (ES5) |
| **Persistência** | localStorage (`gv-onboarding-state`) |
| **Build** | Nenhum — abrir `index.html` direto no navegador |
| **Idioma da UI** | Português BR |
| **Total de código** | ~1.137 linhas em 11 arquivos |

## Decisões Técnicas e Motivos

| Decisão | Motivo |
|---------|--------|
| Sem framework (React, Vue, etc.) | Zero build step, deploy por cópia de arquivos, funcionários não-técnicos usam |
| Namespace global `App` em vez de ES modules | Compatível com protocolo `file://`, funciona sem servidor |
| IIFE no `app.js` | Estado privado, sem poluição global |
| Tailwind via CDN | Consistente com projeto GV-SaaS existente, sem build |
| localStorage | Sem backend necessário, permite retomar sessão |
| String concatenation para HTML | Simples, sem engine de template, zero dependências |

## Estrutura de Arquivos

```
TesteGV-bot02/
├── index.html                    # SPA shell + Tailwind config
├── ARCHITECTURE.md               # Documentação técnica detalhada
├── MEMORY.md                     # Este arquivo
├── css/styles.css                # Animações, print, drawer
├── js/
│   ├── data.js                   # Plataformas, ícones, campos do formulário
│   ├── storage.js                # Wrapper localStorage
│   ├── app.js                    # Controlador principal (estado, rota, eventos)
│   └── components/
│       ├── header.js             # Cabeçalho + barra de progresso
│       ├── form.js               # Formulário de dados do funcionário
│       ├── platform-card.js      # Cards de seleção de plataformas
│       ├── guide-viewer.js       # Guia passo a passo interativo
│       ├── checklist.js          # Drawer lateral de progresso + FAB
│       └── summary.js            # Resumo final + impressão
```

## Fluxo Principal

```
Boas-vindas → Formulário → Plataformas → Guia (x4) → Resumo → Imprimir/Resetar
```

## Plataformas Suportadas

| Plataforma | Passos | URL de Cadastro |
|------------|--------|-----------------|
| Gmail | 6 | accounts.google.com/signup |
| Instagram | 5 | instagram.com/accounts/emailsignup |
| Facebook | 4 | facebook.com/r.php |
| TikTok | 5 | tiktok.com/signup |

## Registro de Evolução

| Data | Commit | Descrição |
|------|--------|-----------|
| 2026-03-27 | `fba66e1` | Criação inicial do sistema (11 arquivos, 1.137 linhas) |
| 2026-03-27 | `4422bf2` | Adicionado ARCHITECTURE.md com documentação técnica completa |

## Como Adicionar Nova Plataforma

1. Adicionar objeto em `App.platforms` no `js/data.js`
2. Adicionar entrada `{ completed: false, accountInfo: '' }` em `defaultState.platforms` no `js/app.js`
3. Os componentes renderizam automaticamente

## Como Adicionar Campo no Formulário

1. Adicionar definição em `App.formFields` no `js/data.js`
2. Adicionar propriedade em `defaultState.employee` no `js/app.js`

## Nota sobre Git

O repositório git tem raiz em `C:\` com `core.worktree`. Para operações git, usar `cd /c` e caminhos relativos a `C:\` (ex: `TesteGV-bot02/arquivo.js`).

## Documentação Relacionada

- [ARCHITECTURE.md](ARCHITECTURE.md) — Arquitetura técnica detalhada (namespace, estado, renderização, componentes, dependências)
