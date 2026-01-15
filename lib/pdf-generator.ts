import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Order } from '@/types';

const generateOrderHTML = (order: Order) => {
    const date = new Date(order.createdAt).toLocaleDateString();

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
          .company-name { font-size: 24px; font-weight: bold; color: #333; }
          .invoice-title { font-size: 32px; color: #666; font-weight: 300; text-align: right; }
          .meta-info { margin-bottom: 40px; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .label { font-weight: bold; color: #666; width: 100px; }
          .value { flex: 1; }
          .address-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .address-block { width: 45%; }
          .address-title { font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #ddd; color: #666; }
          td { padding: 12px 8px; border-bottom: 1px solid #eee; }
          .amount-col { text-align: right; }
          .total-section { display: flex; flex-direction: column; align-items: flex-end; }
          .total-row { display: flex; justify-content: flex-end; width: 300px; margin-bottom: 10px; }
          .total-label { font-weight: bold; width: 100px; text-align: right; margin-right: 20px; }
          .total-value { width: 100px; text-align: right; }
          .grand-total { font-size: 18px; font-weight: bold; color: #000; margin-top: 10px; border-top: 2px solid #333; padding-top: 10px; }
          .footer { margin-top: 60px; text-align: center; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">e-order</div>
          <div class="invoice-title">ORDER</div>
        </div>

        <div class="meta-info">
          <div class="meta-row">
            <span class="label">Date:</span>
            <span class="value">${date}</span>
          </div>
          <div class="meta-row">
            <span class="label">Order #:</span>
            <span class="value">${order.orderNumber}</span>
          </div>
          <div class="meta-row">
            <span class="label">Status:</span>
            <span class="value" style="text-transform: capitalize;">${order.status}</span>
          </div>
        </div>

        <div class="address-section">
          <div class="address-block">
            <div class="address-title">Sales Representative</div>
            <div>${order.salesRepName}</div>
            <!-- Add Sales Rep details if available in Order type in future -->
          </div>
          <div class="address-block">
            <div class="address-title">Bill To</div>
            <div>${order.customerName}</div>
            <div>${order.customerPhone}</div>
            <div>${order.customerEmail || ''}</div>
            <div>${order.customerAddress || ''}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th class="amount-col">Price</th>
              <th class="amount-col">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>
                  <div style="font-weight: bold;">${item.productName}</div>
                  <div style="font-size: 12px; color: #666;">${item.productSku}</div>
                  ${item.selectedVariations?.length ? `
                    <div style="font-size: 12px; color: #888;">
                      ${item.selectedVariations.map(v => v.optionName).join(' / ')}
                    </div>
                  ` : ''}
                </td>
                <td>${item.quantity}</td>
                <td class="amount-col">$${item.unitPrice.toFixed(2)}</td>
                <td class="amount-col">$${item.totalPrice.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row">
            <span class="total-label">Subtotal:</span>
            <span class="total-value">$${order.subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Tax:</span>
            <span class="total-value">$${order.tax.toFixed(2)}</span>
          </div>
          ${order.discount > 0 ? `
            <div class="total-row">
              <span class="total-label">Discount:</span>
              <span class="total-value">-$${order.discount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="total-row grand-total">
            <span class="total-label">Total:</span>
            <span class="total-value">$${order.total.toFixed(2)}</span>
          </div>
        </div>

        ${order.notes ? `
          <div style="margin-top: 40px; background: #f9f9f9; padding: 15px; border-radius: 4px;">
            <div style="font-weight: bold; margin-bottom: 5px;">Notes:</div>
            <div>${order.notes}</div>
          </div>
        ` : ''}

        <div class="footer">
          Thank you for your business!
        </div>
      </body>
    </html>
  `;
};

export const generateAndSharePDF = async (order: Order) => {
    try {
        const html = generateOrderHTML(order);
        const { uri } = await Print.printToFileAsync({
            html,
            base64: false,
        });

        await Sharing.shareAsync(uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: `Order #${order.orderNumber}`,
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
};
