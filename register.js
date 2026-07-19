const form = document.querySelector('#registerForm');
const status = document.querySelector('#registerStatus');
const submitButton = form.querySelector('button[type="submit"]');
let cooldownTimer;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? '#b04444' : '#54715d';
}

function startCooldown(seconds) {
  clearInterval(cooldownTimer);
  let remaining = Math.max(1, Math.ceil(seconds));
  submitButton.disabled = true;
  const tick = () => {
    setStatus(`邮件发送过于频繁，请在 ${remaining} 秒后再试。`, true);
    if (remaining-- <= 0) {
      clearInterval(cooldownTimer);
      submitButton.disabled = false;
      setStatus('现在可以重新提交注册。');
    }
  };
  tick();
  cooldownTimer = setInterval(tick, 1000);
}

function showWaiting(email) {
  form.innerHTML = `<p class="eyebrow">VERIFY YOUR EMAIL</p><h1>验证邮件已发送</h1><p class="hint">我们已向 <b>${email}</b> 发送验证链接。请完成验证后返回登录。</p><div class="waiting-actions"><a class="primary" href="https://mail.google.com/" target="_blank" rel="noopener">打开邮箱</a><a class="text-button" href="index.html">返回登录</a></div>`;
}

form.onsubmit = async (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  const email = String(fields.get('email')).trim().toLowerCase();
  const password = fields.get('password');
  if (password !== fields.get('passwordConfirm')) return setStatus('两次输入的密码不一致。', true);

  submitButton.disabled = true;
  setStatus('正在创建账号并发送验证邮件…');
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${location.origin}${location.pathname.replace('register.html', 'index.html')}` }
  });

  if (error) {
    const wait = error.message.match(/after\s+(\d+)\s+seconds/i);
    if (/security purposes|rate limit|too many/i.test(error.message) && wait) return startCooldown(Number(wait[1]));
    submitButton.disabled = false;
    return setStatus(`注册失败：${error.message}`, true);
  }
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    submitButton.disabled = false;
    return setStatus('该邮箱已经注册，请直接登录或使用其他邮箱。', true);
  }
  if (data.session) location.href = 'account.html';
  showWaiting(email);
};
