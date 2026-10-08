# Lumen Hub — GitHub + Supabase

Esta versão usa Supabase diretamente no frontend. Não precisa de `server.js` nem de SQLite.

## Arquivos
- `index.html` — site conectado ao Supabase
- `supabase_schema.sql` — tabelas, RLS, funções e dados iniciais

## 1. Supabase
Abra o SQL Editor do projeto e execute TODO o conteúdo de `supabase_schema.sql`.

## 2. Discord Login
No Supabase:
- Authentication → Providers → Discord → habilite o Discord.
- Use o Client ID e Client Secret do seu aplicativo Discord.
- No aplicativo Discord, configure como Redirect URL:
  `https://fimitukltthqqevupkpc.supabase.co/auth/v1/callback`

Depois de publicar no GitHub Pages, em Supabase → Authentication → URL Configuration:
- Site URL: coloque a URL do seu GitHub Pages.
- Redirect URLs: adicione a mesma URL do GitHub Pages.

## 3. Administrador
Primeiro faça login no site com seu Discord.

Depois abra Supabase → Authentication → Users e copie o UUID do seu usuário.

No SQL Editor:
```sql
insert into public.user_roles(user_id, role)
values('COLE-O-UUID-AQUI','admin')
on conflict (user_id) do update set role='admin';
```

## 4. GitHub Pages
Suba `index.html` e `supabase_schema.sql` no repositório.

Depois:
Settings → Pages → Deploy from a branch → main → /(root) → Save.

O site pode ficar em:
`https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`

## Segurança
A chave usada no `index.html` é a Publishable Key. Ela é destinada ao frontend.
A proteção dos dados é feita pelas políticas RLS e pelas funções SQL.

NUNCA coloque a `service_role`/Secret Key no HTML ou no GitHub.

## Observação
O carrinho continua sendo salvo localmente no navegador. Os dados compartilhados (scripts, executores, avaliações, pedidos, suporte e configurações) ficam no Supabase.
