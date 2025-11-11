import { getDb } from './core';

export const saveContracts = async (contracts, employeeName) => {
  //console.log('[Database] Menyimpan kontrak untuk:', employeeName);
  //console.log('[Database] Jumlah kontrak yang akan disimpan:', contracts.length);
  
  try {
    const db = await getDb();
    if (!db || !db.runAsync || !db.getFirstAsync) {
      throw new Error('Database not properly initialized');
    }

    const contractsJson = JSON.stringify(contracts);
    
    // Ambil data yang ada sebelum menghapus
    const existingData = await getContracts(employeeName);
    //console.log('[Database] Data kontrak yang sudah ada:', existingData.length);
    
    // Hapus data lama
    await db.runAsync(
      'DELETE FROM contracts WHERE employee_name = ?;',
      [employeeName]
    );
    
    // Simpan data baru
    await db.runAsync(
      'INSERT INTO contracts (contract_data, employee_name) VALUES (?, ?);',
      [contractsJson, employeeName]
    );
    
    //console.log('[Database] Kontrak berhasil disimpan ke database lokal');
    return true;
  } catch (error) {
    console.error('[Database] Error menyimpan kontrak:', error);
    throw error;
  }
};

export const getContracts = async (employeeName) => {
  //console.log('[Database] Mengambil kontrak untuk:', employeeName);
  
  try {
    const db = await getDb();
    if (!db || !db.getFirstAsync) {
      throw new Error('Database not properly initialized');
    }

    const result = await db.getFirstAsync(
      'SELECT contract_data FROM contracts WHERE employee_name = ?;',
      [employeeName]
    );
    
    if (result && result.contract_data) {
      try {
        const contracts = JSON.parse(result.contract_data);
        //console.log('[Database] Berhasil mengambil', contracts.length, 'kontrak dari database lokal');
        return contracts;
      } catch (parseError) {
        console.error('[Database] Error parsing contract data:', parseError);
        return [];
      }
    } else {
      //console.log('[Database] Tidak ada kontrak tersimpan untuk:', employeeName);
      return [];
    }
  } catch (error) {
    // console.error('[Database] Error mengambil kontrak:', error);
    return [];
  }
};