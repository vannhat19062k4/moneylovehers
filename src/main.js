import { initDatabase, getAllData, importData } from './db/database.js';
import { initSupabase, isSyncEnabled, pushToCloud, pullFromCloud } from './db/cloud-sync.js';
import { saveToLocalStorage } from './db/local-backup.js';
import router from './router.js';
import { renderDashboard, setupDashboardEvents } from './pages/dashboard.js';
import { renderTransactions, setupTransactionEvents } from './pages/transactions.js';
import { openAddTransaction } from './pages/add-transaction.js';
import { renderBudget, setupBudgetEvents } from './pages/budget.js';
import { renderAccount, setupAccountEvents } from './pages/account.js';
import { renderLogin, setupLoginEvents } from './pages/login.js';
import { getSession } from './db/cloud-sync.js';

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
          const session = await getSession();
          if (session) {
            const freshData = await getAllData();
            // If local DB is completely empty (new login), pull from cloud first!
            if (freshData.wallets.length === 0 && freshData.categories.length === 0) {
              const cloudData = await pullFromCloud();
              if (cloudData) {
                await importData({ data: cloudData });
                window.dispatchEvent(new CustomEvent('reload-page')); // Refresh UI
              }
            } else {
              // Otherwise, we push our local data to cloud (upsert)
              await pushToCloud(freshData);
            }
          }
        }, 1500);
      }
    } catch (err) {
      console.error('❌ Init error:', err);
    }

  const pageContainer = document.getElementById('page-container');
  const bottomNav = document.getElementById('bottom-nav');

  // Register routes
  router.register('login', renderLogin);
  router.register('dashboard', renderDashboard);
  router.register('transactions', renderTransactions);
  router.register('budget', renderBudget);
  router.register('account', renderAccount);

  // Page event setup map
  const pageEvents = {
    login: setupLoginEvents,
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
      pageContainer.style.paddingBottom = '0';
    } else {
      bottomNav.style.display = 'flex';
      pageContainer.style.paddingBottom = '80px';
    }

    if (pageEvents[pageName]) {
      setTimeout(() => {
        pageEvents[pageName]();
      }, 50);
    }
  };

  // Initialize router
  router.init(pageContainer);

  // Auth Guard
  const session = await getSession();
  const skipLogin = localStorage.getItem('money_love_hers_skip_login');
  
  if (!session && !skipLogin) {
    router.navigate('login');
  } else {
    // Manually trigger the route if hash is empty
    if (!window.location.hash) {
      router.navigate('dashboard');
    } else {
      router.handleRoute();
    }
  }

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
