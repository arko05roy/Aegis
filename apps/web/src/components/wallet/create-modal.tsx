'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Sparkles, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface CreateWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (label: string) => Promise<void>;
}

export function CreateWalletModal({ isOpen, onClose, onCreate }: CreateWalletModalProps) {
  const [label, setLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await onCreate(label || `Wallet ${Date.now().toString().slice(-4)}`);
      setLabel('');
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-emerald-500/50 via-cyan-500/30 to-emerald-500/50">
              <div className="relative bg-zinc-900 rounded-3xl p-6 overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Create Wallet</h2>
                    <p className="text-sm text-zinc-500">Generate a new agent wallet</p>
                  </div>
                </div>

                {/* Form */}
                <div className="space-y-4 relative z-10">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                      Wallet Label
                    </label>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="e.g., Trading, Savings, DeFi..."
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>

                  <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-800">
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      A new wallet will be generated with its own private key.
                      Each wallet can have its own Fiat and Crypto agents for trading.
                    </p>
                  </div>

                  <button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Create Wallet
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
