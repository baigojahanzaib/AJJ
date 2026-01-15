import { useState, useMemo, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, Minus, Plus, ShoppingCart, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useData } from '@/contexts/DataContext';
import { useCart } from '@/contexts/CartContext';
import Button from '@/components/Button';
import Badge from '@/components/Badge';
import FullScreenImageModal from '@/components/FullScreenImageModal';
import Colors from '@/constants/colors';
import { SelectedVariation, ProductVariation } from '@/types';

export default function ProductDetailPage() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { activeProducts, getCategoryById } = useData();
    const { addItem } = useCart();

    const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
    const [quantity, setQuantity] = useState(1);

    const product = useMemo(() => {
        return activeProducts.find(p => p.id === id) || null;
    }, [activeProducts, id]);

    const { prevProduct, nextProduct } = useMemo(() => {
        if (!product || activeProducts.length === 0) return { prevProduct: null, nextProduct: null };
        const currentIndex = activeProducts.findIndex(p => p.id === id);
        return {
            prevProduct: currentIndex > 0 ? activeProducts[currentIndex - 1] : null,
            nextProduct: currentIndex < activeProducts.length - 1 ? activeProducts[currentIndex + 1] : activeProducts.length > 1 ? null : null,
        };
    }, [activeProducts, product, id]);

    useEffect(() => {
        if (product && product.variations.length > 0) {
            const initialVariations: Record<string, string> = {};
            product.variations.forEach(variation => {
                if (variation.options.length > 0) {
                    initialVariations[variation.id] = variation.options[0].id;
                }
            });
            setSelectedVariations(initialVariations);
        }
    }, [product]);

    const effectiveMoq = useMemo(() => {
        if (!product) return 1;
        let moq = product.moq || 1;

        // Check selected variations for specific MOQs
        product.variations.forEach(variation => {
            const selectedOptionId = selectedVariations[variation.id];
            const option = variation.options.find(opt => opt.id === selectedOptionId);
            if (option && option.moq && option.moq > moq) {
                moq = option.moq;
            }
        });

        return moq;
    }, [product, selectedVariations]);

    // Reset quantity when MOQ changes (e.g. variation change)
    useEffect(() => {
        if (quantity < effectiveMoq) {
            setQuantity(effectiveMoq);
        }
    }, [effectiveMoq]);

    const calculatePrice = (): number => {
        if (!product) return 0;
        let price = product.basePrice;
        product.variations.forEach(variation => {
            const selectedOptionId = selectedVariations[variation.id];
            const option = variation.options.find(opt => opt.id === selectedOptionId);
            if (option) {
                price += option.priceModifier;
            }
        });
        return price;
    };

    const handleAddToCart = () => {
        if (!product) return;
        const variationsArray: SelectedVariation[] = product.variations.map(variation => {
            const selectedOptionId = selectedVariations[variation.id];
            const option = variation.options.find(opt => opt.id === selectedOptionId);
            return {
                variationId: variation.id,
                variationName: variation.name,
                optionId: option?.id || '',
                optionName: option?.name || '',
                priceModifier: option?.priceModifier || 0,
            };
        });
        addItem(product, variationsArray, quantity);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
    };

    const renderVariationSelector = (variation: ProductVariation) => {
        const selectedOptionId = selectedVariations[variation.id];
        return (
            <View key={variation.id} style={styles.variationContainer}>
                <Text style={styles.variationLabel}>{variation.name}</Text>
                <View style={styles.optionsContainer}>
                    {variation.options.map(option => (
                        <TouchableOpacity
                            key={option.id}
                            style={[
                                styles.optionChip,
                                selectedOptionId === option.id && styles.optionChipSelected,
                            ]}
                            onPress={() => {
                                setSelectedVariations(prev => ({
                                    ...prev,
                                    [variation.id]: option.id,
                                }));
                                Haptics.selectionAsync();
                            }}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    selectedOptionId === option.id && styles.optionTextSelected,
                                ]}
                            >
                                {option.name}
                            </Text>
                            {option.priceModifier !== 0 && (
                                <Text
                                    style={[
                                        styles.optionPrice,
                                        selectedOptionId === option.id && styles.optionPriceSelected,
                                    ]}
                                >
                                    {option.priceModifier > 0 ? '+' : ''}R{option.priceModifier.toFixed(2)}
                                </Text>
                            )}
                            {selectedOptionId === option.id && (
                                <Check size={14} color={Colors.light.primaryForeground} style={styles.checkIcon} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    if (!product) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <Stack.Screen options={{ headerShown: false, presentation: 'card' }} />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color={Colors.light.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Product Not Found</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Product not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const screenWidth = Dimensions.get('window').width;

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        const index = event.nativeEvent.contentOffset.x / slideSize;
        const roundIndex = Math.round(index);
        setActiveImageIndex(roundIndex);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false, presentation: 'card' }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add to Cart</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.imageContainer}>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                    >
                        {product.images.map((image, index) => (
                            <TouchableOpacity
                                key={index}
                                activeOpacity={0.9}
                                onPress={() => {
                                    setActiveImageIndex(index);
                                    setImageModalVisible(true);
                                }}
                            >
                                <Image
                                    source={{ uri: image }}
                                    style={[styles.productImage, { width: screenWidth }]}
                                    contentFit="cover"
                                />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    {product.images.length > 1 && (
                        <View style={styles.pagination}>
                            {product.images.map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.paginationDot,
                                        index === activeImageIndex && styles.paginationDotActive
                                    ]}
                                />
                            ))}
                        </View>
                    )}
                </View>

                <FullScreenImageModal
                    visible={imageModalVisible}
                    images={product.images}
                    initialIndex={activeImageIndex}
                    onClose={() => setImageModalVisible(false)}
                />


                <View style={styles.productInfo}>
                    <View style={styles.productHeader}>
                        <Text style={styles.productName}>{product.name}</Text>
                        {product.variations.length > 0 && (
                            <Badge label={`${product.variations.length} options`} size="sm" />
                        )}
                        <Text style={styles.productSku}>{product.sku}</Text>
                        <Text style={styles.categoryName}>
                            {getCategoryById(product.categoryId)?.name || 'Uncategorized'}
                        </Text>
                    </View>

                    <Text style={styles.productDescription}>{product.description}</Text>

                    {product.variations.map(renderVariationSelector)}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <View style={styles.navigationRow}>
                    <TouchableOpacity
                        style={[styles.navButton, !prevProduct && styles.navButtonDisabled]}
                        onPress={() => prevProduct && router.replace(`/(sales)/catalog/${prevProduct.id}`)}
                        disabled={!prevProduct}
                    >
                        <ChevronLeft size={20} color={prevProduct ? Colors.light.text : Colors.light.textTertiary} />
                    </TouchableOpacity>

                    {effectiveMoq > 1 && (
                        <View style={styles.moqContainer}>
                            <Text style={styles.moqText}>Sold in multiples of {effectiveMoq}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.navButton, !nextProduct && styles.navButtonDisabled]}
                        onPress={() => nextProduct && router.replace(`/(sales)/catalog/${nextProduct.id}`)}
                        disabled={!nextProduct}
                    >
                        <ChevronRight size={20} color={nextProduct ? Colors.light.text : Colors.light.textTertiary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.quantityRow}>
                    <Text style={styles.quantityLabel}>Quantity</Text>
                    <View style={styles.quantityControls}>
                        <TouchableOpacity
                            style={[styles.quantityButton, quantity <= effectiveMoq && styles.quantityButtonDisabled]}
                            onPress={() => {
                                if (quantity > effectiveMoq) {
                                    setQuantity(q => q - effectiveMoq);
                                    Haptics.selectionAsync();
                                }
                            }}
                            disabled={quantity <= effectiveMoq}
                        >
                            <Minus size={18} color={quantity > effectiveMoq ? Colors.light.text : Colors.light.textTertiary} />
                        </TouchableOpacity>
                        <Text style={styles.quantityValue}>{quantity}</Text>
                        <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => {
                                setQuantity(q => q + effectiveMoq);
                                Haptics.selectionAsync();
                            }}
                        >
                            <Plus size={18} color={Colors.light.text} />
                        </TouchableOpacity>
                    </View>
                </View>
                <Button
                    title={`Add to Cart • R${calculatePrice().toFixed(2)}`}
                    onPress={handleAddToCart}
                    icon={<ShoppingCart size={20} color={Colors.light.primaryForeground} />}
                    fullWidth
                    size="lg"
                />
            </View>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.borderLight,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: Colors.light.text,
    },
    backButton: {
        padding: 4,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: Colors.light.textTertiary,
    },
    imageContainer: {
        position: 'relative',
    },
    productImage: {
        height: 300,
        backgroundColor: Colors.light.surfaceSecondary,
    },
    pagination: {
        flexDirection: 'row',
        position: 'absolute',
        bottom: 16,
        alignSelf: 'center',
        gap: 8,
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    paginationDotActive: {
        backgroundColor: '#fff',
        width: 12,
    },
    productInfo: {
        padding: 20,
    },
    productHeader: {
        marginBottom: 16,
    },
    productName: {
        fontSize: 22,
        fontWeight: '700' as const,
        color: Colors.light.text,
        marginBottom: 6,
    },
    productSku: {
        fontSize: 13,
        color: Colors.light.textTertiary,
        marginBottom: 4,
    },
    categoryName: {
        fontSize: 14,
        color: Colors.light.textSecondary,
    },
    productDescription: {
        fontSize: 15,
        lineHeight: 22,
        color: Colors.light.textSecondary,
        marginBottom: 24,
    },
    variationContainer: {
        marginBottom: 20,
    },
    variationLabel: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: Colors.light.text,
        marginBottom: 10,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    optionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: Colors.light.surfaceSecondary,
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    optionChipSelected: {
        backgroundColor: Colors.light.primary,
        borderColor: Colors.light.primary,
    },
    optionText: {
        fontSize: 14,
        fontWeight: '500' as const,
        color: Colors.light.text,
    },
    optionTextSelected: {
        color: Colors.light.primaryForeground,
    },
    optionPrice: {
        fontSize: 12,
        color: Colors.light.textTertiary,
        marginLeft: 6,
    },
    optionPriceSelected: {
        color: Colors.light.primaryForeground,
        opacity: 0.8,
    },
    checkIcon: {
        marginLeft: 6,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 20, // Increased padding bottom for better spacing on non-safe area devices if needed, otherwise handled by SafeAreaView
        borderTopWidth: 1,
        borderTopColor: Colors.light.borderLight,
        backgroundColor: Colors.light.surface,
    },
    navigationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    navButton: {
        padding: 6, // Reduced padding for smaller buttons
        borderRadius: 8,
        backgroundColor: Colors.light.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navButtonDisabled: {
        opacity: 0.5,
    },
    navText: {
        display: 'none',
    },
    navTextDisabled: {
        display: 'none',
    },
    moqContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    moqText: {
        fontSize: 13,
        color: Colors.light.textSecondary,
        fontWeight: '500' as const,
        textAlign: 'center',
    },
    quantityRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    quantityLabel: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: Colors.light.text,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    quantityButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: Colors.light.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityValue: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: Colors.light.text,
        minWidth: 30,
        textAlign: 'center',
    },
    quantityButtonDisabled: {
        opacity: 0.5,
    },
});
