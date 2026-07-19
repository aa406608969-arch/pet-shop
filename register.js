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

form.onsubmit = async (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  const password = fields.get('password');

  if (password !== fields.get('passwordConfirm')) {
    setStatus('两次输入的密码不一致。', true);
    return;
  }

  submitButton.disabled = true;
  setStatus('正在创建账号并发送验证邮件…');
  const { data, error } = await db.auth.signUp({
    email: fields.get('email'),
    password,
    options: {
      emailRedirectTo: `${location.origin}${location.pathname.replace('register.html', 'index.html')}`
    }
  });

  if (error) {
    const wait = error.message.match(/after\s+(\d+)\s+seconds/i);
    if (/security purposes|rate limit|too many/i.test(error.message) && wait) {
      startCooldown(Number(wait[1]));
      return;
    }
    submitButton.disabled = false;
    setStatus(`注册失败：${error.message}`, true);
    return;
  }

  form.reset();
  submitButton.disabled = false;
  setStatus(data.session ? '注册成功，已自动登录。' : '验证邮件已发送，请打开邮箱完成验证后再登录。');
};
