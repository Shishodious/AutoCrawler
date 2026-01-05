import { io } from "socket.io-client";

let socket = null;

/**
 * Initialize socket connection (only once)
 */
export const initSocket = (token) => {
  if (!socket) {
    socket = io("http://localhost:5000", {
      transports: ["websocket", "polling"],
      autoConnect: false,
      auth:{token},
      // 🔁 Reconnection settings (official Socket.IO options)
      reconnection: true,
      reconnectionAttempts: 5,   // after this → reconnect_failed
      reconnectionDelay: 1000,   // start with 1s
      reconnectionDelayMax: 5000, // max delay 5s
      timeout: 20000 // connection timeout (20 seconds)
    });

    /* ---------------- Connection lifecycle ---------------- */

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.warn("❌ Socket disconnected:", reason);
    });

    /* ---------------- Reconnection events ---------------- */

    socket.io.on("reconnect_attempt", (attempt) => {
      console.log(`🔄 Reconnect attempt #${attempt}`);
    });

    socket.io.on("reconnect", (attempt) => {
      console.log(`✅ Reconnected after ${attempt} attempts`);
    });

    socket.io.on("reconnect_error", (error) => {
      console.error("⚠️ Reconnect error:", error.message);
    });

    socket.io.on("reconnect_failed", () => {
      console.error("❌ Reconnection failed permanently");
    });

    // Connection error handler
    socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error.message);
    });
  }
  
  socket.connect();

  return socket;
};

/**
 * Get existing socket instance
 */
export const getSocket = () => {
  if (!socket) {
    throw new Error("Socket not initialized. Call initSocket() first.");
  }
  return socket;
};

/**
 * Disconnect socket manually
 * @param {string} reason - Reason for disconnection (e.g., "logout", "token expired")
 */
export const disconnectSocket = (reason = "client disconnect") => {
  if (socket) {
      socket.disconnect();
      console.log(`🔌 Disconnecting socket - Reason: ${reason}`);
      socket = null;
  }
};
