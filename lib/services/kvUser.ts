import { createClient } from "@vercel/kv";

const kvUser = createClient({
  url: process.env.KV_USER_URL as any,
  token: process.env.KV_USER_TOKEN as any
})

export default kvUser
