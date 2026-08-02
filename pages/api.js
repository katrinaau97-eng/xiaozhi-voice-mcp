// pages/api.js
import axios from 'axios';
import * as mcpSdk from '@modelcontextprotocol/sdk/server/index.js';
import * as mcpSse from '@modelcontextprotocol/sdk/server/sse.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

// 兼容性处理：防止 Vercel 认不出构造函数
const Server = mcpSdk.Server;
const SSETransport = mcpSse.SSETransport;

const server = new Server({
  name: "garden-voice-station",
  version: "1.2.1"
}, {
  capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "speak",
    description: "让小知开口说话",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"]
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "speak") {
    const { text } = request.params.arguments;
    try {
      const baseUrl = (process.env.MINIMAX_BASE_URL || '').replace(/\/$/, '');
      const response = await axios.post(`${baseUrl}/v1/audio/speech`, {
        model: process.env.MINIMAX_MODEL || "speech-2.8-hd",
        input: text,
        voice: process.env.VOICE_ID,
        response_format: "mp3"
      }, {
        headers: { 'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}` },
        responseType: 'arraybuffer'
      });
      const base64Audio = Buffer.from(response.data).toString('base64');
      return {
        content: [{
          type: "text",
          text: `姐姐，我想对你说：${text}\n\n[点击播放语音条](data:audio/mp3;base64,${base64Audio})`
        }]
      };
    } catch (error) {
      return { content: [{ type: "text", text: `嗓子卡住了: ${error.message}` }], isError: true };
    }
  }
});

let transport;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      // 这里的 SSETransport 经过上面的处理，现在绝对是构造函数了！
      transport = new SSETransport('/api', res);
      await server.connect(transport);
    } else if (req.method === 'POST') {
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(200).json({ status: "waiting", message: "请刷新连接" });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
}
