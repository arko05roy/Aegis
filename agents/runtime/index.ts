// agents/runtime/index.ts
import { AXLBridge, AXLMessageHandler } from '../../protocol/axl/bridge';
import { MCPAgentClient } from '../../protocol/mcp/client';
import { X402Client } from '../../protocol/x402/client';
import { ZeroGStorage } from '../../zerog/storage/client';
import { ethers } from 'ethers';

export interface AgentConfig {
  name: string;
  role: 'buyer' | 'lp' | 'keeper';
  privateKey: string;
  rpcUrl: string;
  axlPort?: number;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected axl: AXLBridge;
  protected mcpClient: MCPAgentClient;
  protected x402: X402Client;
  protected storage: ZeroGStorage;
  protected signer: ethers.Wallet;
  protected messageHandler: AXLMessageHandler;

  constructor(config: AgentConfig) {
    this.config = config;
    this.axl = new AXLBridge(`http://127.0.0.1:${config.axlPort || 9002}`);
    this.mcpClient = new MCPAgentClient(this.axl);
    this.x402 = new X402Client({ privateKey: config.privateKey });
    this.storage = new ZeroGStorage(config.privateKey);

    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.signer = new ethers.Wallet(config.privateKey, provider);

    this.messageHandler = new AXLMessageHandler(this.axl);
  }

  async initialize(): Promise<void> {
    console.log(`[${this.config.name}] Initializing...`);

    const topology = await this.axl.getTopology();
    console.log(`[${this.config.name}] AXL Public Key: ${topology.our_public_key}`);

    this.setupMessageHandlers();

    console.log(`[${this.config.name}] Initialized`);
  }

  protected abstract setupMessageHandlers(): void;

  async start(): Promise<void> {
    console.log(`[${this.config.name}] Starting...`);
    await this.messageHandler.start();
  }

  stop(): void {
    console.log(`[${this.config.name}] Stopping...`);
    this.messageHandler.stop();
  }

  getAddress(): string {
    return this.signer.address;
  }

  async getAXLPublicKey(): Promise<string> {
    return this.axl.getPublicKey();
  }
}
