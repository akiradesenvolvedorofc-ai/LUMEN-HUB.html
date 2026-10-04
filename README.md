# Lumen Hub (versão real)

Site com login pelo Discord (cargo verificado no servidor), painel admin, scripts/executores salvos no servidor,
carrinho + pedidos, avaliações reais e chat de suporte que avisa o Discord por webhook.

## 1) Requisitos
- Node.js 20.6 ou mais novo
- Uma hospedagem que rode Node (Render, Railway, VPS, etc.)

## 2) Criar o app no Discord
1. https://discord.com/developers/applications → **New Application**.
2. **OAuth2** → copie **Client ID** e **Client Secret**.
3. Em **OAuth2 → Redirects**, adicione: `SEU_DOMINIO/auth/callback`
   (local: `http://localhost:3000/auth/callback`).
4. No Discord ative **Modo desenvolvedor** (Configurações → Avançado) e copie:
   - o **ID do servidor** (botão direito no servidor → Copiar ID);
   - o **ID de cada cargo** que pode entrar no painel (Configurações do servidor → Cargos → botão direito no cargo → Copiar ID).
5. Webhook: no canal de suporte → Editar canal → Integrações → Webhooks → **Novo webhook** → copiar URL.

## 3) Configurar e rodar
```bash
cp .env.example .env     # preencha os valores
npm install
npm start
```
Abra `http://localhost:3000`.

## Como funciona
- **Login/cargos:** o usuário entra com Discord (escopos `identify` e `guilds.members.read`). O servidor lê os cargos dele
  no seu servidor e só libera o painel se ele tiver algum cargo de `ADMIN_ROLE_IDS`. O cargo é rechecado a cada 5 minutos;
  se o cargo for removido, o acesso cai sozinho. Toda rota de admin é protegida no servidor.
- **Senha extra (opcional):** defina `ADMIN_PASSWORD` para pedir uma senha depois do login com Discord.
- **Scripts premium:** o código só é enviado ao navegador de quem comprou (pedido pago) ou da equipe.
- **Pedidos:** o cliente finaliza o carrinho → o servidor calcula o preço e avisa o Discord. Você confirma o pagamento
  (PIX, etc.) e marca **Pago** em Painel → Pedidos; o script libera na hora para o cliente.
- **Suporte:** o cliente escreve no chat do site → o webhook avisa o canal do Discord → a equipe responde em
  Painel → Suporte (o cliente vê a resposta em poucos segundos).
- **Avaliações:** exigem login, 1 por pessoa (pode editar), com selo "Compra verificada". Dono/staff podem remover.
- **Dados:** ficam em `data/db.json`. Faça backup desse arquivo.

## Limites conhecidos
- Pagamento automático (PIX/cartão) não está incluído: a confirmação é manual no painel.
- As respostas do suporte são feitas pelo painel do site, não digitando no Discord (isso exigiria um bot).
- Sessões ficam na memória: reiniciar o servidor desloga todos. Para escala maior, use banco de dados e store de sessão.
