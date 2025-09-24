import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { BeatLoader } from "react-spinners";

export default function CreateSpace() {
  const [name, setName] = useState("");
  const [dimensions, setDimensions] = useState("100x100");
  const [isCreating, setIsCreating] = useState(false);
  const { token } = useAuth();
  const navigate = useNavigate();

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const response = await axios.post(
        "http://ec2-13-235-243-65.ap-south-1.compute.amazonaws.com:8080/api/v1/space",
        { name, dimensions },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/space/?spaceId=${response.data.spaceId}`);
    } catch (error) {
      console.error("Error creating space:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-purple-800 flex items-center justify-center p-4">
      <div className="bg-white bg-opacity-10 rounded-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-black mb-8">Create New Space</h1>

        <div className="space-y-6">
          <div>
            <label className="block text-black mb-2">Space Name</label>
            <input
              type="text"
              className="w-full bg-white bg-opacity-20 rounded-lg px-4 py-2 text-black"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-black mb-2">
              Dimensions (Width x Height)
            </label>
            <select
              className="w-full bg-white bg-opacity-20 rounded-lg px-4 py-2 text-black"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
            >
              <option value="100x100">100x100</option>
              <option value="200x200">200x200</option>
              <option value="300x300">300x300</option>
            </select>
          </div>

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-black font-semibold hover:from-purple-600 hover:to-pink-600 transition-all"
          >
            {isCreating ? (
              <BeatLoader color="#ffffff" size={8} />
            ) : (
              "Create Space"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
