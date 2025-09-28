import { DATABASE_ID, IMAGES_BUCKET_ID, PROJECTS_ID } from "@/config";
import { getMember } from "@/features/members/utils";
import { sessionMiddleware } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ID, Query } from "node-appwrite";
import z from "zod";
import { createProjectSchema, updateProjectSchema } from "../schemas";
import { Project } from "../types";

const app = new Hono()
  .post(
    "/",
    sessionMiddleware,
    zValidator("form", createProjectSchema),
    async (c) => {
      const tablesDB = c.get("tablesdb");
      const storage = c.get("storage");
      const user = c.get("user");

      const { name, image, workspaceId } = c.req.valid("form");

      if (!workspaceId) {
        return c.json({ error: "Missing workspaceId" }, 400);
      }

      const member = await getMember({
        tablesDB,
        workspaceId,
        userId: user.$id,
      });
      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }
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

      const project = await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: PROJECTS_ID,
        rowId: ID.unique(),
        data: {
          name,
          image: uploadedImageUrl,
          workspaceId,
        },
      });

      return c.json({ data: project });
    }
  )
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const tablesDB = c.get("tablesdb");
      const { workspaceId } = c.req.valid("query");
      if (!workspaceId) {
        return c.json({ error: "Missing workspaceId" }, 401);
      }
      const member = await getMember({
        tablesDB,
        workspaceId,
        userId: user.$id,
      });
      if (!member) {
        return c.json(
          {
            error: "Unauthorized",
          },
          401
        );
      }

      const projects = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: PROJECTS_ID,
        queries: [
          Query.equal("workspaceId", workspaceId),
          Query.orderDesc("$createdAt"),
        ],
      });
      return c.json({ data: projects });
    }
  )
  .patch(
    "/:projectId",
    sessionMiddleware,
    zValidator("form", updateProjectSchema),
    async (c) => {
      const tablesdb = c.get("tablesdb");
      const storage = c.get("storage");
      const user = c.get("user");

      const { projectId } = c.req.param();
      const { name, image } = c.req.valid("form");
      const existingProject = await tablesdb.getRow<Project>({
        databaseId: DATABASE_ID,
        tableId: PROJECTS_ID,
        rowId: projectId,
      });
      const member = await getMember({
        tablesDB: tablesdb,
        workspaceId: existingProject.workspaceId,
        userId: user?.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }
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
      } else {
        uploadedImageUrl = image;
      }
      const project = await tablesdb.updateRow({
        databaseId: DATABASE_ID,
        tableId: PROJECTS_ID,
        rowId: projectId,
        data: {
          name,
          image: uploadedImageUrl,
        },
      });
      return c.json({ data: project });
    }
  )
  .delete("/:projectId", sessionMiddleware, async (c) => {
    const tablesdb = c.get("tablesdb");
    const user = c.get("user");
    const { projectId } = c.req.param();
    const existingProject = await tablesdb.getRow<Project>({
      databaseId: DATABASE_ID,
      tableId: PROJECTS_ID,
      rowId: projectId,
    });
    const member = await getMember({
      tablesDB: tablesdb,
      workspaceId: existingProject.workspaceId,
      userId: user?.$id,
    });
    if (!member) {
      return c.json({ error: "Unauthorized" }, 400);
    }
    await tablesdb.deleteRow({
      databaseId: DATABASE_ID,
      tableId: PROJECTS_ID,
      rowId: projectId,
    });

    return c.json({ data: { $id: projectId } });
  });

export default app;
