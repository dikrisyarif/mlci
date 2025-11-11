import { getDb } from './core';

export const addCheckin = async (checkinData) => {
  const { lease_no, employee_name, latitude, longitude, timestamp, comment } = checkinData;
  //console.log('[Database] Saving check-in to local database:', checkinData);
  
  try {
    const db = await getDb();
    if (!db || !db.runAsync) {
      throw new Error('Database not properly initialized');
    }

    // First check if this contract has already been checked in today
    const isAlreadyCheckedIn = await isContractCheckedIn(lease_no, employee_name);
    if (isAlreadyCheckedIn) {
      //console.log('[Database] Contract already checked in today:', lease_no);
      throw new Error('Contract has already been checked in today');
    }

    // If not checked in, proceed with saving
    const result = await db.runAsync(
      `INSERT INTO contract_checkins (
        lease_no, 
        employee_name, 
        latitude, 
        longitude, 
        timestamp, 
        comment,
        is_uploaded
      ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [lease_no, employee_name, latitude, longitude, timestamp, comment || '', 0]
    );
    //console.log('[Database] Check-in saved with ID:', result?.lastInsertRowId);
    return result?.lastInsertRowId;
  } catch (error) {
    console.error('[Database] Error saving check-in:', error);
    throw error;
  }
};

export const getUnuploadedCheckins = async () => {
  try {
    const db = await getDb();
    if (!db || !db.getAllAsync) {
      throw new Error('Database not properly initialized');
    }
    
    //console.log('[Database] Getting unuploaded check-ins...');
    const results = await db.getAllAsync(
      'SELECT * FROM contract_checkins WHERE is_uploaded = 0 ORDER BY timestamp ASC;'
    );
    //console.log('[Database] Found unuploaded check-ins:', results?.length);
    return results || [];
  } catch (error) {
    console.error('[Database] Error getting unuploaded check-ins:', error);
    throw error;
  }
};

export const isContractCheckedIn = async (leaseNo, employeeName) => {
  try {
    const db = await getDb();
    if (!db || !db.getFirstAsync) {
      throw new Error('Database not properly initialized');
    }

    // Skip check for special tracking check-ins
    if (leaseNo === '_tracking_') {
      return false;
    }

    const today = new Date().toISOString().split('T')[0];
    //console.log('[Database] Checking if contract is already checked in:', { leaseNo, employeeName, date: today });
    
    const result = await db.getFirstAsync(
      `SELECT id, timestamp, comment, is_uploaded 
       FROM contract_checkins 
       WHERE lease_no = ? 
         AND lease_no != '_tracking_'
         AND employee_name = ? 
         AND date(timestamp) = date(?);`,
      [leaseNo, employeeName, today]
    );
    
    //console.log('[Database] Contract check-in status:', {
    //   leaseNo,
    //   isCheckedIn: result !== null,
    //   checkinDetails: result
    // });
    
    return result !== null;
  } catch (error) {
    console.error('[Database] Error checking contract check-in status:', error);
    throw error;
  }
};

export const markCheckinAsUploaded = async (id) => {
  try {
    const db = await getDb();
    if (!db || !db.runAsync) {
      throw new Error('Database not properly initialized');
    }

    //console.log('[Database] Marking check-in as uploaded:', id);
    await db.runAsync(
      'UPDATE contract_checkins SET is_uploaded = 1 WHERE id = ?;',
      [id]
    );
    //console.log('[Database] Check-in marked as uploaded successfully');
    return true;
  } catch (error) {
    console.error('[Database] Error marking check-in as uploaded:', error);
    throw error;
  }
};

export const getContractCheckinDetails = async (leaseNo, employeeName) => {
  try {
    const db = await getDb();
    if (!db || !db.getFirstAsync) {
      throw new Error('Database not properly initialized');
    }

    const today = new Date().toISOString().split('T')[0];
    //console.log('[Database] Getting contract check-in details:', { leaseNo, employeeName, date: today });
    
    const result = await db.getFirstAsync(
      `SELECT id, lease_no, employee_name, latitude, longitude, 
              timestamp, comment, is_uploaded
       FROM contract_checkins 
       WHERE lease_no = ? 
         AND employee_name = ? 
         AND date(timestamp) = date(?);`,
      [leaseNo, employeeName, today]
    );
    
    //console.log('[Database] Contract check-in details:', result);
    return result;
  } catch (error) {
    console.error('[Database] Error getting contract check-in details:', error);
    throw error;
  }
};