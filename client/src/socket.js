import { io } from "socket.io-client";

export const initSocket = async () => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  if (!BACKEND_URL) {
    throw new Error("❌ VITE_BACKEND_URL is missing in .env");
  }

  // Check backend health
  await fetch(BACKEND_URL + "/ping", { cache: "no-store" });

  return io(BACKEND_URL, {
    transports: ["websocket"],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    timeout: 20000,
    withCredentials: true,
    autoConnect: true,
  });
};


