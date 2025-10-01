import { sessionMiddleware } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createWorkspacesSchema, updateWorkspacesSchema } from "../schemas";
import {
  DATABASE_ID,
  WORKSPACES_ID,
  IMAGES_BUCKET_ID,
  MEMBERS_ID,
} from "@/config";
import { ID, Query } from "node-appwrite";
import { MemberRole } from "@/features/members/types";
import { generateInviteCode } from "@/lib/utils";
import { getMember } from "@/features/members/utils";
import z from "zod";
import { Workspace } from "../types";

const app = new Hono()
  .get("/", sessionMiddleware, async (c) => {
    const tablesdb = c.get("tablesdb");
    const user = c.get("user");
    const members = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: MEMBERS_ID,
      queries: [Query.equal("userId", user?.$id)],
    });

    if (members.total === 0) {
      return c.json({
        data: {
          rows: [],
          total: 0,
        },
      });
    }
    const workspacesIds = members.rows.map((member) => member.workspaceId);

    const workspaces = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: WORKSPACES_ID,
      queries: [
        Query.orderDesc("$createdAt"),
        Query.contains("$id", workspacesIds),
      ],
    });
    return c.json({ data: workspaces });
  })
  .get("/:workspaceId", sessionMiddleware, async (c) => {
    const tablesdb = c.get("tablesdb");
    const user = c.get("user");
    const { workspaceId } = c.req.param();
    const members = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: MEMBERS_ID,
      queries: [Query.equal("userId", user?.$id)],
    });

    if (members.total === 0) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const workspace = await tablesdb.getRow<Workspace>({
      databaseId: DATABASE_ID,
      tableId: WORKSPACES_ID,
      rowId: workspaceId,
    });
    return c.json({ data: workspace });
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
          inviteCode: generateInviteCode(6),
        },
      });

      await tablesdb.createRow({
        databaseId: DATABASE_ID,
        tableId: MEMBERS_ID,
        rowId: ID.unique(),
        data: {
          userId: user.$id,
          workspaceId: workspace.$id,
          role: MemberRole.ADMIN,
        },
      });

      return c.json({ data: workspace });
    }
  )
  .patch(
    "/:workspaceId",
    sessionMiddleware,
    zValidator("form", updateWorkspacesSchema),
    async (c) => {
      const tablesdb = c.get("tablesdb");
      const storage = c.get("storage");
      const user = c.get("user");

      const { workspaceId } = c.req.param();
      const { name, image } = c.req.valid("form");
      const member = await getMember({
        tablesDB: tablesdb,
        workspaceId,
        userId: user?.$id,
      });

      if (!member || member.role !== MemberRole.ADMIN) {
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
      const workspace = await tablesdb.updateRow({
        databaseId: DATABASE_ID,
        tableId: WORKSPACES_ID,
        rowId: workspaceId,
        data: {
          name,
          image: uploadedImageUrl,
        },
      });
      return c.json({ data: workspace });
    }
  )
  .delete("/:workspaceId", sessionMiddleware, async (c) => {
    const tablesdb = c.get("tablesdb");
    const user = c.get("user");
    const { workspaceId } = c.req.param();
    const member = await getMember({
      tablesDB: tablesdb,
      workspaceId,
      userId: user?.$id,
    });
    if (!member || member.role !== MemberRole.ADMIN) {
      return c.json({ error: "Unauthorized" }, 400);
    }
    await tablesdb.deleteRow({
      databaseId: DATABASE_ID,
      tableId: WORKSPACES_ID,
      rowId: workspaceId,
    });

    return c.json({ data: { $id: workspaceId } });
  })
  .post("/:workspaceId/reset-invite-code", sessionMiddleware, async (c) => {
    const tablesdb = c.get("tablesdb");
    const user = c.get("user");
    const { workspaceId } = c.req.param();
    const member = await getMember({
      tablesDB: tablesdb,
      workspaceId,
      userId: user?.$id,
    });
    if (!member || member.role !== MemberRole.ADMIN) {
      return c.json({ error: "Unauthorized" }, 400);
    }
    const workspace = await tablesdb.updateRow({
      databaseId: DATABASE_ID,
      tableId: WORKSPACES_ID,
      rowId: workspaceId,
      data: {
        inviteCode: generateInviteCode(6),
      },
    });

    return c.json({ data: workspace });
  })
  .post(
    "/:workspaceId/join",
    sessionMiddleware,
    zValidator("json", z.object({ code: z.string() })),
    async (c) => {
      const { workspaceId } = c.req.param();
      const { code } = c.req.valid("json");

      const tablesdb = c.get("tablesdb");
      const user = c.get("user");

      const member = await getMember({
        tablesDB: tablesdb,
        workspaceId,
        userId: user?.$id,
      });
      if (member) {
        return c.json({ error: "Already a member" }, 400);
      }
      const workspace = await tablesdb.getRow<Workspace>({
        databaseId: DATABASE_ID,
        tableId: WORKSPACES_ID,
        rowId: workspaceId,
      });
      if (workspace.inviteCode !== code) {
        return c.json({ error: "Invalid invite code" }, 400);
      }

      await tablesdb.createRow({
        databaseId: DATABASE_ID,
        tableId: MEMBERS_ID,
        rowId: ID.unique(),
        data: {
          workspaceId,
          userId: user?.$id,
          role: MemberRole.MEMBER,
        },
      });

      return c.json({ data: workspace });
    }
  );

export default app;
