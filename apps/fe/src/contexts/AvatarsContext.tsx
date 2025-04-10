// contexts/AvatarContext.tsx
import { createContext, useContext, useState, ReactNode } from "react";

type AvatarContextType = {
  avatars: Map<string, string>;
  fetchAvatars: (userIds: string[]) => Promise<void>;
};

const AvatarContext = createContext<AvatarContextType | undefined>(undefined);

export const AvatarProvider = ({ children }: { children: ReactNode }) => {
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());

  const fetchAvatars = async (userIds: string[]) => {
    if (userIds.length === 0) return;

    try {
      const response = await fetch(
        `/metadata/bulk?userIds=${encodeURIComponent(JSON.stringify(userIds))}`
      );
      const { avatars: avatarData } = await response.json();

      const newAvatars = new Map(avatars);
      avatarData.forEach(
        ({ userId, avatarId }: { userId: string; avatarId: string }) => {
          newAvatars.set(userId, avatarId || "/default-avatar.png");
        }
      );
      setAvatars(newAvatars);
    } catch (error) {
      console.error("Error fetching avatars:", error);
    }
  };

  return (
    <AvatarContext.Provider value={{ avatars, fetchAvatars }}>
      {children}
    </AvatarContext.Provider>
  );
};

export const useAvatar = () => {
  const context = useContext(AvatarContext);
  if (!context) throw new Error("useAvatar must be used within AvatarProvider");
  return context;
};
