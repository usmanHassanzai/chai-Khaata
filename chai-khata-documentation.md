# Chai Khata — Component Guide

This document explains every part of your tea shop system: what it does, what fields it has, how the numbers are calculated, and how the five components talk to each other.

---

## How the components connect

```
   GODAAM (Warehouse)                    DUKAAN (Sale)
   ─────────────────                     ─────────────
   You register a Dealer          →      Dealer dropdown in
   and log Purchases                     purchase form is fed
   (bags, weight, price)                 by registered dealers

   Every Purchase entry            →     STOCK LEDGER adds up
   adds kg to stock                      all purchases minus
                                          all sales, tea by tea

   STOCK LEDGER                    →     DUKAAN checks this
                                          before allowing a sale
                                          (can't sell more than
                                          you have)

   DUKAAN sale                     →     If sold to a registered
   (optionally linked                    Customer, updates that
   to a Customer)                        customer's total/due

   DASHBOARD                       ←     Pulls live numbers from
                                          all four components above
```

Nothing is entered twice. You register a dealer once, buy from them many times. You register a customer once, sell to them many times. Stock and dues are always calculated from the underlying entries — never typed in by hand — so the numbers can't drift out of sync.

---

## 1. Dashboard

**Purpose:** A one-glance summary of the whole shop, refreshed instantly from the other four components. You don't enter anything here.

| Card | What it shows | How it's calculated |
|---|---|---|
| Today's Sale | Total rupees sold today | Sum of `total` for all sales dated today |
| This Month Sale | Total rupees sold this calendar month | Sum of `total` for sales in the current month |
| This Year Sale | Total rupees sold this calendar year | Sum of `total` for sales in the current year |
| This Month Profit | Profit earned this month | Sum of `profit` for sales in the current month |
| Stock Value | What your current tea stock is worth at cost | For each tea: `(current stock kg) × (average purchase cost/kg)`, summed |
| Pending Customer Dues | Money customers still owe you | Sum of every customer's pending balance |
| Pending Dealer Dues | Money you still owe dealers | Sum of every dealer's due balance |
| Low Stock Alerts | Count of teas below your threshold | Compares current stock per tea to the threshold set in Stock Ledger |

Below the cards: your 6 most recent sales, and a list of any teas currently running low.

---

## 2. Dukaan (Sale) — daily selling

**Purpose:** Record every sale, see what's in stock as you sell, and know your profit instantly.

### Fields on the Sale form

| Field | Type | Notes |
|---|---|---|
| Date | date | Defaults to today |
| Tea Name | text (autocomplete) | Suggests tea names already in your stock |
| Quantity Sold (kg) | number | What you're handing over |
| Sale Price / kg | number | What you're charging |
| Customer | dropdown | "Walk-in" or any registered customer |
| Amount Received Now | number | Only shown if a customer is selected; leave blank to mark as fully paid |

### What happens automatically

- **Live stock check** — as you type the tea name and quantity, it shows how much of that tea you actually have. If you try to sell more than you have, the form blocks the sale with a warning.
- **Live profit** — `profit = (sale price/kg − average purchase cost/kg) × quantity`. The average purchase cost comes from your Godaam entries for that tea.
- **Stock deduction** — the moment you save the sale, that quantity is subtracted from stock. You never touch the stock number directly.
- **Customer balance update** — if you picked a customer and didn't mark it fully paid, the unpaid part becomes their **pending amount**, visible in the Customers tab.

### The sales table

Filter by Today / Month / Year / All, or search by tea name or customer. Totals for quantity, sale value, and profit are shown at the bottom of whatever range you're viewing. Each row can be deleted (this restores the stock and reverses any customer balance change).

---

## 3. Godaam (Warehouse) — buying stock from dealers

This is split into two jobs: **who you buy from** (dealers) and **what you bought** (purchases).

### 3a. Add Dealer

You register a dealer once before buying from them.

| Field | Notes |
|---|---|
| Dealer Name | Required, must be unique |
| Phone Number | Optional |
| Address | Optional |
| Opening Due | Optional — if this dealer already had an unpaid balance before you started using Chai Khata, enter it here so the running total is correct from day one |

### 3b. Add Purchase from Dealer

This is where a delivery of tea gets logged and added to your stock.

| Field | Type | Notes |
|---|---|---|
| Date | date | |
| Dealer | dropdown | Only registered dealers appear here |
| Tea Name | text | |
| Bags Ordered | number | How many bags you agreed to buy |
| Bags Received | number | How many actually arrived today |
| Bag Weight (kg/bag) | number | The standard weight, defaults to 62 |
| **Standard Total Weight** | auto | `Bags Received × Bag Weight` |
| Miss Weight / Shortage (kg) | number | Total kg short if some bags were underweight |
| **Net Weight — Stock Qty** | auto | `Standard Total Weight − Miss Weight` — this is the real amount added to stock |
| Price per kg | number | What you're paying |
| **Total Price** | auto | `Net Weight × Price per kg` — you only pay for what actually arrived |
| Deposit Paid Now | number | What you're handing the dealer today |
| **Due Amount (this purchase)** | auto | `Total Price − Deposit Paid Now` |
| **Remaining Balance (dealer total)** | auto | This purchase's due **plus** everything already owed to that dealer from before |
| Pending Bags | auto | `Bags Ordered − Bags Received` — bags still expected |

**Why Miss Weight matters:** dealers agree on a standard bag weight (commonly 62 kg), but real bags sometimes come in light. Instead of guessing, you weigh the delivery, enter the total shortfall in one field, and every downstream number — stock, total price, and stock value on the dashboard — reflects the real weight, not the paper weight.

### Dealer Summary

One row per dealer: total purchased all-time, total deposited/paid, and current due. An **Add Payment** button lets you record a payment to a dealer that isn't tied to a specific delivery (e.g. clearing an old balance). A **Remove** button unregisters a dealer without deleting their purchase history.

### Purchase Entries table

Every delivery you've logged, with standard weight, miss weight, and net quantity side by side so shortages are easy to spot. Searchable by dealer or tea name.

---

## 4. Customers

**Purpose:** Track who you sell to on credit, and what they still owe.

### Add Customer

| Field | Notes |
|---|---|
| Customer Name | Required |
| Phone Number | Optional |
| Address | Optional |
| Customer ID | Auto-generated (`CUST-0001`, `CUST-0002`, ...) — you never type this |

### How a customer's numbers are calculated

Nothing about totals is typed in — it's all derived from their sale history, so it can never fall out of sync:

- **Total Amount / Total Sale** — sum of every sale linked to this customer
- **Receiving Amount** — sum of "amount received now" from linked sales, plus any extra payments logged separately
- **Pending Amount** — `Total Amount − Receiving Amount`

### Actions available per customer

- **Add Payment** — logs a standalone payment (e.g. they come in later and pay off part of their tab) without needing to tie it to a new sale
- **View History** — opens a full breakdown: every sale made to them and every payment received, plus their running totals
- **Delete** — removes the customer record; their past sales are kept and relabelled so your historical totals don't change

---

## 5. Stock Ledger

**Purpose:** A live inventory sheet — one row per tea name, always up to date.

| Column | How it's calculated |
|---|---|
| Total Received | Sum of net weight from all Godaam purchases of this tea |
| Total Sold | Sum of quantity from all Dukaan sales of this tea |
| Current Stock | `Total Received − Total Sold` |
| Avg. Cost/kg | `Total purchase cost ÷ Total Received` — a running average across all deliveries |
| Stock Value | `Current Stock × Avg. Cost/kg` |
| Status | "Low" if Current Stock is below your threshold, otherwise "OK" |

You set the **low stock threshold** (in kg) at the top of this tab — it applies to every tea and drives the Dashboard's low-stock alert count.

---

## Data & privacy

Everything you enter is saved automatically to this device as you go — there's no login and no server; it's yours alone. Nothing is shared unless you export or share the file yourself.

---

## Quick reference: what feeds what

- **Dealers** → picked in Godaam purchase form
- **Godaam purchases** → build Stock Ledger, set average cost used for profit
- **Stock Ledger** → checked live during every sale
- **Dukaan sales** → reduce stock, optionally update a Customer's balance
- **Customers** → shown as options in the Sale form, tracked independently for dues
- **Dashboard** → read-only view pulling from all of the above
