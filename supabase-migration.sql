-- ============================================================
-- Money Love Hers — Supabase SQL Migration (With Google Auth & UUIDs)
-- Chạy SQL này trong Supabase Dashboard > SQL Editor
-- ============================================================

-- 0. Xóa các bảng cũ (để tạo lại với cấu trúc mới chứa user_id và TEXT id)
-- LƯU Ý: Dữ liệu local của bạn (trên trình duyệt) vẫn an toàn và sẽ được đồng bộ lên lại sau khi đăng nhập.
DROP TABLE IF EXISTS sync_metadata CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;

-- 1. Bảng ví (wallets)
CREATE TABLE wallets (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'cash',
  balance DOUBLE PRECISION DEFAULT 0,
  icon TEXT DEFAULT '💵',
  color TEXT DEFAULT '#F59E0B',
  "createdAt" TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng danh mục (categories)
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  type TEXT DEFAULT 'expense',
  "parentId" TEXT,
  "order" INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng giao dịch (transactions)
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT,
  "walletId" TEXT,
  "categoryId" TEXT,
  type TEXT DEFAULT 'expense',
  amount DOUBLE PRECISION DEFAULT 0,
  note TEXT,
  date TEXT,
  "createdAt" TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng ngân sách (budgets)
CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT,
  "categoryId" TEXT,
  amount DOUBLE PRECISION DEFAULT 0,
  spent DOUBLE PRECISION DEFAULT 0,
  period TEXT DEFAULT 'monthly',
  "startDate" TEXT,
  "endDate" TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bảng sync metadata
CREATE TABLE sync_metadata (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  last_sync TIMESTAMPTZ DEFAULT NOW(),
  data_hash TEXT,
  record_counts JSONB DEFAULT '{}'::jsonb
);

-- 6. Indexes cho performance
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);

-- 7. Xóa Policies cũ (nếu có)
DROP POLICY IF EXISTS "Allow all access on wallets" ON wallets;
DROP POLICY IF EXISTS "Allow all access on categories" ON categories;
DROP POLICY IF EXISTS "Allow all access on transactions" ON transactions;
DROP POLICY IF EXISTS "Allow all access on budgets" ON budgets;
DROP POLICY IF EXISTS "Allow all access on sync_metadata" ON sync_metadata;

-- 8. Enable Row Level Security (RLS)
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies — Chỉ cho phép user thao tác trên dữ liệu CỦA HỌ
CREATE POLICY "Users can manage their own wallets" ON wallets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own categories" ON categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own budgets" ON budgets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sync_metadata" ON sync_metadata
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ✅ DONE! Chạy xong SQL này là xong setup database.
