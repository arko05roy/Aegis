'use client';

import { motion } from 'framer-motion';
import { Check, Trash2, Edit3, Cpu, Wallet } from 'lucide-react';
import { useState } from 'react';
import type { DerivedWallet } from '@/context/wallet-context';

interface WalletCardProps {
  wallet: DerivedWallet;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdateLabel: (label: string) => void;
  index: number;
}

export function WalletCard({
  wallet,
  isActive,
  onSelect,
  onDelete,
  onUpdateLabel,
  index,
}: WalletCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(wallet.label);

  const handleSaveLabel = () => {
    if (editLabel.trim()) {
      onUpdateLabel(editLabel.trim());
    }
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      onClick={onSelect}
      className={`
        group relative cursor-pointer rounded-2xl p-[1px] transition-all duration-300
        ${isActive
          ? 'bg-gradient-to-br from-emerald-400 via-cyan-500 to-emerald-600'
          : 'bg-gradient-to-br from-zinc-700/50 via-zinc-800/50 to-zinc-700/50 hover:from-zinc-600/60 hover:via-zinc-700/60 hover:to-zinc-600/60'
        }
      `}
    >
      <div className={`
        relative h-full rounded-2xl backdrop-blur-xl p-5
        ${isActive
          ? 'bg-zinc-900/90'
          : 'bg-zinc-900/80'
        }
      `}>
        {/* Glowing orb effect for active card */}
        {isActive && (
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        )}

        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`
              relative w-10 h-10 rounded-xl flex items-center justify-center
              ${isActive
                ? 'bg-gradient-to-br from-emerald-500 to-cyan-500'
                : 'bg-zinc-800 group-hover:bg-zinc-700'
              }
              transition-all duration-300
            `}>
              <Wallet className={`w-5 h-5 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center"
                >
                  <Check className="w-2.5 h-2.5 text-zinc-900" strokeWidth={3} />
                </motion.div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onBlur={handleSaveLabel}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveLabel()}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-1 text-sm w-full focus:outline-none focus:border-emerald-500"
                />
              ) : (
                <h3 className="font-semibold text-white truncate">{wallet.label}</h3>
              )}
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Agent status */}
        <div className={`
          flex items-center gap-2 px-3 py-2 rounded-xl
          ${wallet.hasAgents
            ? 'bg-emerald-500/10 border border-emerald-500/20'
            : 'bg-zinc-800/50 border border-zinc-700/50'
          }
        `}>
          <Cpu className={`w-4 h-4 ${wallet.hasAgents ? 'text-emerald-400' : 'text-zinc-500'}`} />
          <span className={`text-xs font-medium ${wallet.hasAgents ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {wallet.hasAgents ? '2 Agents Active' : 'No Agents'}
          </span>
          {wallet.hasAgents && (
            <div className="ml-auto flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
            </div>
          )}
        </div>

        {/* Created date */}
        <p className="text-[10px] text-zinc-600 mt-3 text-right">
          Created {new Date(wallet.createdAt).toLocaleDateString()}
        </p>
      </div>
    </motion.div>
  );
}
