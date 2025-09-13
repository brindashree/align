import { sessionMiddleware } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createWorkspacesSchema } from "../schemas";
import { DATABASE_ID, WORKSPACES_ID } from "@/config";
import { ID } from "node-appwrite";

const app = new Hono().post(
  "/",
  zValidator("json", createWorkspacesSchema),
  sessionMiddleware,
  async (c) => {
    const tablesdb = c.get("tablesdb");
    const user = c.get("user");

    const { name } = c.req.valid("json");

    const workspace = await tablesdb.createRow({
      databaseId: DATABASE_ID,
      tableId: WORKSPACES_ID,
      rowId: ID.unique(),
      data: {
        name,
        userId: user.$id,
      },
    });
    return c.json({ data: workspace });
  }
);

export default app;
