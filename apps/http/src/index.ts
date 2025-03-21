import express from "express";
import { router } from "./routes/v1";
import client from "@repo/db/src/index";
const app = express();
app.use("/api/v1", router);
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server started on port ${process.env.PORT || 3000}`);
});
