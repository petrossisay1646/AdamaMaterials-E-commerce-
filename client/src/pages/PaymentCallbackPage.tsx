import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowRight, Package, RefreshCw, ShoppingBag } from 'lucide-react';

const PaymentCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const txRef = searchParams.get('tx_ref') || searchParams.get('trx_ref') || '';
  const provider = searchParams.get('provider') || 'chapa';
  const rawStatus = searchParams.get('status') || '';

  const [loading, setLoading] = useState(true);
  const [verificationResult, setVerificationResult] = useState<{
    status: 'PAID' | 'FAILED' | 'CANCELLED' | 'ERROR';
    message: string;
    order?: any;
  }>({
    status: 'FAILED',
    message: 'Initializing payment verification...',
  });

  useEffect(() => {
    if (!txRef) {
      setLoading(false);
      setVerificationResult({
        status: 'ERROR',
        message: 'No transaction reference found in callback URL.',
      });
      return;
    }

    const verifyTransaction = async () => {
      try {
        setLoading(true);
        // Server-to-server verification with Chapa API
        const response = await api.get('/payments/verify-online', {
          params: {
            transactionId: txRef,
            provider,
          },
        });

        if (response.data?.success && response.data?.status === 'PAID') {
          setVerificationResult({
            status: 'PAID',
            message: 'Payment confirmed by Chapa Gateway! Your order has been placed.',
            order: response.data.order,
          });
        } else {
          setVerificationResult({
            status: 'FAILED',
            message: response.data?.message || 'Chapa reported this transaction as incomplete or failed.',
            order: response.data?.order,
          });
        }
      } catch (err: any) {
        console.error('Payment verification error:', err);
        const errMsg = err.response?.data?.message || 'Could not verify transaction with Chapa servers.';
        setVerificationResult({
          status: 'FAILED',
          message: errMsg,
        });
      } finally {
        setLoading(false);
      }
    };

    verifyTransaction();
  }, [txRef, provider]);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center">
        {loading ? (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="p-4 bg-primary-50 rounded-2xl text-primary-600 animate-pulse">
              <Loader2 className="w-12 h-12 animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Verifying Chapa Payment...</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Communicating with Chapa gateway to confirm your payment receipt. Please do not close this window.
              </p>
            </div>
          </div>
        ) : verificationResult.status === 'PAID' ? (
          <div className="space-y-6">
            <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-100">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 mb-2">
                ✓ Chapa Test Payment Confirmed
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payment Successful!</h1>
              <p className="text-xs text-slate-500 mt-1">
                Your order has been verified and sent to sellers for preparation.
              </p>
            </div>

            {verificationResult.order && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Tracking Number:</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {verificationResult.order.trackingNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Amount Paid:</span>
                  <span className="font-black text-slate-900">
                    {(verificationResult.order.total || 0).toLocaleString()} ETB
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Payment Gateway:</span>
                  <span className="font-semibold text-slate-700">Chapa (Test Mode)</span>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">
              {verificationResult.order?._id && (
                <Link
                  to={`/track-delivery/${verificationResult.order._id}`}
                  className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary-200/60 transition-all flex items-center justify-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  <span>Track Delivery Status</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}

              <Link
                to="/buyer-dashboard"
                className="w-full py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-2"
              >
                <span>Go to Buyer Dashboard</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="mx-auto w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center shadow-lg shadow-rose-100">
              <XCircle className="w-10 h-10" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-full border border-rose-200 mb-2">
                Payment Incomplete
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payment Not Completed</h1>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {verificationResult.message || 'The Chapa payment was not completed or was cancelled.'}
              </p>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-left flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <strong className="block font-bold mb-0.5">Order Status: Unpaid</strong>
                Your order remains in pending status until payment is confirmed by Chapa. You can retry checkout at any time.
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                to="/cart"
                className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary-200/60 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Return to Cart & Retry</span>
              </Link>

              <Link
                to="/products"
                className="w-full py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Browse Products Catalog</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentCallbackPage;
