'use client';

// app/lp/rails/page.tsx
//
// LP Rail Registration and Management Page (G.12.1)

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Plus,
  Check,
  X,
  QrCode,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

type RailType = 'banksim' | 'upi' | 'venmo' | 'revolut';

interface RailRegistration {
  id: string;
  railType: RailType;
  receiverLabel: string;
  beneficiaryName: string;
  receiverCommitment: string;
  qrCommitment?: string;
  currency: string;
  minAmount: string;
  maxAmount: string;
  reversibilityClass: string;
  ownershipVerificationStatus: 'pending' | 'verified' | 'failed';
  createdAt: number;
}

const RAIL_INFO: Record<RailType, { name: string; icon: string; description: string }> = {
  banksim: {
    name: 'BankSim (Demo)',
    icon: '🏦',
    description: 'Demo rail for testing',
  },
  upi: {
    name: 'UPI',
    icon: '🇮🇳',
    description: 'Unified Payments Interface (India)',
  },
  venmo: {
    name: 'Venmo',
    icon: '💸',
    description: 'Venmo peer-to-peer payments',
  },
  revolut: {
    name: 'Revolut',
    icon: '🔄',
    description: 'Revolut transfers',
  },
};

export default function LpRailsPage() {
  const { address } = useAccount();
  const [rails, setRails] = useState<RailRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRail, setSelectedRail] = useState<RailType>('banksim');

  const [formData, setFormData] = useState({
    receiverLabel: '',
    beneficiaryName: '',
    account: '',
    vpa: '',
    handle: '',
    tag: '',
    qrPayload: '',
    currency: 'USD',
    minAmount: '1',
    maxAmount: '10000',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (address) {
      fetchRails();
    }
  }, [address]);

  async function fetchRails() {
    try {
      const res = await fetch(`/api/lp/rails?lpId=${address}`);
      const data = await res.json();
      setRails(data.rails || []);
    } catch (err) {
      console.error('Failed to fetch rails:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRail() {
    if (!address) return;
    setSubmitting(true);
    setError(null);

    try {
      const receiverPayload: Record<string, string> = {};

      switch (selectedRail) {
        case 'banksim':
          receiverPayload.account = formData.account;
          break;
        case 'upi':
          receiverPayload.vpa = formData.vpa;
          break;
        case 'venmo':
          receiverPayload.handle = formData.handle;
          break;
        case 'revolut':
          receiverPayload.tag = formData.tag;
          break;
      }

      const res = await fetch('/api/lp/rails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lpId: address,
          railType: selectedRail,
          receiverLabel: formData.receiverLabel,
          beneficiaryName: formData.beneficiaryName,
          receiverPayload,
          qrPayload: formData.qrPayload || undefined,
          currency: formData.currency,
          minAmount: formData.minAmount,
          maxAmount: formData.maxAmount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add rail');
      }

      setRails([...rails, data.registration]);
      setShowAddForm(false);
      setFormData({
        receiverLabel: '',
        beneficiaryName: '',
        account: '',
        vpa: '',
        handle: '',
        tag: '',
        qrPayload: '',
        currency: 'USD',
        minAmount: '1',
        maxAmount: '10000',
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteRail(id: string) {
    if (!confirm('Delete this rail registration?')) return;

    try {
      const res = await fetch(`/api/lp/rails?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRails(rails.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete rail:', err);
    }
  }

  async function handleVerifyRail(id: string) {
    try {
      const res = await fetch('/api/lp/rails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'verified' }),
      });

      if (res.ok) {
        setRails(
          rails.map((r) =>
            r.id === id ? { ...r, ownershipVerificationStatus: 'verified' as const } : r
          )
        );
      }
    } catch (err) {
      console.error('Failed to verify rail:', err);
    }
  }

  if (!address) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Connect your wallet to manage rails</p>
          <Link href="/lp/register" className="text-blue-400 hover:underline">
            Go to LP Registration
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Payment Rails</h1>
            <p className="text-zinc-400">Manage your fiat payment receiving methods</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Rail
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-zinc-900 rounded-lg" />
            ))}
          </div>
        ) : rails.length === 0 ? (
          <div className="text-center py-12 bg-zinc-900 rounded-lg border border-zinc-800">
            <CreditCard className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 mb-4">No payment rails registered</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="text-blue-400 hover:underline"
            >
              Add your first rail
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {rails.map((rail) => (
              <motion.div
                key={rail.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900 rounded-lg border border-zinc-800 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-2xl">
                      {RAIL_INFO[rail.railType]?.icon || '💳'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{rail.receiverLabel}</h3>
                        <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded">
                          {RAIL_INFO[rail.railType]?.name || rail.railType}
                        </span>
                        {rail.ownershipVerificationStatus === 'verified' ? (
                          <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Verified
                          </span>
                        ) : rail.ownershipVerificationStatus === 'pending' ? (
                          <span className="text-xs px-2 py-0.5 bg-yellow-900/50 text-yellow-400 rounded flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-red-900/50 text-red-400 rounded flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Failed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400">{rail.beneficiaryName}</p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                        <span>
                          {rail.currency} {rail.minAmount} - {rail.maxAmount}
                        </span>
                        <span>Commitment: {rail.receiverCommitment.slice(0, 10)}...</span>
                        {rail.qrCommitment && (
                          <span className="flex items-center gap-1">
                            <QrCode className="w-3 h-3" />
                            QR registered
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {rail.ownershipVerificationStatus === 'pending' && (
                      <button
                        onClick={() => handleVerifyRail(rail.id)}
                        className="p-2 text-green-400 hover:bg-zinc-800 rounded"
                        title="Mark as verified"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteRail(rail.id)}
                      className="p-2 text-red-400 hover:bg-zinc-800 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {showAddForm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add Payment Rail</h2>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-2 hover:bg-zinc-800 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Rail Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(RAIL_INFO) as RailType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedRail(type)}
                        className={`p-3 rounded-lg border text-left ${
                          selectedRail === type
                            ? 'border-blue-500 bg-blue-900/20'
                            : 'border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <span className="text-xl mr-2">{RAIL_INFO[type].icon}</span>
                        <span className="font-medium">{RAIL_INFO[type].name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Label</label>
                  <input
                    type="text"
                    value={formData.receiverLabel}
                    onChange={(e) => setFormData({ ...formData, receiverLabel: e.target.value })}
                    placeholder="e.g., Primary UPI"
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Beneficiary Name</label>
                  <input
                    type="text"
                    value={formData.beneficiaryName}
                    onChange={(e) => setFormData({ ...formData, beneficiaryName: e.target.value })}
                    placeholder="Your name"
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {selectedRail === 'banksim' && (
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Account ID</label>
                    <input
                      type="text"
                      value={formData.account}
                      onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                      placeholder="e.g., lp@banksim"
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {selectedRail === 'upi' && (
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">UPI VPA</label>
                    <input
                      type="text"
                      value={formData.vpa}
                      onChange={(e) => setFormData({ ...formData, vpa: e.target.value })}
                      placeholder="e.g., username@upi"
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {selectedRail === 'venmo' && (
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Venmo Handle</label>
                    <input
                      type="text"
                      value={formData.handle}
                      onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
                      placeholder="e.g., @username"
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {selectedRail === 'revolut' && (
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Revolut Tag</label>
                    <input
                      type="text"
                      value={formData.tag}
                      onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                      placeholder="e.g., @username"
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">QR Code Data (Optional)</label>
                  <textarea
                    value={formData.qrPayload}
                    onChange={(e) => setFormData({ ...formData, qrPayload: e.target.value })}
                    placeholder="Paste QR code string..."
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500 h-20"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="USD">USD</option>
                      <option value="INR">INR</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Min</label>
                    <input
                      type="text"
                      value={formData.minAmount}
                      onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Max</label>
                    <input
                      type="text"
                      value={formData.maxAmount}
                      onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddRail}
                    disabled={submitting || !formData.receiverLabel || !formData.beneficiaryName}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg"
                  >
                    {submitting ? 'Adding...' : 'Add Rail'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <Link href="/lp/dashboard" className="text-blue-400 hover:underline">
            Go to Dashboard →
          </Link>
        </div>
      </div>
    </main>
  );
}
