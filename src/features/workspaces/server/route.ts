import { sessionMiddleware } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createWorkspacesSchema, updateWorkspacesSchema } from "../schemas";
import {
  DATABASE_ID,
  WORKSPACES_ID,
  IMAGES_BUCKET_ID,
  MEMBERS_ID,
  TASKS_ID,
} from "@/config";
import { ID, Query } from "node-appwrite";
import { MemberRole } from "@/features/members/types";
import { generateInviteCode } from "@/lib/utils";
import { getMember } from "@/features/members/utils";
import z from "zod";
import { Workspace } from "../types";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { TaskStatus } from "@/features/tasks/types";

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
  )
  .get("/:workspaceId/analytics", sessionMiddleware, async (c) => {
    const tablesdb = c.get("tablesdb");
    const user = c.get("user");
    const { workspaceId } = c.req.param();

    const member = await getMember({
      tablesDB: tablesdb,
      workspaceId: workspaceId,
      userId: user?.$id,
    });
    if (!member) {
      return c.json({ error: "Unauthorized" }, 400);
    }
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const thisMonthTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString()),
      ],
    });
    const lastMonthTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
      ],
    });

    const taskCount = thisMonthTasks.total;
    const taskDifference = taskCount - lastMonthTasks.total;

    const thisMonthAssignedTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.equal("assigneeId", member.$id),
        Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString()),
      ],
    });
    const lastMonthAssignedTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.equal("assigneeId", member.$id),
        Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
      ],
    });
    const assignedTaskCount = thisMonthAssignedTasks.total;
    const assignedTaskDifference =
      assignedTaskCount - lastMonthAssignedTasks.total;

    const thisMonthIncompleteTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.notEqual("status", TaskStatus.DONE),
        Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString()),
      ],
    });
    const lastMonthIncompleteTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.notEqual("status", TaskStatus.DONE),
        Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
      ],
    });
    const incompleteTaskCount = thisMonthIncompleteTasks.total;
    const incompleteTaskDifference =
      incompleteTaskCount - lastMonthIncompleteTasks.total;

    const thisMonthCompletedTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.equal("status", TaskStatus.DONE),
        Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString()),
      ],
    });
    const lastMonthCompletedTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.equal("status", TaskStatus.DONE),
        Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
      ],
    });
    const completedTaskCount = thisMonthCompletedTasks.total;
    const completedTaskDifference =
      completedTaskCount - lastMonthCompletedTasks.total;

    const thisMonthOverdueTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.notEqual("status", TaskStatus.DONE),
        Query.lessThan("dueDate", now.toISOString()),
        Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString()),
      ],
    });
    const lastMonthOverdueTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.equal("status", TaskStatus.DONE),
        Query.lessThan("dueDate", now.toISOString()),
        Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString()),
      ],
    });
    const overdueTaskCount = thisMonthOverdueTasks.total;
    const overdueTaskDifference =
      overdueTaskCount - lastMonthOverdueTasks.total;

    return c.json({
      data: {
        taskCount,
        taskDifference,
        assignedTaskCount,
        assignedTaskDifference,
        completedTaskCount,
        completedTaskDifference,
        incompleteTaskCount,
        incompleteTaskDifference,
        overdueTaskCount,
        overdueTaskDifference,
      },
    });
  });

export default app;
