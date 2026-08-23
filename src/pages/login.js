import { signInWithGoogle, getSession } from '../db/cloud-sync.js';
import router from '../router.js';

export async function renderLogin() {
  return `
    <div class="login-page animate-fade-in" style="height: 100dvh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 24px; background: var(--bg-primary);">
      
      <div style="text-align: center; margin-bottom: 48px;">
        <img src="/logo-2.png" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; border-radius: 16px; margin-bottom: 24px; box-shadow: var(--shadow-glow-green);" />
        <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 8px;">Money Love Hers</h1>
        <p style="color: var(--text-secondary); font-size: 15px;">Quản lý chi tiêu thông minh. Đồng bộ mọi nơi.</p>
      </div>

      <div style="width: 100%; max-width: 320px;">
        <button class="btn btn-block btn-lg" id="btn-google-login" style="background: white; color: #1f2937; border: 1px solid #e5e7eb; margin-bottom: 24px; position: relative; font-weight: 600;">
          <svg style="position: absolute; left: 20px;" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Đăng nhập bằng Google
        </button>

        <div style="display: flex; align-items: center; margin-bottom: 24px;">
          <div style="flex: 1; height: 1px; background: var(--border-subtle);"></div>
          <span style="padding: 0 16px; color: var(--text-tertiary); font-size: 13px;">HOẶC</span>
          <div style="flex: 1; height: 1px; background: var(--border-subtle);"></div>
        </div>

        <button class="btn btn-block btn-secondary btn-lg" id="btn-skip-login" style="border: none; background: var(--bg-card);">
          Dùng thử (Offline)
        </button>
      </div>
      
      <div style="margin-top: auto; font-size: 11px; color: var(--text-tertiary); text-align: center;">
        Dữ liệu của bạn được mã hoá và bảo vệ an toàn trên Cloud.
      </div>
    </div>
  `;
}

export function setupLoginEvents() {
  document.getElementById('btn-google-login')?.addEventListener('click', async () => {
    try {
      localStorage.setItem('needs_initial_sync', 'true');
      document.getElementById('btn-google-login').innerHTML = '<span class="loader" style="width:20px;height:20px;border:2px solid #ccc;border-top-color:#333;border-radius:50%;animation:spin 1s linear infinite;"></span>';
      const { error } = await signInWithGoogle();
      if (error) {
        alert('Lỗi đăng nhập: ' + error.message);
        document.getElementById('btn-google-login').innerHTML = 'Thử lại';
      }
    } catch (err) {
      console.error(err);
    }
  });

  document.getElementById('btn-skip-login')?.addEventListener('click', () => {
    localStorage.setItem('money_love_hers_skip_login', 'true');
    router.navigate('dashboard');
  });
}
