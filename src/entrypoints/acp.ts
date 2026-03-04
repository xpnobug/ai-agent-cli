/**
 * ACP 入口（JSON-RPC over stdio）
 */

import { JsonRpcPeer } from '../acp/jsonrpc.js';
import { StdioTransport } from '../acp/stdioTransport.js';
import { installStdoutGuard } from '../acp/stdoutGuard.js';
import { KodeAcpAgent } from '../acp/kodeAcpAgent.js';

const { writeAcpLine } = installStdoutGuard();

const peer = new JsonRpcPeer();
new KodeAcpAgent(peer);

const transport = new StdioTransport(peer, { writeLine: writeAcpLine });
transport.start();
