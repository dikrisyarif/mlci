import { scheduleMidnightCleanup } from '../utils/scheduledTasks';
import * as Database from '../utils/database';

export async function initializeApp(employeeName) {
    // Make sure database is initialized
    await Database.initDatabase();

    // Schedule midnight cleanup
    await scheduleMidnightCleanup(employeeName);

    //console.log('App initialized with scheduled midnight cleanup');
}