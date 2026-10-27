/* Store catalog data provider.
 * Normalized item schema: { id, name, price (USD number, shelf estimate), category (category id), image (URL or null),
 *   icon (fallback glyph key), unit (e.g. "1 gal"), inStock (bool) }.
 * Interface (all async, so a real product feed / API can be swapped in with Catalog.setProvider(p)):
 *   getStore(place)            -> { id, name, kind, addr, note }          place = { id, name, kind, addr }
 *   getCategories(storeId)     -> [{ id, name, count }]
 *   getItems(storeId, catId?)  -> [item]                                   (all items when catId omitted)
 *   searchItems(storeId, q)    -> [item]                                   (searches everything the store carries)
 * The default provider serves sample menus per store kind. Prices are illustrative shelf prices, not live. */
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
      C('stamps', 'Stamps & supplies', 'envelope', [I('Forever stamps', 14.60, 'book of 20'), I('Padded envelope', 2.49, 'each'), I('Flat-rate box, medium', 0, 'free, packing')]),
      C('ship', 'Ship a package', 'box', [I('Priority Mail flat-rate, medium', 19.30, 'per box'), I('Ground Advantage, up to 2 lb', 9.25, 'est.'), I('Certified mail', 5.30, 'per letter')]),
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
  /* build normalized items with stable ids */
  const DB = {};
  for (const kind in MENUS) DB[kind] = { cats: MENUS[kind].map(c => ({ id: c.id, name: c.name, icon: c.icon })), items: MENUS[kind].flatMap(c => c.items.map((x, j) => ({ id: kind + '.' + c.id + '.' + j, name: x.name, price: x.price, category: c.id, image: null, icon: c.icon, unit: x.unit, inStock: x.inStock !== false, rx: !!x.rx }))) };
  const KIND_NAMES = { grocery: 'Grocery', pharmacy: 'Pharmacy · OTC', hardware: 'Hardware', pet: 'Pet supplies', bakery: 'Bakery', cleaners: 'Dry cleaning', post: 'Post office', shipping: 'Shipping & returns', office: 'Office supplies' };
  const stores = {};
  const norm = s => String(s).toLowerCase().replace(/[’']/g, '');
  const SampleProvider = {
    async getStore(place) { const kind = DB[place.kind] ? place.kind : 'grocery'; const st = { id: place.id, name: place.name, kind, kindName: KIND_NAMES[kind], addr: place.addr || '', note: kind === 'pharmacy' ? 'Over-the-counter items only. Prescription pickups are not available yet.' : '' }; stores[place.id] = st; return st; },
    async getCategories(storeId) { const d = DB[(stores[storeId] || {}).kind]; return d ? d.cats.map(c => ({ ...c, count: d.items.filter(i => i.category === c.id).length })) : []; },
    async getItems(storeId, catId) { const d = DB[(stores[storeId] || {}).kind]; return d ? d.items.filter(i => !catId || i.category === catId) : []; },
    async searchItems(storeId, q) { const d = DB[(stores[storeId] || {}).kind]; const toks = norm(q).split(/\s+/).filter(Boolean); if (!d || !toks.length) return [];
      const cn = Object.fromEntries(d.cats.map(c => [c.id, norm(c.name)]));
      return d.items.map(i => { const hay = norm(i.name + ' ' + i.unit), words = hay.split(/[^a-z0-9%]+/); let sc = 0;
        for (const t of toks) { if (words.some(w => w.startsWith(t))) sc += 3; else if (hay.includes(t)) sc += 1; else if (cn[i.category].includes(t)) sc += 0.5; else return null; }
        return { i, sc }; }).filter(Boolean).sort((a, b) => b.sc - a.sc).map(x => x.i); }
  };
  let provider = SampleProvider;
  const Catalog = {
    KINDS: Object.keys(MENUS), KIND_NAMES,
    setProvider(p) { provider = p; }, get provider() { return provider; }, SampleProvider,
    getStore: p => provider.getStore(p), getCategories: id => provider.getCategories(id), getItems: (id, c) => provider.getItems(id, c), searchItems: (id, q) => provider.searchItems(id, q)
  };
  root.Catalog = Catalog;
  if (typeof module !== 'undefined') module.exports = Catalog;
})(typeof window !== 'undefined' ? window : globalThis);
