-- ============================================================
-- Money Love Hers — Supabase SQL Migration
-- Chạy SQL này trong Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Bảng ví (wallets)
CREATE TABLE IF NOT EXISTS wallets (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'cash',
  balance DOUBLE PRECISION DEFAULT 0,
  icon TEXT DEFAULT '💵',
  color TEXT DEFAULT '#F59E0B',
  "createdAt" TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng danh mục (categories)
CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  type TEXT DEFAULT 'expense',
  "parentId" INTEGER,
  "order" INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng giao dịch (transactions)
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER,
  device_id TEXT NOT NULL,
  "walletId" INTEGER,
  "categoryId" INTEGER,
  type TEXT DEFAULT 'expense',
  amount DOUBLE PRECISION DEFAULT 0,
  note TEXT,
  date TEXT,
  "createdAt" TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng ngân sách (budgets)
CREATE TABLE IF NOT EXISTS budgets (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER,
  device_id TEXT NOT NULL,
  "categoryId" INTEGER,
  amount DOUBLE PRECISION DEFAULT 0,
  spent DOUBLE PRECISION DEFAULT 0,
  period TEXT DEFAULT 'monthly',
  "startDate" TEXT,
  "endDate" TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bảng sync metadata
CREATE TABLE IF NOT EXISTS sync_metadata (
  device_id TEXT PRIMARY KEY,
  last_sync TIMESTAMPTZ DEFAULT NOW(),
  data_hash TEXT,
  record_counts JSONB DEFAULT '{}'::jsonb
);

-- 6. Indexes cho performance
CREATE INDEX IF NOT EXISTS idx_wallets_device ON wallets(device_id);
CREATE INDEX IF NOT EXISTS idx_categories_device ON categories(device_id);
CREATE INDEX IF NOT EXISTS idx_transactions_device ON transactions(device_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_budgets_device ON budgets(device_id);

-- 7. Enable Row Level Security (RLS) — BẮT BUỘC cho bảo mật
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies — Cho phép anonymous access (đơn giản cho personal app)
-- Nếu bạn muốn bảo mật hơn, có thể dùng auth.uid() thay vì true

CREATE POLICY "Allow all access on wallets" ON wallets
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access on categories" ON categories
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access on transactions" ON transactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access on budgets" ON budgets
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access on sync_metadata" ON sync_metadata
  FOR ALL USING (true) WITH CHECK (true);

-- ✅ DONE! Chạy xong SQL này là xong setup database.
