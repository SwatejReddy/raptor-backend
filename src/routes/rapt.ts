import { verify } from 'hono/jwt';
import { Hono } from "hono"
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate'
import { use } from 'hono/jsx';
import { connect } from 'cloudflare:sockets';

export const raptRouter = new Hono<{
    Bindings: {
        DATABASE_URL: string,
        SECRET_KEY: string
    }
    Variables: {
        userId: string
    }
}>();

raptRouter.use("*", async (c, next) => {
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

raptRouter.post('create', async (c) => {
    const body = await c.req.json();
    const authorId = c.get("userId");
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());

    if (!body.title || !body.content) {
        c.status(411);
        return c.json({
            message: "Title and content are required"
        })
    }

    const rapt = await prisma.rapt.create({
        data: {
            userId: Number(authorId),
            title: body.title,
            content: body.content,
        }
    })

    return c.json({
        id: rapt.id,
        title: rapt.title
    })
})

// to edit a rapt by id
raptRouter.post('edit/:raptId', async (c) => {
    const body = await c.req.json();
    const authorId = c.get("userId");
    const id = c.req.param('raptId');


    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());

    if (!body.title || !body.content) {
        c.status(411);
        return c.json({
            message: "Title and content are required"
        })
    }

    const rapt = await prisma.rapt.update({
        where: {
            id: Number(id)
        },
        data: {
            title: body.title,
            content: body.content
        }
    })

    return c.json({
        id: rapt.id,
        title: rapt.title
    })
})

// to delete a rapt by id
raptRouter.delete('delete/:raptId', async (c) => {
    const id = c.req.param('raptId');
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());
    try {
        const rapt = await prisma.rapt.delete({
            where: {
                id: Number(id)
            }
        })
        c.status(200);
        return c.json({
            message: "Rapt deleted"
        })
    } catch (e) {
        c.status(411);
        return c.json({
            message: "An error occured!"
        })
    }
})

//changed from view-rapt to view.
raptRouter.get('/view/:raptId', async (c) => {
    const id = c.req.param('raptId');

    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());

    try {
        const rapt = await prisma.rapt.findUnique({
            where: {
                id: Number(id)
            },
            // select everything and also get the user name from the user table for this id:
            include: {
                user: {
                    select: {
                        name: true,
                        username: true,
                        id: true
                    }
                }
            }
        });
        console.log(rapt);
        if (rapt) {
            console.log(rapt);
            return c.json({
                rapt
            });
        }
        else {
            return c.json({
                message: "No rapt exists"
            });
        }
    } catch (e) {
        c.status(411);
        return c.json({
            message: "Error occured!"
        });
    }
})



raptRouter.post("/like/:raptId", async (c) => {
    const raptId = c.req.param("raptId");
    const user = c.get("userId");
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());
    try {
        //check if it is already liked:
        const likeStatus = await prisma.like.findFirst({
            where: {
                userId: Number(user),
                raptId: Number(raptId)
            }
        })
        //If already liked:
        if (likeStatus) {
            //unlike and remove record:
            const unlike = await prisma.like.delete({
                where: {
                    id: likeStatus.id
                }
            })
            //update like count of the rapt (decrement):
            const likeDecrementOnRapt = await prisma.rapt.update({
                where: {
                    id: Number(raptId)
                },
                data: {
                    likes: {
                        decrement: 1
                    }
                }
            })
            c.status(200);
            return c.json({
                message: "Rapt unliked"
            })
        }
        //Else, add a record of liking it:
        else {
            const like = await prisma.like.create({
                data: {
                    userId: Number(user),
                    raptId: Number(raptId)
                }
            })
            //update the like count of the rapt (increment):
            const likeIncrementOnRapt = await prisma.rapt.update({
                where: {
                    id: Number(raptId)
                },
                data: {
                    likes: {
                        increment: 1
                    }
                }
            })
            c.status(200);
            return c.json({
                message: "Rapt liked"
            })
        }
    } catch (e) {
        c.status(411);
        console.log(e);
        return c.json({
            message: "An error occured!"
        })
    }
})

raptRouter.get('/:userId/all', async (c) => {
    const userId = c.req.param('userId');
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());
    try {
        const rapts = await prisma.rapt.findMany({
            where: {
                userId: Number(userId)
            },
            //sort by date created in descending order
            orderBy: {
                dateCreated: 'desc'
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
        if (rapts) {
            return c.json({
                rapts
            });
        }
        else {
            c.status(411);
            return c.json({
                message: "No rapts found"
            })
        }
    } catch (e) {
        c.status(411);
        return c.json({
            message: "An error occured!"
        })
    }
})

raptRouter.get("/liked/:userId", async (c) => {
    const user = c.req.param("userId");
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());
    try {
        const likedRapts = await prisma.rapt.findMany({
            where: {
                Likes: {
                    some: {
                        userId: Number(user) // Replace with the actual user ID
                    }
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true
                    }
                },
                Likes: {
                    where: {
                        userId: Number(user) // This ensures we only include likes by the specified user
                    }
                }
            }

            // where:{
            //     // Likes:{
            //     //     some:{
            //     //         userId: Number(user)
            //     //     }
            //     // }
            //     Likes: {
            //         userId: Number(user)
            //     }
            // },
            // select:{
            //     user: true,
            //     Likes: true
            // }
        })
        if (likedRapts) {
            c.status(200);
            return c.json({
                likedRapts
            })
        }
        else {
            c.status(411);
            return c.json({
                message: "Rapts not found!"
            })
        }
    } catch (e) {
        console.log(e);
        c.status(411);
        return c.json({
            message: "Error fetching rapts!"
        })
    }
})

raptRouter.get('/allLatest', async (c) => {
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL
    }).$extends(withAccelerate());
    try {
        const rapts = await prisma.rapt.findMany({
            orderBy: {
                dateCreated: 'desc'
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
        if (rapts) {
            c.status(200);
            return c.json({
                rapts
            })
        }
    } catch (e) {
        c.status(411);
        return c.json({
            message: "An error occured!"
        })
    }
})
