import { getDb } from './core';

export const saveContracts = async (contracts, employeeName) => {
  console.log('[DB][saveContracts] Menyimpan kontrak untuk:', employeeName, '| Jumlah:', contracts.length);
  
  try {
    const db = await getDb();
    if (!db || !db.runAsync || !db.getFirstAsync) {
      console.error('[Database] DB instance not ready:', { db });
      throw new Error('Database not properly initialized');
    }

    // Start transaction
    await db.execAsync('BEGIN TRANSACTION;');
    
    try {
      const contractsJson = JSON.stringify(contracts);

      // Delete old data within transaction
      await db.runAsync(
        'DELETE FROM contracts WHERE employee_name = ?;',
        [employeeName]
      );

      // Save new data within transaction
      await db.runAsync(
        'INSERT INTO contracts (contract_data, employee_name) VALUES (?, ?);',
        [contractsJson, employeeName]
      );

      // Commit transaction
      await db.execAsync('COMMIT;');

      // Verify data was saved successfully
      const verifyData = await getContracts(employeeName);
      if (!verifyData || verifyData.length === 0) {
        throw new Error('Verification failed: Data not saved');
      }

      console.log('[Database] Kontrak berhasil disimpan ke database lokal');
      return true;
    } catch (error) {
      // Rollback on error
      await db.execAsync('ROLLBACK;');
      console.error('[Database] Error in transaction:', error);
      throw error;
    }
  } catch (error) {
    console.error('[Database] Error menyimpan kontrak:', error);
    throw error;
  }
};

export const getContracts = async (employeeName) => {
  console.log('[DB][getContracts] Mengambil kontrak untuk:', employeeName);
  
  try {
    const db = await getDb();
    if (!db || !db.getFirstAsync) {
      console.error('[Database] DB instance not ready (getContracts):', { db });
      throw new Error('Database not properly initialized');
    }

    const result = await db.getFirstAsync(
      'SELECT contract_data FROM contracts WHERE employee_name = ?;',
      [employeeName]
    );

    if (result && result.contract_data) {
      try {
        const contracts = JSON.parse(result.contract_data);
        console.log('[DB][getContracts] Data kontrak ditemukan:', contracts.length);
        return contracts;
      } catch (parseError) {
        console.error('[DB][getContracts] Error parsing contract data:', parseError);
        return [];
      }
    } else {
      console.log('[DB][getContracts] Tidak ada kontrak tersimpan untuk:', employeeName);
      return [];
    }
  } catch (error) {
    console.error('[Database] Error mengambil kontrak:', error);
    return [];
  }
};