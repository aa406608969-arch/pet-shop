const form = document.querySelector('#verifyEmailForm');
const emailInput = form.elements.email;
const tokenInput = form.elements.token;
const status = document.querySelector('#verifyStatus');
const resendButton = document.querySelector('#resendButton');
const submitButton = form.querySelector('button[type="submit"]');
const emailHint = document.querySelector('#emailHint');
let timer;

const presetEmail = new URLSearchParams(location.search).get('email') || sessionStorage.getItem('pendingVerificationEmail') || '';
emailInput.value = presetEmail;
emailHint.textContent = presetEmail || '你的邮箱';

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? '#b04444' : '#54715d';
}

function startCooldown(seconds = 60) {
  clearInterval(timer);
  let remaining = seconds;
  resendButton.disabled = true;
  const tick = () => {
    resendButton.textContent = `${remaining} 秒后可重新发送`;
    if (remaining-- <= 0) {
      clearInterval(timer);
      resendButton.disabled = false;
      resendButton.textContent = '重新发送验证码';
    }
  };
  tick();
  timer = setInterval(tick, 1000);
}

resendButton.addEventListener('click', async () => {
  const email = emailInput.value.trim().toLowerCase();
  if (!email || !emailInput.checkValidity()) return setStatus('请输入正确的邮箱地址。', true);
  resendButton.disabled = true;
  setStatus('正在重新发送验证码…');
  const { error } = await db.auth.resend({ type: 'signup', email });
  if (error) {
    resendButton.disabled = false;
    const wait = error.message.match(/after\s+(\d+)\s+seconds/i);
    if (wait) startCooldown(Number(wait[1]));
    return setStatus(`发送失败：${error.message}`, true);
  }
  setStatus('验证码已重新发送，请查收邮箱。');
  startCooldown();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  const token = tokenInput.value.replace(/\s/g, '');
  if (!email || !emailInput.checkValidity()) return setStatus('请输入正确的邮箱地址。', true);
  if (!/^\d{6}$/.test(token)) return setStatus('请输入邮件中的 6 位验证码。', true);

  submitButton.disabled = true;
  setStatus('正在验证…');
  const { error } = await db.auth.verifyOtp({ email, token, type: 'signup' });
  if (error) {
    submitButton.disabled = false;
    return setStatus('验证码无效或已过期，请重新发送后再试。', true);
  }
  sessionStorage.removeItem('pendingVerificationEmail');
  setStatus('验证成功，正在进入个人中心…');
  location.href = 'account.html';
});

startCooldown();
