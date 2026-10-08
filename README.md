# Lister — Excel manifest → Square POS

## Run
1. Install Node 20+ (nodejs.org)
2. In this folder:
   npm install
   cp .env.example .env.local      (then paste your Square token in .env.local)
   npm run dev
3. Open http://localhost:3000

No token = DEMO mode (nothing posted). Use SQUARE_ENV=sandbox to test safely first.

## Square token
developer.squareup.com > Applications > + New app > Credentials > Production Access token.
Needs permissions: ITEMS_READ, ITEMS_WRITE, INVENTORY_WRITE, MERCHANT_PROFILE_READ.

## What gets posted per row
- Item name    = Item Description
- SKU          = the A1369-style code column
- Price        = "price" column (currency taken from your Square location)
- Variation    = Model Number
- Category     = Product Category (created in Square if it doesn't exist)
- Description  = Brand / Model / Type / RRP
- Stock        = 1 (each row = one unit). Turn off with SQUARE_SET_STOCK=false

SKUs already in Square are skipped, so re-uploading the same sheet is safe.
Totals/blank rows are ignored. Missing name/SKU/price, or any Square error, opens the bottom drawer to fix or skip.
