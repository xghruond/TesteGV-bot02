---
name: status
description: Mostra resumo rapido do estado do projeto — arquivos, git, cache, storage version
user-invocable: true
---

# Status do Projeto

Execute e apresente ao usuario:

## 1. Git status
```bash
cd /c && git log --oneline -5 -- TesteGV-bot02/
git status --short -- TesteGV-bot02/
```

## 2. Line counts
```bash
wc -l js/app.js js/data.js js/storage.js js/particles.js js/components/*.js css/styles.css index.html
```

## 3. Cache version
Leia o index.html e extraia o valor de `?v=N`.

## 4. Storage version
Leia storage.js e extraia o valor de `VERSION`.

## 5. Servidor
```bash
netstat -ano | grep ":5500\|:3001" | grep "LISTENING"
```

## 6. Resumo
Apresente em formato de tabela:
| Item | Valor |
|------|-------|
| Ultimo commit | ... |
| Cache version | v... |
| Storage version | ... |
| Total linhas | ... |
| Servidor local | Rodando/Parado |
| Mudancas pendentes | Sim/Nao |
