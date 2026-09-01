-- Raaji Collections - Seed (blank shop: categories only, no products yet)
-- Add products via the admin panel (/admin.html) after deploy.
BEGIN;
INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES ('Sarees', 'sarees', NULL, 'images/saree.svg', 1) ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES ('Dresses', 'dresses', NULL, 'images/dresses-category.jpg', 2) ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES ('Tops', 'tops', NULL, 'images/top.svg', 3) ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES ('Ready Made Blouses', 'ready-made-blouses', NULL, 'images/blouse.svg', 4) ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES ('Jewellery', 'jewellery', NULL, 'images/jewellery-category.jpg', 5) ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES ('Night Dresses', 'night-dresses', NULL, 'images/nightwear-2.jpg', 6) ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES ('Kids Wear', 'kids-wear', NULL, 'images/kids.svg', 7) ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES ('Kids Boys', 'kids-boys', NULL, 'images/kids-boys.svg', 8) ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES ('Kids Girls', 'kids-girls', NULL, 'images/kids-girls.svg', 9) ON CONFLICT (slug) DO NOTHING;
COMMIT;