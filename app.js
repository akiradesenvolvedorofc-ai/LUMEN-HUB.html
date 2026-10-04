const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hue = s => [...String(s)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 360;
const brl = n => n > 0 ? 'R$ ' + (+n).toFixed(2).replace('.', ',') : 'Grátis';
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const USVG = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>';
const api = async (p, m = 'GET', b) => {
  const r = await fetch((p.startsWith('/auth') ? '' : '/api') + p, { method: m, headers: b ? { 'Content-Type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Algo deu errado.');
  return j;
};
const toast = t => { const e = document.createElement('div'); e.className = 'toast'; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), 2400); };
const fail = e => toast(e.message || 'Erro.');

let S = { cfg: {}, scripts: [], execs: [], reviews: [], stats: {} }, me = null;
let cart = JSON.parse(localStorage.getItem('lh_cart') || '[]'), view = 'home', cat = 'Todos', q = '', chatT = null, admT = null, myRate = 5;
const isAdm = () => me && me.isAdmin && !me.locked;
const saveCart = () => localStorage.setItem('lh_cart', JSON.stringify(cart));
const cats = () => ['Todos', ...new Set(S.scripts.map(s => s.game))];

async function load() {
  try { S = await api('/bootstrap'); me = (await api('/me')).user; } catch (e) { $('#app').innerHTML = '<p style="text-align:center;padding:80px 0">Não foi possível carregar o site.</p>'; return; }
  cart = cart.filter(id => S.scripts.some(s => s.id === id && s.locked));
  render();
}

function theme() {
  const c = S.cfg, r = document.documentElement.style;
  r.setProperty('--a', c.a); r.setProperty('--b', c.b); r.setProperty('--r', c.r + 'px'); r.setProperty('--bg', c.light ? '#f6f1f2' : c.bg);
  document.documentElement.classList.toggle('light', !!c.light);
  document.title = c.name || 'Lumen Hub'; $('#nm').textContent = c.name || '';
  const i = $('#lgi'); i.textContent = c.logo ? '' : (c.name || 'L')[0]; i.style.backgroundImage = c.logo ? `url("${String(c.logo).replace(/"/g, '')}")` : '';
  $('#usr').innerHTML = me && me.avatar ? `<img class="av" src="${esc(me.avatar)}" alt="">` : USVG;
  $('#foot').innerHTML = `<div class="lg"><i style="${i.style.cssText}">${esc(i.textContent)}</i><span style="display:block">${esc(c.name)}</span></div><p>${esc(c.tag)}</p><p><a data-a="go" data-v="home">Início</a><a data-a="go" data-v="scripts">Scripts</a><a data-a="go" data-v="execs">Executores</a><a data-a="go" data-v="reviews">Avaliações</a>${me && me.isAdmin ? '<a data-a="panel">Painel</a>' : ''}</p><p style="font-size:13px">${esc(c.footer)}</p>`;
  $('#cc').textContent = cart.length; $('#cc').style.display = cart.length ? 'grid' : 'none';
}

const cover = s => `<div class="cov" style="--h:${hue(s.game)};${s.img ? `background-image:url('${esc(s.img).replace(/'/g, '')}')` : ''}">${s.img ? '' : `<b>${esc(s.game)}</b>`}<span class="bd ${s.price > 0 ? '' : 'f'}">${s.price > 0 ? (s.locked ? 'Premium' : 'Comprado') : 'Grátis'}</span>${s.hot ? '<span class="bd h">Em alta</span>' : ''}</div>`;
const card = s => `<article class="card" data-a="view" data-v="${s.id}">${cover(s)}<div class="cb"><span class="st">★★★★★</span><h3>${esc(s.name)}</h3><small>${esc(s.desc)}</small><div class="pr"><b>${brl(s.price)}</b><span class="btn s" data-a="${s.locked ? 'add' : 'view'}" data-v="${s.id}">${s.locked ? 'Comprar' : 'Obter'}</span></div></div></article>`;
const exec = e => `<div class="ex"><i>${esc(e.name[0] || '?')}</i><div><h3>${esc(e.name)}</h3><span class="tag">${esc(e.plat)}</span><span class="tag ${/online/i.test(e.status) ? 'on' : ''}">● ${esc(e.status)}</span><p>${esc(e.desc)}</p></div><span class="btn s" data-a="dl" data-v="${e.id}">Baixar</span></div>`;
const rvCard = r => `<div class="rv"><div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">${r.avatar ? `<img class="av" src="${esc(r.avatar)}" alt="">` : ''}<h4 style="margin:0">${esc(r.name)}</h4>${r.verified ? '<span class="tag on">Compra verificada</span>' : ''}${me && (me.id === r.userId || isAdm()) ? `<span class="btn s o" style="margin-left:auto;padding:2px 10px" data-a="delrv" data-v="${r.id}">×</span>` : ''}</div><p>"${esc(r.text)}"</p><span class="st">${stars(r.rating)}</span></div>`;
const rvForm = () => me ? `<div class="pan" style="margin-bottom:16px"><b>Deixe sua avaliação</b><div class="rate" id="rate">${[1, 2, 3, 4, 5].map(n => `<span data-a="rate" data-v="${n}" class="${n <= myRate ? 'on' : ''}">★</span>`).join('')}</div><textarea class="in" id="rt" rows="3" maxlength="300" placeholder="Conte como foi sua experiência"></textarea><span class="btn s" data-a="sendrv">Publicar avaliação</span></div>` : `<div class="pan" style="margin-bottom:16px;text-align:center">Entre com o Discord para avaliar.<br><br><span class="btn s" data-a="user">Entrar</span></div>`;

const V = {
  home() {
    const c = S.cfg, t = S.scripts.filter(s => s.hot), st = S.stats;
    return `<section class="hero"><h1>${esc(c.name)}</h1><div class="pan">${esc(c.tag)}</div><div class="two"><div class="cta bl" data-a="go" data-v="scripts">Ver scripts</div><div class="cta" data-a="go" data-v="execs">Executores</div></div></section>
<div class="ban" style="--h:350" data-a="go" data-v="scripts"><h3>Scripts<em>${esc(S.scripts[0]?.game || 'Roblox')}</em></h3><small>Atualizados · Entrega pelo painel</small></div>
<div class="ban" style="--h:215" data-a="go" data-v="execs"><h3>Execu<em>tores</em></h3><small>PC, Android e iOS · Status do executor</small></div>
<section class="sec"><span class="k">Destaques da loja</span><h2>Os scripts mais desejados</h2><br><div class="car">${(t.length ? t : S.scripts).slice(0, 8).map(card).join('')}</div><p><span class="btn" data-a="go" data-v="scripts">Ver mais scripts →</span></p></section>
<section class="sec pan"><div class="stats"><div><div><b>${st.reviews || 0}</b><span>Avaliações</span></div></div><div><div><b>${st.avg ? st.avg + ' ★' : '—'}</b><span>Nota média</span></div></div><div><div><b>${st.delivered || 0}</b><span>Pedidos entregues</span></div></div></div></section>
<section class="sec"><span class="k">Avaliações</span><h2>Quem usa, fala</h2><br>${S.reviews.length ? `<div class="car">${S.reviews.slice(0, 8).map(rvCard).join('')}</div>` : '<p style="text-align:center;color:var(--mut)">Ainda não há avaliações. Seja o primeiro!</p>'}<p><span class="btn o" data-a="go" data-v="reviews">Avaliar / ver todas</span></p></section>
<section class="sec"><span class="k">Como funciona</span><h2>Simples em 3 passos</h2><br>${[['Escolha', 'Navegue pelo catálogo e encontre o script do seu jogo.'], ['Obtenha', 'Grátis: copie na hora. Premium: faça o pedido e a equipe confirma.'], ['Execute', 'Baixe um executor, cole o script e aproveite.']].map((s, i) => `<div class="pan step" style="margin-bottom:12px"><i>0${i + 1}</i><h3>${s[0]}</h3><p>${s[1]}</p></div>`).join('')}</section>
<section class="sec"><h2>Perguntas frequentes</h2><br>${[['Como recebo um script premium?', 'Adicione ao carrinho e finalize o pedido. Após a equipe confirmar o pagamento, o código libera em "Meus pedidos".'], ['Preciso de conta?', 'Sim, o login é feito com o Discord. Assim você acompanha pedidos e fala com o suporte.'], ['Como falo com o suporte?', 'Pelo botão de chat no canto da tela. A equipe é avisada na hora no Discord.']].map(f => `<details><summary>${f[0]}</summary><p>${f[1]}</p></details>`).join('')}</section>`;
  },
  scripts() {
    const L = S.scripts.filter(s => (cat == 'Todos' || s.game == cat) && (s.name + s.game).toLowerCase().includes(q.toLowerCase()));
    return `<div class="hd"><h2>${cat == 'Todos' ? 'Catálogo de scripts' : esc(cat)}</h2></div><div class="chips">${cats().map(c => `<span class="chip ${c == cat ? 'on' : ''}" data-a="cat" data-v="${esc(c)}">${esc(c)}</span>`).join('')}</div><div class="grid">${L.map(card).join('') || '<p style="grid-column:1/-1;text-align:center;color:var(--mut)">Nenhum script encontrado.</p>'}</div>`;
  },
  execs() { return `<div class="hd"><h2>Executores</h2></div><p style="color:var(--mut);margin-top:-6px">Confira o status antes de baixar.</p>${S.execs.map(exec).join('') || '<p>Nenhum executor cadastrado.</p>'}`; },
  reviews() { return `<div class="hd"><h2>Avaliações</h2></div>${rvForm()}${S.reviews.map(rvCard).join('') || '<p style="color:var(--mut)">Ainda não há avaliações.</p>'}`; },
};
function render() { $('#app').innerHTML = V[view](); theme(); }
function go(v, o = {}) { view = v; if (o.cat !== undefined) cat = o.cat; if (o.q !== undefined) q = o.q; $('#dr').classList.remove('open'); render(); scrollTo({ top: 0, behavior: 'instant' }); }
function modal(h) { const o = document.createElement('div'); o.className = 'ov'; o.innerHTML = `<div class="box"><button class="x" aria-label="Fechar">×</button>${h}</div>`; o.onclick = e => { if (e.target == o || e.target.classList.contains('x')) o.remove(); }; $('#layer').append(o); return o; }
function copy(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).catch(() => { const a = document.createElement('textarea'); a.value = t; document.body.append(a); a.select(); document.execCommand('copy'); a.remove(); }); toast('Script copiado!'); }

function drawer() {
  const c = S.cfg;
  $('#dr').innerHTML = `<div class="dp"><div class="lg" style="padding:6px"><i style="${$('#lgi').style.cssText}">${esc($('#lgi').textContent)}</i><span style="display:block">${esc(c.name)}</span></div>
<a data-a="go" data-v="home"><span>⌂</span>Início</a><a data-a="go" data-v="scripts" data-c="Todos"><span>▤</span>Scripts</a><a data-a="go" data-v="execs"><span>⬇</span>Executores</a><a data-a="go" data-v="reviews"><span>★</span>Avaliações</a><a data-a="orders"><span>📦</span>Meus pedidos</a><a data-a="cart"><span>🛒</span>Carrinho</a><a data-a="chat"><span>💬</span>Suporte</a>
<h4>CATEGORIAS</h4>${cats().slice(1).map(x => `<a data-a="go" data-v="scripts" data-c="${esc(x)}"><span>🎮</span>${esc(x)}</a>`).join('')}
<h4>SUPORTE ONLINE</h4><div style="display:flex;gap:8px;padding:0 6px">${c.discord ? `<a class="btn o s" style="flex:1" href="${esc(c.discord)}" target="_blank" rel="noopener">Discord</a>` : ''}${c.insta ? `<a class="btn o s" style="flex:1" href="${esc(c.insta)}" target="_blank" rel="noopener">Instagram</a>` : ''}</div></div>`;
  $('#dr').classList.add('open');
}

/* ---- conta / login ---- */
const loginModal = () => modal(`<div class="bp"><h2>Fazer login</h2><p style="color:var(--mut)">Entre com o Discord para comprar, avaliar e falar com o suporte. Usamos apenas seu nome, avatar e cargo no servidor.</p><a class="btn" style="width:100%" href="/auth/discord">Entrar com Discord</a></div>`);
function account() {
  if (!me) return loginModal();
  modal(`<div class="bp" style="text-align:center">${me.avatar ? `<img class="av" style="width:64px;height:64px" src="${esc(me.avatar)}" alt="">` : ''}<h2>${esc(me.username)}</h2><p style="color:var(--mut)">${me.isAdmin ? 'Equipe' : 'Cliente'}</p><div style="display:grid;gap:8px"><span class="btn o" data-a="orders">Meus pedidos</span>${me.isAdmin ? '<span class="btn" data-a="panel">Painel admin</span>' : ''}<span class="btn o" data-a="logout">Sair</span></div></div>`);
}
async function ordersView() {
  if (!me) return loginModal();
  try {
    const L = await api('/orders');
    modal(`<div class="bp"><h2>Meus pedidos</h2>${L.length ? L.map(o => `<div class="li" style="flex-wrap:wrap;margin-top:10px"><b>#${o.id}</b><span>${brl(o.total)}</span><span class="tag ${o.status == 'paid' ? 'on' : ''}">${{ pending: 'Aguardando pagamento', paid: 'Pago', cancelled: 'Cancelado' }[o.status]}</span><div style="flex-basis:100%;font-size:13px;color:var(--mut)">${o.items.map(i => o.status == 'paid' ? `<a style="color:var(--a);cursor:pointer" data-a="view" data-v="${i.id}">${esc(i.name)}</a>` : esc(i.name)).join(' · ')}</div></div>`).join('') : '<p style="color:var(--mut)">Você ainda não fez pedidos.</p>'}</div>`);
  } catch (e) { fail(e); }
}

/* ---- loja ---- */
function show(id) {
  const s = S.scripts.find(x => x.id == id); if (!s) return;
  modal(`${cover(s)}<div class="bp"><small style="color:var(--a);font-weight:700;letter-spacing:.2em">${esc(s.game).toUpperCase()}</small><h2>${esc(s.name)}</h2><p style="color:var(--mut)">${esc(s.desc)}</p>${s.locked ? `<p style="display:flex;justify-content:space-between;align-items:center"><b class="cond" style="font-size:32px;color:var(--ok)">${brl(s.price)}</b><span class="btn" data-a="add" data-v="${s.id}">Adicionar ao carrinho</span></p>` : `<pre>${esc(s.code)}</pre><span class="btn" style="width:100%" data-a="copy" data-v="${s.id}">Copiar script</span>`}</div>`);
}
function cartView() {
  const it = cart.map(id => S.scripts.find(s => s.id == id)).filter(Boolean), tot = it.reduce((a, s) => a + +s.price, 0);
  modal(`<div class="bp"><h2>Carrinho</h2>${it.length ? it.map(s => `<div class="li" style="margin-top:10px"><b>${esc(s.name)}</b><span>${brl(s.price)}</span><span class="btn s" data-a="rm" data-v="${s.id}">×</span></div>`).join('') + `<p style="display:flex;justify-content:space-between;font-size:20px"><b>Total</b><b class="cond" style="color:var(--ok)">${brl(tot)}</b></p><span class="btn" style="width:100%" data-a="buy">Finalizar pedido</span>` : '<div style="text-align:center;padding:40px 0"><div style="font-size:44px">🛒</div><b>Seu carrinho está vazio.</b><p style="color:var(--mut)">Assim que você escolher um produto, ele aparecerá aqui!</p></div>'}</div>`);
}
async function checkout() {
  if (!me) return loginModal();
  try {
    const o = await api('/orders', 'POST', { ids: cart }); cart = []; saveCart(); await load();
    modal(`<div class="bp" style="text-align:center"><div style="font-size:44px">✅</div><h2>Pedido #${o.id} criado</h2><p style="color:var(--mut)">Total ${brl(o.total)}. A equipe foi avisada no Discord. Combine o pagamento no chat de suporte; quando for confirmado, o script libera em "Meus pedidos".</p><span class="btn" data-a="chat">Abrir suporte</span></div>`);
  } catch (e) { fail(e); }
}

/* ---- chat de suporte ---- */
const chatHTML = t => (t && t.messages.length ? t.messages : [{ from: 'staff', name: 'Equipe', text: 'Olá! Como podemos ajudar? Envie sua mensagem e um atendente responde por aqui.' }]).map(m => `<div class="cm ${m.from == 'user' ? 'me' : ''}"><small>${esc(m.name)}</small>${esc(m.text)}</div>`).join('');
async function pullChat(scroll) { try { const { ticket } = await api('/support/mine'); const b = $('#cm'); if (!b) return; const atEnd = b.scrollHeight - b.scrollTop - b.clientHeight < 60; b.innerHTML = chatHTML(ticket); if (scroll || atEnd) b.scrollTop = b.scrollHeight; } catch (e) { /* ignora */ } }
function openChat() {
  if (!me) return loginModal();
  $('#dr').classList.remove('open'); document.querySelectorAll('.ov').forEach(x => x.remove());
  $('#chat').innerHTML = `<div class="chat"><div class="chh"><b>Suporte</b><span data-a="chatx" style="cursor:pointer;font-size:22px">×</span></div><div class="chm" id="cm"></div><div class="chi"><input id="ci" maxlength="800" placeholder="Digite sua mensagem"><span class="btn s" data-a="chats">Enviar</span></div></div>`;
  pullChat(true); clearInterval(chatT); chatT = setInterval(() => pullChat(false), 4000);
  $('#ci').onkeydown = e => { if (e.key == 'Enter') sendChat(); };
}
async function sendChat() { const i = $('#ci'), t = i.value.trim(); if (!t) return; i.value = ''; try { const { ticket } = await api('/support/mine', 'POST', { text: t }); $('#cm').innerHTML = chatHTML(ticket); $('#cm').scrollTop = 9e9; } catch (e) { i.value = t; fail(e); } }

/* ---- painel admin ---- */
const FM = { scripts: [['name', 'Nome'], ['game', 'Jogo / categoria'], ['price', 'Preço em R$ (0 = grátis)', 'n'], ['desc', 'Descrição'], ['img', 'URL da capa (opcional)'], ['code', 'Script', 't'], ['hot', 'Destaque na home', 'c']], execs: [['name', 'Nome'], ['plat', 'Plataforma (PC / Android / iOS)'], ['status', 'Status (Online / Atualizando)'], ['desc', 'Descrição'], ['link', 'Link de download']] };
function unlock() {
  const o = modal('<div class="bp"><h2>Senha de admin</h2><p style="color:var(--mut)">Confirme a senha para abrir o painel.</p><input class="in" id="upw" type="password"><div class="msg" id="ums"></div><span class="btn" id="ugo" style="width:100%">Entrar</span></div>');
  o.querySelector('#ugo').onclick = async () => { try { await api('/admin/unlock', 'POST', { password: o.querySelector('#upw').value }); me = (await api('/me')).user; o.remove(); panel(); } catch (e) { o.querySelector('#ums').textContent = e.message; } };
}
async function panel(tab = 'scripts', eid = null) {
  if (!me || !me.isAdmin) return toast('Acesso restrito à equipe.');
  if (me.locked) return unlock();
  clearInterval(admT);
  let a = $('.adm'); if (!a) { a = document.createElement('div'); a.className = 'adm'; document.body.append(a); }
  const c = S.cfg, T = (k, n) => `<span class="btn s ${tab == k ? '' : 'o'}" data-t="${k}">${n}</span>`; let b = '', tk = [];
  try {
    if (tab == 'look') b = `<div class="ac"><div class="cols"><div><label>Nome do site</label><input class="in" data-k="name" value="${esc(c.name)}"></div><div><label>URL do logo</label><input class="in" data-k="logo" value="${esc(c.logo)}"></div></div><label>Frase principal</label><input class="in" data-k="tag" value="${esc(c.tag)}">
<div class="cols"><div><label>Link do Discord</label><input class="in" data-k="discord" value="${esc(c.discord)}"></div><div><label>Link do Instagram</label><input class="in" data-k="insta" value="${esc(c.insta)}"></div></div><label>Rodapé</label><input class="in" data-k="footer" value="${esc(c.footer)}">
<div class="cols"><div><label>Cor 1</label><input class="in" type="color" data-k="a" value="${c.a}"></div><div><label>Cor 2</label><input class="in" type="color" data-k="b" value="${c.b}"></div><div><label>Fundo</label><input class="in" type="color" data-k="bg" value="${c.bg}"></div><div><label>Arredondado ${c.r}px</label><input class="in" type="range" min="4" max="32" data-k="r" value="${c.r}"></div></div><label style="display:flex;gap:8px"><input type="checkbox" data-k="light" ${c.light ? 'checked' : ''}> Tema claro</label></div>`;
    else if (tab == 'orders') { const L = await api('/orders'); b = `<div class="ac">${L.map(o => `<div class="li" style="flex-wrap:wrap"><b>#${o.id} · ${esc(o.username)}</b><span>${brl(o.total)}</span><span class="tag">${o.status}</span><div style="flex-basis:100%;color:var(--mut);font-size:13px">${o.items.map(i => esc(i.name)).join(', ')}</div>${o.status == 'pending' ? `<span class="btn s" data-o="${o.id}" data-s="paid">Marcar pago</span><span class="btn s o" data-o="${o.id}" data-s="cancelled">Cancelar</span>` : ''}</div>`).join('') || '<p>Nenhum pedido.</p>'}</div>`; }
    else if (tab == 'tickets') {
      tk = await api('/support'); const t = tk.find(x => x.id == eid);
      b = `<div class="ac">${tk.map(x => `<div class="li"><b>${esc(x.username)} — ${esc(x.messages.at(-1)?.text || '')}</b><span class="tag ${x.status == 'open' ? 'on' : ''}">${x.status == 'open' ? 'aberto' : 'fechado'}</span><span class="btn s o" data-tk="${x.id}">Abrir</span></div>`).join('') || '<p>Nenhum ticket.</p>'}${t ? `<h3 style="font-size:24px;margin:20px 0 8px">Ticket de ${esc(t.username)}</h3><div class="chm" style="height:260px;border:1px solid var(--line);border-radius:14px">${chatHTML(t)}</div>${t.status == 'open' ? `<div class="chi" style="padding:10px 0"><input id="ri" class="in" style="margin:0" placeholder="Responder ao cliente"><span class="btn s" id="rs">Responder</span><span class="btn s o" id="rc">Fechar</span></div>` : ''}` : ''}</div>`;
      admT = setInterval(() => { if ($('.adm') && document.activeElement?.id != 'ri') panel('tickets', eid); }, 8000);
    } else {
      const e = S[tab].find(x => x.id == eid) || {};
      b = `<div class="ac"><h3 style="font-size:24px">${eid ? 'Editar' : 'Novo'} item</h3>${FM[tab].map(([k, n, t]) => t == 't' ? `<label>${n}</label><textarea class="in" id="f_${k}" rows="6" style="font-family:monospace">${esc(e[k])}</textarea>` : t == 'c' ? `<label style="display:flex;gap:8px"><input type="checkbox" id="f_${k}" ${e[k] ? 'checked' : ''}> ${n}</label><br>` : `<label>${n}</label><input class="in" id="f_${k}" ${t == 'n' ? 'type="number" step="0.01" min="0"' : ''} value="${esc(e[k])}">`).join('')}<span class="btn" id="sv">${eid ? 'Salvar' : 'Adicionar'}</span> ${eid ? `<span class="btn o" data-t="${tab}">Cancelar</span>` : ''}
<h3 style="font-size:24px;margin:26px 0 10px">Itens (${S[tab].length})</h3>${S[tab].map(x => `<div class="li"><b>${esc(x.name)}</b><span class="btn s o" data-e="${x.id}">Editar</span><span class="btn s" data-x="${x.id}">Excluir</span></div>`).join('')}</div>`;
    }
  } catch (e) { fail(e); b = '<div class="ac"><p>Não foi possível carregar.</p></div>'; }
  a.innerHTML = `<div class="ah"><h2>Painel admin</h2>${T('scripts', 'Scripts')}${T('execs', 'Executores')}${T('orders', 'Pedidos')}${T('tickets', 'Suporte')}${T('look', 'Aparência')}<span class="btn s" id="cl">Fechar</span></div>${b}`;
  a.querySelectorAll('[data-t]').forEach(x => x.onclick = () => panel(x.dataset.t));
  $('#cl').onclick = () => { clearInterval(admT); a.remove(); load(); };
  if (tab == 'look') a.querySelectorAll('[data-k]').forEach(i => i.onchange = async () => { const k = i.dataset.k, v = i.type == 'checkbox' ? i.checked : i.type == 'range' ? +i.value : i.value; S.cfg[k] = v; theme(); try { await api('/cfg', 'PUT', { [k]: v }); } catch (e) { fail(e); } });
  else if (tab == 'orders') a.querySelectorAll('[data-o]').forEach(x => x.onclick = async () => { try { await api(`/orders/${x.dataset.o}/status`, 'POST', { status: x.dataset.s }); panel('orders'); } catch (e) { fail(e); } });
  else if (tab == 'tickets') {
    a.querySelectorAll('[data-tk]').forEach(x => x.onclick = () => panel('tickets', x.dataset.tk));
    if ($('#rs')) { $('#rs').onclick = async () => { const v = $('#ri').value.trim(); if (!v) return; try { await api(`/support/${eid}/messages`, 'POST', { text: v }); panel('tickets', eid); } catch (e) { fail(e); } }; $('#rc').onclick = async () => { try { await api(`/support/${eid}/close`, 'POST'); panel('tickets', eid); } catch (e) { fail(e); } }; }
  } else {
    a.querySelectorAll('[data-e]').forEach(x => x.onclick = () => panel(tab, x.dataset.e));
    a.querySelectorAll('[data-x]').forEach(x => x.onclick = async () => { if (!confirm('Excluir este item?')) return; try { await api(`/${tab}/${x.dataset.x}`, 'DELETE'); await refresh(); panel(tab); } catch (e) { fail(e); } });
    $('#sv').onclick = async () => { const o = {}; FM[tab].forEach(([k, , t]) => { const i = $('#f_' + k); o[k] = t == 'c' ? i.checked : i.value; }); try { eid ? await api(`/${tab}/${eid}`, 'PUT', o) : await api(`/${tab}`, 'POST', o); await refresh(); toast('Salvo!'); panel(tab); } catch (e) { fail(e); } };
  }
}
const refresh = async () => { S = await api('/bootstrap'); };

/* ---- eventos ---- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-a]'); if (!t) return; const v = t.dataset.v, a = t.dataset.a;
  if (a == 'menu') drawer();
  else if (a == 'go') { document.querySelectorAll('.ov').forEach(x => x.remove()); go(v, t.dataset.c !== undefined ? { cat: t.dataset.c, q: '' } : {}); }
  else if (a == 'cat') { cat = v; render(); }
  else if (a == 'view') { if (!(e.target.closest('[data-a=add]'))) { document.querySelectorAll('.ov').forEach(x => x.remove()); show(v); } }
  else if (a == 'add') { if (!cart.includes(v)) cart.push(v); saveCart(); theme(); toast('Adicionado ao carrinho!'); }
  else if (a == 'cart') { $('#dr').classList.remove('open'); cartView(); }
  else if (a == 'rm') { cart = cart.filter(i => i != v); saveCart(); theme(); t.closest('.ov').remove(); cartView(); }
  else if (a == 'buy') { t.closest('.ov').remove(); checkout(); }
  else if (a == 'copy') copy(S.scripts.find(s => s.id == v).code);
  else if (a == 'dl') { const x = S.execs.find(i => i.id == v); x && x.link && x.link != '#' ? window.open(x.link, '_blank', 'noopener') : toast('Link ainda não configurado'); }
  else if (a == 'user') account();
  else if (a == 'orders') { document.querySelectorAll('.ov').forEach(x => x.remove()); $('#dr').classList.remove('open'); ordersView(); }
  else if (a == 'logout') { await api('/auth/logout', 'POST'); location.reload(); }
  else if (a == 'panel') { document.querySelectorAll('.ov').forEach(x => x.remove()); panel(); }
  else if (a == 'chat') openChat();
  else if (a == 'chatx') { clearInterval(chatT); $('#chat').innerHTML = ''; }
  else if (a == 'chats') sendChat();
  else if (a == 'rate') { myRate = +v; document.querySelectorAll('#rate span').forEach((s, i) => s.classList.toggle('on', i < myRate)); }
  else if (a == 'sendrv') { try { await api('/reviews', 'POST', { rating: myRate, text: $('#rt').value }); await refresh(); render(); toast('Avaliação publicada!'); } catch (er) { fail(er); } }
  else if (a == 'delrv') { if (confirm('Remover esta avaliação?')) { try { await api('/reviews/' + v, 'DELETE'); await refresh(); render(); } catch (er) { fail(er); } } }
});
$('#dr').onclick = e => { if (e.target.id == 'dr') e.target.classList.remove('open'); };
$('#sq').onkeydown = e => { if (e.key == 'Enter') go('scripts', { q: e.target.value, cat: 'Todos' }); };
load();
