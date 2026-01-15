import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, Dimensions, FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

interface FullScreenImageModalProps {
    visible: boolean;
    images: string[];
    initialIndex: number;
    onClose: () => void;
}

export default function FullScreenImageModal({ visible, images, initialIndex, onClose }: FullScreenImageModalProps) {
    const flatListRef = useRef<FlatList>(null);
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
    const insets = useSafeAreaInsets();

    // Sync local index when prop changes or modal opens
    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex);
            // Wait for layout/render before scrolling
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                    index: initialIndex,
                    animated: false,
                });
            }, 50);
        }
    }, [visible, initialIndex]);

    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        const index = event.nativeEvent.contentOffset.x / slideSize;
        const roundIndex = Math.round(index);
        setCurrentIndex(roundIndex);
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={[styles.headerContainer, { top: insets.top + 10 }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X color="#fff" size={28} />
                    </TouchableOpacity>
                    <Text style={styles.counter}>
                        {currentIndex + 1} / {images.length}
                    </Text>
                    <View style={styles.placeholder} />
                </View>

                <FlatList
                    ref={flatListRef}
                    data={images}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={onScroll}
                    keyExtractor={(_, index) => index.toString()}
                    getItemLayout={(_, index) => ({
                        length: screenWidth,
                        offset: screenWidth * index,
                        index,
                    })}
                    renderItem={({ item }) => (
                        <View style={{ width: screenWidth, height: screenHeight, justifyContent: 'center', alignItems: 'center' }}>
                            <Image
                                source={{ uri: item }}
                                style={{ width: screenWidth, height: screenHeight * 0.7 }}
                                contentFit="contain"
                            />
                        </View>
                    )}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    headerContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    closeButton: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    counter: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    placeholder: {
        width: 44, // Matches close button size approx
    },
});
