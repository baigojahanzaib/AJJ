import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft, Plus, X, Check, ImagePlus, Trash2, ChevronDown, ChevronUp, Link2, Unlink, Edit2, Copy, Palette, Layers, Camera, RefreshCw
} from 'lucide-react-native';
import { useData } from '@/contexts/DataContext';
import Input from '@/components/Input';
import Button from '@/components/Button';
import ThemedAlert from '@/components/ThemedAlert';
import Colors from '@/constants/colors';
import { ProductCombination, ProductVariation, VariationOption } from '@/types';
import {
  formatCurrency,
  getPriceModifierFromFinalPrice,
  getVariationOptionFinalPrice,
} from '@/lib/product-pricing';
import { uploadFile } from '@/lib/baigo-api';

type ProductImagePickerTarget = 'product' | 'variationOption';
type ImagePickerSource = 'library' | 'camera';

const variationPresets = [
  { name: 'Size', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { name: 'Color', options: ['Red', 'Blue', 'Green', 'Black', 'White', 'Gray'] },
  { name: 'Material', options: ['Cotton', 'Polyester', 'Leather', 'Wool', 'Silk'] },
  { name: 'Style', options: ['Classic', 'Modern', 'Vintage', 'Casual', 'Formal'] },
];

type CombinationOption = ProductCombination['options'][number];
type CombinationSelection = {
  variation: ProductVariation;
  option: VariationOption;
};

const normalizeCombinationText = (value: string) => value.trim().toLowerCase();

const getCombinationKey = (options: CombinationOption[]) => (
  options
    .map(option => `${normalizeCombinationText(option.name)}:${normalizeCombinationText(option.value)}`)
    .sort()
    .join('|')
);

const getCombinationLabel = (combination: ProductCombination) => (
  combination.options.map(option => option.value).join(' / ')
);

const parseNumberInput = (value: string, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatNumberInputValue = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  return `${Math.round(value * 100) / 100}`;
};

const parseOptionalIntegerInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getCompleteVariations = (sourceVariations: ProductVariation[]) => (
  sourceVariations
    .map(variation => ({
      ...variation,
      options: variation.options.filter(option => option.name.trim().length > 0),
    }))
    .filter(variation => variation.name.trim().length > 0 && variation.options.length > 0)
);

const createDefaultCombinationId = (options: CombinationOption[], index: number) => {
  const key = getCombinationKey(options)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return `combo-${key || index}`;
};

const buildCombinationMatrix = (
  sourceVariations: ProductVariation[],
  existingCombinations: ProductCombination[],
  basePriceValue: number
): ProductCombination[] => {
  const completeVariations = getCompleteVariations(sourceVariations);
  if (completeVariations.length < 2) return [];

  const existingByKey = new Map(
    existingCombinations.map(combination => [getCombinationKey(combination.options), combination])
  );
  const rows: CombinationSelection[][] = [];

  const walk = (variationIndex: number, selected: CombinationSelection[]) => {
    if (variationIndex === completeVariations.length) {
      rows.push(selected);
      return;
    }

    const variation = completeVariations[variationIndex];
    variation.options.forEach(option => {
      walk(variationIndex + 1, [...selected, { variation, option }]);
    });
  };

  walk(0, []);

  return rows.map((selection, index) => {
    const options = selection.map(({ variation, option }) => ({
      name: variation.name.trim(),
      value: option.name.trim(),
    }));
    const key = getCombinationKey(options);
    const existing = existingByKey.get(key);
    const defaultPrice = basePriceValue + selection.reduce((sum, item) => sum + item.option.priceModifier, 0);
    const defaultStock = Math.min(...selection.map(item => item.option.stock));

    return {
      id: existing?.id ?? createDefaultCombinationId(options, index),
      options,
      price: existing?.price ?? defaultPrice,
      sku: existing?.sku,
      stock: existing?.stock ?? defaultStock,
    };
  });
};

const getCombinationDefaultPrice = (
  sourceVariations: ProductVariation[],
  options: CombinationOption[],
  basePriceValue: number
) => {
  const selectedOptions = options.map(option => {
    const variation = sourceVariations.find(item =>
      normalizeCombinationText(item.name) === normalizeCombinationText(option.name)
    );
    return variation?.options.find(item =>
      normalizeCombinationText(item.name) === normalizeCombinationText(option.value)
    );
  });

  if (selectedOptions.some(option => !option)) return null;

  return basePriceValue + selectedOptions.reduce((sum, option) => (
    sum + (option?.priceModifier ?? 0)
  ), 0);
};

const nearlyEqual = (left: number, right: number) => Math.abs(left - right) < 0.01;

const syncAutomaticCombinationPrices = (
  currentVariations: ProductVariation[],
  currentBasePrice: number,
  previousProduct: { basePrice: number; variations: ProductVariation[]; combinations?: ProductCombination[] } | null,
  currentCombinations: ProductCombination[]
) => {
  if (!previousProduct) return currentCombinations;
  const previousCombinationsByKey = new Map(
    (previousProduct.combinations ?? []).map(combination => [
      getCombinationKey(combination.options),
      combination,
    ])
  );

  return currentCombinations.map(combination => {
    const previousCombination = previousCombinationsByKey.get(getCombinationKey(combination.options));
    if (previousCombination && !nearlyEqual(combination.price, previousCombination.price)) {
      return combination;
    }

    const previousDefaultPrice = getCombinationDefaultPrice(
      previousProduct.variations,
      combination.options,
      previousProduct.basePrice
    );
    const nextDefaultPrice = getCombinationDefaultPrice(
      currentVariations,
      combination.options,
      currentBasePrice
    );

    if (
      previousDefaultPrice !== null &&
      nextDefaultPrice !== null &&
      !nearlyEqual(combination.price, nextDefaultPrice)
    ) {
      return { ...combination, price: combination.price + (nextDefaultPrice - previousDefaultPrice) };
    }

    return combination;
  });
};

const sanitizeCombinations = (combinations: ProductCombination[]) => (
  combinations.map(combination => ({
    ...combination,
    sku: combination.sku?.trim() || undefined,
  }))
);

export default function AddProductPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productId?: string; editSession?: string }>();
  const { categories, addProduct, updateProduct, getProductById } = useData();

  const productId = params.productId;
  const editSession = params.editSession ?? 'default';
  const formKey = productId ? `edit:${productId}:${editSession}` : `new:${editSession}`;
  const editingProduct = productId ? getProductById(productId) : null;
  const isEditing = !!productId;
  const returnProductId = productId;
  const loadedFormKeyRef = useRef<string | null>(null);

  const [name, setName] = useState(editingProduct?.name || '');
  const [description, setDescription] = useState(editingProduct?.description || '');
  const [sku, setSku] = useState(editingProduct?.sku || '');
  const [basePrice, setBasePrice] = useState(editingProduct?.basePrice?.toString() || '');
  const [stock, setStock] = useState(editingProduct?.stock?.toString() || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(editingProduct?.categoryId || '');
  const [images, setImages] = useState<string[]>(editingProduct?.images || []);
  const [variations, setVariations] = useState<ProductVariation[]>(editingProduct?.variations || []);
  const [combinations, setCombinations] = useState<ProductCombination[]>(editingProduct?.combinations || []);
  const [isActive, setIsActive] = useState(editingProduct?.isActive ?? true);

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [showOptionImagePicker, setShowOptionImagePicker] = useState(false);
  const [selectedOptionForImage, setSelectedOptionForImage] = useState<number | null>(null);
  const [imagePickerTarget, setImagePickerTarget] = useState<ProductImagePickerTarget>('product');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [newVariationName, setNewVariationName] = useState('');
  const [newVariationOptions, setNewVariationOptions] = useState<VariationOption[]>([]);
  const [editingVariationIndex, setEditingVariationIndex] = useState<number | null>(null);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [expandedCombinations, setExpandedCombinations] = useState<Record<string, boolean>>({});

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    buttons: [] as { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  });

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const canBuildCombinationMatrix = getCompleteVariations(variations).length >= 2;

  useEffect(() => {
    if (productId) {
      if (loadedFormKeyRef.current === formKey) return;

      loadedFormKeyRef.current = null;
      setName('');
      setDescription('');
      setSku('');
      setBasePrice('');
      setStock('');
      setSelectedCategoryId('');
      setImages([]);
      setVariations([]);
      setCombinations([]);
      setIsActive(true);
      setShowCategoryPicker(false);
      setShowImagePicker(false);
      setShowVariationModal(false);
      setShowOptionImagePicker(false);
      setSelectedOptionForImage(null);
      setImagePickerTarget('product');
      setNewVariationName('');
      setNewVariationOptions([]);
      setEditingVariationIndex(null);
      setShowPresetPicker(false);
      setExpandedCombinations({});
      return;
    }

    if (loadedFormKeyRef.current === formKey) return;

    setName('');
    setDescription('');
    setSku('');
    setBasePrice('');
    setStock('');
    setSelectedCategoryId('');
    setImages([]);
    setVariations([]);
    setCombinations([]);
    setIsActive(true);
    setShowCategoryPicker(false);
    setShowImagePicker(false);
    setShowVariationModal(false);
    setShowOptionImagePicker(false);
    setSelectedOptionForImage(null);
    setImagePickerTarget('product');
    setNewVariationName('');
    setNewVariationOptions([]);
    setEditingVariationIndex(null);
    setShowPresetPicker(false);
    setExpandedCombinations({});
    loadedFormKeyRef.current = formKey;
  }, [formKey, productId]);

  useEffect(() => {
    if (!productId || !editingProduct) return;
    if (loadedFormKeyRef.current === formKey) return;

    setName(editingProduct.name);
    setDescription(editingProduct.description);
    setSku(editingProduct.sku);
    setBasePrice(editingProduct.basePrice?.toString() || '');
    setStock(editingProduct.stock?.toString() || '');
    setSelectedCategoryId(editingProduct.categoryId);
    setImages([...(editingProduct.images || [])]);
    setVariations(editingProduct.variations.map(variation => ({
      ...variation,
      options: variation.options.map(option => ({ ...option })),
    })));
    setCombinations((editingProduct.combinations || []).map(combination => ({
      ...combination,
      options: combination.options.map(option => ({ ...option })),
    })));
    setIsActive(editingProduct.isActive);
    setShowCategoryPicker(false);
    setShowImagePicker(false);
    setShowVariationModal(false);
    setShowOptionImagePicker(false);
    setSelectedOptionForImage(null);
    setImagePickerTarget('product');
    setNewVariationName('');
    setNewVariationOptions([]);
    setEditingVariationIndex(null);
    setShowPresetPicker(false);
    setExpandedCombinations({});
    loadedFormKeyRef.current = formKey;
  }, [editingProduct, formKey, productId]);

  const handleBack = useCallback(() => {
    if (returnProductId) {
      router.dismissTo(`/(admin)/products/${returnProductId}`);
      return;
    }

    router.back();
  }, [returnProductId, router]);

  useEffect(() => {
    if (!returnProductId || Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });

    return () => subscription.remove();
  }, [handleBack, returnProductId]);

  const closeImagePicker = () => {
    setShowImagePicker(false);
    if (imagePickerTarget === 'variationOption') {
      setSelectedOptionForImage(null);
    }
    setImagePickerTarget('product');
  };

  const addImageUrlToProduct = (imageUrl: string) => {
    setImages(prev => prev.includes(imageUrl) ? prev : [...prev, imageUrl]);
  };

  const uploadPickedImage = async (asset: ImagePicker.ImagePickerAsset) => {
    return uploadFile({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    });
  };

  const pickAndUploadImage = async (source: ImagePickerSource) => {
    if (isUploadingImage) return;

    const target = imagePickerTarget;
    const optionIndex = selectedOptionForImage;

    if (target === 'variationOption' && optionIndex === null) {
      setAlertConfig({
        visible: true,
        title: 'No Option Selected',
        message: 'Please select a variation option before adding an image.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setAlertConfig({
            visible: true,
            title: 'Permission Required',
            message: 'Camera permission is required to take product photos.',
            type: 'warning',
            buttons: [{ text: 'OK', style: 'default' }],
          });
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setAlertConfig({
            visible: true,
            title: 'Permission Required',
            message: 'Photo library permission is required to add product images.',
            type: 'warning',
            buttons: [{ text: 'OK', style: 'default' }],
          });
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: target === 'variationOption',
          allowsMultipleSelection: target === 'product',
          selectionLimit: target === 'product' ? 10 : 1,
          quality: 0.85,
        });
      }

      if (result.canceled || result.assets.length === 0) return;

      setIsUploadingImage(true);
      const assets = target === 'variationOption' ? [result.assets[0]] : result.assets;
      const uploadedUrls = await Promise.all(assets.map(uploadPickedImage));

      if (target === 'variationOption') {
        const uploadedUrl = uploadedUrls[0];
        addImageUrlToProduct(uploadedUrl);
        updateVariationOption(optionIndex as number, 'image', uploadedUrl);
      } else {
        setImages(prev => {
          const next = [...prev];
          uploadedUrls.forEach(url => {
            if (!next.includes(url)) next.push(url);
          });
          return next;
        });
      }

      closeImagePicker();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error uploading product image:', error);
      setAlertConfig({
        visible: true,
        title: 'Upload Failed',
        message: 'The image could not be added. Please try again.',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    const removedImage = images[index];
    setImages(prev => prev.filter((_, i) => i !== index));
    setVariations(prev => prev.map(v => ({
      ...v,
      options: v.options.map(opt =>
        opt.image === removedImage ? { ...opt, image: undefined } : opt
      ),
    })));
    Haptics.selectionAsync();
  };

  const openVariationModal = (index?: number) => {
    if (index !== undefined) {
      const variation = variations[index];
      setNewVariationName(variation.name);
      setNewVariationOptions(variation.options.map(opt => ({ ...opt })));
      setEditingVariationIndex(index);
    } else {
      setNewVariationName('');
      setNewVariationOptions([]);
      setEditingVariationIndex(null);
    }
    setShowVariationModal(true);
  };

  const addVariationOption = () => {
    const newOption: VariationOption = {
      id: `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      priceModifier: 0,
      sku: '',
      stock: 0,
      image: undefined,
    };
    setNewVariationOptions(prev => [...prev, newOption]);
    Haptics.selectionAsync();
  };

  const updateVariationOption = (index: number, field: keyof VariationOption, value: string | number | undefined) => {
    setNewVariationOptions(prev => prev.map((opt, i) => {
      if (i !== index) return opt;
      return { ...opt, [field]: value };
    }));
  };

  const getCurrentBasePrice = () => parseNumberInput(basePrice);

  const getVariationOptionFinalPriceInput = (option: VariationOption) => (
    formatNumberInputValue(getVariationOptionFinalPrice(getCurrentBasePrice(), option))
  );

  const updateVariationOptionFinalPrice = (index: number, value: string) => {
    const currentBasePrice = getCurrentBasePrice();
    const finalPrice = parseNumberInput(value, currentBasePrice);
    updateVariationOption(index, 'priceModifier', getPriceModifierFromFinalPrice(currentBasePrice, finalPrice));
  };

  const handleBasePriceChange = (value: string) => {
    const previousBasePrice = getCurrentBasePrice();
    const nextBasePrice = parseNumberInput(value);
    const shouldPreserveFinalOptionPrices = previousBasePrice > 0 && !nearlyEqual(previousBasePrice, nextBasePrice);

    if (shouldPreserveFinalOptionPrices) {
      const preserveFinalPrice = (option: VariationOption) => {
        const finalPrice = getVariationOptionFinalPrice(previousBasePrice, option);
        return {
          ...option,
          priceModifier: getPriceModifierFromFinalPrice(nextBasePrice, finalPrice),
        };
      };

      setVariations(prev => prev.map(variation => ({
        ...variation,
        options: variation.options.map(preserveFinalPrice),
      })));
      setNewVariationOptions(prev => prev.map(preserveFinalPrice));
    }

    setBasePrice(value);
  };

  const removeVariationOption = (index: number) => {
    setNewVariationOptions(prev => prev.filter((_, i) => i !== index));
    Haptics.selectionAsync();
  };

  const openOptionImagePicker = (optionIndex: number) => {
    setSelectedOptionForImage(optionIndex);
    setShowOptionImagePicker(true);
  };

  const openDirectImagePicker = (optionIndex: number) => {
    setSelectedOptionForImage(optionIndex);
    setImagePickerTarget('variationOption');
    setShowImagePicker(true);
  };

  const applyPreset = (preset: { name: string; options: string[] }) => {
    setNewVariationName(preset.name);
    const presetOptions: VariationOption[] = preset.options.map((optName, index) => ({
      id: `opt-${Date.now()}-${index}`,
      name: optName,
      priceModifier: 0,
      sku: '',
      stock: 0,
      image: undefined,
    }));
    setNewVariationOptions(presetOptions);
    setShowPresetPicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const duplicateVariation = (index: number) => {
    const original = variations[index];
    const duplicate: ProductVariation = {
      id: `var-${Date.now()}`,
      name: `${original.name} (Copy)`,
      options: original.options.map((opt, i) => ({
        ...opt,
        id: `opt-${Date.now()}-${i}`,
      })),
    };
    setVariations(prev => [...prev, duplicate]);
    Haptics.selectionAsync();
  };

  const linkImageToOption = (imageUrl: string) => {
    if (selectedOptionForImage !== null) {
      updateVariationOption(selectedOptionForImage, 'image', imageUrl);
      setShowOptionImagePicker(false);
      setSelectedOptionForImage(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const unlinkImageFromOption = (optionIndex: number) => {
    updateVariationOption(optionIndex, 'image', undefined);
    Haptics.selectionAsync();
  };

  const saveVariation = () => {
    if (!newVariationName.trim()) {
      setAlertConfig({
        visible: true,
        title: 'Missing Name',
        message: 'Please enter a variation name.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (newVariationOptions.length === 0) {
      setAlertConfig({
        visible: true,
        title: 'No Options',
        message: 'Please add at least one option.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    const hasEmptyOption = newVariationOptions.some(opt => !opt.name.trim());
    if (hasEmptyOption) {
      setAlertConfig({
        visible: true,
        title: 'Empty Option',
        message: 'All options must have a name.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    const newVariation: ProductVariation = {
      id: editingVariationIndex !== null
        ? variations[editingVariationIndex].id
        : `var-${Date.now()}`,
      name: newVariationName,
      options: newVariationOptions,
    };

    if (editingVariationIndex !== null) {
      setVariations(prev => prev.map((v, i) => i === editingVariationIndex ? newVariation : v));
    } else {
      setVariations(prev => [...prev, newVariation]);
    }

    setShowVariationModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const removeVariation = (index: number) => {
    setAlertConfig({
      visible: true,
      title: 'Remove Variation',
      message: `Are you sure you want to remove "${variations[index].name}"?`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setVariations(prev => prev.filter((_, i) => i !== index));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ],
    });
  };

  const syncCombinationMatrix = () => {
    const nextCombinations = buildCombinationMatrix(
      variations,
      combinations,
      parseNumberInput(basePrice)
    );

    if (nextCombinations.length === 0) {
      setAlertConfig({
        visible: true,
        title: 'Add More Variations',
        message: 'Combination pricing needs at least two variations with options, such as Class and Size.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    setCombinations(nextCombinations);
    Haptics.selectionAsync();
  };

  const clearCombinationMatrix = () => {
    setAlertConfig({
      visible: true,
      title: 'Clear Combination Prices',
      message: 'This will remove exact combination prices and the product will use the saved variation option prices.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setCombinations([]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ],
    });
  };

  const updateCombination = (index: number, updates: Partial<ProductCombination>) => {
    setCombinations(prev => prev.map((combination, i) => (
      i === index ? { ...combination, ...updates } : combination
    )));
  };

  const getCombinationStateKey = (combination: ProductCombination) => (
    getCombinationKey(combination.options) || String(combination.id)
  );

  const toggleCombinationExpanded = (combination: ProductCombination) => {
    const key = getCombinationStateKey(combination);
    setExpandedCombinations(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
    Haptics.selectionAsync();
  };

  const deleteCombination = (index: number) => {
    const combination = combinations[index];
    if (!combination) return;

    setAlertConfig({
      visible: true,
      title: 'Delete Combination',
      message: `Remove "${getCombinationLabel(combination)}" from combination pricing?`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setCombinations(prev => prev.filter((_, i) => i !== index));
            setExpandedCombinations(prev => {
              const next = { ...prev };
              delete next[getCombinationStateKey(combination)];
              return next;
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ],
    });
  };

  const expandAllCombinations = () => {
    const nextExpanded = combinations.reduce<Record<string, boolean>>((acc, combination) => {
      acc[getCombinationStateKey(combination)] = true;
      return acc;
    }, {});
    setExpandedCombinations(nextExpanded);
    Haptics.selectionAsync();
  };

  const collapseAllCombinations = () => {
    setExpandedCombinations({});
    Haptics.selectionAsync();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setAlertConfig({
        visible: true,
        title: 'Missing Name',
        message: 'Please enter a product name.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!sku.trim()) {
      setAlertConfig({
        visible: true,
        title: 'Missing SKU',
        message: 'Please enter a product SKU.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!basePrice || parseFloat(basePrice) <= 0) {
      setAlertConfig({
        visible: true,
        title: 'Invalid Price',
        message: 'Please enter a valid base price.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!selectedCategoryId) {
      setAlertConfig({
        visible: true,
        title: 'No Category',
        message: 'Please select a category.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (images.length === 0) {
      setAlertConfig({
        visible: true,
        title: 'No Images',
        message: 'Please add at least one product image.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    const parsedBasePrice = parseNumberInput(basePrice);
    const sanitizedCombinations = combinations.length > 0
      ? sanitizeCombinations(combinations)
      : [];
    const syncedCombinations = syncAutomaticCombinationPrices(
      variations,
      parsedBasePrice,
      editingProduct ?? null,
      sanitizedCombinations
    );

    const productData = {
      name: name.trim(),
      description: description.trim(),
      sku: sku.trim().toUpperCase(),
      basePrice: parsedBasePrice,
      images,
      categoryId: selectedCategoryId,
      isActive,
      variations,
      combinations: syncedCombinations,
      stock: parseInt(stock) || 0,
    };

    try {
      if (productId) {
        if (!editingProduct) {
          setAlertConfig({
            visible: true,
            title: 'Product Still Loading',
            message: 'Please wait for the product details to finish loading before saving.',
            type: 'warning',
            buttons: [{ text: 'OK', style: 'default' }],
          });
          return;
        }

        await updateProduct(productId, productData);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAlertConfig({
          visible: true,
          title: 'Product Updated',
          message: `${productData.name} has been updated successfully.`,
          type: 'success',
          buttons: [{
            text: 'OK',
            style: 'default',
            onPress: handleBack,
          }],
        });
        return;
      }

      const newProduct = await addProduct(productData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAlertConfig({
        visible: true,
        title: 'Product Created',
        message: `${newProduct.name} has been added successfully.`,
        type: 'success',
        buttons: [{
          text: 'OK',
          style: 'default',
          onPress: () => router.back(),
        }],
      });
    } catch (error) {
      console.error('Error saving product:', error);
      setAlertConfig({
        visible: true,
        title: 'Save Failed',
        message: 'The product could not be saved. Please try again.',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    }
  };

  const renderCombinationPricing = () => {
    const hasExpandedCombinations = combinations.some(combination => (
      expandedCombinations[getCombinationStateKey(combination)]
    ));

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Combination Prices</Text>
            <Text style={styles.sectionSubtitle}>
              {canBuildCombinationMatrix
                ? 'Set exact prices for each selected variation combination'
                : 'Add at least two variation groups, such as Class and Size'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.addVariationBtn,
              !canBuildCombinationMatrix && styles.addVariationBtnDisabled,
            ]}
            onPress={syncCombinationMatrix}
            disabled={!canBuildCombinationMatrix}
          >
            <RefreshCw size={18} color={Colors.light.primary} />
            <Text style={styles.addVariationText}>{combinations.length > 0 ? 'Sync' : 'Create'}</Text>
          </TouchableOpacity>
        </View>

        {combinations.length > 0 ? (
          <>
            <View style={styles.combinationSummary}>
              <Text style={styles.combinationSummaryText}>
                {combinations.length} priced combination{combinations.length !== 1 ? 's' : ''}
              </Text>
              <View style={styles.combinationSummaryActions}>
                <TouchableOpacity onPress={hasExpandedCombinations ? collapseAllCombinations : expandAllCombinations}>
                  <Text style={styles.combinationSummaryActionText}>
                    {hasExpandedCombinations ? 'Collapse All' : 'Expand All'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearCombinationMatrix}>
                  <Text style={styles.clearCombinationText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {combinations.map((combination, index) => {
              const combinationKey = getCombinationStateKey(combination);
              const isExpanded = expandedCombinations[combinationKey] ?? false;

              return (
                <View key={`${combination.id}-${index}`} style={styles.combinationCard}>
                  <TouchableOpacity
                    style={styles.combinationCardHeader}
                    onPress={() => toggleCombinationExpanded(combination)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.combinationTitle} numberOfLines={2}>
                      {getCombinationLabel(combination)}
                    </Text>
                    <View style={styles.combinationHeaderActions}>
                      <TouchableOpacity
                        style={styles.combinationIconButton}
                        onPress={() => deleteCombination(index)}
                      >
                        <Trash2 size={18} color={Colors.light.danger} />
                      </TouchableOpacity>
                      <View style={styles.combinationIconButton}>
                        {isExpanded ? (
                          <ChevronUp size={20} color={Colors.light.textSecondary} />
                        ) : (
                          <ChevronDown size={20} color={Colors.light.textSecondary} />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.combinationExpandedContent}>
                      <View style={styles.combinationOptions}>
                        {combination.options.map(option => (
                          <View key={`${option.name}-${option.value}`} style={styles.combinationOptionChip}>
                            <Text style={styles.combinationOptionText}>{option.name}: {option.value}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.optionRow}>
                        <View style={styles.optionHalf}>
                          <Input
                            label="Price"
                            placeholder="0.00"
                            value={combination.price.toString()}
                            onChangeText={(value) => updateCombination(index, { price: parseNumberInput(value) })}
                            keyboardType="decimal-pad"
                          />
                        </View>
                        <View style={styles.optionHalf}>
                          <Input
                            label="Stock"
                            placeholder="0"
                            value={combination.stock?.toString() ?? ''}
                            onChangeText={(value) => updateCombination(index, { stock: parseOptionalIntegerInput(value) })}
                            keyboardType="number-pad"
                          />
                        </View>
                      </View>

                      <Input
                        label="SKU"
                        placeholder="Optional combination SKU"
                        value={combination.sku ?? ''}
                        onChangeText={(value) => updateCombination(index, { sku: value })}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyVariations}>
            <Text style={styles.emptyVariationsText}>
              {canBuildCombinationMatrix ? 'No combination prices yet' : 'Variation groups required'}
            </Text>
            <Text style={styles.emptyVariationsSubtext}>
              {canBuildCombinationMatrix
                ? 'Tap Create to generate one row for each Class + Size selection'
                : 'Create one variation named Class and another named Size, then return here'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderOptionImagePicker = () => (
    <Modal
      visible={showOptionImagePicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowOptionImagePicker(false)}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowOptionImagePicker(false)}>
            <X size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Link Image to Option</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {images.length > 0 ? (
            <>
              <Text style={styles.pickerSubtitle}>Select from product images</Text>
              <View style={styles.imageGrid}>
                {images.map((url, index) => {
                  const currentOption = selectedOptionForImage !== null
                    ? newVariationOptions[selectedOptionForImage]
                    : null;
                  const isSelected = currentOption?.image === url;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.imageOption,
                        isSelected && styles.imageOptionSelected,
                      ]}
                      onPress={() => linkImageToOption(url)}
                    >
                      <Image source={{ uri: url }} style={styles.imageOptionImg} contentFit="cover" />
                      {isSelected && (
                        <View style={styles.imageSelectedOverlay}>
                          <Check size={24} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <ImagePlus size={48} color={Colors.light.textTertiary} />
              <Text style={styles.emptyStateText}>No product images added yet</Text>
              <Text style={styles.emptyStateSubtext}>Add images to the product first, then link them to variation options</Text>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderPresetPicker = () => (
    <Modal
      visible={showPresetPicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPresetPicker(false)}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowPresetPicker(false)}>
            <X size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Variation Presets</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.pickerSubtitle}>Quick start with common variations</Text>
          <View style={styles.presetList}>
            {variationPresets.map((preset, index) => (
              <TouchableOpacity
                key={index}
                style={styles.presetCard}
                onPress={() => applyPreset(preset)}
              >
                <View style={styles.presetHeader}>
                  <View style={styles.presetIconContainer}>
                    {preset.name === 'Size' && <Layers size={20} color={Colors.light.primary} />}
                    {preset.name === 'Color' && <Palette size={20} color={Colors.light.primary} />}
                    {preset.name === 'Material' && <Layers size={20} color={Colors.light.primary} />}
                    {preset.name === 'Style' && <Palette size={20} color={Colors.light.primary} />}
                  </View>
                  <Text style={styles.presetName}>{preset.name}</Text>
                </View>
                <View style={styles.presetOptionsPreview}>
                  {preset.options.slice(0, 4).map((opt, i) => (
                    <View key={i} style={styles.presetOptionChip}>
                      <Text style={styles.presetOptionText}>{opt}</Text>
                    </View>
                  ))}
                  {preset.options.length > 4 && (
                    <Text style={styles.presetMoreText}>+{preset.options.length - 4} more</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderVariationModal = () => (
    <Modal
      visible={showVariationModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowVariationModal(false)}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowVariationModal(false)}>
            <X size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {editingVariationIndex !== null ? 'Edit Variation' : 'Add Variation'}
          </Text>
          <TouchableOpacity style={styles.modalSaveBtn} onPress={saveVariation}>
            <Check size={24} color={Colors.light.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Input
              label="Variation Name"
              placeholder="e.g., Size, Color, Material"
              value={newVariationName}
              onChangeText={setNewVariationName}
            />
          </View>

          <View style={styles.presetBtnContainer}>
            <TouchableOpacity
              style={styles.usePresetBtn}
              onPress={() => setShowPresetPicker(true)}
            >
              <Layers size={16} color={Colors.light.primary} />
              <Text style={styles.usePresetBtnText}>Use Preset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Options</Text>
              <TouchableOpacity style={styles.addOptionBtn} onPress={addVariationOption}>
                <Plus size={18} color={Colors.light.primary} />
                <Text style={styles.addOptionText}>Add Option</Text>
              </TouchableOpacity>
            </View>

            {newVariationOptions.map((option, index) => (
              <View key={option.id} style={styles.optionCard}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionNumber}>Option {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeVariationOption(index)}>
                    <Trash2 size={18} color={Colors.light.danger} />
                  </TouchableOpacity>
                </View>

                <Input
                  label="Name"
                  placeholder="e.g., Small, Red, Cotton"
                  value={option.name}
                  onChangeText={(value) => updateVariationOption(index, 'name', value)}
                  containerStyle={styles.optionInput}
                />

                <View style={styles.optionImageSection}>
                  <Text style={styles.optionImageLabel}>Option Image</Text>
                  {option.image ? (
                    <View style={styles.linkedImageContainer}>
                      <Image source={{ uri: option.image }} style={styles.linkedImage} contentFit="cover" />
                      <View style={styles.linkedImageActions}>
                        <TouchableOpacity
                          style={styles.linkedImageBtn}
                          onPress={() => openOptionImagePicker(index)}
                        >
                          <Link2 size={16} color={Colors.light.primary} />
                          <Text style={styles.linkedImageBtnText}>Link</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.linkedImageBtn, styles.addNewImageBtn]}
                          onPress={() => openDirectImagePicker(index)}
                        >
                          <ImagePlus size={16} color={Colors.light.success} />
                          <Text style={[styles.linkedImageBtnText, styles.addNewImageText]}>Upload</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.linkedImageBtn, styles.unlinkBtn]}
                          onPress={() => unlinkImageFromOption(index)}
                        >
                          <Unlink size={16} color={Colors.light.danger} />
                          <Text style={[styles.linkedImageBtnText, styles.unlinkBtnText]}>Unlink</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.imageActionButtons}>
                      {images.length > 0 && (
                        <TouchableOpacity
                          style={styles.linkImageBtn}
                          onPress={() => openOptionImagePicker(index)}
                        >
                          <Link2 size={16} color={Colors.light.primary} />
                          <Text style={styles.linkImageBtnText}>Link Existing</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.linkImageBtn, styles.addNewImageBtn]}
                        onPress={() => openDirectImagePicker(index)}
                      >
                        <ImagePlus size={16} color={Colors.light.success} />
                        <Text style={[styles.linkImageBtnText, styles.addNewImageText]}>Add New Image</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.optionRow}>
                  <View style={styles.optionHalf}>
                    <Input
                      label="Final Option Price"
                      placeholder="0.00"
                      value={getVariationOptionFinalPriceInput(option)}
                      onChangeText={(value) => updateVariationOptionFinalPrice(index, value)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.optionHalf}>
                    <Input
                      label="Stock"
                      placeholder="0"
                      value={option.stock.toString()}
                      onChangeText={(value) => updateVariationOption(index, 'stock', parseInt(value) || 0)}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <Input
                  label="SKU Suffix"
                  placeholder="e.g., -SM, -RED"
                  value={option.sku}
                  onChangeText={(value) => updateVariationOption(index, 'sku', value)}
                  containerStyle={styles.optionInput}
                />
              </View>
            ))}

            {newVariationOptions.length === 0 && (
              <View style={styles.emptyOptions}>
                <Text style={styles.emptyOptionsText}>No options added yet</Text>
              </View>
            )}
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>

      {renderOptionImagePicker()}
    </Modal>
  );

  const renderImagePicker = () => (
    <Modal
      visible={showImagePicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!isUploadingImage) closeImagePicker();
      }}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={closeImagePicker}
            disabled={isUploadingImage}
          >
            <X size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {imagePickerTarget === 'variationOption' ? 'Add Option Image' : 'Add Product Images'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.pickerSubtitle}>Choose image source</Text>
          <View style={styles.imageSourceOptions}>
            <TouchableOpacity
              style={[styles.sourceOption, isUploadingImage && styles.sourceOptionDisabled]}
              onPress={() => pickAndUploadImage('library')}
              disabled={isUploadingImage}
            >
              <View style={styles.sourceIconContainer}>
                <ImagePlus size={26} color={Colors.light.primary} />
              </View>
              <Text style={styles.sourceText}>Choose from Phone</Text>
              <Text style={styles.sourceSubtext}>
                {imagePickerTarget === 'product' ? 'Select one or more images' : 'Select one image'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sourceOption, isUploadingImage && styles.sourceOptionDisabled]}
              onPress={() => pickAndUploadImage('camera')}
              disabled={isUploadingImage}
            >
              <View style={styles.sourceIconContainer}>
                <Camera size={26} color={Colors.light.primary} />
              </View>
              <Text style={styles.sourceText}>Take Photo</Text>
              <Text style={styles.sourceSubtext}>Use the camera</Text>
            </TouchableOpacity>
          </View>

          {isUploadingImage && (
            <View style={styles.uploadStatus}>
              <ActivityIndicator size="small" color={Colors.light.primary} />
              <Text style={styles.uploadStatusText}>Uploading image...</Text>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Product' : 'Add Product'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Images</Text>
          <View style={styles.imagesContainer}>
            {images.map((url, index) => (
              <View key={index} style={styles.imageItem}>
                <Image source={{ uri: url }} style={styles.imagePreview} contentFit="cover" />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => handleRemoveImage(index)}
                >
                  <X size={14} color="#fff" />
                </TouchableOpacity>
                {index === 0 && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>Main</Text>
                  </View>
                )}
              </View>
            ))}
            <TouchableOpacity
              style={styles.addImageBtn}
              onPress={() => {
                setImagePickerTarget('product');
                setShowImagePicker(true);
              }}
            >
              <ImagePlus size={24} color={Colors.light.textTertiary} />
              <Text style={styles.addImageText}>Add Image</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.imageHint}>First image will be the main product image. Add multiple images to link with variations.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <Input
            label="Product Name"
            placeholder="Enter product name"
            value={name}
            onChangeText={setName}
            containerStyle={styles.inputContainer}
          />
          <Input
            label="Description"
            placeholder="Enter product description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            containerStyle={styles.inputContainer}
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <Input
                label="SKU"
                placeholder="PRD-001"
                value={sku}
                onChangeText={setSku}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.half}>
              <Input
                label="Stock"
                placeholder="0"
                value={stock}
                onChangeText={setStock}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <View style={styles.priceInputContainer}>
            <Text style={styles.inputLabel}>Base Price</Text>
            <View style={styles.priceInput}>
              <Text style={styles.currencySymbol}>R</Text>
              <TextInput
                style={styles.priceField}
                placeholder="0.00"
                placeholderTextColor={Colors.light.textTertiary}
                value={basePrice}
                onChangeText={handleBasePriceChange}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <TouchableOpacity
            style={styles.categoryPicker}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            <Text style={[
              styles.categoryPickerText,
              !selectedCategory && styles.categoryPickerPlaceholder
            ]}>
              {selectedCategory?.name || 'Select category'}
            </Text>
            <ChevronDown size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>

          {showCategoryPicker && (
            <View style={styles.categoryOptions}>
              {categories.filter(c => c.isActive).map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryOption,
                    selectedCategoryId === category.id && styles.categoryOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedCategoryId(category.id);
                    setShowCategoryPicker(false);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[
                    styles.categoryOptionText,
                    selectedCategoryId === category.id && styles.categoryOptionTextActive,
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Variations</Text>
              <Text style={styles.sectionSubtitle}>Add size, color, or other options</Text>
            </View>
            <TouchableOpacity style={styles.addVariationBtn} onPress={() => openVariationModal()}>
              <Plus size={18} color={Colors.light.primary} />
              <Text style={styles.addVariationText}>Add</Text>
            </TouchableOpacity>
          </View>

          {variations.map((variation, index) => (
            <View key={variation.id} style={styles.variationCard}>
              <View style={styles.variationHeader}>
                <Text style={styles.variationName}>{variation.name}</Text>
                <View style={styles.variationActions}>
                  <TouchableOpacity
                    style={styles.variationEditBtn}
                    onPress={() => openVariationModal(index)}
                  >
                    <Edit2 size={14} color={Colors.light.textSecondary} />
                    <Text style={styles.variationEditText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.variationDuplicateBtn}
                    onPress={() => duplicateVariation(index)}
                  >
                    <Copy size={14} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeVariation(index)}>
                    <Trash2 size={18} color={Colors.light.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.variationOptionsContainer}>
                {variation.options.map((opt, optIndex) => (
                  <View key={opt.id} style={styles.variationOptionChip}>
                    {opt.image && (
                      <Image source={{ uri: opt.image }} style={styles.optionChipImage} contentFit="cover" />
                    )}
                    <Text style={styles.variationOptionText}>{opt.name}</Text>
                    <Text style={styles.variationOptionPrice}>
                      {formatCurrency(getVariationOptionFinalPrice(parseNumberInput(basePrice), opt))}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.variationStats}>
                <Text style={styles.variationStatText}>
                  {variation.options.length} options • {variation.options.filter(o => o.image).length} with images
                </Text>
              </View>
            </View>
          ))}

          {variations.length === 0 && (
            <View style={styles.emptyVariations}>
              <Text style={styles.emptyVariationsText}>No variations added</Text>
              <Text style={styles.emptyVariationsSubtext}>
                Add variations like size, color, or material to your product
              </Text>
            </View>
          )}
        </View>

        {renderCombinationPricing()}

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.activeToggle}
            onPress={() => {
              setIsActive(!isActive);
              Haptics.selectionAsync();
            }}
          >
            <View>
              <Text style={styles.activeToggleLabel}>Active Product</Text>
              <Text style={styles.activeToggleSubtext}>
                Product will be visible in the catalog
              </Text>
            </View>
            <View style={[styles.toggle, isActive && styles.toggleActive]}>
              <View style={[styles.toggleKnob, isActive && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.saveSection}>
          <Button
            title={isUploadingImage ? "Uploading Images..." : (isEditing ? "Update Product" : "Save Product")}
            onPress={handleSave}
            fullWidth
            size="lg"
            disabled={isUploadingImage}
            icon={isUploadingImage ? undefined : <Check size={20} color={Colors.light.primaryForeground} />}
          />
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {renderImagePicker()}
      {renderVariationModal()}
      {renderPresetPicker()}

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    backgroundColor: Colors.light.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginBottom: 8,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageItem: {
    position: 'relative',
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.light.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: Colors.light.primary,
    borderRadius: 4,
    paddingVertical: 2,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: Colors.light.primaryForeground,
    textAlign: 'center',
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addImageText: {
    fontSize: 11,
    color: Colors.light.textTertiary,
  },
  imageHint: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 12,
    fontStyle: 'italic',
  },
  inputContainer: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  priceInputContainer: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginRight: 4,
  },
  priceField: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    paddingVertical: 14,
  },
  categoryPicker: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  categoryPickerText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  categoryPickerPlaceholder: {
    color: Colors.light.textTertiary,
  },
  categoryOptions: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  categoryOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  categoryOptionActive: {
    backgroundColor: Colors.light.primary,
  },
  categoryOptionText: {
    fontSize: 15,
    color: Colors.light.text,
  },
  categoryOptionTextActive: {
    color: Colors.light.primaryForeground,
    fontWeight: '600' as const,
  },
  addVariationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 8,
  },
  addVariationBtnDisabled: {
    opacity: 0.5,
  },
  addVariationText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  variationCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  variationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  variationName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  variationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  variationEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 6,
  },
  variationEditText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  variationOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  variationOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 20,
  },
  optionChipImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  variationOptionText: {
    fontSize: 13,
    color: Colors.light.text,
  },
  variationOptionPrice: {
    fontSize: 11,
    color: Colors.light.primary,
    fontWeight: '600' as const,
  },
  variationStats: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  variationStatText: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  emptyVariations: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyVariationsText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  emptyVariationsSubtext: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  combinationSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  combinationSummaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  combinationSummaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  combinationSummaryActionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  clearCombinationText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.danger,
  },
  combinationCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  combinationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  combinationTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  combinationHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  combinationIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  combinationExpandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  combinationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    marginBottom: 12,
  },
  combinationOptionChip: {
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  combinationOptionText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  activeToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  activeToggleLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  activeToggleSubtext: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.light.surfaceSecondary,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: Colors.light.primary,
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  saveSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  bottomPadding: {
    height: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    backgroundColor: Colors.light.surface,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  modalContent: {
    flex: 1,
  },
  pickerSubtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  imageSourceOptions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  sourceOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 136,
    padding: 16,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sourceOptionDisabled: {
    opacity: 0.55,
  },
  sourceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  sourceText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center',
  },
  sourceSubtext: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },
  uploadStatus: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  uploadStatusText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  imageOption: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  imageOptionSelected: {
    borderColor: Colors.light.primary,
  },
  imageOptionImg: {
    width: '100%',
    height: '100%',
  },
  imageSelectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addOptionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  optionCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionNumber: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  optionInput: {
    marginBottom: 12,
  },
  optionImageSection: {
    marginBottom: 12,
  },
  optionImageLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  linkImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    borderStyle: 'dashed',
  },
  linkImageBtnText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.primary,
  },
  linkedImageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkedImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  linkedImageActions: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  linkedImageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 8,
  },
  linkedImageBtnText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.primary,
  },
  unlinkBtn: {
    backgroundColor: Colors.light.dangerLight,
  },
  unlinkBtnText: {
    color: Colors.light.danger,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  optionHalf: {
    flex: 1,
  },
  emptyOptions: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyOptionsText: {
    fontSize: 14,
    color: Colors.light.textTertiary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
  presetBtnContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  usePresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    borderStyle: 'dashed',
  },
  usePresetBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  presetList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  presetCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  presetIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  presetOptionsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  presetOptionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
  },
  presetOptionText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  presetMoreText: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    fontStyle: 'italic',
  },
  imageActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addNewImageBtn: {
    flex: 1,
    borderColor: Colors.light.success,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  addNewImageText: {
    color: Colors.light.success,
  },
  variationDuplicateBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
