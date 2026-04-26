'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { AnimatedAIChat } from '@/components/ui/animated-ai-chat';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, ArrowRight, Wallet, Zap, ExternalLink, ChevronDown, Bot, Banknote, Coins } from 'lucide-react';
import Link from 'next/link';

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

interface AppState {
  state: OrderState;
  rfqId?: string;
  quotes: Quote[];
  selectedQuote?: Quote;
  lockTx?: `0x${string}`;
  releaseTx?: string;
  evidenceRootHash?: string;
  error?: string;
}

interface AxlEvent {
  ts: number;
  dir: 'send' | 'recv' | 'info';
  type: string;
}

interface AgentStatus {
  fiatPubkey: string;
  cryptoPubkey: string;
}

const ESCROW_ADDRESS = '0x31da867c6c12ecebbb738d97198792901431e228' as const;
const TOKEN_ADDRESS = '0x89a87b531e37731a77b1e40b6b8b5bcb58819059' as const;

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

function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <button onClick={() => disconnect()} className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-700/50 px-4 py-2 rounded-full border border-zinc-700/50 transition-all">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
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

function AgentDropdown({ agentStatus }: { agentStatus: AgentStatus | null }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!agentStatus) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-full transition-all"
      >
        <Zap className="w-3 h-3" />
        <span>2 Agents Active</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[999]"
              onClick={() => setIsOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="absolute right-0 top-full mt-2 w-80 bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-800 shadow-2xl z-[1000] overflow-hidden"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <div className="p-4 border-b border-zinc-800">
                <h3 className="text-sm font-medium text-white mb-1">Your AI Agents</h3>
                <p className="text-xs text-zinc-500">Autonomous agents managing your swaps</p>
              </div>

              <div className="p-2">
                {/* Fiat Agent */}
                <div className="p-3 rounded-lg hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-yellow-500/20 flex items-center justify-center">
                      <Banknote className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">Fiat Agent</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <p className="text-xs text-zinc-500 mb-2">Manages rail credentials & fiat transfers</p>
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded font-mono">
                          {agentStatus.fiatPubkey?.slice(0, 16)}...
                        </code>
                        <button 
                          onClick={() => navigator.clipboard.writeText(agentStatus.fiatPubkey)}
                          className="text-zinc-500 hover:text-white transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Crypto Agent */}
                <div className="p-3 rounded-lg hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                      <Coins className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">Crypto Agent</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <p className="text-xs text-zinc-500 mb-2">Multi-chain signer & inventory manager</p>
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded font-mono">
                          {agentStatus.cryptoPubkey?.slice(0, 16)}...
                        </code>
                        <button 
                          onClick={() => navigator.clipboard.writeText(agentStatus.cryptoPubkey)}
                          className="text-zinc-500 hover:text-white transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border-t border-zinc-800 bg-zinc-800/30">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Connected via AXL mesh</span>
                  <span className="text-emerald-400">● Online</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function parseSwapIntent(message: string): { amount: string; fromCcy: string; toCcy: string } | null {
  // Match patterns like "swap 100 USD to ETH" or "100 usd → eth" or "/swap 100 INR ETH"
  const patterns = [
    /(?:swap\s+)?(\d+(?:\.\d+)?)\s*(USD|INR|EUR)\s*(?:to|→|->)\s*(ETH|USDC|BTC)/i,
    /\/swap\s+(\d+(?:\.\d+)?)\s*(USD|INR|EUR)\s+(ETH|USDC|BTC)/i,
    /(\d+(?:\.\d+)?)\s*(USD|INR|EUR)\s*(?:to|→|->|for)\s*(ETH|USDC|BTC)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return {
        amount: match[1],
        fromCcy: match[2].toUpperCase(),
        toCcy: match[3].toUpperCase(),
      };
    }
  }
  return null;
}

export default function P2PPage() {
  const { address, isConnected } = useAccount();
  const [appState, setAppState] = useState<AppState>({ state: 'INIT', quotes: [] });
  const [axlLog, setAxlLog] = useState<AxlEvent[]>([]);
  const [intent, setIntent] = useState({ amount: '100', fromCcy: 'USD', toCcy: 'ETH', rail: 'banksim' });
  const [orderRefId, setOrderRefId] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [lastMessage, setLastMessage] = useState('');

  const { writeContract: approve, data: approveTxHash, error: approveError } = useWriteContract();
  const { writeContract: lock, data: lockTxHash, error: lockError } = useWriteContract();

  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isSuccess: lockSuccess } = useWaitForTransactionReceipt({ hash: lockTxHash });

  const addLog = useCallback((dir: 'send' | 'recv' | 'info', type: string) => {
    setAxlLog(prev => [...prev.slice(-49), { ts: Date.now(), dir, type }]);
  }, []);

  useEffect(() => {
    if (!isConnected || !address) {
      setAgentStatus(null);
      return;
    }

    const spawnAgents = async () => {
      try {
        addLog('info', 'Spawning agents...');
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: address }),
        });

        if (!res.ok) {
          addLog('info', `Agent server error: ${res.status}`);
          return;
        }

        const data = await res.json();
        if (data.ok) {
          setAgentStatus({ fiatPubkey: data.fiatPubkey, cryptoPubkey: data.cryptoPubkey });
          addLog('info', `Fiat Agent: ${data.fiatPubkey?.slice(0, 12)}...`);
          addLog('info', `Crypto Agent: ${data.cryptoPubkey?.slice(0, 12)}...`);
        } else {
          addLog('info', `Agent spawn failed: ${data.error}`);
        }
      } catch (err: any) {
        addLog('info', `Agent error: ${err.message}`);
      }
    };

    spawnAgents();
  }, [isConnected, address, addLog]);

  useEffect(() => {
    if (approveSuccess && appState.state === 'COMMITTING' && address && appState.selectedQuote) {
      addLog('send', 'escrow.lock');
      const tokenAmount = parseUnits(appState.selectedQuote.outputAmount, 18);
      const lpBond = tokenAmount / 100n;

      lock({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'lock',
        args: [address, TOKEN_ADDRESS, tokenAmount, BigInt(intent.amount), intent.fromCcy, intent.rail, 600n, orderRefId],
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

      addLog('recv', 'OrderLocked');
      setAppState(prev => ({
        ...prev,
        state: 'LOCKED',
        lockTx: lockTxHash,
      }));
    }
  }, [lockSuccess, lockTxHash, appState.state, orderRefId, intent, addLog]);

  useEffect(() => {
    if (approveError) {
      setAppState(prev => ({ ...prev, state: 'ERROR', error: approveError.message }));
    }
    if (lockError) {
      setAppState(prev => ({ ...prev, state: 'ERROR', error: lockError.message }));
    }
  }, [approveError, lockError]);

  const startOrder = async (parsedIntent?: { amount: string; fromCcy: string; toCcy: string }) => {
    if (!address || !agentStatus) return;

    const currentIntent = parsedIntent || intent;
    if (parsedIntent) {
      setIntent({ ...intent, ...parsedIntent });
    }

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
          walletAddress: address,
          intent: {
            fromCurrency: currentIntent.fromCcy,
            toCurrency: currentIntent.toCcy,
            toChain: '0g',
            amount: currentIntent.amount,
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
          const quotesRes = await fetch(`/api/quotes/${data.rfqId}?wallet=${address}`);
          if (!quotesRes.ok) {
            addLog('info', `Quote poll failed: ${quotesRes.status}`);
            return;
          }
          const quotesData = await quotesRes.json();

          if (quotesData.quotes?.length > 0) {
            quotesData.quotes.forEach((q: Quote) => {
              addLog('recv', `quote.sign (${q.rate} ${currentIntent.toCcy}/${currentIntent.fromCcy})`);
            });
            setAppState(prev => ({ ...prev, quotes: quotesData.quotes, state: 'SELECTING' }));
          } else if (attempts < 10) {
            attempts++;
            setTimeout(pollQuotes, 500);
          } else {
            addLog('info', 'No quotes received after 10 attempts');
            setAppState(prev => ({ ...prev, state: 'ERROR', error: 'No quotes received' }));
          }
        } catch (err: any) {
          addLog('info', `Poll error: ${err.message}`);
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
    if (!address) return;

    setAppState(prev => ({ ...prev, selectedQuote: quote, state: 'COMMITTING' }));
    addLog('send', `order.commit → ${quote.lpAgent.slice(0, 12)}...`);

    try {
      const res = await fetch('/api/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          rfqId: appState.rfqId,
          quoteIndex: index,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        addLog('recv', 'fiat.details');
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

  const handleChatMessage = (message: string) => {
    setLastMessage(message);
    const parsed = parseSwapIntent(message);
    if (parsed && agentStatus) {
      startOrder(parsed);
    }
  };

  const stateLabel = (s: OrderState) => {
    const labels: Record<OrderState, string> = {
      INIT: 'Ready',
      CONNECTING_AGENTS: 'Connecting Agents',
      BROADCASTING: 'Broadcasting RFQ',
      QUOTING: 'Waiting for Quotes',
      SELECTING: 'Select LP',
      COMMITTING: 'Committing Order',
      LOCKED: 'Locked in Escrow',
      PAYING: 'Processing Payment',
      RELEASED: 'Complete',
      ERROR: 'Error',
    };
    return labels[s];
  };

  const isProcessing = ['BROADCASTING', 'QUOTING', 'COMMITTING', 'PAYING'].includes(appState.state);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
        <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-cyan-500/5 rounded-full mix-blend-normal filter blur-[96px] animate-pulse delay-1000" />
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-zinc-800/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-display font-bold tracking-tight">Aegis</Link>
            <div className="h-4 w-px bg-zinc-700" />
            <span className="text-sm text-zinc-500">AI Wallet</span>
          </div>
          <div className="flex items-center gap-3">
            <AgentDropdown agentStatus={agentStatus} />
            <ConnectWallet />
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
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
              <Wallet className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-4xl font-display font-medium">Fiat → Crypto</h2>
            <p className="text-zinc-400 max-w-md">Connect your wallet to spawn AI agents that negotiate and settle swaps autonomously.</p>
            <ConnectWallet />
          </motion.div>
        </main>
      ) : (
        <main className="relative z-10 max-w-6xl mx-auto px-6 py-8 min-h-[calc(100vh-73px)] flex flex-col">
          <div className="grid lg:grid-cols-5 gap-6 flex-1">
            {/* Main Chat Area */}
            <div className="lg:col-span-3 flex flex-col">
              {appState.state === 'INIT' && (
                <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                  <AnimatedAIChat 
                    onSendMessage={handleChatMessage}
                    isProcessing={isProcessing}
                    processingMessage={stateLabel(appState.state)}
                  />
                </div>
              )}

              {/* Quote Selection */}
              <AnimatePresence>
                {appState.state === 'SELECTING' && appState.quotes.length > 0 && (
                  <motion.div 
                    className="space-y-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-medium mb-2">Select a Liquidity Provider</h3>
                      <p className="text-sm text-zinc-400">
                        Swapping {intent.amount} {intent.fromCcy} → {intent.toCcy}
                      </p>
                    </div>
                    {appState.quotes.map((q, i) => (
                      <motion.button
                        key={q.quoteId}
                        onClick={() => selectQuote(q, i)}
                        className="w-full p-5 bg-zinc-900/50 backdrop-blur rounded-xl border border-zinc-800 hover:border-emerald-500/50 transition-all text-left group"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={{ scale: 1.01 }}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-2xl font-display text-emerald-400">{q.outputAmount}</span>
                            <span className="text-lg text-zinc-400 ml-2">{intent.toCcy}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded">Rep: {q.reputation}</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm text-zinc-500">
                          <span>Rate: {q.rate}</span>
                          <span>Fee: {q.fee}</span>
                          <span>LP: {q.lpAgent.slice(0, 12)}...</span>
                        </div>
                        <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Processing States */}
              <AnimatePresence>
                {isProcessing && (
                  <motion.div 
                    className="flex flex-col items-center justify-center py-16"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
                    <p className="text-lg">{stateLabel(appState.state)}...</p>
                    {lastMessage && (
                      <p className="text-sm text-zinc-500 mt-2">Processing: {lastMessage}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Locked - Ready to Pay */}
              <AnimatePresence>
                {appState.state === 'LOCKED' && appState.selectedQuote && (
                  <motion.div 
                    className="text-center space-y-6"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="p-6 bg-zinc-900/50 backdrop-blur rounded-2xl border border-zinc-800">
                      <p className="text-sm text-zinc-400 mb-2">You will receive</p>
                      <p className="text-4xl font-display text-emerald-400 mb-1">{appState.selectedQuote.outputAmount} {intent.toCcy}</p>
                      <p className="text-sm text-zinc-500">Escrowed on 0G Chain</p>
                    </div>
                    <motion.button 
                      onClick={triggerPayment}
                      className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-medium py-4 px-8 rounded-xl transition-all"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Pay {intent.amount} {intent.fromCcy}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success State */}
              <AnimatePresence>
                {appState.state === 'RELEASED' && (
                  <motion.div 
                    className="text-center space-y-6"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-display mb-2">Swap Complete!</h3>
                      <p className="text-zinc-400">Your {intent.toCcy} has been released to your wallet</p>
                    </div>
                    {appState.releaseTx && (
                      <a 
                        href={`https://chainscan-galileo.0g.ai/tx/${appState.releaseTx}`}
                        target="_blank"
                        className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
                      >
                        View transaction <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button 
                      onClick={() => setAppState({ state: 'INIT', quotes: [] })}
                      className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      New Swap
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error State */}
              <AnimatePresence>
                {appState.state === 'ERROR' && (
                  <motion.div 
                    className="text-center space-y-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                      <XCircle className="w-10 h-10 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-medium mb-2">Something went wrong</h3>
                      <p className="text-sm text-red-400">{appState.error}</p>
                    </div>
                    <button 
                      onClick={() => setAppState({ state: 'INIT', quotes: [] })}
                      className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      Try Again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Side Panel */}
            <div className="lg:col-span-2 space-y-4 flex flex-col justify-center">
              {/* Agent Activity */}
              <div className="p-4 bg-zinc-900/30 backdrop-blur rounded-xl border border-zinc-800/50">
                <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">Agent Activity</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
                  {axlLog.length === 0 ? (
                    <p className="text-zinc-600">Waiting for activity...</p>
                  ) : (
                    axlLog.map((e, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-zinc-600 w-14">{new Date(e.ts).toISOString().slice(11, 19)}</span>
                        <span className={
                          e.dir === 'send' ? 'text-orange-400 w-8' :
                          e.dir === 'recv' ? 'text-emerald-400 w-8' :
                          'text-blue-400 w-8'
                        }>{e.dir}</span>
                        <span className="text-zinc-300 truncate">{e.type}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="p-4 bg-zinc-900/30 backdrop-blur rounded-xl border border-zinc-800/50">
                <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">Status</h3>
                <div className="space-y-2">
                  {(['INIT', 'BROADCASTING', 'SELECTING', 'LOCKED', 'RELEASED'] as OrderState[]).map((s) => {
                    const stateOrder = ['INIT', 'BROADCASTING', 'SELECTING', 'LOCKED', 'RELEASED'];
                    const currentIdx = stateOrder.indexOf(appState.state);
                    const thisIdx = stateOrder.indexOf(s);
                    const reached = currentIdx >= thisIdx;
                    const current = appState.state === s ||
                      (s === 'BROADCASTING' && ['BROADCASTING', 'QUOTING'].includes(appState.state)) ||
                      (s === 'SELECTING' && appState.state === 'COMMITTING') ||
                      (s === 'LOCKED' && appState.state === 'PAYING');

                    return (
                      <div key={s} className={`flex items-center gap-3 text-sm ${reached ? 'text-white' : 'text-zinc-600'}`}>
                        <div className={`w-2 h-2 rounded-full transition-colors ${current ? 'bg-emerald-500 animate-pulse' : reached ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                        <span>{stateLabel(s)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transactions */}
              {(appState.lockTx || appState.releaseTx || appState.evidenceRootHash) && (
                <div className="p-4 bg-zinc-900/30 backdrop-blur rounded-xl border border-zinc-800/50">
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">Transactions</h3>
                  <div className="space-y-2">
                    {appState.lockTx && (
                      <a href={`https://chainscan-galileo.0g.ai/tx/${appState.lockTx}`} target="_blank" className="block p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors">
                        <div className="text-xs text-zinc-400 mb-1">Lock</div>
                        <div className="text-xs font-mono truncate">{appState.lockTx}</div>
                      </a>
                    )}
                    {appState.releaseTx && (
                      <a href={`https://chainscan-galileo.0g.ai/tx/${appState.releaseTx}`} target="_blank" className="block p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                        <div className="text-xs text-emerald-400 mb-1">Release</div>
                        <div className="text-xs font-mono truncate">{appState.releaseTx}</div>
                      </a>
                    )}
                    {appState.evidenceRootHash && (
                      <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <div className="text-xs text-purple-400 mb-1">0G Evidence</div>
                        <div className="text-xs font-mono truncate">{appState.evidenceRootHash}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}


            </div>
          </div>
        </main>
      )}
    </div>
  );
}
