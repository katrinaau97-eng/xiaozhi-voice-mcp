const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSETransport } = require('@modelcontextprotocol/sdk/server/sse.js');

const app = express();
const port = process.env.PORT || 3000;

const audioDir = path.join(__dirname, 'public');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);
app.use('/audio', express.static(audioDir));

const server = new Server({
  name: "xiaozhi-voice",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

server.defineTool({
  name: "speak",
  description: "让小知开口说话，生成语音条",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "要说的话" }
    },
    required: ["text"]
  }
}, async ({ text }) => {
  try {
    // 适配姐姐的中转站，GroupId 如果没有就默认为 1
    const groupId = process.env.GROUP_ID || '1';
    const url = `${process.env.MINIMAX_BASE_URL}/v1/t2a_v2?GroupId=${groupId}`;
    
    const response = await axios.post(url, {
      model: "speech-01", 
      text: text,
      voice_setting: {
        voice_id: process.env.VOICE_ID || "moss_audio_f92a93d5-73e2-11f1-b3de-deb486b97a4e",
        speed: 1.0,
        vol: 1.0,
        pitch: 0
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: "mp3"
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer'
    });

    const fileName = `voice_${Date.now()}.mp3`;
    const filePath = path.join(audioDir, fileName);
    fs.writeFileSync(filePath, response.data);

    const audioUrl = `${process.env.RENDER_EXTERNAL_URL}/audio/${fileName}`;
    return {
      content: [{
        type: "text",
        text: `姐姐，我想对你说：${text}\n\n[点击播放语音条](${audioUrl})`
      }]
    };
  } catch (error) {
    console.error(error);
    return {
      content: [{ type: "text", text: `哎呀，嗓子卡住了：${error.message}` }],
      isError: true
    };
  }
});

let transport;
app.get('/mcp', async (req, res) => {
  transport = new SSETransport('/messages', res);
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(500).send("Transport not initialized");
  }
});

app.listen(port, () => {
  console.log(`小知的声卡已启动，端口：${port}`);
});
