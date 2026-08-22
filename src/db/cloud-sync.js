// ─── Supabase Cloud Sync Module ───
// Syncs local IndexedDB data to Supabase cloud database

import { createClient } from '@supabase/supabase-js';

const CONFIG_KEY = 'money_love_hers_supabase_config';
const DEVICE_ID_KEY = 'money_love_hers_device_id';

let supabase = null;
let syncEnabled = false;
let isSyncing = false;
let syncStatusCallback = null;

// ─── Generate unique device ID ───
function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// ─── Config Management ───
export function saveSupabaseConfig(url, anonKey) {
  const config = { url, anonKey };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  return initSupabase();
}

export function getSupabaseConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSupabaseConfig() {
  localStorage.removeItem(CONFIG_KEY);
  supabase = null;
  syncEnabled = false;
}

export function isSyncEnabled() {
  return syncEnabled;
}

export function onSyncStatus(callback) {
  syncStatusCallback = callback;
}

function updateSyncStatus(status, message = '') {
  if (syncStatusCallback) {
    syncStatusCallback({ status, message, timestamp: new Date().toISOString() });
  }
}

// ─── Initialize Supabase Client ───
export function initSupabase() {
  const config = getSupabaseConfig();
  if (!config || !config.url || !config.anonKey) {
    syncEnabled = false;
    return false;
  }

  try {
    supabase = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    syncEnabled = true;
    console.log('✅ Supabase connected');
    updateSyncStatus('connected', 'Đã kết nối cloud');
    return true;
  } catch (err) {
    console.error('❌ Supabase init error:', err);
    syncEnabled = false;
    updateSyncStatus('error', 'Lỗi kết nối: ' + err.message);
    return false;
  }
}

// ─── Create tables if not exist (via RPC or direct) ───
export async function setupTables() {
  if (!supabase || !syncEnabled) return false;

  try {
    // Test connection by reading from wallets table
    const { data, error } = await supabase.from('wallets').select('id').limit(1);
    if (error && error.code === '42P01') {
      // Table doesn't exist — user needs to run SQL migration
      updateSyncStatus('setup_needed', 'Cần tạo bảng trong Supabase');
      return false;
    }
    if (error && error.message?.includes('does not exist')) {
      updateSyncStatus('setup_needed', 'Cần tạo bảng trong Supabase');
      return false;
    }
    if (error) {
      console.error('Table check error:', error);
      updateSyncStatus('error', error.message);
      return false;
    }
    updateSyncStatus('ready', 'Cloud sẵn sàng');
    return true;
  } catch (err) {
    updateSyncStatus('error', err.message);
    return false;
  }
}

// ─── Full Sync: Push all local data to cloud ───
export async function pushToCloud(localData) {
  if (!supabase || !syncEnabled || isSyncing) return { success: false, message: 'Cloud chưa được thiết lập hoặc đang bận' };

  isSyncing = true;
  updateSyncStatus('syncing', 'Đang đồng bộ lên cloud...');

  const deviceId = getDeviceId();

  try {
    // Upsert each table's data
    for (const tableName of ['wallets', 'categories', 'transactions', 'budgets']) {
      const items = localData[tableName] || [];
      if (items.length === 0) continue;

      // Add device_id and sync metadata
      const records = items.map(item => ({
        ...item,
        local_id: item.id,
        device_id: deviceId,
        synced_at: new Date().toISOString()
      }));

      // Delete existing records for this device, then insert fresh
      await supabase
        .from(tableName)
        .delete()
        .eq('device_id', deviceId);

      // Insert in batches of 100
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error } = await supabase.from(tableName).insert(batch);
        if (error) {
          console.error(`Error syncing ${tableName}:`, error);
          throw error;
        }
      }
    }

    // Update sync metadata
    const { error: metaError } = await supabase.from('sync_metadata').upsert({
      device_id: deviceId,
      last_sync: new Date().toISOString(),
      data_hash: simpleHash(JSON.stringify(localData)),
      record_counts: {
        wallets: (localData.wallets || []).length,
        categories: (localData.categories || []).length,
        transactions: (localData.transactions || []).length,
        budgets: (localData.budgets || []).length
      }
    }, { onConflict: 'device_id' });

    if (metaError && !metaError.message?.includes('does not exist')) {
      console.warn('Sync metadata update warning:', metaError);
    }

    isSyncing = false;
    updateSyncStatus('synced', 'Đã đồng bộ lên cloud ✅');
    console.log('✅ Data pushed to cloud');
    return { success: true };
  } catch (err) {
    isSyncing = false;
    updateSyncStatus('error', 'Lỗi đồng bộ: ' + err.message);
    console.error('❌ Push to cloud error:', err);
    return { success: false, message: err.message || 'Lỗi không xác định' };
  }
}

// ─── Pull from cloud: Restore data ───
export async function pullFromCloud() {
  if (!supabase || !syncEnabled) return null;

  const deviceId = getDeviceId();
  updateSyncStatus('syncing', 'Đang tải dữ liệu từ cloud...');

  try {
    const result = {};

    for (const tableName of ['wallets', 'categories', 'transactions', 'budgets']) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('device_id', deviceId);

      if (error) {
        if (error.message?.includes('does not exist')) {
          updateSyncStatus('setup_needed', 'Cần tạo bảng');
          return null;
        }
        throw error;
      }

      // Restore original local IDs
      result[tableName] = (data || []).map(item => {
        const { local_id, device_id, synced_at, ...rest } = item;
        return { ...rest, id: local_id };
      });
    }

    updateSyncStatus('synced', 'Đã tải dữ liệu từ cloud ✅');
    return result;
  } catch (err) {
    updateSyncStatus('error', 'Lỗi tải dữ liệu: ' + err.message);
    console.error('❌ Pull from cloud error:', err);
    return null;
  }
}

// ─── Test connection ───
export async function testConnection() {
  if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase' };

  try {
    const { data, error } = await supabase.from('wallets').select('id').limit(1);
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return { success: false, message: 'Bảng chưa được tạo. Vui lòng chạy SQL migration.' };
      }
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Kết nối thành công! ✅' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ─── Simple hash for change detection ───
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// ─── Get last sync info ───
export async function getLastSyncInfo() {
  if (!supabase || !syncEnabled) return null;
  const deviceId = getDeviceId();

  try {
    const { data, error } = await supabase
      .from('sync_metadata')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Auto-init on module load ───
initSupabase();
