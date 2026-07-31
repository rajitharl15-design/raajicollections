-- Raaji Collections - Seed Data
-- Matches products currently shown on the website

BEGIN;

INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES
  ('Sarees', 'sarees', 'Banarasi, Kanjivaram, Silk, Cotton & more', 'images/saree.svg', 1),
  ('Dresses', 'dresses', 'Anarkali, Lehenga, Indo-Western', 'images/dress.svg', 2),
  ('Tops', 'tops', 'Kurtis, Tunics, Crop Tops', 'images/top.svg', 3),
  ('Ready Made Blouses', 'ready-made-blouses', 'Stitched, Unstitched, Designer', 'images/blouse.svg', 4)
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

INSERT INTO reviews (product_id, customer_name, rating, comment, is_verified) VALUES
  ((SELECT id FROM products WHERE slug='red-banarasi-silk-saree'), 'Priya S.', 5, 'Absolutely stunning saree! The fabric is so rich and the colors are exactly as pictured.', TRUE),
  ((SELECT id FROM products WHERE slug='designer-blouse'), 'Ananya R.', 5, 'The blouse fit perfectly and the quality is exceptional.', TRUE),
  ((SELECT id FROM products WHERE slug='green-anarkali-dress'), 'Meera K.', 4, 'Beautiful Anarkali dress, the embroidery work is exquisite.', TRUE);

INSERT INTO newsletter_subscribers (email) VALUES
  ('priya@example.com'),
  ('ananya@example.com'),
  ('meera@example.com')
ON CONFLICT (email) DO NOTHING;

COMMIT;
