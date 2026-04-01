---
name: audit
description: Auditoria completa do projeto — syntax, dead code, cache, stale files
user-invocable: true
---

# Auditoria do Projeto

Execute uma auditoria completa do TesteGV-bot02:

## 1. Syntax Check
Rode `node -c` em todos os arquivos JS:
```
node -c js/app.js && node -c js/data.js && node -c js/storage.js && node -c js/particles.js && node -c js/components/*.js
```

## 2. Cache Consistency
Verifique se todos os `?v=N` no index.html estao com o mesmo numero.

## 3. Dead Code CSS
Grep por classes CSS definidas em styles.css que nao aparecem em nenhum JS ou HTML.

## 4. Dead Code JS
Grep por `bindAction('X')` que nao tem `data-action="X"` correspondente em nenhum template.

## 5. Stale Files
Verifique se existem arquivos em assets/ que nao sao referenciados no HTML ou JS.

## 6. Storage Version
Verifique se o VERSION no storage.js esta atualizado.

## 7. Relatorio
Apresente um resumo com:
- Erros encontrados
- Dead code
- Arquivos obsoletos
- Sugestoes de limpeza
