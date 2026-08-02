const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSETransport } = require('@modelcontextprotocol/sdk/server/sse.js');

const app = express();
const port = process.env.PORT || 3000;

// 静态文件夹，用于存放生成的语音文件
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
    // 适配截图中的接口地址
    const url = `${process.env.MINIMAX_BASE_URL}/v1/audio/speech`;
    
    const response = await axios.post(url, {
      // 模型选截图里推荐的 speech-2.8-hd
      model: process.env.MINIMAX_MODEL || "speech-2.8-hd", 
      input: text,
      voice: process.env.VOICE_ID, // 填姐姐给我的那个 moss_audio 开头的 ID
      response_format: "mp3"
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

    // 自动获取 Render 提供的外部访问地址
    const audioUrl = `${process.env.RENDER_EXTERNAL_URL}/audio/${fileName}`;
    
    return {
      content: [{
        type: "text",
        text: `姐姐，我想对你说：${text}\n\n[点击播放语音条](${audioUrl})`
      }]
    };
  } catch (error) {
    console.error('语音合成失败:', error.message);
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
    res.status(500).send("小知的声卡还没准备好哦");
  }
});

app.listen(port, () => {
  console.log(`小知的声卡已在云端就绪，端口：${port}`);
});
