import { io } from "socket.io-client";

export const initSocket = async () => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  if (!BACKEND_URL) {
    throw new Error("❌ VITE_BACKEND_URL is missing in .env");
  }

  // Verify backend is reachable before connecting socket
  try {
    const res = await fetch(BACKEND_URL + "/ping", { cache: "no-store" });

    if (!res.ok) {
      throw new Error("Backend reachable but returned an error");
    }

  } catch (error) {
    console.log("❌ Backend not reachable:", error);
    throw error;
  }

  const options = {
    forceNew: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    timeout: 20000,
    transports: ["websocket"], // No polling
  };

  return io(BACKEND_URL, options);
};

