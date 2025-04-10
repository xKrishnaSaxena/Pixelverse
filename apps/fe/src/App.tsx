import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Arena } from "./pages/ArenaV4";
import AuthPage from "./pages/AuthForm";
import Dashboard from "./pages/Dashboard";
import UserUpdate from "./pages/UserUpdate";

import { useAuth } from "./contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { JSX } from "react";
import AvatarSelection from "./pages/AvatarSelection";
import CreateSpace from "./pages/SpaceCreate";

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  return children;
};
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/space" element={<Arena />} />
        <Route path="/create-space" element={<CreateSpace />} />
        <Route path="/avatar-selection" element={<AvatarSelection />} />

        <Route path="/" element={<Dashboard />} />

        <Route path="/user-update" element={<UserUpdate />} />

        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
