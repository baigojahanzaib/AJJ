import { View, Text, TouchableOpacity } from 'react-native';
import { useOffline } from '@/contexts/OfflineContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WifiOff, CloudUpload } from 'lucide-react-native';

export function OfflineBanner() {
    const { isOfflineMode, pendingOrdersCount, isSyncing, syncPendingOrders } = useOffline();

    if (!isOfflineMode && pendingOrdersCount === 0) return null;

    return (
        <View className={`${isOfflineMode ? 'bg-zinc-800' : 'bg-blue-600'} px-4 py-2 absolute bottom-20 left-4 right-4 rounded-lg shadow-lg z-50 flex-row items-center justify-between`}>
            <View className="flex-row items-center flex-1">
                {isOfflineMode ? (
                    <WifiOff size={20} color="white" />
                ) : (
                    <CloudUpload size={20} color="white" />
                )}
                <View className="ml-3">
                    <Text className="text-white font-medium">
                        {isOfflineMode ? 'You are offline' : isSyncing ? 'Syncing data...' : 'Back online'}
                    </Text>
                    <Text className="text-white/80 text-xs">
                        {isOfflineMode
                            ? `${pendingOrdersCount > 0 ? `${pendingOrdersCount} orders pending sync` : 'Using cached data'}`
                            : isSyncing
                                ? `Syncing ${pendingOrdersCount} pending orders`
                                : `${pendingOrdersCount} orders waiting to sync`}
                    </Text>
                </View>
            </View>

            {!isOfflineMode && pendingOrdersCount > 0 && !isSyncing && (
                <TouchableOpacity
                    onPress={syncPendingOrders}
                    className="bg-white/20 px-3 py-1.5 rounded"
                >
                    <Text className="text-white text-xs font-bold">Sync Now</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
