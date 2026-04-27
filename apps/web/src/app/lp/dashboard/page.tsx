'use client';

// app/lp/dashboard/page.tsx
//
// LP Dashboard Page

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Settings,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface LpProfile {
  walletAddress: string;
  axlPubkey: string;
  registeredAt: number;
  active: boolean;
  reputation: {
    score: number;
    totalTrades: number;
    completionRate: number;
    averageSettleTimeSeconds: number;
    slashCount: number;
  };
}

interface RailRegistration {
  id: string;
  railType: string;
  receiverLabel: string;
  ownershipVerificationStatus: string;
}

export default function LpDashboardPage() {
  const { address } = useAccount();
  const [profile, setProfile] = useState<LpProfile | null>(null);
  const [rails, setRails] = useState<RailRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address) {
      fetchData();
    }
  }, [address]);

  async function fetchData() {
    try {
      const [profileRes, railsRes] = await Promise.all([
        fetch(`/api/lp/register?walletAddress=${address}`),
        fetch(`/api/lp/rails?lpId=${address}`),
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData.profile);
      }

      if (railsRes.ok) {
        const railsData = await railsRes.json();
        setRails(railsData.rails || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!address) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Connect your wallet to view dashboard</p>
          <Link href="/lp/register" className="text-blue-400 hover:underline">
            Register as LP
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-zinc-900 rounded w-1/4" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-zinc-900 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">You are not registered as an LP</p>
          <Link
            href="/lp/register"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Register Now
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    );
  }

  const verifiedRails = rails.filter((r) => r.ownershipVerificationStatus === 'verified').length;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">LP Dashboard</h1>
              <p className="text-zinc-400">
                {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            </div>
            <Link
              href="/lp/rails"
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Manage Rails
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-zinc-400 text-sm">Reputation</span>
              </div>
              <div className="text-2xl font-bold">{profile.reputation.score}</div>
            </div>

            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-blue-400" />
                <span className="text-zinc-400 text-sm">Total Trades</span>
              </div>
              <div className="text-2xl font-bold">{profile.reputation.totalTrades}</div>
            </div>

            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                <span className="text-zinc-400 text-sm">Avg Settle Time</span>
              </div>
              <div className="text-2xl font-bold">
                {profile.reputation.averageSettleTimeSeconds > 0
                  ? `${Math.round(profile.reputation.averageSettleTimeSeconds / 60)}m`
                  : '-'}
              </div>
            </div>

            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span className="text-zinc-400 text-sm">Slashes</span>
              </div>
              <div className="text-2xl font-bold">{profile.reputation.slashCount}</div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Payment Rails</h2>
              <Link href="/lp/rails" className="text-blue-400 hover:underline text-sm">
                View All
              </Link>
            </div>

            {rails.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 mb-3">No payment rails configured</p>
                <Link
                  href="/lp/rails"
                  className="text-blue-400 hover:underline"
                >
                  Add your first rail
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {rails.slice(0, 5).map((rail) => (
                  <div
                    key={rail.id}
                    className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium">{rail.receiverLabel}</div>
                        <div className="text-xs text-zinc-500">{rail.railType}</div>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        rail.ownershipVerificationStatus === 'verified'
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-yellow-900/50 text-yellow-400'
                      }`}
                    >
                      {rail.ownershipVerificationStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-6">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/p2p"
                className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-center"
              >
                <div className="font-medium">View Orders</div>
                <div className="text-sm text-zinc-400">Check pending orders</div>
              </Link>
              <Link
                href="/lp/rails"
                className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-center"
              >
                <div className="font-medium">Add Rail</div>
                <div className="text-sm text-zinc-400">Register new payment rail</div>
              </Link>
              <button
                onClick={() => {
                  // TODO: Deposit inventory
                }}
                className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-center"
              >
                <div className="font-medium">Deposit Crypto</div>
                <div className="text-sm text-zinc-400">Add to inventory</div>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
