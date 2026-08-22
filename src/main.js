import { initDatabase, getAllData } from './db/database.js';
import { initSupabase, isSyncEnabled, pushToCloud } from './db/cloud-sync.js';
import { saveToLocalStorage } from './db/local-backup.js';
import router from './router.js';
import { renderDashboard, setupDashboardEvents } from './pages/dashboard.js';
import { renderTransactions, setupTransactionEvents } from './pages/transactions.js';
import { openAddTransaction } from './pages/add-transaction.js';
import { renderBudget, setupBudgetEvents } from './pages/budget.js';
import { renderAccount, setupAccountEvents } from './pages/account.js';

// ─── App Initialization ───
async function initApp() {
  try {
    await initDatabase();
    console.log('✅ Database initialized');

    // Initialize cloud sync
    const cloudOk = initSupabase();
    if (cloudOk) {
      console.log('☁️ Cloud sync enabled');
    }

    // Auto-backup to localStorage on startup
    const data = await getAllData();
    saveToLocalStorage(data);
    console.log('💾 localStorage backup created');

    // Auto-sync to cloud if enabled
    if (isSyncEnabled()) {
      setTimeout(async () => {
        const freshData = await getAllData();
        await pushToCloud(freshData);
      }, 3000);
    }
  } catch (err) {
    console.error('❌ Init error:', err);
  }

  const pageContainer = document.getElementById('page-container');
  const bottomNav = document.getElementById('bottom-nav');

  // Register routes
  router.register('dashboard', renderDashboard);
  router.register('transactions', renderTransactions);
  router.register('budget', renderBudget);
  router.register('account', renderAccount);

  // Page event setup map
  const pageEvents = {
    dashboard: setupDashboardEvents,
    transactions: setupTransactionEvents,
    budget: setupBudgetEvents,
    account: setupAccountEvents
  };

  // On navigate callback
  router.onNavigate = (pageName) => {
    // Update bottom nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageName);
    });

    // Show/hide bottom nav
    if (pageName === 'add-transaction') {
      bottomNav.style.display = 'none';
    } else {
      bottomNav.style.display = '';
    }

    // Setup page-specific events
    setTimeout(() => {
      if (pageEvents[pageName]) {
        pageEvents[pageName]();
      }
    }, 200);
  };

  // Initialize router
  router.init(pageContainer);

  // Bottom nav click handlers
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page) {
        router.navigate(page);
      }
    });
  });

  // FAB button
  document.getElementById('nav-add')?.addEventListener('click', () => {
    openAddTransaction();
  });

  // Reload page event (used by modals after saving)
  window.addEventListener('reload-page', () => {
    const currentPage = router.getCurrentPage();
    if (currentPage) {
      router.loadPage(currentPage);
    }
  });

  // Initial route
  router.handleRoute();
}

// ─── Start App ───
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ─── Register Service Worker ───
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => console.log('✅ SW registered:', registration.scope),
      (err) => console.log('SW registration failed:', err)
    );
  });
}
