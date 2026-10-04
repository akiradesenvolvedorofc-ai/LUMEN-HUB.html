import express from 'express';
import session from 'express-session';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const E = process.env;
const PORT = E.PORT || 3000;
const BASE = (E.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ADMIN_ROLES = (E.ADMIN_ROLE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const miss = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_GUILD_ID', 'SESSION_SECRET'].filter(k => !E[k]);
if (miss.length) console.warn('⚠ Faltam variáveis no .env:', miss.join(', '));
if (!ADMIN_ROLES.length) console.warn('⚠ ADMIN_ROLE_IDS vazio: ninguém conseguirá entrar no painel.');

/* ---------------- banco de dados (arquivo JSON) ---------------- */
const DIR = path.join(__dirname, 'data'), FILE = path.join(DIR, 'db.json');
const uid = () => crypto.randomUUID().slice(0, 8);
const seed = () => ({
  cfg: { name: 'Lumen Hub', tag: 'Tudo para Roblox em um só lugar. Scripts testados, executores atualizados e suporte rápido.', logo: '', a: '#ff2d3d', b: '#ff7a45', bg: '#050305', r: 20, light: false, discord: '', insta: '', footer: '© Lumen Hub. Todos os direitos reservados.' },
  scripts: [
    { id: uid(), name: 'Auto Farm Pro', game: 'Blox Fruits', price: 0, desc: 'Exemplo gratuito. Edite no painel.', img: '', code: '-- Cole aqui o seu script\nprint("Auto Farm Pro")', hot: true },
    { id: uid(), name: 'God Raid Hub', game: 'Blox Fruits', price: 9.99, desc: 'Exemplo premium. Edite no painel.', img: '', code: '-- Script premium\nprint("God Raid Hub")', hot: true },
  ],
  execs: [{ id: uid(), name: 'Executor Exemplo', plat: 'PC', status: 'Online', desc: 'Edite no painel.', link: '#' }],
  reviews: [], orders: [], tickets: [],
});
let db;
try { db = { ...seed(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch { db = seed(); }
const save = () => { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE + '.tmp', JSON.stringify(db)); fs.renameSync(FILE + '.tmp', FILE); };
save();

/* ---------------- helpers ---------------- */
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use(session({
  secret: E.SESSION_SECRET || 'dev-secret', resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: BASE.startsWith('https'), maxAge: 7 * 864e5 },
}));

const hits = new Map();
const rl = (n, ms = 60000) => (q, r, next) => {
  const k = q.ip + q.path, now = Date.now(), a = (hits.get(k) || []).filter(t => now - t < ms);
  if (a.length >= n) return r.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco.' });
  a.push(now); hits.set(k, a); next();
};
const isAdm = q => !!(q.session.user?.isAdmin && (!E.ADMIN_PASSWORD || q.session.unlocked));
const adm = (q, r, n) => isAdm(q) ? n() : r.status(403).json({ error: 'Acesso negado.' });
const logged = (q, r, n) => q.session.user ? n() : r.status(401).json({ error: 'Faça login com o Discord.' });
const txt = (v, m) => String(v ?? '').trim().slice(0, m);
const owned = u => new Set(u ? db.orders.filter(o => o.userId === u.id && o.status === 'paid').flatMap(o => o.items.map(i => i.id)) : []);

async function hook(embed) {
  if (!E.DISCORD_WEBHOOK_URL) return;
  const role = E.SUPPORT_ROLE_ID;
  try {
    await fetch(E.DISCORD_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Lumen Hub', content: role ? `<@&${role}>` : '', allowed_mentions: { roles: role ? [role] : [], parse: [] }, embeds: [{ color: 0xff2d3d, timestamp: new Date().toISOString(), ...embed }] }),
    });
  } catch (e) { console.warn('Webhook falhou:', e.message); }
}

/* ---------------- login Discord + cargos ---------------- */
async function checkRoles(s) {
  try {
    const r = await fetch(`https://discord.com/api/users/@me/guilds/${E.DISCORD_GUILD_ID}/member`, { headers: { Authorization: 'Bearer ' + s.token } });
    if (r.status === 401) { s.user.isAdmin = false; }
    else if (r.ok) { const m = await r.json(); s.user.inGuild = true; s.user.isAdmin = (m.roles || []).some(x => ADMIN_ROLES.includes(x)); }
    else { s.user.inGuild = false; s.user.isAdmin = false; }
    s.checked = Date.now();
  } catch { /* falha de rede: mantém o estado anterior */ }
}

app.get('/auth/discord', (q, r) => {
  const state = crypto.randomBytes(16).toString('hex'); q.session.oauth = state;
  const u = new URL('https://discord.com/oauth2/authorize');
  u.search = new URLSearchParams({ client_id: E.DISCORD_CLIENT_ID || '', response_type: 'code', redirect_uri: BASE + '/auth/callback', scope: 'identify guilds.members.read', state, prompt: 'none' });
  r.redirect(u.toString());
});

app.get('/auth/callback', async (q, r) => {
  try {
    const { code, state } = q.query;
    if (!code || !state || state !== q.session.oauth) return r.status(400).send('Sessão de login inválida. Volte e tente de novo.');
    const tr = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: E.DISCORD_CLIENT_ID, client_secret: E.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: BASE + '/auth/callback' }),
    });
    const t = await tr.json();
    if (!t.access_token) throw new Error('sem token');
    const u = await (await fetch('https://discord.com/api/users/@me', { headers: { Authorization: 'Bearer ' + t.access_token } })).json();
    if (!u.id) throw new Error('sem usuário');
    q.session.regenerate(async err => {
      if (err) return r.status(500).send('Erro de sessão.');
      q.session.token = t.access_token;
      q.session.user = { id: u.id, username: u.global_name || u.username, avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : '' };
      await checkRoles(q.session);
      q.session.save(() => r.redirect('/'));
    });
  } catch (e) { console.error(e); r.status(500).send('Falha no login com Discord. Confira o .env e o Redirect URI.'); }
});

app.post('/auth/logout', (q, r) => q.session.destroy(() => r.json({ ok: true })));

app.get('/api/me', async (q, r) => {
  const s = q.session;
  if (s.user && Date.now() - (s.checked || 0) > 5 * 60 * 1000) await checkRoles(s); // cargo revalidado a cada 5 min
  if (!s.user) return r.json({ user: null });
  r.json({ user: { ...s.user, locked: !!(s.user.isAdmin && E.ADMIN_PASSWORD && !s.unlocked) } });
});

app.post('/api/admin/unlock', logged, rl(8, 600000), (q, r) => {
  const u = q.session.user;
  if (!u.isAdmin || !E.ADMIN_PASSWORD) return r.status(403).json({ error: 'Acesso negado.' });
  const a = Buffer.from(String(q.body.password || '')), b = Buffer.from(E.ADMIN_PASSWORD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return r.status(401).json({ error: 'Senha incorreta.' });
  q.session.unlocked = true; r.json({ ok: true });
});

/* ---------------- dados públicos ---------------- */
app.get('/api/bootstrap', (q, r) => {
  const u = q.session.user, a = isAdm(q), own = owned(u);
  const scripts = db.scripts.map(s => {
    const open = s.price <= 0 || own.has(s.id) || a;
    return { ...s, code: open ? s.code : undefined, locked: !open };
  });
  const rv = db.reviews, avg = rv.length ? rv.reduce((x, y) => x + y.rating, 0) / rv.length : 0;
  r.json({
    cfg: db.cfg, scripts, execs: db.execs, reviews: [...rv].reverse().slice(0, 60),
    stats: { reviews: rv.length, avg: +avg.toFixed(1), delivered: db.orders.filter(o => o.status === 'paid').length },
  });
});

/* ---------------- CRUD scripts / executores (admin) ---------------- */
const SCH = {
  scripts: { name: ['s', 80], game: ['s', 40], price: ['n'], desc: ['s', 300], img: ['s', 500], code: ['s', 20000], hot: ['b'] },
  execs: { name: ['s', 80], plat: ['s', 20], status: ['s', 30], desc: ['s', 300], link: ['s', 500] },
};
function clean(k, b) {
  const o = {};
  for (const [f, [t, m]] of Object.entries(SCH[k])) {
    const v = b[f];
    o[f] = t === 's' ? String(v ?? '').trim().slice(0, m) : t === 'n' ? Math.max(0, Math.min(10000, +v || 0)) : !!v;
  }
  if (o.img && !/^https?:\/\//i.test(o.img)) o.img = '';
  if (o.link && !/^(https?:\/\/|#)/i.test(o.link)) o.link = '#';
  return o;
}
for (const k of ['scripts', 'execs']) {
  app.post(`/api/${k}`, adm, (q, r) => {
    const o = { id: uid(), ...clean(k, q.body) };
    if (!o.name) return r.status(400).json({ error: 'Nome obrigatório.' });
    if (k === 'scripts' && !o.game) o.game = 'Universal';
    db[k].unshift(o); save(); r.json(o);
  });
  app.put(`/api/${k}/:id`, adm, (q, r) => {
    const it = db[k].find(x => x.id === q.params.id);
    if (!it) return r.status(404).json({ error: 'Não encontrado.' });
    const o = clean(k, { ...it, ...q.body });
    if (!o.name) return r.status(400).json({ error: 'Nome obrigatório.' });
    Object.assign(it, o); save(); r.json(it);
  });
  app.delete(`/api/${k}/:id`, adm, (q, r) => { db[k] = db[k].filter(x => x.id !== q.params.id); save(); r.json({ ok: true }); });
}

app.put('/api/cfg', adm, (q, r) => {
  const b = q.body, c = db.cfg, col = v => /^#[0-9a-f]{6}$/i.test(v);
  for (const k of ['name', 'tag', 'footer']) if (k in b) c[k] = txt(b[k], 300);
  for (const k of ['logo', 'discord', 'insta']) if (k in b) c[k] = /^https?:\/\//i.test(b[k]) || !b[k] ? txt(b[k], 500) : c[k];
  for (const k of ['a', 'b', 'bg']) if (col(b[k])) c[k] = b[k];
  if ('r' in b) c.r = Math.max(4, Math.min(32, +b.r || 20));
  if ('light' in b) c.light = !!b.light;
  save(); r.json(c);
});

/* ---------------- avaliações ---------------- */
app.post('/api/reviews', logged, rl(10), (q, r) => {
  const u = q.session.user, rating = Math.round(+q.body.rating), text = txt(q.body.text, 300);
  if (!(rating >= 1 && rating <= 5)) return r.status(400).json({ error: 'Escolha de 1 a 5 estrelas.' });
  if (text.length < 5) return r.status(400).json({ error: 'Escreva pelo menos 5 caracteres.' });
  const verified = owned(u).size > 0;
  const old = db.reviews.find(x => x.userId === u.id);
  if (old) Object.assign(old, { rating, text, verified, name: u.username, avatar: u.avatar, at: Date.now() });
  else db.reviews.push({ id: uid(), userId: u.id, name: u.username, avatar: u.avatar, rating, text, verified, at: Date.now() });
  save(); r.json({ ok: true });
});
app.delete('/api/reviews/:id', logged, (q, r) => {
  const rv = db.reviews.find(x => x.id === q.params.id);
  if (!rv) return r.status(404).json({ error: 'Não encontrada.' });
  if (rv.userId !== q.session.user.id && !isAdm(q)) return r.status(403).json({ error: 'Acesso negado.' });
  db.reviews = db.reviews.filter(x => x !== rv); save(); r.json({ ok: true });
});

/* ---------------- pedidos ---------------- */
app.post('/api/orders', logged, rl(6), async (q, r) => {
  const u = q.session.user, own = owned(u), ids = Array.isArray(q.body.ids) ? q.body.ids.slice(0, 30) : [];
  const items = [...new Set(ids)].map(id => db.scripts.find(s => s.id === id)).filter(s => s && s.price > 0 && !own.has(s.id)).map(s => ({ id: s.id, name: s.name, price: s.price }));
  if (!items.length) return r.status(400).json({ error: 'Nenhum item válido no carrinho.' });
  const o = { id: uid(), userId: u.id, username: u.username, items, total: +items.reduce((a, i) => a + i.price, 0).toFixed(2), status: 'pending', at: Date.now() };
  db.orders.push(o); save();
  hook({ title: `🛒 Novo pedido #${o.id}`, description: `Cliente: <@${u.id}> (${u.username})\n${items.map(i => `• ${i.name} — R$ ${i.price.toFixed(2)}`).join('\n')}\n**Total: R$ ${o.total.toFixed(2)}**`, footer: { text: 'Confirme o pagamento e marque como pago no painel.' } });
  r.json(o);
});
app.get('/api/orders', logged, (q, r) => {
  const L = isAdm(q) ? db.orders : db.orders.filter(o => o.userId === q.session.user.id);
  r.json([...L].reverse().slice(0, 200));
});
app.post('/api/orders/:id/status', adm, (q, r) => {
  const o = db.orders.find(x => x.id === q.params.id), s = q.body.status;
  if (!o || !['pending', 'paid', 'cancelled'].includes(s)) return r.status(400).json({ error: 'Pedido ou status inválido.' });
  o.status = s; save(); r.json(o);
});

/* ---------------- suporte (site <-> Discord via webhook) ---------------- */
app.get('/api/support/mine', logged, (q, r) => {
  const L = db.tickets.filter(t => t.userId === q.session.user.id);
  r.json({ ticket: L.find(t => t.status === 'open') || L[L.length - 1] || null });
});
app.post('/api/support/mine', logged, rl(15), (q, r) => {
  const u = q.session.user, text = txt(q.body.text, 800);
  if (!text) return r.status(400).json({ error: 'Mensagem vazia.' });
  let t = db.tickets.find(x => x.userId === u.id && x.status === 'open');
  const fresh = !t;
  if (!t) { t = { id: uid(), userId: u.id, username: u.username, avatar: u.avatar, status: 'open', messages: [], updated: 0 }; db.tickets.push(t); }
  t.messages.push({ from: 'user', name: u.username, text, at: Date.now() }); t.updated = Date.now(); save();
  hook({ title: `🎧 ${fresh ? 'Novo ticket' : 'Nova mensagem'} #${t.id}`, description: `**${u.username}** (<@${u.id}>):\n${text}`, footer: { text: `Responda pelo painel: ${BASE} → Painel → Suporte` } });
  r.json({ ticket: t });
});
app.get('/api/support', adm, (q, r) => r.json([...db.tickets].sort((a, b) => b.updated - a.updated).slice(0, 100)));
app.post('/api/support/:id/messages', adm, (q, r) => {
  const t = db.tickets.find(x => x.id === q.params.id), text = txt(q.body.text, 800);
  if (!t || !text) return r.status(400).json({ error: 'Ticket ou mensagem inválidos.' });
  t.messages.push({ from: 'staff', name: q.session.user.username, text, at: Date.now() }); t.updated = Date.now(); save(); r.json(t);
});
app.post('/api/support/:id/close', adm, (q, r) => {
  const t = db.tickets.find(x => x.id === q.params.id);
  if (!t) return r.status(404).json({ error: 'Não encontrado.' });
  t.status = 'closed'; save(); r.json(t);
});

app.use('/api', (q, r) => r.status(404).json({ error: 'Rota não encontrada.' }));
app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => console.log(`Lumen Hub rodando em ${BASE}`));
