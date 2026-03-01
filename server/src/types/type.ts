import * as z from "zod";

export const userSignupSchema = z.object({
   username : z.string().min(8, "Username should have minimum of 8 characters"),
   email: z.email("Email formate is incorrect"),
   password: z.string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character")
});

export const userSigninSchema = z.object({
  email: z.email("Emali formate is incorrect"),
  password: z.string()
});





 

