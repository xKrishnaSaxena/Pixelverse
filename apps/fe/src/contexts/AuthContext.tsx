import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import jwt from "jsonwebtoken";

type User = {
  id: string;
  role: "User" | "Admin";
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = () => {
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        try {
          const decoded = jwt.decode(storedToken) as {
            userId: string;
            role: "User" | "Admin";
          } | null;

          if (decoded?.userId && decoded.role) {
            setUser({ id: decoded.userId, role: decoded.role });
            setToken(storedToken);
          } else {
            throw new Error("Invalid token");
          }
        } catch (error) {
          localStorage.removeItem("token");
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(
        "http://165.232.191.102:8080/api/v1/signin",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("token", data.token);
      const decoded = jwt.decode(data.token) as {
        userId: string;
        role: "User" | "Admin";
      };

      setUser({ id: decoded.userId, role: decoded.role });
      setToken(data.token);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const signup = async (username: string, password: string) => {
    try {
      const signupResponse = await fetch(
        "http://165.232.191.102:8080/api/v1/signup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, type: "user" }),
        }
      );

      const signupData = await signupResponse.json();

      if (!signupResponse.ok) {
        throw new Error(signupData.message || "Signup failed");
      }

      await login(username, password);
    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
