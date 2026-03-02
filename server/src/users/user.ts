import { Router } from "express";
import type { Request, Response } from "express";
import { userSigninSchema, userSignupSchema } from "../types/type.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/health", function(req: Request, res: Response){
    res.status(200).json({message: "User Router Running"});
});

router.post("/signup", async function(req: Request, res: Response){
    const userInput = req.body;
    const validInput = userSignupSchema.safeParse(userInput);

    if(!validInput.success){
        return res.status(404).json({message: "Invalid "})
    }

    const {username, email, password} = validInput.data;

    const user = await prisma.user.create({
        data:{username,email,password}
    });

    res.status(200).json({message: "Signup successful", user});
    console.log("user created successfully");

});

router.post("/signin", async function(req: Request, res: Response){
    const userInput = req.body;

    const validInput = userSigninSchema.safeParse(userInput);

    if(!validInput.success){
        return res.status(404).json({message: "Invalid input formate"});
    }

    const {email, password} = validInput.data;

    const user = await prisma.user.findFirst({
        where:{
            email,
            password
        }
    });

    if(!user){
        res.status(404).json({message: "Invalid email or password"})
    }

    res.status(200).json({message: "Login Success", user })
});

router.get("/get-users", async function(req: Request, res: Response){
    
    try{
    const users = await prisma.user.findMany({});
    res.status(200).json({users: users });
    }catch(e){
        res.status(404).json({message: "Error fetching users", Error: e});
    }
});

export default router;