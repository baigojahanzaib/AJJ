import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity, Platform } from 'react-native';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    visible: boolean;
    message: string;
    type: ToastType;
    onHide: () => void;
    duration?: number;
}

export default function Toast({ visible, message, type, onHide, duration = 3000 }: ToastProps) {
    const insets = useSafeAreaInsets();
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-20)).current;

    useEffect(() => {
        if (visible) {
            // Show
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();

            const timer = setTimeout(() => {
                handleHide();
            }, duration);

            return () => clearTimeout(timer);
        } else {
            // Hide immediately if visible becomes false prop-side (though usually handled by onHide)
            // logic is handled in handleHide mostly
        }
    }, [visible, duration]);

    const handleHide = () => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: -20,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onHide();
        });
    };

    if (!visible) return null;

    const getIcon = () => {
        const size = 20;
        switch (type) {
            case 'success':
                return <CheckCircle size={size} color={Colors.light.success} />;
            case 'error':
                return <AlertCircle size={size} color={Colors.light.danger} />;
            default:
                return <Info size={size} color={Colors.light.info} />;
        }
    };

    const getBackgroundColor = () => {
        // Using a solid background for readability
        return Colors.light.surface;
    };

    const getBorderColor = () => {
        switch (type) {
            case 'success': return Colors.light.success;
            case 'error': return Colors.light.danger;
            default: return Colors.light.info;
        }
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    top: insets.top + 10,
                    opacity,
                    transform: [{ translateY }],
                    borderColor: getBorderColor(),
                },
            ]}
        >
            <View style={styles.content}>
                <View style={styles.iconContainer}>{getIcon()}</View>
                <Text style={styles.message}>{message}</Text>
            </View>
            <TouchableOpacity onPress={handleHide} style={styles.closeButton}>
                <X size={16} color={Colors.light.textTertiary} />
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 20,
        right: 20,
        backgroundColor: 'white',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderLeftWidth: 4,
        zIndex: 9999,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        marginRight: 12,
    },
    message: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1a1a1a',
        flex: 1,
    },
    closeButton: {
        padding: 4,
        marginLeft: 12,
    },
});
