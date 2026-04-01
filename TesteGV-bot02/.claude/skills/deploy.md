---
name: deploy
description: Commit todas as mudancas pendentes e faz push para GitHub
user-invocable: true
---

# Deploy

1. Verifique se ha mudancas pendentes:
```bash
cd /c && git status --short -- TesteGV-bot02/
```

2. Se nao ha mudancas, informe o usuario e pare.

3. Se ha mudancas em JS ou CSS, incremente o cache `?v=N` no index.html.

4. Stage todas as mudancas:
```bash
cd /c && git add TesteGV-bot02/
```

5. Gere uma mensagem de commit descritiva baseada no `git diff --cached --stat`.

6. Commit e push:
```bash
git commit -m "mensagem gerada"
git push origin master
```

7. Confirme ao usuario com o hash do commit e link do repo.
