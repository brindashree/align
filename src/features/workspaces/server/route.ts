import { sessionMiddleware } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createWorkspacesSchema } from "../schemas";
import { DATABASE_ID, WORKSPACES_ID, IMAGES_BUCKET_ID } from "@/config";
import { ID } from "node-appwrite";

const app = new Hono()
  .get("/", sessionMiddleware, async (c) => {
    const tablesdb = c.get("tablesdb");

    const workspaces = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: WORKSPACES_ID,
    });
    return c.json({ data: workspaces });
  })
  .post(
    "/",
    zValidator("form", createWorkspacesSchema),
    sessionMiddleware,
    async (c) => {
      const tablesdb = c.get("tablesdb");
      const storage = c.get("storage");
      const user = c.get("user");

      const { name, image } = c.req.valid("form");

      let uploadedImageUrl: string | undefined;

      if (image instanceof File) {
        const file = await storage.createFile({
          bucketId: IMAGES_BUCKET_ID,
          fileId: ID.unique(),
          file: image,
        });
        const arrayBuffer = await storage.getFileView({
          bucketId: IMAGES_BUCKET_ID,
          fileId: file.$id,
        });
        uploadedImageUrl = `data:image/png;base64,${Buffer.from(
          arrayBuffer
        ).toString("base64")}`;
      }

      const workspace = await tablesdb.createRow({
        databaseId: DATABASE_ID,
        tableId: WORKSPACES_ID,
        rowId: ID.unique(),
        data: {
          name,
          userId: user.$id,
          image: uploadedImageUrl,
        },
      });
      return c.json({ data: workspace });
    }
  );

export default app;
