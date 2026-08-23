import { getWallets, addWallet, deleteWallet, exportData, importData, resetAllData, loadSampleData, getAllData, restoreFromLocalBackup } from '../db/database.js';
import { getSession, signOut, isSyncEnabled, pushToCloud, pullFromCloud, initSupabase } from '../db/cloud-sync.js';
import { getLastBackupTime } from '../db/local-backup.js';
import { formatFullCurrency, showToast } from '../utils.js';
import router from '../router.js';

export async function renderAccount() {
  const wallets = await getWallets();
  const session = await getSession();
  const cloudConnected = isSyncEnabled() && session;
  const lastBackup = getLastBackupTime();

  const lastBackupDisplay = lastBackup
    ? new Date(lastBackup).toLocaleString('vi-VN')
    : 'Chưa có';

  const userEmail = session?.user?.email || '';
  const userAvatar = session?.user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${userEmail}&background=10B981&color=fff`;

  return `
    <div class="account-page animate-fade-in">
      <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 24px;">Tài khoản</h1>

      <!-- Profile Section -->
      <div class="card" style="margin-bottom: 20px; display: flex; align-items: center; gap: 16px;">
        ${session ? `
          <img src="${userAvatar}" alt="Avatar" style="width: 56px; height: 56px; border-radius: 50%; border: 2px solid var(--accent-green);" />
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 16px;">${userEmail.split('@')[0]}</div>
            <div style="font-size: 13px; color: var(--text-tertiary);">${userEmail}</div>
          </div>
          <button class="btn btn-sm btn-ghost" id="btn-sign-out" style="color: var(--accent-red-light);">Đăng xuất</button>
        ` : `
          <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 16px;">Chưa đăng nhập</div>
            <div style="font-size: 13px; color: var(--text-tertiary);">Đăng nhập để đồng bộ dữ liệu</div>
          </div>
          <button class="btn btn-sm btn-primary" id="btn-login-now">Đăng nhập</button>
        `}
      </div>

      <!-- Cloud Sync Status Banner -->
      <div class="card" style="background: ${cloudConnected ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))' : 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))'}; border-color: ${cloudConnected ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 28px;">${cloudConnected ? '☁️' : '⚠️'}</div>
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 15px; color: ${cloudConnected ? 'var(--accent-green-light)' : 'var(--accent-amber-light)'};">
              ${cloudConnected ? 'Cloud Sync: Đang hoạt động' : 'Cloud Sync: Chưa hoạt động'}
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
              ${cloudConnected ? 'Dữ liệu được bảo vệ an toàn trên Cloud' : 'Đăng nhập để tự động sao lưu'}
            </div>
          </div>
        </div>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 12px; color: var(--text-tertiary);">
            📱 Backup local: ${lastBackupDisplay}
          </div>
          ${cloudConnected ? `<button class="btn btn-sm btn-primary" id="sync-now-btn" style="font-size: 12px; padding: 4px 12px;">Đồng bộ ngay</button>` : ''}
        </div>
      </div>

      <!-- Wallets Section -->
      <div class="card">
        <div class="section-header">
          <h2>💳 Ví của tôi</h2>
          <button class="link" id="add-wallet-btn">+ Thêm ví</button>
        </div>
        <div id="wallets-list">
          ${wallets.map(w => `
            <div class="wallet-item" data-wallet-id="${w.id}">
              <div class="wallet-icon" style="background: ${w.color || '#F59E0B'}22;">${w.icon || '💵'}</div>
              <div class="wallet-info">
                <div class="wallet-name">${w.name}</div>
                <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 2px;">${w.type === 'cash' ? 'Tiền mặt' : w.type === 'bank' ? 'Ngân hàng' : w.type === 'ewallet' ? 'Ví điện tử' : 'Khác'}</div>
              </div>
              <div class="wallet-balance ${w.balance >= 0 ? '' : 'text-amount-expense'}">
                ${formatFullCurrency(w.balance)} đ
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Cloud Sync Settings -->
      <div class="mt-2xl" style="${!cloudConnected ? 'display: none;' : ''}">
        <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">☁️ Tùy chọn Cloud Sync</h2>
        <div class="card" style="padding: 0;">
          <ul class="settings-list">
              <li class="settings-item" id="setting-sync-push">
                <div class="settings-item-icon" style="background: #10B98122;">📤</div>
                <span class="settings-item-label">Đẩy dữ liệu lên Cloud (Ghi đè)</span>
                <span class="settings-item-arrow">›</span>
              </li>
              <li class="settings-item" id="setting-sync-pull">
                <div class="settings-item-icon" style="background: #8B5CF622;">📥</div>
                <span class="settings-item-label">Tải dữ liệu từ Cloud (Ghi đè)</span>
                <span class="settings-item-arrow">›</span>
              </li>
          </ul>
        </div>
      </div>

      <!-- Settings -->
      <div class="mt-2xl">
        <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">⚙️ Cài đặt</h2>
        <div class="card" style="padding: 0;">
          <ul class="settings-list">
            <li class="settings-item" id="setting-currency">
              <div class="settings-item-icon" style="background: #F59E0B22;">💱</div>
              <span class="settings-item-label">Đơn vị tiền tệ</span>
              <span class="settings-item-value">VND</span>
              <span class="settings-item-arrow">›</span>
            </li>
            <li class="settings-item" id="setting-sample-data">
              <div class="settings-item-icon" style="background: #8B5CF622;">🚀</div>
              <span class="settings-item-label">Tải dữ liệu mẫu</span>
              <span class="settings-item-arrow">›</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Data Management -->
      <div class="mt-2xl">
        <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">💾 Dữ liệu</h2>
        <div class="card" style="padding: 0;">
          <ul class="settings-list">
            <li class="settings-item" id="setting-export">
              <div class="settings-item-icon" style="background: #10B98122;">📤</div>
              <span class="settings-item-label">Xuất dữ liệu (Backup file)</span>
              <span class="settings-item-arrow">›</span>
            </li>
            <li class="settings-item" id="setting-import">
              <div class="settings-item-icon" style="background: #3B82F622;">📥</div>
              <span class="settings-item-label">Nhập dữ liệu (Restore file)</span>
              <span class="settings-item-arrow">›</span>
            </li>
            <li class="settings-item" id="setting-restore-local">
              <div class="settings-item-icon" style="background: #F59E0B22;">🔄</div>
              <span class="settings-item-label">Khôi phục từ backup local</span>
              <span class="settings-item-value">${lastBackupDisplay !== 'Chưa có' ? '✅' : ''}</span>
              <span class="settings-item-arrow">›</span>
            </li>
            <li class="settings-item" id="setting-reset" style="color: var(--accent-red-light);">
              <div class="settings-item-icon" style="background: #EF444422;">🗑️</div>
              <span class="settings-item-label" style="color: var(--accent-red-light);">Xoá toàn bộ dữ liệu</span>
              <span class="settings-item-arrow" style="color: var(--accent-red-light);">›</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- App Info -->
      <div style="text-align: center; margin-top: 40px; padding-bottom: 20px;">
        <div style="margin-bottom: 8px; display: flex; justify-content: center;">
          <img src="/logo-2.png" alt="Logo" style="width: 48px; height: 48px; object-fit: contain; border-radius: 8px;" />
        </div>
        <div style="font-weight: 700; font-size: 16px;">Money Love Hers</div>
        <div style="color: var(--text-tertiary); font-size: 12px; margin-top: 4px;">Phiên bản 1.1.0 — Cloud Sync</div>
        <div style="color: var(--accent-green); font-size: 12px; font-weight: 600; margin-top: 6px;">Made by Danny</div>
        <div style="color: var(--text-muted); font-size: 11px; margin-top: 8px;">Dữ liệu được bảo vệ 3 lớp: IndexedDB + localStorage + Cloud</div>
      </div>
    </div>
  `;
}

export function setupAccountEvents() {
  // Add wallet
  document.getElementById('add-wallet-btn')?.addEventListener('click', openAddWallet);

  // Login/Sign Out
  document.getElementById('btn-login-now')?.addEventListener('click', () => {
    router.navigate('login');
  });

  document.getElementById('btn-sign-out')?.addEventListener('click', async () => {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      await signOut();
      router.navigate('login');
    }
  });

  // Sync now
  document.getElementById('sync-now-btn')?.addEventListener('click', async () => {
    showToast('Đang đồng bộ...', 'info');
    const data = await getAllData();
    const result = await pushToCloud(data);
    if (result && result.success) {
      showToast('Đồng bộ thành công! ☁️✅');
    } else {
      showToast('Lỗi: ' + (result?.message || 'Không xác định'), 'error');
    }
  });

  // Push to cloud
  document.getElementById('setting-sync-push')?.addEventListener('click', async () => {
    if (confirm('Đẩy toàn bộ dữ liệu local lên Cloud? Dữ liệu trên Cloud sẽ bị ghi đè.')) {
      showToast('Đang đẩy dữ liệu lên Cloud...', 'info');
      const data = await getAllData();
      const result = await pushToCloud(data);
      if (result && result.success) {
        showToast('Đã đẩy dữ liệu lên Cloud! ☁️✅');
      } else {
        showToast('Lỗi: ' + (result?.message || 'Không xác định'), 'error');
      }
    }
  });

  // Pull from cloud
  document.getElementById('setting-sync-pull')?.addEventListener('click', async () => {
    if (confirm('Tải dữ liệu từ Cloud về? Dữ liệu local hiện tại sẽ bị ghi đè.')) {
      showToast('Đang tải dữ liệu từ Cloud...', 'info');
      const cloudData = await pullFromCloud();
      if (cloudData) {
        await importData({ data: cloudData });
        showToast('Đã khôi phục dữ liệu từ Cloud! ☁️✅');
        window.dispatchEvent(new CustomEvent('reload-page'));
      } else {
        showToast('Không tìm thấy dữ liệu trên Cloud', 'error');
      }
    }
  });



  // Load sample data
  document.getElementById('setting-sample-data')?.addEventListener('click', async () => {
    if (confirm('Tải dữ liệu mẫu? Dữ liệu hiện tại sẽ được giữ nguyên.')) {
      try {
        await loadSampleData();
        showToast('Đã tải dữ liệu mẫu! 🚀');
        window.dispatchEvent(new CustomEvent('reload-page'));
      } catch (err) {
        console.error(err);
        showToast('Lỗi khi tải dữ liệu mẫu', 'error');
      }
    }
  });

  // Export
  document.getElementById('setting-export')?.addEventListener('click', async () => {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `money-love-hers-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất dữ liệu! 📤');
    } catch (err) {
      showToast('Lỗi khi xuất dữ liệu', 'error');
    }
  });

  // Import
  document.getElementById('setting-import')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        await importData(text);
        showToast('Đã nhập dữ liệu thành công! 📥');
        window.dispatchEvent(new CustomEvent('reload-page'));
      } catch (err) {
        showToast('File không hợp lệ', 'error');
      }
    };
    input.click();
  });

  // Restore from local backup
  document.getElementById('setting-restore-local')?.addEventListener('click', async () => {
    const lastBackup = getLastBackupTime();
    if (!lastBackup) {
      showToast('Chưa có backup local nào', 'error');
      return;
    }
    if (confirm(`Khôi phục từ backup local (${new Date(lastBackup).toLocaleString('vi-VN')})? Dữ liệu hiện tại sẽ bị ghi đè.`)) {
      const result = await restoreFromLocalBackup();
      if (result) {
        showToast('Đã khôi phục từ backup local! 🔄');
        window.dispatchEvent(new CustomEvent('reload-page'));
      } else {
        showToast('Không tìm thấy backup', 'error');
      }
    }
  });

  // Reset
  document.getElementById('setting-reset')?.addEventListener('click', async () => {
    if (confirm('⚠️ Bạn có chắc muốn XOÁ TOÀN BỘ dữ liệu? Hành động này không thể hoàn tác!')) {
      if (confirm('Xác nhận lần cuối: XOÁ TẤT CẢ?')) {
        await resetAllData();
        showToast('Đã xoá toàn bộ dữ liệu');
        window.dispatchEvent(new CustomEvent('reload-page'));
      }
    }
  });
}

          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <h2>☁️ Thiết lập Cloud Sync</h2>
        <div style="width: 40px;"></div>
      </div>
      <div class="modal-body" style="padding-bottom: 32px;">
        <!-- Step by step guide -->
        <div style="background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 20px; border: 1px solid var(--border-subtle);">
          <div style="font-weight: 700; font-size: 16px; margin-bottom: 12px; color: var(--accent-green);">📋 Hướng dẫn (3 bước, ~2 phút)</div>

          <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent-green); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">1</span>
              <span style="font-weight: 600; font-size: 14px;">Tạo tài khoản Supabase (miễn phí)</span>
            </div>
            <div style="padding-left: 32px; font-size: 13px; color: var(--text-secondary);">
              Truy cập <a href="https://supabase.com" target="_blank" style="color: var(--accent-green); font-weight: 600;">supabase.com</a> → Sign Up (dùng GitHub hoặc Email) → Tạo project mới → Đặt tên & mật khẩu database
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent-green); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">2</span>
              <span style="font-weight: 600; font-size: 14px;">Chạy SQL tạo bảng</span>
            </div>
            <div style="padding-left: 32px; font-size: 13px; color: var(--text-secondary);">
              Vào Dashboard → SQL Editor → New Query → Copy nội dung file <strong>supabase-migration.sql</strong> vào → Nhấn <strong>Run</strong>
            </div>
          </div>

          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent-green); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">3</span>
              <span style="font-weight: 600; font-size: 14px;">Lấy URL & API Key</span>
            </div>
            <div style="padding-left: 32px; font-size: 13px; color: var(--text-secondary);">
              Vào Settings → API → Copy <strong>Project URL</strong> và <strong>anon public key</strong> dán vào ô bên dưới
            </div>
          </div>
        </div>

        <!-- Input fields -->
        <div style="margin-bottom: 16px;">
          <label class="text-label" style="display: block; margin-bottom: 6px;">Project URL</label>
          <div style="background: var(--bg-input); border-radius: var(--radius-md); padding: 12px 16px;">
            <input type="url" class="input-field" id="supabase-url-input" placeholder="https://xxxxx.supabase.co" style="width: 100%; font-size: 14px;" value="${existingConfig?.url || ''}" />
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <label class="text-label" style="display: block; margin-bottom: 6px;">Anon Public Key</label>
          <div style="background: var(--bg-input); border-radius: var(--radius-md); padding: 12px 16px;">
            <input type="text" class="input-field" id="supabase-key-input" placeholder="eyJhbGciOi..." style="width: 100%; font-size: 14px;" value="${existingConfig?.anonKey || ''}" />
          </div>
        </div>

        <!-- Test & Save -->
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <button class="btn btn-secondary btn-block" id="test-connection-btn">🔍 Kiểm tra kết nối</button>
        </div>

        <div id="connection-result" style="margin-bottom: 16px; display: none;"></div>

        <button class="btn btn-primary btn-block btn-lg" id="save-cloud-config-btn">💾 Lưu & Kết nối</button>

        <div style="text-align: center; margin-top: 16px;">
          <div style="font-size: 11px; color: var(--text-muted);">
            🔒 API Key được lưu an toàn trong localStorage trên thiết bị của bạn.<br>
            Supabase Free Tier: 500MB storage, không giới hạn requests.
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Events
  document.getElementById('cloud-close')?.addEventListener('click', () => modal.remove());
  document.getElementById('cloud-overlay')?.addEventListener('click', () => modal.remove());

  // Test connection
  document.getElementById('test-connection-btn')?.addEventListener('click', async () => {
    const url = document.getElementById('supabase-url-input')?.value?.trim();
    const key = document.getElementById('supabase-key-input')?.value?.trim();

    if (!url || !key) {
      showToast('Vui lòng nhập URL và API Key', 'error');
      return;
    }

    const resultDiv = document.getElementById('connection-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div style="text-align: center; color: var(--text-tertiary); padding: 8px;">Đang kiểm tra...</div>';

    // Temporarily save config to test
    saveSupabaseConfig(url, key);
    const result = await testConnection();

    if (result.success) {
      resultDiv.innerHTML = `<div style="text-align: center; padding: 8px; color: var(--accent-green); background: rgba(16,185,129,0.1); border-radius: var(--radius-md); border: 1px solid rgba(16,185,129,0.3);">✅ ${result.message}</div>`;
    } else {
      resultDiv.innerHTML = `<div style="text-align: center; padding: 8px; color: var(--accent-red-light); background: rgba(239,68,68,0.1); border-radius: var(--radius-md); border: 1px solid rgba(239,68,68,0.3);">❌ ${result.message}</div>`;
      // Revert config if test failed
      if (!existingConfig) clearSupabaseConfig();
    }
  });

  // Save config
  document.getElementById('save-cloud-config-btn')?.addEventListener('click', async () => {
    const url = document.getElementById('supabase-url-input')?.value?.trim();
    const key = document.getElementById('supabase-key-input')?.value?.trim();

    if (!url || !key) {
      showToast('Vui lòng nhập URL và API Key', 'error');
      return;
    }

    const success = saveSupabaseConfig(url, key);
    if (success) {
      // Try to setup tables
      const tablesOk = await setupTables();

      // Auto-push current data to cloud
      showToast('Đang đồng bộ dữ liệu lên Cloud...', 'info');
      const data = await getAllData();
      const pushResult = await pushToCloud(data);

      if (pushResult) {
        showToast('Kết nối Cloud thành công! Dữ liệu đã được đồng bộ ☁️✅');
      } else {
        showToast('Đã kết nối Cloud. Kiểm tra SQL migration nếu chưa chạy.', 'info');
      }

      modal.remove();
      window.dispatchEvent(new CustomEvent('reload-page'));
    } else {
      showToast('Lỗi kết nối Supabase', 'error');
    }
  });
}

// ─── Add Wallet Modal ───
function openAddWallet() {
  const walletTypes = [
    { type: 'cash', icon: '💵', name: 'Tiền mặt', color: '#F59E0B' },
    { type: 'bank', icon: '🏦', name: 'Ngân hàng', color: '#3B82F6' },
    { type: 'ewallet', icon: '📱', name: 'Ví điện tử', color: '#8B5CF6' },
    { type: 'credit', icon: '💳', name: 'Thẻ tín dụng', color: '#EF4444' },
    { type: 'savings', icon: '🐷', name: 'Tiết kiệm', color: '#10B981' },
  ];

  const modal = document.createElement('div');
  modal.id = 'add-wallet-container';
  modal.innerHTML = `
    <div class="modal-overlay" id="wallet-overlay"></div>
    <div class="modal" id="wallet-modal">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <button class="icon-btn" id="wallet-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <h2>Thêm Ví Mới</h2>
        <div style="width: 40px;"></div>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 16px;">
          <label class="text-label">Loại ví</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
            ${walletTypes.map(wt => `
              <button class="btn btn-secondary wallet-type-option" data-wallet-type="${wt.type}" data-wallet-icon="${wt.icon}" data-wallet-color="${wt.color}" style="gap: 6px;">
                <span>${wt.icon}</span>
                <span>${wt.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="text-label">Tên ví</label>
          <div style="background: var(--bg-input); border-radius: var(--radius-md); padding: 12px 16px; margin-top: 8px;">
            <input type="text" class="input-field" id="wallet-name-input" placeholder="VD: Ví MoMo" style="width: 100%;" />
          </div>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="text-label">Số dư ban đầu (VND)</label>
          <div style="display: flex; align-items: center; gap: 12px; background: var(--bg-input); border-radius: var(--radius-md); padding: 12px 16px; margin-top: 8px;">
            <span class="currency-badge">VND</span>
            <input type="number" class="input-field" id="wallet-balance-input" placeholder="0" style="font-size: 18px; font-weight: 600;" />
          </div>
        </div>
        <button class="btn btn-primary btn-block btn-lg" id="save-wallet-btn">Tạo Ví</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let selectedType = null;
  let selectedIcon = '💵';
  let selectedColor = '#F59E0B';

  document.getElementById('wallet-close')?.addEventListener('click', () => modal.remove());
  document.getElementById('wallet-overlay')?.addEventListener('click', () => modal.remove());

  document.querySelectorAll('.wallet-type-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.wallet-type-option').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
      });
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');
      selectedType = btn.dataset.walletType;
      selectedIcon = btn.dataset.walletIcon;
      selectedColor = btn.dataset.walletColor;
    });
  });

  document.getElementById('save-wallet-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('wallet-name-input')?.value?.trim();
    const balance = parseFloat(document.getElementById('wallet-balance-input')?.value) || 0;

    if (!name) {
      showToast('Vui lòng nhập tên ví', 'error');
      return;
    }
    if (!selectedType) {
      showToast('Vui lòng chọn loại ví', 'error');
      return;
    }

    await addWallet({
      name,
      type: selectedType,
      balance,
      icon: selectedIcon,
      color: selectedColor
    });

    showToast('Đã tạo ví mới! ✅');
    modal.remove();
    window.dispatchEvent(new CustomEvent('reload-page'));
  });
}
