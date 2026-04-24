// protocol/mcp/client.ts
import { AXLBridge } from '../axl/bridge.js';

export class MCPAgentClient {
  private axl: AXLBridge;

  constructor(axlBridge: AXLBridge) {
    this.axl = axlBridge;
  }

  /**
   * Call a tool on a remote agent via AXL.
   */
  async callTool(
    peerPublicKey: string,
    serviceName: string,
    toolName: string,
    params: object,
  ): Promise<any> {
    const response = await this.axl.mcpCall(
      peerPublicKey,
      serviceName,
      'tools/call',
      { name: toolName, arguments: params },
    );
    if (response.error) {
      throw new Error(`MCP error: ${response.error.message}`);
    }
    return JSON.parse(response.result.content[0].text);
  }

  /**
   * List tools available on a remote agent.
   */
  async listTools(peerPublicKey: string, serviceName: string): Promise<any[]> {
    const response = await this.axl.mcpCall(
      peerPublicKey,
      serviceName,
      'tools/list',
      {},
    );
    return response.result.tools;
  }
}
