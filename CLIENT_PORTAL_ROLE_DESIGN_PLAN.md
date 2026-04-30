# Client Portal, Sales App, and Admin Role Design Plan

## Goal

The application should become one shared ordering platform with three role-based experiences:

- Public client storefront: anyone can browse products without logging in.
- Client account portal: clients log in only when they want to place orders, view order history, or manage account details.
- Sales field app: sales reps log in to manage customers, build carts, submit orders, and review their own order activity.
- Admin console: admins log in to manage products, users, orders, settings, sync, and can switch into sales or client views.

The current app already has strong foundations for this:

- `app/(sales)` already covers sales catalog, cart, orders, customers, and profile.
- `app/(admin)` already covers admin dashboard, products, orders, users, and settings.
- Convex already has `users`, `customers`, `products`, `categories`, `orders`, `ecwidSettings`, and `appConfig`.

The main design change is to add a public/client storefront layer and role-based routing while keeping one login system. The login screen should not show an account type selector.

---

## Product Model

### One Platform, Three Interfaces

```
+---------------------------------------------------------------+
|                         E-Order Platform                       |
+----------------------+----------------------+-----------------+
| Public / Client Shop | Sales Field App      | Admin Console   |
| Browse and order     | Sell for customers   | Manage system   |
+----------------------+----------------------+-----------------+
| Guest/client role    | sales_rep role       | admin role      |
| Public browse        | Internal selling     | Management      |
| E-commerce UX        | Field sales UX       | Operations UX   |
+----------------------+----------------------+-----------------+
```

### Role Access Matrix

```
+----------------------+-------+--------+-----------+-------+
| Capability           | Guest | Client | Sales Rep | Admin |
+----------------------+-------+--------+-----------+-------+
| Browse products      | Yes   | Yes    | Yes       | Yes   |
| View product details | Yes   | Yes    | Yes       | Yes   |
| Add to cart          | Yes*  | Yes    | Yes       | Yes   |
| Checkout             | No    | Yes    | Yes       | Yes   |
| View own orders      | No    | Yes    | Yes       | Yes   |
| Manage customers     | No    | No     | Yes       | Yes   |
| Create order for client | No | No     | Yes       | Yes   |
| Manage products      | No    | No     | No        | Yes   |
| Manage users         | No    | No     | No        | Yes   |
| App settings/sync    | No    | No     | No        | Yes   |
| Preview other views  | No    | No     | Optional  | Optional |
+----------------------+-------+--------+-----------+-------+

* Guest cart is optional but recommended. Checkout should require login.
```

---

## Recommended Route Architecture

The existing route groups can be extended rather than replaced.

```
app/
  _layout.tsx
  index.tsx                         -> public storefront home/catalog

  (auth)/
    sign-in.tsx                     -> one login for all roles
    sign-up.tsx                     -> client self-registration
    forgot-password.tsx             -> later phase

  (shop)/
    _layout.tsx                     -> public/client e-commerce shell
    index.tsx                       -> product browsing
    category/[id].tsx               -> category listing
    product/[id].tsx                -> product details
    cart.tsx                        -> cart review
    checkout.tsx                    -> requires login
    orders.tsx                      -> client order history
    account.tsx                     -> client account/profile

  (sales)/
    _layout.tsx                     -> existing sales tab shell
    catalog/
    cart.tsx
    orders.tsx
    customers.tsx
    customer/
    profile.tsx

  (admin)/
    _layout.tsx                     -> existing admin tab shell
    dashboard.tsx
    products/
    orders.tsx
    users.tsx
    settings.tsx
    ecwid-sync.tsx
    export-reports.tsx
    remote-config.tsx
    tax-settings.tsx

  order/[id].tsx                    -> shared order detail route if role-safe
```

### Role-Based Redirect Rules

```
+-----------------------+---------------------------------------+
| State                 | Default Route                         |
+-----------------------+---------------------------------------+
| Guest opens app       | /(shop) or /                          |
| Guest taps checkout   | /(auth)/sign-in?next=/checkout        |
| Client logs in        | /(shop)/checkout or /(shop)           |
| Sales rep logs in     | /(sales)/catalog                      |
| Admin logs in         | /(admin)/dashboard                    |
+-----------------------+---------------------------------------+
```

The login redirect should be based only on the authenticated user's stored role. The user should not choose between Client, Sales Field App, or Admin during login.

### Important Navigation Change

The current `app/index.tsx` is the login screen. For the client-facing version, the root route should become the public storefront. Login should move to a dedicated auth route.

This is important because clients should be able to open the app and browse immediately, like an e-commerce store.

---

## Role-Based Login Routing

The login experience should be simple: email, password, submit. After credentials are validated, the account role stored in Convex determines the landing area automatically.

### Login Rules

```
+-------------------+-------------------------+----------------------+
| Account Role      | Login Destination       | Selector Needed?     |
+-------------------+-------------------------+----------------------+
| client            | Client Shop             | No                   |
| sales_rep         | Sales Field App         | No                   |
| admin             | Admin Console           | No                   |
+-------------------+-------------------------+----------------------+
```

This means the same sign-in form is used for everyone, but the system decides where they go.

### Optional Post-Login View Access

Admins and sales reps may still need a way to preview lower-level views after they are already signed in. This should be treated as a post-login action, not as part of authentication.

### Access Rules

```
+-----------+----------------------------+
| Role      | Post-Login View Access     |
+-----------+----------------------------+
| client    | Shop only                  |
| sales_rep | Sales App, optional Shop   |
| admin     | Admin, optional Sales/Shop |
+-----------+----------------------------+
```

### Placement

If this preview access is kept, place it in the profile/account area instead of making it part of login.

- Admin: `Settings` or header menu: `View as Sales`, `View as Client Shop`
- Sales rep: `Profile` menu: `View Client Shop`
- Client: no alternate view access

### Optional View Access Mockup

```
+------------------------------------+
| Account                            |
+------------------------------------+
| AJJ Sales Admin                    |
| admin@example.com                  |
+------------------------------------+
| Default role                       |
| Admin Console                      |
+------------------------------------+
| Preview                            |
| [ View Sales Field App ]           |
| [ View Client Shop ]               |
+------------------------------------+
| Sign out                           |
+------------------------------------+
```

---

## Public / Client Shop Design

The shop should feel like an ordering storefront, not an internal sales tool. The key design difference is that guests and clients should browse by product, category, search, and promotions.

### Shop Tab Structure

For mobile, keep the e-commerce shell simple:

```
+------------------------------------------------+
| Header: Logo/Search/Account                    |
+------------------------------------------------+
| Home/Catalog | Categories | Cart | Account     |
+------------------------------------------------+
```

Recommended bottom tabs:

```
+-----------+-------------+--------+-----------+
| Catalog   | Categories  | Cart   | Account   |
+-----------+-------------+--------+-----------+
```

Guest account tab should show sign-in/sign-up prompts. Client account tab should show profile and order history.

### Shop Home / Catalog Wireframe

```
+------------------------------------------------+
| e-order                         [Search] [User]|
+------------------------------------------------+
| Browse products                                |
| Fresh stock, pricing, and available variations |
+------------------------------------------------+
| [Search products, SKU, category...]            |
+------------------------------------------------+
| Categories                                     |
| [ All ] [ Drinks ] [ Snacks ] [ Cleaning ]     |
+------------------------------------------------+
| Promotions                                     |
| +----------------+  +----------------+         |
| | Product image  |  | Product image  |         |
| | Ribbon         |  | Ribbon         |         |
| | Name           |  | Name           |         |
| | R price        |  | R price        |         |
| +----------------+  +----------------+         |
+------------------------------------------------+
| All products                                   |
| +--------------------------------------------+ |
| | image | Product name                       | |
| |       | SKU / stock / MOQ                  | |
| |       | R price                 [Add]      | |
| +--------------------------------------------+ |
| +--------------------------------------------+ |
| | image | Product name                       | |
| |       | SKU / stock / MOQ                  | |
| |       | R price                 [Add]      | |
| +--------------------------------------------+ |
+------------------------------------------------+
```

### Product Detail Wireframe

```
+------------------------------------------------+
| < Back                                [Cart]   |
+------------------------------------------------+
| +--------------------------------------------+ |
| |              Product Image                 | |
| +--------------------------------------------+ |
+------------------------------------------------+
| Product name                                   |
| SKU: ABC-123                                   |
| R 120.00                                      |
| MOQ: 6 units      Stock: Available            |
+------------------------------------------------+
| Options                                        |
| Size                                           |
| [ Small ] [ Medium ] [ Large ]                |
| Color                                          |
| [ Red ] [ Blue ] [ Green ]                    |
+------------------------------------------------+
| Quantity                                       |
| [-]  6  [+]                                   |
+------------------------------------------------+
| Description                                    |
| Product description text                       |
+------------------------------------------------+
|                         [ Add to cart ]        |
+------------------------------------------------+
```

### Cart Wireframe

```
+------------------------------------------------+
| Cart                                           |
+------------------------------------------------+
| +--------------------------------------------+ |
| | image | Product name                       | |
| |       | Selected variation                 | |
| |       | R 120.00 x 6       [-] 6 [+] [x]  | |
| +--------------------------------------------+ |
| +--------------------------------------------+ |
| | image | Product name                       | |
| |       | Selected variation                 | |
| |       | R 80.00 x 12       [-] 12 [+] [x] | |
| +--------------------------------------------+ |
+------------------------------------------------+
| Subtotal                              R 1,680  |
| Tax                                   R   252  |
| Total                                 R 1,932  |
+------------------------------------------------+
| [ Continue shopping ]        [ Checkout ]      |
+------------------------------------------------+
```

### Checkout Wireframe

```
+------------------------------------------------+
| Checkout                                       |
+------------------------------------------------+
| Contact details                                |
| [ Name ]                                       |
| [ Phone ]                                      |
| [ Email ]                                      |
+------------------------------------------------+
| Delivery details                               |
| [ Company / Store name ]                       |
| [ Address ]                                    |
| [ Use current location ]                       |
+------------------------------------------------+
| Notes                                          |
| [ Special instructions ]                       |
+------------------------------------------------+
| Order summary                                  |
| Items                                  R 1,680 |
| Tax                                    R   252 |
| Total                                  R 1,932 |
+------------------------------------------------+
| [ Place order ]                                |
+------------------------------------------------+
```

### Client Account Wireframe

```
+------------------------------------------------+
| Account                                        |
+------------------------------------------------+
| Client name                                    |
| client@example.com                             |
+------------------------------------------------+
| [ Orders ]                                     |
| [ Saved delivery details ]                     |
| [ Profile ]                                    |
| [ Sign out ]                                   |
+------------------------------------------------+
```

### Guest Account Wireframe

```
+------------------------------------------------+
| Account                                        |
+------------------------------------------------+
| Sign in to place orders and view your history. |
+------------------------------------------------+
| [ Sign in ]                                    |
| [ Create account ]                             |
+------------------------------------------------+
```

---

## Sales Field App Design

The current sales app should remain operationally focused. It is not the public shop; it is for speed while working with customers.

### Existing Sales Tabs

```
+------------------------------------------------+
| Catalog | Cart | Orders | Customers | Profile  |
+------------------------------------------------+
```

### Suggested Sales Improvements

- Add customer selector at the top of catalog/cart when a sales rep is building an order.
- Keep customer creation fast from the cart flow.
- Optionally allow sales reps to preview `Client Shop` after login.
- Keep sales-only controls hidden in client shop mode.

### Sales Cart Wireframe

```
+------------------------------------------------+
| Cart                                           |
+------------------------------------------------+
| Customer                                       |
| [ Select customer v ]       [ + New customer ] |
+------------------------------------------------+
| Items                                          |
| +--------------------------------------------+ |
| | Product / variation / quantity / price     | |
| +--------------------------------------------+ |
+------------------------------------------------+
| Notes                                          |
| [ Delivery notes or sales notes ]              |
+------------------------------------------------+
| Total                                  R 1,932 |
+------------------------------------------------+
| [ Submit order ]                              |
+------------------------------------------------+
```

---

## Admin Console Design

The admin side should remain a control panel, not an e-commerce page.

### Existing Admin Tabs

```
+------------------------------------------------+
| Dashboard | Products | Orders | Users | Settings|
+------------------------------------------------+
```

### Admin Additions Needed

- Users page should support `client`, `sales_rep`, and `admin` roles.
- Add visibility into client accounts and linked customer records.
- Optionally add admin-only view access for Sales/Shop previews after login.
- Add storefront settings later if needed: featured categories, banners, public catalog rules.

### Admin Dashboard Concept

```
+------------------------------------------------+
| Dashboard                          [View as]   |
+------------------------------------------------+
| Today                                            |
| +----------+ +----------+ +----------+          |
| | Orders   | | Revenue  | | Clients  |          |
| +----------+ +----------+ +----------+          |
+------------------------------------------------+
| Operational queues                              |
| +--------------------------------------------+ |
| | Pending orders                              | |
| | Orders needing sync                         | |
| | Low stock products                          | |
| +--------------------------------------------+ |
+------------------------------------------------+
```

---

## Login and Signup Experience

### One Login

The login screen should not ask the user to choose their role manually. The system should identify the role after credentials are validated, then redirect automatically.

```
+------------------------------------------------+
| e-order                                        |
| Sign in                                       |
+------------------------------------------------+
| [ Email ]                                      |
| [ Password ]                                   |
| [ Sign in ]                                    |
+------------------------------------------------+
| New client? [ Create account ]                 |
+------------------------------------------------+
```

### Login Decision Flow

```
User enters email/password
  |
  v
Convex validates credentials
  |
  v
Load user.role from users table
  |
  +--> role = client    -> /(shop)
  +--> role = sales_rep -> /(sales)/catalog
  +--> role = admin     -> /(admin)/dashboard
```

### Client Signup

Client signup should create a login user with role `client` and either:

- create a linked `customers` record immediately, or
- create a lightweight client profile and complete customer/delivery details during checkout.

Recommended first implementation: create a `users` record with role `client` and optional `customerId`, then collect full delivery/customer fields at checkout.

```
+------------------------------------------------+
| Create account                                 |
+------------------------------------------------+
| [ Name ]                                       |
| [ Email ]                                      |
| [ Phone ]                                      |
| [ Password ]                                   |
| [ Create account ]                             |
+------------------------------------------------+
| Already have an account? [ Sign in ]           |
+------------------------------------------------+
```

---

## Convex Data Model Changes

The current schema supports `admin` and `sales_rep` users only. It needs a client role and a stronger separation between login identity and customer/company details.

### Users Table

Current:

```
role: "admin" | "sales_rep"
```

Recommended:

```
role: "admin" | "sales_rep" | "client"
customerId?: Id<"customers">
lastPreviewedInterface?: "sales" | "shop" optional later
```

Do not use `allowedInterfaces` for the normal login path. The user's primary `role` should be the source of truth.

### Customers Table

Keep `customers` as the business/customer/delivery record. This table is already useful for both sales-created customers and self-service client accounts.

Recommended additions:

```
createdByUserId?: Id<"users">
accountOwnerUserId?: Id<"users">
defaultDeliveryInstructions?: string
billingName?: string
```

### Orders Table

Current orders are sales-rep centered:

```
salesRepId
salesRepName
customerName
customerPhone
customerEmail
customerAddress
```

Recommended additions:

```
orderSource: "client_shop" | "sales_rep" | "admin"
clientUserId?: Id<"users">
customerId?: Id<"customers">
placedByUserId: Id<"users">
salesRepId?: string
```

For backwards compatibility, keep the existing customer snapshot fields on the order. That is useful because an order should preserve what the delivery/contact data was at the time of purchase.

### Optional Future Tables

Only add these if the storefront needs more control:

```
storefrontSettings
  key
  value
  updatedAt
  updatedBy

clientAddresses
  userId
  label
  name
  phone
  address
  latitude
  longitude
  isDefault
```

---

## Auth and Permission Plan

### Current State

The app stores the authenticated user in `AsyncStorage` and validates credentials through Convex. This is workable for the current internal app, but the client-facing version increases risk because external clients will be using it.

### Recommended Direction

For production client access, plan a proper auth upgrade:

- Hash passwords server-side if keeping custom auth.
- Prefer Convex Auth or another managed auth layer for client accounts.
- Never store plain text passwords or compare raw passwords in production.
- Add permission checks inside Convex functions, not only in the UI.

### UI Permission Rules

```
canAccessShop:
  guest, client, sales_rep, admin

canCheckout:
  client, sales_rep, admin

canAccessSales:
  sales_rep, admin

canAccessAdmin:
  admin
```

### Route Guard Plan

The route protection hook should change from "authenticated or login" to route-aware access:

```
+----------------+----------------------+-------------------+
| Route Group    | Guest Allowed?       | Required Role     |
+----------------+----------------------+-------------------+
| (shop) browse  | Yes                  | none              |
| (shop) checkout| No                   | client/sales/admin|
| (auth)         | Yes                  | none              |
| (sales)        | No                   | sales/admin       |
| (admin)        | No                   | admin             |
+----------------+----------------------+-------------------+
```

---

## Shared UI Components Needed

The app already has reusable components like `Button`, `Input`, `Card`, `SearchBar`, `ProductCard`, `OrderCard`, `Toast`, and modals.

Recommended additions:

```
components/
  RoleViewMenu.tsx optional
  AccountMenu.tsx
  ShopProductCard.tsx
  CategoryPill.tsx
  QuantityStepper.tsx
  PriceSummary.tsx
  CheckoutContactForm.tsx
  EmptyState.tsx
  AuthPrompt.tsx
```

The sales product card and shop product card should not necessarily be the same. The sales card can prioritize speed, SKU, MOQ, and stock. The shop card can prioritize image, name, price, and a clean add-to-cart action.

---

## Visual Design Direction

Use the current neutral design foundation:

```
Background:        #FAFAFA
Surface:           #FFFFFF
Primary text:      #171717
Secondary text:    #525252
Border:            #E5E5E5
Success:           #10B981
Warning:           #F59E0B
Danger:            #EF4444
Info:              #3B82F6
```

### Design Principles

- Client shop: product-first, visual, simple, e-commerce familiar.
- Sales app: dense, fast, customer/order workflow focused.
- Admin console: operational, scan-friendly, management focused.
- Keep one brand language across all three, but change layout density and navigation per role.

### Component Style

```
+----------------------+---------------------------------------+
| Area                 | Design Direction                      |
+----------------------+---------------------------------------+
| Shop product cards   | Larger image, price, Add button       |
| Sales catalog cards  | SKU, stock, MOQ, quick quantity       |
| Admin cards          | Metrics, tables, filters, statuses    |
| Buttons              | Clear primary/secondary hierarchy     |
| Forms                | Labelled fields, simple validation    |
| Status labels        | Pending, confirmed, shipped, etc.     |
+----------------------+---------------------------------------+
```

---

## Order Flows

### Guest to Client Order Flow

```
Open app
  |
  v
Browse public shop
  |
  v
Add products to cart
  |
  v
Tap checkout
  |
  v
Sign in / create account
  |
  v
Return to checkout with cart preserved
  |
  v
Enter delivery/contact details
  |
  v
Place order
  |
  v
View order confirmation and history
```

### Sales Rep Order Flow

```
Sign in
  |
  v
Sales catalog
  |
  v
Select existing customer or create customer
  |
  v
Add products to cart
  |
  v
Review customer, delivery, notes, totals
  |
  v
Submit order
  |
  v
Track order under sales orders
```

### Admin Flow

```
Sign in
  |
  v
Admin dashboard
  |
  +--> Manage products
  +--> Manage orders
  +--> Manage users and clients
  +--> Manage settings and Ecwid sync
  |
  v
Switch to Sales or Shop when needed
```

---

## Logical Implementation Phases

### Phase 1: Planning and Structure

- Move login conceptually from root `/` to `(auth)/sign-in`.
- Make root route public storefront.
- Define route access rules for `(shop)`, `(sales)`, `(admin)`, and `(auth)`.
- Decide if guest carts are allowed before login. Recommended: yes, stored locally.

### Phase 2: Convex Schema and Permissions

- Add `client` to the `users.role` union.
- Add optional `customerId` to users.
- Add order source fields to orders.
- Add client-safe product/category queries.
- Add mutation for client order placement.
- Add role checks inside sensitive Convex mutations.

### Phase 3: Public Shop UI

- Build `(shop)` shell.
- Build public catalog and product detail screens.
- Reuse product/category data from Convex.
- Create shop cart and checkout flow.
- Preserve cart across login.

### Phase 4: Client Accounts

- Build client signup.
- Build client account page.
- Build client order history.
- Link users to customer records.

### Phase 5: Optional Post-Login View Access

- Add a `RoleViewMenu` only if admin/sales preview access is still required.
- Allow sales reps to preview the client shop after login if useful.
- Allow admins to preview sales/shop views after login if useful.
- Keep login redirects based on `user.role`, not a selected interface.

### Phase 6: Admin Updates

- Update user management to support client users.
- Add client/customer linking view.
- Add order filters by source: client shop, sales rep, admin.
- Add dashboard metrics for client orders.

### Phase 7: Production Hardening

- Replace raw password handling with proper auth/password hashing.
- Add server-side permission checks everywhere.
- Add audit fields for orders and admin changes.
- Add tests for role redirects, checkout, and permission enforcement.

---

## Key Decisions To Confirm Before Coding

1. Should guests be allowed to add items to cart before login?
   - Recommended: yes. This matches normal e-commerce behavior and reduces friction.

2. Should clients create their own accounts, or should admins invite/create them?
   - Recommended: allow self-signup first, then add admin approval later if needed.

3. Should every client account be linked to a customer/company record?
   - Recommended: yes, but allow checkout to complete missing customer details.

4. Should sales reps see all clients or only assigned clients?
   - Recommended: start with all active customers if that matches current business flow, then add assignment later.

5. Should pricing be identical for guests, clients, and sales reps?
   - Recommended: start identical. Add customer-specific pricing only after base flows are stable.

---

## Suggested First Code Change Set

When ready to code, the first change should be small and structural:

```
1. Create app/(auth)/sign-in.tsx by moving the current login screen.
2. Change app/index.tsx into the public shop entry.
3. Add app/(shop)/_layout.tsx and the first catalog screen.
4. Update useProtectedRoute to allow public shop routes.
5. Add "client" to Convex user roles.
6. Add route redirects based only on `user.role`.
```

This creates the correct foundation without rewriting the existing sales/admin functionality.

---

## Development Testing Strategy

The safest way to test this idea is to avoid changing the working sales/admin app first. Build and validate the flow in layers.

### Testing Layers

```
+----------------------+----------------------+---------------------------+
| Layer                | Purpose              | Risk To Current App       |
+----------------------+----------------------+---------------------------+
| Static flow mockup   | Confirm navigation   | None                      |
| Isolated prototype   | Test screens/clicks  | Very low                  |
| Dev-only app routes  | Test in Expo         | Low if behind dev flag    |
| Convex dev data      | Test real data flow  | Low if separate dev env   |
| Production rollout   | Real users           | Only after validation     |
+----------------------+----------------------+---------------------------+
```

### Recommended Approach

Start with a separate development branch and a dev-only feature flag. This lets the new client shop be tested without replacing the current login, sales, or admin flows.

```
main/current app
  |
  v
codex/client-shop-prototype branch
  |
  v
dev-only shop routes + mock data
  |
  v
Convex dev deployment
  |
  v
role-based login test accounts
  |
  v
merge once flow is approved
```

### Stage 1: Static Click Flow

Before touching app behavior, create a lightweight clickable or screen-by-screen flow using mock data.

What to test:

- Can a guest understand that they can browse without signing in?
- Does checkout naturally ask for login at the right time?
- Does the client account area make sense?
- Does the sales app still feel separate from the client shop?
- Does admin still clearly land in the admin console?

Expected result:

```
Guest -> Shop -> Product -> Cart -> Sign in -> Checkout -> Confirmation
Client -> Sign in -> Shop/Checkout -> Orders
Sales rep -> Sign in -> Sales Catalog -> Cart -> Submit Order
Admin -> Sign in -> Dashboard -> Manage/Preview
```

### Stage 2: Isolated UI Prototype

Build the client shop screens with local mock data first. Do not connect Convex yet.

Prototype routes can be temporary:

```
app/(prototype-shop)/
  _layout.tsx
  index.tsx
  product/[id].tsx
  cart.tsx
  checkout.tsx
  account.tsx
```

Or, if we want zero Expo route impact, create a standalone prototype under:

```
prototypes/client-shop/
  index.html
  styles.css
  mock-data.js
```

The standalone prototype is the lowest-risk option because it does not touch the app runtime at all.

### Stage 3: Dev-Only App Integration

Once the flow feels correct, add a guarded shop route in the Expo app.

Recommended guard:

```
ENABLE_CLIENT_SHOP_DEV=true
```

When disabled:

```
Current app behavior remains unchanged.
```

When enabled:

```
Root route can show the new public shop during development.
```

This lets us test on:

- Expo web
- Expo Go
- Android development build if needed

### Stage 4: Convex Dev Data

Use Convex development data before touching production records.

Create test accounts:

```
+----------------------+-------------------------+-----------+
| Email                | Role                    | Expected  |
+----------------------+-------------------------+-----------+
| client@test.local    | client                  | Shop      |
| sales@test.local     | sales_rep               | Sales app |
| admin@test.local     | admin                   | Admin     |
+----------------------+-------------------------+-----------+
```

Create a small test catalog:

```
Categories:
  Drinks
  Snacks
  Cleaning

Products:
  5-10 active products
  2 products with variations
  1 product with MOQ
  1 product with low stock
  1 product with promotion ribbon
```

Create test order cases:

```
Client shop order
Sales rep order for existing customer
Sales rep order for new customer
Admin-created or admin-edited order
Cancelled order
Delivered order
```

### Stage 5: Flow Test Checklist

Use this checklist before deciding that the design is ready for real integration.

```
+------------------------------------------------------+--------+
| Test                                                 | Status |
+------------------------------------------------------+--------+
| Guest can browse products without login              |        |
| Guest can add items to cart if we allow guest cart    |        |
| Guest is asked to log in only at checkout             |        |
| Cart survives login/signup                            |        |
| Client logs in and lands in shop                      |        |
| Sales rep logs in and lands in sales catalog          |        |
| Admin logs in and lands in admin dashboard            |        |
| Client cannot access sales/admin routes               |        |
| Sales rep cannot access admin routes                  |        |
| Admin can access admin routes                         |        |
| Client order writes correct orderSource               |        |
| Sales order writes correct orderSource                |        |
| Order history only shows the right user's orders      |        |
| Admin orders page can see all order sources           |        |
+------------------------------------------------------+--------+
```

### Stage 6: What Can Be Tested Without Touching The Current App

We can test quite a lot without changing the active app behavior:

```
+-----------------------------------+---------------------------+
| Can Test Without Main App Changes | How                       |
+-----------------------------------+---------------------------+
| Storefront layout                 | Standalone prototype      |
| Product browsing flow             | Mock data prototype       |
| Cart UX                           | Local state prototype     |
| Checkout screens                  | Mock form submission      |
| Role redirect logic               | Small isolated test file   |
| Data model shape                  | Convex dev schema branch   |
+-----------------------------------+---------------------------+
```

What cannot be fully tested without app integration:

```
+-----------------------------------+---------------------------+
| Needs App Integration             | Why                       |
+-----------------------------------+---------------------------+
| Real Expo navigation behavior     | Uses expo-router          |
| Current cart context interaction  | Uses app providers        |
| Real Convex mutations             | Needs generated API/types |
| Actual login persistence          | Uses AuthContext/storage  |
| Route protection behavior         | Uses useProtectedRoute    |
+-----------------------------------+---------------------------+
```

### Recommended First Test Build

The first real build should be a prototype, not a full rewrite.

```
1. Create a development branch.
2. Create standalone or hidden client-shop prototype screens.
3. Use mock products that match the current product shape.
4. Test guest browse -> cart -> login prompt -> checkout.
5. Add test accounts in Convex dev.
6. Test role redirects with client/sales/admin users.
7. Only then connect checkout to real Convex order creation.
```

This gives a working demo of the experience while protecting the current sales/admin application.

---

## Recommended Target Experience

The finished application should feel like this:

```
+---------------------------------------------------------------+
| Client opens app                                               |
| -> Sees storefront immediately                                 |
| -> Browses products                                            |
| -> Logs in only at checkout                                    |
+---------------------------------------------------------------+
| Sales rep opens app                                            |
| -> Logs in                                                     |
| -> Lands in sales catalog                                      |
| -> Can create orders for customers                             |
| -> Can optionally preview the client shop after login           |
+---------------------------------------------------------------+
| Admin opens app                                                |
| -> Logs in                                                     |
| -> Lands in admin dashboard                                    |
| -> Can manage all platform data                                |
| -> Can optionally preview sales/shop views after login          |
+---------------------------------------------------------------+
```

This keeps one application and one login system, with the user role deciding the correct interface automatically.
