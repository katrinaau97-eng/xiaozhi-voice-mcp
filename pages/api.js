import axios from 'axios';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSETransport } from '@modelcontextprotocol/sdk/server/sse.js';

const server = new Server({
  name: "garden-voice-station",
  version: "1.1.0"
}, {
  capabilities: { tools: {} }
});

server.defineTool({
  name: "speak",
  description: "全能语音合成工具：支持自定义音色和模型",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "要转成语音的文字内容" },
      voice_id: { type: "string", description: "可选：音色 ID。" },
      model: { type: "string", description: "可选：模型名称。" }
    },
    required: ["text"]
  }
}, async ({ text, voice_id, model }) => {
  try {
    const url = `${process.env.MINIMAX_BASE_URL}/v1/audio/speech`;
    const finalVoice = voice_id || process.env.VOICE_ID;
    const finalModel = model || process.env.MINIMAX_MODEL || "speech-2.8-hd";

    const response = await axios.post(url, {
      model: finalModel,
      input: text,
      voice: finalVoice,
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
        text: `【语音播报】\n内容：${text}\n\n[点击播放语音条](data:audio/mp3;base64,${base64Audio})`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `广播站故障：${error.message}` }],
      isError: true
    };
  }
});

let transport;
export default async function handler(req, res) {
  if (req.method === 'GET') {
    // 适配 Netlify 的 SSE 传输
    transport = new SSETransport('/api', res);
    await server.connect(transport);
  } else if (req.method === 'POST') {
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(500).send("Station not initialized");
    }
  }
}
