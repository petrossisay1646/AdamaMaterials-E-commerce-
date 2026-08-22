import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ChevronLeft, ShoppingCart, ShieldAlert, Star, MapPin, Tag, Box, Heart } from 'lucide-react';
import api from '../services/api';

const ProductDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState('');

  const { addToCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    
    // Fetch product details
    api.get(`/products/${id}`)
      .then(res => {
        if (res.data.success) {
          setProduct(res.data.product);
          setRelated(res.data.relatedProducts || []);
          if (res.data.product.images && res.data.product.images.length > 0) {
            setActiveImage(res.data.product.images[0]);
          }
        }
      })
      .catch(err => {
        console.error(err);
        showToast('Failed to load product details.', 'error');
      })
      .finally(() => setLoading(false));

    // Fetch product reviews
    api.get(`/reviews/product/${id}`)
      .then(res => {
        if (res.data.success) {
          setReviews(res.data.reviews || []);
          setAvgRating(res.data.averageRating || 0);
        }
      })
      .catch(err => console.error(err));
  }, [id, showToast]);

  const handleAddToCart = async () => {
    if (!user) {
      showToast('Please log in to add items to your cart.', 'warning');
      navigate('/login');
      return;
    }

    if (user.role !== 'BUYER') {
      showToast('Only BUYERS can purchase items.', 'warning');
      return;
    }

    if (product.seller._id === user._id) {
      showToast('You cannot purchase your own material listing.', 'warning');
      return;
    }

    const success = await addToCart(product._id, quantity);
    if (success) {
      navigate('/cart');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Product not found</h2>
        <p className="text-slate-500 mt-2">The product you are looking for does not exist or is pending review.</p>
        <Link to="/products" className="inline-flex items-center gap-1 mt-6 text-primary-600 font-bold hover:underline">
          <ChevronLeft className="w-4 h-4" />
          Back to Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1">
      {/* Back button */}
      <Link to="/products" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-primary-600 mb-8 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Back to Catalog
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
        {/* Left: Product Images */}
        <div className="lg:col-span-7 space-y-4">
          <div className="aspect-square bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative">
            <img 
              src={activeImage} 
              alt={product.name} 
              className="w-full h-full object-cover"
            />
            {product.quantity === 0 && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <span className="bg-rose-500 text-white font-extrabold text-lg px-6 py-2.5 rounded-xl shadow-lg border border-rose-400">OUT OF STOCK</span>
              </div>
            )}
          </div>
          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto py-1">
              {product.images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`w-20 h-20 rounded-xl border overflow-hidden flex-shrink-0 transition-all ${activeImage === img ? 'border-primary-600 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-400'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Info and Actions */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-primary-50 text-primary-700 border border-primary-100 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                {product.category?.name || 'Category'}
              </span>
              <span className="bg-accent-50 text-accent-700 border border-accent-100 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                {product.condition}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-3">{product.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-0.5 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4.5 h-4.5 ${i < Math.round(avgRating) ? 'fill-amber-500' : 'text-slate-300'}`} />
                ))}
              </div>
              <span className="text-xs font-semibold text-slate-500">({reviews.length} reviews)</span>
            </div>
          </div>

          <div className="text-2xl font-black text-primary-900">
            {product.price.toLocaleString()} ETB
            <span className="text-xs font-semibold text-slate-400 block mt-1">Managed escrow payment</span>
          </div>

          <div className="border-t border-b border-slate-200/80 py-4 space-y-3">
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <MapPin className="w-4.5 h-4.5 text-slate-400 flex-shrink-0" />
              <span>Location: <strong>{product.location.subCity}, Adama</strong></span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <Tag className="w-4.5 h-4.5 text-slate-400 flex-shrink-0" />
              <span>Material: <strong>{product.materialType?.name}</strong></span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <Box className="w-4.5 h-4.5 text-slate-400 flex-shrink-0" />
              <span>In Stock: <strong className={product.quantity > 0 ? 'text-slate-800' : 'text-rose-500'}>{product.quantity} units</strong></span>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>

          {/* Checkout controls */}
          {user && user.role !== 'BUYER' ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex flex-col gap-1">
              <span className="font-bold text-amber-950">Logged in as {user.role} ({user.name})</span>
              <span>Only registered <strong>BUYER</strong> accounts are authorized to purchase materials. If you wish to purchase, please sign in with a Buyer account.</span>
            </div>
          ) : product.quantity > 0 ? (
            <div className="space-y-4 pt-2">
              {/* Quantity counter */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-700">Quantity:</span>
                <div className="flex items-center border border-slate-200 rounded-xl bg-white">
                  <button 
                    disabled={quantity <= 1}
                    onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                    className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-sm font-bold">{quantity}</span>
                  <button 
                    disabled={quantity >= product.quantity}
                    onClick={() => setQuantity(prev => Math.min(product.quantity, prev + 1))}
                    className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-6 rounded-xl text-sm shadow-lg shadow-primary-200/80 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingCart className="w-4.5 h-4.5" />
                  Add to Cart
                </button>
              </div>
            </div>
          ) : null}

          {/* Seller profile reference */}
          <div className="bg-slate-100 border border-slate-200 p-4 rounded-2xl flex flex-col gap-1 text-xs text-slate-500">
            <span className="font-bold text-slate-700">Seller details:</span>
            <span>Name: {product.seller?.name || 'Verified Seller'}</span>
            <span>Escrow Guarantee: Payout is held until courier delivery completes.</span>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <section className="border-t border-slate-200/80 pt-12 mb-16">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Customer Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-slate-400 text-sm">No reviews yet for this product. Be the first to review after purchase!</p>
        ) : (
          <div className="space-y-6 max-w-3xl">
            {reviews.map((r) => (
              <div key={r._id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-bold text-sm text-slate-800">{r.buyer.name}</h5>
                    <div className="flex items-center gap-0.5 text-amber-500 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'fill-amber-500' : 'text-slate-300'}`} />
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-slate-600 mt-3 italic">"{r.comment}"</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="border-t border-slate-200/80 pt-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Related Materials</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((p) => (
              <Link 
                key={p._id} 
                to={`/products/${p._id}`}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
              >
                <div className="aspect-square bg-slate-100 relative overflow-hidden">
                  <img 
                    src={p.images[0]} 
                    alt={p.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-2 left-2 bg-white/95 text-slate-800 text-[9px] font-bold px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-wide">
                    {p.condition}
                  </span>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <h4 className="font-bold text-slate-900 text-xs line-clamp-1 group-hover:text-primary-600 transition-colors">{p.name}</h4>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <span className="text-primary-700 font-extrabold text-xs">{p.price} ETB</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetailsPage;
