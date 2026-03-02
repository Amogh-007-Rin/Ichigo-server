import * as z from "zod";

export const userSignupSchema = z.object({
   username : z.string().min(8, {message: "Username should have minimum of 8 characters"}),
   email: z.email({message: "Incorrect Email Formate"}),
   password: z.string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character")
});

export const userSigninSchema = z.object({
  email: z.email({message: "Incorrect Email Formate"}),
  password: z.string()
});


export const adminSignupSchema = z.object({
  adminName: z.string().min(7, { message: "Username must be more than 6 characters long" })
  .regex(/[A-Z]/, { message: "Username must contain at least one capital letter" })
  .regex(/[0-9]/, { message: "Username must contain at least one number" })
  .regex(/[^A-Za-z0-9]/, { message: "Username must contain at least one special character" }),
  email: z.email({message: "Incorrect Email Formate"}),
  password: z.string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character")
})

export const adminSigninSchema = z.object({
  email: z.email({message: "Incorrect Email Formate"}),
  password: z.string()
});

 

