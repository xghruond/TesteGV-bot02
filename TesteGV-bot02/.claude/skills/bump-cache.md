---
name: bump-cache
description: Incrementa a versao do cache (?v=N) em todos os scripts do index.html
user-invocable: true
---

# Bump Cache Version

1. Leia o index.html e encontre o valor atual de `?v=N` nos script tags
2. Incremente N em 1
3. Substitua TODOS os `?v=N` pelo novo valor usando Edit com replace_all=true
4. Faça commit: `chore: bump cache v{old} → v{new}`
5. Push para origin master
6. Confirme o novo valor ao usuario
