import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Order } from '@/types';

const generateOrderHTML = (order: Order) => {
  const date = new Date(order.createdAt).toLocaleDateString();

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 15px; }
          .company-name { font-size: 24px; font-weight: bold; color: #333; }
          .invoice-title { font-size: 24px; color: #666; font-weight: 300; text-align: right; }
          
          .info-container { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .left-info { width: 40%; }
          .right-info { width: 55%; display: flex; justify-content: space-between; }
          
          .meta-row { display: flex; margin-bottom: 8px; }
          .label { font-weight: bold; color: #666; width: 80px; }
          .value { flex: 1; }
          
          .address-block { width: 48%; }
          .address-title { font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 3px; font-size: 14px; }
          .address-content { font-size: 14px; line-height: 1.4; }

          /* Improved Page Break Handling */
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #ddd; color: #666; font-size: 14px; }
          td { padding: 10px 8px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 14px; }
          
          tr { 
            page-break-inside: avoid; 
            break-inside: avoid;
            page-break-after: auto; 
          }
          
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          
          .amount-col { text-align: right; white-space: nowrap; }
          .image-col { width: 60px; }
          .sku-col { width: 100px; }
          .qty-col { width: 60px; text-align: center; }
          
          .product-image { width: 50px; height: 50px; object-fit: cover; border-radius: 4px; background-color: #f0f0f0; }
          
          .total-section { display: flex; flex-direction: column; align-items: flex-end; page-break-inside: avoid; break-inside: avoid; }
          .total-row { display: flex; justify-content: flex-end; width: 300px; margin-bottom: 10px; }
          .total-label { font-weight: bold; width: 100px; text-align: right; margin-right: 20px; }
          .total-value { width: 120px; text-align: right; }
          .grand-total { font-size: 18px; font-weight: bold; color: #000; margin-top: 10px; border-top: 2px solid #333; padding-top: 10px; }
          
          .footer { margin-top: 50px; text-align: center; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">e-order</div>
          <div class="invoice-title">ORDER #${order.orderNumber}</div>
        </div>

        <div class="info-container">
          <div class="left-info">
            <div class="meta-row">
              <span class="label">Date:</span>
              <span class="value">${date}</span>
            </div>
            <div class="meta-row">
              <span class="label">Status:</span>
              <span class="value" style="text-transform: capitalize;">${order.status}</span>
            </div>
          </div>
          
          <div class="right-info">
             <div class="address-block">
              <div class="address-title">Sales Representative</div>
              <div class="address-content">${order.salesRepName}</div>
            </div>
            <div class="address-block">
              <div class="address-title">Bill To</div>
              <div class="address-content">
                <div>${order.customerName}</div>
                <div>${order.customerPhone}</div>
                <div>${order.customerEmail || ''}</div>
                <div>${order.customerAddress || ''}</div>
              </div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="image-col">Image</th>
              <th>Item</th>
              <th class="sku-col">SKU</th>
              <th class="qty-col">Qty</th>
              <th class="amount-col">Price</th>
              <th class="amount-col">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr style="page-break-inside: avoid; break-inside: avoid;">
                <td class="image-col">
                  ${item.productImage ? `<img src="${item.productImage}" class="product-image" alt="" />` : '<div class="product-image"></div>'}
                </td>
                <td>
                  <div style="font-weight: bold;">${item.productName}</div>
                  ${item.selectedVariations?.length ? `
                    <div style="font-size: 12px; color: #333; margin-top: 4px;">
                      ${item.selectedVariations.map(v => `${v.optionName}`).join(' / ')}
                    </div>
                  ` : ''}
                </td>
                <td class="sku-col">
                  <div style="font-size: 12px; color: #666;">${item.productSku}</div>
                </td>
                <td class="qty-col">${item.quantity}</td>
                <td class="amount-col">R${item.unitPrice.toFixed(2)}</td>
                <td class="amount-col">R${item.totalPrice.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row">
            <span class="total-label">Subtotal:</span>
            <span class="total-value">R${order.subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Tax:</span>
            <span class="total-value">R${order.tax.toFixed(2)}</span>
          </div>
          ${order.discount > 0 ? `
            <div class="total-row">
              <span class="total-label">Discount:</span>
              <span class="total-value">-R${order.discount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="total-row grand-total">
            <span class="total-label">Total:</span>
            <span class="total-value">R${order.total.toFixed(2)}</span>
          </div>
        </div>

        ${order.notes ? `
          <div style="margin-top: 30px; background: #f9f9f9; padding: 15px; border-radius: 4px;">
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
  console.log('Starting PDF generation for order:', order.orderNumber);
  try {
    const html = generateOrderHTML(order);
    console.log('Order HTML generated');

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });
    console.log('PDF printed to:', uri);

    console.log('Attempting to share PDF...');
    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `Order #${order.orderNumber}`,
    });
    console.log('PDF share completed');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
