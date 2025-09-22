import { useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { useState, useEffect } from "react";

interface BannedUser {
  id: string;
  username: string;
}

interface SpaceDetails {
  id: string;
  name: string;
  bannedUsers: BannedUser[];
}

export default function ManageSpace() {
  const { spaceId } = useParams();
  const { token } = useAuth();
  const [space, setSpace] = useState<SpaceDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpaceDetails = async () => {
      try {
        const response = await axios.get(
          `http://localhost:8080/api/v1/space/${spaceId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSpace(response.data);
      } catch (err) {
        setError("Failed to fetch space details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpaceDetails();
  }, [spaceId, token]);

  const handleUnban = async (userId: string) => {
    try {
      await axios.post(
        `http://localhost:8080/api/v1/space/${spaceId}/unban`,
        { userId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const response = await axios.get(
        `http://localhost:8080/api/v1/space/${spaceId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSpace(response.data);
    } catch (err) {
      console.error("Failed to unban user", err);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-purple-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-black mb-6">
          Manage Space: {space?.name}
        </h1>
        <div className="bg-white bg-opacity-10 p-6 rounded-2xl">
          <h2 className="text-2xl font-semibold text-black mb-4">
            Banned Users
          </h2>
          {space?.bannedUsers.length === 0 ? (
            <p className="text-gray-300">No banned users.</p>
          ) : (
            <ul className="space-y-4">
              {space?.bannedUsers.map((user) => (
                <li
                  key={user.id}
                  className="flex justify-between items-center bg-gray-700 p-4 rounded-lg"
                >
                  <span className="text-white">{user.username}</span>
                  <button
                    onClick={() => handleUnban(user.username)}
                    className="px-4 py-2 bg-green-500 rounded-lg text-white font-semibold hover:bg-green-600 transition-all"
                  >
                    Unban
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
