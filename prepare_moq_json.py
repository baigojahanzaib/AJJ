import csv
import json

updates = []

with open('catalog_2026-01-15_15-47.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        moq_str = row.get('product_attribute_MOQ')
        if not moq_str:
            continue
        try:
            moq = float(moq_str) # Could be int or float
            if moq <= 0:
                continue
        except ValueError:
            continue

        ecwid_id_str = row.get('product_internal_id')
        if not ecwid_id_str:
            continue
        
        try:
            ecwid_id = int(ecwid_id_str)
        except ValueError:
            continue

        sku = row.get('product_sku')
        if not sku:
            sku = row.get('product_variation_sku')
        
        if not sku:
            # Skip if no SKU found
            continue

        updates.append({
            "ecwidId": ecwid_id,
            "sku": sku,
            "moq": moq
        })

# Save to JSON
with open('moq_updates.json', 'w') as f:
    json.dump(updates, f, indent=2)

print(f"Prepared {len(updates)} updates.")
