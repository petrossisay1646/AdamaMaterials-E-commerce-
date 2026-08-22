import React, { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Truck, Landmark, DollarSign, ClipboardList, Check, X, ShieldAlert } from 'lucide-react';
import api from '../services/api';

const StaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [bankPayments, setBankPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs management
  const [activeTab, setActiveTab] = useState<'DELIVERIES' | 'FEES' | 'BANK_VERIFICATION'>('DELIVERIES');

  // Operational states
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [submittingFee, setSubmittingFee] = useState(false);

  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [processingVerification, setProcessingVerification] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Helper check for permission
  const hasPermission = (perm: string) => {
    if (user?.role === 'ADMIN') return true;
    return user?.staffPermissions?.includes(perm) || false;
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch deliveries
      if (hasPermission('VIEW_ORDERS') || hasPermission('MANAGE_DELIVERIES')) {
        const delRes = await api.get('/deliveries');
        if (delRes.data.success) {
          setDeliveries(delRes.data.deliveries || []);
        }
      }

      // 2. Fetch pending manual payments
      if (hasPermission('VERIFY_PAYMENTS')) {
        const payRes = await api.get('/payments/pending');
        if (payRes.data.success) {
          setBankPayments(payRes.data.payments || []);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Error fetching staff tasks.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-switch to verification tab when there are pending bank payments
  useEffect(() => {
    if (bankPayments.length > 0 && hasPermission('VERIFY_PAYMENTS')) {
      setActiveTab('BANK_VERIFICATION');
    }
  }, [bankPayments]);

  // Update delivery status
  const handleUpdateDeliveryStatus = async (deliveryId: string, status: string, note: string) => {
    try {
      const res = await api.put('/deliveries/status', {
        deliveryId,
        status,
        note,
      });

      if (res.data.success) {
        showToast(`Delivery status updated to ${status}.`, 'success');
        fetchDashboardData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update status.', 'error');
    }
  };

  // Submit delivery fee
  const handleSetDeliveryFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDelivery || !deliveryFee) return;
    setSubmittingFee(true);

    try {
      const res = await api.post('/deliveries/set-fee', {
        deliveryId: selectedDelivery._id,
        fee: Number(deliveryFee),
      });

      if (res.data.success) {
        showToast(`Delivery fee set to ${deliveryFee} ETB. Order total updated.`, 'success');
        setSelectedDelivery(null);
        setDeliveryFee('');
        fetchDashboardData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to set fee.', 'error');
    } finally {
      setSubmittingFee(false);
    }
  };

  // Verify manual transfer
  const handleVerifyPayment = async (status: 'PAID' | 'FAILED') => {
    if (!selectedPayment) return;
    setProcessingVerification(true);

    try {
      const res = await api.post('/payments/verify-manual', {
        paymentId: selectedPayment._id,
        status,
        notes: verificationNotes,
      });

      if (res.data.success) {
        showToast(`Bank transfer verified as: ${status}.`, 'success');
        setSelectedPayment(null);
        setVerificationNotes('');
        fetchDashboardData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to verify payment.', 'error');
    } finally {
      setProcessingVerification(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Filter deliveries with fee = 0 (means fee needs to be set)
  const deliveriesNeedingFee = deliveries.filter(d => d.fee === 0 && d.order?.orderStatus !== 'CANCELLED');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Staff Operations Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Manage platform deliveries, bank confirmations, and logistics.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3 flex-wrap">
        {(hasPermission('VIEW_ORDERS') || hasPermission('MANAGE_DELIVERIES')) && (
          <button
            onClick={() => setActiveTab('DELIVERIES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'DELIVERIES' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Truck className="w-4 h-4" />
            Assigned Deliveries ({deliveries.length})
          </button>
        )}

        {hasPermission('SET_DELIVERY_FEES') && (
          <button
            onClick={() => setActiveTab('FEES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'FEES' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <DollarSign className="w-4 h-4" />
            Set Delivery Fees ({deliveriesNeedingFee.length})
          </button>
        )}

        {hasPermission('VERIFY_PAYMENTS') && (
          <button
            onClick={() => setActiveTab('BANK_VERIFICATION')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'BANK_VERIFICATION' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Landmark className="w-4 h-4" />
            Bank Confirmations
            {bankPayments.length > 0 ? (
              <span className="ml-1 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {bankPayments.length}
              </span>
            ) : (
              <span className="ml-1 text-slate-400">(0)</span>
            )}
          </button>
        )}
      </div>

      {/* Panels */}
      <div className="flex-1 flex flex-col">
        
        {/* TAB 1: DELIVERIES LIST */}
        {activeTab === 'DELIVERIES' && (
          deliveries.length === 0 ? (
            <div className="bg-white border border-slate-200 p-16 text-center text-slate-400 rounded-2xl shadow-sm">
              No active delivery tasks assigned to your account.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Tracking Code</th>
                    <th className="p-4">Address Details</th>
                    <th className="p-4">Delivery Fee</th>
                    <th className="p-4">Method</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deliveries.map(d => (
                    <tr key={d._id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-bold text-slate-800">{d.order?.trackingNumber}</td>
                      <td className="p-4 max-w-xs truncate">
                        {d.order?.deliveryAddress.streetAddress}, {d.order?.deliveryAddress.subCity}
                      </td>
                      <td className="p-4 font-semibold">{d.fee} ETB</td>
                      <td className="p-4 uppercase">{d.order?.paymentMethod.replace('_', ' ')}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                          d.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          d.status === 'OUT_FOR_DELIVERY' ? 'bg-blue-50 text-blue-700 border border-blue-100 animate-pulse' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="p-4 flex gap-2">
                        {d.status === 'ASSIGNED' && (
                          <button
                            onClick={() => handleUpdateDeliveryStatus(d._id, 'PICKED_UP', 'Courier picked up package')}
                            className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Mark Picked Up
                          </button>
                        )}
                        {d.status === 'PICKED_UP' && (
                          <button
                            onClick={() => handleUpdateDeliveryStatus(d._id, 'OUT_FOR_DELIVERY', 'Out for delivery in Adama')}
                            className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Mark Out for Delivery
                          </button>
                        )}
                        {d.status === 'OUT_FOR_DELIVERY' && (
                          <>
                            <button
                              onClick={() => handleUpdateDeliveryStatus(d._id, 'DELIVERED', 'Delivered successfully')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Deliver
                            </button>
                            <button
                              onClick={() => handleUpdateDeliveryStatus(d._id, 'FAILED', 'Delivery attempt failed')}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Fail
                            </button>
                          </>
                        )}
                        {d.status === 'DELIVERED' && <span className="text-slate-400 italic">Delivered ✓</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* TAB 2: SET DELIVERY FEES */}
        {activeTab === 'FEES' && (
          deliveriesNeedingFee.length === 0 ? (
            <div className="bg-white border border-slate-200 p-16 text-center text-slate-400 rounded-2xl shadow-sm">
              All deliveries have pricing fees set. No pending calculations!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deliveriesNeedingFee.map(d => (
                <div key={d._id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Order reference</span>
                    <h3 className="font-bold text-slate-900 text-sm">{d.order?.trackingNumber}</h3>
                    <p className="text-slate-500 text-xs">
                      Address: <strong>{d.order?.deliveryAddress.streetAddress}, {d.order?.deliveryAddress.subCity}</strong>
                    </p>
                  </div>

                  <form 
                    onSubmit={handleSetDeliveryFee}
                    className="flex flex-col gap-2.5 pt-2 border-t border-slate-100"
                  >
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Set Delivery Fee (ETB)</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 150"
                        value={selectedDeliveryId === d._id ? deliveryFee : ''}
                        onChange={e => {
                          setSelectedDeliveryId(d._id);
                          setSelectedDelivery(d);
                          setDeliveryFee(e.target.value);
                        }}
                        className="w-full py-1.5 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submittingFee && selectedDeliveryId === d._id}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {submittingFee && selectedDeliveryId === d._id ? 'Saving...' : 'Confirm Delivery Fee'}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )
        )}

        {/* TAB 3: BANK VERIFICATION */}
        {activeTab === 'BANK_VERIFICATION' && (
          bankPayments.length === 0 ? (
            <div className="bg-white border border-slate-200 p-16 text-center text-slate-400 rounded-2xl shadow-sm">
              No manual bank transfers awaiting validation.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bankPayments.map(p => (
                <div key={p._id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Order Reference</span>
                      <h4 className="font-bold text-slate-900 text-sm">{p.order?.trackingNumber}</h4>
                      <div className="text-[10px] text-slate-500 mt-0.5">Buyer: {p.order?.buyer?.name || 'Buyer'} ({p.order?.buyer?.email})</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Transfer Amount</span>
                      <span className="font-black text-sm text-primary-900">{p.amount?.toLocaleString()} ETB</span>
                    </div>
                  </div>

                  {/* Payment Details / Proof Section */}
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                    {/* Transaction Reference ID */}
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Transaction ID</span>
                      <span className="font-mono text-xs font-extrabold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {p.refNumber || p.transactionId || 'No ID Provided'}
                      </span>
                    </div>

                    {/* Method & Bank Name */}
                    {(p.botPaymentMethod || p.bankName || p.provider) && (
                      <div className="flex justify-between items-center text-xs text-slate-600">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Method</span>
                        <span className="font-semibold text-slate-800">
                          {p.botPaymentMethod || p.provider || 'BANK_TRANSFER'} {p.bankName ? `(${p.bankName})` : ''}
                        </span>
                      </div>
                    )}

                    {/* Receipt Screenshot Image Preview */}
                    {p.receiptImage && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Payment Screenshot</span>
                          <button
                            type="button"
                            onClick={() => {
                              const resolved = p.receiptImage?.startsWith('data:') || p.receiptImage?.startsWith('blob:') 
                                ? p.receiptImage 
                                : p.receiptImage?.startsWith('http://localhost:5000/uploads/')
                                  ? ((import.meta.env.VITE_API_URL || '').replace('/api/v1', '') + '/uploads/' + p.receiptImage.replace('http://localhost:5000/uploads/', ''))
                                  : p.receiptImage?.startsWith('/uploads/')
                                    ? ((import.meta.env.VITE_API_URL || '').replace('/api/v1', '') + p.receiptImage)
                                    : p.receiptImage;
                              setPreviewImageUrl(resolved);
                            }}
                            className="text-[10px] text-primary-600 font-bold hover:underline cursor-pointer"
                          >
                            🔍 Zoom Full View
                          </button>
                        </div>
                        {p.receiptImage.startsWith('http') || p.receiptImage.startsWith('/uploads') || p.receiptImage.startsWith('data:') ? (
                          <div 
                            onClick={() => {
                              const resolved = p.receiptImage?.startsWith('data:') || p.receiptImage?.startsWith('blob:') 
                                ? p.receiptImage 
                                : p.receiptImage?.startsWith('http://localhost:5000/uploads/')
                                  ? ((import.meta.env.VITE_API_URL || '').replace('/api/v1', '') + '/uploads/' + p.receiptImage.replace('http://localhost:5000/uploads/', ''))
                                  : p.receiptImage?.startsWith('/uploads/')
                                    ? ((import.meta.env.VITE_API_URL || '').replace('/api/v1', '') + p.receiptImage)
                                    : p.receiptImage;
                              setPreviewImageUrl(resolved);
                            }}
                            className="relative group cursor-pointer border border-slate-200 rounded-xl overflow-hidden bg-slate-900 hover:border-primary-400 transition-all max-h-52 flex items-center justify-center p-1"
                          >
                            <img 
                              src={
                                p.receiptImage.startsWith('data:') || p.receiptImage.startsWith('blob:')
                                  ? p.receiptImage
                                  : p.receiptImage.startsWith('http://localhost:5000/uploads/')
                                    ? ((import.meta.env.VITE_API_URL || '').replace('/api/v1', '') + '/uploads/' + p.receiptImage.replace('http://localhost:5000/uploads/', ''))
                                    : p.receiptImage.startsWith('/uploads/')
                                      ? ((import.meta.env.VITE_API_URL || '').replace('/api/v1', '') + p.receiptImage)
                                      : p.receiptImage
                              } 
                              alt="Receipt Screenshot" 
                              className="max-h-48 w-auto object-contain rounded-lg group-hover:scale-102 transition-transform" 
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                              🔍 Click to Zoom & Inspect
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 break-all">
                            Telegram File: {p.receiptImage}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Verification audit notes</label>
                      <input
                        type="text"
                        placeholder="e.g. CBE Transfer confirmed on bank statement"
                        value={selectedPaymentId === p._id ? verificationNotes : ''}
                        onChange={e => {
                          setSelectedPaymentId(p._id);
                          setSelectedPayment(p);
                          setVerificationNotes(e.target.value);
                        }}
                        className="w-full py-1.5 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedPaymentId(p._id);
                          setSelectedPayment(p);
                          handleVerifyPayment('PAID');
                        }}
                        disabled={processingVerification && selectedPaymentId === p._id}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1 text-xs shadow-sm"
                      >
                        <Check className="w-4 h-4" />
                        Approve Payment
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPaymentId(p._id);
                          setSelectedPayment(p);
                          handleVerifyPayment('FAILED');
                        }}
                        disabled={processingVerification && selectedPaymentId === p._id}
                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1 text-xs"
                      >
                        <X className="w-4 h-4" />
                        Reject / Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Full Image Preview Modal */}
        {previewImageUrl && (
          <div 
            onClick={() => setPreviewImageUrl(null)}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-pointer"
          >
            <div 
              onClick={e => e.stopPropagation()} 
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <span className="font-bold text-slate-900 text-sm">Payment Receipt Full View</span>
                <button 
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-900">
                <img 
                  src={previewImageUrl} 
                  alt="Receipt Inspection" 
                  className="max-h-[75vh] w-auto object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default StaffDashboard;
