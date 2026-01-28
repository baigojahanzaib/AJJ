import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Order } from '@/types';

export const generateAndShareCSV = async (order: Order) => {
    console.log('Starting CSV generation for order:', order.orderNumber);
    try {
        const date = new Date(order.createdAt).toLocaleDateString();

        // Define headers
        let csvContent = 'Order Number,Date,Status,Customer Name,Customer Phone,Sales Rep,Item Name,SKU,Quantity,Unit Price,Total Price\n';

        // Add item rows
        order.items.forEach(item => {
            const row = [
                order.orderNumber,
                `"${date}"`,
                order.status,
                `"${order.customerName.replace(/"/g, '""')}"`,
                `"${order.customerPhone.replace(/"/g, '""')}"`,
                `"${order.salesRepName.replace(/"/g, '""')}"`,
                `"${item.productName.replace(/"/g, '""')}"`,
                item.productSku,
                item.quantity,
                item.unitPrice.toFixed(2),
                item.totalPrice.toFixed(2)
            ].join(',');
            csvContent += row + '\n';
        });

        // Add summary rows (optional, simplified for CSV structure)
        csvContent += `\nSubtotal,,,,,,,,,${order.subtotal.toFixed(2)}\n`;
        csvContent += `Tax,,,,,,,,,${order.tax.toFixed(2)}\n`;
        if (order.discount > 0) {
            csvContent += `Discount,,,,,,,,,-${order.discount.toFixed(2)}\n`;
        }
        csvContent += `Total,,,,,,,,,${order.total.toFixed(2)}\n`;

        if (order.notes) {
            csvContent += `\nNotes,"${order.notes.replace(/"/g, '""')}"\n`;
        }

        const fileName = `Order_${order.orderNumber}.csv`;
        const fileUri = FileSystem.documentDirectory + fileName;

        console.log('Writing CSV to:', fileUri);
        await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: 'utf8' });
        console.log('CSV write successful');

        const isSharingAvailable = await Sharing.isAvailableAsync();
        console.log('Sharing available:', isSharingAvailable);

        if (isSharingAvailable) {
            console.log('Attempting to share URI:', fileUri);
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/csv',
                dialogTitle: `Order #${order.orderNumber} CSV`,
                UTI: 'public.comma-separated-values-text'
            });
            console.log('Share async completed');
        } else {
            console.log('Sharing is not available on this device');
            alert('Sharing is not available on this device');
        }
    } catch (error) {
        console.error('Error generating CSV:', error);
        throw error;
    }
};
