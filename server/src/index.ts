import express from "express";
import type { Request, Response } from "express";
import "dotenv/config";
import userRouter from "./users/user.js";
import adminRouter from "./admin/admin.js"

const app = express();
const port = process.env.PORT;
app.use(express.json());
app.use("/user", userRouter)
app.use("/admin", adminRouter)

app.get("/", function(req: Request,res: Response) {
    res.status(200).json({message: "Server is up and running"})
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`)
});

