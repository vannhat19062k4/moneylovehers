import { getTotalBalance, getWallets, getMonthlyStats, getTopSpending, getTransactions, getCategories } from '../db/database.js';
import { formatCurrency, formatFullCurrency, formatDate, getDaysRemainingInMonth } from '../utils.js';
import Chart from 'chart.js/auto';

let chartInstance = null;
let balanceHidden = false;

export async function renderDashboard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const [totalBalance, wallets, stats, topSpending, recentTxs, categories] = await Promise.all([
    getTotalBalance(),
    getWallets(),
    getMonthlyStats(year, month),
    getTopSpending(year, month),
    getTransactions({ limit: 5 }),
    getCategories()
  ]);

  const balanceClass = totalBalance >= 0 ? 'text-balance-positive' : 'text-balance-negative';

  const html = `
    <div class="dashboard animate-fade-in">
      <!-- Total Balance -->
      <div class="dashboard-balance">
        <div class="flex-between">
          <div>
            <div class="text-balance ${balanceClass}" id="total-balance">
              ${formatFullCurrency(totalBalance)} <span style="font-size: 0.6em">đ</span>
            </div>
            <div class="text-label" style="margin-top: 4px;">Tổng số dư <span style="opacity:0.5">ⓘ</span></div>
          </div>
          <div style="display: flex; gap: 12px;">
            <button class="icon-btn" id="toggle-balance-btn" aria-label="Ẩn/hiện số dư">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button class="icon-btn" aria-label="Tìm kiếm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- My Wallets -->
      <div class="card mt-xl" style="animation-delay: 0.1s;">
        <div class="section-header">
          <h2>Ví của tôi</h2>
          <button class="link" id="view-all-wallets">Xem tất cả</button>
        </div>
        ${wallets.map(w => `
          <div class="wallet-item">
            <div class="wallet-icon">${w.icon || '💵'}</div>
            <div class="wallet-info">
              <div class="wallet-name">${w.name}</div>
            </div>
            <div class="wallet-balance ${w.balance >= 0 ? '' : 'text-amount-expense'}">
              ${formatFullCurrency(w.balance)} đ
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Monthly Report Chart -->
      <div class="mt-2xl">
        <div class="section-header">
          <h2>Báo cáo tháng này</h2>
          <button class="link" id="view-report">Xem báo cáo</button>
        </div>
        <div class="card">
          <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
            <div>
              <div class="text-label">Tổng đã chi</div>
              <div class="text-amount-expense" style="font-size: 18px; font-weight: 700; margin-top: 4px;">
                ${formatFullCurrency(stats.totalExpense)}
              </div>
            </div>
            <div style="text-align: right;">
              <div class="text-label">Tổng thu</div>
              <div class="text-amount-income" style="font-size: 18px; font-weight: 700; margin-top: 4px;">
                ${formatFullCurrency(stats.totalIncome)}
              </div>
            </div>
          </div>
          <div style="height: 200px; position: relative;">
            <canvas id="monthly-chart"></canvas>
          </div>
          <div style="display: flex; align-items: center; gap: 16px; margin-top: 12px; justify-content: center;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-red);"></span>
              <span class="text-muted">Tháng này</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--text-tertiary);"></span>
              <span class="text-muted">Trung bình 3 tháng trước</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Spending -->
      <div class="mt-2xl">
        <div class="section-header">
          <h2>Chi tiêu nhiều nhất</h2>
          <button class="link" id="view-spending-detail">Xem chi tiết</button>
        </div>
        <div class="card">
          <div class="tabs" style="margin-bottom: 16px;">
            <button class="tab" data-period="week" id="tab-week">Tuần</button>
            <button class="tab active" data-period="month" id="tab-month">Tháng</button>
          </div>
          <div id="top-spending-list">
            ${topSpending.length > 0 ? topSpending.map(item => `
              <div class="top-spending-item">
                <div class="top-spending-icon">${item.icon}</div>
                <div class="top-spending-info">
                  <div class="top-spending-name">${item.name}</div>
                  <div class="top-spending-amount">${formatFullCurrency(item.amount)} đ</div>
                </div>
                <div class="percentage expense">${item.percentage.toFixed(0)}%</div>
              </div>
            `).join('') : '<div class="empty-state"><div class="empty-state-text">Chưa có dữ liệu</div></div>'}
          </div>
        </div>
      </div>

      <!-- Recent Transactions -->
      <div class="mt-2xl">
        <div class="section-header">
          <h2>Giao dịch gần đây</h2>
          <button class="link" id="view-all-transactions">Xem tất cả</button>
        </div>
        <div class="card stagger-children">
          ${recentTxs.length > 0 ? recentTxs.map(tx => {
            const cat = categories.find(c => String(c.id) === String(tx.categoryId));
            const isExpense = tx.type === 'expense' || tx.type === 'debt';
            return `
              <div class="transaction-item">
                <div class="transaction-icon">${cat?.icon || '📦'}</div>
                <div class="transaction-info">
                  <div class="transaction-name">${cat?.name || 'Khác'}</div>
                  <div class="transaction-date">${formatDate(tx.date).full}</div>
                </div>
                <div class="transaction-amount ${isExpense ? 'text-amount-expense' : 'text-amount-income'}">
                  ${isExpense ? '' : '+'}${formatFullCurrency(tx.amount)}
                </div>
              </div>
            `;
          }).join('') : '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">Chưa có giao dịch nào.<br>Nhấn + để thêm giao dịch đầu tiên!</div></div>'}
        </div>
      </div>
    </div>
  `;

  // Setup chart after render
  setTimeout(() => initChart(stats), 100);

  return html;
}

function initChart(stats) {
  const canvas = document.getElementById('monthly-chart');
  if (!canvas) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Build cumulative daily expense data
  const labels = [];
  const data = [];
  let cumulative = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    labels.push(`${String(day).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`);
    cumulative += (stats.dailyExpense[dateKey] || 0);
    data.push(day <= now.getDate() ? cumulative : null);
  }

  // Average line (flat for demo)
  const avgDaily = stats.totalExpense > 0 ? (stats.totalExpense / now.getDate()) : 0;
  const avgData = labels.map((_, i) => avgDaily * (i + 1));

  const ctx = canvas.getContext('2d');

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
  gradient.addColorStop(1, 'rgba(239, 68, 68, 0.01)');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Tháng này',
          data,
          borderColor: '#EF4444',
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#EF4444',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          spanGaps: false
        },
        {
          label: 'Trung bình 3 tháng',
          data: avgData,
          borderColor: 'rgba(160, 160, 184, 0.3)',
          borderWidth: 1,
          borderDash: [5, 5],
          fill: false,
          tension: 0,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(26, 26, 40, 0.95)',
          titleColor: '#f0f0f5',
          bodyColor: '#a0a0b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: function(context) {
              if (context.raw == null) return '';
              return `${context.dataset.label}: ${formatFullCurrency(context.raw)} đ`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: 'rgba(160,160,184,0.5)',
            font: { size: 10 },
            maxTicksLimit: 5,
            callback: function(val, index) {
              const day = index + 1;
              if (day === 1 || day === daysInMonth) return `${String(day).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
              return '';
            }
          },
          border: { display: false }
        },
        y: {
          grid: {
            color: 'rgba(255,255,255,0.04)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(160,160,184,0.5)',
            font: { size: 10 },
            callback: function(value) {
              if (value >= 1000000) return (value / 1000000).toFixed(0) + ' M';
              if (value >= 1000) return (value / 1000).toFixed(0) + ' K';
              return value;
            }
          },
          border: { display: false }
        }
      }
    }
  });
}

export function setupDashboardEvents() {
  // Toggle balance visibility
  const toggleBtn = document.getElementById('toggle-balance-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      balanceHidden = !balanceHidden;
      const balanceEl = document.getElementById('total-balance');
      if (balanceEl) {
        if (balanceHidden) {
          balanceEl.textContent = '••••••••';
          toggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        } else {
          // Re-render needed — simplified: just reload
          window.location.hash = '';
          window.location.hash = 'dashboard';
        }
      }
    });
  }

  // Navigate to transactions
  const viewAllTxBtn = document.getElementById('view-all-transactions');
  if (viewAllTxBtn) {
    viewAllTxBtn.addEventListener('click', () => {
      window.location.hash = 'transactions';
    });
  }
}
