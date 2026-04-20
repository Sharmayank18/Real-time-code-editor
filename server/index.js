const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// Judge0 CE public instance language IDs
const JUDGE0_LANG_IDS = {
  javascript: 63,
  typescript: 74,
  python: 71,
  java: 62,
  csharp: 51,
  php: 68,
};

const JUDGE0_URL = "https://ce.judge0.com";

app.post("/execute", async (req, res) => {
  const { sourceCode, language } = req.body;
  const languageId = JUDGE0_LANG_IDS[language];

  if (!languageId) {
    return res.status(400).json({ error: `Unsupported language: ${language}` });
  }

  try {
    // Step 1: Submit code
    const { data: submission } = await axios.post(
      `${JUDGE0_URL}/submissions?base64_encoded=false`,
      { source_code: sourceCode, language_id: languageId },
      { headers: { "Content-Type": "application/json" } }
    );

    const token = submission.token;

    // Step 2: Poll for result
    let result;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const { data } = await axios.get(
        `${JUDGE0_URL}/submissions/${token}?base64_encoded=false`
      );
      if (data.status.id > 2) { // 1=In Queue, 2=Processing
        result = data;
        break;
      }
    }

    if (!result) return res.status(504).json({ error: "Execution timed out" });

    const output = result.stdout || result.stderr || result.compile_output || "No output";
    const isError = !!(result.stderr || result.compile_output);
    res.json({ output, isError });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5001;
const HOST = "0.0.0.0";

app.get("/", (req, res) => {
  res.send("Server is running");
});

// HTTP & Socket Server
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://codesynced.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const userSocketMap = {};
const roomData = {};

const getAllConnectedClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => ({
      socketId,
      username: userSocketMap[socketId],
    })
  );
};

io.on("connection", (socket) => {
  console.log(`🔌 User Connected: ${socket.id}`);

  socket.on("join", ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);

    // Send previous saved code & settings to the newly joined user
    if (roomData[roomId]) {
      socket.emit("sync-code", roomData[roomId]);
    }

    // Notify everyone in the room about the new user
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit("joined", {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  // FIXED: Use socket.to() instead of io.to() to exclude sender
  socket.on("code-change", ({ roomId, code }) => {
    // Save the code to room data
    roomData[roomId] = {
      ...(roomData[roomId] || {}),
      code,
    };
  
    // Broadcast to others in the room (excluding sender)
    socket.to(roomId).emit("code-change", { code });
  });
  
  // FIXED: Use socket.to() instead of io.to() to exclude sender
  socket.on("language-change", ({ roomId, language }) => {
    // Save the language to room data
    roomData[roomId] = {
      ...(roomData[roomId] || {}),
      language,
    };
  
    // Broadcast to others in the room (excluding sender)
    socket.to(roomId).emit("language-change", { language });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];

    rooms.forEach((roomId) => {
      const clients = getAllConnectedClients(roomId);
      
      // Notify remaining users about the disconnection
      socket.to(roomId).emit("disconnected", {
        socketId: socket.id,
        username: userSocketMap[socket.id],
        clients: clients.filter(client => client.socketId !== socket.id),
      });
    });

    delete userSocketMap[socket.id];
    socket.leave([...socket.rooms]);
  });

  socket.on("disconnect", () => {
    console.log(`❌ User Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
});