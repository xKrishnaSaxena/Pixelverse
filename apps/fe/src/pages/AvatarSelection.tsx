import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { BeatLoader } from "react-spinners";

interface Avatar {
  id: string;
  name: string;
  imageUrl: string;
}

export default function AvatarSelection() {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { token } = useAuth();
  const navigate = useNavigate();
  console.log(selectedAvatar);
  useEffect(() => {
    const fetchAvatars = async () => {
      try {
        const response = await axios.get(
          "http://localhost:8080/api/v1/avatars",
        );
        setAvatars(response.data.avatars);
      } catch (error) {
        console.error("Error fetching avatars:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvatars();
  }, []);

  const handleSave = async () => {
    if (!selectedAvatar) return;

    setIsSaving(true);
    try {
      await axios.post(
        "http://localhost:8080/api/v1/user/metadata",
        { avatarId: selectedAvatar },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      navigate("/");
    } catch (error) {
      console.error("Error updating avatar:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-purple-800 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <BeatLoader color="#ffffff" />
          <p className="text-white text-lg">Loading avatars...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-purple-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-white mb-8 animate-fade-in">
          Choose Your Avatar
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {avatars.map((avatar) => (
            <div
              key={avatar.id}
              onClick={() => setSelectedAvatar(avatar.id)}
              className={`relative cursor-pointer transform transition-all duration-300 hover:scale-105 ${
                selectedAvatar === avatar.id ? "ring-4 ring-purple-400" : ""
              } rounded-2xl overflow-hidden aspect-square`}
            >
              <img
                src={avatar.imageUrl}
                alt={avatar.name}
                className="w-full h-full object-cover"
              />
              {selectedAvatar === avatar.id && (
                <div className="absolute inset-0 bg-purple-500 bg-opacity-30 flex items-center justify-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleSave}
            disabled={!selectedAvatar || isSaving}
            className={`px-8 py-3 text-lg font-semibold rounded-full transition-all ${
              selectedAvatar
                ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transform hover:scale-105"
                : "bg-gray-400 cursor-not-allowed"
            } text-white flex items-center`}
          >
            {isSaving ? (
              <BeatLoader color="#ffffff" size={8} />
            ) : (
              "Save & Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
