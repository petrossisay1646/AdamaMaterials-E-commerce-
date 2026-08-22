import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Search, ShieldCheck, Truck, Coins, BadgeAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import api from '../services/api';

const LandingPage: React.FC = () => {
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch products and strictly deduplicate by name and ID
    api.get('/products?limit=12')
      .then(res => {
        if (res.data.success && Array.isArray(res.data.products)) {
          const unique: any[] = [];
          const seenNames = new Set<string>();
          const seenIds = new Set<string>();

          for (const p of res.data.products) {
            const normName = (p.name || '').trim().toLowerCase();
            const pId = String(p._id);
            if (!seenNames.has(normName) && !seenIds.has(pId)) {
              seenNames.add(normName);
              seenIds.add(pId);
              unique.push(p);
            }
          }
          setFeaturedProducts(unique);
        }
      })
      .catch(err => console.error(err));

    // Fetch categories
    api.get('/categories')
      .then(res => {
        if (res.data.success) {
          setCategories(res.data.categories.slice(0, 6)); // show top 6
        }
      })
      .catch(err => console.error(err));
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-slate-950 text-white py-20 lg:py-32">
        {/* Abstract animated gradient bg */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,111,165,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(221,141,35,0.1),transparent_50%)]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 p-1.5 pr-4 rounded-2xl bg-slate-900/90 border border-orange-500/40 shadow-lg shadow-orange-500/10">
              <BrandLogo variant="icon" className="w-8 h-8" />
              <div className="flex items-center gap-1.5 text-sm font-black text-white">
                <span><span className="text-blue-400">re</span><span className="text-orange-400">vola</span></span>
                <span className="text-xs text-slate-300 font-medium">• Every Good Thing Deserves a Second Life</span>
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              Buy & Sell Usable <br />
              <span className="text-accent-400">Materials & Scrap</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-xl">
              Turn your waste materials, furniture parts, metal scraps, and appliances into cash. Buy and sell locally in Adama — fast, safe, and verified.
            </p>

            {/* Search Input Bar */}
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for used furniture, laptops, phones, scrap iron, plastics..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-primary-900/40 flex items-center justify-center gap-1 cursor-pointer">
                Search
              </button>
            </form>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link to="/products" className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all flex items-center gap-1.5 shadow-md shadow-primary-950/20">
                Shop Now
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/register?role=SELLER" className="border border-slate-700 hover:border-slate-500 bg-slate-900/60 text-slate-300 hover:text-white font-bold px-6 py-3 rounded-xl text-sm transition-all">
                Become a Seller
              </Link>
            </div>
          </div>

          {/* Graphical display: Today's Pick */}
          <div className="lg:col-span-5 hidden lg:block">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <span className="text-sm font-bold text-slate-400">Today's Pick</span>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold">
                  {featuredProducts[0]?.condition || '100% Usable'}
                </span>
              </div>
              <Link to={featuredProducts[0] ? `/products/${featuredProducts[0]._id}` : '/products'} className="block group">
                <div className="space-y-4">
                  <div className="aspect-video w-full rounded-xl bg-slate-850 overflow-hidden relative">
                    <img 
                      src={featuredProducts[0]?.images?.[0] || 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=600&auto=format&fit=crop&q=80'} 
                      alt={featuredProducts[0]?.name || 'Featured Material'} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.onerror = null;
                        target.src = 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=600&auto=format&fit=crop&q=80';
                      }}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white group-hover:text-orange-400 transition-colors">
                      {featuredProducts[0]?.name || 'Pine Wood Pallets (Sorted)'}
                    </h3>
                    <div className="text-xs text-slate-500 mt-1">
                      Location: {featuredProducts[0]?.location?.subCity || 'Kebele 02'}, {featuredProducts[0]?.location?.city || 'Adama'}
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-orange-400 font-extrabold text-lg">
                        {featuredProducts[0]?.price || 450} ETB <span className="text-[10px] text-slate-400">/ unit</span>
                      </span>
                      <span className="text-xs text-emerald-400 font-semibold">
                        {featuredProducts[0]?.quantity || 8} in Stock
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. How It Works (Managed Flow) */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">How It Works</h2>
            <p className="mt-4 text-lg text-slate-500">
              We take care of everything — from verifying listings to handling payments and delivering your order right to your door in Adama.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center p-4">
              <span className="bg-primary-100 text-primary-800 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner mb-4">1</span>
              <h3 className="font-bold text-slate-900 text-base mb-2">Seller Posts an Item</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Sellers list their usable materials with photos and a price. Our team reviews each listing before it goes live.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-4">
              <span className="bg-primary-100 text-primary-800 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner mb-4">2</span>
              <h3 className="font-bold text-slate-900 text-base mb-2">Buyer Pays Safely</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Buyers pay via Telebirr or Bank Transfer. Your money is held safely until the item is delivered.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-4">
              <span className="bg-primary-100 text-primary-800 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner mb-4">3</span>
              <h3 className="font-bold text-slate-900 text-base mb-2">We Handle Delivery</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Our team picks up the item from the seller and delivers it to the buyer's address in Adama — no hassle.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-4">
              <span className="bg-primary-100 text-primary-800 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner mb-4">4</span>
              <h3 className="font-bold text-slate-900 text-base mb-2">Seller Gets Paid</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Once the buyer confirms they received the item, the seller is paid. Simple and transparent for everyone.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured Products (Distinct items, strictly non-repeated) */}
      <section className="py-20 bg-slate-50 border-t border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900">Featured Materials</h2>
              <p className="mt-2 text-sm text-slate-500">Recently approved, high-quality usable items ready for pickup</p>
            </div>
            <Link to="/products" className="hidden sm:flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors">
              Browse all catalog
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              No products available right now. Check back soon!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {(featuredProducts.length > 4 ? featuredProducts.slice(1, 5) : featuredProducts.slice(0, 4)).map((product) => (
                <Link 
                  key={product._id} 
                  to={`/products/${product._id}`}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
                >
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    <img 
                      src={product.images?.[0] || 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=600&auto=format&fit=crop&q=80'} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.onerror = null;
                        target.src = 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=600&auto=format&fit=crop&q=80';
                      }}
                    />
                    <span className="absolute top-3 left-3 bg-white/95 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-wide">
                      {product.condition}
                    </span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-primary-600 transition-colors">{product.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                      <span className="text-primary-700 font-extrabold text-sm">{product.price} ETB</span>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
                        {product.materialType?.name || 'Material'}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Platform Benefits */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-slate-50 border border-slate-200/60 p-8 rounded-2xl flex items-start gap-4">
            <ShieldCheck className="w-10 h-10 text-primary-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-slate-950 text-lg mb-2">Your Money is Protected</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                We hold your payment until the item arrives safely. If something goes wrong, our team steps in to resolve it and issue a refund.
              </p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/60 p-8 rounded-2xl flex items-start gap-4">
            <Truck className="w-10 h-10 text-primary-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-slate-950 text-lg mb-2">Door-to-Door Delivery</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                We pick up from the seller and drop off at your address in Adama. No need to arrange your own transport.
              </p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/60 p-8 rounded-2xl flex items-start gap-4">
            <Coins className="w-10 h-10 text-primary-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-slate-950 text-lg mb-2">Fair & Transparent Fees</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                We charge a small service fee to keep the platform running. Sellers know exactly what they earn before posting.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
