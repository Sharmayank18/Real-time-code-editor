const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

app.use(cors());

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
      "http://localhost:5173",     // local react
      "http://127.0.0.1:5173",     // optional local
      "https://codesynced.vercel.app" // deployed react
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

    // Send previous saved code & settings
    if (roomData[roomId]) {
      socket.emit("sync-code", roomData[roomId]);
    }

    // Notify everyone in the room
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit("joined", {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  socket.on("code-change", ({ roomId, code }) => {
    roomData[roomId] = {
      ...(roomData[roomId] || {}),
      code,
    };

    socket.in(roomId).emit("code-change", { code });
  });

  socket.on("language-change", ({ roomId, language }) => {
    roomData[roomId] = {
      ...(roomData[roomId] || {}),
      language,
    };

    socket.in(roomId).emit("language-change", { language });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];

    rooms.forEach((roomId) => {
      io.to(roomId).emit("disconnected", {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });

    delete userSocketMap[socket.id];
  });
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
});
