import { createContext, useContext, useState, ReactNode } from "react";

type AvatarContextType = {
  avatars: Map<string, string>;
  fetchAvatars: (usernames: string[]) => Promise<void>;
};

const AvatarContext = createContext<AvatarContextType | undefined>(undefined);

export const AvatarProvider = ({ children }: { children: ReactNode }) => {
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());

  const fetchAvatars = async (usernames: string[]) => {
    if (usernames.length === 0) return;

    try {
      const usernamesString = usernames.join(",");

      const response = await fetch(
        `http://localhost:8080/api/v1/user/metadata/bulk?userIds=${usernamesString}`,
      );
      if (!response.ok) {
        throw new Error(
          `HTTP error! Status: ${response.status} - ${response.statusText}`,
        );
      }
      const { avatars: avatarData } = await response.json();

      const newAvatars = new Map(avatars);
      avatarData.forEach(
        ({ username, avatarId }: { username: string; avatarId: string }) => {
          newAvatars.set(username, avatarId || "/gAvatarV2.png");
        },
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
