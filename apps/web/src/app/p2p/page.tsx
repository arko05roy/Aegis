'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, keccak256, toBytes } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, Loader2, ArrowRight, Wallet, Zap, ExternalLink,
  ChevronDown, Banknote, Coins, ArrowDownUp, Shield, Clock, Activity,
  Sparkles, Radio, CircleDot, TrendingUp, Star, Eye, Plus
} from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { ProofTimeline } from '../../components/ui/proof-timeline';
import { ProofPhase } from '../../types/lp';
import { WalletSwitcher } from '@/components/wallet/switcher';
import { useWalletContext } from '@/context/wallet-context';
import { CreateWalletModal } from '@/components/wallet/create-modal';

type OrderState = 'INIT' | 'CONNECTING_AGENTS' | 'BROADCASTING' | 'QUOTING' | 'SELECTING' | 'COMMITTING' | 'LOCKED' | 'PAYING' | 'RELEASED' | 'ERROR';

interface Quote {
  quoteId: string;
  lpAgent: string;
  rate: string;
  outputAmount: string;
  fee: string;
  rails: string[];
  reputation: number;
}

interface FiatDetails {
  railType: string;
  paymentId: string;
  reference: string;
  qrPayload?: string;
}

interface AppState {
  state: OrderState;
  rfqId?: string;
  quotes: Quote[];
  selectedQuote?: Quote;
  lockTx?: `0x${string}`;
  releaseTx?: string;
  evidenceRootHash?: string;
  error?: string;
  fiatDetails?: FiatDetails;
}

interface AxlEvent {
  ts: number;
  dir: 'send' | 'recv' | 'info';
  type: string;
}

interface AgentAttestation {
  codeHash: string;
  chatId: string;
  verified: boolean;
  attestedAt: number;
}

interface AgentDecisions {
  fiat: { agentName: string; attestation: AgentAttestation | null; decisions: any[]; memoryHash: string | null };
  crypto: { agentName: string; attestation: AgentAttestation | null; decisions: any[]; memoryHash: string | null };
}

interface AgentStatus {
  fiatPubkey: string;
  cryptoPubkey: string;
  decisions?: AgentDecisions;
}

// V2 contracts with G.14 fields (deployed 2026-04-27)
const ESCROW_ADDRESS = '0xeAD29cBfAb93ed51808D65954Dd1b3cDDaDA1348' as const;
const TOKEN_ADDRESS = '0x5F2577675beD125794FDfc44940b62D60BF00F81' as const;

const ESCROW_ABI = [
  {
    name: 'lock',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'buyer', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'fiatAmount', type: 'uint256' },
      { name: 'fiatCurrency', type: 'string' },
      { name: 'railType', type: 'string' },
      { name: 'deadlineSeconds', type: 'uint256' },
      { name: 'orderRefId', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'lockWithCommitments',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'buyer', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'fiatAmount', type: 'uint256' },
      { name: 'fiatCurrency', type: 'string' },
      { name: 'railType', type: 'string' },
      { name: 'deadlineSeconds', type: 'uint256' },
      { name: 'orderRefId', type: 'string' },
      { name: 'receiverCommitment', type: 'bytes32' },
      { name: 'referenceHash', type: 'bytes32' },
      { name: 'challengeWindow', type: 'uint256' },
      { name: 'attestationMode', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

const FIAT_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
];

const CRYPTO_CURRENCIES = [
  { code: 'ETH', name: 'Ethereum', icon: '⟠' },
  { code: 'USDC', name: 'USD Coin', icon: '◎' },
];

const RAILS = [
  { id: 'banksim', name: 'Bank', desc: 'Bank to bank transfer' },
  { id: 'venmo', name: 'Venmo', desc: 'US P2P' },
];

function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <button onClick={() => disconnect()} className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-700/50 px-4 py-2 rounded-full border border-zinc-700/50 transition-all">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-full font-medium transition-all"
    >
      <Wallet className="w-4 h-4" />
      Connect Wallet
    </button>
  );
}

function AgentStatusBadge({ agentStatus }: { agentStatus: AgentStatus | null }) {
  if (!agentStatus) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <div className="w-2 h-2 rounded-full bg-zinc-600" />
        <span>No agents</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-emerald-400">
      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span>2 Agents Online</span>
    </div>
  );
}

function SwapForm({
  intent,
  setIntent,
  onSubmit,
  disabled,
  agentStatus
}: {
  intent: { amount: string; fromCcy: string; toCcy: string; rail: string };
  setIntent: (i: any) => void;
  onSubmit: () => void;
  disabled: boolean;
  agentStatus: AgentStatus | null;
}) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  const selectedFiat = FIAT_CURRENCIES.find(c => c.code === intent.fromCcy) || FIAT_CURRENCIES[0];
  const selectedCrypto = CRYPTO_CURRENCIES.find(c => c.code === intent.toCcy) || CRYPTO_CURRENCIES[0];
  const selectedRail = RAILS.find(r => r.id === intent.rail) || RAILS[0];

  return (
    <div className="relative">
      {/* Card glow effect */}
      <div className="absolute -inset-px bg-gradient-to-b from-emerald-500/20 via-transparent to-transparent rounded-2xl blur-sm" />

      <div className="relative bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-800/80 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
              <ArrowDownUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">Swap</h2>
              <p className="text-xs text-zinc-500">Fiat to Crypto</p>
            </div>
          </div>
          <AgentStatusBadge agentStatus={agentStatus} />
        </div>

        <div className="p-6 space-y-4">
          {/* From (Fiat) */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">You Pay</label>
            <div className="relative bg-zinc-800/50 rounded-xl border border-zinc-700/50 focus-within:border-emerald-500/50 transition-colors">
              <input
                type="number"
                value={intent.amount}
                onChange={(e) => setIntent({ ...intent, amount: e.target.value })}
                className="w-full bg-transparent px-4 py-4 text-2xl font-light text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0.00"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button
                  onClick={() => setFromOpen(!fromOpen)}
                  className="flex items-center gap-2 bg-zinc-700/50 hover:bg-zinc-700 px-3 py-2 rounded-lg transition-colors"
                >
                  <span className="text-lg">{selectedFiat.flag}</span>
                  <span className="text-sm font-medium">{selectedFiat.code}</span>
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                </button>

                <AnimatePresence>
                  {fromOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 rounded-xl border border-zinc-700 shadow-2xl z-50 overflow-hidden"
                    >
                      {FIAT_CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => { setIntent({ ...intent, fromCcy: c.code }); setFromOpen(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700/50 transition-colors ${intent.fromCcy === c.code ? 'bg-emerald-500/10 text-emerald-400' : 'text-white'}`}
                        >
                          <span className="text-lg">{c.flag}</span>
                          <div className="text-left">
                            <div className="text-sm font-medium">{c.code}</div>
                            <div className="text-xs text-zinc-500">{c.name}</div>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Swap arrow */}
          <div className="flex justify-center -my-1">
            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <ArrowDownUp className="w-4 h-4 text-zinc-400" />
            </div>
          </div>

          {/* To (Crypto) */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">You Receive</label>
            <div className="relative bg-zinc-800/50 rounded-xl border border-zinc-700/50">
              <div className="px-4 py-4 text-2xl font-light text-zinc-500">
                ≈ quotes pending
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button
                  onClick={() => setToOpen(!toOpen)}
                  className="flex items-center gap-2 bg-zinc-700/50 hover:bg-zinc-700 px-3 py-2 rounded-lg transition-colors"
                >
                  <span className="text-lg">{selectedCrypto.icon}</span>
                  <span className="text-sm font-medium">{selectedCrypto.code}</span>
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                </button>

                <AnimatePresence>
                  {toOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 rounded-xl border border-zinc-700 shadow-2xl z-50 overflow-hidden"
                    >
                      {CRYPTO_CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => { setIntent({ ...intent, toCcy: c.code }); setToOpen(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700/50 transition-colors ${intent.toCcy === c.code ? 'bg-emerald-500/10 text-emerald-400' : 'text-white'}`}
                        >
                          <span className="text-lg">{c.icon}</span>
                          <div className="text-left">
                            <div className="text-sm font-medium">{c.code}</div>
                            <div className="text-xs text-zinc-500">{c.name}</div>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Payment Rail */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">Payment Rail</label>
            <div className="relative">
              <button
                onClick={() => setRailOpen(!railOpen)}
                className="w-full flex items-center justify-between bg-zinc-800/50 rounded-xl border border-zinc-700/50 px-4 py-3 hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">{selectedRail.name}</div>
                    <div className="text-xs text-zinc-500">{selectedRail.desc}</div>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${railOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {railOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-0 right-0 top-full mt-2 bg-zinc-800 rounded-xl border border-zinc-700 shadow-2xl z-50 overflow-hidden"
                  >
                    {RAILS.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setIntent({ ...intent, rail: r.id }); setRailOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700/50 transition-colors ${intent.rail === r.id ? 'bg-emerald-500/10' : ''}`}
                      >
                        <Radio className={`w-4 h-4 ${intent.rail === r.id ? 'text-emerald-400' : 'text-zinc-500'}`} />
                        <div className="text-left">
                          <div className={`text-sm font-medium ${intent.rail === r.id ? 'text-emerald-400' : 'text-white'}`}>{r.name}</div>
                          <div className="text-xs text-zinc-500">{r.desc}</div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Submit */}
          <motion.button
            onClick={onSubmit}
            disabled={disabled || !agentStatus || !intent.amount}
            className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white font-medium py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            whileHover={{ scale: disabled ? 1 : 1.01 }}
            whileTap={{ scale: disabled ? 1 : 0.99 }}
          >
            {!agentStatus ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Spawning Agents...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Get Quotes
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function QuoteCard({ quote, index, intent, onSelect, selected }: {
  quote: Quote;
  index: number;
  intent: { fromCcy: string; toCcy: string };
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <motion.button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        selected
          ? 'bg-emerald-500/10 border-emerald-500/50'
          : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.01 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-light text-emerald-400">{quote.outputAmount}</span>
            <span className="text-sm text-zinc-400">{intent.toCcy}</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Rate: {quote.rate} {intent.toCcy}/{intent.fromCcy}
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-zinc-700/50 rounded-lg">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-xs font-medium">{quote.reputation}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-zinc-500">
          <span>Fee: {quote.fee}</span>
          <span>•</span>
          <span className="font-mono">{quote.lpAgent.slice(0, 10)}...</span>
        </div>
        <ArrowRight className={`w-4 h-4 transition-colors ${selected ? 'text-emerald-400' : 'text-zinc-600'}`} />
      </div>
    </motion.button>
  );
}

function OrderProgress({ state, intent, selectedQuote }: {
  state: OrderState;
  intent: { amount: string; fromCcy: string; toCcy: string };
  selectedQuote?: Quote;
}) {
  const steps = [
    { id: 'INIT', label: 'Ready', icon: CircleDot },
    { id: 'BROADCASTING', label: 'Broadcasting', icon: Radio, includes: ['BROADCASTING', 'QUOTING'] },
    { id: 'SELECTING', label: 'Quotes', icon: TrendingUp, includes: ['SELECTING'] },
    { id: 'COMMITTING', label: 'Locking', icon: Shield, includes: ['COMMITTING'] },
    { id: 'LOCKED', label: 'Locked', icon: Clock, includes: ['LOCKED'] },
    { id: 'PAYING', label: 'Paying', icon: Banknote, includes: ['PAYING'] },
    { id: 'RELEASED', label: 'Complete', icon: CheckCircle2 },
  ];

  const getCurrentStepIndex = () => {
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      if (step.id === state || step.includes?.includes(state)) return i;
    }
    return 0;
  };

  const currentIdx = getCurrentStepIndex();

  return (
    <div className="bg-zinc-900/50 backdrop-blur rounded-xl border border-zinc-800/50 p-4">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5" />
        Order Progress
      </h3>

      <div className="space-y-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === currentIdx;
          const isComplete = idx < currentIdx;
          const isPending = idx > currentIdx;

          return (
            <div key={step.id} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                isActive ? 'bg-emerald-500/20 text-emerald-400' :
                isComplete ? 'bg-emerald-500/10 text-emerald-500' :
                'bg-zinc-800 text-zinc-600'
              }`}>
                {isActive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>
              <span className={`text-sm ${
                isActive ? 'text-white font-medium' :
                isComplete ? 'text-zinc-400' :
                'text-zinc-600'
              }`}>
                {step.label}
              </span>
              {isActive && (
                <span className="ml-auto text-xs text-emerald-400">In progress</span>
              )}
            </div>
          );
        })}
      </div>

      {selectedQuote && state !== 'INIT' && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Selected Quote</div>
          <div className="text-lg font-light text-white">
            {selectedQuote.outputAmount} <span className="text-zinc-400">{intent.toCcy}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentActivityLog({ events }: { events: AxlEvent[] }) {
  return (
    <div className="bg-zinc-900/50 backdrop-blur rounded-xl border border-zinc-800/50 p-4">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Zap className="w-3.5 h-3.5" />
        Agent Activity
      </h3>

      <div className="space-y-1 max-h-40 overflow-y-auto font-mono text-xs">
        {events.length === 0 ? (
          <p className="text-zinc-600 text-center py-4">Waiting for activity...</p>
        ) : (
          events.slice().reverse().map((e, i) => (
            <motion.div
              key={i}
              className="flex gap-2 py-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <span className="text-zinc-600 w-16 shrink-0">
                {new Date(e.ts).toISOString().slice(11, 19)}
              </span>
              <span className={`w-10 shrink-0 ${
                e.dir === 'send' ? 'text-orange-400' :
                e.dir === 'recv' ? 'text-emerald-400' :
                'text-blue-400'
              }`}>
                {e.dir}
              </span>
              <span className="text-zinc-300 truncate">{e.type}</span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function TransactionLinks({ lockTx, releaseTx, evidenceHash }: {
  lockTx?: string;
  releaseTx?: string;
  evidenceHash?: string;
}) {
  if (!lockTx && !releaseTx && !evidenceHash) return null;

  return (
    <div className="bg-zinc-900/50 backdrop-blur rounded-xl border border-zinc-800/50 p-4">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <ExternalLink className="w-3.5 h-3.5" />
        Transactions
      </h3>

      <div className="space-y-2">
        {lockTx && (
          <a
            href={`https://chainscan-galileo.0g.ai/tx/${lockTx}`}
            target="_blank"
            className="block p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-400">Lock</span>
              <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-white transition-colors" />
            </div>
            <div className="text-xs font-mono text-zinc-300 truncate">{lockTx}</div>
          </a>
        )}

        {releaseTx && (
          <a
            href={`https://chainscan-galileo.0g.ai/tx/${releaseTx}`}
            target="_blank"
            className="block p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-emerald-400">Release</span>
              <ExternalLink className="w-3 h-3 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
            </div>
            <div className="text-xs font-mono text-emerald-300 truncate">{releaseTx}</div>
          </a>
        )}

        {evidenceHash && (
          <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <div className="text-xs text-purple-400 mb-1">0G Evidence</div>
            <div className="text-xs font-mono text-purple-300 truncate">{evidenceHash}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCards({ agentStatus, currentPhase }: { agentStatus: AgentStatus | null; currentPhase: ProofPhase | null }) {
  if (!agentStatus) return null;

  const isWatcherActive = currentPhase === 'PAYMENT_OBSERVED';
  const isAttestorActive = currentPhase === 'GENERATING_PROOF' || currentPhase === 'PROOF_GENERATED';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Fiat Agent */}
      <div className="bg-zinc-900/50 backdrop-blur rounded-xl border border-zinc-800/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-yellow-500/20 flex items-center justify-center">
            <Banknote className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-white">Fiat</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-zinc-500">Rails</p>
          </div>
        </div>
        <code className="text-[9px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded font-mono block truncate">
          {agentStatus.fiatPubkey?.slice(0, 14)}...
        </code>
      </div>

      {/* Crypto Agent */}
      <div className="bg-zinc-900/50 backdrop-blur rounded-xl border border-zinc-800/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
            <Coins className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-white">Crypto</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-zinc-500">Signer</p>
          </div>
        </div>
        <code className="text-[9px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded font-mono block truncate">
          {agentStatus.cryptoPubkey?.slice(0, 14)}...
        </code>
      </div>

      {/* Watcher Agent (G.14) */}
      <div className={`bg-zinc-900/50 backdrop-blur rounded-xl border p-3 ${isWatcherActive ? 'border-purple-500/50' : 'border-purple-800/30'}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <Eye className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-white">Watcher</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isWatcherActive ? 'bg-purple-400 animate-pulse' : 'bg-zinc-600'}`} />
            </div>
            <p className="text-[10px] text-zinc-500">Observe</p>
          </div>
        </div>
        <code className="text-[9px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded font-mono block truncate">
          {agentStatus.fiatPubkey ? `w:${agentStatus.fiatPubkey.slice(2, 16)}...` : 'loading...'}
        </code>
      </div>

      {/* Attestation Agent (G.14) */}
      <div className={`bg-zinc-900/50 backdrop-blur rounded-xl border p-3 ${isAttestorActive ? 'border-indigo-500/50' : 'border-indigo-800/30'}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-white">Attestor</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isAttestorActive ? 'bg-indigo-400 animate-pulse' : 'bg-zinc-600'}`} />
            </div>
            <p className="text-[10px] text-zinc-500">Prove</p>
          </div>
        </div>
        <code className="text-[9px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded font-mono block truncate">
          {agentStatus.cryptoPubkey ? `a:${agentStatus.cryptoPubkey.slice(2, 16)}...` : 'loading...'}
        </code>
      </div>
    </div>
  );
}

export default function P2PPage() {
  const { address, isConnected } = useAccount();
  const { wallets, activeWallet, createWallet } = useWalletContext();
  const [appState, setAppState] = useState<AppState>({ state: 'INIT', quotes: [] });
  const [axlLog, setAxlLog] = useState<AxlEvent[]>([]);
  const [intent, setIntent] = useState({ amount: '100', fromCcy: 'USD', toCcy: 'ETH', rail: 'banksim' });
  const [orderRefId, setOrderRefId] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ProofPhase | null>(null);

  const effectiveAddress = activeWallet?.address || address;

  const { writeContract: approve, data: approveTxHash, error: approveError } = useWriteContract();
  const { writeContract: lock, data: lockTxHash, error: lockError } = useWriteContract();

  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isSuccess: lockSuccess } = useWaitForTransactionReceipt({ hash: lockTxHash });

  const addLog = useCallback((dir: 'send' | 'recv' | 'info', type: string) => {
    setAxlLog(prev => [...prev.slice(-49), { ts: Date.now(), dir, type }]);
  }, []);

  useEffect(() => {
    if (!isConnected || !effectiveAddress) {
      setAgentStatus(null);
      return;
    }

    const spawnAgents = async () => {
      try {
        addLog('info', 'Spawning agents...');
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: effectiveAddress }),
        });

        if (!res.ok) {
          addLog('info', `Agent server error: ${res.status}`);
          return;
        }

        const data = await res.json();
        if (data.ok) {
          const status: AgentStatus = { fiatPubkey: data.fiatPubkey, cryptoPubkey: data.cryptoPubkey };
          setAgentStatus(status);
          addLog('info', `Fiat Agent: ${data.fiatPubkey?.slice(0, 12)}...`);
          addLog('info', `Crypto Agent: ${data.cryptoPubkey?.slice(0, 12)}...`);

          setTimeout(async () => {
            try {
              const decisionsRes = await fetch(`/api/decisions/${effectiveAddress}`);
              if (decisionsRes.ok) {
                const decisions = await decisionsRes.json();
                setAgentStatus(prev => prev ? { ...prev, decisions } : prev);
                if (decisions.fiat?.attestation?.verified) {
                  addLog('info', 'Fiat Agent: TEE attested ✓');
                }
                if (decisions.crypto?.attestation?.verified) {
                  addLog('info', 'Crypto Agent: TEE attested ✓');
                }
              }
            } catch (err) {}
          }, 2000);
        } else {
          addLog('info', `Agent spawn failed: ${data.error}`);
        }
      } catch (err: any) {
        addLog('info', `Agent error: ${err.message}`);
      }
    };

    spawnAgents();
  }, [isConnected, effectiveAddress, addLog]);

  useEffect(() => {
    if (approveSuccess && appState.state === 'COMMITTING' && address && appState.selectedQuote) {
      addLog('send', 'escrow.lockWithCommitments');
      const tokenAmount = parseUnits(appState.selectedQuote.outputAmount, 18);
      const lpBond = tokenAmount / 100n;

      // G.14: Generate receiver commitment and reference hash
      const receiverLabel = `lp@${intent.rail}`;
      const receiverCommitment = keccak256(toBytes(receiverLabel));
      const referenceHash = keccak256(toBytes(`REF-${orderRefId}`));
      const challengeWindow = intent.rail === 'banksim' ? 0n : 60n; // No challenge for instant rails
      const attestationMode = intent.rail;

      lock({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'lockWithCommitments',
        args: [
          address,
          TOKEN_ADDRESS,
          tokenAmount,
          BigInt(intent.amount),
          intent.fromCcy,
          intent.rail,
          600n,
          orderRefId,
          receiverCommitment,
          referenceHash,
          challengeWindow,
          attestationMode,
        ],
        value: lpBond,
      });
    }
  }, [approveSuccess, appState.state, appState.selectedQuote, address, orderRefId, intent, lock, addLog]);

  useEffect(() => {
    if (lockSuccess && lockTxHash && appState.state === 'COMMITTING') {
      fetch('/api/register-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderRefId, amount: intent.amount, currency: intent.fromCcy }),
      });

      // Update proof timeline
      fetch(`/api/orders/${orderRefId}/proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'LOCKED', txHash: lockTxHash }),
      });

      addLog('recv', 'OrderLocked');
      setAppState(prev => ({ ...prev, state: 'LOCKED', lockTx: lockTxHash }));
    }
  }, [lockSuccess, lockTxHash, appState.state, orderRefId, intent, addLog]);

  // Sync proof timeline with app state changes
  useEffect(() => {
    if (!orderRefId) return;

    const phaseMap: Record<OrderState, string | null> = {
      'INIT': null,
      'CONNECTING_AGENTS': null,
      'BROADCASTING': null,
      'QUOTING': null,
      'SELECTING': null,
      'COMMITTING': 'AWAITING_LOCK',
      'LOCKED': 'AWAITING_PAYMENT',
      'PAYING': 'PAYMENT_OBSERVED',
      'RELEASED': 'RELEASED',
      'ERROR': null,
    };

    const phase = phaseMap[appState.state];
    if (phase) {
      fetch(`/api/orders/${orderRefId}/proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase,
          txHash: appState.state === 'RELEASED' ? appState.releaseTx : undefined,
        }),
      });
    }
  }, [appState.state, orderRefId, appState.releaseTx]);

  useEffect(() => {
    if (approveError) {
      setAppState(prev => ({ ...prev, state: 'ERROR', error: approveError.message }));
    }
    if (lockError) {
      setAppState(prev => ({ ...prev, state: 'ERROR', error: lockError.message }));
    }
  }, [approveError, lockError]);

  const startOrder = async () => {
    if (!effectiveAddress || !agentStatus) return;

    const newOrderRefId = `order-${Date.now()}`;
    setOrderRefId(newOrderRefId);
    setAppState({ state: 'BROADCASTING', quotes: [] });
    setAxlLog([]);
    addLog('send', 'rfq.get');

    try {
      const res = await fetch('/api/rfq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: effectiveAddress,
          intent: {
            fromCurrency: intent.fromCcy,
            toCurrency: intent.toCcy,
            toChain: '0g',
            amount: intent.amount,
            rails: [intent.rail],
          },
        }),
      });

      if (!res.ok) {
        addLog('info', `RFQ request failed: ${res.status}`);
        setAppState(prev => ({ ...prev, state: 'ERROR', error: `HTTP ${res.status}` }));
        return;
      }

      const data = await res.json();
      if (!data.ok) {
        addLog('info', `RFQ failed: ${data.error}`);
        setAppState(prev => ({ ...prev, state: 'ERROR', error: data.error }));
        return;
      }

      addLog('info', `RFQ broadcast to ${data.broadcastTo} LPs`);
      setAppState(prev => ({ ...prev, rfqId: data.rfqId, state: 'QUOTING' }));

      let attempts = 0;
      const pollQuotes = async () => {
        try {
          const quotesRes = await fetch(`/api/quotes/${data.rfqId}?wallet=${effectiveAddress}`);
          if (!quotesRes.ok) return;
          const quotesData = await quotesRes.json();

          if (quotesData.quotes?.length > 0) {
            quotesData.quotes.forEach((q: Quote) => {
              addLog('recv', `quote.sign (${q.rate} ${intent.toCcy}/${intent.fromCcy})`);
            });
            setAppState(prev => ({ ...prev, quotes: quotesData.quotes, state: 'SELECTING' }));
          } else if (attempts < 10) {
            attempts++;
            setTimeout(pollQuotes, 500);
          } else {
            setAppState(prev => ({ ...prev, state: 'ERROR', error: 'No quotes received' }));
          }
        } catch (err: any) {
          if (attempts < 10) {
            attempts++;
            setTimeout(pollQuotes, 500);
          }
        }
      };

      setTimeout(pollQuotes, 500);
    } catch (err: any) {
      addLog('info', `Error: ${err.message}`);
      setAppState(prev => ({ ...prev, state: 'ERROR', error: err.message }));
    }
  };

  const selectQuote = async (quote: Quote, index: number) => {
    if (!effectiveAddress) return;

    setAppState(prev => ({ ...prev, selectedQuote: quote, state: 'COMMITTING' }));
    addLog('send', `order.commit → ${quote.lpAgent.slice(0, 12)}...`);

    try {
      const res = await fetch('/api/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: effectiveAddress,
          rfqId: appState.rfqId,
          quoteIndex: index,
          orderRefId,
          rail: intent.rail,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        addLog('recv', 'fiat.details');

        const fiatDetails: FiatDetails = data.fiatDetails || {
          railType: intent.rail,
          paymentId: 'arkoroy@okicici',
          reference: orderRefId,
          qrPayload: `pay://arkoroy@okicici?amount=${intent.amount}&ref=${orderRefId}`,
        };
        setAppState(prev => ({ ...prev, fiatDetails }));

        addLog('send', 'token.approve');
        const tokenAmount = parseUnits(quote.outputAmount, 18);
        approve({
          address: TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ESCROW_ADDRESS, tokenAmount],
        });
      } else {
        setAppState(prev => ({ ...prev, state: 'ERROR', error: data.error }));
      }
    } catch (err: any) {
      setAppState(prev => ({ ...prev, state: 'ERROR', error: err.message }));
    }
  };

  const triggerPayment = async () => {
    if (appState.state !== 'LOCKED' || !orderRefId) return;
    setAppState(prev => ({ ...prev, state: 'PAYING' }));
    addLog('send', 'banksim.webhook');

    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderRefId, amount: intent.amount, currency: intent.fromCcy }),
      });
      const result = await res.json();

      if (result.ok) {
        addLog('recv', 'webhook.verified');
        addLog('recv', '0g.storage.pinned');
        addLog('recv', 'escrow.released');

        // Update proof timeline with evidence
        fetch(`/api/orders/${orderRefId}/proof`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evidenceHash: result.evidenceHash,
            storageRootHash: result.evidenceHash,
          }),
        });

        setAppState(prev => ({
          ...prev,
          state: 'RELEASED',
          releaseTx: result.txHash,
          evidenceRootHash: result.evidenceHash,
        }));
      } else {
        setAppState(prev => ({ ...prev, state: 'ERROR', error: result.error }));
      }
    } catch (err: any) {
      setAppState(prev => ({ ...prev, state: 'ERROR', error: err.message }));
    }
  };

  const reset = () => setAppState({ state: 'INIT', quotes: [] });
  const isProcessing = ['BROADCASTING', 'QUOTING', 'COMMITTING', 'PAYING'].includes(appState.state);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-zinc-800/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-display font-bold tracking-tight">Aegis</Link>
            <div className="h-4 w-px bg-zinc-700" />
            <span className="text-sm text-zinc-500">P2P Swap</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/lp/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">
              LP Portal
            </Link>
            <Link href="/wallets" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Wallets
            </Link>
            <WalletSwitcher />
            {isConnected && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-2 rounded-full bg-zinc-800/50 hover:bg-emerald-500/20 border border-zinc-700/50 hover:border-emerald-500/30 text-zinc-400 hover:text-emerald-400 transition-all"
                title="Create new wallet"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {!isConnected ? (
        <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6">
          <motion.div
            className="text-center space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-emerald-500/20">
              <Wallet className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-3xl font-display font-medium mb-2">Fiat → Crypto</h2>
              <p className="text-zinc-400 max-w-md">Connect your wallet to spawn AI agents that negotiate and settle swaps autonomously.</p>
            </div>
            <WalletSwitcher />
          </motion.div>
        </main>
      ) : (
        <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Left Column - Swap Form */}
            <div className="lg:col-span-5">
              <AnimatePresence mode="wait">
                {appState.state === 'INIT' && (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <SwapForm
                      intent={intent}
                      setIntent={setIntent}
                      onSubmit={startOrder}
                      disabled={isProcessing}
                      agentStatus={agentStatus}
                    />
                  </motion.div>
                )}

                {appState.state === 'SELECTING' && appState.quotes.length > 0 && (
                  <motion.div
                    key="quotes"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-lg font-medium">Select Quote</h2>
                      <span className="text-xs text-zinc-500">{appState.quotes.length} available</span>
                    </div>
                    {appState.quotes.map((q, i) => (
                      <QuoteCard
                        key={q.quoteId}
                        quote={q}
                        index={i}
                        intent={intent}
                        onSelect={() => selectQuote(q, i)}
                        selected={appState.selectedQuote?.quoteId === q.quoteId}
                      />
                    ))}
                    <button onClick={reset} className="w-full text-sm text-zinc-500 hover:text-white py-2">
                      Cancel
                    </button>
                  </motion.div>
                )}

                {appState.state === 'LOCKED' && appState.selectedQuote && (
                  <motion.div
                    key="locked"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-800/80 p-6"
                  >
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                        <Shield className="w-8 h-8 text-emerald-400" />
                      </div>
                      <h3 className="text-xl font-medium mb-2">Escrow Locked</h3>
                      <p className="text-sm text-zinc-400">
                        {appState.selectedQuote.outputAmount} {intent.toCcy} secured
                      </p>
                    </div>

                    {appState.fiatDetails && (
                      <div className="space-y-4 mb-6">
                        <div className="text-xs text-zinc-500 uppercase tracking-wider">Payment Instructions</div>

                        {appState.fiatDetails.qrPayload && (
                          <div className="bg-white p-4 rounded-xl mx-auto w-fit">
                            <QRCodeSVG
                              value={appState.fiatDetails.qrPayload}
                              size={128}
                              level="M"
                              includeMargin={false}
                            />
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="bg-zinc-800/50 rounded-lg p-3">
                            <div className="text-xs text-zinc-500 mb-1">Send to</div>
                            <div className="flex items-center justify-between">
                              <code className="text-sm text-white font-mono">{appState.fiatDetails.paymentId}</code>
                              <button
                                onClick={() => navigator.clipboard.writeText(appState.fiatDetails!.paymentId)}
                                className="text-xs text-emerald-400 hover:text-emerald-300"
                              >
                                Copy
                              </button>
                            </div>
                          </div>

                          <div className="bg-zinc-800/50 rounded-lg p-3">
                            <div className="text-xs text-zinc-500 mb-1">Include Reference</div>
                            <div className="flex items-center justify-between">
                              <code className="text-sm text-white font-mono truncate max-w-[200px]">{appState.fiatDetails.reference}</code>
                              <button
                                onClick={() => navigator.clipboard.writeText(appState.fiatDetails!.reference)}
                                className="text-xs text-emerald-400 hover:text-emerald-300 shrink-0 ml-2"
                              >
                                Copy
                              </button>
                            </div>
                          </div>

                          <div className="bg-zinc-800/50 rounded-lg p-3">
                            <div className="text-xs text-zinc-500 mb-1">Amount</div>
                            <div className="text-lg font-medium text-white">{intent.amount} {intent.fromCcy}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <motion.button
                      onClick={triggerPayment}
                      className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-medium py-4 rounded-xl"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      I've Paid {intent.amount} {intent.fromCcy}
                    </motion.button>
                    <p className="text-xs text-zinc-500 text-center mt-3">
                      Click after completing payment via {appState.fiatDetails?.railType || intent.rail}
                    </p>
                  </motion.div>
                )}

                {appState.state === 'RELEASED' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-emerald-500/30 p-6 text-center"
                  >
                    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-medium mb-2">Swap Complete!</h3>
                    <p className="text-sm text-zinc-400 mb-6">
                      {appState.selectedQuote?.outputAmount} {intent.toCcy} released to your wallet
                    </p>
                    <button onClick={reset} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
                      New Swap
                    </button>
                  </motion.div>
                )}

                {appState.state === 'ERROR' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-red-500/30 p-6 text-center"
                  >
                    <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                      <XCircle className="w-8 h-8 text-red-400" />
                    </div>
                    <h3 className="text-xl font-medium mb-2">Error</h3>
                    <p className="text-sm text-red-400 mb-6">{appState.error}</p>
                    <button onClick={reset} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
                      Try Again
                    </button>
                  </motion.div>
                )}

                {isProcessing && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-800/80 p-8 text-center"
                  >
                    <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
                    <p className="text-lg">
                      {appState.state === 'BROADCASTING' && 'Broadcasting RFQ...'}
                      {appState.state === 'QUOTING' && 'Waiting for quotes...'}
                      {appState.state === 'COMMITTING' && 'Locking escrow...'}
                      {appState.state === 'PAYING' && 'Processing payment...'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Column - Status & Activity */}
            <div className="lg:col-span-7 space-y-4">
              <AgentCards agentStatus={agentStatus} currentPhase={currentPhase} />

              <div className="grid md:grid-cols-2 gap-4">
                <OrderProgress
                  state={appState.state}
                  intent={intent}
                  selectedQuote={appState.selectedQuote}
                />
                <AgentActivityLog events={axlLog} />
              </div>

              <TransactionLinks
                lockTx={appState.lockTx}
                releaseTx={appState.releaseTx}
                evidenceHash={appState.evidenceRootHash}
              />

              {/* G.14: Settlement Proof Timeline */}
              {orderRefId && ['LOCKED', 'PAYING', 'RELEASED'].includes(appState.state) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <ProofTimeline orderId={orderRefId} onPhaseChange={setCurrentPhase} />
                </motion.div>
              )}
            </div>
          </div>
        </main>
      )}

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
