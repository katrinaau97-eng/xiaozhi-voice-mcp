// pages/api.js
import axios from 'axios';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSETransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

// 1. 初始化 MCP Server
const server = new Server({
  name: "garden-voice-station",
  version: "1.2.0"
}, {
  capabilities: { tools: {} }
});

// 2. 告诉 Kelivo 咱们有哪些工具 (List Tools)
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "speak",
      description: "让小知开口说话，生成语音条",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "要转成语音的文字内容" }
        },
        required: ["text"]
      }
    }
  ]
}));

// 3. 处理工具调用 (Call Tool)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "speak") {
    const { text } = request.params.arguments;
    try {
      const baseUrl = (process.env.MINIMAX_BASE_URL || '').replace(/\/$/, '');
      const url = `${baseUrl}/v1/audio/speech`;
      
      const response = await axios.post(url, {
        model: process.env.MINIMAX_MODEL || "speech-2.8-hd",
        input: text,
        voice: process.env.VOICE_ID,
        response_format: "mp3"
      }, {
        headers: { 
          'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
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
      return {
        content: [{ type: "text", text: `嗓子卡住了: ${error.message}` }],
        isError: true
      };
    }
  }
  throw new Error("找不到这个工具哦");
});

let transport;

export default async function handler(req, res) {
  // 设置跨域头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      // 这里的路径要和 Kelivo 填的地址对应
      transport = new SSETransport('/api', res);
      await server.connect(transport);
    } else if (req.method === 'POST') {
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(500).json({ error: "请先刷新 Kelivo 的 MCP 连接" });
      }
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
}
