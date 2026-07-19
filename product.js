const detailRoot = document.querySelector('#productDetail');
const productId = new URLSearchParams(location.search).get('id');
const money = (amount) => `¥${Number(amount || 0).toFixed(0)}`;

async function addToCart(product) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return location.href = 'index.html?login=1';
  const { data: existing } = await db.from('cart_items').select('quantity').eq('user_id', user.id).eq('product_id', product.id).maybeSingle();
  const { error } = await db.from('cart_items').upsert({ user_id: user.id, product_id: product.id, quantity: (existing?.quantity || 0) + 1 }, { onConflict: 'user_id,product_id' });
  if (error) return alert(error.message);
  const button = document.querySelector('#addCart'); button.textContent = '已加入购物袋 ✓'; button.disabled = true;
  setTimeout(() => location.href = 'index.html', 700);
}

async function loadProduct() {
  if (!productId) { detailRoot.innerHTML = '<p>未找到该商品。</p>'; return; }
  const { data: product, error } = await db.from('products').select('*').eq('id', productId).eq('is_active', true).maybeSingle();
  if (error || !product) { detailRoot.innerHTML = '<p>该商品暂不可用或已下架。<a href="index.html#products">返回商品列表</a></p>'; return; }
  document.title = `${product.name} · 拾光宠物`; document.querySelector('#crumbName').textContent = product.name;
  detailRoot.innerHTML = `<div class="product-gallery"><div class="main-product-image" style="background-image:url('${product.image_url || ''}')"></div></div><div class="product-info"><p class="eyebrow">${product.category || 'SEASON PETS'}</p><h1>${product.name}</h1><div class="product-price">${money(product.price)}</div><p class="product-description">${product.description || '为毛孩子挑选的舒适日常用品。'}</p><div class="product-meta"><span>库存 <b>${product.stock ?? 0}</b> 件</span><span>满 ¥199 免运费</span></div><button class="primary add-cart" id="addCart" ${Number(product.stock) <= 0 ? 'disabled' : ''}>${Number(product.stock) <= 0 ? '暂时缺货' : '加入购物袋　→'}</button><p class="hint">下单后可在个人中心查看订单与配送地址。</p></div>`;
  const addButton = document.querySelector('#addCart'); if (!addButton.disabled) addButton.onclick = () => addToCart(product);
}
loadProduct();
