import { getTransactions, getWallets, getCategories, deleteTransaction } from '../db/database.js';
import { formatFullCurrency, formatDate, getWeekRange, groupTransactionsByDay } from '../utils.js';

let currentWeekOffset = 0;

export async function renderTransactions() {
  const wallets = await getWallets();
  const currentWallet = wallets[0];
  const categories = await getCategories();

  const weekRange = getWeekRange(currentWeekOffset);
  const prevWeekRange = getWeekRange(currentWeekOffset - 1);

  const transactions = await getTransactions({
    walletId: currentWallet?.id,
    startDate: weekRange.start.toISOString(),
    endDate: weekRange.end.toISOString()
  });

  const groups = groupTransactionsByDay(transactions);

  // Calculate period balance
  let periodExpense = 0;
  let periodIncome = 0;
  for (const tx of transactions) {
    if (tx.type === 'expense' || tx.type === 'debt') periodExpense += tx.amount;
    else periodIncome += tx.amount;
  }

  const startBalance = (currentWallet?.balance || 0) + periodExpense - periodIncome;
  const endBalance = currentWallet?.balance || 0;

  const weekLabel = currentWeekOffset === 0 ? 'TUẦN NÀY' : currentWeekOffset === -1 ? 'TUẦN TRƯỚC' : `${formatDate(weekRange.start.toISOString()).short} - ${formatDate(weekRange.end.toISOString()).short}`;
  const prevLabel = currentWeekOffset === 0 ? 'TUẦN TRƯỚC' : `${formatDate(prevWeekRange.start.toISOString()).short}`;
  const nextLabel = currentWeekOffset === -1 ? 'TUẦN NÀY' : '';

  return `
    <div class="transactions-page animate-fade-in">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="icon-btn" id="tx-help-btn" style="width: 36px; height: 36px;">
            <span style="font-size: 16px;">?</span>
          </button>
          <div style="display: flex; align-items: center; gap: 8px; background: var(--bg-card); border-radius: var(--radius-full); padding: 6px 16px;">
            <span style="font-size: 18px;">${currentWallet?.icon || '💵'}</span>
            <span style="font-weight: 600;">${currentWallet?.name || 'Tiền mặt'}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="icon-btn" style="width: 36px; height: 36px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <button class="icon-btn" style="width: 36px; height: 36px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>
      </div>

      <!-- Balance -->
      <div style="text-align: center; margin-bottom: 8px;">
        <div class="text-label">Số dư</div>
        <div style="font-size: 28px; font-weight: 800; color: ${endBalance >= 0 ? 'var(--accent-green)' : 'var(--accent-red-light)'}; margin-top: 4px;">
          ${formatFullCurrency(endBalance)} đ
        </div>
      </div>

      <!-- Week Navigation -->
      <div class="week-tabs">
        <button class="week-tab" id="prev-week-btn">${currentWeekOffset <= -1 ? `← ${formatDate(prevWeekRange.start.toISOString()).short}` : '← TUẦN TRƯỚC'}</button>
        <button class="week-tab active">${weekLabel}</button>
        ${currentWeekOffset < 0 ? `<button class="week-tab" id="next-week-btn">${currentWeekOffset === -1 ? 'TUẦN NÀY →' : '→'}</button>` : '<button class="week-tab" style="visibility:hidden">→</button>'}
      </div>

      <!-- Period Summary -->
      <div class="card" style="margin-top: 16px;">
        <div class="balance-row">
          <span class="balance-label">Số dư đầu</span>
          <span class="balance-value">${formatFullCurrency(startBalance)} đ</span>
        </div>
        <div class="balance-row">
          <span class="balance-label">Số dư cuối</span>
          <span class="balance-value ${endBalance < 0 ? 'text-amount-expense' : ''}">${formatFullCurrency(endBalance)} đ</span>
        </div>
        <div style="text-align: right; margin-top: 8px;">
          <div style="font-size: 18px; font-weight: 800; color: ${(periodIncome - periodExpense) >= 0 ? 'var(--accent-green)' : 'var(--accent-red-light)'};">
            ${(periodIncome - periodExpense) >= 0 ? '+' : '-'}${formatFullCurrency(Math.abs(periodIncome - periodExpense))} đ
          </div>
        </div>
        <div style="text-align: center; margin-top: 12px;">
          <button class="link" style="font-size: 14px;">Xem báo cáo cho giai đoạn này</button>
        </div>
      </div>

      <!-- Transaction Groups -->
      <div class="stagger-children" style="margin-top: 16px;">
        ${groups.length > 0 ? groups.map(group => `
          <div class="day-group card" style="margin-bottom: 12px;">
            <div class="day-header">
              <div class="day-number">${group.day}</div>
              <div class="day-info">
                <div class="day-name">${group.dayOfWeek}</div>
                <div class="day-month">${group.month}</div>
              </div>
              <div class="day-total ${group.total >= 0 ? 'text-amount-income' : 'text-amount-expense'}">
                ${group.total >= 0 ? '+' : ''}${formatFullCurrency(Math.abs(group.total))}
              </div>
            </div>
            ${group.transactions.map(tx => {
              const cat = categories.find(c => String(c.id) === String(tx.categoryId));
              const isExpense = tx.type === 'expense' || tx.type === 'debt';
              return `
                <div class="transaction-item" data-tx-id="${tx.id}">
                  <div class="transaction-icon">${cat?.icon || '📦'}</div>
                  <div class="transaction-info">
                    <div class="transaction-name">${cat?.name || 'Khác'}</div>
                    ${tx.note ? `<div class="transaction-date">${tx.note}</div>` : ''}
                  </div>
                  <div class="transaction-amount ${isExpense ? 'text-amount-expense' : 'text-amount-income'}">
                    ${formatFullCurrency(tx.amount)}
                  </div>
                  <button class="icon-btn delete-tx-btn" data-id="${tx.id}" style="margin-left: 8px; color: var(--accent-red); width: 28px; height: 28px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        `).join('') : `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-text">Không có giao dịch nào trong tuần này</div>
          </div>
        `}
      </div>
    </div>
  `;
}

export function setupTransactionEvents() {
  const prevBtn = document.getElementById('prev-week-btn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentWeekOffset--;
      window.dispatchEvent(new CustomEvent('reload-page'));
    });
  }

  const nextBtn = document.getElementById('next-week-btn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentWeekOffset++;
      window.dispatchEvent(new CustomEvent('reload-page'));
    });
  }

  // Delete transaction events
  document.querySelectorAll('.delete-tx-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      let txId = e.currentTarget.getAttribute('data-id');
      // If txId is numeric string and local dexie expects integer, this might be tricky.
      // But we can check if it parses to integer completely.
      if (/^\d+$/.test(txId)) txId = parseInt(txId);
      
      if (confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) {
        await deleteTransaction(txId);
        window.dispatchEvent(new CustomEvent('reload-page'));
      }
    });
  });
}
