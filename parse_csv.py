import csv

with open('head_csv.txt', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    print(f"Columns: {reader.fieldnames}")
    for i, row in enumerate(reader):
        if i > 20: break
        sku = row.get('product_sku')
        if not sku:
             sku = row.get('product_variation_sku')
        
        moq = row.get('product_attribute_MOQ')
        ptype = row.get('type')
        print(f"Row {i}: Type: {ptype}, SKU: {sku}, MOQ: {moq}")
