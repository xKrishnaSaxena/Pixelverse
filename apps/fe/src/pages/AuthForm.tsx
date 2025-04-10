import { useState } from "react";
import { LockClosedIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (isLogin) {
        await login(username, password);
        navigate("/");
      } else {
        await signup(username, password);
        navigate("/avatar-selection");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {error && <div className="error-message">{error}</div>}
      <div className="max-w-md w-full space-y-8 bg-white/30 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-400 to-pink-600 bg-clip-text text-transparent animate-text-shine font-pacifico">
            Pixelverse
          </h1>
          <p className="mt-2 text-sm text-white/80 font-medium tracking-wider">
            Your Gateway to Infinite Worlds
          </p>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">
            {isLogin ? "Welcome Back Traveler!" : "Begin Your Journey"}
          </h2>
          <p className="mt-2 text-sm text-white/90">
            {isLogin ? "Continue your adventure" : "Create your new identity"}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <div className="relative">
                <UserCircleIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-white/80" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="appearance-none rounded-lg relative block w-full px-10 py-3 bg-white/20 border border-white/30 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:z-10 sm:text-sm"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <LockClosedIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-white/80" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none rounded-lg relative block w-full px-10 py-3 bg-white/20 border border-white/30 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="group relative w-full flex justify-center items-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-purple-600 bg-white hover:bg-white/90 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50"
          >
            {isSubmitting ? (
              <div className="h-5 w-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-medium text-white/90 hover:text-white transition-colors"
          >
            {isLogin
              ? "Don't have an account? Sign Up"
              : "Already have an account? Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
