import { io } from "socket.io-client";

export const initSocket = () => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";

  return io(BACKEND_URL, {
    transports: ["websocket"],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    timeout: 20000,
    withCredentials: true,
    autoConnect: true,
  });
};


