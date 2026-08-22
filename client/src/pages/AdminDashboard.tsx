import React, { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { Users, LayoutGrid, FileCheck, AlertOctagon, Landmark, ShieldCheck, Plus, Trash2, X, Eye, Truck, RotateCcw, MapPin, Building2, Store, Globe, Edit3, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

const AdminDashboard: React.FC = () => {
  const { showToast } = useToast();

  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'METRICS' | 'USERS' | 'PRODUCTS' | 'BANK_VERIFICATION' | 'DELIVERIES' | 'CONFIG' | 'DISPUTES' | 'AUDIT_LOGS' | 'MAP_PLACES'>('METRICS');

  const [bankPayments, setBankPayments] = useState<any[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [processingVerification, setProcessingVerification] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  // Map Places Management State
  const [mapPlaces, setMapPlaces] = useState<any[]>([]);
  const [showMapPlaceModal, setShowMapPlaceModal] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [placeCategory, setPlaceCategory] = useState('');
  const [placeMaterials, setPlaceMaterials] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placePhone, setPlacePhone] = useState('');
  const [placeLat, setPlaceLat] = useState('8.5400');
  const [placeLng, setPlaceLng] = useState('39.2700');
  const [placeDesc, setPlaceDesc] = useState('');
  const [placeVerified, setPlaceVerified] = useState(true);
  const [submittingPlace, setSubmittingPlace] = useState(false);
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);


  // Staff creation form
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffPerms, setStaffPerms] = useState<string[]>([]);
  const [submittingStaff, setSubmittingStaff] = useState(false);

  // Dispute resolution form
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [disputeDecision, setDisputeDecision] = useState('BUYER_REFUND');
  const [adminNotes, setAdminNotes] = useState('');
  const [resolvingDispute, setResolvingDispute] = useState(false);

  // Category & Material Creation
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [matName, setMatName] = useState('');
  const [matDesc, setMatDesc] = useState('');

  // Product rejection reason
  const [rejectionProductId, setRejectionProductId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const staffPermissionsList = [
    'VIEW_ORDERS',
    'VERIFY_PAYMENTS',
    'MANAGE_DELIVERIES',
    'SET_DELIVERY_FEES',
    'UPDATE_ORDER_STATUS',
    'VIEW_SELLER_PAYOUTS',
    'PROCESS_PAYOUTS',
    'VIEW_DISPUTES',
  ];

  const fetchDashboardStats = async () => {
    try {
      const res = await api.get('/admin/dashboard-stats');
      if (res.data.success) setStats(res.data.stats);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      if (res.data.success) setUsers(res.data.users || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminProducts = async () => {
    try {
      const res = await api.get('/admin/products');
      if (res.data.success) setAllProducts(res.data.products || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchConfigData = async () => {
    try {
      const catRes = await api.get('/categories');
      const matRes = await api.get('/material-types');
      if (catRes.data.success) setCategories(catRes.data.categories);
      if (matRes.data.success) setMaterials(matRes.data.materialTypes);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDisputes = async () => {
    try {
      const res = await api.get('/disputes');
      if (res.data.success) setDisputes(res.data.disputes || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/admin/audit-logs');
      if (res.data.success) setAuditLogs(res.data.logs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDeliveries = async () => {
    try {
      const res = await api.get('/deliveries');
      if (res.data.success) setDeliveries(res.data.deliveries || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateDeliveryStatus = async (deliveryId: string, status: string, note: string) => {
    try {
      const res = await api.put('/deliveries/status', { deliveryId, status, note });
      if (res.data.success) {
        showToast(`Delivery status updated to ${status}.`, 'success');
        fetchDeliveries();
        fetchDashboardStats();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update delivery status.', 'error');
    }
  };

  
  const fetchAdminMapPlaces = async () => {
    try {
      const res = await api.get('/admin/map-places');
      if (res.data.success) setMapPlaces(res.data.places || []);
    } catch (err) {
      console.error('Failed to load map places', err);
    }
  };

  const fetchBankPayments = async () => {
    try {
      const res = await api.get('/payments/pending');
      if (res.data.success) {
        setBankPayments(res.data.payments || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboardStats(),
      fetchUsers(),
      fetchAdminProducts(),
      fetchConfigData(),
      fetchDisputes(),
      fetchAuditLogs(),
      fetchDeliveries(),
      fetchBankPayments(),
      fetchAdminMapPlaces(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Auto-switch to Payment Verification tab when pending bank payments exist
  useEffect(() => {
    if (bankPayments.length > 0) {
      setActiveTab('BANK_VERIFICATION');
    }
  }, [bankPayments]);

  const handleVerifyPayment = async (paymentId: string, status: 'PAID' | 'FAILED') => {
    setProcessingVerification(true);
    try {
      const res = await api.post('/payments/verify-manual', {
        paymentId,
        status,
        notes: verificationNotes,
      });
      if (res.data.success) {
        showToast(`Payment status updated to ${status}.`, 'success');
        setVerificationNotes('');
        setSelectedPaymentId('');
        fetchBankPayments();
        fetchDashboardStats();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Verification failed.', 'error');
    } finally {
      setProcessingVerification(false);
    }
  };

  const handleResetAllStats = async () => {
    if (!window.confirm('Are you sure you want to reset all statistics and operational data? This will clear all orders, payments, payouts, and notifications for clean testing.')) return;
    try {
      const res = await api.post('/reset-stats');
      if (res.data.success) {
        showToast(res.data.message, 'success');
        loadAllData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to reset statistics.', 'error');
    }
  };

  const handleApproveSeller = async (sellerId: string) => {
    try {
      const res = await api.post('/admin/users/approve-seller', { sellerId });
      if (res.data.success) {
        showToast('Seller approved successfully.', 'success');
        fetchUsers();
        fetchDashboardStats();
      }
    } catch (err) {
      showToast('Failed to approve seller.', 'error');
    }
  };

  const handleToggleUserSuspension = async (userId: string, active: boolean) => {
    const endpoint = active ? '/admin/users/activate' : '/admin/users/suspend';
    try {
      const res = await api.post(endpoint, { userId });
      if (res.data.success) {
        showToast(`User account status updated.`, 'info');
        fetchUsers();
      }
    } catch (err) {
      showToast('Failed to update user suspension.', 'error');
    }
  };

  const handleProductReview = async (productId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await api.post('/admin/products/review', {
        productId,
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason : '',
      });

      if (res.data.success) {
        showToast(`Product ${status.toLowerCase()} successfully!`, 'success');
        setRejectionProductId('');
        setRejectionReason('');
        fetchAdminProducts();
        fetchDashboardStats();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to review product.', 'error');
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingStaff(true);
    try {
      const res = await api.post('/admin/users/staff', {
        name: staffName,
        email: staffEmail,
        password: staffPassword,
        permissions: staffPerms,
      });

      if (res.data.success) {
        showToast('Staff account created successfully!', 'success');
        setShowStaffModal(false);
        setStaffName('');
        setStaffEmail('');
        setStaffPassword('');
        setStaffPerms([]);
        fetchUsers();
        fetchDashboardStats();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create staff account.', 'error');
    } finally {
      setSubmittingStaff(false);
    }
  };

  const handleResolveDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setResolvingDispute(true);
    try {
      const res = await api.post('/disputes/resolve', {
        disputeId: selectedDispute._id,
        decision: disputeDecision,
        adminNotes,
      });

      if (res.data.success) {
        showToast('Dispute resolved successfully!', 'success');
        setSelectedDispute(null);
        setAdminNotes('');
        fetchDisputes();
        fetchDashboardStats();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to resolve dispute.', 'error');
    } finally {
      setResolvingDispute(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      await api.post('/admin/categories', { name: catName, description: catDesc });
      showToast('Category created.', 'success');
      setCatName('');
      setCatDesc('');
      fetchConfigData();
    } catch (err) {
      showToast('Failed to create category.', 'error');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Delete category?')) return;
    try {
      await api.delete(`/admin/categories/${id}`);
      showToast('Category deleted.', 'info');
      fetchConfigData();
    } catch (err) {
      showToast('Failed to delete category.', 'error');
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName.trim()) return;
    try {
      await api.post('/admin/material-types', { name: matName, description: matDesc });
      showToast('Material Type created.', 'success');
      setMatName('');
      setMatDesc('');
      fetchConfigData();
    } catch (err) {
      showToast('Failed to create material.', 'error');
    }
  };

  
  const handleOpenCreatePlace = () => {
    setEditingPlaceId(null);
    setPlaceName('');
    setPlaceCategory('Scrap Metals & Machinery');
    setPlaceMaterials('');
    setPlaceAddress('Kebele 01, Adama');
    setPlacePhone('+251221110000');
    setPlaceLat('8.5400');
    setPlaceLng('39.2700');
    setPlaceDesc('');
    setPlaceVerified(true);
    setShowMapPlaceModal(true);
  };

  const handleOpenEditPlace = (place: any) => {
    setEditingPlaceId(place._id);
    setPlaceName(place.name || '');
    setPlaceCategory(place.category || '');
    setPlaceMaterials(Array.isArray(place.materials) ? place.materials.join(', ') : '');
    setPlaceAddress(place.address || '');
    setPlacePhone(place.phone || '');
    setPlaceLat(place.location?.coordinates?.[1] ? String(place.location.coordinates[1]) : '8.5400');
    setPlaceLng(place.location?.coordinates?.[0] ? String(place.location.coordinates[0]) : '39.2700');
    setPlaceDesc(place.description || '');
    setPlaceVerified(place.isVerified !== undefined ? place.isVerified : true);
    setShowMapPlaceModal(true);
  };

  const handleSaveMapPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeName || !placeCategory || !placeAddress) {
      showToast('Please provide place name, category, and address.', 'error');
      return;
    }
    setSubmittingPlace(true);
    try {
      const payload = {
        name: placeName.trim(),
        category: placeCategory.trim(),
        materials: placeMaterials.split(',').map(m => m.trim()).filter(Boolean),
        address: placeAddress.trim(),
        phone: placePhone.trim(),
        latitude: parseFloat(placeLat),
        longitude: parseFloat(placeLng),
        description: placeDesc.trim(),
        isVerified: placeVerified,
      };

      if (editingPlaceId) {
        await api.put(`/admin/map-places/${editingPlaceId}`, payload);
        showToast('Map place updated successfully.', 'success');
      } else {
        await api.post('/admin/map-places', payload);
        showToast('New depot/place created successfully.', 'success');
      }

      setShowMapPlaceModal(false);
      setEditingPlaceId(null);
      fetchAdminMapPlaces();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save map place.', 'error');
    } finally {
      setSubmittingPlace(false);
    }
  };

  const handleTogglePlaceStatus = async (place: any) => {
    try {
      await api.put(`/admin/map-places/${place._id}`, { isActive: !place.isActive });
      showToast(`Place ${place.isActive ? 'deactivated' : 'activated'} successfully.`, 'success');
      fetchAdminMapPlaces();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update place status.', 'error');
    }
  };

  const handleDeleteMapPlace = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this map place?')) return;
    try {
      await api.delete(`/admin/map-places/${id}`);
      showToast('Map place deleted.', 'info');
      fetchAdminMapPlaces();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete map place.', 'error');
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!window.confirm('Delete material type?')) return;
    try {
      await api.delete(`/admin/material-types/${id}`);
      showToast('Material Type deleted.', 'info');
      fetchConfigData();
    } catch (err) {
      showToast('Failed to delete material.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Filter lists
  const pendingProductReviews = allProducts.filter(p => p.approvalStatus === 'PENDING_APPROVAL');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 flex flex-col gap-8">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Administration</h1>
          <p className="text-sm text-slate-500 mt-1">Platform management, approvals, configurations, and dispute arbitrations.</p>
        </div>
        <button
          onClick={handleResetAllStats}
          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Reset All Statistics for Testing
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3 flex-wrap">
        <button 
          onClick={() => setActiveTab('METRICS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'METRICS' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <LayoutGrid className="w-4 h-4" />
          Metrics
        </button>
        <button 
          onClick={() => setActiveTab('USERS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'USERS' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Users className="w-4 h-4" />
          Users Moderation
        </button>
        <button 
          onClick={() => setActiveTab('PRODUCTS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'PRODUCTS' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <FileCheck className="w-4 h-4" />
          Approvals Queue ({pendingProductReviews.length})
        </button>
        <button 
          onClick={() => setActiveTab('BANK_VERIFICATION')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'BANK_VERIFICATION' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Landmark className="w-4 h-4" />
          Payment Verifications
          {bankPayments.length > 0 ? (
            <span className="ml-1 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
              {bankPayments.length}
            </span>
          ) : (
            <span className="ml-1 text-slate-400">(0)</span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('DELIVERIES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'DELIVERIES' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Truck className="w-4 h-4" />
          Delivery Tracking ({deliveries.length})
        </button>
        <button 
          onClick={() => setActiveTab('DISPUTES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'DISPUTES' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <AlertOctagon className="w-4 h-4" />
          Disputes Arbiter ({disputes.filter(d => d.status === 'OPEN').length})
        </button>
        <button 
          onClick={() => setActiveTab('CONFIG')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'CONFIG' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Landmark className="w-4 h-4" />
          Configurations
        </button>
        <button 
          onClick={() => setActiveTab('AUDIT_LOGS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'AUDIT_LOGS' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <ShieldCheck className="w-4 h-4" />
          Audit Logs
        </button>
      </div>

      {/* Panels */}
      <div className="flex-1 flex flex-col">
        
        {/* PANEL 1: METRICS */}
        {activeTab === 'METRICS' && stats && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Revenue</span>
                <span className="text-xl font-black text-slate-900">{(stats.finance.revenue).toLocaleString()} ETB</span>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Delivery Fees</span>
                <span className="text-xl font-black text-slate-900">{(stats.finance.deliveryFees).toLocaleString()} ETB</span>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Seller Paid Payouts</span>
                <span className="text-xl font-black text-slate-900">{(stats.finance.payouts.PAID).toLocaleString()} ETB</span>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Active Disputes</span>
                <span className="text-xl font-black text-rose-600">{stats.disputes.pending} pending</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* User ratios */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">User Directory Statistics</h3>
                <div className="grid grid-cols-3 gap-4 text-center text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="font-extrabold text-slate-800 text-sm">{stats.users.buyers}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Buyers</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="font-extrabold text-slate-800 text-sm">{stats.users.sellers}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Sellers</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="font-extrabold text-slate-800 text-sm">{stats.users.staff}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Staff</span>
                  </div>
                </div>
              </div>
              {/* Product stats */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">Listing Inventory Overview</h3>
                <div className="grid grid-cols-2 gap-4 text-center text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="font-extrabold text-slate-800 text-sm">{stats.products.total}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Total Listings</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="font-extrabold text-slate-800 text-sm">{stats.products.pending}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Pending Approvals</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 2: USERS MODERATION */}
        {activeTab === 'USERS' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">Platform Users</h3>
              <button
                onClick={() => setShowStaffModal(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1 shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4.5 h-4.5" />
                Add Staff Account
              </button>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Seller Approval</th>
                    <th className="p-4">Active</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u._id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-bold text-slate-800">{u.name}</td>
                      <td className="p-4">{u.email}</td>
                      <td className="p-4 uppercase">{u.role}</td>
                      <td className="p-4">
                        {u.role === 'SELLER' ? (
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                            u.isSellerApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {u.isSellerApproved ? 'APPROVED' : 'PENDING'}
                          </span>
                        ) : 'N/A'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                          u.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {u.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-4 flex gap-2">
                        {u.role === 'SELLER' && !u.isSellerApproved && (
                          <button
                            onClick={() => handleApproveSeller(u._id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-lg text-[10px] cursor-pointer"
                          >
                            Approve Seller
                          </button>
                        )}
                        {u.role !== 'ADMIN' && (
                          <button
                            onClick={() => handleToggleUserSuspension(u._id, !u.isActive)}
                            className={`font-bold px-3 py-1 rounded-lg text-[10px] cursor-pointer ${
                              u.isActive ? 'border border-rose-200 hover:bg-rose-50 text-rose-600' : 'bg-primary-600 hover:bg-primary-700 text-white'
                            }`}
                          >
                            {u.isActive ? 'Suspend' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PANEL 3: APPROVALS QUEUE */}
        {activeTab === 'PRODUCTS' && (
          pendingProductReviews.length === 0 ? (
            <div className="bg-white border border-slate-200 p-16 text-center text-slate-400 rounded-2xl shadow-sm">
              All listed materials have been reviewed. Queue is empty!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingProductReviews.map(p => (
                <div key={p._id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="aspect-video w-full rounded-xl bg-slate-100 overflow-hidden relative">
                    <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                    <p className="text-slate-500 text-xs line-clamp-2">{p.description}</p>
                    <div className="text-[10px] text-slate-400 mt-2 font-bold uppercase">
                      Seller: {p.seller?.name || 'Seller'}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Unit Price:</span>
                      <span className="font-bold text-slate-800">{p.price} ETB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Purity/Condition:</span>
                      <span className="font-bold text-slate-800">{p.condition}</span>
                    </div>
                  </div>

                  {rejectionProductId === p._id ? (
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Rejection Reason</label>
                      <input
                        type="text"
                        value={rejectionReason}
                        onChange={e => setRejectionReason(e.target.value)}
                        placeholder="e.g. Inappropriate images, price mismatch"
                        className="w-full py-1.5 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-900"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleProductReview(p._id, 'REJECTED')}
                          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 rounded-lg text-xs cursor-pointer"
                        >
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => setRejectionProductId('')}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleProductReview(p._id, 'APPROVED')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                      >
                        Approve Product
                      </button>
                      <button
                        onClick={() => setRejectionProductId(p._id)}
                        className="flex-1 border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold py-2 rounded-xl text-xs cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* PANEL 3.5: BANK VERIFICATION QUEUE */}
        {activeTab === 'BANK_VERIFICATION' && (
          bankPayments.length === 0 ? (
            <div className="bg-white border border-slate-200 p-16 text-center text-slate-400 rounded-2xl shadow-sm">
              No manual payment receipts awaiting validation.
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
                        placeholder="e.g. CBE / Telebirr ledger confirmed"
                        value={selectedPaymentId === p._id ? verificationNotes : ''}
                        onChange={e => {
                          setSelectedPaymentId(p._id);
                          setVerificationNotes(e.target.value);
                        }}
                        className="w-full py-1.5 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedPaymentId(p._id);
                          handleVerifyPayment(p._id, 'PAID');
                        }}
                        disabled={processingVerification && selectedPaymentId === p._id}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1 text-xs shadow-sm"
                      >
                        Approve Payment (PAID)
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPaymentId(p._id);
                          handleVerifyPayment(p._id, 'FAILED');
                        }}
                        disabled={processingVerification && selectedPaymentId === p._id}
                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1 text-xs"
                      >
                        Reject (FAILED)
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
                <span className="font-bold text-slate-900 text-sm">Payment Receipt Full Inspection</span>
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

        {/* PANEL 4: DISPUTES */}
        {activeTab === 'DISPUTES' && (
          disputes.length === 0 ? (
            <div className="bg-white border border-slate-200 p-16 text-center text-slate-400 rounded-2xl shadow-sm">
              No disputes filed on the system. All transactions are clear!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {disputes.map(d => (
                <div key={d._id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Order Reference</span>
                      <h4 className="font-bold text-slate-900 text-sm">{d.order?.trackingNumber}</h4>
                      <p className="text-[9px] text-slate-400 mt-1">
                        Buyer: {d.buyer?.name} | Seller: {d.seller?.name}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                      d.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {d.status}
                    </span>
                  </div>

                  <div className="text-xs space-y-2">
                    <div>Reason: <strong className="text-slate-800">{d.reason}</strong></div>
                    <p className="text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-100">"{d.description}"</p>
                  </div>

                  {d.status === 'OPEN' && !selectedDispute && (
                    <button
                      onClick={() => {
                        setSelectedDispute(d);
                      }}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                    >
                      Arbitrate & Resolve Dispute
                    </button>
                  )}

                  {selectedDispute?._id === d._id && (
                    <form onSubmit={handleResolveDispute} className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                      <div>
                        <label className="block font-bold text-slate-600 mb-1">Resolution Outcome</label>
                        <select 
                          value={disputeDecision} 
                          onChange={e => setDisputeDecision(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs text-slate-800 focus:outline-none"
                        >
                          <option value="BUYER_REFUND">Buyer Refund (Cancels Seller Payout)</option>
                          <option value="SELLER_PAYOUT_RELEASED">Seller Payout Released (Confirms Order)</option>
                          <option value="NO_ACTION">No Action (Dismiss Dispute)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-600 mb-1">Resolution Details Note</label>
                        <input
                          type="text"
                          required
                          value={adminNotes}
                          onChange={e => setAdminNotes(e.target.value)}
                          placeholder="e.g. Inspected details, CBE transfer refunded"
                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs text-slate-900 focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={resolvingDispute}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Confirm Decision
                        </button>
                        <button
                          onClick={() => setSelectedDispute(null)}
                          className="px-3 py-2 border border-slate-200 rounded-xl text-slate-600 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* PANEL 5: CONFIGURATIONS */}
        {activeTab === 'CONFIG' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Categories */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">Categories</h3>
              <form onSubmit={handleAddCategory} className="flex gap-2 text-xs">
                <input
                  type="text"
                  required
                  placeholder="Category Name"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
                />
                <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center justify-center cursor-pointer"><Plus className="w-4 h-4" /></button>
              </form>
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-2 text-xs">
                {categories.map(c => (
                  <div key={c._id} className="py-2 flex justify-between items-center">
                    <span className="font-semibold text-slate-800">{c.name}</span>
                    <button onClick={() => handleDeleteCategory(c._id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Material Types */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">Material Types</h3>
              <form onSubmit={handleAddMaterial} className="flex gap-2 text-xs">
                <input
                  type="text"
                  required
                  placeholder="Material Name"
                  value={matName}
                  onChange={e => setMatName(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
                />
                <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center justify-center cursor-pointer"><Plus className="w-4 h-4" /></button>
              </form>
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-2 text-xs">
                {materials.map(m => (
                  <div key={m._id} className="py-2 flex justify-between items-center">
                    <span className="font-semibold text-slate-800">{m.name}</span>
                    <button onClick={() => handleDeleteMaterial(m._id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PANEL 6: AUDIT LOGS */}
        {activeTab === 'AUDIT_LOGS' && (
          auditLogs.length === 0 ? (
            <div className="bg-white border border-slate-200 p-16 text-center text-slate-400 rounded-2xl shadow-sm">
              No audit logs captured.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-4">User</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Target Type</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map(l => (
                    <tr key={l._id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-bold text-slate-800">
                        {l.user?.name} <span className="text-[9px] text-slate-400">({l.user?.role})</span>
                      </td>
                      <td className="p-4 font-semibold text-primary-700">{l.action}</td>
                      <td className="p-4 text-slate-500">{l.targetType}</td>
                      <td className="p-4 text-slate-400">{new Date(l.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* PANEL: DELIVERIES TRACKING SYSTEM */}
        {activeTab === 'DELIVERIES' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delivery Tracking System Management</h3>
              <p className="text-xs text-slate-500 mt-1">Admin control panel to view, track, and directly update delivery tracking statuses across all marketplace orders.</p>
            </div>

            {deliveries.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-500">No active delivery records found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Tracking #</th>
                      <th className="py-3 px-4">Destination</th>
                      <th className="py-3 px-4">Courier / Staff</th>
                      <th className="py-3 px-4">Delivery Fee</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Change Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deliveries.map((delivery) => (
                      <tr key={delivery._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {delivery.order?.trackingNumber || delivery.order?._id || delivery._id}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-xs">
                          {delivery.order?.deliveryAddress?.subCity || 'Adama'}, {delivery.order?.deliveryAddress?.streetAddress || ''}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-xs">
                          {delivery.assignedStaff ? delivery.assignedStaff.name : <span className="text-amber-500 font-semibold">Unassigned</span>}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 text-xs">
                          {delivery.fee || 0} ETB
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            delivery.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' :
                            delivery.status === 'OUT_FOR_DELIVERY' ? 'bg-blue-100 text-blue-700' :
                            delivery.status === 'PICKED_UP' ? 'bg-amber-100 text-amber-700' :
                            delivery.status === 'ASSIGNED' ? 'bg-purple-100 text-purple-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {delivery.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <select
                            value={delivery.status}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              const note = prompt(`Enter tracking note for status update to ${newStatus}:`, `Status updated to ${newStatus} by Admin`);
                              if (note !== null) {
                                handleUpdateDeliveryStatus(delivery._id, newStatus, note);
                              }
                            }}
                            className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold py-1.5 px-3 rounded-xl focus:outline-none cursor-pointer"
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="ASSIGNED">ASSIGNED</option>
                            <option value="PICKED_UP">PICKED_UP</option>
                            <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                            <option value="DELIVERED">DELIVERED</option>
                            <option value="FAILED">FAILED</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      
        {/* MAP PLACES MANAGEMENT TAB */}
        {activeTab === 'MAP_PLACES' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Header & Stats Banner */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-amber-600" />
                  Marketplace Locations & Material Depots
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Manage verified local material depots, salvage yards, and collection points within the Adama City service area.
                </p>
              </div>

              <button
                onClick={handleOpenCreatePlace}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add New Depot / Place
              </button>
            </div>

            {/* Places Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-700">All Configured Places ({mapPlaces.length})</span>
                <span className="text-[11px] text-slate-400">🟡 Verified Depot • ⚪ External Community</span>
              </div>

              {mapPlaces.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  No map places configured yet. Click "Add New Depot / Place" to create one.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Place Name & Type</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Materials</th>
                        <th className="py-3 px-4">Address</th>
                        <th className="py-3 px-4">Coordinates</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mapPlaces.map((place) => (
                        <tr key={place._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {place.source === 'ADMIN_MANAGED' ? (
                                <Building2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              ) : (
                                <Globe className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              )}
                              <span>{place.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{place.description}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">{place.category}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {(place.materials || []).slice(0, 3).map((m: string, idx: number) => (
                                <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                                  {m}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-[11px]">{place.address}</td>
                          <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                            {place.location?.coordinates ? `${place.location.coordinates[1].toFixed(4)}, ${place.location.coordinates[0].toFixed(4)}` : 'N/A'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              place.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {place.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditPlace(place)}
                                className="p-1.5 text-slate-600 hover:text-primary-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                title="Edit Place"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleTogglePlaceStatus(place)}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                                  place.isActive ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                              >
                                {place.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteMapPlace(place._id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                title="Delete Place"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}


      {/* Create / Edit Map Place Modal */}
      {showMapPlaceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-600" />
                <span>{editingPlaceId ? 'Edit Depot / Place' : 'Add New Admin-Managed Depot'}</span>
              </h3>
              <button onClick={() => setShowMapPlaceModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleSaveMapPlace} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Place / Depot Name</label>
                <input
                  type="text"
                  required
                  value={placeName}
                  onChange={e => setPlaceName(e.target.value)}
                  placeholder="e.g. Adama East Rebar & Steel Depot"
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={placeCategory}
                    onChange={e => setPlaceCategory(e.target.value)}
                    placeholder="e.g. Scrap Metals"
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={placePhone}
                    onChange={e => setPlacePhone(e.target.value)}
                    placeholder="+251221110000"
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Materials Available (comma-separated)</label>
                <input
                  type="text"
                  value={placeMaterials}
                  onChange={e => setPlaceMaterials(e.target.value)}
                  placeholder="Structural Steel, Angle Iron, Pipes, Roofing"
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Street Address (Adama)</label>
                <input
                  type="text"
                  required
                  value={placeAddress}
                  onChange={e => setPlaceAddress(e.target.value)}
                  placeholder="Kebele 03, Ring Road Corridor, Adama"
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Latitude (Adama: ~8.54xx)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={placeLat}
                    onChange={e => setPlaceLat(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Longitude (Adama: ~39.27xx)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={placeLng}
                    onChange={e => setPlaceLng(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={placeDesc}
                  onChange={e => setPlaceDesc(e.target.value)}
                  placeholder="Short summary of materials accepted and services offered."
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="verifiedCheckbox"
                  checked={placeVerified}
                  onChange={e => setPlaceVerified(e.target.checked)}
                  className="rounded text-primary-600 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="verifiedCheckbox" className="font-bold text-slate-700 cursor-pointer">
                  Mark as Verified Depot
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMapPlaceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPlace}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submittingPlace ? 'Saving...' : editingPlaceId ? 'Update Place' : 'Create Depot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Account Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Provision Staff Account</h3>
              <button onClick={() => setShowStaffModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            
            <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={e => setStaffName(e.target.value)}
                  placeholder="e.g. Selam Abebe"
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={e => setStaffEmail(e.target.value)}
                  placeholder="staff@marketplace.com"
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={staffPassword}
                  onChange={e => setStaffPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-2">Permissions</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-slate-100 p-2.5 rounded-xl bg-slate-50">
                  {staffPermissionsList.map(perm => (
                    <label key={perm} className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffPerms.includes(perm)}
                        onChange={() => {
                          if (staffPerms.includes(perm)) {
                            setStaffPerms(prev => prev.filter(p => p !== perm));
                          } else {
                            setStaffPerms(prev => [...prev, perm]);
                          }
                        }}
                        className="rounded border-slate-300 text-primary-600 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>{perm.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submittingStaff}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submittingStaff ? 'Creating account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
