import express from "express";
import { router } from "./routes/v1";
import cors from "cors";

const app = express();
app.use(
  cors({
    origin: "https://pixelverse.stelliform.xyz",
    credentials: true,
  })
);
app.use(express.json());
app.use("/api/v1", router);

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server started on port ${process.env.PORT || 3000}`);
});
