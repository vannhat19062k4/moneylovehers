import { getBudgets, getCategories, addBudget, getMonthlyStats, deleteBudget } from '../db/database.js';
import { formatFullCurrency, formatCurrency, getDaysRemainingInMonth, showToast } from '../utils.js';

export async function renderBudget() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const [budgets, categories, stats] = await Promise.all([
    getBudgets(),
    getCategories(),
    getMonthlyStats(year, month)
  ]);

  // Calculate totals
  let totalBudget = 0;
  let totalSpent = 0;
  for (const b of budgets) {
    totalBudget += b.amount;
    totalSpent += (b.spent || 0);
  }
  const totalRemaining = totalBudget - totalSpent;
  const daysRemaining = getDaysRemainingInMonth();
  const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Gauge angle calculation
  const gaugePercent = Math.min(spentPercentage, 100);

  return `
    <div class="budget-page animate-fade-in">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h1 style="font-size: 22px;">Ngân sách Đa...</h1>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px; background: var(--bg-card); border-radius: var(--radius-full); padding: 6px 14px;">
            <span style="font-size: 16px;">💵</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          <button class="icon-btn" style="width: 36px; height: 36px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
          <button class="icon-btn" style="width: 36px; height: 36px;">
            <span style="font-size: 14px;">?</span>
          </button>
        </div>
      </div>

      <!-- Period Tab -->
      <div style="border-bottom: 2px solid var(--text-primary); display: inline-block; padding-bottom: 8px; margin-bottom: 24px;">
        <span style="font-weight: 600;">Tháng này</span>
      </div>

      <!-- Gauge Chart -->
      <div class="card" style="background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-secondary) 100%);">
        <div class="gauge-container">
          <div class="gauge-canvas-wrapper">
            <canvas id="gauge-chart" width="240" height="140"></canvas>
            <div class="gauge-value">
              <div class="gauge-value-label">Số tiền bạn có thể chi</div>
              <div class="gauge-value-amount" style="color: ${totalRemaining >= 0 ? 'var(--accent-green)' : 'var(--accent-red-light)'};">
                ${formatFullCurrency(Math.max(totalRemaining, 0))}
              </div>
            </div>
          </div>

          <div class="gauge-stats">
            <div class="gauge-stat">
              <div class="gauge-stat-value">${formatCurrency(totalBudget)}</div>
              <div class="gauge-stat-label">Tổng ngân sách</div>
            </div>
            <div class="gauge-stat-divider"></div>
            <div class="gauge-stat">
              <div class="gauge-stat-value" style="color: var(--accent-red-light);">${formatCurrency(totalSpent)}</div>
              <div class="gauge-stat-label">Tổng đã chi</div>
            </div>
            <div class="gauge-stat-divider"></div>
            <div class="gauge-stat">
              <div class="gauge-stat-value">${daysRemaining}</div>
              <div class="gauge-stat-label">Đến cuối tháng</div>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 8px;">
          <button class="btn btn-primary" id="create-budget-btn" style="padding: 12px 32px;">
            Tạo Ngân sách
          </button>
        </div>
      </div>

      <!-- Budget List -->
      <div class="mt-xl stagger-children">
        ${budgets.length > 0 ? budgets.map(budget => {
          const cat = categories.find(c => String(c.id) === String(budget.categoryId));
          const spent = budget.spent || 0;
          const remaining = budget.amount - spent;
          const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
          const progressClass = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : '';

          return `
            <div class="budget-card">
              <div class="budget-card-header">
                <span class="budget-category-icon">${cat?.icon || '📦'}</span>
                <span class="budget-category-name">${cat?.name || 'Khác'}</span>
                <div style="text-align: right;">
                  <div class="budget-amount">${formatFullCurrency(budget.amount)}</div>
                  <div class="budget-remaining">Còn lại ${formatFullCurrency(Math.max(remaining, 0))}</div>
                </div>
              </div>
              <div class="progress-bar">
                <div class="progress-fill ${progressClass}" style="width: ${Math.min(pct, 100)}%"></div>
              </div>
              <div class="budget-timeline">
                <span class="budget-timeline-label">Hôm nay</span>
              </div>
            </div>
          `;
        }).join('') : `
          <div class="empty-state" style="padding: 32px;">
            <div class="empty-state-icon">📊</div>
            <div class="empty-state-text">Chưa có ngân sách nào.<br>Tạo ngân sách để kiểm soát chi tiêu!</div>
          </div>
        `}
      </div>
    </div>
  `;
}

export function setupBudgetEvents() {
  // Draw gauge
  setTimeout(drawGauge, 100);

  // Create budget button
  document.getElementById('create-budget-btn')?.addEventListener('click', openCreateBudget);
}

function drawGauge() {
  const canvas = document.getElementById('gauge-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h - 10;
  const radius = Math.min(cx, cy) - 10;

  ctx.clearRect(0, 0, w, h);

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI, false);
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Spent arc (green = remaining)
  getBudgets().then(budgets => {
    let totalBudget = 0, totalSpent = 0;
    for (const b of budgets) {
      totalBudget += b.amount;
      totalSpent += (b.spent || 0);
    }
    const pct = totalBudget > 0 ? Math.min(totalSpent / totalBudget, 1) : 0;
    const remainPct = 1 - pct;

    // Green arc for remaining
    const startAngle = Math.PI;
    const endAngle = Math.PI + (Math.PI * remainPct);

    const gradient = ctx.createLinearGradient(0, cy, w, cy);
    gradient.addColorStop(0, '#10B981');
    gradient.addColorStop(1, '#34D399');

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle, false);
    ctx.lineWidth = 12;
    ctx.strokeStyle = gradient;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Needle dot
    const needleAngle = Math.PI + (Math.PI * remainPct);
    const nx = cx + radius * Math.cos(needleAngle);
    const ny = cy + radius * Math.sin(needleAngle);
    ctx.beginPath();
    ctx.arc(nx, ny, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

async function openCreateBudget() {
  const categories = await getCategories('expense');
  const existingBudgets = await getBudgets();
  const existingCatIds = existingBudgets.map(b => b.categoryId);
  const availableCats = categories.filter(c => !c.parentId && !existingCatIds.includes(c.id));

  const modal = document.createElement('div');
  modal.id = 'create-budget-container';
  modal.innerHTML = `
    <div class="modal-overlay" id="budget-overlay"></div>
    <div class="modal" id="budget-modal">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <button class="icon-btn" id="budget-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <h2>Tạo Ngân Sách</h2>
        <div style="width: 40px;"></div>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 16px;">
          <label class="text-label">Chọn nhóm chi tiêu</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
            ${availableCats.map(cat => `
              <button class="btn btn-secondary budget-cat-option" data-cat-id="${cat.id}" style="gap: 6px;">
                <span>${cat.icon}</span>
                <span>${cat.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="text-label">Số tiền ngân sách (VND)</label>
          <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px; background: var(--bg-input); border-radius: var(--radius-md); padding: 12px 16px;">
            <span class="currency-badge">VND</span>
            <input type="number" class="input-field" id="budget-amount-input" placeholder="0" style="font-size: 20px; font-weight: 700;" />
          </div>
        </div>
        <button class="btn btn-primary btn-block btn-lg" id="save-budget-btn">Tạo Ngân Sách</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let selectedBudgetCatId = null;

  // Events
  document.getElementById('budget-close')?.addEventListener('click', () => modal.remove());
  document.getElementById('budget-overlay')?.addEventListener('click', () => modal.remove());

  document.querySelectorAll('.budget-cat-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.budget-cat-option').forEach(b => b.classList.remove('btn-primary'));
      document.querySelectorAll('.budget-cat-option').forEach(b => b.classList.add('btn-secondary'));
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');
      const catIdStr = btn.dataset.catId;
      const category = categories.find(c => String(c.id) === catIdStr);
      if (category) {
        selectedBudgetCatId = category.id;
      }
    });
  });

  document.getElementById('save-budget-btn')?.addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('budget-amount-input')?.value) || 0;
    if (!selectedBudgetCatId) {
      showToast('Vui lòng chọn nhóm', 'error');
      return;
    }
    if (amount <= 0) {
      showToast('Vui lòng nhập số tiền', 'error');
      return;
    }

    const now = new Date();
    await addBudget({
      categoryId: selectedBudgetCatId,
      amount,
      period: 'monthly',
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
    });

    showToast('Đã tạo ngân sách! ✅');
    modal.remove();
    window.dispatchEvent(new CustomEvent('reload-page'));
  });
}
