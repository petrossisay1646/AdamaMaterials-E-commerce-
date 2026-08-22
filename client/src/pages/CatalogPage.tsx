import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import api from '../services/api';

const CatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [materialTypes, setMaterialTypes] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  // Read search params
  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const materialType = searchParams.get('materialType') || '';
  const sortBy = searchParams.get('sortBy') || 'newest';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const conditions: string[] = (searchParams.get('condition') || '').split(',').filter(Boolean);

  useEffect(() => {
    // Fetch filter options
    api.get('/categories').then(res => setCategories(res.data.categories)).catch(err => console.error(err));
    api.get('/material-types').then(res => setMaterialTypes(res.data.materialTypes)).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    setLoading(true);
    // Build query URL
    const query = new URLSearchParams();
    query.set('page', page.toString());
    query.set('limit', '8');
    if (search) query.set('search', search);
    if (category) query.set('category', category);
    if (materialType) query.set('materialType', materialType);
    if (sortBy) query.set('sortBy', sortBy);
    if (minPrice) query.set('minPrice', minPrice);
    if (maxPrice) query.set('maxPrice', maxPrice);
    if (conditions && conditions.length > 0) query.set('condition', conditions.join(','));

    api.get(`/products?${query.toString()}`)
      .then(res => {
        if (res.data.success) {
          setProducts(res.data.products);
          setTotal(res.data.total);
          setPages(res.data.pages);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const updateParam = (key: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
    nextParams.set('page', '1'); // reset page on filter change
    setSearchParams(nextParams);
  };

  const toggleCondition = (cond: string) => {
    const nextParams = new URLSearchParams(searchParams);
    let current: string[] = (searchParams.get('condition') || '').split(',').filter(Boolean);
    
    if (current.includes(cond)) {
      current = current.filter((c: string) => c !== cond);
    } else {
      current.push(cond);
    }

    if (current.length > 0) {
      nextParams.set('condition', current.join(','));
    } else {
      nextParams.delete('condition');
    }
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const handleClearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Usable Materials Catalog</h1>
          <p className="text-sm text-slate-500 mt-1">Found {total} approved materials in Adama City</p>
        </div>
        
        {/* Sort and search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => updateParam('search', e.target.value)}
              placeholder="Search materials..."
              className="pl-9 pr-4 py-2 border border-slate-200 bg-white rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => updateParam('sortBy', e.target.value)}
            className="py-2 px-3 border border-slate-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
          >
            <option value="newest">Newest First</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1">
        {/* Left Filters Panel */}
        <aside className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </span>
            <button 
              onClick={handleClearFilters}
              className="text-xs text-slate-400 hover:text-primary-600 flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="w-3 h-3" />
              Clear
            </button>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">Categories</h4>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
              <button 
                onClick={() => updateParam('category', '')}
                className={`text-left text-xs py-1.5 px-2 rounded-lg font-medium transition-colors ${!category ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                All Categories
              </button>
              {categories.map((c) => (
                <button
                  key={c._id}
                  onClick={() => updateParam('category', c.slug)}
                  className={`text-left text-xs py-1.5 px-2 rounded-lg font-medium transition-colors ${category === c.slug ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Material Types */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">Material Types</h4>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
              <button 
                onClick={() => updateParam('materialType', '')}
                className={`text-left text-xs py-1.5 px-2 rounded-lg font-medium transition-colors ${!materialType ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                All Materials
              </button>
              {materialTypes.map((m) => (
                <button
                  key={m._id}
                  onClick={() => updateParam('materialType', m.slug)}
                  className={`text-left text-xs py-1.5 px-2 rounded-lg font-medium transition-colors ${materialType === m.slug ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Condition */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">Condition</h4>
            <div className="flex flex-col gap-2">
              {['New', 'Like New', 'Good', 'Fair', 'Used'].map((cond) => (
                <label key={cond} className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={conditions.includes(cond)}
                    onChange={() => toggleCondition(cond)}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                  />
                  <span>{cond}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">Price Range (ETB)</h4>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={minPrice}
                onChange={(e) => updateParam('minPrice', e.target.value)}
                placeholder="Min"
                className="w-full py-1.5 px-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              />
              <span className="text-slate-400 text-xs font-bold">-</span>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => updateParam('maxPrice', e.target.value)}
                placeholder="Max"
                className="w-full py-1.5 px-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              />
            </div>
          </div>
        </aside>

        {/* Right Catalog Grid */}
        <main className="lg:col-span-9 flex flex-col">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 h-80 animate-pulse space-y-4">
                  <div className="bg-slate-200 w-full h-40 rounded-xl"></div>
                  <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-500 flex flex-col items-center justify-center flex-1">
              <RotateCcw className="w-12 h-12 text-slate-300 mb-4 animate-spin-reverse" />
              <h3 className="font-bold text-lg text-slate-800">No materials match your filters</h3>
              <p className="text-sm text-slate-400 mt-1">Try tweaking your keywords or category selections</p>
              <button 
                onClick={handleClearFilters}
                className="mt-6 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
                {products.map((p) => (
                  <Link
                    key={p._id}
                    to={`/products/${p._id}`}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
                  >
                    <div className="aspect-square bg-slate-100 relative overflow-hidden">
                      <img
                        src={p.images?.[0] || 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=600&auto=format&fit=crop&q=80'}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.onerror = null;
                          target.src = 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=600&auto=format&fit=crop&q=80';
                        }}
                      />
                      <span className="absolute top-3 left-3 bg-white/95 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-wide">
                        {p.condition}
                      </span>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{p.category?.name || 'Category'}</span>
                        <h4 className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-primary-600 transition-colors mt-0.5">{p.name}</h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{p.description}</p>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                        <span className="text-primary-700 font-extrabold text-sm">{p.price} ETB</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
                          {p.materialType?.name || 'Material'}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-12 border-t border-slate-200/80 pt-6">
                  <button
                    disabled={page === 1}
                    onClick={() => updateParam('page', (page - 1).toString())}
                    className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-semibold text-slate-600">Page {page} of {pages}</span>
                  <button
                    disabled={page === pages}
                    onClick={() => updateParam('page', (page + 1).toString())}
                    className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default CatalogPage;
