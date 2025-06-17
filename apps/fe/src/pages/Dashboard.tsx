import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { BeatLoader } from "react-spinners";

interface Space {
  id: string;
  name: string;
  dimensions: string;
  thumbnail?: string;
}

export default function Dashboard() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceIdInput, setSpaceIdInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  console.log(spaces);
  useEffect(() => {
    const fetchSpaces = async () => {
      try {
        const response = await axios.get(
          "http://localhost:3000/api/v1/space/all",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setSpaces(response.data.spaces);
      } catch (error) {
        console.error("Error fetching spaces:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpaces();
  }, [token]);

  const handleJoinSpace = async () => {
    if (!spaceIdInput) return;
    navigate(`/space/?spaceId=${spaceIdInput}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-purple-800 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <BeatLoader color="#ffffff" />
          <p className="text-black text-lg">Loading your spaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-purple-800 py-12 px-4">
      <div className="absolute top-4 right-4">
        <button
          onClick={logout}
          className="px-6 py-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg text-white font-semibold hover:from-red-600 hover:to-orange-600 transition-all"
        >
          Logout
        </button>
      </div>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          <div className="flex-1 bg-white bg-opacity-10 p-6 rounded-2xl">
            <h2 className="text-2xl font-bold text-black mb-4">Join Space</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Enter Space ID"
                className="flex-1 bg-white bg-opacity-20 rounded-lg px-4 py-2 text-black placeholder-gray-300"
                value={spaceIdInput}
                onChange={(e) => setSpaceIdInput(e.target.value)}
              />
              <button
                onClick={handleJoinSpace}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-black font-semibold hover:from-purple-600 hover:to-pink-600 transition-all"
              >
                Join
              </button>
            </div>
          </div>

          <div className="flex-1 bg-white bg-opacity-10 p-6 rounded-2xl">
            <h2 className="text-2xl font-bold text-black mb-4">
              Create New Space
            </h2>
            <button
              onClick={() => navigate("/create-space")}
              className="w-full py-3 bg-gradient-to-r from-green-400 to-cyan-500 rounded-lg text-black font-semibold hover:from-green-500 hover:to-cyan-600 transition-all"
            >
              Create New Space
            </button>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-black mb-6">Your Spaces</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {spaces.map((space) => (
            <div
              key={space.id}
              className="bg-white bg-opacity-10 rounded-2xl p-6 cursor-pointer hover:bg-opacity-20 transition-all"
              onClick={() => navigate(`/space/?spaceId=${space.id}`)}
            >
              {space.thumbnail && (
                <img
                  src={space.thumbnail}
                  alt={space.name}
                  className="w-full h-48 object-cover rounded-xl mb-4"
                />
              )}
              <h3 className="text-xl font-semibold text-black mb-2">
                {space.name}
              </h3>
              <p className="text-gray-300">Dimensions: {space.dimensions} km</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/manage-space/${space.id}`);
                }}
                className="mt-4 px-4 py-2 bg-blue-500 rounded-lg text-white font-semibold hover:bg-blue-600 transition-all"
              >
                Manage
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
