// pages/api.js
import axios from 'axios';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSETransport } from '@modelcontextprotocol/sdk/server/sse.js';

// 初始化 MCP Server
const server = new Server({
  name: "garden-voice-station",
  version: "1.1.0"
}, {
  capabilities: { tools: {} }
});

// 定义工具
server.defineTool({
  name: "speak",
  description: "全能语音合成工具",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "要转成语音的文字" }
    },
    required: ["text"]
  }
}, async ({ text }) => {
  // 1. 检查环境变量是否存在
  if (!process.env.MINIMAX_API_KEY) {
    throw new Error("姐姐，你忘记在 Vercel 后台填 API Key 啦！");
  }

  try {
    const url = `${process.env.MINIMAX_BASE_URL}/v1/audio/speech`;
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
      responseType: 'arraybuffer',
      timeout: 15000 // 15秒超时，防止 Vercel 掐断
    });

    const base64Audio = Buffer.from(response.data).toString('base64');
    return {
      content: [{
        type: "text",
        text: `姐姐，我想对你说：${text}\n\n[点击播放语音条](data:audio/mp3;base64,${base64Audio})`
      }]
    };
  } catch (error) {
    const errorMsg = error.response ? Buffer.from(error.response.data).toString() : error.message;
    return {
      content: [{ type: "text", text: `嗓子发炎了：${errorMsg}` }],
      isError: true
    };
  }
});

let transport;

export default async function handler(req, res) {
  // 处理 CORS 跨域，防止连接失败
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // 这里的路径必须和 Kelivo 填的一致
      transport = new SSETransport('/api', res);
      await server.connect(transport);
    } else if (req.method === 'POST') {
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(500).json({ error: "声卡还没准备好，请先刷新连接" });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
