'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import Link from 'next/link';
import {
  Wallet, Plus, ArrowRight, ArrowLeft, Sparkles,
  Shield, Cpu, ExternalLink, Copy, Check
} from 'lucide-react';
import { useWalletContext } from '@/context/wallet-context';
import { WalletCard } from '@/components/wallet/wallet-card';
import { CreateWalletModal } from '@/components/wallet/create-modal';

export default function WalletsPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { wallets, activeWallet, createWallet, selectWallet, deleteWallet, updateLabel } = useWalletContext();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

      {/* Glowing orbs */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2 text-white hover:text-emerald-400 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back</span>
        </Link>

        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg text-white">Aegis</span>
        </Link>

        {isConnected ? (
          <button
            onClick={() => disconnect()}
            className="text-sm text-zinc-500 hover:text-white transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <div className="w-20" />
        )}
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Your <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Wallets</span>
          </h1>
          <p className="text-zinc-500 text-lg max-w-xl mx-auto">
            Manage multiple trading identities. Each wallet gets its own Fiat and Crypto agents.
          </p>
        </motion.div>

        {/* Not connected state */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto"
          >
            <div className="rounded-3xl p-[1px] bg-gradient-to-br from-emerald-500/50 via-zinc-700/50 to-cyan-500/50">
              <div className="bg-zinc-900 rounded-3xl p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-6">
                  <Wallet className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h2>
                <p className="text-zinc-500 text-sm mb-6">
                  Connect MetaMask to create and manage your trading wallets
                </p>
                <button
                  onClick={() => connect({ connector: connectors[0] })}
                  className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <Wallet className="w-5 h-5" />
                  Connect MetaMask
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Connected state */}
        {isConnected && (
          <>
            {/* Parent wallet info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <img src="/metamask.svg" alt="MetaMask" className="w-6 h-6" onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }} />
                    <Wallet className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Parent Wallet</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-white">
                        {address?.slice(0, 10)}...{address?.slice(-8)}
                      </p>
                      <button
                        onClick={() => copyAddress(address!)}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                      >
                        {copiedAddress === address ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </div>
              </div>
            </motion.div>

            {/* Wallet grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <AnimatePresence mode="popLayout">
                {wallets.map((wallet, index) => (
                  <WalletCard
                    key={wallet.id}
                    wallet={wallet}
                    isActive={activeWallet?.id === wallet.id}
                    onSelect={() => selectWallet(wallet.id)}
                    onDelete={() => deleteWallet(wallet.id)}
                    onUpdateLabel={(label) => updateLabel(wallet.id, label)}
                    index={index}
                  />
                ))}
              </AnimatePresence>

              {/* Add wallet card */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: wallets.length * 0.08 + 0.1 }}
                onClick={() => setShowCreateModal(true)}
                className="group relative rounded-2xl p-[1px] bg-gradient-to-br from-zinc-700/30 via-zinc-800/30 to-zinc-700/30 hover:from-emerald-500/30 hover:via-cyan-500/20 hover:to-emerald-500/30 transition-all duration-500 min-h-[180px]"
              >
                <div className="h-full rounded-2xl bg-zinc-900/60 backdrop-blur-sm p-5 flex flex-col items-center justify-center gap-3 transition-all group-hover:bg-zinc-900/80">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-800 group-hover:bg-gradient-to-br group-hover:from-emerald-500/20 group-hover:to-cyan-500/20 flex items-center justify-center transition-all">
                    <Plus className="w-7 h-7 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-zinc-400 group-hover:text-white transition-colors">Add Wallet</p>
                    <p className="text-xs text-zinc-600 group-hover:text-zinc-500 transition-colors">Create new identity</p>
                  </div>
                </div>
              </motion.button>
            </div>

            {/* Empty state */}
            {wallets.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center py-8"
              >
                <Sparkles className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-500">Create your first wallet to start trading</p>
              </motion.div>
            )}

            {/* Continue button */}
            {wallets.length > 0 && activeWallet && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center"
              >
                <Link
                  href="/p2p"
                  className="group inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold py-4 px-8 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                >
                  <span>Continue to Trading</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            )}

            {/* Info cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16"
            >
              {[
                {
                  icon: Shield,
                  title: 'Secure Keys',
                  desc: 'Private keys stored locally in your browser',
                },
                {
                  icon: Cpu,
                  title: 'Agent Pairs',
                  desc: 'Each wallet gets its own trading agents',
                },
                {
                  icon: Sparkles,
                  title: 'Multiple Identities',
                  desc: 'Segregate trades across different wallets',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white text-sm">{item.title}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </>
        )}
      </main>

      <CreateWalletModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={async (label) => {
          await createWallet(label);
        }}
      />
    </div>
  );
}
