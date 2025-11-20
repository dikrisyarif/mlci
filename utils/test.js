import { scheduleMidnightCleanup } from './utils/scheduledTasks';

// Just a test function to verify imports
export const test = async () => {
    try {
        //console.log('Testing imports...');
        await scheduleMidnightCleanup('test');
        //console.log('Imports working correctly');
    } catch (error) {
        // console.error('Import test failed:', error);
    }
};