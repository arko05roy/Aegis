import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

const ZEROG_RPC = process.env.ZEROG_TESTNET_RPC || 'https://evmrpc-testnet.0g.ai';

export class ZeroGCompute {
  private broker: any;
  private initialized = false;

  async initialize(privateKey: string): Promise<void> {
    const provider = new ethers.JsonRpcProvider(ZEROG_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);
    this.broker = await createZGComputeNetworkBroker(wallet);
    this.initialized = true;
    console.log('[0G Compute] Broker initialized');
  }

  async listServices(): Promise<any[]> {
    if (!this.initialized) throw new Error('Broker not initialized');
    return this.broker.inference.listService();
  }

  async verifyProof(
    providerAddress: string,
    proofPayload: object,
  ): Promise<{ valid: boolean; chatId: string }> {
    if (!this.initialized) throw new Error('Broker not initialized');

    const { endpoint, model } = await this.broker.inference.getServiceMetadata(providerAddress);
    const headers = await this.broker.inference.getRequestHeaders(providerAddress);

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a zkTLS proof verifier. Validate the proof structure and return JSON: {"valid": true/false, "reason": "..."}',
          },
          { role: 'user', content: JSON.stringify(proofPayload) },
        ],
      }),
    });

    const data: any = await response.json();
    const chatId = response.headers.get('ZG-Res-Key') || data.id;

    if (chatId) {
      await this.broker.inference.processResponse(providerAddress, chatId);
    }

    const result = JSON.parse(data.choices[0].message.content);
    return { valid: result.valid, chatId };
  }
}

export async function verifyComputeSetup(privateKey: string): Promise<boolean> {
  console.log('[0G Compute] Verifying setup...');

  const compute = new ZeroGCompute();
  await compute.initialize(privateKey);

  const services = await compute.listServices();
  console.log(`[0G Compute] Found ${services.length} inference services`);

  const chatbots = services.filter((s: any) => s.serviceType === 'chatbot');
  console.log(`[0G Compute] Chatbot services: ${chatbots.map((s: any) => s.model).join(', ')}`);

  return services.length > 0;
}
