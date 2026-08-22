// ─── Utility Functions ───

export function formatCurrency(amount, showSign = false) {
  const absAmount = Math.abs(amount);
  let formatted;

  if (absAmount >= 1000000000) {
    formatted = (absAmount / 1000000000).toFixed(1).replace(/\.0$/, '') + ' tỷ';
  } else if (absAmount >= 1000000) {
    formatted = (absAmount / 1000000).toFixed(1).replace(/\.0$/, '') + ' M';
  } else {
    formatted = absAmount.toLocaleString('vi-VN');
  }

  if (showSign) {
    return amount >= 0 ? `+${formatted}` : `-${formatted}`;
  }
  return amount < 0 ? `-${formatted}` : formatted;
}

export function formatFullCurrency(amount) {
  return Math.abs(amount).toLocaleString('vi-VN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatDate(dateStr) {
  const date = new Date(dateStr);
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  return {
    dayOfWeek: days[date.getDay()],
    day: date.getDate(),
    month: `tháng ${months[date.getMonth()]}`,
    year: date.getFullYear(),
    full: `${days[date.getDay()]}, ${date.getDate()} tháng ${date.getMonth() + 1} ${date.getFullYear()}`,
    short: `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
  };
}

export function getWeekRange(offset = 0) {
  const now = new Date();
  const currentDay = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + (offset * 7));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

export function getMonthRange(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  return { start, end };
}

export function getDaysRemainingInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

export function groupTransactionsByDay(transactions) {
  const groups = {};
  for (const tx of transactions) {
    const date = new Date(tx.date);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (!groups[key]) {
      groups[key] = {
        date,
        day: date.getDate(),
        dayOfWeek: formatDate(tx.date).dayOfWeek,
        month: `tháng ${date.getMonth() + 1} ${date.getFullYear()}`,
        transactions: [],
        total: 0
      };
    }
    groups[key].transactions.push(tx);
    if (tx.type === 'expense' || tx.type === 'debt') {
      groups[key].total -= tx.amount;
    } else {
      groups[key].total += tx.amount;
    }
  }

  return Object.values(groups).sort((a, b) => b.date - a.date);
}

export function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

export function hapticFeedback() {
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
}
