import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { Trash2, ArrowRight, ShoppingBag, ChevronLeft } from 'lucide-react';

const CartPage: React.FC = () => {
  const { user } = useAuth();
  const { items, subtotal, loading, updateQuantity, removeFromCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleQtyChange = async (productId: string, currentQty: number, change: number, stockLimit: number) => {
    const targetQty = currentQty + change;
    if (targetQty < 1) return;
    if (targetQty > stockLimit) {
      showToast(`Cannot exceed available seller stock limit of ${stockLimit} units.`, 'warning');
      return;
    }

    await updateQuantity(productId, targetQty);
  };

  const handleRemove = async (productId: string) => {
    await removeFromCart(productId);
  };

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 flex flex-col">
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-8">Your Shopping Cart</h1>

      {items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center justify-center flex-1 max-w-2xl mx-auto w-full my-12">
          <div className="bg-primary-50 p-4 rounded-full text-primary-600 mb-6">
            <ShoppingBag className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Your cart is empty</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-sm">
            It looks like you haven't added any usable materials to your cart yet. Browse our catalog to find items!
          </p>
          <Link
            to="/products"
            className="mt-6 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-xl text-sm shadow-md transition-all cursor-pointer"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Items List */}
          <div className="lg:col-span-8 space-y-4">
            {items.map((item) => (
              <div 
                key={item.product._id} 
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
              >
                {/* Image */}
                <div className="w-24 h-24 rounded-xl border border-slate-200 overflow-hidden flex-shrink-0 bg-slate-50">
                  <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                </div>
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-base line-clamp-1">{item.product.name}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border border-slate-200">
                      {item.product.condition}
                    </span>
                    <span className="text-xs text-slate-400">Stock: {item.product.quantity}</span>
                  </div>
                  <div className="text-primary-700 font-extrabold text-sm mt-3">{item.product.price} ETB</div>
                </div>
                {/* Quantity Selector */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start w-full sm:w-auto gap-4 self-stretch sm:self-center">
                  <div className="flex items-center border border-slate-200 rounded-xl bg-white">
                    <button
                      onClick={() => handleQtyChange(item.product._id, item.quantity, -1, item.product.quantity)}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => handleQtyChange(item.product._id, item.quantity, 1, item.product.quantity)}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => handleRemove(item.product._id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            ))}
            <Link to="/products" className="inline-flex items-center gap-1 text-sm font-bold text-primary-600 hover:underline pt-2">
              <ChevronLeft className="w-4 h-4" />
              Continue shopping
            </Link>
          </div>

          {/* Cart Summary */}
          <div className="lg:col-span-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 text-lg border-b border-slate-100 pb-3">Order Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Items Subtotal</span>
                <span className="font-bold text-slate-800">{subtotal.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Delivery Fee</span>
                <span className="text-slate-400 italic">TBD by logistics staff</span>
              </div>
              <div className="border-t border-slate-100 pt-4 flex justify-between text-base font-extrabold text-slate-900">
                <span>Estimated Total</span>
                <span>{subtotal.toLocaleString()} ETB</span>
              </div>
            </div>
            
            {user && user.role !== 'BUYER' ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                <strong>Logged in as {user.role}:</strong> Purchasing materials is restricted to Buyer accounts. Please sign in as a Buyer to checkout.
              </div>
            ) : (
              <button
                onClick={() => navigate('/checkout')}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-6 rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 leading-relaxed">
              <strong>Escrow Guarantee:</strong> Payment is securely held. Delivery fee is set manually per order by staff depending on size and address details inside Adama City.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
