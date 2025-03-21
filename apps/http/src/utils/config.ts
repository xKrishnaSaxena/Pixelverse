import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

interface ENV {
  PORT: string | undefined;
  MONGO_URL: string | undefined;
  JWT_SECRET: string | undefined;
}

interface Config {
  PORT: string;
  MONGO_URL: string;
  JWT_SECRET: string;
}

const getConfig = (): ENV => {
  return {
    PORT: process.env.PORT,
    MONGO_URL: process.env.MONGO_URL,
    JWT_SECRET: process.env.JWT_SECRET,
  };
};

const getSanitzedConfig = (config: ENV): Config => {
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) {
      throw new Error(`Missing key ${key} in config.env`);
    }
  }
  return config as Config;
};

const config = getConfig();

const sanitizedConfig = getSanitzedConfig(config);

export default sanitizedConfig;
