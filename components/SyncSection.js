import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import syncService from '../utils/syncService';
import { AuthContext } from '../context/AuthContext';
import NetInfo from '@react-native-community/netinfo';

const SyncSection = ({ count }) => {
    const { user } = useContext(AuthContext);
    const [isOnline, setIsOnline] = useState(true);
    const [lastSync, setLastSync] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    
    useEffect(() => {
        // Subscribe to network state updates
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected);
        });

        // Start automatic sync if user is logged in
        if (user) {
            syncService.init().then(() => {
                syncService.startSync();
            });
        }

        return () => {
            unsubscribe();
            syncService.stopSync();
        };
    }, [user]);

    const handleManualSync = async () => {
        if (isSyncing) return;
        
        setIsSyncing(true);
        try {
            await syncService.syncData();
            setLastSync(new Date());
        } catch (error) {
            console.error('Manual sync failed:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    if (!user) return null;

    return (
        <View style={styles.container}>
            <View style={styles.infoContainer}>
                <Text style={styles.countText}>Penugasan ({count})</Text>
                <Text style={[styles.statusText, !isOnline && styles.offlineText]}>
                    {isOnline ? 'Online' : 'Offline'}
                </Text>
            </View>
            {lastSync && (
                <Text style={styles.syncText}>
                    Last sync: {lastSync.toLocaleTimeString()}
                </Text>
            )}
            <TouchableOpacity 
                style={[styles.syncButton, !isOnline && styles.disabledButton]}
                onPress={handleManualSync}
                disabled={!isOnline || isSyncing}
            >
                <Icon 
                    name={isSyncing ? "sync" : "sync"} 
                    size={24} 
                    color="#fff"
                    style={isSyncing && styles.rotating} 
                />
                <Text style={styles.buttonText}>
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        margin: 16,
        elevation: 2,
    },
    infoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    countText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    statusText: {
        fontSize: 14,
        color: '#4CAF50',
        fontWeight: '500',
    },
    offlineText: {
        color: '#f44336',
    },
    syncText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
    },
    syncButton: {
        backgroundColor: '#4CAF50',
        padding: 12,
        borderRadius: 6,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    rotating: {
        transform: [{ rotate: '360deg' }],
    },
});

export default SyncSection;