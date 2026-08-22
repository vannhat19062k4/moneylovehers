// ─── localStorage Auto-Backup Layer ───
// Mirrors all IndexedDB data to localStorage as redundant backup

const BACKUP_KEY = 'money_love_hers_backup';
const BACKUP_TIMESTAMP_KEY = 'money_love_hers_backup_time';

export function saveToLocalStorage(data) {
  try {
    const backup = {
      version: 1,
      timestamp: new Date().toISOString(),
      data
    };
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    localStorage.setItem(BACKUP_TIMESTAMP_KEY, backup.timestamp);
    return true;
  } catch (err) {
    console.warn('⚠️ localStorage backup failed:', err);
    return false;
  }
}

export function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ localStorage restore failed:', err);
    return null;
  }
}

export function getLastBackupTime() {
  return localStorage.getItem(BACKUP_TIMESTAMP_KEY) || null;
}

export function clearLocalStorageBackup() {
  localStorage.removeItem(BACKUP_KEY);
  localStorage.removeItem(BACKUP_TIMESTAMP_KEY);
}
