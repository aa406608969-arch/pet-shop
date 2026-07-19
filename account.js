const $ = (selector) => document.querySelector(selector);
let user, profile, addresses = [];
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c]);
async function init() {
  const { data: { user: current } } = await db.auth.getUser();
  if (!current) return location.replace('index.html'); user = current;
  const { data } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle(); profile = data;
  $('#accountName').textContent = profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0]; $('#accountEmail').textContent = user.email; $('#avatar').textContent = $('#accountName').textContent.slice(0, 1).toUpperCase();
  $('#profileForm').full_name.value = profile?.full_name || user.user_metadata?.full_name || ''; $('#profileForm').phone.value = profile?.phone || '';
  await Promise.all([loadAddresses(), loadOrders(), loadAdminEntry()]);
}
async function loadAdminEntry() {
  const { data: admin } = await db.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (admin) $('#adminEntry').classList.remove('hidden');
}
async function loadAddresses() { const { data } = await db.from('addresses').select('*').eq('user_id', user.id).order('is_default',{ascending:false}).order('created_at',{ascending:false}); addresses = data || []; $('#addressList').innerHTML = addresses.map((a) => `<article class="address-card"><b>${escapeHtml(a.recipient)} ${a.is_default ? '<em>默认</em>' : ''}</b><span>${escapeHtml(a.phone)}<br>${escapeHtml(a.detail)}</span><div>${!a.is_default ? `<button class="text-button" onclick="makeDefault('${a.id}')">设为默认</button>` : ''}<button class="text-button danger" onclick="removeAddress('${a.id}')">删除</button></div></article>`).join('') || '<p class="hint">还没有保存收货地址。</p>'; }
async function loadOrders() { const { data, error } = await db.from('orders').select('*,order_items(*)').eq('user_id', user.id).order('created_at',{ascending:false}); if(error) return $('#orderList').innerHTML = '<p class="hint">订单服务暂不可用。</p>'; $('#orderList').innerHTML = (data || []).map((o) => `<article class="order-card"><div><b>订单 ${o.id.slice(0,8)}</b><span>${new Date(o.created_at).toLocaleString('zh-CN')}</span></div><p>${(o.order_items||[]).map((i)=>`${escapeHtml(i.product_name)} × ${i.quantity}`).join('、') || '商品明细'}</p><div><em class="status">${o.status === 'pending' ? '待支付' : o.status}</em><b>¥${Number(o.total).toFixed(0)}</b></div></article>`).join('') || '<p class="hint">还没有订单，去商城挑选好物吧。</p>'; }
$('#profileForm').onsubmit = async (event) => { event.preventDefault(); const f = new FormData(event.target); const payload = { id:user.id, full_name:f.get('full_name'), phone:f.get('phone'), updated_at:new Date().toISOString() }; const { error } = await db.from('profiles').upsert(payload); $('#profileStatus').textContent = error ? error.message : '个人信息已保存。'; if(!error) { profile=payload; $('#accountName').textContent = payload.full_name || user.email.split('@')[0]; $('#avatar').textContent=$('#accountName').textContent.slice(0,1); } };
$('#newAddress').onclick = () => $('#addressForm').classList.toggle('hidden');
$('#addressForm').onsubmit = async (event) => { event.preventDefault(); const f = new FormData(event.target); const isDefault = f.get('is_default') === 'on' || !addresses.length; if(isDefault && addresses.length) await db.from('addresses').update({is_default:false}).eq('user_id',user.id); const { error } = await db.from('addresses').insert({user_id:user.id,recipient:f.get('recipient'),phone:f.get('phone'),detail:f.get('detail'),is_default:isDefault}); if(error) return alert(error.message); event.target.reset(); event.target.classList.add('hidden'); loadAddresses(); };
async function makeDefault(id) { await db.from('addresses').update({is_default:false}).eq('user_id',user.id); await db.from('addresses').update({is_default:true}).eq('id',id); loadAddresses(); }
async function removeAddress(id) { if(!confirm('确定删除这条地址吗？')) return; await db.from('addresses').delete().eq('id',id); loadAddresses(); }
$('#signOut').onclick = async () => { await db.auth.signOut(); location.href='index.html'; };
init();
