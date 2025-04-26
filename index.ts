import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { bearerAuth } from "hono/bearer-auth";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { compress } from "hono/compress";
import { prettyJSON } from "hono/pretty-json";
import { RegExpRouter } from "hono/router/reg-exp-router";

const app = new Hono({ router: new RegExpRouter() });
const token = "honoiscool";

app.use(csrf());
app.use(logger());
app.use(compress());
app.use(prettyJSON());

// CORS should be called before the route
app.use("/api/*", bearerAuth({ token }));
app.use(
  "/api2/*",
  cors({
    origin: "http://example.com",
    allowHeaders: ["X-Custom-Header", "Upgrade-Insecure-Requests"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-Kuma-Revision"],
    maxAge: 600,
    credentials: true,
  })
);

app.all("/api/abc", (c) => {
  return c.json({ success: true });
});
app.all("/api2/abc", (c) => {
  return c.json({ success: true });
});
app.use(
  "/auth/*",
  basicAuth({
    username: "hono",
    password: "acoolproject",
  })
);

app.post(
  "/upload",
  bodyLimit({
    maxSize: 50 * 1024, // 50kb
    onError: (c) => {
      return c.text("超出限制 :(", 413);
    },
  }),
  async (c) => {
    const body = await c.req.parseBody();
    if (body["file"] instanceof File) {
      console.log(`收到文件大小：${body["file"].size}`);
    }
    return c.text("pass");
  }
);

app.get("/api", (c) => {
  return c.json({
    code: 1,
    msg: "Hello World!",
    data: {},
  });
});

app.post("/api/page", bearerAuth({ token }), (c) => {
  return c.json({ message: "Created post!" }, 201);
});

app.get("/auth/page", (c) => {
  return c.text("You are authorized");
});

app.delete(
  "/auth/page",
  basicAuth({
    verifyUser: (username, password, c) => {
      return username === "dynamic-user" && password === "hono-password";
    },
  }),
  (c) => {
    return c.text("Page deleted");
  }
);

const readToken = "read";
const privilegedToken = "read+write";
const privilegedMethods = ["POST", "PUT", "PATCH", "DELETE"];

app.on("GET", "/api/page/*", async (c, next) => {
  // 有效令牌列表
  const bearer = bearerAuth({ token: [readToken, privilegedToken] });
  return bearer(c, next);
});
app.on(privilegedMethods, "/api/page/*", async (c, next) => {
  // 单个有效特权令牌
  const bearer = bearerAuth({ token: privilegedToken });
  return bearer(c, next);
});

app
  .get("/", (c) => c.text("Hi"))
  .post("/json", (c) => {
    return c.req.json();
  })
  .get("/id/:id", (c) => {
    const id = c.req.param("id");
    const name = c.req.query("name");

    c.header("x-powered-by", "benchmark");

    return c.text(`${id} ${name}`);
  });

export default app;
