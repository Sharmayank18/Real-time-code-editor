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