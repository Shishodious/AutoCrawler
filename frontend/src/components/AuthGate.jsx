import { useEffect } from "react";
import { initSocket } from "../services/socket";

const AuthGate = ({ children }) => {
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      initSocket(token); // ✅ correct place
    }
  }, []);

  return children;
};

export default AuthGate;
