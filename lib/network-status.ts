import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FIRST_LOAD_KEY = '@salesapp_first_load_date';

export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [isFirstLoad, setIsFirstLoad] = useState<boolean>(false);

    useEffect(() => {
        // Subscribe to network state updates
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            const online = state.isConnected ?? false;
            setIsOnline(online);
            console.log(`[NetworkStatus] Connection change: ${online ? 'Online' : 'Offline'}`);
        });

        // Check if this is the first load of the day
        checkFirstLoadOfDay();

        return () => {
            unsubscribe();
        };
    }, []);

    const checkFirstLoadOfDay = async () => {
        try {
            const today = new Date().toDateString();
            const lastLoadDate = await AsyncStorage.getItem(FIRST_LOAD_KEY);

            if (lastLoadDate !== today) {
                console.log('[NetworkStatus] First load of the day detected');
                setIsFirstLoad(true);
                await AsyncStorage.setItem(FIRST_LOAD_KEY, today);
            } else {
                setIsFirstLoad(false);
            }
        } catch (error) {
            console.error('[NetworkStatus] Error checking first load:', error);
        }
    };

    return { isOnline, isFirstLoad };
}
