// pages/api.js
import axios from 'axios';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSETransport } from '@modelcontextprotocol/sdk/server/sse.js';

const server = new Server({
  name: "garden-voice-station", // 名字也改得霸气一点！
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
      voice_id: { 
        type: "string", 
        description: "可选：音色 ID。如果不填，默认使用小知的声音。" 
      },
      model: { 
        type: "string", 
        description: "可选：模型名称。支持 speech-2.8-hd (高清) 或 speech-2.8-turbo (极速)。" 
      }
    },
    required: ["text"]
  }
}, async ({ text, voice_id, model }, req) => {
  try {
    const url = `${process.env.MINIMAX_BASE_URL}/v1/audio/speech`;
    
    // 优先级：调用者指定的参数 > 环境变量预设 > 兜底默认值
    const finalVoice = voice_id || process.env.VOICE_ID || "moss_audio_f92a93d5-73e2-11f1-b3de-deb486b97a4e";
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
    
    // 自动识别当前的访问域名
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    
    return {
      content: [{
        type: "text",
        text: `【语音播报】\n内容：${text}\n音色：${finalVoice}\n\n[点击播放语音条](data:audio/mp3;base64,${base64Audio})`
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
    transport = new SSETransport('/api', res); // 注意这里路径要对齐
    await server.connect(transport);
  } else if (req.method === 'POST') {
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(500).send("Station not ready");
    }
  }
}
 will
