# Finance Bot — Controle Financeiro via WhatsApp

Bot que recebe mensagens no WhatsApp, extrai dados de gastos (valor, categoria, data) e
guarda no Supabase. No fim do mês, gera um relatório.

## Arquitetura multi-usuário

O número conectado na Z-API é o "número do bot" — qualquer pessoa pode mandar mensagem
para ele. Só é atendido quem estiver cadastrado e ativo na tabela `usuarios` do Supabase.
Cada usuário tem seus próprios gastos e seu próprio limite mensal, totalmente isolados
uns dos outros (pensado para, no futuro, vender acesso ao bot).

Para autorizar um novo número, insira na tabela `usuarios`:
```sql
INSERT INTO usuarios (telefone, nome, limite_mensal)
VALUES ('5511999999999', 'Nome da pessoa', 3000);
```

## Etapa 1, 2 e 3 (atual)

- ✅ Webhook recebendo mensagens da Z-API
- ✅ Extração por regex (gratuita) — já preparada para trocar por IA depois
- ✅ Multi-usuário com isolamento de dados por telefone
- ✅ Comandos: `resumo hoje`, `resumo mes`, `relatorio`, `limite 3000`, `editar último...`, `ajuda`
- ✅ Relatório PDF sob demanda (`relatorio` ou `relatorio MM/AAAA`)
- ✅ Relatório PDF automático no último dia de cada mês, enviado a todos os usuários ativos

## Como rodar localmente

```bash
npm install
cp .env.example .env
# edite o .env com suas credenciais reais
npm run dev
```

O servidor sobe em `http://localhost:3000`. Para a Z-API conseguir chamar seu
webhook, você vai precisar expor essa porta publicamente (veja seção Deploy).

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `MODO_EXTRACAO` | `regex` (grátis) ou `ia` (usa Claude API, tem custo) |
| `ZAPI_INSTANCE_ID` | ID da instância Z-API |
| `ZAPI_TOKEN` | Token da instância Z-API |
| `ZAPI_CLIENT_TOKEN` | Client-Token de segurança da Z-API (opcional, recomendado) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase |
| `ANTHROPIC_API_KEY` | Só necessário se `MODO_EXTRACAO=ia` |


## Como trocar de regex para IA no futuro

1. Crie uma chave em [console.anthropic.com](https://console.anthropic.com)
2. No `.env`, mude:
   ```
   MODO_EXTRACAO=ia
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Reinicie o servidor. Nenhuma outra mudança de código é necessária.

## Comandos disponíveis no WhatsApp

| Comando | O que faz |
|---|---|
| `mercado 50` | Registra um gasto (qualquer frase com valor + palavra-chave de categoria) |
| `resumo hoje` | Mostra os gastos do dia |
| `resumo mes` | Mostra os gastos do mês, por categoria, e o status do limite |
| `limite 3000` | Define o limite mensal |
| `editar último categoria Saúde` | Corrige a categoria do último gasto |
| `editar último valor 45,90` | Corrige o valor do último gasto |
| `ajuda` | Lista os comandos |

## Estrutura do projeto

```
src/
├── server.js                       # Webhook + servidor Express
├── handlers/
│   └── messageHandler.js           # Roteia comandos vs registro de gasto
├── services/
│   ├── extractorService.js         # Decide regex ou IA (ponto único de troca)
│   ├── extractors/
│   │   ├── regexExtractor.js       # Extração gratuita por regras
│   │   └── claudeExtractor.js      # Extração por IA (Claude API)
│   ├── supabaseService.js          # CRUD no banco
│   └── zapService.js               # Envio de mensagens via Z-API
└── utils/
    ├── categorias.js                # Dicionário de categorias e palavras-chave
    └── formatadores.js              # Formatação de moeda, data, totais
```
