const form = document.querySelector('#registerForm');
const status = document.querySelector('#registerStatus');
const submitButton = form.querySelector('button[type="submit"]');

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? '#b04444' : '#54715d';
}

function redirectToVerify(email) {
  sessionStorage.setItem('pendingVerificationEmail', email);
  location.href = `verify-email.html?email=${encodeURIComponent(email)}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  const email = String(fields.get('email') || '').trim().toLowerCase();
  const password = String(fields.get('password') || '');
  const passwordConfirm = String(fields.get('passwordConfirm') || '');

  if (!email || !form.email.checkValidity()) return setStatus('请输入正确的邮箱地址。', true);
  if (password.length < 8) return setStatus('密码至少需要 8 位。', true);
  if (password !== passwordConfirm) return setStatus('两次输入的密码不一致。', true);

  submitButton.disabled = true;
  setStatus('正在创建账号并发送验证码…');
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { full_name: email.split('@')[0] } }
  });

  if (error) {
    submitButton.disabled = false;
    return setStatus(`注册失败：${error.message}`, true);
  }

  // Supabase 在启用邮箱确认时，为已注册邮箱返回无 identity 的伪用户，避免泄露账号存在性。
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    submitButton.disabled = false;
    return setStatus('该邮箱已注册。请直接登录，或使用“忘记密码”重置密码。', true);
  }

  // A registration must never grant access before the user enters the email OTP.
  // If email confirmation was accidentally disabled in the Supabase dashboard,
  // sign out the session returned by signUp and still require the verification page.
  if (data.session) {
    await db.auth.signOut();
  }

  redirectToVerify(email);
});
