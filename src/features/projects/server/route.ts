import { DATABASE_ID, IMAGES_BUCKET_ID, PROJECTS_ID, TASKS_ID } from "@/config";
import { getMember } from "@/features/members/utils";
import { sessionMiddleware } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ID, Query } from "node-appwrite";
import z from "zod";
import { createProjectSchema, updateProjectSchema } from "../schemas";
import { Project } from "../types";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { TaskStatus } from "@/features/tasks/types";

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
  .get("/:projectId", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const tablesDB = c.get("tablesdb");
    const { projectId } = c.req.param();

    const project = await tablesDB.getRow<Project>({
      databaseId: DATABASE_ID,
      tableId: PROJECTS_ID,
      rowId: projectId,
    });
    const member = await getMember({
      tablesDB,
      workspaceId: project.workspaceId,
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

    return c.json({ data: project });
  })
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
  })
  .get("/:projectId/analytics", sessionMiddleware, async (c) => {
    const tablesdb = c.get("tablesdb");
    const user = c.get("user");
    const { projectId } = c.req.param();
    const project = await tablesdb.getRow<Project>({
      databaseId: DATABASE_ID,
      tableId: PROJECTS_ID,
      rowId: projectId,
    });
    const member = await getMember({
      tablesDB: tablesdb,
      workspaceId: project.workspaceId,
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
        Query.equal("projectId", projectId),
        Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString()),
      ],
    });
    const lastMonthTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("projectId", projectId),
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
        Query.equal("projectId", projectId),
        Query.equal("assigneeId", member.$id),
        Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString()),
      ],
    });
    const lastMonthAssignedTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("projectId", projectId),
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
        Query.equal("projectId", projectId),
        Query.notEqual("status", TaskStatus.DONE),
        Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString()),
      ],
    });
    const lastMonthIncompleteTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("projectId", projectId),
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
        Query.equal("projectId", projectId),
        Query.equal("status", TaskStatus.DONE),
        Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
        Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString()),
      ],
    });
    const lastMonthCompletedTasks = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      queries: [
        Query.equal("projectId", projectId),
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
        Query.equal("projectId", projectId),
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
        Query.equal("projectId", projectId),
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
