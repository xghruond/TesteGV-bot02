---
name: sync-docs
description: Sincroniza CLAUDE.md, ARCHITECTURE.md e MEMORY.md com o estado real do projeto
user-invocable: true
---

# Sincronizar Documentacao

Execute os seguintes passos para manter a documentacao atualizada:

## 1. Contar linhas reais
```bash
wc -l js/app.js js/data.js js/storage.js js/particles.js js/components/*.js css/styles.css index.html
```

## 2. Atualizar CLAUDE.md
- Comparar line counts do CLAUDE.md com os reais
- Atualizar a estrutura de arquivos se houve adicoes/remocoes
- Verificar se a stack descrita ainda e precisa

## 3. Atualizar ARCHITECTURE.md
- Atualizar line counts na secao de estrutura
- Verificar se todos os componentes listados existem
- Verificar se o fluxo de navegacao esta correto
- Atualizar total de linhas

## 4. Atualizar MEMORY.md
- Verificar se as decisoes tecnicas listadas ainda sao validas
- Adicionar novas decisoes/mudancas recentes

## 5. Atualizar auto-memory
- Salvar uma memory de projeto com o estado atual em `~/.claude/projects/c--/memory/`

## 6. Commit
```
git add TesteGV-bot02/CLAUDE.md TesteGV-bot02/ARCHITECTURE.md TesteGV-bot02/MEMORY.md
git commit -m "docs: sincronizar documentacao com estado atual do projeto"
git push origin master
```
