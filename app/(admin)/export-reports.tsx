import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { FileText, FileSpreadsheet, ChevronLeft, Share, CheckCircle, AlertCircle } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

import { useData } from '@/contexts/DataContext';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import { Order } from '@/types';

export default function ExportReports() {
    const router = useRouter();
    const { orders } = useData();
    const [isExporting, setIsExporting] = useState(false);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const generateCSV = async () => {
        try {
            setIsExporting(true);

            const header = 'Order Number,Date,Customer,Items,Total,Status,Sales Rep\n';
            const rows = orders.map(order => {
                const date = formatDate(order.createdAt);
                // Escape commas in fields
                const safeCustomer = `"${order.customerName.replace(/"/g, '""')}"`;
                const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
                const safeSalesRep = `"${order.salesRepName.replace(/"/g, '""')}"`;

                return `${order.orderNumber},${date},${safeCustomer},${itemsCount},${order.total.toFixed(2)},${order.status},${safeSalesRep}`;
            }).join('\n');

            const csvContent = header + rows;
            const fileName = `orders_report_${new Date().toISOString().split('T')[0]}.csv`;
            const docDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
            const fileUri = docDir + fileName;

            await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
            } else {
                Alert.alert('Success', 'CSV generated but sharing is not available on this device');
            }
        } catch (error) {
            console.error('CSV Export Error:', error);
            Alert.alert('Error', 'Failed to generate CSV report');
        } finally {
            setIsExporting(false);
        }
    };

    const generatePDF = async () => {
        try {
            setIsExporting(true);

            const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; }
            h1 { color: #333; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
            .meta { font-size: 14px; color: #666; }
            .total { text-align: right; font-weight: bold; margin-top: 20px; font-size: 18px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Orders Report</h1>
            <div class="meta">Generated: ${new Date().toLocaleDateString()}</div>
          </div>
          
          <div class="meta">
            Total Orders: ${orders.length}
          </div>

          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(order => `
                <tr>
                  <td>${order.orderNumber}</td>
                  <td>${formatDate(order.createdAt)}</td>
                  <td>${order.customerName}</td>
                  <td>${order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                  <td>R${order.total.toFixed(2)}</td>
                  <td>${order.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total">
            Total Revenue: R${orders.reduce((sum, order) => sum + order.total, 0).toFixed(2)}
          </div>
        </body>
        </html>
      `;

            const { uri } = await Print.printToFileAsync({
                html: htmlContent,
                base64: false
            });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            } else {
                Alert.alert('Success', 'PDF generated but sharing is not available on this device');
            }
        } catch (error) {
            console.error('PDF Export Error:', error);
            Alert.alert('Error', 'Failed to generate PDF report');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Export Reports</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.description}>
                    Export your order data in your preferred format. Reports include order details, customer information, and financial totals.
                </Text>

                <TouchableOpacity
                    style={styles.optionCard}
                    onPress={generateCSV}
                    disabled={isExporting}
                >
                    <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
                        <FileSpreadsheet size={32} color="#2E7D32" />
                    </View>
                    <View style={styles.optionInfo}>
                        <Text style={styles.optionTitle}>Export as CSV</Text>
                        <Text style={styles.optionDescription}>Best for importing into Excel or Google Sheets</Text>
                    </View>
                    <Share size={20} color={Colors.light.textTertiary} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.optionCard}
                    onPress={generatePDF}
                    disabled={isExporting}
                >
                    <View style={[styles.iconContainer, { backgroundColor: '#FFEBEE' }]}>
                        <FileText size={32} color="#C62828" />
                    </View>
                    <View style={styles.optionInfo}>
                        <Text style={styles.optionTitle}>Export as PDF</Text>
                        <Text style={styles.optionDescription}>Best for printing and sharing documents</Text>
                    </View>
                    <Share size={20} color={Colors.light.textTertiary} />
                </TouchableOpacity>

                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Report Preview</Text>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Orders included</Text>
                        <Text style={styles.statValue}>{orders.length}</Text>
                    </View>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Date range</Text>
                        <Text style={styles.statValue}>All time</Text>
                    </View>
                </View>

                {isExporting && (
                    <View style={styles.loadingOverlay}>
                        <Text style={styles.loadingText}>Generating Report...</Text>
                    </View>
                )}
            </ScrollView>
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
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.borderLight,
    },
    backButton: {
        marginRight: 16,
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.light.text,
    },
    content: {
        padding: 20,
    },
    description: {
        fontSize: 16,
        color: Colors.light.textSecondary,
        marginBottom: 32,
        lineHeight: 24,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.surface,
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.light.borderLight,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    optionInfo: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: Colors.light.text,
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 13,
        color: Colors.light.textTertiary,
    },
    summaryCard: {
        marginTop: 16,
        backgroundColor: Colors.light.surfaceSecondary,
        padding: 20,
        borderRadius: 16,
    },
    summaryTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.light.textSecondary,
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    statLabel: {
        fontSize: 15,
        color: Colors.light.textSecondary,
    },
    statValue: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.light.text,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
        color: Colors.light.primary,
    }
});
