(function (root) {
  'use strict';
  const C = (id, name, icon, items) => ({ id, name, icon, items });
  const I = (name, price, unit, extra) => Object.assign({ name, price, unit }, extra || {});
  const MENUS = {
    grocery: [
      C('produce', 'Produce', 'leaf', [I('Bananas', 1.89, 'bunch, ~2.5 lb'), I('Honeycrisp apples', 5.99, '3 lb bag'), I('Baby spinach', 3.99, '5 oz'), I('Avocados', 4.99, '4 ct'), I('Lemons', 0.79, 'each'), I('Strawberries', 4.49, '1 lb'), I('Yellow onions', 3.49, '3 lb bag'), I('Organic carrots', 1.99, '2 lb')]),
      C('dairy', 'Dairy & eggs', 'drop', [I('Whole milk', 4.49, '1 gal'), I('2% reduced-fat milk', 4.29, '1 gal'), I('Large eggs', 3.99, 'dozen'), I('Greek yogurt, plain', 5.79, '32 oz'), I('Unsalted butter', 4.99, '1 lb'), I('Shredded mozzarella', 3.79, '8 oz'), I('Oat milk', 4.99, '64 oz', { inStock: false })]),
      C('bakery', 'Bakery', 'bread', [I('Sliced whole wheat bread', 3.99, '20 oz'), I('Everything bagels', 4.49, '6 ct'), I('Challah', 6.99, 'loaf'), I('Croissants', 5.99, '4 ct')]),
      C('meat', 'Meat & seafood', 'flame', [I('Boneless chicken breast', 9.99, '~2 lb'), I('Ground beef 85%', 7.49, '1 lb'), I('Atlantic salmon fillet', 12.99, '~1 lb'), I('Sliced turkey breast', 8.99, '1 lb, deli')]),
      C('pantry', 'Pantry', 'box', [I('Spaghetti', 1.79, '16 oz'), I('Marinara sauce', 4.29, '24 oz'), I('Cheerios', 5.49, '18 oz'), I('Peanut butter', 3.99, '16 oz'), I('Extra-virgin olive oil', 9.99, '500 ml'), I('Basmati rice', 6.49, '2 lb'), I('Coffee, ground', 9.99, '12 oz')]),
      C('frozen', 'Frozen', 'snow', [I('Frozen peas', 2.29, '16 oz'), I('Vanilla ice cream', 5.99, '1.5 qt'), I('Frozen pizza, margherita', 7.49, '1 ct')]),
      C('household', 'Household', 'sparkles', [I('Paper towels', 11.99, '6 rolls'), I('Toilet paper', 13.49, '12 rolls'), I('Dish soap', 3.49, '19 oz'), I('Trash bags, 13 gal', 8.99, '40 ct')])
    ],
    pharmacy: [
      C('pain', 'Pain & fever', 'pill', [I('Ibuprofen 200 mg', 9.49, '100 ct'), I('Acetaminophen 500 mg', 8.99, '100 ct'), I('Children’s acetaminophen', 9.99, '4 oz'), I('Aspirin 81 mg', 6.49, '120 ct')]),
      C('cold', 'Cold & allergy', 'sneeze', [I('Loratadine 10 mg', 14.99, '30 ct'), I('Cough syrup, DM', 10.99, '8 oz'), I('Saline nasal spray', 5.49, '1.5 oz'), I('Throat lozenges', 3.99, '30 ct'), I('Thermometer, digital', 11.99, 'each')]),
      C('firstaid', 'First aid', 'cross', [I('Bandages, assorted', 4.99, '60 ct'), I('Antibiotic ointment', 6.99, '1 oz'), I('Hydrogen peroxide', 1.99, '16 oz')]),
      C('vitamins', 'Vitamins', 'leaf', [I('Vitamin D3 2000 IU', 9.99, '120 ct'), I('Multivitamin', 13.99, '100 ct'), I('Melatonin 3 mg', 7.99, '120 ct')]),
      C('personal', 'Personal care', 'drop', [I('Toothpaste', 4.49, '4.8 oz'), I('Shampoo', 6.99, '13.5 oz'), I('Deodorant', 5.99, '2.6 oz'), I('Sunscreen SPF 50', 10.99, '5 oz')]),
      C('baby', 'Baby', 'heart', [I('Diapers, size 3', 27.99, '84 ct'), I('Baby wipes', 4.99, '72 ct')])
    ],
    hardware: [
      C('tools', 'Tools', 'wrench', [I('Claw hammer, 16 oz', 14.99, 'each'), I('Screwdriver set', 19.99, '6 pc'), I('Tape measure, 25 ft', 12.99, 'each'), I('Utility knife', 8.99, 'each')]),
      C('electrical', 'Electrical & lighting', 'bolt', [I('LED bulbs, 60W equiv.', 9.99, '4 pk'), I('AA batteries', 12.99, '12 pk'), I('Extension cord, 15 ft', 11.99, 'each'), I('Smoke detector', 21.99, 'each')]),
      C('fasteners', 'Fasteners', 'box', [I('Wood screws, #8 × 1¼"', 6.49, '100 ct'), I('Picture-hanging kit', 7.99, 'kit'), I('Wall anchors', 5.49, '50 ct')]),
      C('paint', 'Paint & supplies', 'brush', [I('Painter’s tape', 6.99, '1.88" × 60 yd'), I('Paint roller kit', 14.99, '9"'), I('Spackle', 5.99, '8 oz')]),
      C('garden', 'Lawn & garden', 'leaf', [I('Potting mix', 9.99, '16 qt'), I('Garden hose, 50 ft', 29.99, 'each'), I('Ice melt', 14.99, '20 lb')]),
      C('cleaning', 'Cleaning', 'sparkles', [I('Contractor bags', 19.99, '20 ct'), I('Drain cleaner', 8.49, '32 oz')])
    ],
    pet: [
      C('dog', 'Dog', 'paw', [I('Dry dog food, chicken', 32.99, '15 lb'), I('Dog treats', 7.99, '16 oz'), I('Poop bags', 9.99, '240 ct'), I('Chew toy', 8.99, 'each')]),
      C('cat', 'Cat', 'paw', [I('Dry cat food', 18.99, '7 lb'), I('Wet cat food', 14.49, '12 cans'), I('Clumping litter', 16.99, '25 lb')]),
      C('fish', 'Fish & small pets', 'drop', [I('Fish flakes', 5.99, '2 oz'), I('Hay, timothy', 11.99, '40 oz')])
    ],
    bakery: [
      C('bread', 'Breads', 'bread', [I('Sourdough loaf', 7.50, 'loaf'), I('Rye bread', 6.50, 'loaf'), I('Challah, braided', 8.00, 'loaf')]),
      C('bagels', 'Bagels', 'bread', [I('Bagels, assorted', 15.00, 'dozen'), I('Plain cream cheese', 5.50, '8 oz'), I('Scallion cream cheese', 6.50, '8 oz')]),
      C('sweets', 'Cakes & pastries', 'heart', [I('Black & white cookies', 12.00, '6 ct'), I('Rugelach', 14.00, '1 lb'), I('Chocolate babka', 16.00, 'each'), I('Birthday cake, 8"', 38.00, 'order ahead')])
    ],
    cleaners: [
      C('drop', 'Drop off', 'hanger', [I('Shirt, laundered & pressed', 3.50, 'each'), I('Suit, 2-piece', 18.00, 'each'), I('Pants / slacks', 8.50, 'each'), I('Dress', 16.00, 'each'), I('Coat / outerwear', 22.00, 'each'), I('Comforter', 35.00, 'each')]),
      C('pick', 'Pick up a ready order', 'tag', [I('Pick up ticketed order (paid at counter)', 0, 'bring ticket #')]),
      C('alter', 'Alterations', 'scissors', [I('Hem pants', 15.00, 'each'), I('Replace zipper', 20.00, 'each')])
    ],
    post: [
      C('stamps', 'Stamps & supplies', 'envelope', [I('Forever stamps', 16.40, 'book of 20'), I('Padded envelope', 2.49, 'each'), I('Flat-rate box, medium', 0, 'free, packing')]),
      C('ship', 'Ship a package', 'box', [I('Priority Mail flat-rate, medium', 25.80, 'per box'), I('Ground Advantage, up to 2 lb', 9.25, 'est.'), I('Certified Mail fee', 5.55, 'plus postage')]),
      C('drop', 'Drop off', 'ret', [I('Drop off prepaid package', 0, 'per package'), I('Pick up held mail', 0, 'ID on file')])
    ],
    shipping: [
      C('returns', 'Returns', 'ret', [I('Drop off prepaid return (Amazon, QR)', 0, 'per package'), I('Drop off prepaid UPS label', 0, 'per package')]),
      C('ship', 'Pack & ship', 'box', [I('Pack & ship, small box', 24.99, 'est.'), I('Pack & ship, medium box', 39.99, 'est.')]),
      C('print', 'Print & notary', 'receipt', [I('Print documents, B&W', 0.25, 'per page'), I('Notary', 10.00, 'per signature')])
    ],
    office: [
      C('paper', 'Paper & notebooks', 'book', [I('Copy paper', 9.99, '500 sheets'), I('Spiral notebooks', 4.99, '3 pk')]),
      C('ink', 'Ink & toner', 'drop', [I('HP 67 black ink', 21.99, 'each'), I('HP 67 color ink', 24.99, 'each')]),
      C('desk', 'Desk supplies', 'tag', [I('Gel pens, black', 8.99, '12 ct'), I('Sticky notes', 6.49, '6 pk'), I('Packing tape', 7.99, '2 rolls')])
    ]
  };
  const CHECKED = 'Nov 1, 2026';
  const REAL = {
    wholefoods: { match: /whole\s*foods/i, src: ['wholefoodsmarket.com', 'https://www.wholefoodsmarket.com/stores/manhasset'],
      note: 'Estimated prices. Dairy from Whole Foods online listings, checked ' + CHECKED + '. Other prices are typical estimates. You pay the shelf price.',
      menu: [
        C('dairy', 'Milk & cream', 'drop', [I('365 Organic Whole Milk', 7.49, '128 fl oz'), I('Organic Valley Organic Whole Milk', 6.29, '64 oz'), I('Organic Valley Organic 2% Milk', 6.29, '64 oz'), I('Lactaid 2% Reduced Fat Milk', 4.99, '64 fl oz'), I('365 Organic Half and Half', 4.29, '1 qt'), I('365 Organic Heavy Cream', 4.39, '1 pt')])
      ], fill: ['produce', 'bakery', 'pantry', 'household'] },
    cvs: { match: /\bcvs\b/i, src: ['cvs.com', 'https://www.cvs.com/store-locator/great-neck-ny-pharmacies/510-middle-neck-road-great-neck-ny-11023/storeid=1963'],
      note: 'Estimated prices from cvs.com listings, checked ' + CHECKED + '. CVS says prices may vary in store. Over-the-counter items only.',
      menu: [
        C('pain', 'Pain & fever', 'pill', [I('CVS Health Ibuprofen 200 mg', 6.99, '50 coated tablets'), I('CVS Dye Free Ibuprofen 200 mg', 11.29, '100 tablets'), I('Tylenol Extra Strength 500 mg', 12.99, '100 caplets')]),
        C('tissue', 'Tissues', 'leaf', [I('Kleenex Trusted Care tissues', 3.49, '1 box'), I('Kleenex Trusted Care tissues', 7.49, '3 boxes'), I('Puffs Plus Lotion tissues', 6.99, '4 boxes')])
      ], fill: ['cold', 'firstaid', 'vitamins', 'personal'] },
    usps: { match: /post\s*office|\busps\b/i, src: ['usps.com', 'https://www.usps.com/ship/first-class-mail.htm'],
      note: 'Official USPS retail prices, checked ' + CHECKED + '. Priority Mail holiday prices run through Jan 17, 2027.',
      menu: [
        C('stamps', 'Stamps', 'envelope', [I('Forever stamps', 16.40, 'book of 20'), I('Postcard stamps', 13.00, 'sheet of 20 · $0.65 each')]),
        C('ship', 'Priority Mail flat rate', 'box', [I('Flat-rate envelope', 13.90, 'per envelope'), I('Flat-rate box, small', 14.65, 'per box'), I('Flat-rate box, medium', 25.80, 'per box'), I('Flat-rate box, large', 36.10, 'per box'), I('Certified Mail fee', 5.55, 'plus postage')]),
        C('drop', 'Drop off & pick up', 'ret', [I('Drop off prepaid package', 0, 'per package'), I('Pick up held mail', 0, 'you sign the form')])
      ] },
    cleaners: { match: /nu-?clear/i, src: ['nuclearcleaners.com', 'https://nuclearcleaners.com/'],
      note: 'Nu-Clear does not post prices online. These are estimates from published Long Island cleaner price lists. You pay the counter price.',
      menu: [
        C('drop', 'Drop off', 'hanger', [I('Shirt, laundered & pressed', 3.50, 'each · est.'), I('Pants / slacks', 8.00, 'each · est.'), I('Suit, 2-piece', 19.00, 'each · est.'), I('Dress', 17.00, 'each · est.'), I('Coat', 25.00, 'each · est.'), I('Wash & fold', 0, 'priced at counter')]),
        C('pick', 'Pick up a ready order', 'tag', [I('Pick up ticketed order', 0, 'paid at counter · bring ticket #')]),
        C('alter', 'Alterations', 'scissors', [I('Hem pants', 15.00, 'each · est.'), I('Replace zipper', 20.00, 'each · est.')])
      ] },
    ups: { match: /ups\s*store/i, src: ['theupsstore.com', 'https://locations.theupsstore.com/ny/great-neck/10-bond-st'],
      note: 'The UPS Store does not post these prices online. Packing and notary prices are estimates. You pay the counter price.',
      menu: [
        C('returns', 'Returns & drop-offs', 'ret', [I('Drop off prepaid UPS package', 0, 'per package'), I('Amazon return with QR code', 0, 'per return')]),
        C('ship', 'Pack & ship', 'box', [I('Pack & ship, small box', 24.99, 'est.'), I('Pack & ship, medium box', 39.99, 'est.')]),
        C('print', 'Print & notary', 'receipt', [I('Notary', 10.00, 'per signature · est.')])
      ] }
  };
  const GEN = 'Typical prices in the area, not from this store. You pay the shelf price.';
  const build = (key, menu) => ({ cats: menu.map(c => ({ id: c.id, name: c.name, icon: c.icon })), items: menu.flatMap(c => c.items.map((x, j) => ({ id: key + '.' + c.id + '.' + j, name: x.name, price: x.price, category: c.id, image: null, icon: c.icon, unit: x.unit, inStock: x.inStock !== false, rx: !!x.rx }))) });
  const DB = {};
  for (const kind in MENUS) DB[kind] = build(kind, MENUS[kind]);
  const RKIND = { wholefoods: 'grocery', cvs: 'pharmacy', usps: 'post', cleaners: 'cleaners', ups: 'shipping' };
  for (const k in REAL) { const R = REAL[k]; DB['r.' + k] = build(k, R.menu.concat((R.fill || []).map(id => MENUS[RKIND[k]].find(c => c.id === id)))); }
  const realFor = place => { const hay = (place.name || '') + ' ' + (place.addr || ''); for (const k in REAL) if (RKIND[k] === place.kind && REAL[k].match.test(hay) && (k !== 'cleaners' || /172 middle neck/i.test(hay))) return k; return null; };
  const KIND_NAMES = { grocery: 'Grocery', pharmacy: 'Pharmacy · OTC', hardware: 'Hardware', pet: 'Pet supplies', bakery: 'Bakery', cleaners: 'Dry cleaning', post: 'Post office', shipping: 'Shipping & returns', office: 'Office supplies' };
  const stores = {};
  const norm = s => String(s).toLowerCase().replace(/[’']/g, '');
  const SampleProvider = {
    async getStore(place) { const kind = DB[place.kind] ? place.kind : 'grocery', rk = realFor({ ...place, kind }), R = rk && REAL[rk];
      const st = { id: place.id, name: place.name, kind, db: R ? 'r.' + rk : kind, kindName: KIND_NAMES[kind], addr: place.addr || '', note: R ? R.note : GEN, src: R ? { label: R.src[0], url: R.src[1] } : null };
      stores[place.id] = st; return st; },
    async getCategories(storeId) { const d = DB[(stores[storeId] || {}).db]; return d ? d.cats.map(c => ({ ...c, count: d.items.filter(i => i.category === c.id).length })) : []; },
    async getItems(storeId, catId) { const d = DB[(stores[storeId] || {}).db]; return d ? d.items.filter(i => !catId || i.category === catId) : []; },
    async searchItems(storeId, q) { const d = DB[(stores[storeId] || {}).db]; const toks = norm(q).split(/\s+/).filter(Boolean); if (!d || !toks.length) return [];
      const cn = Object.fromEntries(d.cats.map(c => [c.id, norm(c.name)]));
      return d.items.map(i => { const hay = norm(i.name + ' ' + i.unit), words = hay.split(/[^a-z0-9%]+/); let sc = 0;
        for (const t of toks) { if (words.some(w => w.startsWith(t))) sc += 3; else if (hay.includes(t)) sc += 1; else if (cn[i.category].includes(t)) sc += 0.5; else return null; }
        return { i, sc }; }).filter(Boolean).sort((a, b) => b.sc - a.sc).map(x => x.i); }
  };
  let provider = SampleProvider;
  const Catalog = {
    KINDS: Object.keys(MENUS), KIND_NAMES, REAL, realFor, CHECKED,
    setProvider(p) { provider = p; }, get provider() { return provider; }, SampleProvider,
    getStore: p => provider.getStore(p), getCategories: id => provider.getCategories(id), getItems: (id, c) => provider.getItems(id, c), searchItems: (id, q) => provider.searchItems(id, q)
  };
  root.Catalog = Catalog;
  if (typeof module !== 'undefined') module.exports = Catalog;
})(typeof window !== 'undefined' ? window : globalThis);
