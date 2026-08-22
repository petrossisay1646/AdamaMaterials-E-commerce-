import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import {
  MapPin,
  CreditCard,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  Navigation,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import api from '../services/api';
import LocationPickerModal from '../components/LocationPickerModal';

const CheckoutPage: React.FC = () => {
  const { user } = useAuth();
  const { items, subtotal, clearCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');

  // Address form fields
  const [streetAddress, setStreetAddress] = useState('');
  const [subCity, setSubCity] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);

  // GPS Delivery Location
  const [deliveryLat, setDeliveryLat] = useState<number>(8.5400);
  const [deliveryLng, setDeliveryLng] = useState<number>(39.2700);
  const [hasSelectedGps, setHasSelectedGps] = useState<boolean>(false);
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);

  // Payment method — Strictly CHAPA
  const paymentMethod = 'CHAPA';

  // Dynamic delivery fee calculation states
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null);
  const [feeBreakdown, setFeeBreakdown] = useState<any>(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // Load saved addresses and cart validation
  useEffect(() => {
    if (!user || user.role !== 'BUYER') {
      showToast('Only BUYER accounts can checkout and place orders.', 'warning');
      navigate(user?.role === 'SELLER' ? '/seller-dashboard' : '/products');
      return;
    }

    if (items.length === 0) {
      showToast('Your cart is empty.', 'warning');
      navigate('/products');
      return;
    }

    setLoading(true);
    api
      .get('/auth/me/addresses')
      .then((res) => {
        if (res.data.success) {
          const userAddresses = res.data.addresses || [];
          setAddresses(userAddresses);
          if (userAddresses.length > 0) {
            const def = userAddresses.find((a: any) => a.isDefault) || userAddresses[0];
            setSelectedAddressId(def._id);
            if (def.location?.coordinates && def.location.coordinates.length === 2) {
              setDeliveryLng(def.location.coordinates[0]);
              setDeliveryLat(def.location.coordinates[1]);
              setHasSelectedGps(true);
            }
          }
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [items, navigate, showToast]);

  // When saved address changes, update GPS coordinates if available
  useEffect(() => {
    if (selectedAddressId) {
      const addr = addresses.find((a) => a._id === selectedAddressId);
      if (addr?.location?.coordinates && addr.location.coordinates.length === 2) {
        setDeliveryLng(addr.location.coordinates[0]);
        setDeliveryLat(addr.location.coordinates[1]);
        setHasSelectedGps(true);
      }
    }
  }, [selectedAddressId, addresses]);

  // Fetch live estimated delivery fee based on address and quantity
  useEffect(() => {
    let currentAddress: any = null;
    if (selectedAddressId) {
      const addr = addresses.find((a) => a._id === selectedAddressId);
      if (addr) currentAddress = addr;
    } else if (streetAddress || subCity) {
      currentAddress = { streetAddress, subCity, city: 'Adama', latitude: deliveryLat, longitude: deliveryLng };
    }

    api
      .post('/orders/estimate-delivery-fee', {
        address: currentAddress,
        totalQuantity,
        date: new Date(),
      })
      .then((res) => {
        if (res.data.success) {
          setEstimatedFee(res.data.deliveryFee);
          setFeeBreakdown(res.data.breakdown);
        }
      })
      .catch((err) => console.error(err));
  }, [selectedAddressId, streetAddress, subCity, addresses, totalQuantity, deliveryLat, deliveryLng]);

  const handleLocationPicked = (loc: { latitude: number; longitude: number; address?: string }) => {
    setDeliveryLat(loc.latitude);
    setDeliveryLng(loc.longitude);
    setHasSelectedGps(true);
    setShowLocationPicker(false);
    showToast(`Delivery location pinned at (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`, 'success');
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!selectedAddressId && (!streetAddress || !subCity || !phoneNumber)) {
        showToast('Please select a saved address or fill in all address details.', 'warning');
        return;
      }
      setStep(2);
    }
  };

  const handlePrevStep = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handlePlaceOrder = async () => {
    setPlacingOrder(true);
    let finalAddress: any = null;

    try {
      if (selectedAddressId) {
        const addr = addresses.find((a) => a._id === selectedAddressId);
        if (addr) {
          finalAddress = {
            streetAddress: addr.streetAddress,
            subCity: addr.subCity,
            city: addr.city || 'Adama',
            phoneNumber: addr.phoneNumber,
            latitude: deliveryLat,
            longitude: deliveryLng,
          };
        }
      } else {
        finalAddress = {
          streetAddress,
          subCity,
          city: 'Adama',
          phoneNumber,
          latitude: deliveryLat,
          longitude: deliveryLng,
        };

        if (saveAddress) {
          await api.post('/auth/me/addresses', {
            title: 'Saved Address',
            streetAddress,
            subCity,
            city: 'Adama',
            phoneNumber,
            latitude: deliveryLat,
            longitude: deliveryLng,
            isDefault: addresses.length === 0,
          });
        }
      }

      // Submit order strictly with CHAPA paymentMethod
      const response = await api.post('/orders/checkout', {
        deliveryAddress: finalAddress,
        paymentMethod: 'CHAPA',
      });

      if (response.data.success) {
        const orderId = response.data.order?._id;
        await clearCart();

        showToast('Order created successfully! Redirecting to Chapa Gateway...', 'success');

        if (response.data.paymentUrl) {
          // Redirect to Chapa checkout
          window.location.href = response.data.paymentUrl;
        } else {
          // Fallback to tracking page or dashboard
          navigate(`/track-delivery/${orderId}`);
        }
      }
    } catch (error: any) {
      let msg = 'Checkout failed. Please try again.';
      const respData = error.response?.data;
      if (respData) {
        if (typeof respData.message === 'string' && respData.message.trim()) {
          msg = respData.message;
        } else if (respData.message && typeof respData.message === 'object') {
          msg = Object.entries(respData.message)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
            .join('; ');
        } else if (typeof respData.error === 'string') {
          msg = respData.error;
        }
      } else if (typeof error.message === 'string') {
        msg = error.message;
      }
      showToast(msg, 'error');
    } finally {
      setPlacingOrder(false);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 flex flex-col">
      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelectLocation={handleLocationPicked}
        initialLat={deliveryLat}
        initialLng={deliveryLng}
        title="Pin Delivery Location in Adama"
        subtitle="Move the pin to your exact delivery location inside the Adama service area."
      />

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-4 max-w-lg mx-auto w-full mb-10">
        <div className="flex items-center gap-2">
          <span
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shadow-md ${
              step >= 1 ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}
          >
            1
          </span>
          <span className={`text-sm font-semibold ${step >= 1 ? 'text-primary-900' : 'text-slate-400'}`}>
            Delivery Address & GPS
          </span>
        </div>
        <div className="h-0.5 bg-slate-200 flex-1"></div>
        <div className="flex items-center gap-2">
          <span
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shadow-md ${
              step >= 2 ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}
          >
            2
          </span>
          <span className={`text-sm font-semibold ${step >= 2 ? 'text-primary-900' : 'text-slate-400'}`}>
            Chapa Payment
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left wizard panel */}
        <div className="lg:col-span-8 bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-sm space-y-6">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-600" />
                  Delivery Address & Map Pin
                </h2>
                <button
                  type="button"
                  onClick={() => setShowLocationPicker(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  {hasSelectedGps ? 'Change GPS Pin' : 'Set GPS Pin on Map'}
                </button>
              </div>

              {/* GPS Pin Status Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  hasSelectedGps
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  {hasSelectedGps ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <Navigation className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">
                      {hasSelectedGps ? 'GPS Pin Configured:' : 'Default Adama Center GPS:'}
                    </span>{' '}
                    Lat: {deliveryLat.toFixed(5)}, Lng: {deliveryLng.toFixed(5)} (Adama Service Area)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLocationPicker(true)}
                  className="text-xs font-bold underline hover:opacity-80"
                >
                  Open Map
                </button>
              </div>

              {/* Saved Addresses List */}
              {addresses.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Your Saved Addresses
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {addresses.map((a) => (
                      <label
                        key={a._id}
                        className={`p-4 border-2 rounded-xl flex items-start gap-3 cursor-pointer transition-all ${
                          selectedAddressId === a._id
                            ? 'border-primary-500 bg-primary-50/20'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="savedAddress"
                          checked={selectedAddressId === a._id}
                          onChange={() => {
                            setSelectedAddressId(a._id);
                            setStreetAddress('');
                            setSubCity('');
                            setPhoneNumber('');
                          }}
                          className="mt-1 border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                        />
                        <div className="text-xs space-y-1">
                          <div className="font-bold text-slate-800">
                            {a.title}{' '}
                            {a.isDefault && (
                              <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium ml-1.5">
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500">
                            {a.streetAddress}, {a.subCity}
                          </div>
                          <div className="text-slate-400">Phone: {a.phoneNumber}</div>
                        </div>
                      </label>
                    ))}
                    <label
                      className={`p-4 border-2 rounded-xl flex items-center justify-center cursor-pointer transition-all border-dashed ${
                        !selectedAddressId
                          ? 'border-primary-500 bg-primary-50/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="savedAddress"
                        checked={!selectedAddressId}
                        onChange={() => setSelectedAddressId('')}
                        className="sr-only"
                      />
                      <span className="text-xs font-bold text-primary-600">+ Add New Address</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Add New Address Form */}
              {!selectedAddressId && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    New Delivery Address (Adama City)
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Sub-City / Kebele
                      </label>
                      <input
                        type="text"
                        value={subCity}
                        onChange={(e) => setSubCity(e.target.value)}
                        placeholder="e.g. Kebele 02, Bole Subcity"
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+251911223344"
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Street Address Details
                    </label>
                    <input
                      type="text"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="e.g. House 402, Block 12, near CBE Bank"
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Save this address for future purchases</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  onClick={handleNextStep}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-xl text-sm shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  Continue to Chapa Payment
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary-600" />
                Payment Gateway
              </h2>

              {/* Single Allowed Payment Provider — Chapa */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-500 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-lg shadow-sm">
                      CH
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        Chapa Payment Gateway
                      </h3>
                      <p className="text-xs text-slate-500">
                        Official Ethiopian Gateway (Cards, Telebirr & CBE)
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-extrabold border border-emerald-200">
                    TEST MODE
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-2 pt-3 border-t border-emerald-200">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>256-bit encrypted checkout verified server-side with Chapa.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Supports Visa, Mastercard, Telebirr, CBE Birr, and Amole.</span>
                  </div>
                </div>
              </div>

              {/* Delivery GPS confirmation */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Delivery Coordinates Confirmed
                </div>
                <div className="text-slate-500">
                  Lat: {deliveryLat.toFixed(5)}, Lng: {deliveryLng.toFixed(5)} (Adama Service Area)
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={handlePrevStep}
                  className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-3 px-6 rounded-xl text-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={placingOrder}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-8 rounded-xl text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {placingOrder ? 'Connecting to Chapa...' : 'Pay with Chapa (Test)'}
                  {!placingOrder && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right order summary */}
        <div className="lg:col-span-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
          <h3 className="font-bold text-slate-900 text-lg border-b border-slate-100 pb-3 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary-600" />
            Your Order
          </h3>

          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-2">
            {items.map((item) => (
              <div key={item.product._id} className="py-3 flex gap-3 text-xs">
                <div className="w-12 h-12 rounded-lg border border-slate-100 overflow-hidden bg-slate-50 flex-shrink-0">
                  <img src={item.product.images[0]} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 line-clamp-1">
                    {item.product.name}
                  </div>
                  <div className="text-slate-400 mt-0.5">
                    {item.quantity} x {item.product.price} ETB
                  </div>
                </div>
                <div className="font-bold text-slate-800 self-center">
                  {(item.quantity * item.product.price).toLocaleString()} ETB
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Items Subtotal</span>
              <span className="font-bold text-slate-700">{subtotal.toLocaleString()} ETB</span>
            </div>

            <div className="space-y-1 bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700">Calculated Delivery Fee</span>
                <span className="font-extrabold text-primary-900 text-sm">
                  {estimatedFee !== null ? `${estimatedFee.toLocaleString()} ETB` : '100 ETB'}
                </span>
              </div>

              {feeBreakdown && (
                <div className="text-[10px] text-slate-500 space-y-0.5 pt-1.5 border-t border-slate-200/60">
                  <div className="flex justify-between">
                    <span>Distance & Zone:</span>
                    <span className="font-semibold text-slate-700">{feeBreakdown.locationZone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Day Factor:</span>
                    <span className="font-semibold text-slate-700">
                      {feeBreakdown.dayLabel} ({feeBreakdown.dayName})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity ({feeBreakdown.totalQuantity} items):</span>
                    <span className="font-semibold text-slate-700">
                      {feeBreakdown.quantitySurcharge > 0
                        ? `+${feeBreakdown.quantitySurcharge} ETB bulk fee`
                        : 'Base Qty Included'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-between text-sm font-extrabold text-slate-950">
              <span>Total Amount Due</span>
              <span className="text-primary-900 text-base">
                {(subtotal + (estimatedFee !== null ? estimatedFee : 100)).toLocaleString()} ETB
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;