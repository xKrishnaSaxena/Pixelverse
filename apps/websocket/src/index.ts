import { WebSocketServer } from "ws";
import { User } from "./UserV2";

const wss = new WebSocketServer({ port: 8081 });

wss.on("connection", function connection(ws) {
  console.log("user connected");
  let user = new User(ws);
  ws.on("error", console.error);

  ws.on("close", () => {
    user?.destroy();
  });
});
