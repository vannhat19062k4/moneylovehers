// ─── Supabase Cloud Sync Module (With Auth) ───
// Syncs local IndexedDB data to Supabase cloud database

import { createClient } from '@supabase/supabase-js';

const CONFIG_KEY = 'money_love_hers_supabase_config';
const DEVICE_ID_KEY = 'money_love_hers_device_id';

// Read from .env file
const ENV_URL = import.meta.env?.VITE_SUPABASE_URL || '';
const ENV_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export let supabase = null;
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
  const url = ENV_URL || getSupabaseConfig()?.url;
  const key = ENV_KEY || getSupabaseConfig()?.anonKey;

  if (!url || !key) {
    syncEnabled = false;
    return false;
  }

  try {
    // Enable auth persistence
    supabase = createClient(url, key);
    syncEnabled = true;
    console.log('✅ Supabase connected (Auth enabled)');
    updateSyncStatus('connected', 'Đã kết nối cloud');
    return true;
  } catch (err) {
    console.error('❌ Supabase init error:', err);
    syncEnabled = false;
    updateSyncStatus('error', 'Lỗi kết nối: ' + err.message);
    return false;
  }
}

// ─── Authentication ───
export async function signInWithGoogle() {
  if (!supabase) return { error: new Error('Chưa cấu hình Supabase') };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  return { data, error };
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return data?.session || null;
}

// ─── Sync Logic ───
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// ─── Full Sync: Push all local data to cloud ───
export async function pushToCloud(localData) {
  if (!supabase || !syncEnabled || isSyncing) return { success: false, message: 'Cloud chưa cấu hình hoặc đang bận' };

  const session = await getSession();
  if (!session) return { success: false, message: 'Bạn chưa đăng nhập' };

  isSyncing = true;
  updateSyncStatus('syncing', 'Đang đồng bộ lên cloud...');
  const deviceId = getDeviceId();
  const userId = session.user.id;

  try {
    // Upsert each table's data
    for (const tableName of ['wallets', 'categories', 'transactions', 'budgets']) {
      const items = localData[tableName] || [];
      if (items.length === 0) continue;

      // Ensure every record has a unique String ID for cloud merging
      const records = items.map(item => ({
        ...item,
        id: typeof item.id === 'string' ? item.id : `${deviceId}_${item.id}`,
        user_id: userId,
        device_id: deviceId,
        synced_at: new Date().toISOString()
      }));

      // Insert/Upsert in batches of 100
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error } = await supabase.from(tableName).upsert(batch, { onConflict: 'id' });
        if (error) {
          console.error(`Error syncing ${tableName}:`, error);
          throw error;
        }
      }
    }

    // Update sync metadata
    const { error: metaError } = await supabase.from('sync_metadata').upsert({
      user_id: userId,
      last_sync: new Date().toISOString(),
      data_hash: simpleHash(JSON.stringify(localData)),
      record_counts: {
        wallets: (localData.wallets || []).length,
        categories: (localData.categories || []).length,
        transactions: (localData.transactions || []).length,
        budgets: (localData.budgets || []).length
      }
    }, { onConflict: 'user_id' });

    if (metaError) console.warn('Sync metadata error:', metaError);

    isSyncing = false;
    updateSyncStatus('synced', 'Đã đồng bộ lên cloud ✅');
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

  const session = await getSession();
  if (!session) return null;

  updateSyncStatus('syncing', 'Đang tải dữ liệu từ cloud...');
  const userId = session.user.id;

  try {
    const result = {};

    for (const tableName of ['wallets', 'categories', 'transactions', 'budgets']) {
      // Because RLS is active, we just pull everything, but eq('user_id') is safer.
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      
      // Clean up fields before saving locally
      result[tableName] = (data || []).map(item => {
        const { user_id, device_id, synced_at, ...localFields } = item;
        return localFields;
      });
    }

    updateSyncStatus('synced', 'Đã tải dữ liệu từ cloud ✅');
    return result;
  } catch (err) {
    console.error('❌ Pull from cloud error:', err);
    updateSyncStatus('error', 'Lỗi tải dữ liệu: ' + err.message);
    return null;
  }
}

export async function getLastSyncInfo() {
  if (!supabase || !syncEnabled) return null;
  const session = await getSession();
  if (!session) return null;

  try {
    const { data, error } = await supabase
      .from('sync_metadata')
      .select('last_sync')
      .eq('user_id', session.user.id)
      .single();
    if (error) return null;
    return data?.last_sync;
  } catch {
    return null;
  }
}

export async function setupTables() {
  // Mock check, since we don't have RPC
  return true;
}
