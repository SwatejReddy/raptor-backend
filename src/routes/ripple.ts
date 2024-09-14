import { PrismaClient } from "@prisma/client/edge"
import { withAccelerate } from "@prisma/extension-accelerate"
import z from 'zod'
import { verify, sign } from "hono/jwt"
import { Hono } from "hono"
import { raptRouter } from "./rapt"

export const rippleRouter = new Hono<{
    Bindings: {
        DATABASE_URL: string,
        SECRET_KEY: string
    }
    Variables: {
        userId: string
    }
}>();

rippleRouter.use("*", async (c, next) => {
    const authHeader = c.req.header("Authorization") || "";
    const user = await verify(authHeader, c.env.SECRET_KEY);
    if (user) {
        c.set("userId", user.id as string);
        await next();
    }
    else {
        c.status(403);
        return c.json({
            message: "You are not logged in"
        });
    }
})

// A user can create a ripple on a rapt with his own id:
rippleRouter.post('/create/:raptId', async (c) => {
    const body = await c.req.json();
    const content = body.content;
    const userId = c.get("userId");
    const raptId = c.req.param("raptId");

    const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());

    if (!content) {
        return c.json({
            message: "Content is required"
        })
    }
    try {
        const ripple = await prisma.ripple.create({
            data: {
                userId: Number(userId),
                raptId: Number(raptId),
                content: content
            }
        })
        return c.json({
            id: ripple.id,
            content: ripple.content
        })
    }
    catch (e) {
        return c.json({
            message: e
        })
    }
})

// a user can veiew all the ripples of a particular rapt by id:
rippleRouter.get('/view/:raptId', async (c) => {
    const raptId = c.req.param('raptId');
    const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
    try {
        const ripples = await prisma.ripple.findMany({
            where: {
                raptId: Number(raptId)
            },
            orderBy: {
                dateCreated: 'desc'
            }
        })
        if (ripples.length === 0) {
            return c.json({
                message: "No ripples found"
            })
        }
        return c.json(ripples)
    }
    catch (e) {
        return c.json({
            error: e
        })
    }
})



// a user can update his own ripple on a certain rapt:
rippleRouter.put('/edit/:raptId/:rippleId', async (c) => {
    const body = await c.req.json();
    const content = body.content;
    const userId = c.get("userId");
    const raptId = c.req.param("raptId");
    const rippleId = c.req.param("rippleId");

    const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());

    if (!content) {
        return c.json({
            message: "Content is required"
        })
    }
    try {
        const ripple = await prisma.ripple.update({
            where: {
                id: Number(rippleId),
                userId: Number(userId),
                raptId: Number(raptId)
            },
            data: {
                content: content
            }
        })
        return c.json({
            id: ripple.id,
            content: ripple.content
        })
    }
    catch (e) {
        return c.json({
            message: e
        })
    }
})

// a user can delete his own ripple on a certain rapt:
rippleRouter.delete('/delete/:raptId/:rippleId', async (c) => {
    const userId = c.get("userId");
    const raptId = c.req.param("raptId");
    const rippleId = c.req.param("rippleId");

    const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());

    try {
        const ripple = await prisma.ripple.delete({
            where: {
                id: Number(rippleId),
                userId: Number(userId),
                raptId: Number(raptId)
            }
        })
        return c.json({
            message: "Ripple deleted successfully"
        })
    }
    catch (e) {
        return c.json({
            message: e
        })
    }
})