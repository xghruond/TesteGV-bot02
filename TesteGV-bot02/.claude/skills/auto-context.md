---
name: auto-context
description: Regras automaticas de preservacao de contexto — Claude segue estas instrucoes automaticamente em TODA conversa
user-invocable: false
---

# Auto-Context: Preservacao Automatica de Memoria

## REGRA OBRIGATORIA
Ao FINAL de cada tarefa significativa (commit, feature implementada, bug corrigido, refactor), voce DEVE:

1. **Atualizar a auto-memory** em `~/.claude/projects/c--/memory/` com o que mudou:
   - Se criou/removeu arquivos → atualizar memory de projeto
   - Se mudou padroes/convencoes → atualizar memory de feedback
   - Se aprendeu preferencia do usuario → salvar memory de user/feedback

2. **Manter CLAUDE.md atualizado** em `c:\TesteGV-bot02\CLAUDE.md`:
   - Se line counts mudaram significativamente (>50 linhas de diferenca) → atualizar
   - Se adicionou/removeu arquivos → atualizar estrutura
   - Se mudou stack/dependencias → atualizar

3. **Bump cache quando alterar JS/CSS**:
   - SEMPRE incrementar `?v=N` no index.html ao modificar qualquer .js ou .css
   - Usar `replace_all: true` para consistencia

## QUANDO NAO ATUALIZAR
- Mudancas triviais (1-2 linhas, typo fix)
- Pesquisa/exploração sem alteração de código
- Quando o usuario pedir explicitamente para nao atualizar

## FORMATO DA MEMORIA
Ao salvar memorias, usar o formato com frontmatter:
```markdown
---
name: nome-descritivo
description: descricao curta e especifica
type: project|feedback|user|reference
---
Conteudo da memoria
```
