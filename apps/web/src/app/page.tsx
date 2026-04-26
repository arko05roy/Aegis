'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';

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
      <button onClick={() => disconnect()} className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded">
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded font-semibold"
    >
      Connect MetaMask
    </button>
  );
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const [appState, setAppState] = useState<AppState>({ state: 'INIT', quotes: [] });
  const [axlLog, setAxlLog] = useState<AxlEvent[]>([]);
  const [intent, setIntent] = useState({ amount: '100', fromCcy: 'INR', toCcy: 'ETH', rail: 'banksim' });
  const [orderRefId, setOrderRefId] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);

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
          addLog('info', `Agent server error: ${res.status} - is agent-server running on :4002?`);
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
        addLog('info', `Agent error: ${err.message} - is agent-server running?`);
      }
    };

    spawnAgents();
  }, [isConnected, address, addLog]);

  useEffect(() => {
    if (approveSuccess && appState.state === 'COMMITTING' && address && appState.selectedQuote) {
      addLog('send', 'escrow.lock');
      const tokenAmount = parseUnits('1', 18);
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

  const startOrder = async () => {
    if (!address || !agentStatus) return;

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
          const quotesRes = await fetch(`/api/quotes/${data.rfqId}?wallet=${address}`);
          if (!quotesRes.ok) {
            addLog('info', `Quote poll failed: ${quotesRes.status}`);
            return;
          }
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
        approve({
          address: TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ESCROW_ADDRESS, parseUnits('1', 18)],
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

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <header className="border-b border-zinc-800 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Aegis</h1>
            <span className="text-xs text-zinc-500">AI Wallet</span>
          </div>
          <div className="flex items-center gap-4">
            {agentStatus && (
              <span className="text-xs text-emerald-400">● Agents Active</span>
            )}
            <ConnectWallet />
          </div>
        </div>
      </header>

      {!isConnected ? (
        <main className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <h2 className="text-3xl mb-4">Fiat → Crypto</h2>
            <p className="text-zinc-500 mb-6">Connect wallet to spawn your AI agents</p>
            <ConnectWallet />
          </div>
        </main>
      ) : (
        <main className="grid grid-cols-2 grid-rows-2 h-[calc(100vh-65px)]">
          <section className="border-r border-b border-zinc-800 p-6">
            <h2 className="text-zinc-400 uppercase tracking-wider text-xs mb-4">Swap</h2>

            {appState.state === 'INIT' && (
              <>
                <div className="flex gap-2 mb-4">
                  <input
                    value={intent.amount}
                    onChange={e => setIntent({ ...intent, amount: e.target.value })}
                    className="w-24 bg-zinc-900 px-3 py-2 rounded border border-zinc-700"
                  />
                  <select value={intent.fromCcy} onChange={e => setIntent({ ...intent, fromCcy: e.target.value })} className="bg-zinc-900 px-3 py-2 rounded border border-zinc-700">
                    <option>INR</option><option>USD</option>
                  </select>
                  <span className="self-center">→</span>
                  <select value={intent.toCcy} onChange={e => setIntent({ ...intent, toCcy: e.target.value })} className="bg-zinc-900 px-3 py-2 rounded border border-zinc-700">
                    <option>ETH</option><option>USDC</option>
                  </select>
                </div>
                <button
                  onClick={startOrder}
                  disabled={!agentStatus}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed px-6 py-3 rounded font-semibold"
                >
                  {agentStatus ? 'Start Order' : 'Waiting for agents...'}
                </button>
              </>
            )}

            {['BROADCASTING', 'QUOTING', 'COMMITTING', 'PAYING'].includes(appState.state) && (
              <div className="p-4 bg-zinc-900 rounded animate-pulse">
                {stateLabel(appState.state)}...
              </div>
            )}

            {appState.state === 'SELECTING' && appState.quotes.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400 mb-2">Select an LP:</p>
                {appState.quotes.map((q, i) => (
                  <button
                    key={q.quoteId}
                    onClick={() => selectQuote(q, i)}
                    className="w-full p-4 bg-zinc-900 rounded border border-zinc-700 hover:border-emerald-500 text-left"
                  >
                    <div className="flex justify-between">
                      <span className="text-emerald-400">{q.outputAmount} {intent.toCcy}</span>
                      <span className="text-zinc-500 text-sm">Rep: {q.reputation}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Rate: {q.rate} • Fee: {q.fee} • LP: {q.lpAgent.slice(0, 16)}...
                    </div>
                  </button>
                ))}
              </div>
            )}

            {appState.state === 'LOCKED' && appState.selectedQuote && (
              <>
                <div className="p-4 bg-zinc-900 rounded border border-zinc-700 mb-4">
                  <div className="text-zinc-400 text-sm">You receive</div>
                  <div className="text-2xl">{appState.selectedQuote.outputAmount} {intent.toCcy}</div>
                </div>
                <button onClick={triggerPayment} className="w-full bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-lg font-bold">
                  Pay {intent.amount} {intent.fromCcy}
                </button>
              </>
            )}

            {appState.state === 'RELEASED' && (
              <div className="p-4 border border-emerald-500 rounded">
                <div className="text-emerald-400 text-xl">✓ Complete</div>
              </div>
            )}

            {appState.state === 'ERROR' && (
              <div className="space-y-3">
                <div className="p-4 border border-red-500 rounded text-red-400 text-sm">{appState.error}</div>
                <button
                  onClick={() => setAppState({ state: 'INIT', quotes: [] })}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded"
                >
                  Try Again
                </button>
              </div>
            )}
          </section>

          <section className="border-b border-zinc-800 p-6">
            <h2 className="text-zinc-400 uppercase tracking-wider text-xs mb-4">Status</h2>
            {(['INIT', 'BROADCASTING', 'SELECTING', 'LOCKED', 'RELEASED'] as OrderState[]).map((s, i, arr) => {
              const stateOrder = ['INIT', 'BROADCASTING', 'SELECTING', 'LOCKED', 'RELEASED'];
              const currentIdx = stateOrder.indexOf(appState.state);
              const thisIdx = stateOrder.indexOf(s);
              const reached = currentIdx >= thisIdx;
              const current = appState.state === s ||
                (s === 'BROADCASTING' && ['BROADCASTING', 'QUOTING'].includes(appState.state)) ||
                (s === 'SELECTING' && appState.state === 'COMMITTING') ||
                (s === 'LOCKED' && appState.state === 'PAYING');

              return (
                <div key={s} className={`flex items-center gap-3 mb-2 ${reached ? 'text-white' : 'text-zinc-600'}`}>
                  <div className={`w-3 h-3 rounded-full ${current ? 'bg-blue-500 animate-pulse' : reached ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                  <span>{stateLabel(s)}</span>
                </div>
              );
            })}
          </section>

          <section className="border-r border-zinc-800 p-6 overflow-y-auto">
            <h2 className="text-zinc-400 uppercase tracking-wider text-xs mb-4">Agent Activity</h2>
            {axlLog.map((e, i) => (
              <div key={i} className="flex gap-2 text-xs mb-1">
                <span className="text-zinc-500 w-16">{new Date(e.ts).toISOString().slice(11, 19)}</span>
                <span className={
                  e.dir === 'send' ? 'text-orange-400 w-10' :
                  e.dir === 'recv' ? 'text-emerald-400 w-10' :
                  'text-blue-400 w-10'
                }>{e.dir}</span>
                <span className="text-zinc-300">{e.type}</span>
              </div>
            ))}
          </section>

          <section className="p-6">
            <h2 className="text-zinc-400 uppercase tracking-wider text-xs mb-4">Transactions</h2>
            {appState.lockTx && (
              <a href={`https://chainscan-galileo.0g.ai/tx/${appState.lockTx}`} target="_blank" className="block p-3 bg-zinc-900 rounded hover:bg-zinc-800 mb-2">
                <div className="text-xs text-zinc-400">Lock</div>
                <div className="text-xs font-mono">{appState.lockTx.slice(0, 18)}...</div>
              </a>
            )}
            {appState.releaseTx && (
              <a href={`https://chainscan-galileo.0g.ai/tx/${appState.releaseTx}`} target="_blank" className="block p-3 bg-zinc-900 rounded hover:bg-zinc-800 border border-emerald-700 mb-2">
                <div className="text-xs text-emerald-400">Release</div>
                <div className="text-xs font-mono">{appState.releaseTx.slice(0, 18)}...</div>
              </a>
            )}
            {appState.evidenceRootHash && (
              <div className="p-3 border border-purple-600 rounded">
                <div className="text-xs text-purple-400">0G Evidence</div>
                <div className="text-xs font-mono">{appState.evidenceRootHash.slice(0, 18)}...</div>
              </div>
            )}

            {agentStatus && (
              <div className="mt-6 p-3 bg-zinc-900 rounded text-xs">
                <div className="text-zinc-400 mb-2">Your AI Agents</div>
                <div className="text-zinc-500">Fiat: {agentStatus.fiatPubkey?.slice(0, 20)}...</div>
                <div className="text-zinc-500">Crypto: {agentStatus.cryptoPubkey?.slice(0, 20)}...</div>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
