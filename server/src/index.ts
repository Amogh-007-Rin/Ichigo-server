import express from "express";
import type { Request, Response } from "express";
import "dotenv/config";
import router from "./users/user.js";

const app = express();
const port = process.env.PORT;
app.use(express.json());
app.use("/user", router)

app.get("/", function(req: Request,res: Response) {
    res.status(200).json({message: "Server is up and running"})
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`)
});

