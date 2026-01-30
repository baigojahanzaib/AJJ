
import csv

filename = 'd:/AJJ/catalog_2026-01-15_15-47.csv'
search_term = 'Booster'

try:
    with open(filename, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            line = ','.join(row)
            if search_term.lower() in line.lower():
                print(f"Match at line {i+1}: {line}")
except Exception as e:
    print(f"Error: {e}")
