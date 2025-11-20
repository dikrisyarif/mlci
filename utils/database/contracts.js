import { executeWithLog } from './core';
import { saveAppState } from './state';

/**
 * ✅ Save contracts for a specific employee
 */
export const saveContracts = async (contracts, employeeName) => {
  console.log('[DB][saveContracts] Saving contracts for:', employeeName, '| Count:', contracts?.length ?? 0);

  if (!employeeName) {
    // console.error('[DB][saveContracts] ❌ employeeName kosong, batal simpan!');
    return;
  }

  if (!Array.isArray(contracts)) {
    // console.error('[DB][saveContracts] ❌ contracts bukan array!');
    return;
  }

  try {
    await executeWithLog('execAsync', 'BEGIN;', []);

    // Hapus kontrak lama
    await executeWithLog('runAsync', 'DELETE FROM contracts WHERE employee_name = ?;', [employeeName]);

    // Simpan kontrak baru
    for (const c of contracts) {
      await executeWithLog(
        'runAsync',
        'INSERT INTO contracts (contract_data, employee_name) VALUES (?, ?);',
        [JSON.stringify(c), employeeName]
      );
    }

    await executeWithLog('execAsync', 'COMMIT;', []);

    console.log(`[DB][saveContracts] ✅ Saved ${contracts.length} contracts for ${employeeName}`);
    await saveAppState(`last_contract_sync_${employeeName}`, new Date().toISOString());
  } catch (error) {
    // console.error('[DB][saveContracts] ❌ Error:', error);
    try {
      await executeWithLog('execAsync', 'ROLLBACK;', []);
    } catch (_) {}
  }
};

/**
 * ✅ Read contracts for specific employee
 */
export const getContracts = async (employeeName) => {
  console.log('[DB][getContracts] Reading contracts for:', employeeName);

  try {
    const rows = await executeWithLog(
      'getAllAsync',
      'SELECT contract_data FROM contracts WHERE employee_name = ?;',
      [employeeName]
    );

    if (!rows || rows.length === 0) {
      console.log('[DB][getContracts] Empty.');
      return [];
    }

    const list = rows
      .map(r => {
        try {
          return JSON.parse(r.contract_data);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    console.log('[DB][getContracts] Found:', list.length);
    return list;
  } catch (error) {
    // console.error('[DB][getContracts] Error:', error);
    return [];
  }
};

/**
 * ✅ Debug helper: ambil semua raw rows dari tabel contracts
 */
export const getContractsRaw = async () => {
  try {
    const rows = await executeWithLog(
      'getAllAsync',
      'SELECT id, contract_data, employee_name FROM contracts;',
      []
    );
    return rows || [];
  } catch (err) {
    // console.error('[DB][getContractsRaw] Error:', err);
    return [];
  }
};

/**
 * ✅ Clear all local contract data
 */
export const clearContracts = async () => {
  try {
    console.log('[DB][clearContracts] Clearing all contract data...');
    await executeWithLog('runAsync', 'DELETE FROM contracts;', []);
    console.log('[DB][clearContracts] Done.');
    return true;
  } catch (err) {
    // console.error('[DB][clearContracts] Error:', err);
    return false;
  }
};

/**
 * ✅ Update comment dalam contract_data JSON
 */
export const updateContractComment = async (leaseNo, comment, employeeName) => {
  try {
    const rows = await executeWithLog(
      'getAsync',
      'SELECT id, contract_data FROM contracts WHERE employee_name = ?;',
      [employeeName]
    );

    if (!rows) return false;

    for (const row of Array.isArray(rows) ? rows : [rows]) {
      const data = JSON.parse(row.contract_data || '{}');
      if (data.LeaseNo === leaseNo) {
        data.comment = comment;
        await executeWithLog(
          'runAsync',
          'UPDATE contracts SET contract_data = ? WHERE id = ?;',
          [JSON.stringify(data), row.id]
        );
        console.log(`[DB][updateContractComment] Updated comment for ${leaseNo}`);
        return true;
      }
    }

    return false;
  } catch (err) {
    // console.error('[DB][updateContractComment] Error:', err);
    return false;
  }
};

/**
 * ✅ Update isCheckedIn flag dalam contract_data JSON
 */
export const updateContractFlag = async (leaseNo, isCheckedIn, employeeName) => {
  try {
    // 🔹 Ganti 'getAsync' → 'getAllAsync'
    const rows = await executeWithLog(
      'getAllAsync',
      'SELECT id, contract_data FROM contracts WHERE employee_name = ?;',
      [employeeName]
    );

    if (!rows || rows.length === 0) {
      console.warn('[DB][updateContractFlag] No contract found for', employeeName);
      return false;
    }

    for (const row of rows) {
      let data = {};
      try {
        data = JSON.parse(row.contract_data || '{}');
      } catch (err) {
        console.warn('[DB][updateContractFlag] JSON parse failed:', err);
        continue;
      }

      if (data.LeaseNo === leaseNo) {
        data.isCheckedIn = !!isCheckedIn;

        await executeWithLog(
          'runAsync',
          'UPDATE contracts SET contract_data = ? WHERE id = ?;',
          [JSON.stringify(data), row.id]
        );

        console.log(`[DB][updateContractFlag] ✅ Updated isCheckedIn for ${leaseNo}`);
        return true;
      }
    }

    console.warn('[DB][updateContractFlag] LeaseNo not found:', leaseNo);
    return false;
  } catch (err) {
    // console.error('[DB][updateContractFlag] Error:', err);
    return false;
  }
};

