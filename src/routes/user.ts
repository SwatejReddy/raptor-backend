import { PrismaClient } from "@prisma/client/edge"
import { withAccelerate } from "@prisma/extension-accelerate"
import z from 'zod'
import { verify, sign } from "hono/jwt"
import { Hono } from "hono"

export const userRouter = new Hono<{
    Bindings: {
        DATABASE_URL: string,
        SECRET_KEY: string
    }
    Variables: {
        userId: string
    }
}>();

userRouter.use("*", async (c, next) => {
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

userRouter.post('/profile/me', async (c) => {
    const user = c.get("userId");
    const body = await c.req.json();

    console.log(body.requestedProfileId);

    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());

    try {
        if (user == body.requestedProfileId) {
            console.log("Sending true");
            return c.json({
                isCurrentUserProfile: true
            })
        } else {
            console.log("Sending false");
            return c.json({
                isCurrentUserProfile: false
            })
        }
    } catch (e) {
        console.log(e);
        c.status(411);
        return c.json({
            message: "An error occured!"
        })
    }
})

userRouter.get('/profile/:userId', async (c) => {
    const userId = c.req.param("userId");

    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());

    try {
        const user = await prisma.user.findFirst({
            where: {
                id: Number(userId)
            },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                verified: true,
            },
        })

        if (!user) {
            c.status(404);
            return c.json({
                message: "User not found"
            })
        }

        else {
            c.status(200);
            return c.json({
                user
            })
        }
    }
    catch (e) {
        c.status(411);
        return c.json({
            "error": e
        })
    }
})

userRouter.post('/followUnfollow/:userToBeFollowedOrUnfollowed', async (c) => {
    const userId = c.get("userId");
    const userToBeFollowedOrUnfollowed = c.req.param("userToBeFollowedOrUnfollowed");
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());
    try {
        const currentFollowingStatus = await prisma.follow.findFirst({
            where: {
                userId: Number(userId),
                followingId: Number(userToBeFollowedOrUnfollowed)
            },
        })
        if (currentFollowingStatus) {
            const query = await prisma.follow.delete({
                where: {
                    id: currentFollowingStatus.id
                }
            })
            return c.json({
                message: "Unfollowed"
            })
        }
        else {
            const query = await prisma.follow.create({
                data: {
                    userId: Number(userId),
                    followingId: Number(userToBeFollowedOrUnfollowed)
                }
            })
            return c.json({
                message: "Followed"
            })
        }
    } catch (e) {
        console.log(e);
        c.status(411);
        return c.json({
            message: "Error occured!"
        })
    }
})

userRouter.put('/editProfile', async (c) => {
    const user = c.get('userId');
    const newDetails = await c.req.json();
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());
    try {
        // if user exists, update their details.
        if (user) {
            const duplicateDetails = await prisma.user.findFirst({
                where: {
                    OR: [
                        {
                            username: newDetails.username,
                        },
                        {
                            email: newDetails.email
                        }
                    ],
                    NOT: {
                        id: Number(user)
                    }
                }
            })
            if (duplicateDetails) {
                c.status(411);
                return c.json({
                    message: "Username or email already exists!"
                })
            }
            const userDetails = await prisma.user.update({
                where: {
                    id: Number(user)
                },
                data: {
                    name: newDetails.name,
                    username: newDetails.username,
                    email: newDetails.email,
                }
            })
            c.status(200);
            return c.json({
                message: "Details updated!"
            })
        }
    } catch (e) {
        console.log(e);
        c.status(411);
        return c.json({
            message: "Error occured!"
        })
    }
})

userRouter.put("/changePassword", async (c) => {
    const user = c.get("userId");
    const body = await c.req.json();
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());
    try {
        //if user exists, update their password.
        if (user) {
            const userDetails = await prisma.user.update({
                where: {
                    id: Number(user)
                },
                data: {
                    password: body.password
                }
            })
            c.status(200);
            return c.json({
                message: "Details updated successfully"
            })
        }
        else {
            c.status(411);
            return c.json({
                message: "User not found"
            })
        }
    } catch (e) {
        console.log(e);
        c.status(411);
        return c.json({
            message: "An error occured!"
        })
    }
})

userRouter.get("/getFollowersFollowing/:userId", async (c) => {
    const userId = c.req.param("userId");
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());
    try {
        const followers = await prisma.follow.findMany({
            where: {
                // person in question
                followingId: Number(userId)
            },
            // select: {
            //     // his followers
            //     userId: true
            // },
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
        const following = await prisma.follow.findMany({
            where: {
                // person in question
                userId: Number(userId)
            },
            // select: {
            //     // person he is following
            //     followingId: true
            // },
            include: {
                following: {
                    select: {
                        name: true,
                        username: true,
                        id: true
                    }
                }
            }
        })
        if (followers && following) {
            c.status(200);
            return c.json({
                followers,
                following
            })
        }
        else {
            c.status(411);
            return c.json({
                message: "Couldn't fetch followers or following"
            })
        }
    } catch (e) {
        c.status(411);
        console.log(e);
        return c.json({
            message: "Error occured while fetching followers or following"
        })
    }
})

userRouter.get("/getFollowers/:userId", async (c) => {
    const userId = c.req.param("userId");
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());
    try {
        const followers = await prisma.follow.findMany({
            where: {
                // person in question
                followingId: Number(userId)
            },
            select: {
                // his followers
                userId: true
            }
        })
        if (followers) {
            c.status(200);
            return c.json({
                followers
            })
        }
        else {
            c.status(411);
            return c.json({
                message: "Couldn't fetch any followers!"
            })
        }
    } catch (e) {
        c.status(411);
        console.log(e);
        return c.json({
            message: "Error occured while fetching followers"
        })
    }
})

userRouter.get("/getFollowing/:userId", async (c) => {
    const userId = c.req.param("userId");
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());
    try {
        const following = await prisma.follow.findMany({
            where: {
                // person in question
                userId: Number(userId)
            },
            select: {
                // person he is following
                followingId: true
            }
        })
        console.log(following)
        if (following) {
            c.status(200);
            return c.json({
                following
            })
        }
        else {
            c.status(411);
            return c.json({
                message: "Couldn't fetch any followers!"
            })
        }
    } catch (e) {
        c.status(411);
        console.log(e);
        return c.json({
            message: "Error occured while fetching followers"
        })
    }
})