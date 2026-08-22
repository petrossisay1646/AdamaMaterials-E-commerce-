import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { ShoppingBag, Truck, AlertTriangle, MessageSquare, Star, Landmark, ChevronRight, X, AlertCircle, HelpCircle } from 'lucide-react';
import api from '../services/api';

const BuyerDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Review modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewProduct, setReviewProduct] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Dispute modal
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('ITEM_NOT_RECEIVED');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeProduct, setDisputeProduct] = useState<any>(null);
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Disputes list
  const [disputes, setDisputes] = useState<any[]>([]);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders');
      if (res.data.success) {
        setOrders(res.data.orders);
        
        // Select initial order if provided in search params
        const urlOrderId = searchParams.get('order');
        if (urlOrderId) {
          const found = res.data.orders.find((o: any) => o._id === urlOrderId);
          if (found) setSelectedOrder(found);
        } else if (res.data.orders.length > 0 && !selectedOrder) {
          setSelectedOrder(res.data.orders[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDisputes = async () => {
    try {
      const res = await api.get('/disputes/my');
      if (res.data.success) {
        setDisputes(res.data.disputes);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchDisputes();
  }, [searchParams]);

  const handleSelectOrder = async (orderId: string) => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      if (res.data.success) {
        setSelectedOrder(res.data.order);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Direct payment proof submission
  const [bankRef, setBankRef] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submittingRef, setSubmittingRef] = useState(false);

  const [receiptBase64, setReceiptBase64] = useState<string>('');

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setReceiptPreview(dataUrl);
        setReceiptBase64(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveReceiptFile = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptBase64('');
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankRef.trim() && !receiptFile && !receiptBase64) {
      showToast('Please enter a Transaction Reference ID or upload a receipt screenshot.', 'warning');
      return;
    }
    setSubmittingRef(true);

    try {
      const formData = new FormData();
      formData.append('orderId', selectedOrder._id);
      if (bankRef.trim()) {
        formData.append('refNumber', bankRef.trim());
      }
      if (receiptBase64) {
        formData.append('receiptImage', receiptBase64);
      } else if (receiptFile) {
        formData.append('receiptImage', receiptFile);
      }

      const res = await api.post('/payments/submit-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        showToast('Payment proof submitted successfully! Pending verification.', 'success');
        setBankRef('');
        handleRemoveReceiptFile();
        await handleSelectOrder(selectedOrder._id);
        fetchOrders();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to submit payment proof.', 'error');
    } finally {
      setSubmittingRef(false);
    }
  };

  // Submit product review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmittingReview(true);

    try {
      const res = await api.post('/reviews', {
        productId: reviewProduct.product._id,
        orderId: selectedOrder._id,
        rating,
        comment,
      });

      if (res.data.success) {
        showToast('Review submitted successfully!', 'success');
        setShowReviewModal(false);
        setComment('');
        setReviewProduct(null);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to submit review.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Submit dispute
  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeDescription.trim()) return;
    setSubmittingDispute(true);

    try {
      const res = await api.post('/disputes', {
        orderId: selectedOrder._id,
        productId: disputeProduct?.product?._id, // optional
        reason: disputeReason,
        description: disputeDescription,
      });

      if (res.data.success) {
        showToast('Dispute opened. Payout held until administrator review.', 'success');
        setShowDisputeModal(false);
        setDisputeDescription('');
        setDisputeProduct(null);
        // Refresh
        await handleSelectOrder(selectedOrder._id);
        fetchOrders();
        fetchDisputes();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to open dispute.', 'error');
    } finally {
      setSubmittingDispute(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left panel: Orders list */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col self-stretch">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <ShoppingBag className="w-4.5 h-4.5 text-primary-600" />
            Your Purchases
          </h2>
        </div>

        {orders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No orders placed yet.</div>
        ) : (
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-[70vh]">
            {orders.map((o) => (
              <button
                key={o._id}
                onClick={() => handleSelectOrder(o._id)}
                className={`w-full text-left p-4 flex items-center justify-between transition-colors ${selectedOrder?._id === o._id ? 'bg-primary-50/30' : 'hover:bg-slate-50'}`}
              >
                <div className="space-y-1">
                  <div className="font-bold text-slate-800 text-xs">{o.trackingNumber}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">{o.paymentMethod.replace('_', ' ')}</div>
                  <div className="text-slate-500 font-extrabold text-xs">{o.total.toLocaleString()} ETB</div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    o.orderStatus === 'DELIVERED' || o.orderStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    o.orderStatus === 'DISPUTED' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                    o.orderStatus === 'CONFIRMED' || o.orderStatus === 'PROCESSING' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {o.orderStatus}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: Active order details */}
      <div className="lg:col-span-8 space-y-6">
        {selectedOrder ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-4">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase">Tracking number</span>
                <h3 className="font-bold text-slate-900 text-base">{selectedOrder.trackingNumber}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                  selectedOrder.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  selectedOrder.paymentStatus === 'PENDING_VERIFICATION' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  Payment: {selectedOrder.paymentStatus}
                </span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                  selectedOrder.deliveryStatus === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  selectedOrder.deliveryStatus === 'OUT_FOR_DELIVERY' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  Delivery: {selectedOrder.deliveryStatus}
                </span>
              </div>
            </div>

            {/* Tracking Progress Bar */}
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-primary-600" />
                Delivery Tracking
              </h4>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(selectedOrder.deliveryStatus) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>✓</span>
                  <span className="font-semibold">Courier Assigned</span>
                </div>
                <div className="hidden sm:block h-0.5 bg-slate-200 flex-1"></div>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(selectedOrder.deliveryStatus) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>✓</span>
                  <span className="font-semibold">Picked Up</span>
                </div>
                <div className="hidden sm:block h-0.5 bg-slate-200 flex-1"></div>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${['OUT_FOR_DELIVERY', 'DELIVERED'].includes(selectedOrder.deliveryStatus) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>✓</span>
                  <span className="font-semibold">Out for Delivery</span>
                </div>
                <div className="hidden sm:block h-0.5 bg-slate-200 flex-1"></div>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${selectedOrder.deliveryStatus === 'DELIVERED' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>✓</span>
                  <span className="font-semibold">Delivered</span>
                </div>
              </div>
            </div>

            {/* Bank Transfer / Telebirr Payment Proof Submission */}
            {selectedOrder.paymentStatus !== 'PAID' && selectedOrder.orderStatus !== 'CANCELLED' && (
              <div className="p-5 border border-amber-200 bg-amber-50/60 rounded-2xl space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                  <h4 className="font-bold text-amber-950 text-sm flex items-center gap-2">
                    <Landmark className="w-4.5 h-4.5 text-amber-700" />
                    Payment Instructions & Proof Submission
                  </h4>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase">
                    {selectedOrder.paymentStatus}
                  </span>
                </div>

                <div className="text-xs text-amber-900 space-y-2 bg-white/70 p-3.5 rounded-xl border border-amber-200/60">
                  <p className="font-semibold text-slate-800">Please transfer <strong>{selectedOrder.total?.toLocaleString()} ETB</strong> to:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 font-mono text-[11px]">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="block text-[10px] text-slate-400 font-sans font-bold uppercase">CBE Bank</span>
                      <strong>1000554433221</strong> (AdaMaterials)
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="block text-[10px] text-slate-400 font-sans font-bold uppercase">Telebirr</span>
                      <strong>+251911223344</strong> (AdaMaterials)
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmitProof} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Transaction Reference ID
                      </label>
                      <input
                        type="text"
                        value={bankRef}
                        onChange={(e) => setBankRef(e.target.value)}
                        placeholder="e.g. FT260811xxxx or Telebirr Code"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Receipt Screenshot / Photo
                      </label>
                      {receiptPreview ? (
                        <div className="flex items-center gap-2 border border-slate-200 rounded-xl p-1.5 bg-white">
                          <img src={receiptPreview} alt="Receipt" className="w-9 h-9 object-cover rounded-lg" />
                          <span className="text-[10px] text-slate-600 truncate flex-1">{receiptFile?.name}</span>
                          <button
                            type="button"
                            onClick={handleRemoveReceiptFile}
                            className="text-[10px] text-rose-600 font-bold px-1.5 py-0.5 hover:bg-rose-50 rounded"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <label className="border border-slate-300 hover:border-amber-500 bg-white rounded-xl px-3 py-2 flex items-center justify-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600 hover:text-amber-700 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleReceiptFileChange}
                            className="sr-only"
                          />
                          <span>📷</span>
                          <span>Upload Screenshot</span>
                        </label>
                      )}
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={submittingRef || (!bankRef.trim() && !receiptFile)}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {submittingRef ? 'Submitting...' : '✓ Submit Proof for Staff Verification'}
                  </button>
                </form>
              </div>
            )}

            {/* Order Items */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Purchased Items</h4>
              <div className="divide-y divide-slate-100">
                {selectedOrder.items.map((item: any) => (
                  <div key={item._id} className="py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex-shrink-0">
                        <img src={item.product?.images?.[0] || 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=500&auto=format&fit=crop&q=60'} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 text-xs">{item.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.quantity} x {item.price} ETB</div>
                      </div>
                    </div>
                    
                    {/* Item action buttons (reviews & disputes) */}
                    <div className="flex gap-2">
                      {selectedOrder.deliveryStatus === 'DELIVERED' && (
                        <button
                          onClick={() => {
                            setReviewProduct(item);
                            setShowReviewModal(true);
                          }}
                          className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-1 hover:bg-slate-50 cursor-pointer"
                        >
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          Review Item
                        </button>
                      )}
                      {['CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(selectedOrder.orderStatus) && (
                        <button
                          onClick={() => {
                            setDisputeProduct(item);
                            setShowDisputeModal(true);
                          }}
                          className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-[10px] font-bold text-rose-600 flex items-center gap-1 rounded-lg cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Open Dispute
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Address and details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-100 pt-6 text-xs text-slate-600">
              <div className="space-y-1">
                <span className="font-bold text-slate-800 block mb-1">Delivery Address:</span>
                <div>Street: {selectedOrder.deliveryAddress.streetAddress}</div>
                <div>Subcity: {selectedOrder.deliveryAddress.subCity}</div>
                <div>City: {selectedOrder.deliveryAddress.city}</div>
                <div>Phone: {selectedOrder.deliveryAddress.phoneNumber}</div>
              </div>
              <div className="space-y-1 text-right sm:text-right">
                <span className="font-bold text-slate-800 block mb-1">Payment Breakdowns:</span>
                <div>Subtotal: {selectedOrder.subtotal.toLocaleString()} ETB</div>
                <div>Delivery Fee: {selectedOrder.deliveryFee.toLocaleString()} ETB</div>
                <div className="font-extrabold text-sm text-primary-900 mt-1">Total: {selectedOrder.total.toLocaleString()} ETB</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-400">
            No order details selected. Click an order from the list to view tracking details.
          </div>
        )}

        {/* Disputes History */}
        {disputes.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-1.5">
              <AlertCircle className="w-4.5 h-4.5 text-rose-500" />
              Disputes Raised
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {disputes.map(d => (
                <div key={d._id} className="py-3 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-800">Order: {d.order.trackingNumber}</div>
                    <div className="text-slate-500 mt-0.5">Reason: {d.reason}</div>
                    {d.adminNotes && <div className="text-slate-400 mt-1 italic">Notes: {d.adminNotes}</div>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                    d.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    'bg-rose-50 text-rose-600 border border-rose-100'
                  }`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Write a Product Review</h3>
              <button onClick={() => setShowReviewModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Rating</label>
                <select 
                  value={rating} 
                  onChange={e => setRating(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                >
                  <option value="5">5 Stars - Excellent</option>
                  <option value="4">4 Stars - Good</option>
                  <option value="3">3 Stars - Average</option>
                  <option value="2">2 Stars - Poor</option>
                  <option value="1">1 Star - Terrible</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Comment</label>
                <textarea
                  required
                  rows={4}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Share your experience with this usable material..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-950 bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={submittingReview}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Open Dispute for Order</h3>
              <button onClick={() => setShowDisputeModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmitDispute} className="space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[10px] text-rose-800 leading-relaxed">
                <strong>Attention:</strong> Initiating a dispute immediately locks the seller payout in our escrow database. Platform administrators will investigate the transaction.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason</label>
                <select 
                  value={disputeReason} 
                  onChange={e => setDisputeReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                >
                  <option value="ITEM_NOT_RECEIVED">Item Not Received</option>
                  <option value="ITEM_NOT_AS_DESCRIBED">Item Not as Described</option>
                  <option value="DAMAGED_ITEM">Damaged Item</option>
                  <option value="INCORRECT_QUANTITY">Incorrect Quantity</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description / Proof Details</label>
                <textarea
                  required
                  rows={4}
                  value={disputeDescription}
                  onChange={e => setDisputeDescription(e.target.value)}
                  placeholder="Describe the issue in detail. Add tracking numbers or delivery context..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-950 bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={submittingDispute}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingDispute ? 'Submitting...' : 'File Dispute'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerDashboard;
