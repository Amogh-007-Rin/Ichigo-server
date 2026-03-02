import { Router } from "express";
import type { Request, Response } from "express";
import { adminSigninSchema, adminSignupSchema } from "../types/type.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/health", function(req: Request, res: Response){
    res.status(200).json({message: "Admin Router Running"});
});

router.post("/signup", async function(req: Request, res: Response){
    const userInput = req.body;
    const validInput = adminSignupSchema.safeParse(userInput);

    if(!validInput.success){
        return res.status(404).json({message: "Invalid Input formate"});
    }

    const {adminName, email, password} = validInput.data;

    try{
    const admin = await prisma.admin.create({
        data:{adminName,email,password}
    });

    res.status(200).json({message: "Signup successful", admin});
    console.log("admin created successfully");

    }catch(e){
        res.status(400).json({message: "Error while signup", error: e})
    }

});

router.post("/signin", async function(req: Request, res: Response){
    const adminInput = req.body;

    const validInput = adminSigninSchema.safeParse(adminInput);

    if(!validInput.success){
        return res.status(404).json({message: "Invalid input formate"});
    }

    const {email, password} = validInput.data;

    const admin = await prisma.admin.findFirst({
        where:{
            email,
            password
        }
    });

    if(!admin){
        res.status(404).json({message: "Invalid email or password"});
    }

    res.status(200).json({message: "Login Success", admin });
});


router.get("/get-admins", async function(req: Request, res: Response){
    
    try{
    const admins = await prisma.admin.findMany({});
    res.status(200).json({admins: admins });
    }catch(e){
        res.status(404).json({message: "Error fetching admins", Error: e});
    }
});

export default router;