import { getWallets, getCategories, addTransaction } from '../db/database.js';
import { formatFullCurrency, showToast, hapticFeedback } from '../utils.js';

let currentType = 'expense';
let currentAmount = '0';
let selectedCategoryId = null;
let selectedWalletId = null;
let noteText = '';

export function openAddTransaction() {
  currentType = 'expense';
  currentAmount = '0';
  selectedCategoryId = null;
  noteText = '';

  const modal = document.getElementById('modal-container');
  modal.innerHTML = '';

  Promise.all([getWallets(), getCategories()]).then(([wallets, categories]) => {
    selectedWalletId = wallets[0]?.id;

    modal.innerHTML = `
      <div class="modal-overlay" id="add-tx-overlay"></div>
      <div class="modal" id="add-tx-modal" style="height: 100%; max-height: 100vh; max-height: 100dvh; border-radius: 0;">
        <!-- Header -->
        <div style="display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-subtle);">
          <button class="btn btn-ghost" id="add-tx-cancel" style="padding: 8px 16px; border-radius: var(--radius-full); background: var(--bg-elevated); font-weight: 600;">Huỷ</button>
          <h2 style="flex: 1; text-align: center; font-size: 18px; font-weight: 700;">Thêm Giao Dịch</h2>
          <div style="width: 60px;"></div>
        </div>

        <!-- Transaction Form -->
        <div style="padding: 20px; flex: 1;">
          <div class="card-glass" style="padding: 16px;">
            <!-- Type Tabs -->
            <div class="tabs" style="margin-bottom: 20px;">
              <button class="tab active" data-type="expense" id="type-expense">Khoản chi</button>
              <button class="tab" data-type="income" id="type-income">Khoản thu</button>
              <button class="tab" data-type="debt" id="type-debt">Vay/Nợ</button>
            </div>

            <!-- Wallet -->
            <div class="input-group" id="wallet-selector" style="cursor: pointer;">
              <span style="font-size: 20px;">${wallets[0]?.icon || '💵'}</span>
              <span style="flex: 1; font-weight: 500;">${wallets[0]?.name || 'Tiền mặt'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>

            <!-- Amount -->
            <div class="input-group">
              <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <span class="text-label">Số tiền</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px 0;">
              <span class="currency-badge">VND</span>
              <div class="amount-display" id="amount-display">0</div>
              <button class="icon-btn" id="clear-amount" style="width: 28px; height: 28px; background: var(--bg-input);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <!-- Category -->
            <div class="input-group" id="category-selector" style="cursor: pointer;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--bg-input); display: flex; align-items: center; justify-content: center;" id="selected-cat-icon">
                <span style="font-size: 16px; opacity: 0.5;">•</span>
              </div>
              <span style="flex: 1; color: var(--text-tertiary);" id="selected-cat-name">Chọn nhóm</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>

            <!-- Note -->
            <div class="input-group" id="note-input-group" style="cursor: pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="4" y1="14" x2="14" y2="14"/>
              </svg>
              <input type="text" class="input-field" placeholder="Ghi chú" id="note-input" style="font-size: 15px;" />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </div>

          <!-- Save Button -->
          <div style="display: flex; gap: 12px; margin-top: 16px;">
            <button class="btn btn-secondary btn-block btn-lg" id="save-tx-btn" style="flex: 1;">Lưu</button>
            <button class="icon-btn" style="width: 52px; height: 52px; background: var(--accent-green); color: white; border-radius: var(--radius-lg);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            </button>
          </div>
        </div>

        <!-- Numpad -->
        <div style="border-top: 1px solid var(--border-subtle);">
          <div class="numpad-display" id="numpad-display">${currentAmount === '0' ? '0' : formatFullCurrency(parseFloat(currentAmount))}</div>
          <div class="numpad">
            <button class="numpad-key operator" data-key="C">C</button>
            <button class="numpad-key operator" data-key="÷">÷</button>
            <button class="numpad-key operator" data-key="×">×</button>
            <button class="numpad-key backspace" data-key="⌫">⌫</button>
            <button class="numpad-key" data-key="7">7</button>
            <button class="numpad-key" data-key="8">8</button>
            <button class="numpad-key" data-key="9">9</button>
            <button class="numpad-key operator" data-key="-">−</button>
            <button class="numpad-key" data-key="4">4</button>
            <button class="numpad-key" data-key="5">5</button>
            <button class="numpad-key" data-key="6">6</button>
            <button class="numpad-key operator" data-key="+">+</button>
            <button class="numpad-key" data-key="1">1</button>
            <button class="numpad-key" data-key="2">2</button>
            <button class="numpad-key" data-key="3">3</button>
            <button class="numpad-key confirm" data-key="XONG" id="numpad-done">XONG</button>
            <button class="numpad-key" data-key="0">0</button>
            <button class="numpad-key" data-key="000">000</button>
            <button class="numpad-key" data-key=".">.</button>
          </div>
        </div>
      </div>
    `;

    setupAddTxEvents(categories);
  });
}

function setupAddTxEvents(categories) {
  // Cancel
  document.getElementById('add-tx-cancel')?.addEventListener('click', closeAddTransaction);
  document.getElementById('add-tx-overlay')?.addEventListener('click', closeAddTransaction);

  // Type tabs
  document.querySelectorAll('[data-type]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-type]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentType = tab.dataset.type;
      selectedCategoryId = null;
      document.getElementById('selected-cat-name').textContent = 'Chọn nhóm';
      document.getElementById('selected-cat-icon').innerHTML = '<span style="font-size: 16px; opacity: 0.5;">•</span>';
    });
  });

  // Numpad keys
  document.querySelectorAll('.numpad-key').forEach(key => {
    key.addEventListener('click', () => {
      hapticFeedback();
      handleNumpadKey(key.dataset.key);
    });
  });

  // Clear amount
  document.getElementById('clear-amount')?.addEventListener('click', () => {
    currentAmount = '0';
    updateAmountDisplay();
  });

  // Category selector
  document.getElementById('category-selector')?.addEventListener('click', () => {
    openCategoryPicker(categories);
  });

  // Save
  document.getElementById('save-tx-btn')?.addEventListener('click', saveTransaction);

  // XONG button
  document.getElementById('numpad-done')?.addEventListener('click', saveTransaction);
}

function handleNumpadKey(key) {
  switch (key) {
    case 'C':
      currentAmount = '0';
      break;
    case '⌫':
      currentAmount = currentAmount.length > 1 ? currentAmount.slice(0, -1) : '0';
      break;
    case '.':
      if (!currentAmount.includes('.')) currentAmount += '.';
      break;
    case '000':
      if (currentAmount !== '0') currentAmount += '000';
      break;
    case 'XONG':
      return;
    case '+': case '-': case '×': case '÷':
      // Simple: just store for display
      break;
    default:
      if (currentAmount === '0') {
        currentAmount = key;
      } else {
        currentAmount += key;
      }
  }
  updateAmountDisplay();
}

function updateAmountDisplay() {
  const display = document.getElementById('amount-display');
  const numpadDisplay = document.getElementById('numpad-display');
  const amount = parseFloat(currentAmount) || 0;

  if (display) {
    display.textContent = amount > 0 ? formatFullCurrency(amount) : '0';
  }
  if (numpadDisplay) {
    numpadDisplay.textContent = amount > 0 ? formatFullCurrency(amount) : '0';
  }
}

function openCategoryPicker(categories) {
  const filteredCats = categories.filter(c => c.type === currentType && !c.parentId);
  const subCats = categories.filter(c => c.parentId);

  const pickerHtml = `
    <div class="modal-overlay" id="cat-picker-overlay"></div>
    <div class="modal" id="cat-picker-modal">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <button class="icon-btn" id="cat-picker-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h2>Chọn nhóm</h2>
        <button class="icon-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
      </div>

      <div style="padding: 0 16px;">
        <!-- Type tabs -->
        <div class="tabs" style="margin-bottom: 16px;">
          <button class="tab cat-type-tab ${currentType === 'expense' ? 'active' : ''}" data-cat-type="expense">Khoản chi</button>
          <button class="tab cat-type-tab ${currentType === 'income' ? 'active' : ''}" data-cat-type="income">Khoản thu</button>
          <button class="tab cat-type-tab ${currentType === 'debt' ? 'active' : ''}" data-cat-type="debt">Vay/Nợ</button>
        </div>

        <!-- Add new -->
        <button class="btn btn-secondary btn-block" style="margin-bottom: 16px; border: 1px dashed var(--border-strong);">
          <span style="color: var(--accent-green);">＋ Nhóm mới</span>
        </button>
      </div>

      <div class="modal-body stagger-children" id="category-list">
        ${filteredCats.map(cat => {
          const subs = subCats.filter(s => s.parentId === cat.id);
          return `
            <div class="category-item" data-cat-id="${cat.id}">
              <div class="category-icon" style="background: ${cat.color}22;">${cat.icon}</div>
              <div class="category-name">${cat.name}</div>
            </div>
            ${subs.length > 0 ? `
              <div class="category-sub">
                ${subs.map(sub => `
                  <div class="category-item" data-cat-id="${sub.id}">
                    <div class="category-icon" style="background: ${sub.color}22;">${sub.icon}</div>
                    <div class="category-name">${sub.name}</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          `;
        }).join('')}
      </div>

      <!-- Search -->
      <div class="search-input-wrapper" style="position: sticky; bottom: 0; margin: 0; border-radius: 0; background: var(--bg-secondary); border-top: 1px solid var(--border-subtle);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" class="search-input" placeholder="Tìm kiếm" id="cat-search" />
      </div>
    </div>
  `;

  // Append to existing modal container area
  const extraModal = document.createElement('div');
  extraModal.id = 'category-picker-container';
  extraModal.innerHTML = pickerHtml;
  document.body.appendChild(extraModal);

  // Events
  document.getElementById('cat-picker-back')?.addEventListener('click', closeCategoryPicker);
  document.getElementById('cat-picker-overlay')?.addEventListener('click', closeCategoryPicker);

  // Category type tabs
  document.querySelectorAll('.cat-type-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cat-type-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const type = tab.dataset.catType;

      // Also update main type
      currentType = type;
      document.querySelectorAll('[data-type]').forEach(t => t.classList.remove('active'));
      document.querySelector(`[data-type="${type}"]`)?.classList.add('active');

      // Re-render category list
      const filtered = categories.filter(c => c.type === type && !c.parentId);
      const subs = categories.filter(c => c.parentId);
      const list = document.getElementById('category-list');
      if (list) {
        list.innerHTML = filtered.map(cat => {
          const catSubs = subs.filter(s => s.parentId === cat.id);
          return `
            <div class="category-item" data-cat-id="${cat.id}">
              <div class="category-icon" style="background: ${cat.color}22;">${cat.icon}</div>
              <div class="category-name">${cat.name}</div>
            </div>
            ${catSubs.length > 0 ? `
              <div class="category-sub">
                ${catSubs.map(sub => `
                  <div class="category-item" data-cat-id="${sub.id}">
                    <div class="category-icon" style="background: ${sub.color}22;">${sub.icon}</div>
                    <div class="category-name">${sub.name}</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          `;
        }).join('');
        bindCategoryItems();
      }
    });
  });

  // Search
  document.getElementById('cat-search')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const items = document.querySelectorAll('#category-list .category-item');
    items.forEach(item => {
      const name = item.querySelector('.category-name')?.textContent.toLowerCase() || '';
      item.style.display = name.includes(query) ? '' : 'none';
    });
  });

  bindCategoryItems();
}

function bindCategoryItems() {
  document.querySelectorAll('#category-list .category-item').forEach(item => {
    item.addEventListener('click', () => {
      const catId = parseInt(item.dataset.catId);
      selectedCategoryId = catId;
      const icon = item.querySelector('.category-icon')?.textContent.trim();
      const name = item.querySelector('.category-name')?.textContent.trim();

      document.getElementById('selected-cat-icon').innerHTML = `<span style="font-size: 18px;">${icon}</span>`;
      document.getElementById('selected-cat-name').textContent = name;
      document.getElementById('selected-cat-name').style.color = 'var(--text-primary)';

      closeCategoryPicker();
    });
  });
}

function closeCategoryPicker() {
  const container = document.getElementById('category-picker-container');
  if (container) {
    const modal = container.querySelector('.modal');
    if (modal) {
      modal.classList.add('closing');
      setTimeout(() => container.remove(), 250);
    } else {
      container.remove();
    }
  }
}

async function saveTransaction() {
  const amount = parseFloat(currentAmount) || 0;
  noteText = document.getElementById('note-input')?.value || '';

  if (amount <= 0) {
    showToast('Vui lòng nhập số tiền', 'error');
    return;
  }

  if (!selectedCategoryId) {
    showToast('Vui lòng chọn nhóm', 'error');
    return;
  }

  try {
    await addTransaction({
      walletId: selectedWalletId,
      categoryId: selectedCategoryId,
      type: currentType,
      amount,
      note: noteText,
      date: new Date().toISOString()
    });

    showToast('Đã lưu giao dịch thành công! ✅');
    closeAddTransaction();

    // Reload current page
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('reload-page'));
    }, 300);
  } catch (err) {
    console.error('Save error:', err);
    showToast('Lỗi khi lưu giao dịch', 'error');
  }
}

function closeAddTransaction() {
  const modal = document.getElementById('add-tx-modal');
  if (modal) {
    modal.classList.add('closing');
  }
  setTimeout(() => {
    document.getElementById('modal-container').innerHTML = '';
  }, 250);
}
