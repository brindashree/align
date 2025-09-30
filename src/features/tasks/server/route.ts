import { Hono } from "hono";
import { createTaskSchema } from "../schemas";
import { sessionMiddleware } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { getMember } from "@/features/members/utils";
import { DATABASE_ID, MEMBERS_ID, PROJECTS_ID, TASKS_ID } from "@/config";
import { ID, Query } from "node-appwrite";
import { Task, TaskStatus } from "../types";
import z from "zod";
import { createAdminClient } from "@/lib/appwrite";
import { Project } from "@/features/projects/types";

const app = new Hono()
  .delete("/:taskId", sessionMiddleware, async (c) => {
    const tablesdb = c.get("tablesdb");
    const user = c.get("user");
    const { taskId } = c.req.param();
    const existingTask = await tablesdb.getRow<Task>({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      rowId: taskId,
    });
    const member = await getMember({
      tablesDB: tablesdb,
      workspaceId: existingTask.workspaceId,
      userId: user?.$id,
    });
    if (!member) {
      return c.json({ error: "Unauthorized" }, 400);
    }
    await tablesdb.deleteRow({
      databaseId: DATABASE_ID,
      tableId: TASKS_ID,
      rowId: taskId,
    });

    return c.json({ data: { $id: taskId } });
  })
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        projectId: z.string().nullish(),
        assigneeId: z.string().nullish(),
        status: z.enum(TaskStatus).nullish(),
        search: z.string().nullish(),
        dueDate: z.string().nullish(),
      })
    ),
    sessionMiddleware,
    async (c) => {
      const { users } = await createAdminClient();
      const tablesDB = c.get("tablesdb");
      const user = c.get("user");

      const { dueDate, status, workspaceId, projectId, assigneeId, search } =
        c.req.valid("query");

      const member = getMember({
        tablesDB,
        workspaceId,
        userId: user.$id,
      });
      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const query = [
        Query.equal("workspaceId", workspaceId),
        Query.orderDesc("$createdAt"),
      ];
      if (projectId) {
        query.push(Query.equal("projectId", projectId));
      }
      if (status) {
        query.push(Query.equal("status", status));
      }
      if (assigneeId) {
        query.push(Query.equal("assigneeId", assigneeId));
      }
      if (dueDate) {
        query.push(Query.equal("dueDate", dueDate));
      }
      if (search) {
        query.push(Query.equal("name", search));
      }
      const tasks = await tablesDB.listRows<Task>({
        tableId: TASKS_ID,
        databaseId: DATABASE_ID,
        queries: query,
      });
      const projectIds = tasks.rows?.map((task) => task.projectId);
      const assigneeIds = tasks.rows?.map((task) => task.assigneeId);
      const projects = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: PROJECTS_ID,
        queries:
          projectIds.length > 0 ? [Query.contains("$id", projectIds)] : [],
      });
      const members = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: MEMBERS_ID,
        queries:
          assigneeIds.length > 0 ? [Query.contains("$id", assigneeIds)] : [],
      });

      const assignees = await Promise.all(
        members.rows.map(async (member) => {
          const user = await users.get(member.userId);
          return {
            ...member,
            name: user.name,
            email: user.email,
          };
        })
      );

      const populatedTasks = tasks.rows.map((task) => {
        const project = projects.rows.find(
          (project) => project.$id === task.projectId
        );
        const assignee = assignees.find(
          (assignee) => assignee.$id === task.assigneeId
        );
        return {
          ...task,
          project,
          assignee,
        };
      });
      return c.json({
        data: {
          ...tasks,
          rows: populatedTasks,
        },
      });
    }
  )
  .get("/:taskId", sessionMiddleware, async (c) => {
    const { users } = await createAdminClient();
    const tablesDB = c.get("tablesdb");
    const currentUser = c.get("user");
    const { taskId } = c.req.param();

    const task = await tablesDB.getRow<Task>({
      tableId: TASKS_ID,
      databaseId: DATABASE_ID,
      rowId: taskId,
    });

    const currentMember = getMember({
      tablesDB,
      workspaceId: task.workspaceId,
      userId: currentUser.$id,
    });
    if (!currentMember) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const project = await tablesDB.getRow<Project>({
      databaseId: DATABASE_ID,
      tableId: PROJECTS_ID,
      rowId: task.projectId,
    });
    const member = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: MEMBERS_ID,
      rowId: task.assigneeId,
    });
    const user = await users.get(member.userId);
    const assignee = {
      ...member,
      name: user.name,
      email: user.email,
    };

    return c.json({
      data: {
        ...task,
        project,
        assignee,
      },
    });
  })
  .post(
    "/",
    zValidator("json", createTaskSchema),
    sessionMiddleware,
    async (c) => {
      const tablesDB = c.get("tablesdb");

      const user = c.get("user");

      const {
        name,
        description,
        dueDate,
        status,
        workspaceId,
        projectId,
        assigneeId,
      } = c.req.valid("json");

      const member = getMember({
        tablesDB,
        workspaceId,
        userId: user.$id,
      });
      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const highestPositionTask = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TASKS_ID,
        queries: [
          Query.equal("status", status),
          Query.equal("workspaceId", workspaceId),
          Query.orderAsc("position"),
          Query.limit(1),
        ],
      });
      const newPosition =
        highestPositionTask.rows.length > 0
          ? highestPositionTask.rows[0].position + 1000
          : 1000;

      const task = await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: TASKS_ID,
        rowId: ID.unique(),
        data: {
          name,
          status,
          description,
          workspaceId,
          projectId,
          dueDate,
          assigneeId,
          position: newPosition,
        },
      });

      return c.json({ data: task });
    }
  )
  .patch(
    "/:taskId",
    zValidator("json", createTaskSchema.partial()),
    sessionMiddleware,
    async (c) => {
      const tablesDB = c.get("tablesdb");

      const user = c.get("user");
      const { taskId } = c.req.param();
      const {
        name,
        description,
        dueDate,
        status,
        workspaceId,
        projectId,
        assigneeId,
      } = c.req.valid("json");
      const existingTask = await tablesDB.getRow<Task>({
        databaseId: DATABASE_ID,
        tableId: TASKS_ID,
        rowId: taskId,
      });

      const member = getMember({
        tablesDB,
        workspaceId: existingTask.workspaceId,
        userId: user.$id,
      });
      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const task = await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TASKS_ID,
        rowId: existingTask.$id,
        data: {
          name,
          status,
          description,
          projectId,
          dueDate,
          assigneeId,
        },
      });

      return c.json({ data: task });
    }
  )
  .post(
    "/bulk-update",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        tasks: z.array(
          z.object({
            $id: z.string(),
            status: z.enum(TaskStatus),
            position: z.number().int().positive().min(1000).max(1000000),
          })
        ),
      })
    ),
    async (c) => {
      const tablesDB = c.get("tablesdb");

      const user = c.get("user");
      const { tasks } = c.req.valid("json");
      const tasksToUpdate = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TASKS_ID,
        queries: [
          Query.contains(
            "$id",
            tasks.map((task) => task.$id)
          ),
        ],
      });

      const workspaceIds = new Set(
        tasksToUpdate.rows.map((task) => task.workspaceId)
      );
      if (workspaceIds.size !== 1) {
        return c.json({
          error: "All the task should belong to same workspace",
        });
      }

      const workspaceId = Array.from(workspaceIds)[0];

      const member = getMember({
        tablesDB,
        workspaceId,
        userId: user.$id,
      });
      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updatedTasks = await Promise.all(
        tasks.map(async (task) => {
          const { $id, position, status } = task;
          return tablesDB.updateRow({
            databaseId: DATABASE_ID,
            tableId: TASKS_ID,
            rowId: $id,
            data: {
              status,
              position,
            },
          });
        })
      );
      return c.json({ data: updatedTasks });
    }
  );
export default app;
