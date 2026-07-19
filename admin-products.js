const $ = (selector) => document.querySelector(selector);
let user;
let products = [];
let busy = false;

const safe = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const money = (value) => `¥${Number(value || 0).toFixed(2)}`;

function setStatus(message = '', isError = false) {
  const node = $('#formStatus');
  node.textContent = message;
  node.style.color = isError ? '#b04444' : '#54715d';
}

function setBusy(value) {
  busy = value;
  $('#saveProduct').disabled = value;
  $('#saveProduct').textContent = value ? '正在保存…' : ($('#productForm').id.value ? '保存修改' : '保存商品');
  document.querySelectorAll('#adminProducts button, #newProduct, #cancelEdit').forEach((button) => { button.disabled = value; });
}

function preview(url) {
  const node = $('#imagePreview');
  node.style.backgroundImage = url ? `url("${url.replace(/"/g, '%22')}")` : '';
  node.textContent = url ? '' : '图片预览';
}

function clearForm({ preserveStatus = false } = {}) {
  const form = $('#productForm');
  form.reset();
  form.id.value = '';
  form.is_active.checked = true;
  $('#formTitle').textContent = '新增商品';
  $('#cancelEdit').classList.add('hidden');
  $('#saveProduct').textContent = '保存商品';
  preview('');
  if (!preserveStatus) setStatus('');
}

function getProduct(id) {
  return products.find((product) => product.id === id);
}

function render() {
  const keyword = $('#productFilter').value.trim().toLowerCase();
  const list = products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(keyword));
  $('#productCount').textContent = `共 ${products.length} 件商品 · 当前显示 ${list.length} 件`;
  $('#adminProducts').innerHTML = list.map((product) => `
    <article class="admin-product">
      <div class="admin-thumb" style="background-image:url('${safe(product.image_url)}')"></div>
      <div class="admin-copy">
        <div><b>${safe(product.name)}</b>${product.is_active ? '<em>已上架</em>' : '<em class="off">已下架</em>'}</div>
        <span>${safe(product.category)} · ${money(product.price)} · 库存 ${Number(product.stock)}</span>
        <p>${safe(product.description || '暂无商品说明')}</p>
      </div>
      <div class="admin-actions">
        <button class="text-button" type="button" data-action="edit" data-id="${product.id}">编辑</button>
        <button class="text-button" type="button" data-action="toggle" data-id="${product.id}">${product.is_active ? '下架' : '上架'}</button>
        <button class="text-button danger" type="button" data-action="delete" data-id="${product.id}">删除</button>
      </div>
    </article>`).join('') || '<p class="hint">没有匹配的商品。</p>';
}

async function loadProducts() {
  const { data, error } = await db.from('products').select('*').order('created_at', { ascending: false });
  if (error) {
    setStatus(`加载商品失败：${error.message}`, true);
    return;
  }
  products = data || [];
  render();
}

function editProduct(id) {
  const product = getProduct(id);
  if (!product) return setStatus('未找到该商品，请刷新列表后重试。', true);
  const form = $('#productForm');
  form.id.value = product.id;
  form.name.value = product.name || '';
  form.category.value = product.category || '';
  form.price.value = product.price;
  form.stock.value = product.stock;
  form.image_url.value = product.image_url || '';
  form.description.value = product.description || '';
  form.is_active.checked = Boolean(product.is_active);
  $('#formTitle').textContent = `编辑：${product.name}`;
  $('#cancelEdit').classList.remove('hidden');
  $('#saveProduct').textContent = '保存修改';
  preview(product.image_url || '');
  setStatus('已载入商品信息，修改后点击“保存修改”。');
  $('#productForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.name.focus();
}

async function toggleProduct(id) {
  const product = getProduct(id);
  if (!product) return;
  const nextActive = !product.is_active;
  const action = nextActive ? '上架' : '下架';
  if (!confirm(`确定要${action}“${product.name}”吗？${nextActive ? '上架后会在前台展示。' : '下架后将不再在前台展示。'}`)) return;
  setBusy(true);
  setStatus(`正在${action}商品…`);
  const { error } = await db.from('products').update({ is_active: nextActive }).eq('id', id);
  setBusy(false);
  if (error) return setStatus(`${action}失败：${error.message}`, true);
  if ($('#productForm').id.value === id) $('#productForm').is_active.checked = nextActive;
  setStatus(`商品已${action}。`);
  await loadProducts();
}

async function deleteProduct(id) {
  const product = getProduct(id);
  if (!product) return;
  if (!confirm(`确定永久删除“${product.name}”吗？删除后无法恢复，历史订单不会受影响。`)) return;
  setBusy(true);
  setStatus('正在删除商品…');
  const { error } = await db.from('products').delete().eq('id', id);
  setBusy(false);
  if (error) return setStatus(`删除失败：${error.message}`, true);
  if ($('#productForm').id.value === id) clearForm({ preserveStatus: true });
  setStatus('商品已删除。');
  await loadProducts();
}

$('#productForm').image_url.addEventListener('input', (event) => preview(event.target.value.trim()));
$('#productForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const payload = {
    name: fields.get('name').trim(),
    category: fields.get('category').trim(),
    price: Number(fields.get('price')),
    stock: Number(fields.get('stock')),
    image_url: fields.get('image_url').trim(),
    description: fields.get('description').trim(),
    is_active: fields.get('is_active') === 'on'
  };
  const id = fields.get('id');
  setBusy(true);
  setStatus(id ? '正在保存修改…' : '正在新增商品…');
  const { error } = id
    ? await db.from('products').update(payload).eq('id', id)
    : await db.from('products').insert(payload);
  setBusy(false);
  if (error) return setStatus(`保存失败：${error.message}`, true);
  clearForm({ preserveStatus: true });
  setStatus(id ? '商品修改已保存。' : '新商品已创建。');
  await loadProducts();
});

$('#newProduct').addEventListener('click', () => clearForm());
$('#cancelEdit').addEventListener('click', () => clearForm());
$('#productFilter').addEventListener('input', render);
$('#adminProducts').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || busy) return;
  const { action, id } = button.dataset;
  if (action === 'edit') editProduct(id);
  if (action === 'toggle') toggleProduct(id);
  if (action === 'delete') deleteProduct(id);
});

async function init() {
  const { data: { user: current } } = await db.auth.getUser();
  if (!current) return location.replace('index.html?login=1');
  user = current;
  const { data: admin, error } = await db.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error || !admin) {
    document.querySelector('.admin-page').innerHTML = '<section class="access-denied"><p class="eyebrow">ACCESS DENIED</p><h1>没有商品管理权限</h1><p class="hint">请使用管理员账号登录，或联系网站管理员开通权限。</p><a class="primary" href="index.html">返回商城</a></section>';
    return;
  }
  await loadProducts();
}

init();
