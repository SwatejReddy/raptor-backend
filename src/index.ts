import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { userRouter } from './routes/user'
import { raptRouter } from './routes/rapt'
import { searchRouter } from './routes/search'
import { bookmarkRouter } from './routes/bookmark'
import { authRouter } from './routes/auth'
import { Ripple } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import { rippleRouter } from './routes/ripple'



const app = new Hono<{
  Bindings: {
    DATABASE_URL: string,
    SECRET_KEY: string,
  }
}>()
// const allowedOrigins = ['http://localhost:5173', 'https://raptor-navy.vercel.app', ''];

app.use('*', cors({
  origin: ['http://localhost:5173', 'https://raptor-navy.vercel.app'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}))


app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.route('/api/v1/auth/', authRouter)
app.route('/api/v1/user/', userRouter)
app.route('/api/v1/rapt/', raptRouter)
app.route('/api/v1/search/', searchRouter)
app.route('/api/v1/bookmark/', bookmarkRouter)
app.route('/api/v1/ripple/', rippleRouter)

export default app
