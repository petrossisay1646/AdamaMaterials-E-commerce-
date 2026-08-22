import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import LocationPickerModal from '../components/LocationPickerModal';
import { ShoppingBag, Store, MapPin, Building2, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

interface Category {
  _id: string;
  name: string;
}

const RoleSelectionPage: React.FC = () => {
  const { user, completeOnboarding } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState<'BUYER' | 'SELLER'>('BUYER');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [categories, setCategories] = useState<Category[]>([]);

  // Buyer Form State
  const [buyerStreetAddress, setBuyerStreetAddress] = useState('');
  const [buyerSubCity, setBuyerSubCity] = useState('');
  const [buyerLocation, setBuyerLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [isBuyerMapModalOpen, setIsBuyerMapModalOpen] = useState(false);

  // Seller Form State
  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [bankName, setBankName] = useState('Commercial Bank of Ethiopia (CBE)');
  const [bankAccountHolder, setBankAccountHolder] = useState(user?.name || '');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [shopLocation, setShopLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);

  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch categories for seller selection
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories');
        if (res.data.success) {
          setCategories(res.data.categories);
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    fetchCategories();
  }, []);

  const handleCategoryToggle = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      showToast('Please provide a mobile phone number for verification and contact.', 'error');
      return;
    }

    if (selectedRole === 'SELLER') {
      if (!shopName.trim() || !shopAddress.trim()) {
        showToast('Please provide your shop/business name and address.', 'error');
        return;
      }
      if (!bankAccountNumber.trim()) {
        showToast('Please provide your bank account number for escrow payouts.', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: any = {
        role: selectedRole,
        phoneNumber: phoneNumber.trim(),
      };

      if (selectedRole === 'SELLER') {
        payload.shopName = shopName.trim();
        payload.shopDescription = shopDescription.trim();
        payload.shopAddress = shopAddress.trim();
        payload.categoriesSold = selectedCategories;
        payload.bankName = bankName.trim();
        payload.bankAccountHolder = bankAccountHolder.trim();
        payload.bankAccountNumber = bankAccountNumber.trim();
        if (shopLocation) {
          payload.latitude = shopLocation.latitude;
          payload.longitude = shopLocation.longitude;
        }
      } else {
        payload.streetAddress = buyerStreetAddress.trim();
        payload.subCity = buyerSubCity.trim();
        payload.city = 'Adama';
        if (buyerLocation) {
          payload.latitude = buyerLocation.latitude;
          payload.longitude = buyerLocation.longitude;
        }
      }

      await completeOnboarding(payload);

      if (selectedRole === 'SELLER') {
        showToast('Seller profile submitted! Awaiting administrator approval.', 'info');
        navigate('/seller-dashboard');
      } else {
        showToast('Welcome to AdaMaterials Marketplace!', 'success');
        navigate('/products');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to complete profile onboarding.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white p-8 border-b border-slate-800">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Welcome, {user?.name || 'Friend'}!</h1>
              <p className="text-xs text-slate-400 font-medium">How would you like to participate in AdaMaterials?</p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Role Choice Cards */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Select Your Primary Role
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Buyer Card */}
              <div
                onClick={() => setSelectedRole('BUYER')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedRole === 'BUYER'
                    ? 'border-primary-600 bg-primary-50/50 shadow-md ring-2 ring-primary-600/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-primary-100 text-primary-700 rounded-xl">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  {selectedRole === 'BUYER' && <CheckCircle2 className="w-5 h-5 text-primary-600" />}
                </div>
                <h3 className="font-bold text-base text-slate-900">I want to Buy Materials</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Browse local salvaged construction materials, scrap metals, equipment, and order with door delivery in Adama.
                </p>
              </div>

              {/* Seller Card */}
              <div
                onClick={() => setSelectedRole('SELLER')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedRole === 'SELLER'
                    ? 'border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
                    <Store className="w-6 h-6" />
                  </div>
                  {selectedRole === 'SELLER' && <CheckCircle2 className="w-5 h-5 text-amber-600" />}
                </div>
                <h3 className="font-bold text-base text-slate-900">I want to Sell Materials</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Register your shop/depot in Adama, list reusable surplus or scrap materials, and receive direct bank payouts.
                </p>
              </div>
            </div>
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Mobile Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+251 9XX XXX XXX"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium text-slate-800"
            />
            <p className="text-[11px] text-slate-400 mt-1">Used for order status notifications, delivery courier contact, and payout alerts.</p>
          </div>

          {/* Buyer Essential Delivery Fields */}
          {selectedRole === 'BUYER' && (
            <div className="space-y-4 pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <MapPin className="w-5 h-5 text-primary-600" />
                <span>Primary Delivery Address (Adama City)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Street / Neighborhood / Landmark
                  </label>
                  <input
                    type="text"
                    value={buyerStreetAddress}
                    onChange={(e) => setBuyerStreetAddress(e.target.value)}
                    placeholder="e.g. Kebele 02, Near Post Office"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Subcity / Zone
                  </label>
                  <select
                    value={buyerSubCity}
                    onChange={(e) => setBuyerSubCity(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm text-slate-800 bg-white"
                  >
                    <option value="">Select Subcity</option>
                    <option value="Bole">Bole Subcity</option>
                    <option value="Aba Geda">Aba Geda Subcity</option>
                    <option value="Goro">Goro Subcity</option>
                    <option value="Boku">Boku Subcity</option>
                    <option value="Kebele 02">Kebele 02</option>
                    <option value="Kebele 03">Kebele 03</option>
                    <option value="Kebele 04">Kebele 04</option>
                    <option value="Industry Zone">Industry Zone</option>
                    <option value="Wonji Road">Wonji Road</option>
                  </select>
                </div>
              </div>

              {/* Delivery Pin on Map */}
              <div className="p-4 rounded-2xl bg-primary-50/70 border border-primary-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-primary-600 text-white rounded-lg">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Exact Delivery Pin on Map</h4>
                      <p className="text-[11px] text-slate-600">
                        {buyerLocation
                          ? `Location set: (${buyerLocation.latitude.toFixed(4)}, ${buyerLocation.longitude.toFixed(4)})`
                          : 'Optional now: Pin your exact delivery spot for courier logistics.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBuyerMapModalOpen(true)}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-primary-300 text-primary-800 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    {buyerLocation ? 'Change Pin' : 'Set Pin on Map'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Additional Seller Fields */}
          {selectedRole === 'SELLER' && (
            <div className="space-y-6 pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Building2 className="w-5 h-5 text-amber-600" />
                <span>Business & Shop Information</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Shop / Business Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="e.g. Adama Reclaimed Steel Depot"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Physical Shop Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={shopAddress}
                    onChange={(e) => setShopAddress(e.target.value)}
                    placeholder="e.g. Bole Subcity, Industry Zone, Adama"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Business Description</label>
                <textarea
                  rows={2}
                  value={shopDescription}
                  onChange={(e) => setShopDescription(e.target.value)}
                  placeholder="Describe the materials and scrap categories your shop specializes in..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm text-slate-800"
                />
              </div>

              {/* Categories Sold */}
              {categories.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">Material Categories Sold</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => {
                      const isSelected = selectedCategories.includes(c._id);
                      return (
                        <button
                          type="button"
                          key={c._id}
                          onClick={() => handleCategoryToggle(c._id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shop Location on Leaflet Map */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-500 text-white rounded-lg">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Shop Location on Leaflet Map</h4>
                      <p className="text-[11px] text-slate-600">
                        {shopLocation
                          ? `Location set: (${shopLocation.latitude.toFixed(4)}, ${shopLocation.longitude.toFixed(4)})`
                          : 'Optional now: Pin your exact depot location in Adama City.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapModalOpen(true)}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-amber-300 text-amber-800 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    {shopLocation ? 'Change Pin' : 'Set Shop Location'}
                  </button>
                </div>
              </div>

              {/* Private Banking Details */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Private Bank Details for Payouts</h4>
                    <p className="text-[11px] text-slate-400">
                      Private & Secure. Never displayed publicly to buyers. Used exclusively by platform finance staff for verified escrow payouts.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Bank Name</label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-medium focus:outline-none focus:border-amber-400"
                    >
                      <option>Commercial Bank of Ethiopia (CBE)</option>
                      <option>Awash Bank</option>
                      <option>Bank of Abyssinia</option>
                      <option>Dashen Bank</option>
                      <option>Cooperative Bank of Oromia</option>
                      <option>Nib International Bank</option>
                      <option>Zemen Bank</option>
                      <option>Telebirr Merchant</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      required
                      value={bankAccountHolder}
                      onChange={(e) => setBankAccountHolder(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-medium focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Account Number</label>
                    <input
                      type="text"
                      required
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="1000XXXXXXXXX"
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-medium focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <span>{submitting ? 'Setting up profile...' : 'Complete Profile & Get Started'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Seller Location Picker Modal */}
      <LocationPickerModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        onSelectLocation={(loc) => {
          setShopLocation({ latitude: loc.latitude, longitude: loc.longitude });
          showToast('Shop coordinates saved inside Adama service area!', 'success');
        }}
        title="Set Shop Pin Location"
        subtitle="Place the marker on your physical depot in Adama City"
      />

      {/* Buyer Location Picker Modal */}
      <LocationPickerModal
        isOpen={isBuyerMapModalOpen}
        onClose={() => setIsBuyerMapModalOpen(false)}
        onSelectLocation={(loc) => {
          setBuyerLocation({ latitude: loc.latitude, longitude: loc.longitude, address: loc.address });
          if (loc.address && !buyerStreetAddress) {
            setBuyerStreetAddress(loc.address);
          }
          showToast('Delivery pin coordinates saved inside Adama service area!', 'success');
        }}
        title="Set Delivery Pin Location"
        subtitle="Place the marker where couriers should deliver materials in Adama City"
      />
    </div>
  );
};

export default RoleSelectionPage;