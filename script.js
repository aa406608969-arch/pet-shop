let products=[],cat='全部',cart=[];
const $=s=>document.querySelector(s),yen=n=>'¥'+n;

async function load(){
  const {data,error}=await db.from('products').select('*').eq('is_active',true);
  if(error){$('#grid').innerHTML='<p>商品服务暂不可用，请稍后再试。</p>';return}
  products=data||[];render();
  const {data:{session}}=await db.auth.getSession();
  if(session){$('#authBtn').textContent='已登录';await loadCart()}
}
function render(){
  const q=$('#search').value.trim();
  let list=products.filter(x=>(cat==='全部'||x.category===cat)&&x.name.includes(q));
  if($('#sort').value==='low')list.sort((x,y)=>x.price-y.price);
  if($('#sort').value==='high')list.sort((x,y)=>y.price-x.price);
  $('#grid').innerHTML=list.map(x=>`<article class="product"><button class="product-card" onclick="detail('${x.id}')"><div class="art" style="background:url('${x.image_url}') center/cover"><span></span></div><h3>${x.name}</h3><p>${yen(x.price)} <small>${x.category}</small></p></button></article>`).join('');
  $('#emptyResult').classList.toggle('show',!list.length);
}
async function loadCart(){
  const {data:{user}}=await db.auth.getUser();
  if(!user)return;
  const {data}=await db.from('cart_items').select('id,quantity,products(*)').eq('user_id',user.id);
  cart=(data||[]).map(x=>({...x.products,q:x.quantity,line:x.id}));renderCart();
}
function detail(id){
  const x=products.find(p=>p.id===id);if(!x)return;
  $('#detail').innerHTML=`<button class="x" onclick="closeModal('detailModal')">×</button><div class="detail-art" style="background:url('${x.image_url}') center/cover"></div><div class="detail-copy"><p class="eyebrow">${x.category}</p><h2>${x.name}</h2><div class="price">${yen(x.price)}</div><p>${x.description}</p><div class="stock">库存：${x.stock} 件</div><button class="primary" onclick="add('${x.id}')">加入购物袋　→</button></div>`;
  $('#detailModal').classList.add('show');
}
async function add(id){
  const {data:{user}}=await db.auth.getUser();
  if(!user){closeModal('detailModal');$('#authModal').classList.add('show');return}
  const old=cart.find(x=>x.id===id),q=(old?.q||0)+1;
  const r=await db.from('cart_items').upsert({user_id:user.id,product_id:id,quantity:q},{onConflict:'user_id,product_id'});
  if(r.error)return alert(r.error.message);closeModal('detailModal');await loadCart();showCart();
}
function renderCart(){
  const sub=cart.reduce((s,x)=>s+x.q*x.price,0),ship=sub&&sub<199?12:0;
  $('#count').textContent=cart.reduce((s,x)=>s+x.q,0);$('#subtotal').textContent=yen(sub);$('#shipping').textContent=ship?yen(ship):'免运费';$('#total').textContent=yen(sub+ship);
  $('#shippingNote').textContent=sub&&sub<199?`再购 ${yen(199-sub)} 即享免运费`:'';
  $('#cartItems').innerHTML=cart.map(x=>`<div class="line"><span>${x.name}<small>${yen(x.price)} × ${x.q}</small></span><button class="remove" onclick="drop('${x.line}')">×</button></div>`).join('')||'<p class="hint">还没有选中任何好物。</p>';
}
async function drop(id){await db.from('cart_items').delete().eq('id',id);await loadCart()}
function showCart(){$('#cart').classList.add('open');$('#shade').classList.add('show')}
function closeCart(){$('#cart').classList.remove('open');$('#shade').classList.remove('show')}
function closeModal(id){$('#'+id).classList.remove('show')}

async function sendPhoneCode(){
  const phone=$('#phone').value.trim();
  if(!/^1[3-9]\d{9}$/.test(phone))return showOtpStatus('请输入有效的中国大陆手机号。',true);
  const btn=$('#sendCode');btn.disabled=true;btn.textContent='发送中…';
  const {error}=await db.auth.signInWithOtp({phone:'+86'+phone,options:{shouldCreateUser:true}});
  if(error){showOtpStatus(error.message,true);btn.disabled=false;btn.textContent='获取验证码';return}
  $('#otpCode').disabled=false;$('#verifyCode').disabled=false;showOtpStatus('验证码已发送，请在 10 分钟内完成验证。');
  let left=60;btn.textContent=`${left}s 后重发`;const timer=setInterval(()=>{left--;btn.textContent=left?`${left}s 后重发`:'重新发送';if(!left){clearInterval(timer);btn.disabled=false}},1000);
}
async function verifyPhoneCode(){
  const phone=$('#phone').value.trim(),token=$('#otpCode').value.trim();
  if(!token)return showOtpStatus('请输入短信验证码。',true);
  const btn=$('#verifyCode');btn.disabled=true;btn.textContent='验证中…';
  const {data,error}=await db.auth.verifyOtp({phone:'+86'+phone,token,type:'sms'});
  if(error){showOtpStatus(error.message,true);btn.disabled=false;btn.textContent='验证并注册';return}
  if(data.session){closeModal('authModal');$('#authBtn').textContent='已登录';await loadCart();alert('手机号验证成功，欢迎来到拾光宠物！')}
}
function showOtpStatus(message,isError=false){const el=$('#otpStatus');el.textContent=message;el.style.color=isError?'#b04444':'#54715d'}

$('#cartBtn').onclick=showCart;$('#shade').onclick=closeCart;
$('#searchBtn').onclick=()=>{$('#search').focus();location.hash='products'};
$('#search').oninput=render;$('#sort').onchange=render;
document.querySelectorAll('[data-cat]').forEach(x=>x.onclick=()=>{cat=x.dataset.cat;render()});
document.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>closeModal(x.dataset.close));
$('#authBtn').onclick=()=>$('#authModal').classList.add('show');
$('#authForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),r=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(r.error)return alert(r.error.message);closeModal('authModal');$('#authBtn').textContent='已登录';loadCart()};
$('#sendCode').onclick=sendPhoneCode;$('#verifyCode').onclick=verifyPhoneCode;
$('#checkout').onclick=()=>{if(!cart.length)return alert('请先将商品加入购物袋。');closeCart();$('#checkoutModal').classList.add('show')};
$('#orderForm').onsubmit=e=>{e.preventDefault();alert('配送信息已保存。支付功能暂未接入。');closeModal('checkoutModal')};
load();
