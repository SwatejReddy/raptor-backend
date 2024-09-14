import { PrismaClient } from "@prisma/client/edge"
import { withAccelerate } from "@prisma/extension-accelerate"
import z from 'zod'
import { verify, sign } from "hono/jwt"
import { Hono } from "hono"

export const searchRouter = new Hono<{
    Bindings: {
        DATABASE_URL: string,
        SECRET_KEY: string
    }
    Variables: {
        userId: string
    }
}>();

searchRouter.use("*", async (c, next) => {
    const authHeader = c.req.header("Authorization") || "";
    const user = await verify(authHeader, c.env.SECRET_KEY);
    if (user) {
        c.set("userId", user.id as string);
        console.log("user:" + user.id);
        await next();
    }
    else {
        c.status(403);
        return c.json({
            message: "You are not logged in"
        });
    }
})

searchRouter.get('/rapts/:query', async (c) => {
    const query = c.req.param("query");

    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());

    try {
        const rapts = await prisma.rapt.findMany({
            where: {
                title: {
                    contains: query,
                    mode: 'insensitive'
                }
            },
            include: {
                user: {
                    select: {
                        name: true,
                        username: true,
                        id: true
                    }
                }
            }
        })
        if (!rapts) {
            c.status(404);
            return c.json({ "Message": "No rapts found" })
        }
        else {
            c.status(200);
            return c.json(rapts)
        }
    } catch (e) {
        return c.json({
            "error": e
        })
    }
})

searchRouter.get('/profiles/:query', async (c) => {
    const query = c.req.param("query");

    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());

    try {
        const profiles = await prisma.user.findMany({
            where: {
                name: {
                    contains: query,
                    mode: 'insensitive'
                }
            }
        })

        if (profiles.length === 0) {
            c.status(404);
            return c.json({ "Message": "No profiles found" });
        }
        else {
            c.status(200);
            return c.json(profiles)
        }
    } catch (e) {
        c.status(400);
        return c.json({
            "Error": e
        })
    }
})