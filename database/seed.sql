-- Raaji Collections - Seed Data
-- Matches products currently shown on the website

BEGIN;

INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES
  ('Sarees', 'sarees', 'Banarasi, Kanjivaram, Silk, Cotton & more', 'images/saree.svg', 1),
  ('Dresses', 'dresses', 'Anarkali, Lehenga, Indo-Western', 'images/dress.svg', 2),
  ('Tops', 'tops', 'Kurtis, Tunics, Crop Tops', 'images/top.svg', 3),
  ('Ready Made Blouses', 'ready-made-blouses', 'Stitched, Unstitched, Designer', 'images/blouse.svg', 4),
  ('Jewellery', 'jewellery', 'Necklaces, Earrings, Bangles, Kundan & more', 'images/jewellery.svg', 5),
  ('Night Dresses', 'night-dresses', 'Comfortable & stylish nightwear for women', 'images/nightwear-2.jpg', 6),
  ('Kids Wear', 'kids-wear', 'Cute & comfortable dresses, frocks, sets & more for kids', 'images/kids.svg', 7),
  ('Boys', 'kids-boys', 'Shirts, shorts, sets, ethnic wear & more for boys', 'images/kids-boys.svg', 8),
  ('Girls', 'kids-girls', 'Frocks, party dresses, lehenga & more for girls', 'images/kids-girls.svg', 9),
  ('Makeup & Gifts', 'makeup-gifts', 'Cosmetics, beauty essentials, gift sets & more', 'images/makeup-gifts.svg', 10)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (category_id, name, slug, description, price, old_price, badge, material, is_featured, stock_qty) VALUES
  ((SELECT id FROM categories WHERE slug='sarees'), 'Red Banarasi Saree', 'red-banarasi-saree', 'Elegant red Banarasi silk saree with gold zari work.', 2499.00, NULL, 'New', 'Silk', TRUE, 10),
  ((SELECT id FROM categories WHERE slug='sarees'), 'Red Banarasi Silk Saree', 'red-banarasi-silk-saree', 'Premium red Banarasi silk saree for special occasions.', 3499.00, NULL, 'New', 'Silk', FALSE, 8),
  ((SELECT id FROM categories WHERE slug='sarees'), 'Blue Kanjivaram Saree', 'blue-kanjivaram-saree', 'Rich blue Kanjivaram silk saree with temple border.', 4499.00, 5999.00, 'Sale', 'Silk', FALSE, 6),
  ((SELECT id FROM categories WHERE slug='sarees'), 'Purple Georgette Saree', 'purple-georgette-saree', 'Lightweight purple georgette saree, comfortable and flowy.', 2299.00, NULL, 'New', 'Georgette', FALSE, 12),
  ((SELECT id FROM categories WHERE slug='sarees'), 'Gold Tissue Saree', 'gold-tissue-saree', 'Shimmering gold tissue saree with delicate zari.', 3999.00, NULL, NULL, 'Tissue', FALSE, 5),
  ((SELECT id FROM categories WHERE slug='sarees'), 'Green Cotton Saree', 'green-cotton-saree', 'Breathable green cotton saree for everyday elegance.', 1799.00, NULL, 'New', 'Cotton', FALSE, 15),
  ((SELECT id FROM categories WHERE slug='sarees'), 'Red Silk Saree with Border', 'red-silk-saree-with-border', 'Red silk saree with contrasting woven border.', 2999.00, NULL, NULL, 'Silk', FALSE, 9),
  ((SELECT id FROM categories WHERE slug='dresses'), 'Green Anarkali Dress', 'green-anarkali-dress', 'Flowing green Anarkali dress with intricate embroidery.', 2999.00, 3999.00, 'Sale', 'Georgette', TRUE, 7),
  ((SELECT id FROM categories WHERE slug='tops'), 'Silk Kurti Top', 'silk-kurti-top', 'Soft silk kurti top in elegant cut.', 1299.00, NULL, NULL, 'Silk', TRUE, 20),
  ((SELECT id FROM categories WHERE slug='ready-made-blouses'), 'Designer Blouse', 'designer-blouse', 'Designer ready-made blouse with fine detailing.', 899.00, NULL, 'New', 'Silk', TRUE, 25),
  ((SELECT id FROM categories WHERE slug='ready-made-blouses'), 'Black Ready Made Blouse', 'black-ready-made-blouse', 'Classic black ready-made blouse.', 899.00, NULL, 'New', 'Cotton', FALSE, 18),
  ((SELECT id FROM categories WHERE slug='ready-made-blouses'), 'Designer Fashion Blouse', 'designer-fashion-blouse', 'Trendy designer fashion blouse.', 1299.00, NULL, 'New', 'Georgette', FALSE, 14),
  ((SELECT id FROM categories WHERE slug='ready-made-blouses'), 'Stylish Printed Blouse', 'stylish-printed-blouse', 'Stylish printed blouse with modern print.', 799.00, 1199.00, 'Sale', 'Cotton', FALSE, 22);

INSERT INTO products (category_id, name, slug, description, price, old_price, badge, material, is_featured, stock_qty) VALUES
  ((SELECT id FROM categories WHERE slug='jewellery'), 'Kundan Necklace Set', 'kundan-necklace-set', 'Traditional Kundan necklace set with matching earrings.', 3499.00, NULL, 'New', 'Kundan', TRUE, 10),
  ((SELECT id FROM categories WHERE slug='jewellery'), 'Gold Plated Jhumkas', 'gold-plated-jhumkas', 'Elegant gold plated jhumka earrings for festive wear.', 899.00, 1299.00, 'Sale', 'Gold Plated', FALSE, 20),
  ((SELECT id FROM categories WHERE slug='jewellery'), 'Temple Jewellery Bangles', 'temple-jewellery-bangles', 'Traditional temple jewellery bangles with intricate detailing.', 1499.00, NULL, NULL, 'Antique', FALSE, 15),
  ((SELECT id FROM categories WHERE slug='jewellery'), 'Pearl Choker Necklace', 'pearl-choker-necklace', 'Classic pearl choker necklace for elegant occasions.', 2799.00, NULL, 'New', 'Pearl', FALSE, 8);

INSERT INTO products (category_id, name, slug, description, price, old_price, badge, material, is_featured, stock_qty) VALUES
  ((SELECT id FROM categories WHERE slug='night-dresses'), 'Cotton Night Dress', 'cotton-night-dress', 'Soft cotton night dress with full sleeves.', 699.00, 999.00, 'Sale', 'Cotton', FALSE, 10),
  ((SELECT id FROM categories WHERE slug='night-dresses'), 'Silk Satin Night Gown', 'silk-satin-night-gown', 'Elegant silk satin night gown with lace trim.', 1199.00, NULL, 'New', 'Silk Satin', TRUE, 8);

INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES
  ((SELECT id FROM products WHERE slug='red-banarasi-saree'), 'images/product-1.svg', 'Red Banarasi Saree', TRUE, 1),
  ((SELECT id FROM products WHERE slug='red-banarasi-silk-saree'), 'images/saree-upload-1.jpg', 'Red Banarasi Silk Saree', TRUE, 1),
  ((SELECT id FROM products WHERE slug='blue-kanjivaram-saree'), 'images/saree-upload-2.webp', 'Blue Kanjivaram Saree', TRUE, 1),
  ((SELECT id FROM products WHERE slug='purple-georgette-saree'), 'images/saree-upload-3.jpeg', 'Purple Georgette Saree', TRUE, 1),
  ((SELECT id FROM products WHERE slug='gold-tissue-saree'), 'images/saree-upload-4.jpeg', 'Gold Tissue Saree', TRUE, 1),
  ((SELECT id FROM products WHERE slug='green-cotton-saree'), 'images/saree-upload-5.jpeg', 'Green Cotton Saree', TRUE, 1),
  ((SELECT id FROM products WHERE slug='red-silk-saree-with-border'), 'images/saree.svg', 'Red Silk Saree with Border', TRUE, 1),
  ((SELECT id FROM products WHERE slug='green-anarkali-dress'), 'images/product-2.svg', 'Green Anarkali Dress', TRUE, 1),
  ((SELECT id FROM products WHERE slug='silk-kurti-top'), 'images/product-3.svg', 'Silk Kurti Top', TRUE, 1),
  ((SELECT id FROM products WHERE slug='designer-blouse'), 'images/product-4.svg', 'Designer Blouse', TRUE, 1),
  ((SELECT id FROM products WHERE slug='black-ready-made-blouse'), 'images/blouse-upload-1.jpg', 'Black Ready Made Blouse', TRUE, 1),
  ((SELECT id FROM products WHERE slug='designer-fashion-blouse'), 'images/blouse-upload-2.webp', 'Designer Fashion Blouse', TRUE, 1),
  ((SELECT id FROM products WHERE slug='stylish-printed-blouse'), 'images/blouse-upload-3.avif', 'Stylish Printed Blouse', TRUE, 1);

INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES
  ((SELECT id FROM products WHERE slug='kundan-necklace-set'), 'images/jewellery-image2.webp', 'Kundan Necklace Set', TRUE, 1),
  ((SELECT id FROM products WHERE slug='gold-plated-jhumkas'), 'images/jewellery-image4.webp', 'Gold Plated Jhumkas', TRUE, 1),
  ((SELECT id FROM products WHERE slug='temple-jewellery-bangles'), 'images/jewellery-bangle.jpeg', 'Temple Jewellery Bangles', TRUE, 1),
  ((SELECT id FROM products WHERE slug='pearl-choker-necklace'), 'images/jewellery-image5.webp', 'Pearl Choker Necklace', TRUE, 1);

INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES
  ((SELECT id FROM products WHERE slug='cotton-night-dress'), 'images/nightwear-1.jpg', 'Cotton Night Dress', TRUE, 1),
  ((SELECT id FROM products WHERE slug='silk-satin-night-gown'), 'images/nightwear-2.jpg', 'Silk Satin Night Gown', TRUE, 1);

INSERT INTO reviews (product_id, customer_name, rating, comment, is_verified) VALUES
  ((SELECT id FROM products WHERE slug='red-banarasi-silk-saree'), 'Priya S.', 5, 'Absolutely stunning saree! The fabric is so rich and the colors are exactly as pictured.', TRUE),
  ((SELECT id FROM products WHERE slug='designer-blouse'), 'Ananya R.', 5, 'The blouse fit perfectly and the quality is exceptional.', TRUE),
  ((SELECT id FROM products WHERE slug='green-anarkali-dress'), 'Meera K.', 4, 'Beautiful Anarkali dress, the embroidery work is exquisite.', TRUE);

INSERT INTO products (category_id, name, slug, description, price, old_price, badge, material, is_featured, stock_qty) VALUES
  ((SELECT id FROM categories WHERE slug='kids-girls'), 'Kids Frock Dress', 'kids-frock-dress', 'Adorable frock dress for little girls with pretty detailing.', 799.00, 999.00, 'Sale', 'Cotton', TRUE, 12),
  ((SELECT id FROM categories WHERE slug='kids-girls'), 'Kids Cotton Party Dress', 'kids-cotton-party-dress', 'Festive cotton party dress for girls.', 1099.00, NULL, 'New', 'Cotton', FALSE, 10),
  ((SELECT id FROM categories WHERE slug='kids-girls'), 'Kids Ethnic Lehenga', 'kids-ethnic-lehenga', 'Traditional lehenga set for little girls on special occasions.', 1599.00, 1999.00, 'Sale', 'Silk', FALSE, 8),
  ((SELECT id FROM categories WHERE slug='kids-boys'), 'Kids Two Piece Set', 'kids-two-piece-set', 'Comfy two piece kurta & pyjama set for boys.', 899.00, NULL, NULL, 'Cotton', FALSE, 15),
  ((SELECT id FROM categories WHERE slug='kids-boys'), 'Boys Casual Shirt', 'boys-casual-shirt', 'Stylish cotton casual shirt for young boys.', 649.00, NULL, 'New', 'Cotton', FALSE, 15),
  ((SELECT id FROM categories WHERE slug='kids-boys'), 'Boys Denim Set', 'boys-denim-set', 'Trendy denim shirt & jeans set for boys.', 1299.00, NULL, NULL, 'Denim', FALSE, 10);

INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES
  ((SELECT id FROM products WHERE slug='kids-frock-dress'), 'images/kids.svg', 'Kids Frock Dress', TRUE, 1),
  ((SELECT id FROM products WHERE slug='kids-cotton-party-dress'), 'images/kids.svg', 'Kids Cotton Party Dress', TRUE, 1),
  ((SELECT id FROM products WHERE slug='kids-ethnic-lehenga'), 'images/kids.svg', 'Kids Ethnic Lehenga', TRUE, 1),
  ((SELECT id FROM products WHERE slug='kids-two-piece-set'), 'images/kids.svg', 'Kids Two Piece Set', TRUE, 1),
  ((SELECT id FROM products WHERE slug='boys-casual-shirt'), 'images/kids.svg', 'Boys Casual Shirt', TRUE, 1),
  ((SELECT id FROM products WHERE slug='boys-denim-set'), 'images/kids.svg', 'Boys Denim Set', TRUE, 1);

INSERT INTO products (category_id, name, slug, description, price, old_price, badge, material, is_featured, stock_qty) VALUES
  ((SELECT id FROM categories WHERE slug='makeup-gifts'), 'Matte Lipstick Trio', 'matte-lipstick-trio', 'Set of three long-wear matte lipsticks in beautiful festive shades.', 549.00, 799.00, 'Sale', 'Makeup', TRUE, 20),
  ((SELECT id FROM categories WHERE slug='makeup-gifts'), 'Rose Gold Makeup Brush Set', 'rose-gold-makeup-brush-set', 'Premium 10-piece rose gold makeup brush set with soft synthetic bristles.', 899.00, NULL, 'New', 'Makeup', FALSE, 15),
  ((SELECT id FROM categories WHERE slug='makeup-gifts'), 'Handcrafted Gift Hamper', 'handcrafted-gift-hamper', 'Elegant gift hamper with assortment of beauty essentials and treats.', 1499.00, 1999.00, 'Sale', 'Gift', TRUE, 10),
  ((SELECT id FROM categories WHERE slug='makeup-gifts'), 'Compact Mirror with Comb', 'compact-mirror-comb', 'Stylish foldable compact mirror with comb, perfect for travel & gifting.', 399.00, NULL, NULL, 'Gift', FALSE, 30),
  ((SELECT id FROM categories WHERE slug='makeup-gifts'), 'Silk Eye Shadow Palette', 'silk-eyeshadow-palette', '12 rich shades of silky eye shadow with smooth blendable texture.', 749.00, NULL, 'New', 'Makeup', FALSE, 12),
  ((SELECT id FROM categories WHERE slug='makeup-gifts'), 'Golden Gift Box Set', 'golden-gift-box-set', 'Luxurious golden gift box with curated women gift items.', 999.00, 1299.00, 'Sale', 'Gift', FALSE, 8);

INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES
  ((SELECT id FROM products WHERE slug='matte-lipstick-trio'), 'images/makeup-gifts.svg', 'Matte Lipstick Trio', TRUE, 1),
  ((SELECT id FROM products WHERE slug='rose-gold-makeup-brush-set'), 'images/makeup-gifts.svg', 'Rose Gold Makeup Brush Set', TRUE, 1),
  ((SELECT id FROM products WHERE slug='handcrafted-gift-hamper'), 'images/makeup-gifts.svg', 'Handcrafted Gift Hamper', TRUE, 1),
  ((SELECT id FROM products WHERE slug='compact-mirror-comb'), 'images/makeup-gifts.svg', 'Compact Mirror with Comb', TRUE, 1),
  ((SELECT id FROM products WHERE slug='silk-eyeshadow-palette'), 'images/makeup-gifts.svg', 'Silk Eye Shadow Palette', TRUE, 1),
  ((SELECT id FROM products WHERE slug='golden-gift-box-set'), 'images/makeup-gifts.svg', 'Golden Gift Box Set', TRUE, 1);

INSERT INTO reviews (product_id, customer_name, rating, comment, is_verified) VALUES
  ((SELECT id FROM products WHERE slug='matte-lipstick-trio'), 'Sneha R.', 5, 'Lovely shades and they stay on all day. Great value for money!', TRUE),
  ((SELECT id FROM products WHERE slug='handcrafted-gift-hamper'), 'Anita K.', 5, 'Beautifully packed gift hamper, my friend loved it.', TRUE);

INSERT INTO newsletter_subscribers (email) VALUES
  ('priya@example.com'),
  ('ananya@example.com'),
  ('meera@example.com')
ON CONFLICT (email) DO NOTHING;

COMMIT;
