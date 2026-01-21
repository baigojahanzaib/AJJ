import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import {
    ArrowLeft, Edit2, Trash2, Package, Tag, Layers,
    Archive, X, Check
} from 'lucide-react-native';
import { useData } from '@/contexts/DataContext';
import Button from '@/components/Button';
import Badge from '@/components/Badge';
import Card from '@/components/Card';
import ThemedAlert from '@/components/ThemedAlert';
import Colors from '@/constants/colors';

export default function AdminProductDetail() {
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { getProductById, getCategoryById, updateProduct, deleteProduct } = useData();

    const product = getProductById(id || '');
    const category = product ? getCategoryById(product.categoryId) : null;

    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [showImageGallery, setShowImageGallery] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info' as 'success' | 'error' | 'warning' | 'info',
        buttons: [] as { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
    });

    if (!product) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={styles.notFound}>
                    <Package size={64} color={Colors.light.textTertiary} />
                    <Text style={styles.notFoundTitle}>Product Not Found</Text>
                    <Button title="Go Back" onPress={() => router.back()} variant="outline" />
                </View>
            </SafeAreaView>
        );
    }

    const handleEdit = () => {
        router.push(`/(admin)/add-product?productId=${product.id}`);
    };

    const handleToggleActive = () => {
        const newStatus = !product.isActive;
        setAlertConfig({
            visible: true,
            title: newStatus ? 'Activate Product' : 'Deactivate Product',
            message: newStatus
                ? 'This product will be visible in the catalog.'
                : 'This product will be hidden from the catalog.',
            type: 'warning',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: newStatus ? 'Activate' : 'Deactivate',
                    style: 'default',
                    onPress: () => {
                        updateProduct(product.id, { isActive: newStatus });
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                },
            ],
        });
    };

    const handleDelete = () => {
        setAlertConfig({
            visible: true,
            title: 'Delete Product',
            message: 'Are you sure you want to delete this product? This action cannot be undone.',
            type: 'warning',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        deleteProduct(product.id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        router.back();
                    }
                },
            ],
        });
    };

    const totalVariationOptions = product.variations.reduce((sum, v) => sum + v.options.length, 0);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <ArrowLeft size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Product Details</Text>
                <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
                    <Edit2 size={20} color={Colors.light.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setShowImageGallery(true)}
                >
                    <Image
                        source={{ uri: product.images[selectedImageIndex] || 'https://via.placeholder.com/400' }}
                        style={styles.mainImage}
                        contentFit="cover"
                    />
                    {product.images.length > 1 && (
                        <View style={styles.imageIndicator}>
                            <Text style={styles.imageIndicatorText}>
                                {selectedImageIndex + 1} / {product.images.length}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                {product.images.length > 1 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.thumbnailList}
                    >
                        {product.images.map((image, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.thumbnail,
                                    selectedImageIndex === index && styles.thumbnailActive
                                ]}
                                onPress={() => setSelectedImageIndex(index)}
                            >
                                <Image
                                    source={{ uri: image }}
                                    style={styles.thumbnailImage}
                                    contentFit="cover"
                                />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                <View style={styles.content}>
                    <View style={styles.titleRow}>
                        <View style={styles.titleContainer}>
                            <Text style={styles.productName}>{product.name}</Text>
                            <Text style={styles.productSku}>SKU: {product.sku}</Text>
                        </View>
                        <Badge
                            label={product.isActive ? 'Active' : 'Inactive'}
                            variant={product.isActive ? 'success' : 'default'}
                        />
                    </View>

                    <View style={styles.priceRow}>
                        <View style={styles.priceContainer}>
                            <Text style={styles.priceLabel}>Base Price</Text>
                            <Text style={styles.priceValue}>R{product.basePrice.toFixed(2)}</Text>
                        </View>
                        <View style={styles.stockContainer}>
                            <Text style={styles.stockLabel}>Stock</Text>
                            <Text style={[
                                styles.stockValue,
                                product.stock < 10 && styles.stockLow
                            ]}>
                                {product.stock} units
                            </Text>
                        </View>
                    </View>

                    <Card style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}>
                                <Tag size={18} color={Colors.light.primary} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Category</Text>
                                <Text style={styles.infoValue}>{category?.name || 'Uncategorized'}</Text>
                            </View>
                        </View>
                        <View style={styles.infoDivider} />
                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}>
                                <Layers size={18} color={Colors.light.primary} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Variations</Text>
                                <Text style={styles.infoValue}>
                                    {product.variations.length} type{product.variations.length !== 1 ? 's' : ''}, {totalVariationOptions} option{totalVariationOptions !== 1 ? 's' : ''}
                                </Text>
                            </View>
                        </View>
                    </Card>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Description</Text>
                        <Text style={styles.description}>{product.description}</Text>
                    </View>

                    {product.variations.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Variations</Text>
                            {product.variations.map((variation, index) => (
                                <Card key={variation.id} style={styles.variationCard}>
                                    <Text style={styles.variationName}>{variation.name}</Text>
                                    <View style={styles.optionsGrid}>
                                        {variation.options.map(option => (
                                            <View key={option.id} style={styles.optionItem}>
                                                {option.image && (
                                                    <Image
                                                        source={{ uri: option.image }}
                                                        style={styles.optionImage}
                                                        contentFit="cover"
                                                    />
                                                )}
                                                <View style={styles.optionInfo}>
                                                    <Text style={styles.optionName}>{option.name}</Text>
                                                    {option.priceModifier !== 0 && (
                                                        <Text style={styles.optionPrice}>
                                                            {option.priceModifier > 0 ? '+' : ''}R{option.priceModifier.toFixed(2)}
                                                        </Text>
                                                    )}
                                                    <Text style={styles.optionStock}>Stock: {option.stock}</Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </Card>
                            ))}
                        </View>
                    )}

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Actions</Text>
                        <View style={styles.actionsContainer}>
                            <Button
                                title={product.isActive ? 'Deactivate' : 'Activate'}
                                onPress={handleToggleActive}
                                variant="outline"
                                icon={product.isActive ? <Archive size={18} color={Colors.light.text} /> : <Check size={18} color={Colors.light.text} />}
                                style={styles.actionButton}
                            />
                            <Button
                                title="Delete Product"
                                onPress={handleDelete}
                                variant="outline"
                                icon={<Trash2 size={18} color={Colors.light.danger} />}
                                style={[styles.actionButton, styles.deleteButton]}
                                textStyle={styles.deleteButtonText}
                            />
                        </View>
                    </View>

                    <View style={{ height: Math.max(insets.bottom, 40) }} />
                </View>
            </ScrollView>

            <Modal
                visible={showImageGallery}
                animationType="fade"
                transparent
                onRequestClose={() => setShowImageGallery(false)}
            >
                <View style={styles.galleryOverlay}>
                    <TouchableOpacity
                        style={styles.galleryClose}
                        onPress={() => setShowImageGallery(false)}
                    >
                        <X size={28} color="#fff" />
                    </TouchableOpacity>
                    <FlatList
                        data={product.images}
                        horizontal
                        pagingEnabled
                        initialScrollIndex={selectedImageIndex}
                        getItemLayout={(_, index) => ({
                            length: 400,
                            offset: 400 * index,
                            index,
                        })}
                        showsHorizontalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <View style={styles.galleryImageContainer}>
                                <Image
                                    source={{ uri: item }}
                                    style={styles.galleryImage}
                                    contentFit="contain"
                                />
                            </View>
                        )}
                        keyExtractor={(_, index) => index.toString()}
                    />
                </View>
            </Modal>

            <ThemedAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                buttons={alertConfig.buttons}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.borderLight,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600' as const,
        color: Colors.light.text,
    },
    editButton: {
        padding: 4,
    },
    notFound: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    notFoundTitle: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: Colors.light.textSecondary,
    },
    mainImage: {
        width: '100%',
        height: 320,
        backgroundColor: Colors.light.surfaceSecondary,
    },
    imageIndicator: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    imageIndicatorText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500' as const,
    },
    thumbnailList: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    thumbnailActive: {
        borderColor: Colors.light.primary,
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    titleContainer: {
        flex: 1,
        marginRight: 12,
    },
    productName: {
        fontSize: 24,
        fontWeight: '700' as const,
        color: Colors.light.text,
        marginBottom: 4,
    },
    productSku: {
        fontSize: 14,
        color: Colors.light.textTertiary,
    },
    priceRow: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    priceContainer: {
        flex: 1,
        backgroundColor: Colors.light.primaryLight,
        padding: 16,
        borderRadius: 12,
        marginRight: 8,
    },
    priceLabel: {
        fontSize: 12,
        color: Colors.light.primary,
        marginBottom: 4,
    },
    priceValue: {
        fontSize: 24,
        fontWeight: '700' as const,
        color: Colors.light.primary,
    },
    stockContainer: {
        flex: 1,
        backgroundColor: Colors.light.surfaceSecondary,
        padding: 16,
        borderRadius: 12,
        marginLeft: 8,
    },
    stockLabel: {
        fontSize: 12,
        color: Colors.light.textTertiary,
        marginBottom: 4,
    },
    stockValue: {
        fontSize: 24,
        fontWeight: '700' as const,
        color: Colors.light.text,
    },
    stockLow: {
        color: Colors.light.warning,
    },
    infoCard: {
        marginBottom: 24,
        padding: 0,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    infoIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: Colors.light.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: Colors.light.textTertiary,
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 15,
        fontWeight: '500' as const,
        color: Colors.light.text,
    },
    infoDivider: {
        height: 1,
        backgroundColor: Colors.light.borderLight,
        marginHorizontal: 14,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600' as const,
        color: Colors.light.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    description: {
        fontSize: 15,
        lineHeight: 22,
        color: Colors.light.textSecondary,
    },
    variationCard: {
        marginBottom: 12,
    },
    variationName: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: Colors.light.text,
        marginBottom: 12,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.surfaceSecondary,
        borderRadius: 10,
        padding: 10,
        minWidth: '45%',
    },
    optionImage: {
        width: 40,
        height: 40,
        borderRadius: 6,
        marginRight: 10,
    },
    optionInfo: {
        flex: 1,
    },
    optionName: {
        fontSize: 14,
        fontWeight: '500' as const,
        color: Colors.light.text,
    },
    optionPrice: {
        fontSize: 12,
        color: Colors.light.primary,
        marginTop: 2,
    },
    optionStock: {
        fontSize: 11,
        color: Colors.light.textTertiary,
        marginTop: 2,
    },
    actionsContainer: {
        gap: 12,
    },
    actionButton: {
        borderColor: Colors.light.border,
    },
    deleteButton: {
        borderColor: Colors.light.dangerLight,
        backgroundColor: Colors.light.dangerLight,
    },
    deleteButtonText: {
        color: Colors.light.danger,
    },
    bottomPadding: {
        height: 40,
    },
    galleryOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
    },
    galleryClose: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 10,
        padding: 8,
    },
    galleryImageContainer: {
        width: 400,
        justifyContent: 'center',
        alignItems: 'center',
    },
    galleryImage: {
        width: '100%',
        height: 400,
    },
});
