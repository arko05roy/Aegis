'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';

type OrderState = 'INIT' | 'LOCKED' | 'RELEASED' | 'ERROR';

interface AppState {
  state: OrderState;
  quote?: { rate: string; outputAmount: string; fee: string };
  lockTx?: `0x${string}`;
  releaseTx?: string;
  evidenceRootHash?: string;
  error?: string;
}

interface AxlEvent {
  ts: number;
  dir: 'send' | 'recv';
  type: string;
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
  const [appState, setAppState] = useState<AppState>({ state: 'INIT' });
  const [axlLog, setAxlLog] = useState<AxlEvent[]>([]);
  const [intent, setIntent] = useState({ amount: '100', fromCcy: 'INR', toCcy: 'ETH', rail: 'banksim' });
  const [orderRefId, setOrderRefId] = useState('');
  const [step, setStep] = useState<'idle' | 'approving' | 'locking' | 'paying'>('idle');

  const { writeContract: approve, data: approveTxHash, error: approveError } = useWriteContract();
  const { writeContract: lock, data: lockTxHash, error: lockError } = useWriteContract();

  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isSuccess: lockSuccess } = useWaitForTransactionReceipt({ hash: lockTxHash });

  const addLog = (dir: 'send' | 'recv', type: string) => {
    setAxlLog(prev => [...prev.slice(-39), { ts: Date.now(), dir, type }]);
  };

  useEffect(() => {
    if (approveSuccess && step === 'approving' && address) {
      setStep('locking');
      addLog('send', 'escrow.lock');
      const tokenAmount = parseUnits('1', 18);
      const lpBond = tokenAmount / 100n;

      lock({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'lock',
        args: [address, TOKEN_ADDRESS, tokenAmount, 10000n, intent.fromCcy, intent.rail, 600n, orderRefId],
        value: lpBond,
      });
    }
  }, [approveSuccess, step, address, orderRefId, intent]);

  useEffect(() => {
    if (lockSuccess && lockTxHash && step === 'locking') {
      // Register order for webhook validation
      fetch('/api/register-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderRefId, amount: intent.amount, currency: intent.fromCcy }),
      });

      setStep('idle');
      setAppState({
        state: 'LOCKED',
        lockTx: lockTxHash,
        quote: { rate: '0.00035', outputAmount: '0.035', fee: '0.50' },
      });
      addLog('recv', 'OrderLocked');
    }
  }, [lockSuccess, lockTxHash, step]);

  useEffect(() => {
    if (approveError) {
      setAppState({ state: 'ERROR', error: approveError.message });
      setStep('idle');
    }
    if (lockError) {
      setAppState({ state: 'ERROR', error: lockError.message });
      setStep('idle');
    }
  }, [approveError, lockError]);

  const startOrder = async () => {
    if (!address) return;

    const newOrderRefId = `order-${Date.now()}`;
    setOrderRefId(newOrderRefId);
    setAppState({ state: 'INIT' });
    setAxlLog([]);

    try {
      const res = await fetch('/api/sandbox/ws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'topology' }),
      });
      const topology = await res.json();
      if (topology.our_public_key) {
        addLog('send', 'rfq.get');
        addLog('recv', 'quote.sign');
      }
    } catch {}

    setStep('approving');
    addLog('send', 'token.approve');
    approve({
      address: TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ESCROW_ADDRESS, parseUnits('1', 18)],
    });
  };

  const triggerPayment = async () => {
    if (appState.state !== 'LOCKED' || !orderRefId) return;
    setStep('paying');
    addLog('send', 'banksim.webhook');

    let result: any;
    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderRefId }),
      });
      result = await res.json();
    } catch (e: any) {
      result = { ok: false, error: e.message };
    }

    setStep('idle');
    if (result.ok) {
      addLog('recv', 'webhook.verified');
      addLog('recv', '0g.pinned');
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
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <header className="border-b border-zinc-800 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Aegis</h1>
          <ConnectWallet />
        </div>
      </header>

      {!isConnected ? (
        <main className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <h2 className="text-3xl mb-4">Fiat → Crypto</h2>
            <p className="text-zinc-500 mb-6">Connect wallet to swap</p>
            <ConnectWallet />
          </div>
        </main>
      ) : (
        <main className="grid grid-cols-2 grid-rows-2 h-[calc(100vh-65px)]">
          <section className="border-r border-b border-zinc-800 p-6">
            <h2 className="text-zinc-400 uppercase tracking-wider text-xs mb-4">Swap</h2>
            {appState.state === 'INIT' && step === 'idle' && (
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
                <button onClick={startOrder} className="w-full bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded font-semibold">
                  Start Order
                </button>
              </>
            )}
            {step !== 'idle' && appState.state !== 'RELEASED' && (
              <div className="p-4 bg-zinc-900 rounded animate-pulse">
                {step === 'approving' && 'Approving token...'}
                {step === 'locking' && 'Locking in escrow...'}
                {step === 'paying' && 'Processing payment...'}
              </div>
            )}
            {appState.quote && appState.state === 'LOCKED' && step === 'idle' && (
              <>
                <div className="p-4 bg-zinc-900 rounded border border-zinc-700 mb-4">
                  <div className="text-zinc-400 text-sm">You receive</div>
                  <div className="text-2xl">{appState.quote.outputAmount} {intent.toCcy}</div>
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
              <div className="p-4 border border-red-500 rounded text-red-400 text-sm">{appState.error}</div>
            )}
          </section>

          <section className="border-b border-zinc-800 p-6">
            <h2 className="text-zinc-400 uppercase tracking-wider text-xs mb-4">Status</h2>
            {(['INIT', 'LOCKED', 'RELEASED'] as OrderState[]).map((s, i, arr) => {
              const reached = arr.indexOf(appState.state) >= i;
              const current = appState.state === s;
              return (
                <div key={s} className={`flex items-center gap-3 mb-2 ${reached ? 'text-white' : 'text-zinc-600'}`}>
                  <div className={`w-3 h-3 rounded-full ${current ? 'bg-blue-500 animate-pulse' : reached ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                  <span>{s}</span>
                </div>
              );
            })}
          </section>

          <section className="border-r border-zinc-800 p-6 overflow-y-auto">
            <h2 className="text-zinc-400 uppercase tracking-wider text-xs mb-4">Activity</h2>
            {axlLog.map((e, i) => (
              <div key={i} className="flex gap-2 text-xs mb-1">
                <span className="text-zinc-500">{new Date(e.ts).toISOString().slice(11, 19)}</span>
                <span className={e.dir === 'send' ? 'text-orange-400' : 'text-emerald-400'}>{e.dir}</span>
                <span>{e.type}</span>
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
          </section>
        </main>
      )}
    </div>
  );
}
