# MoneyPlant — Category Taxonomy (for review)

Curated base list for the **Spending** section and the parser's keyword→category map (PRD §6.3, §18.4). India-first. Edit freely: add rows, add keywords, rename, or mark categories to drop. The keyword column is what Stage-2 matching uses to auto-categorize a chat message with no AI call.

> Convention: keep a **curated top-level list** (recommended in PRD §16.5) and let subtypes/notes capture detail. Anything unmatched falls to **Other** (or the AI fallback).

---

## Expense categories

| # | Category | Covers | Example keywords (parser hints) |
|---|---|---|---|
| 1 | **Food & Dining** | Restaurants, eating out, food delivery | dining, restaurant, lunch, dinner, zomato, swiggy, eatery, biryani, pizza |
| 2 | **Coffee & Snacks** | Cafés, tea, quick bites | coffee, tea, starbucks, café, cafe, snacks, chai, bakery |
| 3 | **Groceries** | Supermarket, kirana, quick-commerce | groceries, supermarket, bigbasket, blinkit, zepto, instamart, vegetables, kirana, milk |
| 4 | **Transport** | Cabs, fuel, public transit, parking | uber, ola, auto, rapido, petrol, diesel, fuel, metro, bus, train, cab, parking, toll, fastag |
| 5 | **Shopping** | Apparel, footwear, general retail | clothes, apparel, myntra, ajio, shoes, footwear, shopping, amazon, flipkart |
| 6 | **Electronics & Gadgets** | Devices, accessories, appliances | laptop, phone, mobile, headphones, charger, gadget, appliance, tv, electronics |
| 7 | **Bills & Utilities** | Electricity, water, gas, internet, recharge | electricity, water, gas, broadband, wifi, internet, recharge, dth, postpaid, bill |
| 8 | **Rent & Housing** | Rent, society maintenance | rent, maintenance, society, flat, pg |
| 9 | **EMI & Loans** | Loan repayments, credit card dues | emi, loan, credit card, cc bill, repayment |
| 10 | **Health & Medical** | Pharmacy, doctor, hospital, tests | pharmacy, medicine, doctor, hospital, apollo, clinic, lab, test, dental |
| 11 | **Fitness & Wellness** | Gym, sports, supplements, spa | gym, yoga, fitness, supplement, protein, spa, sports |
| 12 | **Entertainment** | Movies, events, games | movie, bookmyshow, cinema, concert, event, game, gaming |
| 13 | **Subscriptions** | OTT, music, apps, SaaS | netflix, spotify, prime, hotstar, youtube, subscription, saas, icloud |
| 14 | **Education** | Courses, books, tuition, fees | course, udemy, coursera, book, tuition, fees, exam, class |
| 15 | **Travel** | Flights, hotels, trips | flight, hotel, makemytrip, goibibo, irctc, airbnb, trip, vacation, booking |
| 16 | **Personal Care** | Salon, grooming, cosmetics | salon, haircut, grooming, cosmetics, skincare, parlour |
| 17 | **Household & Home** | Furniture, decor, repairs, utensils | furniture, ikea, decor, utensils, repair, plumber, electrician, home |
| 18 | **Gifts & Donations** | Gifting, charity | gift, donation, charity, tip, daan |
| 19 | **Insurance** | Premiums of any kind | insurance, premium, lic, policy, health cover |
| 20 | **Taxes & Fees** | Tax, bank/transaction charges | tax, gst, tds, bank charge, fee, penalty, fine |
| 21 | **Kids & Family** | Childcare, school, toys | school, daycare, kids, toys, baby, child |
| 22 | **Pets** | Pet food, vet, supplies | pet, dog, cat, vet, pet food |
| 23 | **Other / Misc** | Fallback for unmatched expenses | misc, other, cash |

---

## Investment categories (type = investment)

| # | Category | Covers | Example keywords |
|---|---|---|---|
| I1 | **Mutual Fund** | SIPs and lumpsum MF | mutual fund, mf, sip, elss, index fund, lumpsum |
| I2 | **Stocks / Equity** | Direct shares | stock, share, equity, nse, bse |
| I3 | **Gold** | Digital gold, SGB, jewellery as investment | gold, digital gold, sgb, sovereign |
| I4 | **Fixed Deposit / RD** | FDs, recurring deposits | fd, fixed deposit, rd, recurring deposit |
| I5 | **PPF / EPF / NPS** | Retirement & govt schemes | ppf, epf, nps, pf |
| I6 | **Bonds** | Govt/corporate bonds | bond, gsec, debenture |
| I7 | **Crypto** | Crypto assets | crypto, bitcoin, btc, eth, ethereum |
| I8 | **Real Estate** | Property | real estate, property, plot, land |

---

## Optional: Income categories (not in v1 scope — add only if you want income tracking)

PRD scope is expenses + investments. If you later add income: **Salary**, **Freelance / Business**, **Refund / Cashback**, **Interest / Dividend**, **Gift Received**, **Other Income**.

---

## Decisions for you to make
1. Keep **Coffee & Snacks** separate from **Food & Dining**, or merge? (You listed them separately, so kept apart.)
2. Is this the **fixed curated list** users pick from, or can the AI propose new categories that map into these? (PRD §16.5 recommends curated.)
3. Any categories to add (e.g. **Charity**, **Business Expense**, **Festivals**) or drop?
4. Should **Subscriptions** be its own category or a tag on **Bills & Utilities** / **Entertainment**?
