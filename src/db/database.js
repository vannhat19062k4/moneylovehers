import Dexie from 'dexie';
import { saveToLocalStorage, loadFromLocalStorage } from './local-backup.js';
import { isSyncEnabled, pushToCloud } from './cloud-sync.js';

// ─── Database Schema ───
const db = new Dexie('MoneyLoveHers');

db.version(1).stores({
  wallets: '++id, name, type, balance, icon, color, createdAt',
  transactions: '++id, walletId, categoryId, type, amount, note, date, createdAt',
  categories: '++id, name, icon, color, type, parentId, order',
  budgets: '++id, categoryId, amount, spent, period, startDate, endDate'
});

// ─── Default Categories ───
const DEFAULT_CATEGORIES = {
  expense: [
    { name: 'Ăn uống', icon: '🍸', color: '#EF4444', type: 'expense', parentId: null, order: 1 },
    { name: 'Hoá đơn & Tiện ích', icon: '🎬', color: '#F59E0B', type: 'expense', parentId: null, order: 2 },
    { name: 'Thuê nhà', icon: '🏠', color: '#F59E0B', type: 'expense', parentId: 'bill', order: 1 },
    { name: 'Hoá đơn nước', icon: '💧', color: '#3B82F6', type: 'expense', parentId: 'bill', order: 2 },
    { name: 'Hoá đơn điện thoại', icon: '📱', color: '#EF4444', type: 'expense', parentId: 'bill', order: 3 },
    { name: 'Hoá đơn điện', icon: '⚡', color: '#F59E0B', type: 'expense', parentId: 'bill', order: 4 },
    { name: 'Hoá đơn gas', icon: '🔥', color: '#EF4444', type: 'expense', parentId: 'bill', order: 5 },
    { name: 'Hoá đơn TV', icon: '📺', color: '#EF4444', type: 'expense', parentId: 'bill', order: 6 },
    { name: 'Hoá đơn Internet', icon: '🌐', color: '#3B82F6', type: 'expense', parentId: 'bill', order: 7 },
    { name: 'Di chuyển', icon: '🚗', color: '#3B82F6', type: 'expense', parentId: null, order: 3 },
    { name: 'Mua sắm', icon: '🛍️', color: '#8B5CF6', type: 'expense', parentId: null, order: 4 },
    { name: 'Giải trí', icon: '🎮', color: '#EC4899', type: 'expense', parentId: null, order: 5 },
    { name: 'Y tế', icon: '🏥', color: '#10B981', type: 'expense', parentId: null, order: 6 },
    { name: 'Giáo dục', icon: '📚', color: '#3B82F6', type: 'expense', parentId: null, order: 7 },
    { name: 'Quà tặng', icon: '🎁', color: '#EC4899', type: 'expense', parentId: null, order: 8 },
    { name: 'Bảo hiểm', icon: '🛡️', color: '#6366F1', type: 'expense', parentId: null, order: 9 },
    { name: 'Đầu tư', icon: '📈', color: '#10B981', type: 'expense', parentId: null, order: 10 },
    { name: 'Phí & lệ phí', icon: '💳', color: '#6B7280', type: 'expense', parentId: null, order: 11 },
    { name: 'Chi tiêu khác', icon: '📦', color: '#6B7280', type: 'expense', parentId: null, order: 12 },
  ],
  income: [
    { name: 'Lương', icon: '💰', color: '#10B981', type: 'income', parentId: null, order: 1 },
    { name: 'Thu nhập khác', icon: '💎', color: '#F59E0B', type: 'income', parentId: null, order: 2 },
    { name: 'Tiền chuyển đến', icon: '📥', color: '#3B82F6', type: 'income', parentId: null, order: 3 },
    { name: 'Thu lãi', icon: '💹', color: '#EF4444', type: 'income', parentId: null, order: 4 },
  ],
  debt: [
    { name: 'Cho vay', icon: '💸', color: '#EC4899', type: 'debt', parentId: null, order: 1 },
    { name: 'Trả nợ', icon: '🏦', color: '#F59E0B', type: 'debt', parentId: null, order: 2 },
    { name: 'Thu nợ', icon: '🤝', color: '#3B82F6', type: 'debt', parentId: null, order: 3 },
    { name: 'Đi vay', icon: '💵', color: '#10B981', type: 'debt', parentId: null, order: 4 },
  ]
};

// ─── Initialize Database ───
export async function initDatabase() {
  const catCount = await db.categories.count();
  if (catCount === 0) {
    const allCats = [
      ...DEFAULT_CATEGORIES.expense,
      ...DEFAULT_CATEGORIES.income,
      ...DEFAULT_CATEGORIES.debt
    ];
    // Set parentId for bill subcategories
    const billParent = allCats.find(c => c.name === 'Hoá đơn & Tiện ích');
    await db.categories.bulkAdd(allCats.map(c => ({
      ...c,
      parentId: c.parentId === 'bill' ? null : c.parentId // will fix after insert
    })));

    // Now fix bill subcategories
    const billCat = await db.categories.where('name').equals('Hoá đơn & Tiện ích').first();
    if (billCat) {
      const billSubs = ['Thuê nhà', 'Hoá đơn nước', 'Hoá đơn điện thoại', 'Hoá đơn điện', 'Hoá đơn gas', 'Hoá đơn TV', 'Hoá đơn Internet'];
      for (const subName of billSubs) {
        await db.categories.where('name').equals(subName).modify({ parentId: billCat.id });
      }
    }
  }

  const walletCount = await db.wallets.count();
  if (walletCount === 0) {
    await db.wallets.add({
      name: 'Tiền mặt',
      type: 'cash',
      balance: 0,
      icon: '💵',
      color: '#F59E0B',
      createdAt: new Date().toISOString()
    });
  }
}

// ─── Auto-Sync: backup to localStorage + cloud after every change ───
let syncTimer = null;
async function triggerAutoSync() {
  // Debounce: wait 1s after last change before syncing
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const data = await getAllData();
      // Layer 1: localStorage backup
      saveToLocalStorage(data);
      // Layer 2: Cloud sync (if configured)
      if (isSyncEnabled()) {
        await pushToCloud(data);
      }
    } catch (err) {
      console.warn('Auto-sync error:', err);
    }
  }, 1000);
}

export async function getAllData() {
  const wallets = await db.wallets.toArray();
  const transactions = await db.transactions.toArray();
  const categories = await db.categories.toArray();
  const budgets = await db.budgets.toArray();
  return { wallets, transactions, categories, budgets };
}

export async function restoreFromLocalBackup() {
  const backup = loadFromLocalStorage();
  if (!backup || !backup.data) return false;
  await importData(backup);
  return true;
}

// ─── Wallet CRUD ───
export async function getWallets() {
  return db.wallets.toArray();
}

export async function getWallet(id) {
  return db.wallets.get(id);
}

export async function addWallet(wallet) {
  const id = await db.wallets.add({
    ...wallet,
    balance: wallet.balance || 0,
    createdAt: new Date().toISOString()
  });
  triggerAutoSync();
  return id;
}

export async function updateWallet(id, changes) {
  const result = await db.wallets.update(id, changes);
  triggerAutoSync();
  return result;
}

export async function deleteWallet(id) {
  await db.transactions.where('walletId').equals(id).delete();
  const result = await db.wallets.delete(id);
  triggerAutoSync();
  return result;
}

export async function getTotalBalance() {
  const wallets = await getWallets();
  return wallets.reduce((sum, w) => sum + (w.balance || 0), 0);
}

// ─── Category CRUD ───
export async function getCategories(type = null) {
  let cats;
  if (type) {
    cats = await db.categories.where('type').equals(type).sortBy('order');
  } else {
    cats = await db.categories.orderBy('order').toArray();
  }
  return cats;
}

export async function getCategory(id) {
  return db.categories.get(id);
}

export async function addCategory(category) {
  const id = await db.categories.add(category);
  triggerAutoSync();
  return id;
}

// ─── Transaction CRUD ───
export async function addTransaction(transaction) {
  const tx = {
    ...transaction,
    date: transaction.date || new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  const id = await db.transactions.add(tx);

  // Update wallet balance
  const wallet = await db.wallets.get(tx.walletId);
  if (wallet) {
    let balanceChange = 0;
    
    if (tx.type === 'income') {
      balanceChange = tx.amount;
    } else if (tx.type === 'expense') {
      balanceChange = -tx.amount;
    } else if (tx.type === 'debt') {
      // Logic đặc biệt cho nhóm Nợ
      const category = await db.categories.get(tx.categoryId);
      if (category && (category.name === 'Thu nợ' || category.name === 'Đi vay')) {
        balanceChange = tx.amount; // Tiền đi vào ví
      } else {
        balanceChange = -tx.amount; // Cho vay, Trả nợ: Tiền đi ra khỏi ví
      }
    }
    
    await db.wallets.update(tx.walletId, {
      balance: (wallet.balance || 0) + balanceChange
    });
  }

  // Update budget spent
  if (tx.type === 'expense') {
    const txDate = new Date(tx.date);
    const budgets = await db.budgets.where('categoryId').equals(tx.categoryId).toArray();
    for (const budget of budgets) {
      const start = new Date(budget.startDate);
      const end = new Date(budget.endDate);
      if (txDate >= start && txDate <= end) {
        await db.budgets.update(budget.id, {
          spent: (budget.spent || 0) + tx.amount
        });
      }
    }
  }

  triggerAutoSync();
  return id;
}

export async function getTransactions(filters = {}) {
  let collection = db.transactions.orderBy('date').reverse();

  let results = await collection.toArray();

  if (filters.walletId) {
    results = results.filter(t => String(t.walletId) === String(filters.walletId));
  }
  if (filters.type) {
    results = results.filter(t => t.type === filters.type);
  }
  if (filters.startDate) {
    results = results.filter(t => new Date(t.date) >= new Date(filters.startDate));
  }
  if (filters.endDate) {
    results = results.filter(t => new Date(t.date) <= new Date(filters.endDate));
  }
  if (filters.categoryId) {
    results = results.filter(t => String(t.categoryId) === String(filters.categoryId));
  }
  if (filters.limit) {
    results = results.slice(0, filters.limit);
  }

  return results;
}

export async function deleteTransaction(id) {
  const tx = await db.transactions.get(id);
  if (tx) {
    const wallet = await db.wallets.get(tx.walletId);
    if (wallet) {
      let balanceChange = 0;
      
      if (tx.type === 'income') {
        balanceChange = -tx.amount; // Xoá thu nhập -> trừ tiền
      } else if (tx.type === 'expense') {
        balanceChange = tx.amount; // Xoá chi tiêu -> cộng lại tiền
      } else if (tx.type === 'debt') {
        const category = await db.categories.get(tx.categoryId);
        if (category && (category.name === 'Thu nợ' || category.name === 'Đi vay')) {
          balanceChange = -tx.amount; // Xoá khoản tiền vào -> trừ tiền
        } else {
          balanceChange = tx.amount; // Xoá khoản tiền ra -> cộng lại tiền
        }
      }
      
      await db.wallets.update(tx.walletId, {
        balance: (wallet.balance || 0) + balanceChange
      });
    }

    // Giảm budget spent khi xoá giao dịch
    if (tx.type === 'expense') {
      const txDate = new Date(tx.date);
      const budgets = await db.budgets.where('categoryId').equals(tx.categoryId).toArray();
      for (const budget of budgets) {
        const start = new Date(budget.startDate);
        const end = new Date(budget.endDate);
        if (txDate >= start && txDate <= end) {
          await db.budgets.update(budget.id, {
            spent: Math.max(0, (budget.spent || 0) - tx.amount)
          });
        }
      }
    }
  }
  const result = await db.transactions.delete(id);
  triggerAutoSync();
  return result;
}

// ─── Budget CRUD ───
export async function getBudgets() {
  return db.budgets.toArray();
}

export async function addBudget(budget) {
  const id = await db.budgets.add({
    ...budget,
    spent: 0
  });
  triggerAutoSync();
  return id;
}

export async function updateBudget(id, changes) {
  const result = await db.budgets.update(id, changes);
  triggerAutoSync();
  return result;
}

export async function deleteBudget(id) {
  const result = await db.budgets.delete(id);
  triggerAutoSync();
  return result;
}

// ─── Statistics ───
export async function getMonthlyStats(year, month, walletId = null) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  const filters = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
  if (walletId) filters.walletId = walletId;

  const transactions = await getTransactions(filters);

  let totalExpense = 0;
  let totalIncome = 0;
  const expenseByCategory = {};
  const dailyExpense = {};

  for (const tx of transactions) {
    if (tx.type === 'expense') {
      totalExpense += tx.amount;
      expenseByCategory[tx.categoryId] = (expenseByCategory[tx.categoryId] || 0) + tx.amount;
      const dayKey = new Date(tx.date).toISOString().split('T')[0];
      dailyExpense[dayKey] = (dailyExpense[dayKey] || 0) + tx.amount;
    } else if (tx.type === 'income') {
      totalIncome += tx.amount;
    }
  }

  return {
    totalExpense,
    totalIncome,
    expenseByCategory,
    dailyExpense,
    transactions
  };
}

export async function getTopSpending(year, month, limit = 5) {
  const stats = await getMonthlyStats(year, month);
  const categories = await getCategories('expense');

  const spending = Object.entries(stats.expenseByCategory)
    .map(([catId, amount]) => {
      const cat = categories.find(c => String(c.id) === String(catId));
      return {
        categoryId: cat ? cat.id : catId,
        name: cat?.name || 'Khác',
        icon: cat?.icon || '📦',
        amount,
        percentage: stats.totalExpense > 0 ? (amount / stats.totalExpense * 100) : 0
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);

  return spending;
}

// ─── Data Export/Import ───
export async function exportData() {
  const wallets = await db.wallets.toArray();
  const transactions = await db.transactions.toArray();
  const categories = await db.categories.toArray();
  const budgets = await db.budgets.toArray();

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { wallets, transactions, categories, budgets }
  };
}

export async function importData(jsonData) {
  const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

  await db.transaction('rw', [db.wallets, db.transactions, db.categories, db.budgets], async () => {
    await db.wallets.clear();
    await db.transactions.clear();
    await db.categories.clear();
    await db.budgets.clear();

    if (parsed.data.wallets) await db.wallets.bulkAdd(parsed.data.wallets);
    if (parsed.data.transactions) await db.transactions.bulkAdd(parsed.data.transactions);
    if (parsed.data.categories) await db.categories.bulkAdd(parsed.data.categories);
    if (parsed.data.budgets) await db.budgets.bulkAdd(parsed.data.budgets);
  });

  // Re-initialize default categories/wallet if the imported data was empty
  await initDatabase();
}

export async function resetAllData() {
  await db.wallets.clear();
  await db.transactions.clear();
  await db.categories.clear();
  await db.budgets.clear();
  await initDatabase();
}

// ─── Sample Data ───
export async function loadSampleData() {
  const wallets = await getWallets();
  const wallet = wallets[0];
  const categories = await getCategories();

  const getCatId = (name) => categories.find(c => c.name === name)?.id;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const sampleTransactions = [
    { walletId: wallet.id, categoryId: getCatId('Lương'), type: 'income', amount: 15000000, note: 'Lương tháng 8', date: new Date(year, month, 1, 9, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Ăn uống'), type: 'expense', amount: 150000, note: 'Ăn sáng & trưa', date: new Date(year, month, 2, 12, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Di chuyển'), type: 'expense', amount: 80000, note: 'Grab đi làm', date: new Date(year, month, 3, 8, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Ăn uống'), type: 'expense', amount: 200000, note: 'Ăn tối nhà hàng', date: new Date(year, month, 5, 19, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Thuê nhà'), type: 'expense', amount: 3500000, note: 'Thuê nhà tháng 8', date: new Date(year, month, 1, 10, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Hoá đơn điện'), type: 'expense', amount: 450000, note: 'Tiền điện tháng 7', date: new Date(year, month, 5, 11, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Hoá đơn nước'), type: 'expense', amount: 120000, note: 'Tiền nước tháng 7', date: new Date(year, month, 5, 11, 30).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Mua sắm'), type: 'expense', amount: 850000, note: 'Mua quần áo', date: new Date(year, month, 8, 15, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Giải trí'), type: 'expense', amount: 200000, note: 'Xem phim', date: new Date(year, month, 10, 20, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Ăn uống'), type: 'expense', amount: 350000, note: 'Coffee & bánh', date: new Date(year, month, 12, 14, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Y tế'), type: 'expense', amount: 500000, note: 'Khám sức khoẻ', date: new Date(year, month, 14, 9, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Di chuyển'), type: 'expense', amount: 120000, note: 'Đổ xăng', date: new Date(year, month, 15, 7, 30).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Thu nhập khác'), type: 'income', amount: 2000000, note: 'Freelance project', date: new Date(year, month, 16, 10, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Ăn uống'), type: 'expense', amount: 280000, note: 'Đi ăn cùng bạn', date: new Date(year, month, 18, 19, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Hoá đơn Internet'), type: 'expense', amount: 220000, note: 'Internet tháng 8', date: new Date(year, month, 20, 9, 0).toISOString() },
    { walletId: wallet.id, categoryId: getCatId('Ăn uống'), type: 'expense', amount: 180000, note: 'Ăn trưa', date: new Date(year, month, now.getDate(), 12, 0).toISOString() },
  ];

  for (const tx of sampleTransactions) {
    if (tx.categoryId) {
      await addTransaction(tx);
    }
  }

  // Add a budget
  const anUongCat = categories.find(c => c.name === 'Ăn uống');
  if (anUongCat) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);
    // Calculate spent
    const txs = await getTransactions({ categoryId: anUongCat.id, startDate: startDate.toISOString(), endDate: endDate.toISOString() });
    const spent = txs.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : 0), 0);

    await db.budgets.add({
      categoryId: anUongCat.id,
      amount: 3000000,
      spent: spent,
      period: 'monthly',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
  }
}

export default db;
