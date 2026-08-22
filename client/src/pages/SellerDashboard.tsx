import React, { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { Plus, Check, Clock, AlertCircle, Trash2, ArrowUpRight, DollarSign, Wallet, FileText, Upload, X } from 'lucide-react';
import api from '../services/api';

const SellerDashboard: React.FC = () => {
  const { showToast } = useToast();

  const [products, setProducts] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalSales: 0,
    eligiblePayout: 0,
    paidPayout: 0,
    pendingPayout: 0,
  });

  const [categories, setCategories] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LISTINGS' | 'PAYOUTS'>('LISTINGS');

  // Create listing form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [materialTypeId, setMaterialTypeId] = useState('');
  const [condition, setCondition] = useState('Good');
  const [subCity, setSubCity] = useState('Bole');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);

  const fetchEarningsAndPayouts = async () => {
    try {
      const res = await api.get('/payouts/my/listings');
      if (res.data.success) {
        setPayouts(res.data.payouts || []);
        setStats(res.data.stats || { totalSales: 0, eligiblePayout: 0, paidPayout: 0, pendingPayout: 0 });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products/my/listings');
      if (res.data.success) {
        setProducts(res.data.products || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFormOptions = async () => {
    try {
      const catRes = await api.get('/categories');
      const matRes = await api.get('/material-types');
      if (catRes.data.success) setCategories(catRes.data.categories);
      if (matRes.data.success) setMaterials(matRes.data.materialTypes);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([fetchEarningsAndPayouts(), fetchProducts(), fetchFormOptions()])
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }

    try {
      const res = await api.post('/products/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setUploadedImages(prev => [...prev, ...res.data.urls]);
        showToast('Images uploaded successfully!', 'success');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Image upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadedImages.length === 0) {
      showToast('Please upload at least one product image.', 'warning');
      return;
    }
    setSubmittingProduct(true);

    try {
      const res = await api.post('/products', {
        name,
        description,
        price: Number(price),
        quantity: Number(quantity),
        category: categoryId || categories[0]?._id,
        materialType: materialTypeId || materials[0]?._id,
        condition,
        images: uploadedImages,
        location: { subCity, city: 'Adama' },
      });

      if (res.data.success) {
        showToast('Material listing created in DRAFT state!', 'success');
        setShowCreateModal(false);
        // Reset form
        setName('');
        setDescription('');
        setPrice('');
        setQuantity('1');
        setUploadedImages([]);
        // Refresh products
        fetchProducts();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create product.', 'error');
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleSubmitForApproval = async (productId: string) => {
    try {
      const res = await api.post(`/products/${productId}/submit`);
      if (res.data.success) {
        showToast('Product submitted for review!', 'success');
        fetchProducts();
      }
    } catch (err) {
      showToast('Failed to submit product for approval.', 'error');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    try {
      const res = await api.delete(`/products/${productId}`);
      if (res.data.success) {
        showToast('Listing deleted successfully.', 'info');
        fetchProducts();
      }
    } catch (err) {
      showToast('Failed to delete product.', 'error');
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 flex flex-col gap-10">
      
      {/* Earnings dashboard cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-primary-50 text-primary-600 p-3 rounded-xl"><DollarSign className="w-6 h-6" /></div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase block">Total Sales</span>
            <span className="text-xl font-black text-slate-900">{stats.totalSales.toLocaleString()} ETB</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl"><Wallet className="w-6 h-6" /></div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase block">Paid Payouts</span>
            <span className="text-xl font-black text-slate-900">{stats.paidPayout.toLocaleString()} ETB</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl"><Check className="w-6 h-6" /></div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase block">Eligible (Delivered)</span>
            <span className="text-xl font-black text-slate-900">{stats.eligiblePayout.toLocaleString()} ETB</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-amber-50 text-amber-600 p-3 rounded-xl"><Clock className="w-6 h-6" /></div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase block">Pending Payouts</span>
            <span className="text-xl font-black text-slate-900">{stats.pendingPayout.toLocaleString()} ETB</span>
          </div>
        </div>
      </section>

      {/* Tabs and Actions bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-3 gap-4">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('LISTINGS')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'LISTINGS' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Material Listings
          </button>
          <button 
            onClick={() => setActiveTab('PAYOUTS')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'PAYOUTS' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Payout History
          </button>
        </div>

        <button
          onClick={() => {
            if (categories.length > 0) setCategoryId(categories[0]._id);
            if (materials.length > 0) setMaterialTypeId(materials[0]._id);
            setShowCreateModal(true);
          }}
          className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          Create Material Listing
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 flex flex-col">
        {activeTab === 'LISTINGS' ? (
          products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">
              You haven't listed any materials yet. Click the button above to list!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((p) => (
                <div key={p._id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
                  <div className="aspect-video bg-slate-100 relative overflow-hidden">
                    <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                    <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-sm ${
                      p.approvalStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      p.approvalStatus === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse' :
                      p.approvalStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {p.approvalStatus}
                    </span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                      {p.approvalStatus === 'REJECTED' && p.rejectionReason && (
                        <p className="text-xs text-rose-500 font-bold bg-rose-50 p-2 rounded-lg mt-2 border border-rose-100">
                          Rejection Reason: {p.rejectionReason}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                      <span>Price: <strong>{p.price} ETB</strong></span>
                      <span>Stock: <strong>{p.quantity}</strong></span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      {p.approvalStatus === 'DRAFT' && (
                        <button
                          onClick={() => handleSubmitForApproval(p._id)}
                          className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                        >
                          Submit for Approval
                        </button>
                      )}
                      {p.approvalStatus === 'REJECTED' && (
                        <button
                          onClick={() => handleSubmitForApproval(p._id)}
                          className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                        >
                          Resubmit Listing
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteProduct(p._id)}
                        className="p-2 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-400 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          payouts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">
              No payout transactions found. Payouts are spawned when buyers checkout items from your listings.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="p-4">Order</th>
                    <th className="p-4">Sale Amount</th>
                    <th className="p-4">Commission (10%)</th>
                    <th className="p-4">Payout Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payouts.map(p => (
                    <tr key={p._id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-bold text-slate-800">{p.order?.trackingNumber}</td>
                      <td className="p-4 font-semibold">{p.amount.toLocaleString()} ETB</td>
                      <td className="p-4 text-slate-400">{p.commissionAmount.toLocaleString()} ETB</td>
                      <td className="p-4 font-black text-slate-900">{p.payoutAmount.toLocaleString()} ETB</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                          p.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          p.status === 'ELIGIBLE' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          p.status === 'ON_HOLD' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-400">{p.transactionRef || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Create Listing Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Create Usable Material Listing</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            
            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Product / Material Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Copper Scrap wire, Wooden chairs"
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe material dimensions, usability state, weight or purity..."
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Unit Price (ETB)</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Quantity Available</label>
                  <input
                    type="number"
                    required
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Material Type</label>
                  <select
                    value={materialTypeId}
                    onChange={e => setMaterialTypeId(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {materials.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Material Condition</label>
                  <select
                    value={condition}
                    onChange={e => setCondition(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Sub-City Location (Adama)</label>
                  <input
                    type="text"
                    required
                    value={subCity}
                    onChange={e => setSubCity(e.target.value)}
                    placeholder="e.g. Bole, Kebele 02"
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
              </div>

              {/* Multiple Product Images */}
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Upload Product Images (Max 5)</label>
                <div className="flex flex-wrap gap-2.5 items-center">
                  <label className="w-16 h-16 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="sr-only"
                    />
                  </label>
                  
                  {uploadedImages.map((url, idx) => (
                    <div key={idx} className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 relative group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setUploadedImages(prev => prev.filter(u => u !== url))}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity rounded-xl"
                      >
                        <X className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  ))}
                  {uploading && <div className="text-[10px] text-slate-400 animate-pulse">Uploading files...</div>}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submittingProduct || uploading}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md shadow-primary-200/60 disabled:opacity-50 cursor-pointer"
                >
                  {submittingProduct ? 'Creating...' : 'Create Product Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerDashboard;
