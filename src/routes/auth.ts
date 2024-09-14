import { Hono } from "hono";
import z from 'zod'
import { sign } from "hono/jwt"
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

export const authRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string,
    SECRET_KEY: string
  }
}>();

export const signupInput = z.object({
  // username: z.string(),
  // name: z.string(),
  // password: z.string().min(6),
  // email: z.string().email(),
  name: z.string().min(2, { message: "Name must be at least 2 characters long" }),
  username: z.string().min(4, { message: "Username must be at least 4 characters" }).max(50),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
})
export type signupInput = z.infer<typeof signupInput>


//singinInput
export const singinInput = z.object({
  username: z.string(),
  password: z.string().min(6)
})
export type singinInput = z.infer<typeof singinInput>

authRouter.post('/signup', async (c) => {
  const body = await c.req.json();
  console.log(body)

  const success = signupInput.safeParse(body);

  if (!success) {
    c.status(411);
    return c.json({
      message: "Inputs not correct!"
    })
  }

  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL
  }).$extends(withAccelerate());

  try {
    const user = await prisma.user.create({
      data: {
        username: body.username,
        name: body.name,
        password: body.password,
        email: body.email
      }
    })
    console.log("user:" + user);
    const jwt = await sign({
      id: user.id
    }, c.env.SECRET_KEY);
    c.status(200);
    return c.text(jwt);
  } catch (e) {
    console.log(e);
    c.status(411);
    c.text("Invalid");
    return c.json({
      message: "error occured!"
    })
  }
})

authRouter.post('/login', async (c) => {
  const body = await c.req.json();
  console.log(body)

  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL
  }).$extends(withAccelerate());

  try {
    const user = await prisma.user.findFirst({
      where: {
        username: body.username,
        password: body.password
      }
    })
    if (!user) {
      c.status(401);
      return c.text("Invalid credentials!");
    }

    const jwt = await sign({
      id: user.id
      //for unique jwt token everytime user logs in
      // sessionId: new Date().getTime()
    }, c.env.SECRET_KEY);

    return c.json({ "token": jwt, "userId": user.id });
  } catch (e) {
    console.log(e);
    c.status(411);
    c.text("Invalid");
  }
})
