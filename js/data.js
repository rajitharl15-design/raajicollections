const PRODUCTS = [
  // ---- WOMEN ----
  { id: 1, name: "Fit & Flare Midi Dress", cat: "Women", subcat: "Dresses", price: 899, old: 1799, icon: "👗", grad: "linear-gradient(150deg,#c0574f,#7a1f2b)", size: ["XS","S","M","L","XL"], rating: 4.9, new: true, desc: "A flattering bodice with a flowy midi skirt and hidden pockets. Woven in breathable mul cotton." },
  { id: 2, name: "Floral A-Line Kurta", cat: "Women", subcat: "Kurtas", price: 649, old: 1299, icon: "🌸", grad: "linear-gradient(150deg,#d2848c,#8f3b46)", size: ["S","M","L","XL"], rating: 4.7, best: true, desc: "Delicately printed A-line kurta in soft cotton, ideal for everyday grace." },
  { id: 3, name: "Silk Evening Saree", cat: "Women", subcat: "Sarees", price: 1999, old: 3499, icon: "🪷", grad: "linear-gradient(150deg,#7f9b8a,#33503f)", size: ["Free"], rating: 5.0, sale: true, desc: "Handwoven silk saree with a subtle zari border. Timeless for festive evenings." },
  { id: 4, name: "Oversized Knit Sweater", cat: "Women", subcat: "Knitwear", price: 1099, old: 1899, icon: "🧶", grad: "linear-gradient(150deg,#e8b4a0,#b06a4e)", size: ["S","M","L","XL"], rating: 4.6, new: true, desc: "Cozy chunky knit with an easy oversized silhouette — cold-weather comfort." },

  // ---- MEN ----
  { id: 5, name: "Crew Neck Essential Tee", cat: "Men", subcat: "T-Shirts", price: 449, old: 899, icon: "👕", grad: "linear-gradient(150deg,#3f4556,#1a1d27)", size: ["S","M","L","XL"], rating: 4.8, best: true, desc: "Heavyweight combed cotton tee with a clean, relaxed fit. The everyday base layer." },
  { id: 6, name: "Relaxed Linen Shirt", cat: "Men", subcat: "Shirts", price: 999, old: 1699, icon: "👔", grad: "linear-gradient(150deg,#7b8a8f,#3c464a)", size: ["S","M","L","XL"], rating: 4.7, sale: true, desc: "Breathable linen with a breezy overshirt cut. Wrinkles are part of the charm." },
  { id: 7, name: "Structured Blazer", cat: "Men", subcat: "Blazers", price: 2499, old: 3999, icon: "🧥", grad: "linear-gradient(150deg,#2f3542,#111318)", size: ["S","M","L","XL"], rating: 4.9, desc: "Sharp shoulders and a tailored taper — versatile from desk to dinner." },
  { id: 8, name: "Slim-Fit Denim Jeans", cat: "Men", subcat: "Jeans", price: 1299, old: 2199, icon: "👖", grad: "linear-gradient(150deg,#4b6a8a,#243549)", size: ["28","30","32","34","36"], rating: 4.6, best: true, desc: "Stretch denim with a tailored slim fit that holds its shape all day." },

  // ---- KIDS ----
  { id: 9, name: "Graphic Hoodie", cat: "Kids", subcat: "Hoodies", price: 699, old: 1299, icon: "🧸", grad: "linear-gradient(150deg,#4aa3c2,#1f5d75)", size: ["4","6","8","10"], rating: 4.8, new: true, desc: "Super-soft fleece with a playful print. Rugged for school and playground." },
  { id: 10, name: "Cargo Pants", cat: "Kids", subcat: "Trousers", price: 599, old: 999, icon: "🩳", grad: "linear-gradient(150deg,#9aa95a,#5a6a2e)", size: ["4","6","8","10"], rating: 4.4, sale: true, desc: "Six pockets of adventure-proof storage with an adjustable waistband." },
  { id: 11, name: "Rainbow T-Shirt", cat: "Kids", subcat: "T-Shirts", price: 399, old: 699, icon: "🌈", grad: "linear-gradient(150deg,#e86a6a,#a63a3a)", size: ["4","6","8","10"], rating: 4.9, best: true, desc: "Bright, cheerful and endlessly wearable. 100% organic cotton." },
  { id: 12, name: "Tiered Party Frock", cat: "Kids", subcat: "Dresses", price: 799, old: 1499, icon: "🎀", grad: "linear-gradient(150deg,#c98bb0,#7a2f5a)", size: ["4","6","8","10"], rating: 4.7, new: true, desc: "A dreamy tiered frock in soft tulle — made for twirling and parties." },

  // ---- ACCESSORIES ----
  { id: 13, name: "Canvas Tote Bag", cat: "Accessories", subcat: "Bags", price: 499, old: 899, icon: "👜", grad: "linear-gradient(150deg,#c9a86a,#6b4f1e)", size: ["One Size"], rating: 4.7, best: true, desc: "Sturdy 12oz canvas with reinforced handles. Holds everything, goes everywhere." },
  { id: 14, name: "Leather Crossbody", cat: "Accessories", subcat: "Bags", price: 1199, old: 1999, icon: "🎒", grad: "linear-gradient(150deg,#5c5f63,#2a2c30)", size: ["One Size"], rating: 4.6, sale: true, desc: "Slim, hands-free and surprisingly roomy, with an adjustable strap." },
  { id: 15, name: "Silk Print Scarf", cat: "Accessories", subcat: "Scarves", price: 649, old: 1099, icon: "🧣", grad: "linear-gradient(150deg,#b06ab0,#5a2a5a)", size: ["One Size"], rating: 4.8, new: true, desc: "A vibrant printed square in luxurious silk twill — tie, loop, or wear in your hair." },
  { id: 16, name: "Statement Earrings", cat: "Accessories", subcat: "Jewellery", price: 349, old: 699, icon: "💎", grad: "linear-gradient(150deg,#d9a441,#7a5a33)", size: ["One Size"], rating: 4.5, desc: "Lightweight gold-tone earrings that finish any outfit in an instant." }
];

function productById(id) {
  return PRODUCTS.find((p) => p.id === Number(id));
}

const CATS = ["Women", "Men", "Kids", "Accessories"]; 
const SUBCATS = [...new Set(PRODUCTS.map((p) => p.subcat))];