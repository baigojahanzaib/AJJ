# Supabase Catalog Source

The app now has an opt-in catalog source for Supabase so product prices, stock, variations, combinations, and categories can come from your own database instead of the legacy Ecwid/Convex product sync.

## Environment

Keep the current Convex source by default. To switch the product catalog to Supabase, add these Expo public variables:

```env
EXPO_PUBLIC_CATALOG_SOURCE=supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_SUPABASE_PRODUCTS_VIEW=mobile_catalog_products
EXPO_PUBLIC_SUPABASE_CATEGORIES_VIEW=mobile_catalog_categories
```

Use a Supabase publishable key in the app. Do not put a `service_role` or secret key in any `EXPO_PUBLIC_` variable.

## Expected Views

Create Supabase views that return the current mobile shape. This lets your website keep its own normalized product schema while the app reads a stable API.

`mobile_catalog_products` should expose:

```sql
id,
ecwid_id,
name,
description,
sku,
base_price,
compare_at_price,
images,
category_id,
is_active,
variations,
combinations,
stock,
moq,
ribbon,
ribbon_color,
created_at
```

`variations` should be JSON shaped like:

```json
[
  {
    "id": "size",
    "name": "Size",
    "options": [
      {
        "id": "size-large",
        "name": "Large",
        "priceModifier": 0,
        "sku": "SKU-L",
        "stock": 20,
        "moq": 1
      }
    ]
  }
]
```

`combinations` is optional JSON for exact variation-combination prices and SKUs.

`mobile_catalog_categories` should expose:

```sql
id,
ecwid_id,
name,
description,
image,
parent_id,
is_active,
created_at
```

## Supabase Access Notes

Enable RLS on exposed tables/views and add read policies for the publishable-key role the app uses. New Supabase projects may not expose newly-created tables to the Data API automatically, so also confirm the views are exposed and granted to the required roles.
