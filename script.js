let products = [], category = '全部', cart = [], addresses = [], currentUser;
const $ = (selector) => document.querySelector(selector);
const money = (amount) => `¥${Number(amount || 0).toFixed(0)}`;

function authLabel(user) { return user.user_metadata?.full_name || user.email.split('@')[0]; }
function closeModal(id) { $(`#${id}`).classList.remove('show'); }
function showCart() { $('#cart').classList.add('open'); $('#shade').classList.add('show'); }
function closeCart() { $('#cart').classList.remove('open'); $('#shade').classList.remove('show'); }
function authStatus(message, isError = false) { $('#authStatus').textContent = message; $('#authStatus').style.color = isError ? '#b04444' : '#54715d'; }

async function load() {
  const [{ data: productData, error }, { data: { user } }] = await Promise.all([
    db.from('products').select('*').eq('is_active', true), db.auth.getUser()
  ]);
  if (error) $('#grid').innerHTML = '<p>商品服务暂不可用，请稍后再试。</p>';
  products = productData || [];
  currentUser = user;
  if (user) { $('#authBtn').textContent = authLabel(user); await Promise.all([loadCart(), loadAddresses()]); }
  render();
}

function render() {
  const keyword = $('#search').value.trim();
  let list = products.filter((item) => (category === '全部' || item.category === category) && item.name.includes(keyword));
  if ($('#sort').value === 'low') list.sort((a, b) => a.price - b.price);
  if ($('#sort').value === 'high') list.sort((a, b) => b.price - a.price);
  $('#grid').innerHTML = list.map((item) => `<article class="product"><button class="product-card" onclick="detail('${item.id}')"><div class="art" style="background:url('${item.image_url}') center/cover"></div><h3>${item.name}</h3><p>${money(item.price)} <small>${item.category}</small></p></button></article>`).join('');
  $('#emptyResult').classList.toggle('show', !list.length);
}

async function loadCart() {
  const { data, error } = await db.from('cart_items').select('id,quantity,products(*)').eq('user_id', currentUser.id);
  if (error) return;
  cart = (data || []).filter((row) => row.products).map((row) => ({ ...row.products, q: row.quantity, line: row.id }));
  renderCart();
}

async function loadAddresses() {
  const { data } = await db.from('addresses').select('*').eq('user_id', currentUser.id).order('is_default', { ascending: false }).order('created_at', { ascending: false });
  addresses = data || [];
}

function detail(id) { location.href = `product.html?id=${encodeURIComponent(id)}`; }

async function add(id) {
  if (!currentUser) { $('#authModal').classList.add('show'); return; }
  const old = cart.find((item) => item.id === id);
  const { error } = await db.from('cart_items').upsert({ user_id: currentUser.id, product_id: id, quantity: (old?.q || 0) + 1 }, { onConflict: 'user_id,product_id' });
  if (error) return alert(error.message);
  await loadCart(); showCart();
}

function renderCart() {
  const subtotal = cart.reduce((sum, item) => sum + item.q * item.price, 0), shipping = subtotal && subtotal < 199 ? 12 : 0;
  $('#count').textContent = cart.reduce((sum, item) => sum + item.q, 0);
  $('#subtotal').textContent = money(subtotal); $('#shipping').textContent = shipping ? money(shipping) : '免运费'; $('#total').textContent = money(subtotal + shipping);
  $('#shippingNote').textContent = subtotal && subtotal < 199 ? `再购 ${money(199 - subtotal)} 即享免运费` : '';
  $('#cartItems').innerHTML = cart.map((item) => `<div class="line"><span>${item.name}<small>${money(item.price)} × ${item.q}</small></span><button class="remove" onclick="drop('${item.line}')">×</button></div>`).join('') || '<p class="hint">还没有选中任何好物。</p>';
}

async function drop(id) { await db.from('cart_items').delete().eq('id', id); await loadCart(); }

function prepareCheckout() {
  const select = $('#addressSelect');
  select.innerHTML = '<option value="">新增地址</option>' + addresses.map((a) => `<option value="${a.id}">${a.is_default ? '默认 · ' : ''}${a.recipient} · ${a.phone} · ${a.detail}</option>`).join('');
  const defaultAddress = addresses.find((a) => a.is_default) || addresses[0];
  if (defaultAddress) { select.value = defaultAddress.id; fillAddress(defaultAddress); }
  $('#checkoutModal').classList.add('show');
}
function fillAddress(address) {
  const fields = $('#addressFields');
  if (!address) { fields.classList.remove('hidden'); fields.querySelectorAll('input,textarea').forEach((el) => el.required = true); return; }
  fields.classList.add('hidden'); fields.querySelectorAll('input,textarea').forEach((el) => el.required = false);
}

async function submitOrder(event) {
  event.preventDefault();
  if (!cart.length) return;
  const form = new FormData(event.target); const selected = addresses.find((a) => a.id === form.get('address_id'));
  const recipient = selected?.recipient || form.get('name'); const phone = selected?.phone || form.get('phone'); const detail = selected?.detail || form.get('address');
  const subtotal = cart.reduce((sum, item) => sum + item.q * item.price, 0), shipping = subtotal && subtotal < 199 ? 12 : 0;
  $('#orderStatus').textContent = '正在提交订单…';
  let addressId = selected?.id;
  if (!addressId && form.get('save_address') === 'on') {
    const { data, error } = await db.from('addresses').insert({ user_id: currentUser.id, recipient, phone, detail, is_default: !addresses.length }).select().single();
    if (error) return $('#orderStatus').textContent = error.message;
    addressId = data.id; await loadAddresses();
  }
  const { data: order, error } = await db.from('orders').insert({ user_id: currentUser.id, address_id: addressId || null, recipient, phone, address_detail: detail, subtotal, shipping_fee: shipping, total: subtotal + shipping, status: 'pending' }).select().single();
  if (error) return $('#orderStatus').textContent = error.message;
  const { error: itemError } = await db.from('order_items').insert(cart.map((item) => ({ order_id: order.id, product_id: item.id, product_name: item.name, price: item.price, quantity: item.q })));
  if (itemError) return $('#orderStatus').textContent = itemError.message;
  await db.from('cart_items').delete().eq('user_id', currentUser.id);
  cart = []; renderCart(); closeModal('checkoutModal'); alert(`订单 ${order.id.slice(0, 8)} 已提交，请在个人中心查看。`);
}

$('#cartBtn').onclick = showCart; $('#shade').onclick = closeCart;
$('#searchBtn').onclick = () => { $('#search').focus(); location.hash = 'products'; };
$('#search').oninput = render; $('#sort').onchange = render;
document.querySelectorAll('[data-cat]').forEach((button) => button.onclick = () => { category = button.dataset.cat; render(); });
document.querySelectorAll('[data-close]').forEach((button) => button.onclick = () => button.dataset.close === 'cart' ? closeCart() : closeModal(button.dataset.close));
$('#authBtn').onclick = () => currentUser ? location.href = 'account.html' : $('#authModal').classList.add('show');
$('#loginForm').onsubmit = async (event) => { event.preventDefault(); const form = new FormData(event.target); const { data, error } = await db.auth.signInWithPassword({ email: form.get('email'), password: form.get('password') }); if (error) return authStatus(`登录失败：${error.message}`, true); currentUser = data.user; $('#authBtn').textContent = authLabel(currentUser); closeModal('authModal'); await Promise.all([loadCart(), loadAddresses()]); };
$('#checkout').onclick = () => { if (!cart.length) return alert('请先将商品加入购物袋。'); if (!currentUser) return $('#authModal').classList.add('show'); closeCart(); prepareCheckout(); };
$('#addressSelect').onchange = (event) => fillAddress(addresses.find((a) => a.id === event.target.value));
$('#orderForm').onsubmit = submitOrder;
if (new URLSearchParams(location.search).get('login') === '1') $('#authModal').classList.add('show');
load();
