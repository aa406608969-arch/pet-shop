const form = document.querySelector('#registerForm');
const status = document.querySelector('#registerStatus');
function setStatus(message, isError = false) { status.textContent = message; status.style.color = isError ? '#b04444' : '#54715d'; }
form.onsubmit = async (event) => {
  event.preventDefault();
  const fields = new FormData(form), password = fields.get('password');
  if (password !== fields.get('passwordConfirm')) return setStatus('两次输入的密码不一致。', true);
  const { data, error } = await db.auth.signUp({ email: fields.get('email'), password, options: { emailRedirectTo: `${location.origin}${location.pathname.replace('register.html', 'index.html')}` } });
  if (error) return setStatus('注册失败：' + error.message, true);
  form.reset();
  setStatus(data.session ? '注册成功，已登录。' : '验证邮件已发送，请打开邮箱完成验证后再登录。');
};
