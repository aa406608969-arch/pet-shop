let products = [], cat = '全部', cart = [];
const $ = (selector) => document.querySelector(selector);
const yen = (amount) => `¥${amount}`;

async function load() {
  const { data, error } = await db.from('products').select('*').eq('is_active', true);
  if (error) { $('#grid').innerHTML = '<p>商品服务暂不可用，请稍后再试。</p>'; return; }
  products = data || []; render();
  const { data: { session } } = await db.auth.getSession();
  if (session) { $('#authBtn').textContent = '已登录'; await loadCart(); }
}
function render() {
  const q = $('#search').value.trim();
  let list = products.filter((x) => (cat === '全部' || x.category === cat) && x.name.includes(q));
  if ($('#sort').value === 'low') list.sort((a, b) => a.price - b.price);
  if ($('#sort').value === 'high') list.sort((a, b) => b.price - a.price);
  $('#grid').innerHTML = list.map((x) => `<article class="product"><button class="product-card" onclick="detail('${x.id}')"><div class="art" style="background:url('${x.image_url}') center/cover"></div><h3>${x.name}</h3><p>${yen(x.price)} <small>${x.category}</small></p></button></article>`).join('');
  $('#emptyResult').classList.toggle('show', !list.length);
}
async function loadCart() {
  const { data: { user } } = await db.auth.getUser(); if (!user) return;
  const { data } = await db.from('cart_items').select('id,quantity,products(*)').eq('user_id', user.id);
  cart = (data || []).map((x) => ({ ...x.products, q: x.quantity, line: x.id })); renderCart();
}
function detail(id) {
  const x = products.find((p) => p.id === id); if (!x) return;
  $('#detail').innerHTML = `<button class="x" onclick="closeModal('detailModal')">×</button><div class="detail-art" style="background:url('${x.image_url}') center/cover"></div><div class="detail-copy"><p class="eyebrow">${x.category}</p><h2>${x.name}</h2><div class="price">${yen(x.price)}</div><p>${x.description}</p><div class="stock">库存：${x.stock} 件</div><button class="primary" onclick="add('${x.id}')">加入购物袋　→</button></div>`;
  $('#detailModal').classList.add('show');
}
async function add(id) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) { closeModal('detailModal'); $('#authModal').classList.add('show'); return; }
  const old = cart.find((x) => x.id === id), quantity = (old?.q || 0) + 1;
  const { error } = await db.from('cart_items').upsert({ user_id: user.id, product_id: id, quantity }, { onConflict: 'user_id,product_id' });
  if (error) return alert(error.message); closeModal('detailModal'); await loadCart(); showCart();
}
function renderCart() {
  const sub = cart.reduce((sum, x) => sum + x.q * x.price, 0), ship = sub && sub < 199 ? 12 : 0;
  $('#count').textContent = cart.reduce((sum, x) => sum + x.q, 0); $('#subtotal').textContent = yen(sub); $('#shipping').textContent = ship ? yen(ship) : '免运费'; $('#total').textContent = yen(sub + ship);
  $('#shippingNote').textContent = sub && sub < 199 ? `再购 ${yen(199 - sub)} 即享免运费` : '';
  $('#cartItems').innerHTML = cart.map((x) => `<div class="line"><span>${x.name}<small>${yen(x.price)} × ${x.q}</small></span><button class="remove" onclick="drop('${x.line}')">×</button></div>`).join('') || '<p class="hint">还没有选中任何好物。</p>';
}
async function drop(id) { await db.from('cart_items').delete().eq('id', id); await loadCart(); }
function showCart() { $('#cart').classList.add('open'); $('#shade').classList.add('show'); }
function closeCart() { $('#cart').classList.remove('open'); $('#shade').classList.remove('show'); }
function closeModal(id) { $(`#${id}`).classList.remove('show'); }
function authStatus(message, error = false) { const el = $('#authStatus'); el.textContent = message; el.style.color = error ? '#b04444' : '#54715d'; }

$('#cartBtn').onclick = showCart; $('#shade').onclick = closeCart;
$('#searchBtn').onclick = () => { $('#search').focus(); location.hash = 'products'; };
$('#search').oninput = render; $('#sort').onchange = render;
document.querySelectorAll('[data-cat]').forEach((x) => x.onclick = () => { cat = x.dataset.cat; render(); });
document.querySelectorAll('[data-close]').forEach((x) => x.onclick = () => closeModal(x.dataset.close));
$('#authBtn').onclick = () => $('#authModal').classList.add('show');
$('#loginForm').onsubmit = async (event) => {
  event.preventDefault(); const f = new FormData(event.target);
  const { error } = await db.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
  if (error) return authStatus('登录失败：' + error.message, true);
  closeModal('authModal'); $('#authBtn').textContent = '已登录'; await loadCart();
};
$('#checkout').onclick = () => { if (!cart.length) return alert('请先将商品加入购物袋。'); closeCart(); $('#checkoutModal').classList.add('show'); };
$('#orderForm').onsubmit = (event) => { event.preventDefault(); alert('配送信息已保存。支付功能尚未接入。'); closeModal('checkoutModal'); };
load();
